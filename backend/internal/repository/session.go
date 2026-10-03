package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"time"

	"awcp-examples/backend/internal/model"
)

const DatasetVersion = "2026-09-30.1"
const InitialTime = "2026-09-19T01:00:00Z"
const SessionLifetime = 7 * 24 * time.Hour

func loadSession(ctx context.Context, tx *sql.Tx, hash string, now time.Time) (model.Session, error) {
	return loadAccess(ctx, tx, model.Access{CookieHash: hash}, now)
}

func loadAccess(ctx context.Context, tx *sql.Tx, access model.Access, now time.Time) (model.Session, error) {
	var s model.Session
	var expiry int64
	condition := "token_hash=?"
	args := []any{access.CookieHash, now.Unix()}
	if access.Principal != nil && access.CookieHash == "" {
		condition = "id=(SELECT session_id FROM mcp_workspace_bindings WHERE issuer=? AND subject=? AND enabled=1)"
		args = []any{access.Principal.Issuer, access.Principal.Subject, now.Unix()}
	} else if access.CookieHash == "" || access.Principal != nil {
		return s, model.Failure(401, "session.unauthorized", "无效访问身份。")
	}
	err := tx.QueryRowContext(ctx, `SELECT id,generation,seed,dataset_version,profile,simulated_at,expires_at FROM demo_sessions WHERE `+condition+` AND expires_at>?`, args...).Scan(&s.ID, &s.Generation, &s.Seed, &s.DatasetVersion, &s.Profile, &s.SimulatedAt, &expiry)
	if err == sql.ErrNoRows {
		if access.Principal != nil {
			return s, model.Failure(403, "workspace.not-linked", "请在网站登录并关联演示空间；空间可能已过期或授权已断开。")
		}
		return s, model.Failure(401, "session.expired", "演示会话不存在或已过期，请重新进入。")
	}
	s.ExpiresAt = time.Unix(expiry, 0).UTC().Format(time.RFC3339)
	return s, err
}
func fillSession(ctx context.Context, tx *sql.Tx, s *model.Session) error {
	s.Employees = []model.Employee{}
	s.Departments = []model.Department{}
	rows, err := tx.QueryContext(ctx, `SELECT id,department_id,name,roles,active FROM employees WHERE session_id=? ORDER BY id`, s.ID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var e model.Employee
		var roles string
		if err := rows.Scan(&e.ID, &e.DepartmentID, &e.Name, &roles, &e.Active); err != nil {
			rows.Close()
			return err
		}
		if err := json.Unmarshal([]byte(roles), &e.Roles); err != nil {
			rows.Close()
			return err
		}
		s.Employees = append(s.Employees, e)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	rows, err = tx.QueryContext(ctx, `SELECT id,name FROM departments WHERE session_id=? ORDER BY id`, s.ID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var d model.Department
		if err := rows.Scan(&d.ID, &d.Name); err != nil {
			rows.Close()
			return err
		}
		s.Departments = append(s.Departments, d)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()
	return tx.QueryRowContext(ctx, `SELECT count(*) FROM report_entries WHERE session_id=?`, s.ID).Scan(&s.RecordCount)
}
func (s *Store) CreateSession(ctx context.Context, id, hash, generation, profile string, now time.Time) (model.Session, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return model.Session{}, err
	}
	defer tx.Rollback()
	_, err = tx.ExecContext(ctx, `INSERT INTO demo_sessions(id,token_hash,generation,seed,dataset_version,profile,simulated_at,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)`, id, hash, generation, 20260919, DatasetVersion, profile, InitialTime, now.Unix(), now.Add(SessionLifetime).Unix())
	if err != nil {
		return model.Session{}, err
	}
	view, err := loadSession(ctx, tx, hash, now)
	if err != nil {
		return view, err
	}
	if err = seedSession(ctx, tx, view); err != nil {
		return view, err
	}
	if err = fillSession(ctx, tx, &view); err != nil {
		return view, err
	}
	return view, tx.Commit()
}
func (s *Store) Session(ctx context.Context, hash string, now time.Time) (model.Session, error) {
	return s.SessionFor(ctx, model.Access{CookieHash: hash}, now)
}

func (s *Store) SessionFor(ctx context.Context, access model.Access, now time.Time) (model.Session, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return model.Session{}, err
	}
	defer tx.Rollback()
	view, err := loadAccess(ctx, tx, access, now)
	if err != nil {
		return view, err
	}
	expiry := now.Add(SessionLifetime)
	if _, err = tx.ExecContext(ctx, `UPDATE demo_sessions SET expires_at=? WHERE id=?`, expiry.Unix(), view.ID); err != nil {
		return view, err
	}
	view.ExpiresAt = expiry.UTC().Format(time.RFC3339)
	if err = fillSession(ctx, tx, &view); err != nil {
		return view, err
	}
	return view, tx.Commit()
}
func (s *Store) Reset(ctx context.Context, hash, expected, requestID, generation string, now time.Time) (model.Session, error) {
	return s.ResetFor(ctx, model.Access{CookieHash: hash}, expected, requestID, generation, "", now)
}

func (s *Store) ResetFor(ctx context.Context, access model.Access, expected, requestID, generation, confirmationHash string, now time.Time) (model.Session, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return model.Session{}, err
	}
	defer tx.Rollback()
	view, err := loadAccess(ctx, tx, access, now)
	if err != nil {
		return view, err
	}
	if access.Principal != nil {
		if err = authorizeReset(ctx, tx, *access.Principal, view, expected, requestID, confirmationHash, now); err != nil {
			return view, err
		}
	}
	var from, to string
	err = tx.QueryRowContext(ctx, `SELECT from_generation,to_generation FROM reset_receipts WHERE session_id=? AND request_id=?`, view.ID, requestID).Scan(&from, &to)
	if err == nil {
		if from != expected || to != view.Generation {
			return view, model.Failure(409, "session.reset-conflict", "重置请求已用于其他数据版本，请刷新。")
		}
		expiry := now.Add(SessionLifetime)
		if _, err = tx.ExecContext(ctx, `UPDATE demo_sessions SET expires_at=? WHERE id=?`, expiry.Unix(), view.ID); err != nil {
			return view, err
		}
		view.ExpiresAt = expiry.UTC().Format(time.RFC3339)
		if err = fillSession(ctx, tx, &view); err != nil {
			return view, err
		}
		return view, tx.Commit()
	}
	if err != sql.ErrNoRows {
		return view, err
	}
	if view.Generation != expected {
		return view, model.Failure(409, "session.generation-conflict", "数据已在其他页面重置，请刷新后再操作。")
	}
	// Delete children first. All reset work and generation replacement commit together.
	for _, table := range []string{"demo_jobs", "report_entries", "employees", "departments"} {
		if _, err = tx.ExecContext(ctx, `DELETE FROM `+table+` WHERE session_id=?`, view.ID); err != nil {
			return view, err
		}
	}
	expiry := now.Add(SessionLifetime)
	if _, err = tx.ExecContext(ctx, `UPDATE demo_sessions SET generation=?,simulated_at=?,dataset_version=?,expires_at=? WHERE id=?`, generation, InitialTime, DatasetVersion, expiry.Unix(), view.ID); err != nil {
		return view, err
	}
	view.Generation = generation
	view.SimulatedAt = InitialTime
	view.DatasetVersion = DatasetVersion
	view.ExpiresAt = expiry.UTC().Format(time.RFC3339)
	if err = seedSession(ctx, tx, view); err != nil {
		return view, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO reset_receipts(session_id,request_id,from_generation,to_generation) VALUES(?,?,?,?)`, view.ID, requestID, expected, generation); err != nil {
		return view, err
	}
	if err = fillSession(ctx, tx, &view); err != nil {
		return view, err
	}
	if access.Principal != nil {
		if err = auditMCP(ctx, tx, *access.Principal, view.ID, "demo_reset_execute", "completed", now); err != nil {
			return view, err
		}
	}
	return view, tx.Commit()
}
func (s *Store) Cleanup(ctx context.Context, now time.Time) error {
	// Cascades on sessions are safe for all child tables in the same statement.
	_, err := s.DB.ExecContext(ctx, `DELETE FROM demo_sessions WHERE expires_at<=?`, now.Unix())
	if err == nil {
		_, err = s.DB.ExecContext(ctx, `DELETE FROM mcp_reset_confirmations WHERE expires_at<=? AND request_key=''`, now.Unix())
	}
	if err == nil {
		_, err = s.DB.ExecContext(ctx, `DELETE FROM demo_oauth_tokens WHERE expires_at<=?`, now.Unix())
	}
	if err == nil {
		_, err = s.DB.ExecContext(ctx, `DELETE FROM demo_oauth_codes WHERE expires_at<=?`, now.Add(-time.Hour).Unix())
	}
	return err
}

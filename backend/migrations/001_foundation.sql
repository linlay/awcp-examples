CREATE TABLE demo_sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    generation TEXT NOT NULL,
    seed INTEGER NOT NULL,
    dataset_version TEXT NOT NULL,
    profile TEXT NOT NULL CHECK (profile IN ('acceptance', 'standard')),
    simulated_at TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON demo_sessions(expires_at);
CREATE TABLE departments (
    session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    PRIMARY KEY(session_id, id)
);
CREATE TABLE employees (
    session_id TEXT NOT NULL,
    id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    name TEXT NOT NULL,
    roles TEXT NOT NULL,
    active INTEGER NOT NULL CHECK(active IN (0, 1)),
    PRIMARY KEY(session_id, id),
    FOREIGN KEY(session_id, department_id) REFERENCES departments(session_id, id) ON DELETE CASCADE
);
-- Historical analytical fixtures, NOT the source of truth for migrated business commands.
CREATE TABLE report_entries (
    session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    scenario_id TEXT NOT NULL,
    department_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'returned', 'withdrawn')),
    amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
    created_on TEXT NOT NULL,
    duration_hours INTEGER,
    overdue INTEGER NOT NULL CHECK(overdue IN (0, 1)),
    PRIMARY KEY(session_id, id),
    FOREIGN KEY(session_id, department_id) REFERENCES departments(session_id, id),
    FOREIGN KEY(session_id, owner_id) REFERENCES employees(session_id, id)
);
CREATE INDEX report_entries_date ON report_entries(session_id, created_on, id);
CREATE INDEX report_entries_department ON report_entries(session_id, department_id, created_on);
CREATE INDEX report_entries_scenario ON report_entries(session_id, scenario_id, status, created_on);
CREATE TABLE demo_jobs (
    session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    generation TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('accepted', 'running', 'completed', 'failed', 'cancelled')),
    payload TEXT NOT NULL,
    PRIMARY KEY(session_id, id)
);
-- Kept across reset so a lost reset response can be retried without resetting again.
CREATE TABLE reset_receipts (
    session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    from_generation TEXT NOT NULL,
    to_generation TEXT NOT NULL,
    PRIMARY KEY(session_id, request_id)
);

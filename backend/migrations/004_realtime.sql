-- A workspace can be observed by multiple independently authenticated browsers.
CREATE TABLE browser_sessions (
    token_hash TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
);
INSERT INTO browser_sessions SELECT token_hash,id,expires_at FROM demo_sessions;
CREATE INDEX browser_sessions_workspace ON browser_sessions(session_id);
ALTER TABLE demo_sessions ADD COLUMN event_revision INTEGER NOT NULL DEFAULT 0;
CREATE TABLE workspace_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES demo_sessions(id) ON DELETE CASCADE,
    generation TEXT NOT NULL,
    kind TEXT NOT NULL,
    source TEXT NOT NULL,
    operation_id TEXT NOT NULL,
    resources TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX workspace_events_replay ON workspace_events(session_id,sequence);

-- OAuth credentials live at the authorization server. Only an identity binding
-- is persisted here. Deliberately no CASCADE on audit data or identity records.
CREATE TABLE mcp_workspace_bindings (
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    session_id TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(issuer, subject),
    UNIQUE(session_id)
);
CREATE TABLE mcp_audit_events (
    id TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    client_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    outcome TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX mcp_audit_created ON mcp_audit_events(created_at);
CREATE TABLE mcp_reset_confirmations (
    token_hash TEXT PRIMARY KEY,
    issuer TEXT NOT NULL,
    subject TEXT NOT NULL,
    client_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    generation TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    request_key TEXT NOT NULL DEFAULT ''
);
CREATE INDEX mcp_confirmations_expiry ON mcp_reset_confirmations(expires_at);

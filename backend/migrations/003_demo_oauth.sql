-- Small embedded OAuth server: no separate identity service or database.
CREATE TABLE demo_oauth_clients (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 redirects TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TABLE demo_oauth_codes (
 hash TEXT PRIMARY KEY,
 client_id TEXT NOT NULL,
 redirect_uri TEXT NOT NULL,
 challenge TEXT NOT NULL,
 scope TEXT NOT NULL,
 issuer TEXT NOT NULL,
 audience TEXT NOT NULL,
 credential_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE demo_oauth_tokens (
 hash TEXT PRIMARY KEY,
 client_id TEXT NOT NULL,
 subject TEXT NOT NULL,
 scope TEXT NOT NULL,
 issuer TEXT NOT NULL,
 audience TEXT NOT NULL,
 credential_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 code_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX demo_oauth_tokens_expiry ON demo_oauth_tokens(expires_at);
CREATE INDEX demo_oauth_tokens_code ON demo_oauth_tokens(code_hash);
CREATE INDEX demo_oauth_codes_expiry ON demo_oauth_codes(expires_at);

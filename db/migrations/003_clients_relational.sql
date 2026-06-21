CREATE TABLE IF NOT EXISTS clients_scopes (
  scope_key TEXT PRIMARY KEY,
  access_account_id TEXT NOT NULL,
  sellasist_scope TEXT NOT NULL DEFAULT '',
  account TEXT NOT NULL DEFAULT '',
  use_demo_data BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at TIMESTAMPTZ,
  meta JSONB,
  raw JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS clients_scopes_access_account_idx
  ON clients_scopes (access_account_id);

CREATE INDEX IF NOT EXISTS clients_scopes_updated_at_idx
  ON clients_scopes (updated_at DESC);

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  scope_key TEXT NOT NULL REFERENCES clients_scopes (scope_key) ON DELETE CASCADE,
  sellasist_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  search_label TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope_key, sellasist_id)
);

CREATE INDEX IF NOT EXISTS clients_scope_key_idx ON clients (scope_key);
CREATE INDEX IF NOT EXISTS clients_scope_id_idx ON clients (scope_key, id);

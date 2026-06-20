-- KV store dla konfiguracji, kont, zamówień i dziennika zdarzeń
CREATE TABLE IF NOT EXISTS app_kv_store (
  scope_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_kv_store_updated_at ON app_kv_store (updated_at DESC);

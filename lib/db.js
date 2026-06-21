const { neon } = require('@neondatabase/serverless');

const memoryStore = new Map();

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  );
}

function createMemoryFallback() {
  return {
    async get(key) {
      return memoryStore.has(key) ? memoryStore.get(key) : null;
    },
    async setJSON(key, value) {
      memoryStore.set(key, value);
    },
    async delete(key) {
      memoryStore.delete(key);
    },
  };
}

let sqlClient = null;

function getSql() {
  const url = getConnectionString();
  if (!url) {
    return null;
  }
  if (!sqlClient) {
    sqlClient = neon(url);
  }
  return sqlClient;
}

async function ensureTable() {
  const sql = getSql();
  if (!sql) {
    return false;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS app_kv_store (
      scope_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  return true;
}

async function resolveStore() {
  const sql = getSql();
  if (!sql) {
    return { useFallback: true, fallback: createMemoryFallback() };
  }

  await ensureTable();
  return { useFallback: false, sql };
}

async function readJson(key, fallback) {
  const store = await resolveStore();

  if (store.useFallback) {
    const value = await store.fallback.get(key);
    return value ?? fallback;
  }

  const rows = await store.sql`
    SELECT payload FROM app_kv_store WHERE scope_key = ${key} LIMIT 1
  `;

  if (!rows?.[0]) {
    return fallback;
  }

  return rows[0].payload ?? fallback;
}

async function writeJson(key, value) {
  const store = await resolveStore();

  if (store.useFallback) {
    await store.fallback.setJSON(key, value);
    return;
  }

  await store.sql`
    INSERT INTO app_kv_store (scope_key, payload, updated_at)
    VALUES (${key}, ${value}, NOW())
    ON CONFLICT (scope_key)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
  `;
}

async function deleteJson(key) {
  const store = await resolveStore();

  if (store.useFallback) {
    await store.fallback.delete(key);
    return;
  }

  await store.sql`DELETE FROM app_kv_store WHERE scope_key = ${key}`;
}

function getScopedKey(scope, id) {
  return `${scope}:${id}`;
}

module.exports = {
  ensureTable,
  readJson,
  writeJson,
  deleteJson,
  getScopedKey,
  getConnectionString,
};

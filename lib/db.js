const { neon } = require('@neondatabase/serverless');
const { loadLocalEnv } = require('./loadLocalEnv');

loadLocalEnv();

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

async function findOrderStoreEntries(accessAccountId) {
  const store = await resolveStore();
  const prefix = `orders:${accessAccountId}::`;

  if (store.useFallback) {
    const results = [];
    memoryStore.forEach((payload, key) => {
      if (String(key).startsWith(prefix)) {
        results.push({ scope_key: key, payload, updated_at: null });
      }
    });
    return results;
  }

  const rows = await store.sql`
    SELECT scope_key, payload, updated_at
    FROM app_kv_store
    WHERE scope_key LIKE ${`${prefix}%`}
    ORDER BY updated_at DESC
  `;

  return rows || [];
}

async function findOrderStoreEntriesByPayloadAccount(accessAccountId) {
  const store = await resolveStore();

  if (store.useFallback) {
    const results = [];
    memoryStore.forEach((payload, key) => {
      if (!String(key).startsWith('orders:')) {
        return;
      }
      if (payload?.accessAccountId === accessAccountId) {
        results.push({ scope_key: key, payload, updated_at: null });
      }
    });
    return results;
  }

  const rows = await store.sql`
    SELECT scope_key, payload, updated_at
    FROM app_kv_store
    WHERE scope_key LIKE 'orders:%'
      AND payload->>'accessAccountId' = ${accessAccountId}
    ORDER BY updated_at DESC
  `;

  return rows || [];
}

async function findAllOrderStoreEntries() {
  const store = await resolveStore();

  if (store.useFallback) {
    const results = [];
    memoryStore.forEach((payload, key) => {
      if (String(key).startsWith('orders:')) {
        results.push({ scope_key: key, payload, updated_at: null });
      }
    });
    return results.sort((a, b) => {
      const aTs = new Date(a.payload?.fetchedAt || 0).getTime();
      const bTs = new Date(b.payload?.fetchedAt || 0).getTime();
      return bTs - aTs;
    });
  }

  const rows = await store.sql`
    SELECT scope_key, payload, updated_at
    FROM app_kv_store
    WHERE scope_key LIKE 'orders:%'
    ORDER BY updated_at DESC
  `;

  return rows || [];
}

function pickBestOrderEntry(entries, accessAccountId = '') {
  if (!entries?.length) {
    return null;
  }

  const normalizedId = String(accessAccountId || '').trim();
  if (normalizedId) {
    const byPayload = entries.find((entry) => entry.payload?.accessAccountId === normalizedId);
    if (byPayload) {
      return byPayload;
    }

    const byScope = entries.find((entry) =>
      String(entry.scope_key || '').startsWith(`orders:${normalizedId}::`)
    );
    if (byScope) {
      return byScope;
    }
  }

  return entries[0];
}

function entryToScopeData(entry) {
  const scopeKey = String(entry.scope_key || '').replace(/^orders:/, '');
  const payload = entry.payload || {};
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  const scopeAccountId = scopeKey.includes('::') ? scopeKey.split('::')[0] : '';

  return {
    scopeKey,
    total: orders.length,
    fetchedAt: payload.fetchedAt || entry.updated_at || null,
    account: payload.account || '',
    useDemoData: Boolean(payload.useDemoData),
    accessAccountId: payload.accessAccountId || scopeAccountId,
  };
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
  resolveStore,
  findOrderStoreEntries,
  findOrderStoreEntriesByPayloadAccount,
  findAllOrderStoreEntries,
  pickBestOrderEntry,
  entryToScopeData,
};

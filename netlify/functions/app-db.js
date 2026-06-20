const { getDatabase } = require('@netlify/database');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const memoryStore = new Map();

function response(statusCode, body) {
  return {
    statusCode,
    headers,
    body: JSON.stringify(body),
  };
}

function getScopedKey(scope, id) {
  return `${scope}:${id}`;
}

function createFallbackStore() {
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

async function ensureTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_kv_store (
      scope_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function resolveDatabase() {
  try {
    const db = getDatabase();
    return { db, fallback: createFallbackStore(), useFallback: false };
  } catch (_e) {
    return { db: null, fallback: createFallbackStore(), useFallback: true };
  }
}

async function readJson(state, key, fallback) {
  if (state.useFallback) {
    const value = await state.fallback.get(key);
    return value ?? fallback;
  }

  await ensureTable(state.db.pool);
  const result = await state.db.pool.query(
    'SELECT payload FROM app_kv_store WHERE scope_key = $1 LIMIT 1',
    [key]
  );
  if (!result.rows?.[0]) return fallback;
  return result.rows[0].payload ?? fallback;
}

async function writeJson(state, key, value) {
  if (state.useFallback) {
    await state.fallback.setJSON(key, value);
    return;
  }

  await ensureTable(state.db.pool);
  await state.db.pool.query(
    `
      INSERT INTO app_kv_store (scope_key, payload, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (scope_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `,
    [key, JSON.stringify(value)]
  );
}

async function deleteJson(state, key) {
  if (state.useFallback) {
    await state.fallback.delete(key);
    return;
  }

  await ensureTable(state.db.pool);
  await state.db.pool.query('DELETE FROM app_kv_store WHERE scope_key = $1', [key]);
}

function isLogClearAuthorized(username, password) {
  const trimmed = String(username || '').trim();
  const expectedUser = 'szym.kaczmarek@gmail.com';
  const expectedPassword =
    'szym.kaczmarek@gmail.comszym.kaczmarek@gmail.comszym.kaczmarek@gmail.com';
  return trimmed === expectedUser && password === expectedPassword;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const action = String(body.action || '').trim();
    const dbState = resolveDatabase();

    if (action === 'get_access') {
      const data = await readJson(dbState, 'access:store', { accounts: [], activeId: null, users: {} });
      return response(200, { ok: true, data });
    }

    if (action === 'set_access') {
      const payload = body.payload || {};
      const next = {
        accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
        activeId: payload.activeId || null,
        users: payload.users && typeof payload.users === 'object' ? payload.users : {},
      };
      await writeJson(dbState, 'access:store', next);
      return response(200, { ok: true });
    }

    if (action === 'get_config') {
      const accessAccountId = String(body.accessAccountId || '').trim();
      if (!accessAccountId) return response(400, { error: 'Brak accessAccountId' });
      const key = getScopedKey('config', accessAccountId);
      const data = await readJson(dbState, key, null);
      return response(200, { ok: true, data });
    }

    if (action === 'set_config') {
      const accessAccountId = String(body.accessAccountId || '').trim();
      if (!accessAccountId) return response(400, { error: 'Brak accessAccountId' });
      const payload = body.payload || {};
      await writeJson(dbState, getScopedKey('config', accessAccountId), payload);
      return response(200, { ok: true });
    }

    if (action === 'get_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) return response(400, { error: 'Brak scopeKey' });
      const data = await readJson(dbState, getScopedKey('orders', scopeKey), null);
      return response(200, { ok: true, data });
    }

    if (action === 'set_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) return response(400, { error: 'Brak scopeKey' });
      const payload = body.payload || {};
      await writeJson(dbState, getScopedKey('orders', scopeKey), payload);
      return response(200, { ok: true });
    }

    if (action === 'clear_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) return response(400, { error: 'Brak scopeKey' });
      await deleteJson(dbState, getScopedKey('orders', scopeKey));
      return response(200, { ok: true });
    }

    if (action === 'get_event_logs') {
      const data = await readJson(dbState, 'event_log:global', { entries: [] });
      const entries = Array.isArray(data.entries) ? data.entries : [];
      return response(200, { ok: true, data: { entries } });
    }

    if (action === 'append_event_log') {
      const entry = body.entry;
      if (!entry || typeof entry !== 'object' || !entry.id) {
        return response(400, { error: 'Brak wpisu logu' });
      }
      const store = await readJson(dbState, 'event_log:global', { entries: [] });
      const prev = Array.isArray(store.entries) ? store.entries : [];
      const entries = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 500);
      await writeJson(dbState, 'event_log:global', { entries });
      return response(200, { ok: true });
    }

    if (action === 'clear_event_logs') {
      const adminUsername = String(body.adminUsername || '').trim();
      const adminPassword = String(body.adminPassword || '');
      if (!isLogClearAuthorized(adminUsername, adminPassword)) {
        return response(403, { error: 'Brak uprawnień. Podaj login i hasło administratora.' });
      }
      await writeJson(dbState, 'event_log:global', { entries: [] });
      return response(200, { ok: true });
    }

    return response(400, { error: 'Nieznana akcja' });
  } catch (err) {
    return response(500, { error: err.message || 'Błąd bazy danych' });
  }
};

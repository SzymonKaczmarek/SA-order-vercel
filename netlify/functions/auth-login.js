const { getDatabase } = require('@netlify/database');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getUsersFromEnv() {
  const raw = process.env.AUTH_USERS;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_e) {
    return null;
  }
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

async function readAccessStoreFromDb() {
  try {
    const db = getDatabase();
    await ensureTable(db.pool);
    const result = await db.pool.query(
      'SELECT payload FROM app_kv_store WHERE scope_key = $1 LIMIT 1',
      ['access:store']
    );
    return result.rows?.[0]?.payload || null;
  } catch (_e) {
    return null;
  }
}

function findAccountInStore(store, username, password) {
  const accounts = Array.isArray(store?.accounts) ? store.accounts : [];
  const usersMap = store?.users && typeof store.users === 'object' ? store.users : {};
  const trimmed = String(username || '').trim();

  const direct = accounts.find(
    (item) => item.username === trimmed && item.password === password
  );
  if (direct) {
    return direct;
  }

  for (const account of accounts) {
    const legacyUsers = Array.isArray(usersMap[account.id]) ? usersMap[account.id] : [];
    const found = legacyUsers.find(
      (item) => item.username === trimmed && item.password === password
    );
    if (found) {
      return { ...account, username: found.username, name: account.name || found.firstName || found.username };
    }
  }

  return null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { username, password } = body;

    if (!username || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Podaj login i hasło' }),
      };
    }

    const trimmed = String(username || '').trim();
    const dbStore = await readAccessStoreFromDb();

    if (dbStore) {
      const account = findAccountInStore(dbStore, username, password);
      if (account) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            username: account.username,
            role: account.role || 'user',
            firstName: account.name || account.username,
            lastName: '',
            email: account.email || account.username,
            accessAccountId: account.id,
          }),
        };
      }

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Nieprawidłowy login lub hasło.' }),
      };
    }

    const users = getUsersFromEnv();
    if (users) {
      const found = users.find(
        (u) => u.username === trimmed && u.password === password
      );

      if (found) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            username: found.username,
            role: found.role || 'user',
            firstName: found.firstName || '',
            lastName: found.lastName || '',
            email: found.email || '',
          }),
        };
      }

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Nieprawidłowy login lub hasło.' }),
      };
    }

    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Brak konfiguracji logowania' }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

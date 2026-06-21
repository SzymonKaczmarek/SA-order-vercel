const { handleOptions, rejectMethod, jsonResponse } = require('../lib/api');
const { readJson } = require('../lib/db');

function getUsersFromEnv() {
  const raw = process.env.AUTH_USERS;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
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
      return {
        ...account,
        username: found.username,
        name: account.name || found.firstName || found.username,
      };
    }
  }

  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res);
  }

  if (req.method !== 'POST') {
    return rejectMethod(req, res);
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return jsonResponse(res, 400, { error: 'Podaj login i hasło' });
    }

    const trimmed = String(username || '').trim();
    const dbStore = await readJson('access:store', null);

    if (dbStore?.accounts?.length) {
      const account = findAccountInStore(dbStore, username, password);
      if (account) {
        return jsonResponse(res, 200, {
          username: account.username,
          role: account.role || 'user',
          firstName: account.name || account.username,
          lastName: '',
          email: account.email || account.username,
          accessAccountId: account.id,
        });
      }

      return jsonResponse(res, 401, { error: 'Nieprawidłowy login lub hasło.' });
    }

    const users = getUsersFromEnv();
    if (users) {
      const found = users.find((u) => u.username === trimmed && u.password === password);

      if (found) {
        return jsonResponse(res, 200, {
          username: found.username,
          role: found.role || 'user',
          firstName: found.firstName || '',
          lastName: found.lastName || '',
          email: found.email || '',
        });
      }

      return jsonResponse(res, 401, { error: 'Nieprawidłowy login lub hasło.' });
    }

    return jsonResponse(res, 503, { error: 'Brak konfiguracji logowania' });
  } catch (err) {
    return jsonResponse(res, 500, { error: err.message });
  }
};

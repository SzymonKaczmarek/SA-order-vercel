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

    const users = getUsersFromEnv();
    if (!users) {
      return {
        statusCode: 503,
        headers,
        body: JSON.stringify({ error: 'Brak konfiguracji AUTH_USERS – użyj logowania lokalnego' }),
      };
    }

    const found = users.find(
      (u) => u.username === String(username).trim() && u.password === password
    );

    if (!found) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Nieprawidłowy login lub hasło' }),
      };
    }

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
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

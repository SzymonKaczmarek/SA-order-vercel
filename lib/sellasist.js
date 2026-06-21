const { CORS_HEADERS } = require('./api');

function buildApiUrl(account, path, params = {}) {
  const base = `https://${account}.sellasist.pl/api/v1${path}`;
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

function normalizeAccount(raw) {
  let account = String(raw || '').trim().toLowerCase();

  account = account.replace(/^https?:\/\//, '');
  account = account.replace(/\.sellasist\.pl\/?.*$/, '');
  account = account.replace(/\/.*$/, '');

  return account;
}

const SELLASIST_FETCH_TIMEOUT_MS = 25000;

async function callSellasist(account, apiKey, path, params = {}) {
  const url = buildApiUrl(account, path, params);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SELLASIST_FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        apiKey,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(
        'Sellasist nie odpowiedział w czasie. Użyj mniejszego zakresu ID lub spróbuj ponownie.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_e) {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || data?.code || `Sellasist HTTP ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return data;
}

module.exports = {
  CORS_HEADERS,
  buildApiUrl,
  normalizeAccount,
  callSellasist,
};

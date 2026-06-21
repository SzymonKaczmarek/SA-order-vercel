const { handleOptions, rejectMethod, jsonResponse } = require('../lib/api');
const {
  buildApiUrl,
  callSellasist,
  normalizeAccount,
} = require('../lib/sellasist');

const SELLASIST_USERS_PATH = '/users';

function buildRequestMeta(account, query) {
  const queryParams = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  return {
    gateway: {
      method: 'POST',
      path: '/api/sellasist-users',
      description: 'Proxy Vercel – omija CORS, przekazuje apiKey po stronie serwera',
    },
    sellasist: {
      method: 'GET',
      path: `/api/v1${SELLASIST_USERS_PATH}`,
      url: buildApiUrl(account, SELLASIST_USERS_PATH, queryParams),
      headers: {
        apiKey: '(z konfiguracji użytkownika)',
        Accept: 'application/json',
      },
      queryParams,
    },
    documentation: 'https://api.sellasist.pl/#/Klienci/get_users',
  };
}

function normalizeUsers(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.users)) {
    return data.users;
  }
  if (Array.isArray(data?.data)) {
    return data.data;
  }
  return [];
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res);
  }

  if (req.method !== 'POST') {
    return rejectMethod(req, res);
  }

  try {
    const body = req.body || {};
    const account = normalizeAccount(body.account);
    const apiKey = String(body.apiKey || '').trim();
    const params = body.params || {};

    if (!account || !apiKey) {
      return jsonResponse(res, 400, { error: 'Podaj subdomenę konta i klucz API' });
    }

    const query = {
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    };

    const meta = buildRequestMeta(account, query);
    const data = await callSellasist(account, apiKey, SELLASIST_USERS_PATH, query);

    return jsonResponse(res, 200, {
      users: normalizeUsers(data),
      raw: data,
      meta,
    });
  } catch (err) {
    return jsonResponse(res, 502, { error: err.message || 'Błąd pobierania klientów' });
  }
};

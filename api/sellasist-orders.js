const { handleOptions, rejectMethod, jsonResponse } = require('../lib/api');
const {
  buildApiUrl,
  callSellasist,
  normalizeAccount,
} = require('../lib/sellasist');

const SELLASIST_ORDERS_PATH = '/orders_with_carts';

function buildRequestMeta(account, query) {
  const queryParams = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  return {
    gateway: {
      method: 'POST',
      path: '/api/sellasist-orders',
      description: 'Proxy Vercel – omija CORS, przekazuje apiKey po stronie serwera',
    },
    sellasist: {
      method: 'GET',
      path: `/api/v1${SELLASIST_ORDERS_PATH}`,
      url: buildApiUrl(account, SELLASIST_ORDERS_PATH, queryParams),
      headers: {
        apiKey: '(z konfiguracji użytkownika)',
        Accept: 'application/json',
      },
      queryParams,
    },
    documentation: 'https://api.sellasist.pl/#/Zam%C3%B3wienia/get_orders_with_carts',
  };
}

function normalizeOrders(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data?.orders)) {
    return data.orders;
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
      limit: params.limit ?? 25,
      offset: params.offset ?? 0,
      status_id: params.status_id,
      from_id: params.from_id,
      email: params.email,
      payment_status: params.payment_status,
    };

    if (params.idRange?.from) {
      query.from_id = params.idRange.from - 1;
    }

    const meta = buildRequestMeta(account, query);
    const data = await callSellasist(account, apiKey, SELLASIST_ORDERS_PATH, query);

    return jsonResponse(res, 200, {
      orders: normalizeOrders(data),
      raw: data,
      meta,
    });
  } catch (err) {
    return jsonResponse(res, 502, { error: err.message || 'Błąd pobierania zamówień' });
  }
};

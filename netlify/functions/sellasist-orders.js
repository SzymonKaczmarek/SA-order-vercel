const SELLASIST_ORDERS_PATH = '/orders_with_carts';

const {
  buildApiUrl,
  callSellasist,
  handleOptions,
  jsonResponse,
  normalizeAccount,
} = require('./lib/sellasist');

function buildRequestMeta(account, query) {
  const queryParams = Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  return {
    gateway: {
      method: 'POST',
      path: '/.netlify/functions/sellasist-orders',
      description: 'Proxy Netlify – omija CORS, przekazuje apiKey po stronie serwera',
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
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return handleOptions();
  }

  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const account = normalizeAccount(body.account);
    const apiKey = String(body.apiKey || '').trim();
    const params = body.params || {};

    if (!account || !apiKey) {
      return jsonResponse(400, { error: 'Podaj subdomenę konta i klucz API' });
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

    return jsonResponse(200, {
      orders: normalizeOrders(data),
      raw: data,
      meta,
    });
  } catch (err) {
    return jsonResponse(502, { error: err.message || 'Błąd pobierania zamówień' });
  }
};

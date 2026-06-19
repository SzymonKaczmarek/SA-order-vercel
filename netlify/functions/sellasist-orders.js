const SELLASIST_ORDERS_PATH = '/orders_with_carts';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

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

async function callSellasist(account, apiKey, path, params) {
  const url = buildApiUrl(account, path, params);

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      apiKey,
      Accept: 'application/json',
    },
  });

  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_e) {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      data?.message || data?.error || `Sellasist HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

function normalizeOrders(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  return [];
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
    const account = String(body.account || '').trim();
    const apiKey = String(body.apiKey || '').trim();
    const params = body.params || {};

    if (!account || !apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Podaj subdomenę konta i klucz API' }),
      };
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        orders: normalizeOrders(data),
        raw: data,
        meta,
      }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

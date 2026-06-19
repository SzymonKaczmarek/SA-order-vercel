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

    if (!account || !apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Podaj subdomenę konta i klucz API' }),
      };
    }

    await callSellasist(account, apiKey, '/statuses', { limit: 1 });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: `Połączenie z ${account}.sellasist.pl działa.`,
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

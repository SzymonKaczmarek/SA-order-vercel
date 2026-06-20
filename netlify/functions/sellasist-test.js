const {
  callSellasist,
  handleOptions,
  jsonResponse,
  normalizeAccount,
} = require('./lib/sellasist');

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

    if (!account || !apiKey) {
      return jsonResponse(400, { error: 'Podaj subdomenę konta i klucz API' });
    }

    await callSellasist(account, apiKey, '/orders_with_carts', { limit: 1 });

    return jsonResponse(200, {
      ok: true,
      message: `Połączenie z ${account}.sellasist.pl działa.`,
      account,
    });
  } catch (err) {
    return jsonResponse(502, { error: err.message || 'Błąd połączenia z Sellasist' });
  }
};

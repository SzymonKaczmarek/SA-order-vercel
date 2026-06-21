const { handleOptions, rejectMethod, jsonResponse } = require('../lib/api');
const { callSellasist, normalizeAccount } = require('../lib/sellasist');

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

    if (!account || !apiKey) {
      return jsonResponse(res, 400, { error: 'Podaj subdomenę konta i klucz API' });
    }

    await callSellasist(account, apiKey, '/orders_with_carts', { limit: 1 });

    return jsonResponse(res, 200, {
      ok: true,
      message: `Połączenie z ${account}.sellasist.pl działa.`,
      account,
    });
  } catch (err) {
    return jsonResponse(res, 502, { error: err.message || 'Błąd połączenia z Sellasist' });
  }
};

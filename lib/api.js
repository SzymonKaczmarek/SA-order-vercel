const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function applyCors(res) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

function handleOptions(_req, res) {
  applyCors(res);
  return res.status(204).end();
}

function rejectMethod(req, res, allowed = 'POST') {
  applyCors(res);
  return res.status(405).json({ error: 'Method not allowed', allowed });
}

function jsonResponse(res, statusCode, body) {
  applyCors(res);
  return res.status(statusCode).json(body);
}

module.exports = {
  CORS_HEADERS,
  applyCors,
  handleOptions,
  rejectMethod,
  jsonResponse,
};

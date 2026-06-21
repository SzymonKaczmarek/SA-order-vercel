function sanitizeString(value) {
  if (typeof value !== 'string') {
    return value;
  }

  return value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '');
}

function jsonReplacer(_key, value) {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return null;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === undefined) {
    return null;
  }
  return value;
}

function sanitizeForPostgresJson(value) {
  if (value == null) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value, jsonReplacer));
  } catch (err) {
    const wrapped = new Error(`Nie udało się oczyścić danych JSON: ${err.message}`);
    wrapped.cause = err;
    throw wrapped;
  }
}

function encodeJsonForPostgres(value, context = '') {
  try {
    const sanitized = sanitizeForPostgresJson(value);
    const text = JSON.stringify(sanitized);
    JSON.parse(text);
    return text;
  } catch (err) {
    const label = context ? ` (${context})` : '';
    const wrapped = new Error(`Niepoprawny JSON${label}: ${err.message}`);
    wrapped.cause = err;
    throw wrapped;
  }
}

function normalizeScopeRaw(raw, ordersCount = 0) {
  if (raw == null) {
    return null;
  }

  if (Array.isArray(raw)) {
    return {
      kind: 'orders_snapshot',
      count: raw.length || ordersCount,
    };
  }

  if (typeof raw === 'object' && Array.isArray(raw.orders)) {
    return {
      kind: 'orders_snapshot',
      count: raw.orders.length || ordersCount,
    };
  }

  return sanitizeForPostgresJson(raw);
}

module.exports = {
  sanitizeForPostgresJson,
  sanitizeString,
  encodeJsonForPostgres,
  normalizeScopeRaw,
};

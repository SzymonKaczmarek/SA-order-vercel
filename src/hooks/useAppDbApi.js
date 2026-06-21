function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

const SKIP_DB_LOG_ACTIONS = new Set(['append_event_log', 'get_event_logs', 'clear_event_logs']);

async function callAppDb(action, payload = {}) {
  const startedAt = Date.now();
  let logDetails = { action, ...payload };
  if (logDetails.payload && typeof logDetails.payload === 'object') {
    logDetails = { ...logDetails, payload: '[payload]' };
  }

  try {
    const res = await fetch(`${getBaseUrl()}/.netlify/functions/app-db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Błąd app-db (${res.status})`);
    }

    if (!SKIP_DB_LOG_ACTIONS.has(action)) {
      const { logEvent } = await import('../utils/eventLog');
      logEvent({
        level: 'system',
        category: 'db',
        action: `db.${action}`,
        message: `Zapytanie do bazy: ${action}`,
        details: { ...logDetails, ok: true, durationMs: Date.now() - startedAt },
      });
    }

    return data;
  } catch (err) {
    if (!SKIP_DB_LOG_ACTIONS.has(action)) {
      const { logEvent } = await import('../utils/eventLog');
      logEvent({
        level: 'error',
        category: 'db',
        action: `db.${action}.error`,
        message: `Błąd bazy: ${action}`,
        details: {
          ...logDetails,
          ok: false,
          durationMs: Date.now() - startedAt,
          error: err.message,
        },
      });
    }
    throw err;
  }
}

export async function getAccessStoreFromDb() {
  const { data } = await callAppDb('get_access');
  return data;
}

export async function setAccessStoreToDb(payload) {
  const result = await callAppDb('set_access', { payload });
  return result?.data || null;
}

export async function getSellasistConfigFromDb(accessAccountId) {
  const { data } = await callAppDb('get_config', { accessAccountId });
  return data;
}

export async function setSellasistConfigToDb(accessAccountId, payload) {
  await callAppDb('set_config', { accessAccountId, payload });
}

export async function getOrdersFromServerDb(scopeKey) {
  const { data } = await callAppDb('get_orders', { scopeKey });
  return data;
}

export async function setOrdersToServerDb(scopeKey, payload) {
  await callAppDb('set_orders', { scopeKey, payload });
}

export async function clearOrdersFromServerDb(scopeKey) {
  await callAppDb('clear_orders', { scopeKey });
}

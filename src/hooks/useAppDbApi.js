function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

const SKIP_DB_LOG_ACTIONS = new Set([
  'append_event_log',
  'get_event_logs',
  'clear_event_logs',
  'resolve_orders_scope',
  'list_orders_scopes',
  'list_order_ids',
  'get_orders_by_ids',
]);

async function callAppDb(action, payload = {}) {
  const startedAt = Date.now();
  let logDetails = { action, ...payload };
  if (logDetails.payload && typeof logDetails.payload === 'object') {
    logDetails = { ...logDetails, payload: '[payload]' };
  }

  try {
    const res = await fetch(`${getBaseUrl()}/api/app-db`, {
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

export async function listOrdersScopesFromDb() {
  const { data } = await callAppDb('list_orders_scopes');
  return Array.isArray(data) ? data : [];
}

export async function resolveOrdersScopeFromDb(accessAccountId, configHint = '') {
  try {
    const { data } = await callAppDb('resolve_orders_scope', {
      accessAccountId,
      configHint,
    });
    if (data?.scopeKey && Number(data.total) > 0) {
      return data;
    }
  } catch (err) {
    if (!/Nieznana akcja/i.test(err.message)) {
      throw err;
    }
  }

  const hints = [...new Set([configHint, 'demo', 'unknown'].filter(Boolean))];
  for (const hint of hints) {
    const scopeKey = `${accessAccountId}::${hint}`;
    try {
      const entry = await getOrdersFromServerDb(scopeKey, { offset: 0, limit: 1 });
      const total = Number(entry?.total) || entry?.orders?.length || 0;
      if (total > 0) {
        return {
          scopeKey,
          total,
          fetchedAt: entry?.fetchedAt || null,
          account: entry?.account || '',
          useDemoData: Boolean(entry?.useDemoData),
          accessAccountId,
        };
      }
    } catch (_e) {
      // próbujemy kolejny hint
    }
  }

  try {
    const list = await listOrdersScopesFromDb();
    const match =
      list.find((item) => item.accessAccountId === accessAccountId) ||
      list.find((item) => String(item.scopeKey || '').startsWith(`${accessAccountId}::`)) ||
      (list.length === 1 ? list[0] : null);

    if (match?.scopeKey && Number(match.total) > 0) {
      return match;
    }
  } catch (_e) {
    // brak listy po stronie API
  }

  return null;
}

export async function getOrdersFromServerDb(scopeKey, { offset, limit } = {}) {
  const payload = { scopeKey };
  if (offset !== undefined) {
    payload.offset = offset;
  }
  if (limit !== undefined) {
    payload.limit = limit;
  }
  const { data } = await callAppDb('get_orders', payload);
  return data;
}

export async function setOrdersToServerDb(scopeKey, payload) {
  await callAppDb('set_orders', { scopeKey, payload });
}

export async function clearOrdersFromServerDb(scopeKey) {
  await callAppDb('clear_orders', { scopeKey });
}

export async function listOrderIdsFromServerDb(scopeKey) {
  const { data } = await callAppDb('list_order_ids', { scopeKey });
  return Array.isArray(data?.ids) ? data.ids : [];
}

export async function getOrdersByIdsFromServerDb(scopeKey, keys) {
  const { data } = await callAppDb('get_orders_by_ids', { scopeKey, keys });
  return Array.isArray(data?.orders) ? data.orders : [];
}

export async function deleteOrdersFromServerDb(scopeKey, keys) {
  const { data } = await callAppDb('delete_orders', { scopeKey, keys });
  return Number(data?.deleted) || 0;
}

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
  'list_order_statuses',
  'get_max_order_id',
  'get_order_id_bounds',
  'get_orders_by_ids',
]);

function summarizePayloadForLog(action, payload = {}) {
  const summary = { action };

  if (payload.scopeKey) {
    summary.scopeKey = payload.scopeKey;
  }
  if (payload.accessAccountId) {
    summary.accessAccountId = payload.accessAccountId;
  }
  if (payload.keys && Array.isArray(payload.keys)) {
    summary.keysCount = payload.keys.length;
  }
  if (payload.payload && typeof payload.payload === 'object') {
    const inner = payload.payload;
    summary.ordersCount = Array.isArray(inner.orders) ? inner.orders.length : undefined;
    summary.hasMeta = inner.meta != null;
    summary.hasRaw = inner.raw != null;
  }

  return summary;
}

function buildDbErrorMessage(action, data = {}, fallback = '') {
  const parts = [];

  if (data.error) {
    parts.push(String(data.error));
  } else if (fallback) {
    parts.push(fallback);
  }

  if (data.phase && !String(data.error || '').includes(data.phase)) {
    parts.push(`Etap: ${data.phase}`);
  }
  if (data.errorCode) {
    parts.push(`Kod PG: ${data.errorCode}`);
  }
  if (data.hint && !String(data.error || '').includes(data.hint)) {
    parts.push(data.hint);
  }

  return parts.filter(Boolean).join(' · ') || fallback || `Błąd bazy: ${action}`;
}

async function callAppDb(action, payload = {}) {
  const startedAt = Date.now();
  const logSummary = summarizePayloadForLog(action, payload);

  try {
    const res = await fetch(`${getBaseUrl()}/api/app-db`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = buildDbErrorMessage(
        action,
        data,
        data?.error || `Błąd app-db (HTTP ${res.status})`
      );
      const err = new Error(message);
      err.dbDetails = {
        action,
        ok: false,
        httpStatus: res.status,
        errorCode: data?.errorCode || null,
        phase: data?.phase || null,
        hint: data?.hint || null,
        technical: data?.technical || data?.error || null,
        details: data?.details || null,
        durationMs: Date.now() - startedAt,
        ...logSummary,
      };
      throw err;
    }

    if (!SKIP_DB_LOG_ACTIONS.has(action)) {
      const { logEvent } = await import('../utils/eventLog');
      logEvent({
        level: 'system',
        category: 'db',
        action: `db.${action}`,
        message: `Zapis/odczyt bazy OK: ${action}`,
        details: { ...logSummary, ok: true, durationMs: Date.now() - startedAt },
      });
    }

    return data;
  } catch (err) {
    if (!err.dbDetails) {
      const isNetwork =
        err?.name === 'TypeError' &&
        /failed to fetch|networkerror|load failed/i.test(String(err.message || ''));

      if (isNetwork) {
        err.message =
          'Brak połączenia z API aplikacji (/api/app-db). Sprawdź internet, odśwież stronę lub uruchom lokalnie: npm run dev:vercel.';
        err.dbDetails = {
          action,
          ok: false,
          errorCode: 'NETWORK',
          phase: 'fetch',
          hint: 'Frontend nie dotarł do serwera API (Vercel dev / produkcja).',
          ...logSummary,
          durationMs: Date.now() - startedAt,
        };
      } else {
        err.dbDetails = {
          action,
          ok: false,
          ...logSummary,
          durationMs: Date.now() - startedAt,
          error: err.message,
        };
      }
    }

    if (!SKIP_DB_LOG_ACTIONS.has(action)) {
      const { logEvent } = await import('../utils/eventLog');
      const details = err.dbDetails || {
        ...logSummary,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: err.message,
      };

      logEvent({
        level: 'error',
        category: 'db',
        action: `db.${action}.error`,
        message: err.message || `Błąd bazy: ${action}`,
        details,
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

export async function getOrdersFromServerDb(scopeKey, { offset, limit, sort } = {}) {
  const requestPayload = { scopeKey };
  if (offset !== undefined) {
    requestPayload.offset = offset;
  }
  if (limit !== undefined) {
    requestPayload.limit = limit;
  }
  if (sort?.field) {
    requestPayload.sortBy = sort.field;
  }
  if (sort?.direction) {
    requestPayload.sortDir = sort.direction;
  }
  const { data } = await callAppDb('get_orders', requestPayload);
  return data;
}

export async function setOrdersToServerDb(scopeKey, payload) {
  await callAppDb('set_orders', { scopeKey, payload });
}

export async function appendOrdersToServerDb(scopeKey, orders, payload = {}) {
  const { data } = await callAppDb('append_orders', { scopeKey, orders, payload });
  return data;
}

export async function clearOrdersFromServerDb(scopeKey) {
  await callAppDb('clear_orders', { scopeKey });
}

export async function listOrderIdsFromServerDb(scopeKey) {
  const { data } = await callAppDb('list_order_ids', { scopeKey });
  return Array.isArray(data?.ids) ? data.ids : [];
}

export async function listOrderStatusesFromServerDb(scopeKey) {
  const { data } = await callAppDb('list_order_statuses', { scopeKey });
  return Array.isArray(data?.statuses) ? data.statuses : [];
}

export async function getMaxOrderIdFromServerDb(scopeKey) {
  const bounds = await getOrderIdBoundsFromServerDb(scopeKey);
  return bounds.maxOrderId;
}

export async function getOrderIdBoundsFromServerDb(scopeKey) {
  const { data } = await callAppDb('get_order_id_bounds', { scopeKey });
  const minOrderId = data?.minOrderId;
  const maxOrderId = data?.maxOrderId;
  const minNum = minOrderId == null ? null : Number(minOrderId);
  const maxNum = maxOrderId == null ? null : Number(maxOrderId);

  return {
    minOrderId: Number.isFinite(minNum) && minNum >= 1 ? minNum : null,
    maxOrderId: Number.isFinite(maxNum) && maxNum >= 1 ? maxNum : null,
  };
}

export async function getOrdersByIdsFromServerDb(scopeKey, keys) {
  const { data } = await callAppDb('get_orders_by_ids', { scopeKey, keys });
  return Array.isArray(data?.orders) ? data.orders : [];
}

export async function deleteOrdersFromServerDb(scopeKey, keys) {
  const { data } = await callAppDb('delete_orders', { scopeKey, keys });
  return Number(data?.deleted) || 0;
}

const { handleOptions, rejectMethod, jsonResponse } = require('../lib/api');
const { isDefaultAdminCredentials } = require('../lib/defaultAdmin');
const { formatDbError } = require('../lib/dbErrors');
const { readJson, writeJson, getScopedKey } = require('../lib/db');
const {
  resolveOrdersScope,
  listOrdersScopes,
  getOrders,
  setOrders,
  appendOrders,
  clearOrders,
  deleteOrdersByKeys,
  getOrderIds,
  getOrdersByIds,
  listOrderStatusLabels,
  getMaxOrderId,
  getMinOrderId,
  getOrderIdBounds,
} = require('../lib/ordersDb');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res);
  }

  if (req.method !== 'POST') {
    return rejectMethod(req, res);
  }

  try {
    const body = req.body || {};
    const action = String(body.action || '').trim();

    if (action === 'get_access') {
      const data = await readJson('access:store', { accounts: [], activeId: null, users: {} });
      return jsonResponse(res, 200, { ok: true, data });
    }

    if (action === 'set_access') {
      const payload = body.payload || {};
      const next = {
        accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
        activeId: payload.activeId || null,
        users: payload.users && typeof payload.users === 'object' ? payload.users : {},
      };
      await writeJson('access:store', next);
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'get_config') {
      const accessAccountId = String(body.accessAccountId || '').trim();
      if (!accessAccountId) {
        return jsonResponse(res, 400, { error: 'Brak accessAccountId' });
      }
      const data = await readJson(getScopedKey('config', accessAccountId), null);
      return jsonResponse(res, 200, { ok: true, data });
    }

    if (action === 'set_config') {
      const accessAccountId = String(body.accessAccountId || '').trim();
      if (!accessAccountId) {
        return jsonResponse(res, 400, { error: 'Brak accessAccountId' });
      }
      await writeJson(getScopedKey('config', accessAccountId), body.payload || {});
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'resolve_orders_scope') {
      const accessAccountId = String(body.accessAccountId || '').trim();
      if (!accessAccountId) {
        return jsonResponse(res, 400, { error: 'Brak accessAccountId' });
      }

      const configHint = String(body.configHint || '').trim().toLowerCase();
      const data = await resolveOrdersScope(accessAccountId, configHint);
      return jsonResponse(res, 200, { ok: true, data });
    }

    if (action === 'list_orders_scopes') {
      const data = await listOrdersScopes();
      return jsonResponse(res, 200, { ok: true, data });
    }

    if (action === 'get_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }

      const options = {};
      if (body.offset !== undefined) {
        options.offset = body.offset;
      }
      if (body.limit !== undefined) {
        options.limit = body.limit;
      }
      if (body.sortBy) {
        options.sortBy = String(body.sortBy).trim();
      }
      if (body.sortDir) {
        options.sortDir = String(body.sortDir).trim();
      }

      const data = await getOrders(scopeKey, options);
      return jsonResponse(res, 200, { ok: true, data });
    }

    if (action === 'list_order_ids') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }

      const ids = await getOrderIds(scopeKey);
      return jsonResponse(res, 200, {
        ok: true,
        data: { ids, total: ids.length },
      });
    }

    if (action === 'list_order_statuses') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }

      const statuses = await listOrderStatusLabels(scopeKey);
      return jsonResponse(res, 200, {
        ok: true,
        data: { statuses, total: statuses.length },
      });
    }

    if (action === 'get_max_order_id') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }

      const maxOrderId = await getMaxOrderId(scopeKey);
      return jsonResponse(res, 200, {
        ok: true,
        data: { maxOrderId },
      });
    }

    if (action === 'get_order_id_bounds') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }

      const bounds = await getOrderIdBounds(scopeKey);
      return jsonResponse(res, 200, {
        ok: true,
        data: bounds,
      });
    }

    if (action === 'get_orders_by_ids') {
      const scopeKey = String(body.scopeKey || '').trim();
      const keys = Array.isArray(body.keys) ? body.keys : [];
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      if (!keys.length) {
        return jsonResponse(res, 200, { ok: true, data: { orders: [], total: 0 } });
      }

      const orders = await getOrdersByIds(scopeKey, keys);
      return jsonResponse(res, 200, {
        ok: true,
        data: { orders, total: orders.length },
      });
    }

    if (action === 'set_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      try {
        await setOrders(scopeKey, body.payload || {});
      } catch (err) {
        const formatted = formatDbError(err, 'orders_insert');
        return jsonResponse(res, 500, { ok: false, ...formatted });
      }
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'append_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      const orders = Array.isArray(body.orders) ? body.orders : [];
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      try {
        const data = await appendOrders(scopeKey, orders, body.payload || {});
        return jsonResponse(res, 200, { ok: true, data });
      } catch (err) {
        const formatted = formatDbError(err, 'orders_insert');
        return jsonResponse(res, 500, { ok: false, ...formatted });
      }
    }

    if (action === 'clear_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      await clearOrders(scopeKey);
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'delete_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      const keys = Array.isArray(body.keys) ? body.keys : [];
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      const deleted = await deleteOrdersByKeys(scopeKey, keys);
      return jsonResponse(res, 200, { ok: true, data: { deleted } });
    }

    if (action === 'get_event_logs') {
      const data = await readJson('event_log:global', { entries: [] });
      const entries = Array.isArray(data.entries) ? data.entries : [];
      return jsonResponse(res, 200, { ok: true, data: { entries } });
    }

    if (action === 'append_event_log') {
      const entry = body.entry;
      if (!entry || typeof entry !== 'object' || !entry.id) {
        return jsonResponse(res, 400, { error: 'Brak wpisu logu' });
      }
      const store = await readJson('event_log:global', { entries: [] });
      const prev = Array.isArray(store.entries) ? store.entries : [];
      const entries = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 500);
      await writeJson('event_log:global', { entries });
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'clear_event_logs') {
      const adminUsername = String(body.adminUsername || '').trim();
      const adminPassword = String(body.adminPassword || '');
      if (!isDefaultAdminCredentials(adminUsername, adminPassword)) {
        return jsonResponse(res, 403, {
          error: 'Brak uprawnień. Podaj login i hasło administratora.',
        });
      }
      await writeJson('event_log:global', { entries: [] });
      return jsonResponse(res, 200, { ok: true });
    }

    return jsonResponse(res, 400, { error: 'Nieznana akcja' });
  } catch (err) {
    const formatted = formatDbError(err);
    return jsonResponse(res, 500, { ok: false, ...formatted });
  }
};

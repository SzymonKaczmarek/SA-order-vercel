const { handleOptions, rejectMethod, jsonResponse } = require('../lib/api');
const { isDefaultAdminCredentials } = require('../lib/defaultAdmin');
const {
  readJson,
  writeJson,
  deleteJson,
  getScopedKey,
  findOrderStoreEntries,
  findOrderStoreEntriesByPayloadAccount,
  findAllOrderStoreEntries,
  pickBestOrderEntry,
  entryToScopeData,
} = require('../lib/db');

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
      if (configHint) {
        const preferredScopeKey = `${accessAccountId}::${configHint}`;
        const preferredEntry = await readJson(getScopedKey('orders', preferredScopeKey), null);
        if (preferredEntry) {
          const orders = Array.isArray(preferredEntry.orders) ? preferredEntry.orders : [];
          return jsonResponse(res, 200, {
            ok: true,
            data: {
              scopeKey: preferredScopeKey,
              total: orders.length,
              fetchedAt: preferredEntry.fetchedAt || null,
              account: preferredEntry.account || '',
              useDemoData: Boolean(preferredEntry.useDemoData),
            },
          });
        }
      }

      let entries = await findOrderStoreEntries(accessAccountId);
      let best = pickBestOrderEntry(entries, accessAccountId);

      if (!best) {
        entries = await findOrderStoreEntriesByPayloadAccount(accessAccountId);
        best = pickBestOrderEntry(entries, accessAccountId);
      }

      if (!best) {
        entries = await findAllOrderStoreEntries();
        best = pickBestOrderEntry(entries, accessAccountId);
      }

      if (!best) {
        return jsonResponse(res, 200, { ok: true, data: null });
      }

      return jsonResponse(res, 200, {
        ok: true,
        data: entryToScopeData(best),
      });
    }

    if (action === 'list_orders_scopes') {
      const entries = await findAllOrderStoreEntries();
      const data = entries
        .map((entry) => entryToScopeData(entry))
        .filter((item) => item.total > 0);

      return jsonResponse(res, 200, { ok: true, data });
    }

    if (action === 'get_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      const entry = await readJson(getScopedKey('orders', scopeKey), null);
      if (!entry) {
        return jsonResponse(res, 200, { ok: true, data: null });
      }

      const allOrders = Array.isArray(entry.orders) ? entry.orders : [];
      const total = allOrders.length;
      const hasPaging = body.offset !== undefined || body.limit !== undefined;

      if (hasPaging) {
        const offset = Math.max(0, Number(body.offset) || 0);
        const limit = Math.max(1, Math.min(Number(body.limit) || 25, 100));
        const orders = allOrders.slice(offset, offset + limit);
        return jsonResponse(res, 200, {
          ok: true,
          data: {
            ...entry,
            orders,
            total,
            offset,
            limit,
            paginated: total > limit || offset > 0,
          },
        });
      }

      return jsonResponse(res, 200, {
        ok: true,
        data: {
          ...entry,
          total,
        },
      });
    }

    if (action === 'set_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      await writeJson(getScopedKey('orders', scopeKey), body.payload || {});
      return jsonResponse(res, 200, { ok: true });
    }

    if (action === 'clear_orders') {
      const scopeKey = String(body.scopeKey || '').trim();
      if (!scopeKey) {
        return jsonResponse(res, 400, { error: 'Brak scopeKey' });
      }
      await deleteJson(getScopedKey('orders', scopeKey));
      return jsonResponse(res, 200, { ok: true });
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
    return jsonResponse(res, 500, { error: err.message || 'Błąd bazy danych' });
  }
};

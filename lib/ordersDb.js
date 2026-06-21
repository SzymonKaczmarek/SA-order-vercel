const { resolveStore, readJson, getScopedKey } = require('./db');
const {
  sanitizeForPostgresJson,
  encodeJsonForPostgres,
  normalizeScopeRaw,
} = require('./sanitizeJson');
const { enrichDbError } = require('./dbErrors');
const { normalizeSortQuery, sortOrdersList } = require('./sortOrders');

const BATCH_SIZE = 500;
const memoryScopes = new Map();
const memoryOrders = new Map();

function parseScopeKey(scopeKey) {
  const normalized = String(scopeKey || '').trim();
  const parts = normalized.split('::');
  return {
    accessAccountId: parts[0] || '',
    sellasistScope: parts.slice(1).join('::') || 'unknown',
  };
}

function getOrderSellasistId(order) {
  const id = order?.id ?? order?.order_id;
  if (id == null || id === '') {
    return null;
  }
  return String(id);
}

function extractStatusLabel(order) {
  if (order?.status && typeof order.status === 'object') {
    const name = String(order.status.name || '').trim();
    if (name) return name;
    return String(order.status.id || '');
  }
  return String(order?.status_name || order?.status_label || order?.status_id || order?.status || '');
}

function hydrateOrderPayload(payload, statusLabel = '') {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const label = String(statusLabel || extractStatusLabel(payload)).trim();
  if (!label) {
    return payload;
  }

  const hasNamedStatus =
    (payload.status && typeof payload.status === 'object' && payload.status.name) ||
    payload.status_name ||
    payload.status_label;

  if (hasNamedStatus) {
    return payload;
  }

  return {
    ...payload,
    status_label: label,
    status_name: label,
    status: typeof payload.status === 'object' ? { ...payload.status, name: label } : { name: label },
  };
}

function scopeRowToMeta(row) {
  if (!row) {
    return null;
  }
  return {
    scopeKey: row.scope_key,
    accessAccountId: row.access_account_id,
    sellasistScope: row.sellasist_scope,
    account: row.account || '',
    useDemoData: Boolean(row.use_demo_data),
    fetchedAt: row.fetched_at || row.updated_at || null,
    meta: row.meta ?? null,
    raw: row.raw ?? null,
    total: Number(row.total) || 0,
  };
}

function getMemoryScopeOrders(scopeKey) {
  if (!memoryOrders.has(scopeKey)) {
    memoryOrders.set(scopeKey, new Map());
  }
  return memoryOrders.get(scopeKey);
}

async function ensureOrdersSchema() {
  const store = await resolveStore();
  if (store.useFallback) {
    return false;
  }

  const sql = store.sql;

  await sql`
    CREATE TABLE IF NOT EXISTS orders_scopes (
      scope_key TEXT PRIMARY KEY,
      access_account_id TEXT NOT NULL,
      sellasist_scope TEXT NOT NULL DEFAULT '',
      account TEXT NOT NULL DEFAULT '',
      use_demo_data BOOLEAN NOT NULL DEFAULT FALSE,
      fetched_at TIMESTAMPTZ,
      meta JSONB,
      raw JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_scopes_access_account_idx
      ON orders_scopes (access_account_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_scopes_updated_at_idx
      ON orders_scopes (updated_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL REFERENCES orders_scopes (scope_key) ON DELETE CASCADE,
      sellasist_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      status_label TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope_key, sellasist_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_scope_key_idx ON orders (scope_key)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS orders_scope_id_idx ON orders (scope_key, id)
  `;

  return true;
}

async function upsertScopeMetadata(scopeKey, payload = {}) {
  const { accessAccountId, sellasistScope } = parseScopeKey(scopeKey);
  const ordersCount = Array.isArray(payload.orders) ? payload.orders.length : 0;
  const meta = {
    scope_key: scopeKey,
    access_account_id: payload.accessAccountId || accessAccountId,
    sellasist_scope: sellasistScope,
    account: payload.account || '',
    use_demo_data: Boolean(payload.useDemoData),
    fetched_at: payload.fetchedAt || new Date().toISOString(),
    meta: payload.meta != null ? sanitizeForPostgresJson(payload.meta) : null,
    raw: normalizeScopeRaw(payload.raw, ordersCount),
  };

  const store = await resolveStore();
  if (store.useFallback) {
    memoryScopes.set(scopeKey, meta);
    return meta;
  }

  await store.sql`
    INSERT INTO orders_scopes (
      scope_key,
      access_account_id,
      sellasist_scope,
      account,
      use_demo_data,
      fetched_at,
      meta,
      raw,
      updated_at
    )
    VALUES (
      ${meta.scope_key},
      ${meta.access_account_id},
      ${meta.sellasist_scope},
      ${meta.account},
      ${meta.use_demo_data},
      ${meta.fetched_at},
      ${meta.meta},
      ${meta.raw},
      NOW()
    )
    ON CONFLICT (scope_key)
    DO UPDATE SET
      access_account_id = EXCLUDED.access_account_id,
      sellasist_scope = EXCLUDED.sellasist_scope,
      account = EXCLUDED.account,
      use_demo_data = EXCLUDED.use_demo_data,
      fetched_at = EXCLUDED.fetched_at,
      meta = EXCLUDED.meta,
      raw = EXCLUDED.raw,
      updated_at = NOW()
  `;

  return meta;
}

async function insertOrdersBatch(scopeKey, orders, batchOffset = 0) {
  if (!orders.length) {
    return 0;
  }

  const store = await resolveStore();
  if (store.useFallback) {
    const bucket = getMemoryScopeOrders(scopeKey);
    orders.forEach((order) => {
      const sellasistId = getOrderSellasistId(order);
      if (sellasistId) {
        bucket.set(sellasistId, sanitizeForPostgresJson(order));
      }
    });
    return orders.length;
  }

  let inserted = 0;
  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const chunk = orders.slice(i, i + BATCH_SIZE);
    const batchIndex = batchOffset + Math.floor(i / BATCH_SIZE);
    const ids = [];
    const jsonTexts = [];
    const statuses = [];

    for (const order of chunk) {
      const sellasistId = getOrderSellasistId(order);
      if (!sellasistId) {
        continue;
      }

      try {
        ids.push(sellasistId);
        jsonTexts.push(encodeJsonForPostgres(order, `order ${sellasistId}`));
        statuses.push(extractStatusLabel(order));
      } catch (err) {
        throw enrichDbError(err, 'order_encode', { scopeKey, sellasistId, batchIndex });
      }
    }

    if (!ids.length) {
      continue;
    }

    try {
      await store.sql`
        INSERT INTO orders (scope_key, sellasist_id, payload, status_label)
        SELECT
          ${scopeKey},
          batch.sellasist_id,
          batch.payload_text::jsonb,
          batch.status_label
        FROM unnest(
          ${ids}::text[],
          ${jsonTexts}::text[],
          ${statuses}::text[]
        ) AS batch(sellasist_id, payload_text, status_label)
        ON CONFLICT (scope_key, sellasist_id)
        DO UPDATE SET
          payload = EXCLUDED.payload,
          status_label = EXCLUDED.status_label,
          updated_at = NOW()
      `;
    } catch (err) {
      throw enrichDbError(err, 'orders_insert', {
        scopeKey,
        batchIndex,
        batchSize: ids.length,
      });
    }

    inserted += ids.length;
  }

  return inserted;
}

async function appendOrders(scopeKey, orders, metaPayload = {}) {
  const normalizedScope = String(scopeKey || '').trim();
  const list = Array.isArray(orders) ? orders : [];
  if (!normalizedScope) {
    return { added: 0, total: 0 };
  }

  if (!list.length) {
    const meta = await getScopeMeta(normalizedScope);
    return { added: 0, total: Number(meta?.total) || 0 };
  }

  const existing = await getScopeMeta(normalizedScope);
  if (!existing) {
    await upsertScopeMetadata(normalizedScope, metaPayload);
  }

  const added = await insertOrdersBatch(normalizedScope, list);
  const meta = await getScopeMeta(normalizedScope);
  return { added, total: Number(meta?.total) || 0 };
}

async function getScopeMeta(scopeKey) {
  const store = await resolveStore();
  if (store.useFallback) {
    const scope = memoryScopes.get(scopeKey);
    if (!scope) {
      return null;
    }
    const bucket = getMemoryScopeOrders(scopeKey);
    return scopeRowToMeta({ ...scope, total: bucket.size });
  }

  const rows = await store.sql`
    SELECT
      s.scope_key,
      s.access_account_id,
      s.sellasist_scope,
      s.account,
      s.use_demo_data,
      s.fetched_at,
      s.meta,
      s.raw,
      s.updated_at,
      COUNT(o.id)::int AS total
    FROM orders_scopes s
    LEFT JOIN orders o ON o.scope_key = s.scope_key
    WHERE s.scope_key = ${scopeKey}
    GROUP BY s.scope_key
    LIMIT 1
  `;

  return scopeRowToMeta(rows?.[0] || null);
}

async function resolveOrdersScope(accessAccountId, configHint = '') {
  const normalizedId = String(accessAccountId || '').trim();
  if (!normalizedId) {
    return null;
  }

  const hint = String(configHint || '').trim().toLowerCase();
  if (hint) {
    const preferredScopeKey = `${normalizedId}::${hint}`;
    const preferred = await getScopeMeta(preferredScopeKey);
    if (preferred?.total > 0) {
      return {
        scopeKey: preferred.scopeKey,
        total: preferred.total,
        fetchedAt: preferred.fetchedAt,
        account: preferred.account,
        useDemoData: preferred.useDemoData,
        accessAccountId: preferred.accessAccountId,
      };
    }
  }

  const store = await resolveStore();
  if (store.useFallback) {
    const matches = [];
    memoryScopes.forEach((scope, scopeKey) => {
      if (scope.access_account_id === normalizedId) {
        const total = getMemoryScopeOrders(scopeKey).size;
        if (total > 0) {
          matches.push(scopeRowToMeta({ ...scope, total }));
        }
      }
    });
    const best = matches[0];
    if (!best) {
      return null;
    }
    return {
      scopeKey: best.scopeKey,
      total: best.total,
      fetchedAt: best.fetchedAt,
      account: best.account,
      useDemoData: best.useDemoData,
      accessAccountId: best.accessAccountId,
    };
  }

  const rows = await store.sql`
    SELECT
      s.scope_key,
      s.access_account_id,
      s.sellasist_scope,
      s.account,
      s.use_demo_data,
      s.fetched_at,
      s.meta,
      s.raw,
      s.updated_at,
      COUNT(o.id)::int AS total
    FROM orders_scopes s
    LEFT JOIN orders o ON o.scope_key = s.scope_key
    WHERE s.access_account_id = ${normalizedId}
    GROUP BY s.scope_key
    HAVING COUNT(o.id) > 0
    ORDER BY s.updated_at DESC
    LIMIT 1
  `;

  const best = scopeRowToMeta(rows?.[0] || null);
  if (!best) {
    const legacy = await resolveOrdersScopeFromLegacyKv(normalizedId, hint);
    return legacy;
  }

  return {
    scopeKey: best.scopeKey,
    total: best.total,
    fetchedAt: best.fetchedAt,
    account: best.account,
    useDemoData: best.useDemoData,
    accessAccountId: best.accessAccountId,
  };
}

async function resolveOrdersScopeFromLegacyKv(accessAccountId, configHint) {
  const hint = String(configHint || '').trim().toLowerCase();
  if (hint) {
    const preferredScopeKey = `${accessAccountId}::${hint}`;
    const preferredEntry = await readJson(getScopedKey('orders', preferredScopeKey), null);
    if (preferredEntry) {
      const orders = Array.isArray(preferredEntry.orders) ? preferredEntry.orders : [];
      if (orders.length > 0) {
        await migrateLegacyScope(preferredScopeKey, preferredEntry);
        return {
          scopeKey: preferredScopeKey,
          total: orders.length,
          fetchedAt: preferredEntry.fetchedAt || null,
          account: preferredEntry.account || '',
          useDemoData: Boolean(preferredEntry.useDemoData),
          accessAccountId: preferredEntry.accessAccountId || accessAccountId,
        };
      }
    }
  }

  const store = await resolveStore();
  if (store.useFallback) {
    return null;
  }

  const rows = await store.sql`
    SELECT scope_key, payload, updated_at
    FROM app_kv_store
    WHERE scope_key LIKE ${`orders:${accessAccountId}::%`}
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const row = rows?.[0];
  if (!row?.payload) {
    return null;
  }

  const scopeKey = String(row.scope_key).replace(/^orders:/, '');
  const orders = Array.isArray(row.payload.orders) ? row.payload.orders : [];
  if (!orders.length) {
    return null;
  }

  await migrateLegacyScope(scopeKey, row.payload);
  return {
    scopeKey,
    total: orders.length,
    fetchedAt: row.payload.fetchedAt || row.updated_at || null,
    account: row.payload.account || '',
    useDemoData: Boolean(row.payload.useDemoData),
    accessAccountId: row.payload.accessAccountId || accessAccountId,
  };
}

async function migrateLegacyScope(scopeKey, payload) {
  await upsertScopeMetadata(scopeKey, payload);
  const store = await resolveStore();
  if (store.useFallback) {
    getMemoryScopeOrders(scopeKey).clear();
  } else {
    await store.sql`DELETE FROM orders WHERE scope_key = ${scopeKey}`;
  }
  await insertOrdersBatch(scopeKey, Array.isArray(payload.orders) ? payload.orders : []);
}

async function listOrdersScopes() {
  const store = await resolveStore();
  if (store.useFallback) {
    const results = [];
    memoryScopes.forEach((scope, scopeKey) => {
      const total = getMemoryScopeOrders(scopeKey).size;
      if (total > 0) {
        results.push({
          scopeKey,
          total,
          fetchedAt: scope.fetched_at || null,
          account: scope.account || '',
          useDemoData: Boolean(scope.use_demo_data),
          accessAccountId: scope.access_account_id || '',
        });
      }
    });
    return results;
  }

  const rows = await store.sql`
    SELECT
      s.scope_key,
      s.access_account_id,
      s.account,
      s.use_demo_data,
      s.fetched_at,
      COUNT(o.id)::int AS total
    FROM orders_scopes s
    INNER JOIN orders o ON o.scope_key = s.scope_key
    GROUP BY s.scope_key
    HAVING COUNT(o.id) > 0
    ORDER BY s.updated_at DESC
  `;

  return (rows || []).map((row) => ({
    scopeKey: row.scope_key,
    total: Number(row.total) || 0,
    fetchedAt: row.fetched_at || null,
    account: row.account || '',
    useDemoData: Boolean(row.use_demo_data),
    accessAccountId: row.access_account_id || '',
  }));
}

async function selectOrdersPage(store, scopeKey, off, lim, sortBy, sortDir) {
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';

  if (sortBy === 'status') {
    if (dir === 'ASC') {
      return store.sql`
        SELECT payload, status_label
        FROM orders
        WHERE scope_key = ${scopeKey}
        ORDER BY status_label ASC, id ASC
        LIMIT ${lim} OFFSET ${off}
      `;
    }
    return store.sql`
      SELECT payload, status_label
      FROM orders
      WHERE scope_key = ${scopeKey}
      ORDER BY status_label DESC, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (sortBy === 'surname') {
    if (dir === 'ASC') {
      return store.sql`
        SELECT payload, status_label
        FROM orders
        WHERE scope_key = ${scopeKey}
        ORDER BY LOWER(COALESCE(payload->'bill_address'->>'surname', payload->'bill_address'->>'name', '')) ASC,
          id ASC
        LIMIT ${lim} OFFSET ${off}
      `;
    }
    return store.sql`
      SELECT payload, status_label
      FROM orders
      WHERE scope_key = ${scopeKey}
      ORDER BY LOWER(COALESCE(payload->'bill_address'->>'surname', payload->'bill_address'->>'name', '')) DESC,
        id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (sortBy === 'amount') {
    if (dir === 'ASC') {
      return store.sql`
        SELECT payload, status_label
        FROM orders
        WHERE scope_key = ${scopeKey}
        ORDER BY (NULLIF(payload->>'total', '')::numeric) ASC NULLS LAST, id ASC
        LIMIT ${lim} OFFSET ${off}
      `;
    }
    return store.sql`
      SELECT payload, status_label
      FROM orders
      WHERE scope_key = ${scopeKey}
      ORDER BY (NULLIF(payload->>'total', '')::numeric) DESC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (dir === 'ASC') {
    return store.sql`
      SELECT payload, status_label
      FROM orders
      WHERE scope_key = ${scopeKey}
      ORDER BY COALESCE(
        NULLIF(payload->>'date', '')::timestamptz,
        NULLIF(payload->>'created_at', '')::timestamptz,
        NULLIF(payload->>'date_add', '')::timestamptz
      ) ASC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  return store.sql`
    SELECT payload, status_label
    FROM orders
    WHERE scope_key = ${scopeKey}
    ORDER BY COALESCE(
      NULLIF(payload->>'date', '')::timestamptz,
      NULLIF(payload->>'created_at', '')::timestamptz,
      NULLIF(payload->>'date_add', '')::timestamptz
    ) DESC NULLS LAST, id ASC
    LIMIT ${lim} OFFSET ${off}
  `;
}

async function getOrders(scopeKey, { offset, limit, sortBy, sortDir } = {}) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return null;
  }

  let scope = await getScopeMeta(normalizedScope);
  if (!scope?.total) {
    const legacyEntry = await readJson(getScopedKey('orders', normalizedScope), null);
    if (legacyEntry && Array.isArray(legacyEntry.orders) && legacyEntry.orders.length > 0) {
      await migrateLegacyScope(normalizedScope, legacyEntry);
      scope = await getScopeMeta(normalizedScope);
    }
  }

  if (!scope) {
    return null;
  }

  const store = await resolveStore();
  const base = {
    fetchedAt: scope.fetchedAt,
    account: scope.account,
    useDemoData: scope.useDemoData,
    accessAccountId: scope.accessAccountId,
    meta: scope.meta,
    raw: scope.raw,
    total: scope.total,
  };

  const hasPaging = offset !== undefined || limit !== undefined;
  const sort = normalizeSortQuery({ sortBy, sortDir });

  if (store.useFallback) {
    const bucket = getMemoryScopeOrders(normalizedScope);
    const allOrders = sortOrdersList(Array.from(bucket.values()), {
      field: sort.sortBy,
      direction: sort.sortDir,
    });
    if (!hasPaging) {
      return { ...base, orders: allOrders, sort };
    }
    const off = Math.max(0, Number(offset) || 0);
    const lim = Math.max(1, Math.min(Number(limit) || 25, 100));
    return {
      ...base,
      orders: allOrders.slice(off, off + lim),
      offset: off,
      limit: lim,
      paginated: scope.total > lim || off > 0,
      sort,
    };
  }

  if (hasPaging) {
    const off = Math.max(0, Number(offset) || 0);
    const lim = Math.max(1, Math.min(Number(limit) || 25, 100));
    const rows = await selectOrdersPage(store, normalizedScope, off, lim, sort.sortBy, sort.sortDir);
    return {
      ...base,
      orders: (rows || []).map((row) => hydrateOrderPayload(row.payload, row.status_label)),
      offset: off,
      limit: lim,
      paginated: scope.total > lim || off > 0,
      sort,
    };
  }

  const rows = await selectOrdersPage(
    store,
    normalizedScope,
    0,
    Math.max(scope.total, 1),
    sort.sortBy,
    sort.sortDir
  );

  return {
    ...base,
    orders: (rows || []).map((row) => hydrateOrderPayload(row.payload, row.status_label)),
    sort,
  };
}

async function setOrders(scopeKey, payload = {}) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return;
  }

  const orders = Array.isArray(payload.orders) ? payload.orders : [];

  try {
    await upsertScopeMetadata(normalizedScope, payload);
  } catch (err) {
    throw enrichDbError(err, 'orders_scopes', {
      scopeKey: normalizedScope,
      ordersCount: orders.length,
    });
  }

  const store = await resolveStore();
  if (store.useFallback) {
    getMemoryScopeOrders(normalizedScope).clear();
  } else {
    try {
      await store.sql`DELETE FROM orders WHERE scope_key = ${normalizedScope}`;
    } catch (err) {
      throw enrichDbError(err, 'orders_delete', {
        scopeKey: normalizedScope,
        ordersCount: orders.length,
      });
    }
  }

  try {
    await insertOrdersBatch(normalizedScope, orders);
  } catch (err) {
    throw enrichDbError(err, err.phase || 'orders_insert', {
      scopeKey: normalizedScope,
      ordersCount: orders.length,
      ...(err.details || {}),
    });
  }
}

async function clearOrders(scopeKey) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return;
  }

  const store = await resolveStore();
  if (store.useFallback) {
    memoryScopes.delete(normalizedScope);
    memoryOrders.delete(normalizedScope);
    return;
  }

  await store.sql`DELETE FROM orders_scopes WHERE scope_key = ${normalizedScope}`;
}

async function deleteOrdersByKeys(scopeKey, keys) {
  const normalizedScope = String(scopeKey || '').trim();
  const keyList = (Array.isArray(keys) ? keys : []).map((key) => String(key || '').trim()).filter(Boolean);
  if (!normalizedScope || !keyList.length) {
    return 0;
  }

  const store = await resolveStore();
  if (store.useFallback) {
    const bucket = getMemoryScopeOrders(normalizedScope);
    keyList.forEach((key) => bucket.delete(key));
    return keyList.length;
  }

  const rows = await store.sql`
    DELETE FROM orders
    WHERE scope_key = ${normalizedScope}
      AND sellasist_id = ANY(${keyList}::text[])
    RETURNING sellasist_id
  `;

  return rows?.length || 0;
}

async function getOrdersByIds(scopeKey, keys) {
  const normalizedScope = String(scopeKey || '').trim();
  const keyList = (Array.isArray(keys) ? keys : []).map((key) => String(key || '').trim()).filter(Boolean);
  if (!normalizedScope || !keyList.length) {
    return [];
  }

  const store = await resolveStore();
  if (store.useFallback) {
    const bucket = getMemoryScopeOrders(normalizedScope);
    return keyList.map((key) => bucket.get(key)).filter(Boolean);
  }

  const rows = await store.sql`
    SELECT payload, status_label
    FROM orders
    WHERE scope_key = ${normalizedScope}
      AND sellasist_id = ANY(${keyList}::text[])
    ORDER BY id ASC
  `;

  return (rows || []).map((row) => hydrateOrderPayload(row.payload, row.status_label));
}

async function getOrderIds(scopeKey) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return [];
  }

  const store = await resolveStore();
  if (store.useFallback) {
    return Array.from(getMemoryScopeOrders(normalizedScope).keys());
  }

  const rows = await store.sql`
    SELECT sellasist_id
    FROM orders
    WHERE scope_key = ${normalizedScope}
    ORDER BY id ASC
  `;

  return (rows || []).map((row) => row.sellasist_id);
}

async function migrateAllLegacyOrderScopes() {
  const store = await resolveStore();
  if (store.useFallback) {
    return { migrated: 0, orders: 0 };
  }

  const rows = await store.sql`
    SELECT scope_key, payload, updated_at
    FROM app_kv_store
    WHERE scope_key LIKE 'orders:%'
    ORDER BY updated_at DESC
  `;

  let migrated = 0;
  let ordersCount = 0;

  for (const row of rows || []) {
    const scopeKey = String(row.scope_key).replace(/^orders:/, '');
    const payload = row.payload || {};
    const orders = Array.isArray(payload.orders) ? payload.orders : [];
    if (!orders.length) {
      continue;
    }

    const existing = await getScopeMeta(scopeKey);
    if (existing?.total > 0) {
      continue;
    }

    await migrateLegacyScope(scopeKey, payload);
    migrated += 1;
    ordersCount += orders.length;
  }

  return { migrated, orders: ordersCount };
}

module.exports = {
  BATCH_SIZE,
  parseScopeKey,
  getOrderSellasistId,
  ensureOrdersSchema,
  resolveOrdersScope,
  listOrdersScopes,
  getOrders,
  setOrders,
  appendOrders,
  clearOrders,
  deleteOrdersByKeys,
  getOrdersByIds,
  getOrderIds,
  migrateLegacyScope,
  migrateAllLegacyOrderScopes,
};

const { resolveStore } = require('./db');
const {
  sanitizeForPostgresJson,
  encodeJsonForPostgres,
  normalizeScopeRaw,
} = require('./sanitizeJson');
const { enrichDbError } = require('./dbErrors');
const { normalizeSortQuery, sortClientsList, clientName } = require('./sortClients');

const BATCH_SIZE = 500;
const memoryScopes = new Map();
const memoryClients = new Map();

function parseScopeKey(scopeKey) {
  const normalized = String(scopeKey || '').trim();
  const parts = normalized.split('::');
  return {
    accessAccountId: parts[0] || '',
    sellasistScope: parts.slice(1).join('::') || 'unknown',
  };
}

function getClientSellasistId(client) {
  const id = client?.id ?? client?.user_id;
  if (id == null || id === '') {
    return null;
  }
  return String(id);
}

function extractSearchLabel(client) {
  return [clientName(client), client?.email, client?.phone, client?.company_name, client?.company_nip]
    .filter(Boolean)
    .join(' ')
    .trim()
    .slice(0, 500);
}

function stampClientImportTime(client, importedAt = new Date().toISOString()) {
  if (!client || typeof client !== 'object') {
    return client;
  }

  if (client.saor_imported_at) {
    return client;
  }

  return {
    ...client,
    saor_imported_at: importedAt,
  };
}

function rowToClient(row) {
  const payload = row?.payload;
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (!payload.saor_imported_at && row.updated_at) {
    return { ...payload, saor_imported_at: row.updated_at };
  }

  return payload;
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

function getMemoryScopeClients(scopeKey) {
  if (!memoryClients.has(scopeKey)) {
    memoryClients.set(scopeKey, new Map());
  }
  return memoryClients.get(scopeKey);
}

async function ensureClientsSchema() {
  const store = await resolveStore();
  if (store.useFallback) {
    return false;
  }

  const sql = store.sql;

  await sql`
    CREATE TABLE IF NOT EXISTS clients_scopes (
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
    CREATE INDEX IF NOT EXISTS clients_scopes_access_account_idx
      ON clients_scopes (access_account_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS clients (
      id BIGSERIAL PRIMARY KEY,
      scope_key TEXT NOT NULL REFERENCES clients_scopes (scope_key) ON DELETE CASCADE,
      sellasist_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      search_label TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (scope_key, sellasist_id)
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS clients_scope_key_idx ON clients (scope_key)
  `;

  return true;
}

async function upsertScopeMetadata(scopeKey, payload = {}) {
  const { accessAccountId, sellasistScope } = parseScopeKey(scopeKey);
  const clientsCount = Array.isArray(payload.clients) ? payload.clients.length : 0;
  const meta = {
    scope_key: scopeKey,
    access_account_id: payload.accessAccountId || accessAccountId,
    sellasist_scope: sellasistScope,
    account: payload.account || '',
    use_demo_data: Boolean(payload.useDemoData),
    fetched_at: payload.fetchedAt || new Date().toISOString(),
    meta: payload.meta != null ? sanitizeForPostgresJson(payload.meta) : null,
    raw: normalizeScopeRaw(payload.raw, clientsCount),
  };

  const store = await resolveStore();
  if (store.useFallback) {
    memoryScopes.set(scopeKey, meta);
    return meta;
  }

  await store.sql`
    INSERT INTO clients_scopes (
      scope_key,
      access_account_id,
      sellasist_scope,
      account,
      use_demo_data,
      fetched_at,
      meta,
      raw,
      updated_at
    ) VALUES (
      ${scopeKey},
      ${meta.access_account_id},
      ${meta.sellasist_scope},
      ${meta.account},
      ${meta.use_demo_data},
      ${meta.fetched_at},
      ${meta.meta},
      ${meta.raw},
      NOW()
    )
    ON CONFLICT (scope_key) DO UPDATE SET
      account = EXCLUDED.account,
      use_demo_data = EXCLUDED.use_demo_data,
      fetched_at = EXCLUDED.fetched_at,
      meta = EXCLUDED.meta,
      raw = EXCLUDED.raw,
      updated_at = NOW()
  `;

  return meta;
}

async function insertClientsBatch(scopeKey, clients, batchOffset = 0) {
  if (!clients.length) {
    return 0;
  }

  const store = await resolveStore();
  if (store.useFallback) {
    const bucket = getMemoryScopeClients(scopeKey);
    clients.forEach((client) => {
      const sellasistId = getClientSellasistId(client);
      if (sellasistId) {
        bucket.set(sellasistId, sanitizeForPostgresJson(stampClientImportTime(client)));
      }
    });
    return clients.length;
  }

  let inserted = 0;
  for (let i = 0; i < clients.length; i += BATCH_SIZE) {
    const chunk = clients.slice(i, i + BATCH_SIZE);
    const batchIndex = batchOffset + Math.floor(i / BATCH_SIZE);
    const ids = [];
    const jsonTexts = [];
    const labels = [];

    for (const client of chunk) {
      const sellasistId = getClientSellasistId(client);
      if (!sellasistId) {
        continue;
      }

      try {
        const stampedClient = stampClientImportTime(client);
        ids.push(sellasistId);
        jsonTexts.push(encodeJsonForPostgres(stampedClient, `client ${sellasistId}`));
        labels.push(extractSearchLabel(stampedClient));
      } catch (err) {
        throw enrichDbError(err, 'client_encode', { scopeKey, sellasistId, batchIndex });
      }
    }

    if (!ids.length) {
      continue;
    }

    try {
      await store.sql`
        INSERT INTO clients (scope_key, sellasist_id, payload, search_label)
        SELECT
          ${scopeKey},
          batch.sellasist_id,
          batch.payload_text::jsonb,
          batch.search_label
        FROM unnest(
          ${ids}::text[],
          ${jsonTexts}::text[],
          ${labels}::text[]
        ) AS batch(sellasist_id, payload_text, search_label)
        ON CONFLICT (scope_key, sellasist_id)
        DO UPDATE SET
          payload = EXCLUDED.payload || jsonb_build_object(
            'saor_imported_at',
            COALESCE(clients.payload->>'saor_imported_at', EXCLUDED.payload->>'saor_imported_at')
          ),
          search_label = EXCLUDED.search_label,
          updated_at = NOW()
      `;
    } catch (err) {
      throw enrichDbError(err, 'clients_insert', {
        scopeKey,
        batchIndex,
        batchSize: ids.length,
      });
    }

    inserted += ids.length;
  }

  return inserted;
}

async function appendClients(scopeKey, clients, metaPayload = {}) {
  const normalizedScope = String(scopeKey || '').trim();
  const list = Array.isArray(clients) ? clients : [];
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

  const added = await insertClientsBatch(normalizedScope, list);
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
    const bucket = getMemoryScopeClients(scopeKey);
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
      COUNT(c.id)::int AS total
    FROM clients_scopes s
    LEFT JOIN clients c ON c.scope_key = s.scope_key
    WHERE s.scope_key = ${scopeKey}
    GROUP BY s.scope_key
    LIMIT 1
  `;

  return scopeRowToMeta(rows?.[0] || null);
}

async function resolveClientsScope(accessAccountId, configHint = '') {
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
        const total = getMemoryScopeClients(scopeKey).size;
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
      COUNT(c.id)::int AS total
    FROM clients_scopes s
    LEFT JOIN clients c ON c.scope_key = s.scope_key
    WHERE s.access_account_id = ${normalizedId}
    GROUP BY s.scope_key
    HAVING COUNT(c.id) > 0
    ORDER BY s.updated_at DESC
    LIMIT 1
  `;

  const best = scopeRowToMeta(rows?.[0] || null);
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

async function listClientsScopes() {
  const store = await resolveStore();
  if (store.useFallback) {
    const list = [];
    memoryScopes.forEach((scope, scopeKey) => {
      const total = getMemoryScopeClients(scopeKey).size;
      list.push(scopeRowToMeta({ ...scope, scope_key: scopeKey, total }));
    });
    return list;
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
      COUNT(c.id)::int AS total
    FROM clients_scopes s
    LEFT JOIN clients c ON c.scope_key = s.scope_key
    GROUP BY s.scope_key
    ORDER BY s.updated_at DESC
  `;

  return (rows || []).map((row) => scopeRowToMeta(row)).filter(Boolean);
}

async function selectClientsPage(store, scopeKey, off, lim, sortBy, sortDir) {
  if (sortBy === 'email' && sortDir === 'asc') {
    return store.sql`
      SELECT payload, search_label, updated_at
      FROM clients
      WHERE scope_key = ${scopeKey}
      ORDER BY LOWER(payload->>'email') ASC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (sortBy === 'email') {
    return store.sql`
      SELECT payload, search_label, updated_at
      FROM clients
      WHERE scope_key = ${scopeKey}
      ORDER BY LOWER(payload->>'email') DESC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (sortBy === 'surname' && sortDir === 'asc') {
    return store.sql`
      SELECT payload, search_label, updated_at
      FROM clients
      WHERE scope_key = ${scopeKey}
      ORDER BY LOWER(payload->>'surname') ASC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (sortBy === 'surname') {
    return store.sql`
      SELECT payload, search_label, updated_at
      FROM clients
      WHERE scope_key = ${scopeKey}
      ORDER BY LOWER(payload->>'surname') DESC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  if (sortDir === 'asc') {
    return store.sql`
      SELECT payload, search_label, updated_at
      FROM clients
      WHERE scope_key = ${scopeKey}
      ORDER BY NULLIF(sellasist_id, '')::bigint ASC NULLS LAST, id ASC
      LIMIT ${lim} OFFSET ${off}
    `;
  }

  return store.sql`
    SELECT payload, search_label, updated_at
    FROM clients
    WHERE scope_key = ${scopeKey}
    ORDER BY NULLIF(sellasist_id, '')::bigint DESC NULLS LAST, id ASC
    LIMIT ${lim} OFFSET ${off}
  `;
}

async function getClients(scopeKey, { offset, limit, sortBy, sortDir } = {}) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return null;
  }

  let scope = await getScopeMeta(normalizedScope);
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
    const bucket = getMemoryScopeClients(normalizedScope);
    const allClients = sortClientsList(Array.from(bucket.values()), {
      field: sort.sortBy,
      direction: sort.sortDir,
    });
    if (!hasPaging) {
      return { ...base, clients: allClients, sort };
    }
    const off = Math.max(0, Number(offset) || 0);
    const lim = Math.max(1, Math.min(Number(limit) || 25, 100));
    return {
      ...base,
      clients: allClients.slice(off, off + lim),
      offset: off,
      limit: lim,
      paginated: scope.total > lim || off > 0,
      sort,
    };
  }

  if (hasPaging) {
    const off = Math.max(0, Number(offset) || 0);
    const lim = Math.max(1, Math.min(Number(limit) || 25, 100));
    const rows = await selectClientsPage(store, normalizedScope, off, lim, sort.sortBy, sort.sortDir);
    return {
      ...base,
      clients: (rows || []).map((row) => rowToClient(row)),
      offset: off,
      limit: lim,
      paginated: scope.total > lim || off > 0,
      sort,
    };
  }

  const rows = await selectClientsPage(
    store,
    normalizedScope,
    0,
    Math.max(scope.total, 1),
    sort.sortBy,
    sort.sortDir
  );

  return {
    ...base,
    clients: (rows || []).map((row) => rowToClient(row)),
    sort,
  };
}

async function setClients(scopeKey, payload = {}) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return;
  }

  const clients = Array.isArray(payload.clients) ? payload.clients : [];

  try {
    await upsertScopeMetadata(normalizedScope, payload);

    const store = await resolveStore();
    if (store.useFallback) {
      const bucket = getMemoryScopeClients(normalizedScope);
      bucket.clear();
      await insertClientsBatch(normalizedScope, clients);
      return;
    }

    await store.sql`DELETE FROM clients WHERE scope_key = ${normalizedScope}`;
    await insertClientsBatch(normalizedScope, clients);
  } catch (err) {
    throw enrichDbError(err, 'set_clients', { scopeKey: normalizedScope, count: clients.length });
  }
}

async function clearClients(scopeKey) {
  const normalizedScope = String(scopeKey || '').trim();
  if (!normalizedScope) {
    return;
  }

  const store = await resolveStore();
  if (store.useFallback) {
    getMemoryScopeClients(normalizedScope).clear();
    memoryScopes.delete(normalizedScope);
    return;
  }

  await store.sql`DELETE FROM clients WHERE scope_key = ${normalizedScope}`;
  await store.sql`DELETE FROM clients_scopes WHERE scope_key = ${normalizedScope}`;
}

async function deleteClientsByKeys(scopeKey, keys) {
  const normalizedScope = String(scopeKey || '').trim();
  const keyList = (Array.isArray(keys) ? keys : []).map((key) => String(key || '').trim()).filter(Boolean);
  if (!normalizedScope || !keyList.length) {
    return 0;
  }

  const store = await resolveStore();
  if (store.useFallback) {
    const bucket = getMemoryScopeClients(normalizedScope);
    keyList.forEach((key) => bucket.delete(key));
    return keyList.length;
  }

  let deleted = 0;
  for (let i = 0; i < keyList.length; i += BATCH_SIZE) {
    const chunk = keyList.slice(i, i + BATCH_SIZE);
    const rows = await store.sql`
      DELETE FROM clients
      WHERE scope_key = ${normalizedScope}
        AND sellasist_id = ANY(${chunk}::text[])
      RETURNING sellasist_id
    `;
    deleted += (rows || []).length;
  }

  return deleted;
}

module.exports = {
  ensureClientsSchema,
  resolveClientsScope,
  listClientsScopes,
  getClients,
  setClients,
  appendClients,
  clearClients,
  deleteClientsByKeys,
  getScopeMeta,
};

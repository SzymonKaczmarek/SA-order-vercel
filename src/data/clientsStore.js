import { buildOrdersScopeKey } from './ordersLocalDb';
import { getClientKey } from '../utils/clientSelection';
import { stampClientForStorage } from '../utils/clientFormat';
import { filterClients, hasActiveClientFilters } from '../utils/filterClients';
import { DEFAULT_CLIENT_SORT, normalizeClientSort, sortClientsList } from '../utils/sortClients';

const DB_NAME = 'saor_clients_store';
const DB_VERSION = 1;

let dbPromise = null;

function idbRequest(request) {
  if (!request) {
    return Promise.reject(new Error('IndexedDB: żądanie niedostępne.'));
  }

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function waitTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function walkCursor(index, range, visit) {
  return new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error || new Error('IndexedDB cursor failed'));

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        resolve();
        return;
      }

      try {
        visit(cursor);
      } catch (err) {
        reject(err);
        return;
      }

      cursor.continue();
    };
  });
}

function buildRecordId(scopeKey, clientKey) {
  return `${scopeKey}::${clientKey}`;
}

function getSortKey(client) {
  const key = getClientKey(client);
  const numeric = Number(key);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return key;
}

async function openDb() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB niedostępne w tej przeglądarce.');
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('scopes')) {
          db.createObjectStore('scopes', { keyPath: 'scopeKey' });
        }
        if (!db.objectStoreNames.contains('clients')) {
          const store = db.createObjectStore('clients', { keyPath: 'id' });
          store.createIndex('by_scope', 'scopeKey', { unique: false });
          store.createIndex('by_scope_sort', ['scopeKey', 'sortKey'], { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Nie udało się otworzyć IndexedDB'));
    });
  }

  return dbPromise;
}

export function resolveScopeKey(accessAccountId, config) {
  return buildOrdersScopeKey(accessAccountId, config);
}

export async function getScopeMeta(scopeKey) {
  const db = await openDb();
  const tx = db.transaction('scopes', 'readonly');
  const meta = await idbRequest(tx.objectStore('scopes').get(scopeKey));
  await waitTx(tx);
  return meta || null;
}

export async function getCount(scopeKey) {
  const meta = await getScopeMeta(scopeKey);
  return Number(meta?.count) || 0;
}

export async function putBatch(scopeKey, clients, options = {}) {
  const batch = Array.isArray(clients) ? clients : [];
  if (!scopeKey) {
    return 0;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['clients', 'scopes'], 'readwrite');
    const clientStore = tx.objectStore('clients');
    const scopeStore = tx.objectStore('scopes');
    let resultCount = 0;

    const finishPut = () => {
      const getMetaReq = scopeStore.get(scopeKey);

      getMetaReq.onerror = () => reject(getMetaReq.error);
      getMetaReq.onsuccess = () => {
        let existingMeta = getMetaReq.result;
        if (options.replace || !existingMeta) {
          existingMeta = {
            scopeKey,
            count: 0,
            fetchedAt: options.fetchedAt || new Date().toISOString(),
            account: options.account || '',
            useDemoData: Boolean(options.useDemoData),
            accessAccountId: options.accessAccountId || '',
            meta: options.meta ?? null,
            raw: options.raw ?? null,
          };
        }

        if (options.meta !== undefined) {
          existingMeta.meta = options.meta;
        }
        if (options.raw !== undefined) {
          existingMeta.raw = options.raw;
        }
        if (options.fetchedAt) {
          existingMeta.fetchedAt = options.fetchedAt;
        }

        for (const client of batch) {
          const clientKey = getClientKey(client);
          if (!clientKey) {
            continue;
          }

          clientStore.put({
            id: buildRecordId(scopeKey, clientKey),
            scopeKey,
            clientKey,
            sortKey: getSortKey(client),
            payload: stampClientForStorage(client, options.fetchedAt || new Date().toISOString()),
          });
        }

        const countReq = clientStore.index('by_scope').count(IDBKeyRange.only(scopeKey));
        countReq.onerror = () => reject(countReq.error);
        countReq.onsuccess = () => {
          existingMeta.count = countReq.result;
          const putMetaReq = scopeStore.put(existingMeta);
          putMetaReq.onerror = () => reject(putMetaReq.error);
          putMetaReq.onsuccess = () => {
            resultCount = batch.length;
            resolve(resultCount);
          };
        };
      };
    };

    if (options.replace) {
      const index = clientStore.index('by_scope');
      walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
        cursor.delete();
      })
        .then(finishPut)
        .catch(reject);
      return;
    }

    finishPut();
  });
}

async function collectFiltered(scopeKey, filters) {
  const db = await openDb();
  const tx = db.transaction('clients', 'readonly');
  const index = tx.objectStore('clients').index('by_scope');
  const matched = [];

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    const payload = cursor.value.payload;
    const filtered = filterClients([payload], filters);
    if (filtered.length > 0) {
      matched.push(payload);
    }
  });

  await waitTx(tx);
  return matched;
}

async function collectAll(scopeKey) {
  const db = await openDb();
  const tx = db.transaction('clients', 'readonly');
  const index = tx.objectStore('clients').index('by_scope');
  const all = [];

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    if (cursor.value?.payload) {
      all.push(cursor.value.payload);
    }
  });

  await waitTx(tx);
  return all;
}

export async function getFilteredPage(scopeKey, filters, offset = 0, limit = 25, sort = DEFAULT_CLIENT_SORT) {
  const normalizedSort = normalizeClientSort(sort);
  const matched = hasActiveClientFilters(filters)
    ? await collectFiltered(scopeKey, filters)
    : await collectAll(scopeKey);
  const sorted = sortClientsList(matched, normalizedSort);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.max(1, Number(limit) || 25);

  return {
    clients: sorted.slice(safeOffset, safeOffset + safeLimit),
    total: sorted.length,
    offset: safeOffset,
    limit: safeLimit,
    filtered: hasActiveClientFilters(filters),
    sort: normalizedSort,
  };
}

export async function deleteByKeys(scopeKey, keys) {
  const keyList = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!scopeKey || !keyList.length) {
    return 0;
  }

  const db = await openDb();
  const tx = db.transaction(['clients', 'scopes'], 'readwrite');
  const clientStore = tx.objectStore('clients');
  const scopeStore = tx.objectStore('scopes');

  keyList.forEach((clientKey) => {
    clientStore.delete(buildRecordId(scopeKey, clientKey));
  });

  const countReq = clientStore.index('by_scope').count(IDBKeyRange.only(scopeKey));
  await new Promise((resolve, reject) => {
    countReq.onerror = () => reject(countReq.error);
    countReq.onsuccess = async () => {
      const meta = await idbRequest(scopeStore.get(scopeKey));
      if (meta) {
        meta.count = countReq.result;
        await idbRequest(scopeStore.put(meta));
      }
      resolve();
    };
  });

  await waitTx(tx);
  return keyList.length;
}

export async function clearScope(scopeKey) {
  if (!scopeKey) {
    return;
  }

  const db = await openDb();
  const tx = db.transaction(['clients', 'scopes'], 'readwrite');
  const clientStore = tx.objectStore('clients');
  const scopeStore = tx.objectStore('scopes');
  const index = clientStore.index('by_scope');

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    cursor.delete();
  });

  scopeStore.delete(scopeKey);
  await waitTx(tx);
}

export async function iterateBatches(scopeKey, batchSize, onBatch) {
  const db = await openDb();
  const tx = db.transaction('clients', 'readonly');
  const index = tx.objectStore('clients').index('by_scope');
  let batch = [];

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    batch.push(cursor.value.payload);
    if (batch.length >= batchSize) {
      onBatch(batch);
      batch = [];
    }
  });

  if (batch.length > 0) {
    onBatch(batch);
  }

  await waitTx(tx);
}

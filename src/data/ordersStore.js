import { buildOrdersScopeKey, clearOrdersCache, readOrdersCache } from './ordersLocalDb';
import { getOrderKey } from '../utils/orderSelection';
import { filterOrders, hasActiveFilters } from '../utils/filterOrders';
import { DEFAULT_ORDER_SORT, normalizeOrderSort, sortOrdersList } from '../utils/sortOrders';

const DB_NAME = 'saor_orders_store';
const DB_VERSION = 1;
const MIGRATION_FLAG_PREFIX = 'saor_idb_migrated:';

let dbPromise = null;

function idbRequest(request) {
  if (!request) {
    return Promise.reject(
      new Error('IndexedDB: żądanie niedostępne — transakcja wygasła (nie używaj await w pętli kursora).')
    );
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

/** Iteracja kursora bez await między continue() — inaczej transakcja się zamyka. */
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

function buildRecordId(scopeKey, orderKey) {
  return `${scopeKey}::${orderKey}`;
}

function getSortKey(order) {
  const key = getOrderKey(order);
  const numeric = Number(key);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return key;
}

function isIndexedDbAvailable() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

async function openDb() {
  if (!isIndexedDbAvailable()) {
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
        if (!db.objectStoreNames.contains('orders')) {
          const store = db.createObjectStore('orders', { keyPath: 'id' });
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

export async function putBatch(scopeKey, orders, options = {}) {
  const batch = Array.isArray(orders) ? orders : [];
  if (!scopeKey) {
    return 0;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['orders', 'scopes'], 'readwrite');
    const orderStore = tx.objectStore('orders');
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

        for (const order of batch) {
          const orderKey = getOrderKey(order);
          if (!orderKey) {
            continue;
          }

          orderStore.put({
            id: buildRecordId(scopeKey, orderKey),
            scopeKey,
            orderKey,
            sortKey: getSortKey(order),
            payload: order,
          });
        }

        const countReq = orderStore.index('by_scope').count(IDBKeyRange.only(scopeKey));
        countReq.onerror = () => reject(countReq.error);
        countReq.onsuccess = () => {
          existingMeta.count = countReq.result;
          resultCount = countReq.result;
          scopeStore.put(existingMeta);
        };
      };
    };

    const startPut = () => {
      if (options.replace) {
        const index = orderStore.index('by_scope');
        const cursorReq = index.openCursor(IDBKeyRange.only(scopeKey));
        cursorReq.onerror = () => reject(cursorReq.error);
        cursorReq.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) {
            finishPut();
            return;
          }
          cursor.delete();
          cursor.continue();
        };
        return;
      }

      finishPut();
    };

    tx.oncomplete = () => resolve(resultCount);
    tx.onerror = () => reject(tx.error);

    startPut();
  });
}

export async function getPage(scopeKey, offset = 0, limit = 25) {
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.max(1, Number(limit) || 25);
  const db = await openDb();
  const tx = db.transaction('orders', 'readonly');
  const index = tx.objectStore('orders').index('by_scope_sort');
  const range = IDBKeyRange.bound([scopeKey, -Infinity], [scopeKey, Infinity]);
  const orders = [];
  let skipped = 0;

  await new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor || orders.length >= safeLimit) {
        resolve();
        return;
      }

      if (skipped >= safeOffset) {
        orders.push(cursor.value.payload);
      }
      skipped += 1;

      if (orders.length >= safeLimit) {
        resolve();
        return;
      }

      cursor.continue();
    };

    tx.onerror = () => reject(tx.error);
  });

  await waitTx(tx);
  const total = await getCount(scopeKey);

  return {
    orders,
    total,
    offset: safeOffset,
    limit: safeLimit,
  };
}

async function collectFiltered(scopeKey, filters) {
  const db = await openDb();
  const tx = db.transaction('orders', 'readonly');
  const index = tx.objectStore('orders').index('by_scope');
  const matched = [];

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    const payload = cursor.value.payload;
    const filtered = filterOrders([payload], filters);
    if (filtered.length > 0) {
      matched.push(payload);
    }
  });

  await waitTx(tx);
  return matched;
}

async function collectAll(scopeKey) {
  const db = await openDb();
  const tx = db.transaction('orders', 'readonly');
  const index = tx.objectStore('orders').index('by_scope');
  const all = [];

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    if (cursor.value?.payload) {
      all.push(cursor.value.payload);
    }
  });

  await waitTx(tx);
  return all;
}

export async function getFilteredPage(scopeKey, filters, offset = 0, limit = 25, sort = DEFAULT_ORDER_SORT) {
  const normalizedSort = normalizeOrderSort(sort);
  const matched = hasActiveFilters(filters)
    ? await collectFiltered(scopeKey, filters)
    : await collectAll(scopeKey);
  const sorted = sortOrdersList(matched, normalizedSort);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const safeLimit = Math.max(1, Number(limit) || 25);

  return {
    orders: sorted.slice(safeOffset, safeOffset + safeLimit),
    total: sorted.length,
    offset: safeOffset,
    limit: safeLimit,
    filtered: hasActiveFilters(filters),
    sort: normalizedSort,
  };
}

export async function listOrderIds(scopeKey) {
  const db = await openDb();
  const tx = db.transaction('orders', 'readonly');
  const index = tx.objectStore('orders').index('by_scope');
  const ids = [];

  await walkCursor(index, IDBKeyRange.only(scopeKey), (cursor) => {
    if (cursor.value.orderKey) {
      ids.push(cursor.value.orderKey);
    }
  });

  await waitTx(tx);
  return ids;
}

export async function getOrdersByIds(scopeKey, ids) {
  const keyList = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!keyList.length) {
    return [];
  }

  const db = await openDb();
  const orders = [];

  await new Promise((resolve, reject) => {
    const tx = db.transaction('orders', 'readonly');
    const store = tx.objectStore('orders');
    let pending = keyList.length;

    for (const orderKey of keyList) {
      const req = store.get(buildRecordId(scopeKey, orderKey));
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        if (req.result?.payload) {
          orders.push(req.result.payload);
        }
        pending -= 1;
        if (pending === 0) {
          resolve();
        }
      };
    }

    tx.onerror = () => reject(tx.error);
  });

  return orders;
}

export async function deleteByKeys(scopeKey, keys) {
  const keyList = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!keyList.length || !scopeKey) {
    return 0;
  }

  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['orders', 'scopes'], 'readwrite');
    const orderStore = tx.objectStore('orders');
    const scopeStore = tx.objectStore('scopes');

    for (const orderKey of keyList) {
      orderStore.delete(buildRecordId(scopeKey, orderKey));
    }

    const countReq = orderStore.index('by_scope').count(IDBKeyRange.only(scopeKey));
    countReq.onerror = () => reject(countReq.error);
    countReq.onsuccess = () => {
      const remaining = countReq.result;
      const getMetaReq = scopeStore.get(scopeKey);
      getMetaReq.onerror = () => reject(getMetaReq.error);
      getMetaReq.onsuccess = () => {
        const meta = getMetaReq.result || { scopeKey, count: 0 };
        meta.count = remaining;
        scopeStore.put(meta);
      };
      tx.oncomplete = () => resolve(remaining);
    };

    tx.onerror = () => reject(tx.error);
  });
}

export async function clearScope(scopeKey) {
  if (!scopeKey) {
    return;
  }

  const db = await openDb();

  await new Promise((resolve, reject) => {
    const tx = db.transaction(['orders', 'scopes'], 'readwrite');
    const orderStore = tx.objectStore('orders');
    const scopeStore = tx.objectStore('scopes');
    const index = orderStore.index('by_scope');
    const request = index.openCursor(IDBKeyRange.only(scopeKey));

    request.onerror = () => reject(request.error);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        scopeStore.delete(scopeKey);
        return;
      }
      cursor.delete();
      cursor.continue();
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function iterateBatches(scopeKey, batchSize, onBatch) {
  const safeBatchSize = Math.max(1, Number(batchSize) || 500);
  const db = await openDb();
  const tx = db.transaction('orders', 'readonly');
  const index = tx.objectStore('orders').index('by_scope_sort');
  const range = IDBKeyRange.bound([scopeKey, -Infinity], [scopeKey, Infinity]);
  const pendingBatches = [];
  let batch = [];

  await new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onerror = () => reject(request.error);

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (!cursor) {
        if (batch.length > 0) {
          pendingBatches.push(batch);
        }
        resolve();
        return;
      }

      batch.push(cursor.value.payload);
      if (batch.length >= safeBatchSize) {
        pendingBatches.push(batch);
        batch = [];
      }

      cursor.continue();
    };

    tx.onerror = () => reject(tx.error);
  });

  for (const chunk of pendingBatches) {
    await onBatch(chunk);
  }
}

export async function migrateFromLocalStorage(accessAccountId, config) {
  if (!isIndexedDbAvailable() || !accessAccountId || !config) {
    return { migrated: false, count: 0 };
  }

  const scopeKey = resolveScopeKey(accessAccountId, config);
  const flagKey = `${MIGRATION_FLAG_PREFIX}${scopeKey}`;

  if (typeof window !== 'undefined' && window.localStorage.getItem(flagKey)) {
    return { migrated: false, count: await getCount(scopeKey) };
  }

  const legacy = readOrdersCache(accessAccountId, config);
  if (!legacy?.orders?.length) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(flagKey, '1');
    }
    return { migrated: false, count: await getCount(scopeKey) };
  }

  await putBatch(scopeKey, legacy.orders, {
    replace: true,
    fetchedAt: legacy.fetchedAt,
    account: legacy.account,
    useDemoData: legacy.useDemoData,
    accessAccountId: legacy.accessAccountId,
    meta: legacy.meta ?? null,
    raw: legacy.raw ?? null,
  });

  clearOrdersCache(accessAccountId, config);
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(flagKey, '1');
  }

  return { migrated: true, count: legacy.orders.length };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatFetchedAt } from '../data/ordersLocalDb';
import {
  clearScope,
  deleteByKeys,
  getCount,
  getFilteredPage,
  getOrdersByIds,
  getScopeMeta,
  iterateBatches,
  listOrderIds,
  migrateFromLocalStorage,
  putBatch,
  resolveScopeKey,
} from '../data/ordersStore';

const EMPTY_SYNC_INFO = {
  fetchedAt: null,
  fetchedAtLabel: 'Brak zapisu w buforze',
  savedLocally: false,
  cachedCount: 0,
  accountLabel: '',
};

export function useOrdersLocalStore({
  activeAccountId,
  config,
  isConfigured,
  isDemoMode,
  activeSource,
  filters,
  ordersPage,
  ordersPageSize,
}) {
  const [localOrders, setLocalOrders] = useState([]);
  const [localOrdersTotal, setLocalOrdersTotal] = useState(0);
  const [localOrdersLoading, setLocalOrdersLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState(EMPTY_SYNC_INFO);
  const [localCacheHydrated, setLocalCacheHydrated] = useState(false);
  const lastLoadedRef = useRef({ page: 0, size: 0, scope: null, filterKey: '' });

  const getScopeKey = useCallback(() => {
    if (!activeAccountId || !config) {
      return null;
    }
    return resolveScopeKey(activeAccountId, config);
  }, [activeAccountId, config]);

  const refreshLocalMeta = useCallback(async () => {
    if (!activeAccountId || !isConfigured) {
      setSyncInfo(EMPTY_SYNC_INFO);
      setLocalOrdersTotal(0);
      return null;
    }

    const scopeKey = getScopeKey();
    if (!scopeKey) {
      return null;
    }

    const meta = await getScopeMeta(scopeKey);
    const count = Number(meta?.count) || 0;
    setLocalOrdersTotal(count);
    setSyncInfo({
      fetchedAt: meta?.fetchedAt || null,
      fetchedAtLabel: meta?.fetchedAt ? formatFetchedAt(meta.fetchedAt) : 'Brak zapisu w buforze',
      savedLocally: count > 0,
      cachedCount: count,
      accountLabel: isDemoMode
        ? 'tryb demo'
        : meta?.account
          ? `${meta.account}.sellasist.pl`
          : config?.account
            ? `${config.account}.sellasist.pl`
            : '',
    });

    return meta;
  }, [activeAccountId, config?.account, getScopeKey, isConfigured, isDemoMode]);

  const loadLocalOrdersPage = useCallback(
    async (page, size, scopeKeyOverride = null) => {
      const scopeKey = scopeKeyOverride || getScopeKey();
      if (!scopeKey || !activeAccountId) {
        setLocalOrders([]);
        setLocalOrdersTotal(0);
        return 0;
      }

      const safePage = Math.max(1, page);
      const offset = (safePage - 1) * size;
      setLocalOrdersLoading(true);

      try {
        const pageData = await getFilteredPage(scopeKey, filters, offset, size);
        setLocalOrders(pageData.orders);
        setLocalOrdersTotal(pageData.total);
        return pageData.total;
      } catch (_err) {
        setLocalOrders([]);
        return 0;
      } finally {
        setLocalOrdersLoading(false);
      }
    },
    [activeAccountId, filters, getScopeKey]
  );

  const hydrateLocalStore = useCallback(async () => {
    if (!activeAccountId || !isConfigured) {
      setLocalOrders([]);
      setLocalOrdersTotal(0);
      setSyncInfo(EMPTY_SYNC_INFO);
      setLocalCacheHydrated(true);
      return;
    }

    await migrateFromLocalStorage(activeAccountId, config);
    await refreshLocalMeta();
    setLocalCacheHydrated(true);
  }, [activeAccountId, config, isConfigured, refreshLocalMeta]);

  const appendLocalBatch = useCallback(
    async (orders, options = {}) => {
      const scopeKey = getScopeKey();
      if (!scopeKey) {
        return 0;
      }

      const count = await putBatch(scopeKey, orders, {
        append: !options.replace,
        replace: options.replace === true,
        fetchedAt: options.fetchedAt,
        account: config?.account || '',
        useDemoData: Boolean(config?.useDemoData),
        accessAccountId: activeAccountId,
        meta: options.meta,
        raw: options.raw,
      });
      await refreshLocalMeta();
      return count;
    },
    [activeAccountId, config, getScopeKey, refreshLocalMeta]
  );

  const deleteLocalKeys = useCallback(
    async (keys) => {
      const scopeKey = getScopeKey();
      if (!scopeKey) {
        return 0;
      }

      const remaining = await deleteByKeys(scopeKey, keys);
      await refreshLocalMeta();
      if (activeSource === 'local') {
        await loadLocalOrdersPage(ordersPage, ordersPageSize, scopeKey);
      }
      return remaining;
    },
    [activeSource, getScopeKey, loadLocalOrdersPage, ordersPage, ordersPageSize, refreshLocalMeta]
  );

  const clearLocal = useCallback(async () => {
    const scopeKey = getScopeKey();
    if (!scopeKey) {
      return;
    }

    await clearScope(scopeKey);
    setLocalOrders([]);
    setLocalOrdersTotal(0);
    setSyncInfo(EMPTY_SYNC_INFO);
    lastLoadedRef.current = { page: 0, size: 0, scope: null, filterKey: '' };
  }, [getScopeKey]);

  const listLocalOrderIds = useCallback(
    async (scopeKeyOverride = null) => {
      const scopeKey = scopeKeyOverride || getScopeKey();
      if (!scopeKey) {
        return [];
      }
      return listOrderIds(scopeKey);
    },
    [getScopeKey]
  );

  const getLocalOrdersByIds = useCallback(
    async (ids, scopeKeyOverride = null) => {
      const scopeKey = scopeKeyOverride || getScopeKey();
      if (!scopeKey) {
        return [];
      }
      return getOrdersByIds(scopeKey, ids);
    },
    [getScopeKey]
  );

  const resetLocalHydration = useCallback(() => {
    setLocalCacheHydrated(false);
    setLocalOrders([]);
    setLocalOrdersTotal(0);
    setSyncInfo(EMPTY_SYNC_INFO);
    lastLoadedRef.current = { page: 0, size: 0, scope: null, filterKey: '' };
  }, []);

  useEffect(() => {
    if (activeSource !== 'local' || !localCacheHydrated) {
      return;
    }

    const scopeKey = getScopeKey();
    if (!scopeKey) {
      return;
    }

    const filterKey = JSON.stringify(filters);
    const last = lastLoadedRef.current;
    if (
      last.page === ordersPage &&
      last.size === ordersPageSize &&
      last.scope === scopeKey &&
      last.filterKey === filterKey
    ) {
      return;
    }

    lastLoadedRef.current = {
      page: ordersPage,
      size: ordersPageSize,
      scope: scopeKey,
      filterKey,
    };
    loadLocalOrdersPage(ordersPage, ordersPageSize, scopeKey);
  }, [
    activeSource,
    filters,
    getScopeKey,
    loadLocalOrdersPage,
    localCacheHydrated,
    ordersPage,
    ordersPageSize,
  ]);

  return {
    localOrders,
    localOrdersTotal,
    localOrdersLoading,
    syncInfo,
    localCacheHydrated,
    hydrateLocalStore,
    refreshLocalMeta,
    loadLocalOrdersPage,
    appendLocalBatch,
    deleteLocalKeys,
    clearLocal,
    listLocalOrderIds,
    getLocalOrdersByIds,
    iterateLocalBatches: iterateBatches,
    getLocalScopeKey: getScopeKey,
    getLocalCount: getCount,
    resetLocalHydration,
  };
}

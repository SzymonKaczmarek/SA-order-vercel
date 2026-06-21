import { useCallback, useEffect, useRef, useState } from 'react';
import { formatFetchedAt } from '../data/ordersLocalDb';
import { DEFAULT_CLIENT_SORT, normalizeClientSort } from '../utils/sortClients';
import {
  clearScope,
  deleteByKeys,
  getCount,
  getFilteredPage,
  getScopeMeta,
  putBatch,
  resolveScopeKey,
} from '../data/clientsStore';

const EMPTY_SYNC_INFO = {
  fetchedAt: null,
  fetchedAtLabel: 'Brak zapisu w buforze',
  savedLocally: false,
  cachedCount: 0,
  accountLabel: '',
};

export function useClientsLocalStore({
  activeAccountId,
  config,
  isConfigured,
  isDemoMode,
  filters,
  clientSort,
  clientsPage,
  clientsPageSize,
}) {
  const [localClients, setLocalClients] = useState([]);
  const [localClientsTotal, setLocalClientsTotal] = useState(0);
  const [localClientsLoading, setLocalClientsLoading] = useState(false);
  const [syncInfo, setSyncInfo] = useState(EMPTY_SYNC_INFO);
  const [localCacheHydrated, setLocalCacheHydrated] = useState(false);

  const getScopeKey = useCallback(() => {
    if (!activeAccountId || !config) {
      return null;
    }
    return resolveScopeKey(activeAccountId, config);
  }, [activeAccountId, config]);

  const refreshLocalMeta = useCallback(async () => {
    if (!activeAccountId || !isConfigured) {
      setSyncInfo(EMPTY_SYNC_INFO);
      setLocalClientsTotal(0);
      return null;
    }

    const scopeKey = getScopeKey();
    if (!scopeKey) {
      return null;
    }

    const meta = await getScopeMeta(scopeKey);
    const count = Number(meta?.count) || 0;
    setLocalClientsTotal(count);
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

  const loadLocalClientsPage = useCallback(
    async (page, size, scopeKeyOverride = null) => {
      const scopeKey = scopeKeyOverride || getScopeKey();
      if (!scopeKey || !activeAccountId) {
        setLocalClients([]);
        setLocalClientsTotal(0);
        return 0;
      }

      const safePage = Math.max(1, page);
      const offset = (safePage - 1) * size;
      setLocalClientsLoading(true);

      try {
        const pageData = await getFilteredPage(
          scopeKey,
          filters,
          offset,
          size,
          normalizeClientSort(clientSort)
        );
        setLocalClients(pageData.clients);
        setLocalClientsTotal(pageData.total);
        return pageData.total;
      } catch (_err) {
        setLocalClients([]);
        return 0;
      } finally {
        setLocalClientsLoading(false);
      }
    },
    [activeAccountId, clientSort, filters, getScopeKey]
  );

  const hydrateLocalStore = useCallback(async () => {
    if (!activeAccountId || !isConfigured) {
      setLocalCacheHydrated(true);
      return;
    }

    await refreshLocalMeta();
    setLocalCacheHydrated(true);
  }, [activeAccountId, isConfigured, refreshLocalMeta]);

  const appendLocalBatch = useCallback(
    async (clients, options = {}) => {
      const scopeKey = getScopeKey();
      if (!scopeKey) {
        return 0;
      }

      await putBatch(scopeKey, clients, {
        ...options,
        account: config?.account || '',
        useDemoData: Boolean(config?.useDemoData),
        accessAccountId: activeAccountId,
      });
      await refreshLocalMeta();
      return clients.length;
    },
    [activeAccountId, config?.account, config?.useDemoData, getScopeKey, refreshLocalMeta]
  );

  const clearLocal = useCallback(async () => {
    const scopeKey = getScopeKey();
    if (!scopeKey) {
      return;
    }
    await clearScope(scopeKey);
    setLocalClients([]);
    setLocalClientsTotal(0);
    await refreshLocalMeta();
  }, [getScopeKey, refreshLocalMeta]);

  const deleteLocalKeys = useCallback(
    async (keys) => {
      const scopeKey = getScopeKey();
      if (!scopeKey) {
        return 0;
      }
      const deleted = await deleteByKeys(scopeKey, keys);
      await refreshLocalMeta();
      await loadLocalClientsPage(clientsPage, clientsPageSize);
      return deleted;
    },
    [clientsPage, clientsPageSize, getScopeKey, loadLocalClientsPage, refreshLocalMeta]
  );

  useEffect(() => {
    if (!localCacheHydrated || !isConfigured) {
      return;
    }
    loadLocalClientsPage(clientsPage, clientsPageSize);
  }, [
    clientsPage,
    clientsPageSize,
    clientSort,
    filters,
    isConfigured,
    loadLocalClientsPage,
    localCacheHydrated,
  ]);

  return {
    localClients,
    localClientsTotal,
    localClientsLoading,
    syncInfo,
    localCacheHydrated,
    getScopeKey,
    hydrateLocalStore,
    loadLocalClientsPage,
    appendLocalBatch,
    clearLocal,
    deleteLocalKeys,
    refreshLocalMeta,
  };
}

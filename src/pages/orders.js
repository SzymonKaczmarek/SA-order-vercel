import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiRawPanel } from '../components/ApiRawPanel';
import { BulkDownloadModal } from '../components/BulkDownloadModal';
import { ExportCsvModal } from '../components/ExportCsvModal';
import { BackToPanelLink, PageShell, RequireAuth, headerBtnPrimary } from '../components/Layout';
import { DemoModeHint } from '../components/DemoModeHint';
import { IconCog } from '../components/Icons';
import { OrderCard } from '../components/OrderCard';
import { OrdersManageModal } from '../components/OrdersManageModal';
import { OrdersActionsPanel } from '../components/OrdersActionsPanel';
import { OrdersFilters } from '../components/OrdersFilters';
import { OrdersSelectionBar, ORDERS_PAGE_SIZES } from '../components/OrdersSelectionBar';
import { OrdersPagination } from '../components/OrdersPagination';
import { OrdersSourceToggle } from '../components/OrdersSourceToggle';
import { SyncStatusPanel } from '../components/SyncStatusPanel';
import { ServerOrdersLoadOverlay } from '../components/ServerOrdersLoadOverlay';
import { OrdersPageInitOverlay } from '../components/OrdersPageInitOverlay';
import { SellasistConfigModal } from '../components/SellasistConfigModal';
import { useAccessAccount } from '../context/AccessAccountContext';
import {
  buildOrdersScopeKey,
  formatFetchedAt,
} from '../data/ordersLocalDb';
import { listOrderStatuses, getOrderIdBounds } from '../data/ordersStore';
import { getAccessAccountDisplayName } from '../data/accessAccounts';
import { fetchSellasistOrders, testSellasistConnection } from '../hooks/useSellasistApi';
import {
  appendOrdersToServerDb,
  clearOrdersFromServerDb,
  deleteOrdersFromServerDb,
  getOrdersByIdsFromServerDb,
  getOrdersFromServerDb,
  listOrderIdsFromServerDb,
  listOrderStatusesFromServerDb,
  getOrderIdBoundsFromServerDb,
  resolveOrdersScopeFromDb,
  setOrdersToServerDb,
} from '../hooks/useAppDbApi';
import { useOrdersLocalStore } from '../hooks/useOrdersLocalStore';
import {
  isDemoMode as isSellasistDemoMode,
  isSellasistConfigured,
  resolveSellasistConfigForAccount,
  useSellasistConfig,
} from '../hooks/useSellasistConfig';
import { downloadAllOrders } from '../utils/bulkOrderDownload';
import {
  clearBulkImportResume,
  readBulkImportResume,
  writeBulkImportResume,
  buildBulkImportResumePayload,
} from '../utils/bulkImportResume';
import { DEFAULT_ORDER_SORT, normalizeOrderSort } from '../utils/sortOrders';
import { downloadOrdersCsv, getOrdersExportFilename } from '../utils/exportOrdersCsv';
import { logEvent } from '../utils/eventLog';
import {
  EMPTY_FILTERS,
  filterOrders,
  mergeStatusFilterOptions,
  hasActiveFilters,
} from '../utils/filterOrders';
import {
  getOrderKey,
  pickOrdersByKeys,
} from '../utils/orderSelection';

const INITIAL_PROGRESS = {
  packageNum: 0,
  fetchedTotal: 0,
  lastBatchSize: 0,
  remainingPackages: '—',
  remainingOrders: '—',
  etaLabel: '—',
  progressPercent: 0,
  requestsThisMinute: 0,
};

const HIDDEN_SERVER_LOAD_PROGRESS = {
  visible: false,
  label: '',
  page: 1,
  totalPages: 1,
  itemFrom: 0,
  itemTo: 0,
  totalItems: 0,
  percent: 0,
};

function getConfigHint(config) {
  if (config?.useDemoData) return 'demo';
  return (config?.account || '').trim().toLowerCase();
}

function OrdersView() {
  const { activeAccount, activeAccountId, ready: accountReady } = useAccessAccount();
  const { config, isConfigured, isDemoMode, loaded: configLoaded } = useSellasistConfig();
  const [serverOrders, setServerOrders] = useState([]);
  const [serverOrdersTotal, setServerOrdersTotal] = useState(0);
  const [serverOrdersLoading, setServerOrdersLoading] = useState(false);
  const [serverSyncError, setServerSyncError] = useState('');
  const [serverMeta, setServerMeta] = useState({
    fetchedAt: null,
    fetchedAtLabel: 'Brak zapisu w bazie danych',
  });
  const [activeSource, setActiveSource] = useState('local');
  const [apiRaw, setApiRaw] = useState(null);
  const [apiMeta, setApiMeta] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [orderSort, setOrderSort] = useState(DEFAULT_ORDER_SORT);
  const [availableStatuses, setAvailableStatuses] = useState([]);
  const [bulkStoredBounds, setBulkStoredBounds] = useState({
    loading: false,
    localMin: null,
    localMax: null,
    serverMin: null,
    serverMax: null,
  });
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkModal, setBulkModal] = useState({
    open: false,
    phase: 'idle',
    progress: INITIAL_PROGRESS,
    error: '',
    result: null,
    downloadScope: null,
    importDestination: 'local',
  });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(25);
  const [serverLoadPhase, setServerLoadPhase] = useState(null);
  const [serverLoadProgress, setServerLoadProgress] = useState(HIDDEN_SERVER_LOAD_PROGRESS);
  const [sourceSyncSummary, setSourceSyncSummary] = useState(null);
  const [serverDbHintReady, setServerDbHintReady] = useState(false);

  const abortRef = useRef(null);
  const bulkAbortModeRef = useRef(null);
  const bulkSessionRef = useRef(null);
  const bulkProgressRef = useRef(INITIAL_PROGRESS);
  const [bulkResumeVersion, setBulkResumeVersion] = useState(0);
  const resolvedServerScopeKeyRef = useRef(null);
  const serverKnownTotalRef = useRef(0);
  const lastLoadedServerPageRef = useRef({ page: 0, size: 0, scope: null, sortKey: '' });
  const serverLoadAcceptedRef = useRef(false);
  const serverLoadPhaseRef = useRef(null);
  const previousActiveAccountIdRef = useRef(null);
  const serverDbHintRequestIdRef = useRef(0);
  const bulkDownloading = bulkModal.phase === 'downloading';

  serverLoadPhaseRef.current = serverLoadPhase;

  const localStore = useOrdersLocalStore({
    activeAccountId,
    config,
    isConfigured,
    isDemoMode,
    activeSource,
    filters,
    orderSort,
    ordersPage,
    ordersPageSize,
  });

  const {
    localOrders,
    localOrdersTotal,
    localOrdersLoading,
    syncInfo,
    localCacheHydrated,
    initialListReady,
    hydrateLocalStore,
    loadLocalOrdersPage,
    appendLocalBatch,
    deleteLocalKeys,
    clearLocal,
    listLocalOrderIds,
    getLocalOrdersByIds,
    iterateLocalBatches,
    getLocalScopeKey,
    resetLocalHydration,
    getLocalCount,
  } = localStore;

  const pageInitStep = useMemo(() => {
    if (!localCacheHydrated) return 'local';
    if (!serverDbHintReady) return 'server';
    if (activeSource === 'local' && localOrdersLoading && !initialListReady) return 'list';
    return null;
  }, [
    activeSource,
    initialListReady,
    localCacheHydrated,
    localOrdersLoading,
    serverDbHintReady,
  ]);

  const showPageInitOverlay = Boolean(
    isConfigured &&
      accountReady &&
      configLoaded &&
      activeAccountId &&
      pageInitStep &&
      !serverLoadPhase &&
      !bulkDownloading
  );

  const orders = activeSource === 'server' ? serverOrders : localOrders;

  const getServerScopeKey = useCallback(() => {
    if (resolvedServerScopeKeyRef.current) {
      return resolvedServerScopeKeyRef.current;
    }
    return buildOrdersScopeKey(activeAccountId, config);
  }, [activeAccountId, config]);

  const buildServerPayload = useCallback(
    (nextOrders) => ({
      fetchedAt: new Date().toISOString(),
      account: config.account || '',
      useDemoData: Boolean(config.useDemoData),
      accessAccountId: activeAccountId,
      orders: nextOrders,
      raw: apiRaw ?? nextOrders,
      meta: apiMeta ?? null,
      count: nextOrders.length,
    }),
    [activeAccountId, apiMeta, apiRaw, config]
  );

  const persistServerOrders = useCallback(
    async (nextOrders) => {
      if (!activeAccountId) return;
      const scopeKey = getServerScopeKey();

      if (nextOrders.length === 0) {
        await clearOrdersFromServerDb(scopeKey);
        setServerMeta({
          fetchedAt: null,
          fetchedAtLabel: 'Brak zapisu w bazie danych',
        });
        setServerSyncError('');
        return;
      }

      const payload = buildServerPayload(nextOrders);
      await setOrdersToServerDb(scopeKey, payload);
      setServerMeta({
        fetchedAt: payload.fetchedAt,
        fetchedAtLabel: formatFetchedAt(payload.fetchedAt),
      });
      setServerSyncError('');
    },
    [activeAccountId, buildServerPayload, getServerScopeKey]
  );

  const loadServerOrdersPage = useCallback(
    async (page, size, scopeKeyOverride = null, options = {}) => {
      const preserveOverlay = options.preserveOverlay === true;

      if (!activeAccountId) {
        setServerOrders([]);
        setServerOrdersTotal(0);
        return 0;
      }

      const scopeKey = scopeKeyOverride || resolvedServerScopeKeyRef.current;
      if (!scopeKey) {
        setServerSyncError('Brak powiązanego zapisu zamówień w bazie danych.');
        return 0;
      }

      const safePage = Math.max(1, page);
      const offset = (safePage - 1) * size;
      setServerOrdersLoading(true);
      setServerSyncError('');

      if (!preserveOverlay) {
        setServerLoadPhase('loading');
        setServerLoadProgress((current) => ({
          visible: true,
          label: 'Pobieranie produktów z bazy danych…',
          page: safePage,
          totalPages: Math.max(1, Math.ceil((serverKnownTotalRef.current || size) / size) || 1),
          itemFrom: offset + 1,
          itemTo: Math.min(offset + size, serverKnownTotalRef.current || offset + size),
          totalItems: serverKnownTotalRef.current || current.totalItems || 0,
          percent: 12,
        }));
      }

      try {
        const entry = await getOrdersFromServerDb(scopeKey, {
          offset,
          limit: size,
          sort: normalizeOrderSort(orderSort),
        });
        const pageOrders = Array.isArray(entry?.orders) ? entry.orders : [];
        const total = Number(entry?.total) || pageOrders.length;
        const totalPages = Math.max(1, Math.ceil(total / size) || 1);
        const itemFrom = total > 0 ? offset + 1 : 0;
        const itemTo = total > 0 ? Math.min(offset + pageOrders.length, total) : 0;

        resolvedServerScopeKeyRef.current = scopeKey;
        serverKnownTotalRef.current = total;
        setServerOrders(pageOrders);
        setServerOrdersTotal(total);
        setServerMeta({
          fetchedAt: entry?.fetchedAt || null,
          fetchedAtLabel: entry?.fetchedAt
            ? formatFetchedAt(entry.fetchedAt)
            : 'Brak zapisu w bazie danych',
        });

        if (entry?.raw) {
          setApiRaw(entry.raw);
        }
        if (entry?.meta) {
          setApiMeta(entry.meta);
        }

        if (!preserveOverlay) {
          setServerLoadProgress({
            visible: true,
            label:
              total > 0
                ? `Załadowano produkty ${itemFrom}–${itemTo} z ${total}`
                : 'Brak produktów w bazie danych',
            page: safePage,
            totalPages,
            itemFrom,
            itemTo,
            totalItems: total,
            percent: 100,
          });

          window.setTimeout(() => {
            setServerLoadPhase(null);
            setServerLoadProgress(HIDDEN_SERVER_LOAD_PROGRESS);
          }, 350);
        }

        return total;
      } catch (err) {
        setServerOrders([]);
        setServerOrdersTotal(0);
        setServerSyncError(err?.message || 'Nie udało się odczytać bazy danych.');
        if (!preserveOverlay) {
          setServerLoadPhase(null);
          setServerLoadProgress(HIDDEN_SERVER_LOAD_PROGRESS);
        }
        return 0;
      } finally {
        setServerOrdersLoading(false);
      }
    },
    [activeAccountId, orderSort]
  );

  const orderSortKey = useMemo(
    () => JSON.stringify(normalizeOrderSort(orderSort)),
    [orderSort]
  );

  const applyResolvedServerMeta = useCallback((resolved) => {
    if (!resolved?.scopeKey) {
      return false;
    }

    resolvedServerScopeKeyRef.current = resolved.scopeKey;
    serverKnownTotalRef.current = Number(resolved.total) || 0;
    setServerOrdersTotal(serverKnownTotalRef.current);
    setServerMeta({
      fetchedAt: resolved.fetchedAt || null,
      fetchedAtLabel: resolved.fetchedAt
        ? formatFetchedAt(resolved.fetchedAt)
        : 'Brak zapisu w bazie danych',
    });
    return true;
  }, []);

  const probeServerOrders = useCallback(async () => {
    if (!activeAccountId) {
      return null;
    }

    try {
      const resolved = await resolveOrdersScopeFromDb(activeAccountId, getConfigHint(config));
      if (!resolved?.scopeKey || !(Number(resolved.total) > 0)) {
        return null;
      }

      applyResolvedServerMeta(resolved);
      return resolved;
    } catch (err) {
      setServerSyncError(err?.message || 'Nie udało się sprawdzić bazy danych.');
      return null;
    }
  }, [activeAccountId, applyResolvedServerMeta, config]);

  const refreshServerDbHint = useCallback(async () => {
    if (!accountReady || !configLoaded || !activeAccountId) {
      return;
    }

    if (serverLoadPhaseRef.current === 'loading') {
      return;
    }

    const requestId = serverDbHintRequestIdRef.current + 1;
    serverDbHintRequestIdRef.current = requestId;
    setServerDbHintReady(false);

    try {
      const resolved = await probeServerOrders();
      if (requestId !== serverDbHintRequestIdRef.current) {
        return;
      }

      if (!resolved?.scopeKey || !(Number(resolved.total) > 0)) {
        setSourceSyncSummary(null);
        return;
      }

      const scopeKey = resolved.scopeKey;
      const serverCount = Number(resolved.total) || 0;
      let localCount = 0;
      let missingInLocal = 0;
      let missingInServer = 0;
      let matchedCount = 0;

      try {
        const serverIds = await listOrderIdsFromServerDb(scopeKey);
        if (requestId !== serverDbHintRequestIdRef.current) {
          return;
        }

        const localIds = await listLocalOrderIds(scopeKey);
        if (requestId !== serverDbHintRequestIdRef.current) {
          return;
        }

        localCount = localIds.length;
        const localKeys = new Set(localIds);
        const serverKeys = new Set(serverIds);
        missingInLocal = serverIds.filter((id) => !localKeys.has(id)).length;
        missingInServer = localIds.filter((id) => !serverKeys.has(id)).length;
        matchedCount = serverIds.filter((id) => localKeys.has(id)).length;
      } catch (_e) {
        localCount = localOrdersTotal;
        missingInLocal = 0;
        missingInServer = 0;
        matchedCount = 0;
      }

      if (requestId !== serverDbHintRequestIdRef.current) {
        return;
      }

      setSourceSyncSummary({
        serverCount,
        localCount,
        matchedCount,
        missingInLocal,
        missingInServer,
      });
    } catch (_err) {
      // zostaw poprzednie podsumowanie przy chwilowym błędzie API
    } finally {
      if (requestId === serverDbHintRequestIdRef.current) {
        setServerDbHintReady(true);
      }
    }
  }, [
    accountReady,
    activeAccountId,
    configLoaded,
    listLocalOrderIds,
    localOrdersTotal,
    probeServerOrders,
  ]);

  const showServerOrdersView = useCallback(
    async ({ preserveOverlay = false } = {}) => {
      let scopeKey = resolvedServerScopeKeyRef.current;
      if (!scopeKey) {
        const resolved = await probeServerOrders();
        scopeKey = resolved?.scopeKey || null;
      }

      if (!scopeKey) {
        return false;
      }

      const knownTotal = serverKnownTotalRef.current || serverOrdersTotal;
      if (!(knownTotal > 0)) {
        return false;
      }

      serverLoadAcceptedRef.current = true;
      setActiveSource('server');

      const last = lastLoadedServerPageRef.current;
      if (
        last.page === 1 &&
        last.size === ordersPageSize &&
        last.scope === scopeKey &&
        last.sortKey === orderSortKey &&
        serverOrders.length > 0
      ) {
        return true;
      }

      setOrdersPage(1);
      lastLoadedServerPageRef.current = {
        page: 0,
        size: ordersPageSize,
        scope: scopeKey,
        sortKey: orderSortKey,
      };
      await loadServerOrdersPage(1, ordersPageSize, scopeKey, { preserveOverlay });
      lastLoadedServerPageRef.current = {
        page: 1,
        size: ordersPageSize,
        scope: scopeKey,
        sortKey: orderSortKey,
      };
      return true;
    },
    [
      loadServerOrdersPage,
      orderSortKey,
      ordersPageSize,
      probeServerOrders,
      serverOrders.length,
      serverOrdersTotal,
    ]
  );

  const handleSourceChange = useCallback(
    (nextSource) => {
      setActiveSource(nextSource);
      if (nextSource !== 'server') {
        return;
      }

      void showServerOrdersView({ preserveOverlay: false });
    },
    [showServerOrdersView]
  );

  const removeServerOrderKeys = useCallback(
    async (keys, reloadPage = ordersPage) => {
      if (!activeAccountId) return;

      const scopeKey = getServerScopeKey();
      const keyList = Array.isArray(keys) ? keys : [...keys];
      if (!keyList.length) return;

      await deleteOrdersFromServerDb(scopeKey, keyList);
      setOrdersPage(reloadPage);
      await loadServerOrdersPage(reloadPage, ordersPageSize, scopeKey);
    },
    [activeAccountId, getServerScopeKey, loadServerOrdersPage, ordersPage, ordersPageSize]
  );

  useEffect(() => {
    if (!accountReady || !configLoaded || !activeAccountId) return;

    const accountChanged = previousActiveAccountIdRef.current !== activeAccountId;
    previousActiveAccountIdRef.current = activeAccountId;

    if (accountChanged) {
      serverLoadAcceptedRef.current = false;
      resolvedServerScopeKeyRef.current = null;
      serverKnownTotalRef.current = 0;
      lastLoadedServerPageRef.current = { page: 0, size: 0, scope: null, sortKey: '' };
      setServerLoadPhase(null);
      setServerOrdersTotal(0);
      setServerOrders([]);
      setServerSyncError('');
      setSourceSyncSummary(null);
      setServerDbHintReady(false);
      serverDbHintRequestIdRef.current += 1;
      resetLocalHydration();
      setSelectedIds([]);
      setFilters(EMPTY_FILTERS);
      setOrderSort(DEFAULT_ORDER_SORT);
      setError('');
      setOrdersPage(1);
    }

    void hydrateLocalStore();
  }, [accountReady, configLoaded, activeAccountId, hydrateLocalStore, resetLocalHydration]);

  useEffect(() => {
    if (!accountReady || !configLoaded || !activeAccountId || !localCacheHydrated) {
      return;
    }

    refreshServerDbHint();
  }, [
    accountReady,
    activeAccountId,
    activeSource,
    configLoaded,
    localCacheHydrated,
    localOrdersTotal,
    refreshServerDbHint,
  ]);

  useEffect(() => {
    if (!manageModalOpen) {
      return;
    }

    refreshServerDbHint();
  }, [manageModalOpen, refreshServerDbHint]);

  useEffect(() => {
    if (!serverLoadAcceptedRef.current || activeSource !== 'server') return;

    const scopeKey = resolvedServerScopeKeyRef.current;
    if (!scopeKey) return;
    if (serverLoadPhaseRef.current === 'loading') {
      return;
    }

    const last = lastLoadedServerPageRef.current;
    if (
      last.page === ordersPage &&
      last.size === ordersPageSize &&
      last.scope === scopeKey &&
      last.sortKey === orderSortKey
    ) {
      return;
    }

    lastLoadedServerPageRef.current = {
      page: ordersPage,
      size: ordersPageSize,
      scope: scopeKey,
      sortKey: orderSortKey,
    };
    loadServerOrdersPage(ordersPage, ordersPageSize, scopeKey);
  }, [activeSource, loadServerOrdersPage, orderSortKey, ordersPage, ordersPageSize]);

  const resolveServerScopeKey = useCallback(async () => {
    if (resolvedServerScopeKeyRef.current) {
      return resolvedServerScopeKeyRef.current;
    }

    const resolved = await probeServerOrders();
    return resolved?.scopeKey || null;
  }, [probeServerOrders]);

  const syncMissingToLocal = useCallback(
    async (onProgress) => {
      const scopeKey = await resolveServerScopeKey();
      if (!scopeKey) {
        throw new Error('Brak danych w bazie.');
      }

      onProgress?.('Porównywanie bufora z bazą danych…');
      const serverIds = await listOrderIdsFromServerDb(scopeKey);
      const localIds = await listLocalOrderIds(scopeKey);
      const localKeys = new Set(localIds);
      const missingKeys = serverIds.filter((id) => !localKeys.has(id));

      if (missingKeys.length === 0) {
        return { added: 0 };
      }

      onProgress?.(`Pobieranie ${missingKeys.length} brakujących produktów…`);
      const missing = await getOrdersByIdsFromServerDb(scopeKey, missingKeys);
      if (missing.length === 0) {
        throw new Error('Nie udało się pobrać brakujących produktów z bazy danych.');
      }

      onProgress?.(`Dopisywanie ${missing.length} produktów do bufora…`);
      await appendLocalBatch(missing, { fetchedAt: new Date().toISOString() });
      await loadLocalOrdersPage(1, ordersPageSize, scopeKey);
      await refreshServerDbHint();
      return { added: missing.length };
    },
    [
      appendLocalBatch,
      listLocalOrderIds,
      loadLocalOrdersPage,
      ordersPageSize,
      refreshServerDbHint,
      resolveServerScopeKey,
    ]
  );

  const syncMissingToServer = useCallback(
    async (onProgress) => {
      const localScopeKey = getLocalScopeKey();
      if (!activeAccountId || !localScopeKey) {
        throw new Error('Brak bufora lokalnego.');
      }

      const serverScopeKey = (await resolveServerScopeKey()) || getServerScopeKey();
      if (!serverScopeKey) {
        throw new Error('Brak danych w bazie.');
      }

      onProgress?.('Porównywanie bazy z buforem lokalnym…');
      const serverIds = await listOrderIdsFromServerDb(serverScopeKey);
      const localIds = await listLocalOrderIds(localScopeKey);
      const serverKeys = new Set(serverIds);
      const missingKeys = localIds.filter((id) => !serverKeys.has(id));

      if (missingKeys.length === 0) {
        return { added: 0 };
      }

      let added = 0;
      const batchSize = 200;
      serverLoadAcceptedRef.current = true;

      for (let offset = 0; offset < missingKeys.length; offset += batchSize) {
        const chunk = missingKeys.slice(offset, offset + batchSize);
        onProgress?.(
          `Dopisywanie do bazy danych… ${Math.min(offset + chunk.length, missingKeys.length)} / ${missingKeys.length}`
        );
        const batch = await getLocalOrdersByIds(chunk, localScopeKey);
        if (!batch.length) {
          continue;
        }

        await appendOrdersToServerDb(serverScopeKey, batch, buildServerPayload(batch));
        added += batch.length;
      }

      await probeServerOrders();
      await refreshServerDbHint();
      return { added };
    },
    [
      activeAccountId,
      buildServerPayload,
      getLocalOrdersByIds,
      getLocalScopeKey,
      getServerScopeKey,
      listLocalOrderIds,
      probeServerOrders,
      refreshServerDbHint,
      resolveServerScopeKey,
    ]
  );

  const syncUnifyBoth = useCallback(
    async (onProgress) => {
      const localResult = await syncMissingToLocal(onProgress);
      const serverResult = await syncMissingToServer(onProgress);
      return {
        addedLocal: localResult.added,
        addedServer: serverResult.added,
      };
    },
    [syncMissingToLocal, syncMissingToServer]
  );

  const appendLocalOrdersToServer = useCallback(async (onProgress) => {
    const localScopeKey = getLocalScopeKey();
    if (!activeAccountId || !localScopeKey) {
      return;
    }

    const count = await getLocalCount(localScopeKey);
    if (!count) {
      return;
    }

    onProgress?.('Przenoszenie bufora do bazy danych…');
    const serverScopeKey = getServerScopeKey();
    serverLoadAcceptedRef.current = true;

    await iterateLocalBatches(localScopeKey, 500, async (batch) => {
      await appendOrdersToServerDb(serverScopeKey, batch, buildServerPayload(batch));
    });

    const resolved = await probeServerOrders();
    if (resolved?.scopeKey) {
      resolvedServerScopeKeyRef.current = resolved.scopeKey;
      serverKnownTotalRef.current = Number(resolved.total) || count;
      setServerOrdersTotal(Number(resolved.total) || count);
    }

    setOrdersPage(1);
    lastLoadedServerPageRef.current = {
      page: 0,
      size: ordersPageSize,
      scope: serverScopeKey,
      sortKey: orderSortKey,
    };
    await loadServerOrdersPage(1, ordersPageSize, serverScopeKey);
    lastLoadedServerPageRef.current = {
      page: 1,
      size: ordersPageSize,
      scope: serverScopeKey,
      sortKey: orderSortKey,
    };
    setActiveSource('server');
    await refreshServerDbHint();
  }, [
    activeAccountId,
    buildServerPayload,
    getLocalScopeKey,
    getServerScopeKey,
    iterateLocalBatches,
    loadServerOrdersPage,
    orderSortKey,
    ordersPageSize,
    probeServerOrders,
    refreshServerDbHint,
  ]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeSource]);

  const clearLocalStore = useCallback(async () => {
    await clearLocal();
    setActiveSource((current) => (current === 'local' ? 'server' : current));
    await refreshServerDbHint();
  }, [clearLocal, refreshServerDbHint]);

  const clearServerDatabase = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      await persistServerOrders([]);
      setServerOrders([]);
      setServerOrdersTotal(0);
      setOrdersPage(1);
      setActiveSource((current) => {
        if (current === 'server' && localOrdersTotal > 0) {
          return 'local';
        }
        return current;
      });
      await refreshServerDbHint();
    } catch (err) {
      setServerSyncError(err?.message || 'Nie udało się wyczyścić bazy danych.');
      throw err;
    }
  }, [activeAccountId, localOrdersTotal, persistServerOrders, refreshServerDbHint]);

  const moveServerToLocal = useCallback(async (onProgress) => {
    if (serverOrdersTotal === 0 || !activeAccountId) return;

    onProgress?.('Pobieranie danych z bazy…');
    const scopeKey = getServerScopeKey();
    const full = await getOrdersFromServerDb(scopeKey);
    const allOrders = Array.isArray(full?.orders) ? full.orders : [];
    if (allOrders.length === 0) return;

    await appendLocalBatch(allOrders, {
      replace: true,
      fetchedAt: new Date().toISOString(),
      meta: full?.meta ?? apiMeta,
      raw: full?.raw ?? apiRaw,
    });
    if (full?.raw) {
      setApiRaw(full.raw);
    }
    if (full?.meta) {
      setApiMeta(full.meta);
    }
    setActiveSource('local');
    await loadLocalOrdersPage(1, ordersPageSize);
    await refreshServerDbHint();
  }, [
    activeAccountId,
    apiMeta,
    apiRaw,
    appendLocalBatch,
    getServerScopeKey,
    loadLocalOrdersPage,
    ordersPageSize,
    refreshServerDbHint,
    serverOrdersTotal,
  ]);

  const moveLocalToServer = useCallback(
    async (onProgress) => {
      if (!activeAccountId || localOrdersTotal === 0) {
        return;
      }
      await appendLocalOrdersToServer(onProgress);
    },
    [activeAccountId, appendLocalOrdersToServer, localOrdersTotal]
  );

  const removeFromSelection = useCallback((keys) => {
    const keySet = new Set(Array.isArray(keys) ? keys : [keys]);
    setSelectedIds((prev) => prev.filter((id) => !keySet.has(id)));
  }, []);

  const deleteOrderKeys = useCallback(
    (keys) => {
      const keySet = new Set(Array.isArray(keys) ? keys : [keys]);
      if (keySet.size === 0) return;

      if (activeSource === 'local') {
        deleteLocalKeys([...keySet]).catch((err) => {
          setError(err?.message || 'Nie udało się usunąć zamówień z bufora.');
        });
      }

      if (activeSource === 'server') {
        removeServerOrderKeys([...keySet], ordersPage).catch(
          (err) => {
            setServerSyncError(err?.message || 'Nie udało się usunąć zamówień w bazie danych.');
          }
        );
      }

      removeFromSelection([...keySet]);
    },
    [activeSource, deleteLocalKeys, ordersPage, removeFromSelection, removeServerOrderKeys]
  );

  const moveSelectedToLocal = useCallback(async () => {
    const keySet = new Set(selectedIds);
    const selected = pickOrdersByKeys(orders, keySet);
    if (selected.length === 0) return;

    await appendLocalBatch(selected);

    if (activeSource === 'server') {
      removeServerOrderKeys([...keySet], ordersPage).catch((err) => {
        setServerSyncError(err?.message || 'Nie udało się przenieść zamówień.');
      });
    }

    setSelectedIds([]);
    setActiveSource('local');
    await loadLocalOrdersPage(ordersPage, ordersPageSize);
  }, [
    activeSource,
    appendLocalBatch,
    loadLocalOrdersPage,
    orders,
    ordersPage,
    ordersPageSize,
    removeServerOrderKeys,
    selectedIds,
  ]);

  const moveSelectedToServer = useCallback(async () => {
    const keySet = new Set(selectedIds);
    const selected = pickOrdersByKeys(orders, keySet);
    if (selected.length === 0 || !activeAccountId) return;

    let serverScopeKey = getServerScopeKey();
    if (!resolvedServerScopeKeyRef.current) {
      const resolved = await probeServerOrders();
      serverScopeKey = resolved?.scopeKey || serverScopeKey;
    }
    if (!serverScopeKey) {
      setServerSyncError('Brak powiązanej bazy danych dla tego konta.');
      return;
    }

    try {
      serverLoadAcceptedRef.current = true;
      await appendOrdersToServerDb(serverScopeKey, selected, buildServerPayload(selected));
      await deleteLocalKeys([...keySet]);
      await probeServerOrders();
      await refreshServerDbHint();
      setSelectedIds([]);
      await loadLocalOrdersPage(ordersPage, ordersPageSize);
    } catch (err) {
      setServerSyncError(err?.message || 'Nie udało się przenieść zamówień do bazy danych.');
    }
  }, [
    activeAccountId,
    buildServerPayload,
    deleteLocalKeys,
    getServerScopeKey,
    loadLocalOrdersPage,
    orders,
    ordersPage,
    ordersPageSize,
    probeServerOrders,
    refreshServerDbHint,
    selectedIds,
  ]);

  const bumpBulkResume = useCallback(() => {
    setBulkResumeVersion((value) => value + 1);
  }, []);

  const bulkResumeInfo = useMemo(() => {
    if (!activeAccountId) return null;
    const saved = readBulkImportResume(activeAccountId);
    if (!saved) return null;
    if (saved.configHint !== getConfigHint(config)) return null;
    return saved;
  }, [activeAccountId, config, bulkResumeVersion]);

  const openBulkDownload = useCallback(() => {
    if (!isConfigured) return;

    setBulkModal({
      open: true,
      phase: 'setup',
      progress: INITIAL_PROGRESS,
      error: '',
      result: null,
      downloadScope: null,
      importDestination: 'local',
    });
    setError('');
  }, [isConfigured]);

  useEffect(() => {
    if (!bulkModal.open || bulkModal.phase !== 'setup' || !activeAccountId) {
      return undefined;
    }

    let cancelled = false;

    const loadStoredBounds = async () => {
      setBulkStoredBounds((current) => ({ ...current, loading: true }));

      const localScopeKey = getLocalScopeKey();
      let serverScopeKey = getServerScopeKey();

      if (activeAccountId) {
        try {
          const resolved = await resolveOrdersScopeFromDb(activeAccountId, getConfigHint(config));
          if (resolved?.scopeKey) {
            serverScopeKey = resolved.scopeKey;
          }
        } catch (_err) {
          // zostaje scope z buildOrdersScopeKey
        }
      }

      let localMin = null;
      let localMax = null;
      let serverMin = null;
      let serverMax = null;

      if (localScopeKey) {
        try {
          const bounds = await getOrderIdBounds(localScopeKey);
          localMin = bounds.minOrderId;
          localMax = bounds.maxOrderId;
        } catch (_err) {
          localMin = null;
          localMax = null;
        }
      }

      if (serverScopeKey) {
        try {
          const bounds = await getOrderIdBoundsFromServerDb(serverScopeKey);
          serverMin = bounds.minOrderId;
          serverMax = bounds.maxOrderId;
        } catch (_err) {
          serverMin = null;
          serverMax = null;
        }
      }

      if (!cancelled) {
        setBulkStoredBounds({
          loading: false,
          localMin,
          localMax,
          serverMin,
          serverMax,
        });
      }
    };

    loadStoredBounds();
    return () => {
      cancelled = true;
    };
  }, [
    activeAccountId,
    bulkModal.open,
    bulkModal.phase,
    config,
    getLocalScopeKey,
    getServerScopeKey,
  ]);

  const runBulkDownload = useCallback(
    async ({ downloadScope, destination = 'local', resume = false } = {}) => {
      if (!activeAccountId) return;

      let importConfig = config;
      try {
        importConfig = await resolveSellasistConfigForAccount(activeAccountId);
      } catch (_e) {
        // zostaje bieżąca konfiguracja z hooka
      }

      let savedResume = null;
      if (resume) {
        savedResume = readBulkImportResume(activeAccountId);
        if (!savedResume || savedResume.configHint !== getConfigHint(importConfig)) {
          setBulkModal({
            open: true,
            phase: 'error',
            progress: INITIAL_PROGRESS,
            error: 'Brak zapisanego wznowienia lub konfiguracja Sellasist się zmieniła.',
            result: null,
            downloadScope: null,
            importDestination: 'local',
          });
          return;
        }
      }

      const effectiveScope = savedResume?.downloadScope || downloadScope;
      const effectiveDestination = savedResume?.destination || destination;

      if (!effectiveScope) return;

      if (!isSellasistConfigured(importConfig)) {
        setBulkModal({
          open: true,
          phase: 'error',
          progress: INITIAL_PROGRESS,
          error:
            'Brak konfiguracji Sellasist dla aktywnego konta. Wejdź w Konfiguracja API, podaj subdomenę sklepu (.sellasist.pl) i klucz API, zapisz i użyj „Testuj połączenie”.',
          result: null,
          downloadScope: effectiveScope,
          importDestination: effectiveDestination,
        });
        return;
      }

      if (!isSellasistDemoMode(importConfig)) {
        try {
          await testSellasistConnection(importConfig);
        } catch (err) {
          setBulkModal({
            open: true,
            phase: 'error',
            progress: INITIAL_PROGRESS,
            error:
              err?.message ||
              'Sellasist odrzucił połączenie. Sprawdź subdomenę sklepu i klucz API w Konfiguracji.',
            result: null,
            downloadScope: effectiveScope,
            importDestination: effectiveDestination,
          });
          return;
        }
      }

      const savesLocal = effectiveDestination === 'local' || effectiveDestination === 'both';
      const savesServer = effectiveDestination === 'server' || effectiveDestination === 'both';
      const isContinueImport = effectiveScope?.type === 'continueFromStored';

      abortRef.current = new AbortController();
      bulkAbortModeRef.current = null;
      const importStartedAt = savedResume?.importStartedAt || new Date().toISOString();
      let fetchedAny = Boolean(savedResume?.fetchedTotal);

      if (!savedResume && !isContinueImport) {
        clearBulkImportResume(activeAccountId);
        if (savesLocal) {
          await clearLocal();
        }
        if (savesServer && activeAccountId) {
          await persistServerOrders([]);
          serverLoadAcceptedRef.current = true;
        }
      }

      bulkSessionRef.current = {
        savesLocal,
        savesServer,
        destination: effectiveDestination,
        downloadScope: effectiveScope,
        importStartedAt,
        importConfig,
      };

      const resumeProgress = savedResume
        ? {
            packageNum: savedResume.packageNum || 0,
            fetchedTotal: savedResume.fetchedTotal || 0,
            lastBatchSize: 0,
            remainingPackages: '—',
            remainingOrders: '—',
            etaLabel: '—',
            progressPercent: savedResume.totalKnown
              ? Math.min(
                  99,
                  Math.round(
                    ((savedResume.fetchedTotal || 0) / Math.max(savedResume.totalKnown, 1)) * 100
                  )
                )
              : 0,
            requestsThisMinute: 0,
            offset: savedResume.offset || 0,
            totalKnown: savedResume.totalKnown ?? null,
          }
        : INITIAL_PROGRESS;

      bulkProgressRef.current = resumeProgress;

      setActiveSource(effectiveDestination === 'server' ? 'server' : 'local');
      setOrdersPage(1);

      setBulkModal({
        open: true,
        phase: 'downloading',
        progress: resumeProgress,
        error: '',
        result: null,
        downloadScope: effectiveScope,
        importDestination: effectiveDestination,
      });
      setError('');

      logEvent({
        level: 'info',
        category: 'orders',
        action: savedResume ? 'orders.import.resume' : 'orders.import.start',
        message: savedResume
          ? 'Wznowiono import zamówień z Sellasist'
          : 'Rozpoczęto import zamówień z Sellasist',
        details: {
          downloadScope: effectiveScope,
          destination: effectiveDestination,
          account: importConfig.account || '',
          useDemoData: Boolean(importConfig.useDemoData),
          fetchedTotal: savedResume?.fetchedTotal || 0,
        },
      });

      const persistImportCheckpoint = (progress) => {
        const session = bulkSessionRef.current;
        if (!session || !activeAccountId) {
          return;
        }

        const payload = buildBulkImportResumePayload(
          {
            configHint: getConfigHint(session.importConfig),
            downloadScope: session.downloadScope,
            destination: session.destination,
            importStartedAt: session.importStartedAt,
          },
          progress
        );

        if (!payload) {
          return;
        }

        writeBulkImportResume(activeAccountId, payload);
      };

      const appendBatchToStore = async ({ batch, meta, apiRaw: batchApiRaw }) => {
        fetchedAny = true;
        if (savesLocal) {
          await appendLocalBatch(batch, {
            fetchedAt: importStartedAt,
            meta,
            raw: batchApiRaw,
          });
        }

        if (savesServer && activeAccountId) {
          const serverScopeKey = getServerScopeKey();
          await appendOrdersToServerDb(serverScopeKey, batch, buildServerPayload(batch));
        }

        if (batchApiRaw) {
          setApiRaw(batchApiRaw);
        }
        if (meta) {
          setApiMeta(meta);
        }

        if (savesLocal) {
          await loadLocalOrdersPage(1, ordersPageSize);
        }
      };

      const resumeFrom = savedResume
        ? {
            offset: savedResume.offset || 0,
            packageNum: savedResume.packageNum || 0,
            fetchedTotal: savedResume.fetchedTotal || 0,
            totalKnown: savedResume.totalKnown ?? null,
          }
        : null;

      try {
        const result = await downloadAllOrders(
          importConfig,
          (params) =>
            fetchSellasistOrders(importConfig, params, { signal: abortRef.current.signal }),
          {
            signal: abortRef.current.signal,
            downloadScope: effectiveScope,
            resumeFrom,
            onBatch: appendBatchToStore,
            onProgress: (progress) => {
              bulkProgressRef.current = progress;
              persistImportCheckpoint(progress);
              setBulkModal((current) => ({
                ...current,
                progress,
              }));
            },
          }
        );

        clearBulkImportResume(activeAccountId);
        bumpBulkResume();
        bulkSessionRef.current = null;

        if (savesServer && activeAccountId) {
          const serverScopeKey = getServerScopeKey();
          await probeServerOrders();
          lastLoadedServerPageRef.current = {
            page: 0,
            size: ordersPageSize,
            scope: serverScopeKey,
            sortKey: orderSortKey,
          };
          await loadServerOrdersPage(1, ordersPageSize, serverScopeKey);
          lastLoadedServerPageRef.current = {
            page: 1,
            size: ordersPageSize,
            scope: serverScopeKey,
            sortKey: orderSortKey,
          };
        }

        if (effectiveDestination === 'server') {
          setActiveSource('server');
        } else {
          setActiveSource('local');
          await loadLocalOrdersPage(1, ordersPageSize);
        }

        await refreshServerDbHint();

        setBulkModal((current) => ({
          ...current,
          phase: 'done',
          result,
          downloadScope: effectiveScope,
          importDestination: effectiveDestination,
          progress: {
            ...current.progress,
            packageNum: result.packages,
            progressPercent: 100,
            etaLabel: 'Zakończono',
            remainingPackages: '0',
            remainingOrders: '0',
          },
        }));

        logEvent({
          level: 'info',
          category: 'orders',
          action: 'orders.import.success',
          message: `Import zakończony: ${result.count || 0} zamówień`,
          details: {
            downloadScope: effectiveScope,
            destination: effectiveDestination,
            count: result.count || 0,
            packages: result.packages,
            resumed: Boolean(savedResume),
          },
        });
      } catch (err) {
        if (abortRef.current?.signal.aborted) {
          const mode = bulkAbortModeRef.current;
          bulkAbortModeRef.current = null;
          const session = bulkSessionRef.current;
          bulkSessionRef.current = null;
          const progress = bulkProgressRef.current || INITIAL_PROGRESS;

          if (mode === 'pause' && session) {
            persistImportCheckpoint(progress);
            bumpBulkResume();

            if (session.destination === 'server') {
              setActiveSource('server');
            } else {
              setActiveSource('local');
            }

            if (session.savesLocal) {
              await loadLocalOrdersPage(1, ordersPageSize);
            }
            if (session.savesServer && activeAccountId) {
              const serverScopeKey = getServerScopeKey();
              await probeServerOrders();
              await loadServerOrdersPage(1, ordersPageSize, serverScopeKey);
            }
            await refreshServerDbHint();

            setBulkModal({
              open: false,
              phase: 'idle',
              progress: INITIAL_PROGRESS,
              error: '',
              result: null,
              downloadScope: null,
              importDestination: 'local',
            });

            logEvent({
              level: 'info',
              category: 'orders',
              action: 'orders.import.paused',
              message: `Import wstrzymany: ${progress.fetchedTotal || 0} zamówień`,
              details: {
                downloadScope: session.downloadScope,
                destination: session.destination,
                fetchedTotal: progress.fetchedTotal || 0,
              },
            });
            return;
          }

          if (mode === 'cancel' && session) {
            clearBulkImportResume(activeAccountId);
            bumpBulkResume();

            if (session.savesLocal) {
              await clearLocal();
            }
            if (session.savesServer && activeAccountId) {
              await persistServerOrders([]);
            }

            setBulkModal({
              open: false,
              phase: 'idle',
              progress: INITIAL_PROGRESS,
              error: '',
              result: null,
              downloadScope: null,
              importDestination: 'local',
            });

            logEvent({
              level: 'warn',
              category: 'orders',
              action: 'orders.import.cancelled',
              message: 'Import zamówień anulowany — dane importu usunięte',
              details: {
                downloadScope: session.downloadScope,
                destination: session.destination,
              },
            });
            return;
          }

          setBulkModal({
            open: false,
            phase: 'idle',
            progress: INITIAL_PROGRESS,
            error: '',
            result: null,
            downloadScope: null,
            importDestination: 'local',
          });
          return;
        }

        const savedWhere =
          savesLocal && savesServer
            ? 'buforze lokalnym i bazie danych'
            : savesServer
              ? 'bazie danych'
              : 'buforze lokalnym';

        logEvent({
          level: 'error',
          category: 'orders',
          action: 'orders.import.error',
          message: 'Błąd importu zamówień',
          details: { downloadScope: effectiveScope, destination: effectiveDestination, error: err.message },
        });

        const baseMessage = err.message || 'Nie udało się pobrać zamówień.';
        const session = bulkSessionRef.current;
        const progress = bulkProgressRef.current || INITIAL_PROGRESS;

        if (session && fetchedAny) {
          persistImportCheckpoint(progress);
          bumpBulkResume();
        }

        bulkSessionRef.current = null;

        const suffix = fetchedAny
          ? ` Pobrane do tej pory zamówienia są w ${savedWhere}. Aby dokończyć ten sam import (także starsze brakujące), użyj „Wznów import”. Aby dobić tylko najnowsze — opcja „Dobij brakujące najnowsze”.`
          : '';

        setBulkModal((current) => ({
          ...current,
          phase: 'error',
          error: `${baseMessage}${suffix}`,
        }));
      }
    },
    [
      activeAccountId,
      appendLocalBatch,
      appendOrdersToServerDb,
      buildServerPayload,
      bumpBulkResume,
      clearLocal,
      config,
      getServerScopeKey,
      loadLocalOrdersPage,
      loadServerOrdersPage,
      ordersPageSize,
      persistServerOrders,
      probeServerOrders,
      refreshServerDbHint,
    ]
  );

  const pauseBulkDownload = useCallback(() => {
    bulkAbortModeRef.current = 'pause';
    abortRef.current?.abort();
  }, []);

  const cancelBulkDownload = useCallback(() => {
    bulkAbortModeRef.current = 'cancel';
    abortRef.current?.abort();
  }, []);

  const resumeBulkDownload = useCallback(() => {
    runBulkDownload({ resume: true });
  }, [runBulkDownload]);

  const discardBulkResume = useCallback(() => {
    if (activeAccountId) {
      clearBulkImportResume(activeAccountId);
    }
    bumpBulkResume();
  }, [activeAccountId, bumpBulkResume]);

  const closeBulkModal = useCallback(() => {
    setBulkModal({
      open: false,
      phase: 'idle',
      progress: INITIAL_PROGRESS,
      error: '',
      result: null,
      downloadScope: null,
      importDestination: 'local',
    });
  }, []);

  const statuses = availableStatuses;

  useEffect(() => {
    let cancelled = false;

    const loadStatuses = async () => {
      if (!activeAccountId || !isConfigured) {
        if (!cancelled) {
          setAvailableStatuses([]);
        }
        return;
      }

      if (activeSource === 'local') {
        const scopeKey = getLocalScopeKey();
        if (!scopeKey || localOrdersTotal <= 0) {
          if (!cancelled) {
            setAvailableStatuses(mergeStatusFilterOptions([], filters.status));
          }
          return;
        }

        try {
          const list = await listOrderStatuses(scopeKey);
          if (!cancelled) {
            setAvailableStatuses(mergeStatusFilterOptions(list, filters.status));
          }
        } catch (_err) {
          if (!cancelled) {
            setAvailableStatuses(mergeStatusFilterOptions([], filters.status));
          }
        }
        return;
      }

      const scopeKey = getServerScopeKey();
      if (!scopeKey || serverOrdersTotal <= 0) {
        if (!cancelled) {
          setAvailableStatuses(mergeStatusFilterOptions([], filters.status));
        }
        return;
      }

      try {
        const list = await listOrderStatusesFromServerDb(scopeKey);
        if (!cancelled) {
          setAvailableStatuses(mergeStatusFilterOptions(list, filters.status));
        }
      } catch (_err) {
        if (!cancelled) {
          setAvailableStatuses(mergeStatusFilterOptions([], filters.status));
        }
      }
    };

    loadStatuses();
    return () => {
      cancelled = true;
    };
  }, [
    activeAccountId,
    activeSource,
    filters.status,
    getLocalScopeKey,
    getServerScopeKey,
    isConfigured,
    localOrdersTotal,
    serverOrdersTotal,
  ]);

  const ordersTotalPages = useMemo(() => {
    if (activeSource === 'server') {
      return Math.max(1, Math.ceil(serverOrdersTotal / ordersPageSize) || 1);
    }
    return Math.max(1, Math.ceil(localOrdersTotal / ordersPageSize) || 1);
  }, [activeSource, localOrdersTotal, ordersPageSize, serverOrdersTotal]);

  const safeOrdersPage = Math.min(Math.max(ordersPage, 1), ordersTotalPages);

  const paginationTotalItems =
    activeSource === 'server' ? serverOrdersTotal : localOrdersTotal;

  const paginatedOrders = useMemo(() => {
    if (activeSource === 'server') {
      return filterOrders(serverOrders, filters);
    }
    return localOrders;
  }, [activeSource, filters, localOrders, serverOrders]);

  const filteredOrders = useMemo(() => {
    if (activeSource === 'server') {
      return filterOrders(serverOrders, filters);
    }
    return localOrders;
  }, [activeSource, localOrders, serverOrders]);

  useEffect(() => {
    setOrdersPage(1);
  }, [filters, activeSource, ordersPageSize, orderSortKey]);

  useEffect(() => {
    if (ordersPage !== safeOrdersPage) {
      setOrdersPage(safeOrdersPage);
    }
  }, [ordersPage, safeOrdersPage]);

  const selectedOrders = useMemo(
    () => pickOrdersByKeys(orders, selectedIds),
    [orders, selectedIds]
  );

  const handleCsvExport = useCallback(
    async (scope) => {
      let toExport = [];

      if (scope === 'visible') {
        toExport = paginatedOrders;
      }

      if (scope === 'selected') {
        toExport = selectedOrders;
      }

      if (scope === 'all') {
        if (activeSource === 'local') {
          const scopeKey = getLocalScopeKey();
          if (scopeKey) {
            const allRows = [];
            await iterateLocalBatches(scopeKey, 500, async (batch) => {
              allRows.push(...batch);
            });
            toExport = allRows;
          }
        } else {
          toExport = orders;
        }
      }

      if (!toExport.length) return;

      downloadOrdersCsv(toExport, getOrdersExportFilename(scope, toExport.length));
      setExportModalOpen(false);
      logEvent({
        level: 'info',
        category: 'orders',
        action: 'orders.export.csv',
        message: `Eksport CSV: ${toExport.length} zamówień`,
        details: { scope, count: toExport.length },
      });
    },
    [
      activeSource,
      getLocalScopeKey,
      iterateLocalBatches,
      orders,
      paginatedOrders,
      selectedOrders,
    ]
  );

  const exportCounts = useMemo(
    () => ({
      visible: paginatedOrders.length,
      selected: selectedOrders.length,
      all: activeSource === 'local' ? localOrdersTotal : orders.length,
    }),
    [activeSource, localOrdersTotal, orders.length, paginatedOrders.length, selectedOrders.length]
  );

  const exportSourceLabel =
    activeSource === 'local' ? 'Bufor lokalny' : 'Baza danych';

  const sellasistSummary = useMemo(() => {
    if (isDemoMode) {
      return 'tryb demo (bez wywołań API)';
    }
    if (config.account && config.apiKey) {
      return `${config.account}.sellasist.pl · klucz API zapisany`;
    }
    if (config.account) {
      return `${config.account}.sellasist.pl · brak klucza API`;
    }
    return 'brak konfiguracji — uzupełnij w Konfiguracja API';
  }, [config.account, config.apiKey, isDemoMode]);

  const visibleOrderKeys = useMemo(
    () => paginatedOrders.map(getOrderKey).filter(Boolean),
    [paginatedOrders]
  );

  const allVisibleSelected =
    visibleOrderKeys.length > 0 && visibleOrderKeys.every((key) => selectedIds.includes(key));

  const handleToggleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleOrderKeys.includes(id)));
      return;
    }

    setSelectedIds((prev) => [...new Set([...prev, ...visibleOrderKeys])]);
  }, [allVisibleSelected, visibleOrderKeys]);

  const handleSelectedChange = useCallback((orderKey, checked) => {
    if (!orderKey) return;

    setSelectedIds((prev) => {
      if (checked) {
        return prev.includes(orderKey) ? prev : [...prev, orderKey];
      }
      return prev.filter((id) => id !== orderKey);
    });
  }, []);

  const syncInfoFull = useMemo(
    () => ({
      ...syncInfo,
      savedCount: localOrdersTotal,
      bufferCount: localOrdersTotal,
      serverCount: serverOrdersTotal,
      bufferFetchedAtLabel: syncInfo.fetchedAtLabel,
      bufferHasData: localOrdersTotal > 0,
      activeSource,
      isDemoMode,
      accountDisplay: isDemoMode
        ? 'tryb demo (OpenAPI)'
        : config.account
          ? `${config.account}.sellasist.pl`
          : '—',
      accessAccountLabel: getAccessAccountDisplayName(activeAccount),
      storageScope: activeAccount
        ? `${getAccessAccountDisplayName(activeAccount)} · ${isDemoMode ? 'demo' : (config.account || 'brak').trim().toLowerCase()}`
        : '—',
      serverHasData: serverOrdersTotal > 0,
      serverFetchedAtLabel: serverMeta.fetchedAtLabel,
      serverSyncError,
      bulkDownloading,
      bulkProgress: bulkDownloading ? bulkModal.progress : null,
      visibleTotal: activeSource === 'local' ? localOrdersTotal : orders.length,
      visibleFiltered: activeSource === 'local' ? localOrdersTotal : filteredOrders.length,
    }),
    [
      syncInfo,
      localOrdersTotal,
      serverOrdersTotal,
      serverMeta.fetchedAtLabel,
      serverSyncError,
      activeSource,
      isDemoMode,
      activeAccount,
      config.account,
      bulkDownloading,
      bulkModal.progress,
      orders.length,
      filteredOrders.length,
    ]
  );

  return (
    <>
      <OrdersPageInitOverlay
        visible={showPageInitOverlay}
        step={pageInitStep || 'local'}
        localCount={localCacheHydrated ? localOrdersTotal : null}
        serverCount={serverDbHintReady ? serverOrdersTotal : null}
      />

      <ServerOrdersLoadOverlay
        phase={serverLoadPhase}
        label={serverLoadProgress.label}
        page={serverLoadProgress.page}
        totalPages={serverLoadProgress.totalPages}
        itemFrom={serverLoadProgress.itemFrom}
        itemTo={serverLoadProgress.itemTo}
        totalItems={serverLoadProgress.totalItems || serverOrdersTotal}
        percent={serverLoadProgress.percent}
        loading={serverOrdersLoading}
      />

      <PageShell
        title="Zamówienia Sellasist"
        fullWidth
        headerActions={
          <button
            type="button"
            onClick={() => setConfigModalOpen(true)}
            className={headerBtnPrimary}
          >
            <IconCog className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Konfiguracja Sellasist</span>
            <span className="sm:hidden">Config</span>
          </button>
        }
      >
        <div className={`space-y-6 ${isConfigured ? 'pb-24' : ''}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <BackToPanelLink />
            {isConfigured && isDemoMode && <DemoModeHint />}
          </div>

          {!isConfigured && accountReady && (
            <div className="rounded-3xl bg-amber-50 border border-amber-200 p-6 text-sm text-amber-900">
              <p>
                Brak konfiguracji Sellasist dla konta{' '}
                <strong>{getAccessAccountDisplayName(activeAccount)}</strong>. Użyj przycisku{' '}
                <strong>Konfiguracja Sellasist</strong> w nagłówku strony i zapisz ustawienia API.
              </p>
            </div>
          )}

          {accountReady && activeAccount && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px_260px] gap-6 items-start">
              <div className="space-y-4 min-w-0 xl:col-start-1">
                <OrdersSourceToggle
                  activeSource={activeSource}
                  localCount={localOrdersTotal}
                  serverCount={serverOrdersTotal}
                  syncSummary={
                    serverLoadPhase || !serverDbHintReady ? null : sourceSyncSummary
                  }
                  onChange={handleSourceChange}
                />

                {activeSource === 'local' && (
                  <p className="text-xs text-slate-500">
                    Widok: bufor lokalny
                    {syncInfo.savedLocally && ` · ostatni zapis: ${syncInfo.fetchedAtLabel}`}
                    {localOrdersTotal > 0 &&
                      ` · ${localOrdersTotal} w buforze, strona ${safeOrdersPage}/${ordersTotalPages}`}
                  </p>
                )}
                {activeSource === 'server' && (
                  <p className="text-xs text-slate-500">
                    Widok: baza danych
                    {serverOrdersTotal > 0 && ` · ostatni zapis: ${serverMeta.fetchedAtLabel}`}
                    {serverOrdersTotal > 0 &&
                      ` · ${serverOrdersTotal} w bazie danych, strona ${safeOrdersPage}/${ordersTotalPages}`}
                  </p>
                )}
                {serverSyncError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                    Błąd bazy danych: {serverSyncError}
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                    {error}
                  </div>
                )}

                {((activeSource === 'server' && serverOrdersLoading && serverLoadPhase === 'loading') ||
                  (activeSource === 'local' &&
                    localOrdersLoading &&
                    !showPageInitOverlay &&
                    localOrders.length === 0) ||
                  (bulkDownloading && localOrdersTotal === 0)) && (
                  <p className="text-sm text-slate-500 text-center py-12">
                    {activeSource === 'server'
                      ? 'Ładowanie z bazy danych…'
                      : 'Ładowanie bufora lokalnego…'}
                  </p>
                )}

                {!bulkDownloading &&
                  !(activeSource === 'server' && serverOrdersLoading) &&
                  !(activeSource === 'local' && localOrdersLoading) &&
                  orders.length === 0 &&
                  !(activeSource === 'server' && serverOrdersTotal > 0) &&
                  !(activeSource === 'local' && localOrdersTotal > 0) &&
                  !error && (
                  <p className="text-sm text-slate-400 text-center py-12 rounded-3xl border border-dashed border-slate-200">
                    {activeSource === 'local'
                      ? 'Bufor lokalny jest pusty. Użyj „Pobierz z Sellasist”.'
                      : 'Baza danych jest pusta. Zaimportuj dane i zapisz w bazie danych.'}
                  </p>
                )}

                {!bulkDownloading && orders.length > 0 && filteredOrders.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-12 rounded-3xl border border-dashed border-slate-200 bg-white">
                    Brak wyników dla wybranych filtrów.
                    {hasActiveFilters(filters) && ' Wyczyść filtry w środkowej kolumnie.'}
                  </p>
                )}

                {paginatedOrders.length > 0 && (
                  <OrdersSelectionBar
                    selectedCount={selectedIds.length}
                    visibleCount={visibleOrderKeys.length}
                    allVisibleSelected={allVisibleSelected}
                    activeSource={activeSource}
                    onToggleSelectAll={handleToggleSelectAll}
                    onDeleteSelected={() => deleteOrderKeys(selectedIds)}
                    onMoveSelectedToLocal={moveSelectedToLocal}
                    onMoveSelectedToServer={moveSelectedToServer}
                    pageSize={ordersPageSize}
                    pageSizes={ORDERS_PAGE_SIZES}
                    onPageSizeChange={setOrdersPageSize}
                  />
                )}

                <div className="space-y-5">
                  {paginatedOrders.map((order) => {
                    const orderKey = getOrderKey(order);
                    return (
                      <OrderCard
                        key={orderKey || order.id || order.order_id}
                        order={order}
                        selected={selectedIds.includes(orderKey)}
                        onSelectedChange={handleSelectedChange}
                        onDelete={deleteOrderKeys}
                      />
                    );
                  })}
                </div>

                {paginationTotalItems > 0 && (
                  <OrdersPagination
                    page={safeOrdersPage}
                    pageSize={ordersPageSize}
                    totalItems={paginationTotalItems}
                    onPageChange={setOrdersPage}
                  />
                )}
              </div>

              <div className="space-y-4 xl:sticky xl:top-6">
                <OrdersActionsPanel
                  onManageOrders={() => setManageModalOpen(true)}
                  onBulkDownload={openBulkDownload}
                  onExport={() => setExportModalOpen(true)}
                  exportDisabled={bulkDownloading || orders.length === 0}
                  bulkDisabled={bulkModal.phase === 'downloading' || bulkModal.phase === 'setup'}
                />

                <OrdersFilters
                  filters={filters}
                  onChange={setFilters}
                  orderSort={orderSort}
                  onSortChange={setOrderSort}
                  statuses={statuses}
                  onResetFilters={() => setFilters(EMPTY_FILTERS)}
                  filteredCount={
                    activeSource === 'server' ? paginatedOrders.length : filteredOrders.length
                  }
                  totalCount={activeSource === 'server' ? serverOrdersTotal : orders.length}
                />
              </div>

              <aside className="min-w-0 xl:sticky xl:top-6">
                <SyncStatusPanel syncInfo={syncInfoFull} />
              </aside>
            </div>
          )}
        </div>
      </PageShell>

      <ExportCsvModal
        open={exportModalOpen}
        sourceLabel={exportSourceLabel}
        counts={exportCounts}
        onClose={() => setExportModalOpen(false)}
        onExport={handleCsvExport}
      />

      <SellasistConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
      />

      <BulkDownloadModal
        open={bulkModal.open}
        phase={bulkModal.phase}
        progress={bulkModal.progress}
        error={bulkModal.error}
        resultCount={bulkModal.result?.count || 0}
        downloadScope={bulkModal.downloadScope}
        importDestination={bulkModal.importDestination}
        sellasistSummary={sellasistSummary}
        resumeInfo={bulkResumeInfo}
        storedOrderBounds={bulkStoredBounds}
        onStartDownload={runBulkDownload}
        onResumeDownload={resumeBulkDownload}
        onDiscardResume={discardBulkResume}
        onPause={pauseBulkDownload}
        onCancel={cancelBulkDownload}
        onClose={closeBulkModal}
      />

      <OrdersManageModal
        open={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        syncSummary={sourceSyncSummary}
        summaryLoading={!serverDbHintReady}
        actions={{
          syncUnifyBoth,
          syncMissingToLocal,
          syncMissingToServer,
          moveServerToLocal,
          moveServerToLocalDisabled: bulkDownloading || serverOrdersTotal === 0,
          moveLocalToServer,
          moveLocalToServerDisabled: bulkDownloading || localOrdersTotal === 0,
          clearLocal: clearLocalStore,
          clearLocalDisabled: localOrdersTotal === 0 && !syncInfo.savedLocally,
          clearServer: clearServerDatabase,
          clearServerDisabled: serverOrdersTotal === 0,
        }}
      />

      {isConfigured && (
        <ApiRawPanel payload={apiRaw} meta={apiMeta} loading={bulkDownloading} />
      )}
    </>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersView />
    </RequireAuth>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'gatsby';
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
import { SellasistConfigModal } from '../components/SellasistConfigModal';
import { useAccessAccount } from '../context/AccessAccountContext';
import {
  clearOrdersCache,
  buildOrdersScopeKey,
  formatFetchedAt,
  readOrdersCache,
  writeOrdersCache,
} from '../data/ordersLocalDb';
import { getAccessAccountDisplayName } from '../data/accessAccounts';
import { fetchSellasistOrders } from '../hooks/useSellasistApi';
import {
  clearOrdersFromServerDb,
  getOrdersFromServerDb,
  setOrdersToServerDb,
} from '../hooks/useAppDbApi';
import { useSellasistConfig } from '../hooks/useSellasistConfig';
import { downloadAllOrders } from '../utils/bulkOrderDownload';
import { downloadOrdersCsv, getOrdersExportFilename } from '../utils/exportOrdersCsv';
import { logEvent } from '../utils/eventLog';
import {
  EMPTY_FILTERS,
  filterOrders,
  getUniqueOrderStatuses,
  hasActiveFilters,
} from '../utils/filterOrders';
import {
  excludeOrdersByKeys,
  getOrderKey,
  mergeOrders,
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

function OrdersView() {
  const { activeAccount, activeAccountId, ready: accountReady } = useAccessAccount();
  const { config, isConfigured, isDemoMode, loaded: configLoaded } = useSellasistConfig();
  const [savedOrders, setSavedOrders] = useState([]);
  const [serverOrders, setServerOrders] = useState([]);
  const [serverSyncError, setServerSyncError] = useState('');
  const [serverMeta, setServerMeta] = useState({
    fetchedAt: null,
    fetchedAtLabel: 'Brak zapisu na serwerze',
  });
  const [bufferOrders, setBufferOrders] = useState([]);
  const [activeSource, setActiveSource] = useState('saved');
  const [apiRaw, setApiRaw] = useState(null);
  const [apiMeta, setApiMeta] = useState(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState([]);
  const [syncInfo, setSyncInfo] = useState({
    fetchedAt: null,
    fetchedAtLabel: 'Brak zapisu w bazie',
    savedLocally: false,
    cachedCount: 0,
    accountLabel: '',
  });
  const [bufferMeta, setBufferMeta] = useState({
    fetchedAt: null,
    fetchedAtLabel: 'Bufor pusty',
  });
  const [bulkModal, setBulkModal] = useState({
    open: false,
    phase: 'idle',
    progress: INITIAL_PROGRESS,
    error: '',
    result: null,
    downloadScope: null,
  });
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(25);

  const abortRef = useRef(null);
  const bulkDownloading = bulkModal.phase === 'downloading';

  const orders =
    activeSource === 'saved'
      ? savedOrders
      : activeSource === 'server'
        ? serverOrders
        : bufferOrders;

  const applySavedCache = useCallback((entry) => {
    if (!entry) return;

    setSavedOrders(entry.orders || []);
    setSyncInfo({
      fetchedAt: entry.fetchedAt,
      fetchedAtLabel: formatFetchedAt(entry.fetchedAt),
      savedLocally: true,
      cachedCount: entry.count ?? (entry.orders?.length || 0),
      accountLabel: entry.useDemoData
        ? 'tryb demo'
        : entry.account
          ? `${entry.account}.sellasist.pl`
          : '',
    });
  }, []);

  const loadSavedFromCache = useCallback(() => {
    if (!isConfigured || !activeAccountId) return;

    const cached = readOrdersCache(activeAccountId, config);
    if (cached) {
      applySavedCache(cached);
      setApiRaw(cached.raw ?? cached.orders ?? null);
      setApiMeta(cached.meta ?? null);
      setActiveSource('saved');
      return;
    }

    setSavedOrders([]);
    setSyncInfo({
      fetchedAt: null,
      fetchedAtLabel: 'Brak zapisu w bazie',
      savedLocally: false,
      cachedCount: 0,
      accountLabel: '',
    });
  }, [activeAccountId, applySavedCache, config, isConfigured]);

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
      const scopeKey = buildOrdersScopeKey(activeAccountId, config);

      if (nextOrders.length === 0) {
        await clearOrdersFromServerDb(scopeKey);
        setServerMeta({
          fetchedAt: null,
          fetchedAtLabel: 'Brak zapisu na serwerze',
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
    [activeAccountId, buildServerPayload, config]
  );

  const loadServerOrders = useCallback(async () => {
    if (!isConfigured || !activeAccountId) return;
    try {
      const scopeKey = buildOrdersScopeKey(activeAccountId, config);
      const entry = await getOrdersFromServerDb(scopeKey);
      setServerOrders(Array.isArray(entry?.orders) ? entry.orders : []);
      setServerMeta({
        fetchedAt: entry?.fetchedAt || null,
        fetchedAtLabel: entry?.fetchedAt
          ? formatFetchedAt(entry.fetchedAt)
          : 'Brak zapisu na serwerze',
      });
      setServerSyncError('');
    } catch (err) {
      setServerOrders([]);
      setServerSyncError(err?.message || 'Nie udało się odczytać bazy serwerowej.');
    }
  }, [activeAccountId, config, isConfigured]);

  useEffect(() => {
    if (!accountReady || !configLoaded) return;

    setBufferOrders([]);
    setBufferMeta({ fetchedAt: null, fetchedAtLabel: 'Bufor pusty' });
    setSelectedIds([]);
    setFilters(EMPTY_FILTERS);
    setError('');
    loadSavedFromCache();
    loadServerOrders();
  }, [accountReady, configLoaded, activeAccountId, config, loadSavedFromCache]);

  const updateSavedOrders = useCallback(
    (nextOrders) => {
      if (!activeAccountId) return;

      setSavedOrders(nextOrders);

      if (nextOrders.length === 0) {
        clearOrdersCache(activeAccountId, config);
        setSyncInfo({
          fetchedAt: null,
          fetchedAtLabel: 'Brak zapisu w bazie',
          savedLocally: false,
          cachedCount: 0,
          accountLabel: '',
        });
        return;
      }

      const saved = writeOrdersCache(activeAccountId, config, {
        orders: nextOrders,
        raw: nextOrders,
        meta: apiMeta,
      });
      if (saved) {
        applySavedCache(saved);
      }
    },
    [activeAccountId, apiMeta, applySavedCache, config]
  );

  const updateServerOrders = useCallback(
    async (nextOrders) => {
      if (!activeAccountId) return;
      setServerOrders(nextOrders);
      try {
        await persistServerOrders(nextOrders);
      } catch (err) {
        setServerSyncError(err?.message || 'Nie udało się zapisać na serwerze.');
        throw err;
      }
    },
    [activeAccountId, persistServerOrders]
  );

  useEffect(() => {
    setSelectedIds([]);
  }, [activeSource]);

  const clearBuffer = useCallback(() => {
    setBufferOrders([]);
    setBufferMeta({
      fetchedAt: null,
      fetchedAtLabel: 'Bufor pusty',
    });
    setActiveSource((current) => (current === 'buffer' ? 'saved' : current));
  }, []);

  const clearDatabase = useCallback(() => {
    if (!activeAccountId) return;

    clearOrdersCache(activeAccountId, config);
    setSavedOrders([]);
    setSyncInfo({
      fetchedAt: null,
      fetchedAtLabel: 'Brak zapisu w bazie',
      savedLocally: false,
      cachedCount: 0,
      accountLabel: '',
    });
    setActiveSource((current) => {
      if (current === 'saved' && bufferOrders.length > 0) {
        return 'buffer';
      }
      return current;
    });
  }, [activeAccountId, bufferOrders.length, config]);

  const clearServerDatabase = useCallback(async () => {
    if (!activeAccountId) return;
    try {
      await persistServerOrders([]);
      setServerOrders([]);
      setActiveSource((current) => {
        if (current === 'server' && bufferOrders.length > 0) return 'buffer';
        if (current === 'server' && savedOrders.length > 0) return 'saved';
        return current;
      });
    } catch (err) {
      setServerSyncError(err?.message || 'Nie udało się wyczyścić bazy serwerowej.');
      throw err;
    }
  }, [activeAccountId, bufferOrders.length, persistServerOrders, savedOrders.length]);

  const moveSavedToBuffer = useCallback(() => {
    if (savedOrders.length === 0 || !activeAccountId) return;

    const fetchedAt = new Date().toISOString();
    const ordersCopy = [...savedOrders];

    setBufferOrders(ordersCopy);
    setBufferMeta({
      fetchedAt,
      fetchedAtLabel: formatFetchedAt(fetchedAt),
    });
    clearOrdersCache(activeAccountId, config);
    setSavedOrders([]);
    setSyncInfo({
      fetchedAt: null,
      fetchedAtLabel: 'Brak zapisu w bazie',
      savedLocally: false,
      cachedCount: 0,
      accountLabel: '',
    });
    setApiRaw(ordersCopy);
    setActiveSource('buffer');
  }, [activeAccountId, config, savedOrders]);

  const moveBufferToSaved = useCallback(() => {
    if (bufferOrders.length === 0 || !activeAccountId) return;

    const payload = {
      orders: bufferOrders,
      raw: apiRaw ?? bufferOrders,
      meta: apiMeta,
    };
    const saved = writeOrdersCache(activeAccountId, config, payload);

    setSavedOrders(bufferOrders);
    if (saved) {
      applySavedCache(saved);
    }
    setBufferOrders([]);
    setBufferMeta({
      fetchedAt: null,
      fetchedAtLabel: 'Bufor pusty',
    });
    setActiveSource('saved');
  }, [activeAccountId, apiMeta, apiRaw, applySavedCache, bufferOrders, config]);

  const moveServerToBuffer = useCallback(() => {
    if (serverOrders.length === 0) return;
    const fetchedAt = new Date().toISOString();
    setBufferOrders([...serverOrders]);
    setBufferMeta({
      fetchedAt,
      fetchedAtLabel: formatFetchedAt(fetchedAt),
    });
    setApiRaw(serverOrders);
    setActiveSource('buffer');
  }, [serverOrders]);

  const moveBufferToServer = useCallback(async () => {
    if (!activeAccountId || bufferOrders.length === 0) return;
    await updateServerOrders(bufferOrders);
    setActiveSource('server');
  }, [activeAccountId, bufferOrders, updateServerOrders]);

  const moveSavedToServer = useCallback(async () => {
    if (!activeAccountId || savedOrders.length === 0) return;
    await updateServerOrders(savedOrders);
    setActiveSource('server');
  }, [activeAccountId, savedOrders, updateServerOrders]);

  const moveServerToSaved = useCallback(async () => {
    if (!activeAccountId || serverOrders.length === 0) return;

    const payload = {
      orders: serverOrders,
      raw: apiRaw ?? serverOrders,
      meta: apiMeta,
    };
    const saved = writeOrdersCache(activeAccountId, config, payload);

    setSavedOrders(serverOrders);
    if (saved) {
      applySavedCache(saved);
    }
    setActiveSource('saved');
  }, [activeAccountId, apiMeta, apiRaw, applySavedCache, config, serverOrders]);

  const removeFromSelection = useCallback((keys) => {
    const keySet = new Set(Array.isArray(keys) ? keys : [keys]);
    setSelectedIds((prev) => prev.filter((id) => !keySet.has(id)));
  }, []);

  const deleteOrderKeys = useCallback(
    (keys) => {
      const keySet = new Set(Array.isArray(keys) ? keys : [keys]);
      if (keySet.size === 0) return;

      if (activeSource === 'saved') {
        updateSavedOrders(excludeOrdersByKeys(savedOrders, keySet));
      }

      if (activeSource === 'buffer') {
        setBufferOrders((current) => excludeOrdersByKeys(current, keySet));
      }

      if (activeSource === 'server') {
        updateServerOrders(excludeOrdersByKeys(serverOrders, keySet));
      }

      removeFromSelection([...keySet]);
    },
    [activeSource, removeFromSelection, savedOrders, updateSavedOrders]
  );

  const moveSelectedToSaved = useCallback(() => {
    const keySet = new Set(selectedIds);
    const selected = pickOrdersByKeys(orders, keySet);
    if (selected.length === 0) return;

    const nextSaved = mergeOrders(savedOrders, selected);
    updateSavedOrders(nextSaved);

    if (activeSource === 'buffer') {
      setBufferOrders((current) => excludeOrdersByKeys(current, keySet));
    }

    if (activeSource === 'server') {
      updateServerOrders(excludeOrdersByKeys(serverOrders, keySet));
    }

    setSelectedIds([]);
    setActiveSource('saved');
  }, [activeSource, orders, savedOrders, selectedIds, updateSavedOrders]);

  const moveSelectedToBuffer = useCallback(() => {
    const keySet = new Set(selectedIds);
    const selected = pickOrdersByKeys(orders, keySet);
    if (selected.length === 0) return;

    const fetchedAt = new Date().toISOString();
    setBufferOrders((current) => mergeOrders(current, selected));
    setBufferMeta({
      fetchedAt,
      fetchedAtLabel: formatFetchedAt(fetchedAt),
    });

    if (activeSource === 'saved') {
      updateSavedOrders(excludeOrdersByKeys(savedOrders, keySet));
    }

    if (activeSource === 'server') {
      updateServerOrders(excludeOrdersByKeys(serverOrders, keySet));
    }

    setSelectedIds([]);
    setActiveSource('buffer');
  }, [activeSource, orders, savedOrders, selectedIds, updateSavedOrders]);

  const openBulkDownload = useCallback(() => {
    if (!isConfigured) return;

    setBulkModal({
      open: true,
      phase: 'setup',
      progress: INITIAL_PROGRESS,
      error: '',
      result: null,
      downloadScope: null,
    });
    setError('');
  }, [isConfigured]);

  const runBulkDownload = useCallback(
    async (downloadScope) => {
      if (!isConfigured) return;

      abortRef.current = new AbortController();
      const importStartedAt = new Date().toISOString();

      setBufferOrders([]);
      setBufferMeta({
        fetchedAt: importStartedAt,
        fetchedAtLabel: formatFetchedAt(importStartedAt),
      });
      setActiveSource('buffer');

      setBulkModal({
        open: true,
        phase: 'downloading',
        progress: INITIAL_PROGRESS,
        error: '',
        result: null,
        downloadScope,
      });
      setError('');

      logEvent({
        level: 'info',
        category: 'orders',
        action: 'orders.import.start',
        message: 'Rozpoczęto import zamówień z Sellasist',
        details: { downloadScope },
      });

      const appendBatchToBuffer = ({ orders, meta, apiRaw: batchApiRaw }) => {
        setBufferOrders(orders);
        setApiRaw(batchApiRaw ?? orders);
        if (meta) setApiMeta(meta);
        setBufferMeta({
          fetchedAt: importStartedAt,
          fetchedAtLabel: formatFetchedAt(importStartedAt),
        });
        setActiveSource('buffer');
      };

      try {
        const result = await downloadAllOrders(
          config,
          (params) =>
            fetchSellasistOrders(config, params, { signal: abortRef.current.signal }),
          {
            signal: abortRef.current.signal,
            downloadScope,
            onBatch: appendBatchToBuffer,
            onProgress: (progress) => {
              setBulkModal((current) => ({
                ...current,
                progress,
              }));
            },
          }
        );

        setBulkModal((current) => ({
          ...current,
          phase: 'confirm',
          result,
          downloadScope,
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
          message: `Import zakończony: ${result.orders?.length || 0} zamówień`,
          details: {
            downloadScope,
            count: result.orders?.length || 0,
            packages: result.packages,
          },
        });
      } catch (err) {
        if (abortRef.current?.signal.aborted) {
          logEvent({
            level: 'warn',
            category: 'orders',
            action: 'orders.import.cancelled',
            message: 'Import zamówień anulowany',
            details: { downloadScope },
          });
          return;
        }

        logEvent({
          level: 'error',
          category: 'orders',
          action: 'orders.import.error',
          message: 'Błąd importu zamówień',
          details: { downloadScope, error: err.message },
        });

        setBulkModal((current) => ({
          ...current,
          phase: 'error',
          error: `${err.message || 'Nie udało się pobrać zamówień.'} Pobrane do tej pory zamówienia są w buforze.`,
        }));
      }
    },
    [config, isConfigured]
  );

  const cancelBulkDownload = useCallback(() => {
    abortRef.current?.abort();
    setBulkModal({
      open: false,
      phase: 'idle',
      progress: INITIAL_PROGRESS,
      error: '',
      result: null,
      downloadScope: null,
    });
  }, []);

  const closeBulkModal = useCallback(() => {
    setBulkModal({
      open: false,
      phase: 'idle',
      progress: INITIAL_PROGRESS,
      error: '',
      result: null,
      downloadScope: null,
    });
  }, []);

  const handleBulkSaveToDb = useCallback(() => {
    const result = bulkModal.result;
    if (!result) return;

    const payload = {
      orders: result.orders,
      raw: result.raw,
      meta: result.meta ?? apiMeta,
    };
    const saved = writeOrdersCache(activeAccountId, config, payload);

    setSavedOrders(result.orders);
    setApiRaw(result.raw);
    setApiMeta(result.meta ?? apiMeta);
    if (saved) {
      applySavedCache(saved);
    }
    setActiveSource('saved');
    closeBulkModal();
    logEvent({
      level: 'info',
      category: 'orders',
      action: 'orders.save.local',
      message: `Zapisano ${result.orders.length} zamówień w bazie lokalnej`,
      details: { count: result.orders.length },
    });
  }, [activeAccountId, apiMeta, applySavedCache, bulkModal.result, closeBulkModal, config]);

  const handleBulkBufferOnly = useCallback(() => {
    closeBulkModal();
    setActiveSource('buffer');
  }, [closeBulkModal]);

  const handleBulkSaveToServerDb = useCallback(async () => {
    const result = bulkModal.result;
    if (!result || !activeAccountId) return;
    try {
      await updateServerOrders(result.orders);
      setApiRaw(result.raw);
      setApiMeta(result.meta ?? apiMeta);
      setActiveSource('server');
      closeBulkModal();
      logEvent({
        level: 'info',
        category: 'orders',
        action: 'orders.save.server',
        message: `Zapisano ${result.orders.length} zamówień na serwerze`,
        details: { count: result.orders.length },
      });
    } catch (err) {
      setBulkModal((prev) => ({
        ...prev,
        phase: 'error',
        error: err?.message || 'Nie udało się zapisać zamówień na serwerze.',
      }));
    }
  }, [activeAccountId, apiMeta, bulkModal.result, closeBulkModal, updateServerOrders]);

  const handleBulkSaveBoth = useCallback(() => {
    const result = bulkModal.result;
    if (!result) return;

    const fetchedAt = new Date().toISOString();
    const payload = {
      orders: result.orders,
      raw: result.raw,
      meta: result.meta ?? apiMeta,
    };
    const saved = writeOrdersCache(activeAccountId, config, payload);

    setSavedOrders(result.orders);
    setBufferOrders(result.orders);
    setBufferMeta({
      fetchedAt,
      fetchedAtLabel: formatFetchedAt(fetchedAt),
    });
    setApiRaw(result.raw);
    setApiMeta(result.meta ?? apiMeta);
    if (saved) {
      applySavedCache(saved);
    }
    setActiveSource('saved');
    closeBulkModal();
  }, [activeAccountId, apiMeta, applySavedCache, bulkModal.result, closeBulkModal, config]);

  const statuses = useMemo(() => getUniqueOrderStatuses(orders), [orders]);
  const filteredOrders = useMemo(
    () => filterOrders(orders, filters),
    [orders, filters]
  );

  const ordersTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize) || 1),
    [filteredOrders.length, ordersPageSize]
  );

  const safeOrdersPage = Math.min(Math.max(ordersPage, 1), ordersTotalPages);

  const paginatedOrders = useMemo(() => {
    const start = (safeOrdersPage - 1) * ordersPageSize;
    return filteredOrders.slice(start, start + ordersPageSize);
  }, [filteredOrders, ordersPageSize, safeOrdersPage]);

  useEffect(() => {
    setOrdersPage(1);
  }, [filters, activeSource, ordersPageSize]);

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
    (scope) => {
      let toExport = [];

      if (scope === 'visible') {
        toExport = filteredOrders;
      }

      if (scope === 'selected') {
        toExport = selectedOrders;
      }

      if (scope === 'all') {
        toExport = orders;
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
    [filteredOrders, orders, selectedOrders]
  );

  const exportCounts = useMemo(
    () => ({
      visible: filteredOrders.length,
      selected: selectedOrders.length,
      all: orders.length,
    }),
    [filteredOrders.length, orders.length, selectedOrders.length]
  );

  const exportSourceLabel =
    activeSource === 'saved'
      ? 'Baza lokalna'
      : activeSource === 'server'
        ? 'Baza danych'
        : 'Bufor pobierania';

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
      savedCount: savedOrders.length,
      bufferCount: bufferOrders.length,
      serverCount: serverOrders.length,
      bufferFetchedAtLabel: bufferMeta.fetchedAtLabel,
      bufferHasData: bufferOrders.length > 0,
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
      serverHasData: serverOrders.length > 0,
      serverFetchedAtLabel: serverMeta.fetchedAtLabel,
      serverSyncError,
      bulkDownloading,
      bulkProgress: bulkDownloading ? bulkModal.progress : null,
      visibleTotal: orders.length,
      visibleFiltered: filteredOrders.length,
    }),
    [
      syncInfo,
      savedOrders.length,
      bufferOrders.length,
      serverOrders.length,
      serverMeta.fetchedAtLabel,
      serverSyncError,
      bufferMeta.fetchedAtLabel,
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
                  savedCount={savedOrders.length}
                  bufferCount={bufferOrders.length}
                  serverCount={serverOrders.length}
                  onChange={setActiveSource}
                />

                {activeSource === 'saved' && (
                  <p className="text-xs text-slate-500">
                    Widok: zapisana baza lokalna
                    {syncInfo.savedLocally && ` · ostatni zapis: ${syncInfo.fetchedAtLabel}`}
                  </p>
                )}
                {activeSource === 'buffer' && (
                  <p className="text-xs text-slate-500">
                    Widok: bufor sesji · ostatnie pobranie: {bufferMeta.fetchedAtLabel}
                  </p>
                )}
                {activeSource === 'server' && (
                  <p className="text-xs text-slate-500">
                    Widok: baza danych (serwer)
                    {serverOrders.length > 0 && ` · ostatni zapis: ${serverMeta.fetchedAtLabel}`}
                  </p>
                )}
                {serverSyncError && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                    Błąd bazy serwerowej: {serverSyncError}
                  </div>
                )}

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                    {error}
                  </div>
                )}

                {bulkDownloading && orders.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-12">Ładowanie zamówień…</p>
                )}

                {!bulkDownloading && orders.length === 0 && !error && (
                  <p className="text-sm text-slate-400 text-center py-12 rounded-3xl border border-dashed border-slate-200">
                    {activeSource === 'saved'
                      ? 'Baza lokalna jest pusta. Użyj „Pobierz z Sellasist” i zapisz dane.'
                      : activeSource === 'server'
                        ? 'Baza danych jest pusta. Użyj importu i zapisz na serwerze.'
                        : 'Bufor jest pusty. Użyj „Pobierz z Sellasist” i wybierz wyświetlenie w buforze.'}
                  </p>
                )}

                {!bulkDownloading && orders.length > 0 && filteredOrders.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-12 rounded-3xl border border-dashed border-slate-200 bg-white">
                    Brak wyników dla wybranych filtrów.
                    {hasActiveFilters(filters) && ' Wyczyść filtry w środkowej kolumnie.'}
                  </p>
                )}

                {filteredOrders.length > 0 && (
                  <OrdersSelectionBar
                    selectedCount={selectedIds.length}
                    visibleCount={visibleOrderKeys.length}
                    allVisibleSelected={allVisibleSelected}
                    activeSource={activeSource}
                    onToggleSelectAll={handleToggleSelectAll}
                    onDeleteSelected={() => deleteOrderKeys(selectedIds)}
                    onMoveSelectedToSaved={moveSelectedToSaved}
                    onMoveSelectedToBuffer={moveSelectedToBuffer}
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

                {filteredOrders.length > 0 && (
                  <OrdersPagination
                    page={safeOrdersPage}
                    pageSize={ordersPageSize}
                    totalItems={filteredOrders.length}
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
                  statuses={statuses}
                  onResetFilters={() => setFilters(EMPTY_FILTERS)}
                  filteredCount={filteredOrders.length}
                  totalCount={orders.length}
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
        resultCount={bulkModal.result?.orders?.length || 0}
        downloadScope={bulkModal.downloadScope}
        onStartDownload={runBulkDownload}
        onCancel={cancelBulkDownload}
        onSaveToDb={handleBulkSaveToDb}
        onSaveToServerDb={handleBulkSaveToServerDb}
        onBufferOnly={handleBulkBufferOnly}
        onSaveToBoth={handleBulkSaveBoth}
        onClose={closeBulkModal}
      />

      <OrdersManageModal
        open={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        actions={{
          moveLocalToBuffer: moveSavedToBuffer,
          moveLocalToBufferDisabled: bulkDownloading || savedOrders.length === 0,
          moveBufferToLocal: moveBufferToSaved,
          moveBufferToLocalDisabled: bulkDownloading || bufferOrders.length === 0,
          moveServerToBuffer,
          moveServerToBufferDisabled: bulkDownloading || serverOrders.length === 0,
          moveBufferToServer,
          moveBufferToServerDisabled: bulkDownloading || bufferOrders.length === 0,
          moveLocalToServer: moveSavedToServer,
          moveLocalToServerDisabled: bulkDownloading || savedOrders.length === 0,
          moveServerToLocal: moveServerToSaved,
          moveServerToLocalDisabled: bulkDownloading || serverOrders.length === 0,
          clearBuffer,
          clearBufferDisabled: bufferOrders.length === 0,
          clearLocal: clearDatabase,
          clearLocalDisabled: savedOrders.length === 0 && !syncInfo.savedLocally,
          clearServer: clearServerDatabase,
          clearServerDisabled: serverOrders.length === 0,
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

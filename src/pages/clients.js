import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientCard } from '../components/ClientCard';
import { ClientsActionsPanel } from '../components/ClientsActionsPanel';
import { ClientsFetchModal } from '../components/ClientsFetchModal';
import { ClientsFilters } from '../components/ClientsFilters';
import { ClientsManageModal } from '../components/ClientsManageModal';
import { ClientsSourceToggle } from '../components/ClientsSourceToggle';
import { DemoModeHint } from '../components/DemoModeHint';
import { IconCog } from '../components/Icons';
import {
  BackToPanelLink,
  PageShell,
  RequireAuth,
  headerBtnPrimary,
} from '../components/Layout';
import { OrdersPagination } from '../components/OrdersPagination';
import { SellasistConfigModal } from '../components/SellasistConfigModal';
import { useAccessAccount } from '../context/AccessAccountContext';
import { formatFetchedAt } from '../data/ordersLocalDb';
import { getAccessAccountDisplayName } from '../data/accessAccounts';
import { useClientsLocalStore } from '../hooks/useClientsLocalStore';
import {
  appendClientsToServerDb,
  clearClientsFromServerDb,
  deleteClientsFromServerDb,
  getClientsFromServerDb,
  resolveClientsScopeFromDb,
  setClientsToServerDb,
} from '../hooks/useAppDbApi';
import { useSellasistConfig } from '../hooks/useSellasistConfig';
import { fetchSellasistClients } from '../hooks/useSellasistClientsApi';
import { downloadAllClients } from '../utils/bulkClientDownload';
import { EMPTY_CLIENT_FILTERS, filterClients, hasActiveClientFilters } from '../utils/filterClients';
import { DEFAULT_CLIENT_SORT } from '../utils/sortClients';

const CLIENTS_PAGE_SIZES = [10, 25, 50, 100];
const INITIAL_PROGRESS = { packageNum: 0, fetchedTotal: 0, progressPercent: 0 };

function getConfigHint(config) {
  if (config?.useDemoData) return 'demo';
  return (config?.account || '').trim().toLowerCase();
}

function ClientsView() {
  const { activeAccount, activeAccountId, ready: accountReady } = useAccessAccount();
  const { config, isConfigured, isDemoMode, loaded: configLoaded } = useSellasistConfig();
  const [activeSource, setActiveSource] = useState('local');
  const [filters, setFilters] = useState(EMPTY_CLIENT_FILTERS);
  const [clientSort, setClientSort] = useState(DEFAULT_CLIENT_SORT);
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsPageSize, setClientsPageSize] = useState(25);
  const [serverClients, setServerClients] = useState([]);
  const [serverClientsTotal, setServerClientsTotal] = useState(0);
  const [serverClientsLoading, setServerClientsLoading] = useState(false);
  const [serverSyncError, setServerSyncError] = useState('');
  const [serverMeta, setServerMeta] = useState({
    fetchedAt: null,
    fetchedAtLabel: 'Brak zapisu w bazie danych',
  });
  const [error, setError] = useState('');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [fetchModal, setFetchModal] = useState({
    open: false,
    phase: 'idle',
    progress: INITIAL_PROGRESS,
    error: '',
    resultCount: 0,
  });

  const abortRef = useRef(null);

  const {
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
  } = useClientsLocalStore({
    activeAccountId,
    config,
    isConfigured,
    isDemoMode,
    filters,
    clientSort,
    clientsPage,
    clientsPageSize,
  });

  const getServerScopeKey = useCallback(() => {
    if (!activeAccountId || !config) return null;
    return getScopeKey();
  }, [activeAccountId, config, getScopeKey]);

  const buildServerPayload = useCallback(
    (extra = {}) => ({
      accessAccountId: activeAccountId,
      account: config?.account || '',
      useDemoData: Boolean(config?.useDemoData),
      fetchedAt: new Date().toISOString(),
      ...extra,
    }),
    [activeAccountId, config?.account, config?.useDemoData]
  );

  const loadServerClientsPage = useCallback(
    async (page, size, scopeKeyOverride = null) => {
      const scopeKey = scopeKeyOverride || getServerScopeKey();
      if (!scopeKey) {
        setServerClients([]);
        setServerClientsTotal(0);
        return 0;
      }

      setServerClientsLoading(true);
      setServerSyncError('');

      try {
        const offset = (Math.max(1, page) - 1) * size;
        const entry = await getClientsFromServerDb(scopeKey, {
          offset,
          limit: size,
          sort: clientSort,
        });

        if (!entry) {
          setServerClients([]);
          setServerClientsTotal(0);
          return 0;
        }

        setServerClients(filterClients(entry.clients || [], filters));
        setServerClientsTotal(Number(entry.total) || 0);
        setServerMeta({
          fetchedAt: entry.fetchedAt || null,
          fetchedAtLabel: entry.fetchedAt
            ? formatFetchedAt(entry.fetchedAt)
            : 'Brak zapisu w bazie danych',
        });
        return Number(entry.total) || 0;
      } catch (err) {
        setServerSyncError(err?.message || 'Nie udało się wczytać klientów z bazy.');
        setServerClients([]);
        return 0;
      } finally {
        setServerClientsLoading(false);
      }
    },
    [clientSort, filters, getServerScopeKey]
  );

  const resolveServerScope = useCallback(async () => {
    if (!activeAccountId || !isConfigured) {
      setServerClientsTotal(0);
      return null;
    }

    const hint = getConfigHint(config);
    const resolved = await resolveClientsScopeFromDb(activeAccountId, hint);
    if (resolved?.scopeKey) {
      setServerClientsTotal(Number(resolved.total) || 0);
      setServerMeta({
        fetchedAt: resolved.fetchedAt || null,
        fetchedAtLabel: resolved.fetchedAt
          ? formatFetchedAt(resolved.fetchedAt)
          : 'Brak zapisu w bazie danych',
      });
    }
    return resolved;
  }, [activeAccountId, config, isConfigured]);

  useEffect(() => {
    if (!accountReady || !configLoaded || !isConfigured) {
      return;
    }
    hydrateLocalStore();
    resolveServerScope();
  }, [accountReady, configLoaded, hydrateLocalStore, isConfigured, resolveServerScope]);

  useEffect(() => {
    if (activeSource !== 'server' || !isConfigured) {
      return;
    }
    loadServerClientsPage(clientsPage, clientsPageSize);
  }, [activeSource, clientsPage, clientsPageSize, clientSort, filters, isConfigured, loadServerClientsPage]);

  useEffect(() => {
    setClientsPage(1);
  }, [filters, activeSource, clientsPageSize, clientSort]);

  const clientsTotalPages = useMemo(() => {
    const total = activeSource === 'server' ? serverClientsTotal : localClientsTotal;
    return Math.max(1, Math.ceil(total / clientsPageSize) || 1);
  }, [activeSource, clientsPageSize, localClientsTotal, serverClientsTotal]);

  const safeClientsPage = Math.min(Math.max(clientsPage, 1), clientsTotalPages);
  const paginationTotalItems =
    activeSource === 'server' ? serverClientsTotal : localClientsTotal;

  useEffect(() => {
    if (clientsPage !== safeClientsPage) {
      setClientsPage(safeClientsPage);
    }
  }, [clientsPage, safeClientsPage]);

  const paginatedClients = activeSource === 'server' ? serverClients : localClients;
  const filteredCount =
    activeSource === 'server' ? paginatedClients.length : localClientsTotal;

  const handleDeleteClients = useCallback(
    async (keys) => {
      if (!keys?.length) return;
      setError('');

      try {
        if (activeSource === 'local') {
          await deleteLocalKeys(keys);
        } else {
          const scopeKey = getServerScopeKey();
          if (!scopeKey) return;
          await deleteClientsFromServerDb(scopeKey, keys);
          await loadServerClientsPage(safeClientsPage, clientsPageSize);
          await resolveServerScope();
        }
      } catch (err) {
        setError(err?.message || 'Nie udało się usunąć klientów.');
      }
    },
    [
      activeSource,
      clientsPageSize,
      deleteLocalKeys,
      getServerScopeKey,
      loadServerClientsPage,
      resolveServerScope,
      safeClientsPage,
    ]
  );

  const handleClearLocal = useCallback(async () => {
    try {
      await clearLocal();
      setManageModalOpen(false);
      await loadLocalClientsPage(1, clientsPageSize);
    } catch (err) {
      setError(err?.message || 'Nie udało się wyczyścić bufora.');
    }
  }, [clearLocal, clientsPageSize, loadLocalClientsPage]);

  const handleClearServer = useCallback(async () => {
    const scopeKey = getServerScopeKey();
    if (!scopeKey) return;

    try {
      await clearClientsFromServerDb(scopeKey);
      setServerClients([]);
      setServerClientsTotal(0);
      setManageModalOpen(false);
      await resolveServerScope();
    } catch (err) {
      setError(err?.message || 'Nie udało się wyczyścić bazy klientów.');
    }
  }, [getServerScopeKey, resolveServerScope]);

  const runFetch = useCallback(
    async ({ destination }) => {
      if (!isConfigured) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const scopeKey = getScopeKey();
      if (!scopeKey) return;

      setFetchModal({
        open: true,
        phase: 'downloading',
        progress: INITIAL_PROGRESS,
        error: '',
        resultCount: 0,
      });
      setError('');

      let firstBatch = true;

      try {
        const result = await downloadAllClients({
          config,
          destination,
          signal: controller.signal,
          onProgress: (progress) => {
            setFetchModal((prev) => ({ ...prev, progress: { ...prev.progress, ...progress } }));
          },
          fetchPage: (params, options) => fetchSellasistClients(config, params, options),
          saveLocalBatch: async (batch, { replace } = {}) => {
            await appendLocalBatch(batch, {
              replace: replace || firstBatch,
              fetchedAt: new Date().toISOString(),
            });
            firstBatch = false;
            await loadLocalClientsPage(1, clientsPageSize, scopeKey);
          },
          saveServerBatch: async (batch) => {
            if (firstBatch) {
              await setClientsToServerDb(scopeKey, {
                ...buildServerPayload(),
                clients: batch,
              });
              firstBatch = false;
              return;
            }
            await appendClientsToServerDb(scopeKey, batch, buildServerPayload());
          },
        });

        await refreshLocalMeta();
        await resolveServerScope();
        if (destination === 'server' || destination === 'both') {
          await loadServerClientsPage(1, clientsPageSize, scopeKey);
        }

        setFetchModal((prev) => ({
          ...prev,
          phase: 'done',
          resultCount: result.fetchedTotal,
          progress: { ...prev.progress, packageNum: result.packageNum, fetchedTotal: result.fetchedTotal },
        }));
      } catch (err) {
        setFetchModal((prev) => ({
          ...prev,
          phase: 'error',
          error: err?.message || 'Import klientów nie powiódł się.',
        }));
      }
    },
    [
      appendLocalBatch,
      buildServerPayload,
      clientsPageSize,
      config,
      getScopeKey,
      isConfigured,
      loadLocalClientsPage,
      loadServerClientsPage,
      refreshLocalMeta,
      resolveServerScope,
    ]
  );

  const fetching = fetchModal.phase === 'downloading';

  return (
    <>
      <PageShell
        title="Klienci Sellasist"
        fullWidth
        headerActions={
          <button type="button" onClick={() => setConfigModalOpen(true)} className={headerBtnPrimary}>
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
                <strong>{getAccessAccountDisplayName(activeAccount)}</strong>. Zapisz dane API w
                konfiguracji, aby pobierać klientów z endpointu{' '}
                <code className="text-xs bg-amber-100 px-1 rounded">GET /users</code>.
              </p>
            </div>
          )}

          {accountReady && activeAccount && (
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px_260px] gap-6 items-start">
              <div className="space-y-4 min-w-0">
                <ClientsSourceToggle
                  activeSource={activeSource}
                  localCount={localClientsTotal}
                  serverCount={serverClientsTotal}
                  onChange={setActiveSource}
                />

                {activeSource === 'local' && (
                  <p className="text-xs text-slate-500">
                    Widok: bufor lokalny
                    {syncInfo.savedLocally && ` · ostatni zapis: ${syncInfo.fetchedAtLabel}`}
                    {localClientsTotal > 0 &&
                      ` · ${localClientsTotal} klientów, strona ${safeClientsPage}/${clientsTotalPages}`}
                  </p>
                )}
                {activeSource === 'server' && (
                  <p className="text-xs text-slate-500">
                    Widok: baza danych
                    {serverClientsTotal > 0 && ` · ostatni zapis: ${serverMeta.fetchedAtLabel}`}
                    {serverClientsTotal > 0 &&
                      ` · ${serverClientsTotal} klientów, strona ${safeClientsPage}/${clientsTotalPages}`}
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

                {((activeSource === 'server' && serverClientsLoading) ||
                  (activeSource === 'local' && localClientsLoading && !localCacheHydrated)) && (
                  <p className="text-sm text-slate-500 text-center py-12">Ładowanie klientów…</p>
                )}

                {!fetching &&
                  !(activeSource === 'server' && serverClientsLoading) &&
                  !(activeSource === 'local' && localClientsLoading) &&
                  paginatedClients.length === 0 &&
                  !(activeSource === 'server' && serverClientsTotal > 0) &&
                  !(activeSource === 'local' && localClientsTotal > 0) &&
                  !error && (
                    <p className="text-sm text-slate-400 text-center py-12 rounded-3xl border border-dashed border-slate-200">
                      {activeSource === 'local'
                        ? 'Bufor lokalny jest pusty. Użyj „Pobierz z Sellasist”.'
                        : 'Baza klientów jest pusta. Zaimportuj dane z API Sellasist.'}
                    </p>
                  )}

                {!fetching &&
                  paginatedClients.length === 0 &&
                  hasActiveClientFilters(filters) &&
                  (localClientsTotal > 0 || serverClientsTotal > 0) && (
                    <p className="text-sm text-slate-500 text-center py-12 rounded-3xl border border-dashed border-slate-200 bg-white">
                      Brak wyników dla wybranych filtrów.
                    </p>
                  )}

                <div className="space-y-3">
                  {paginatedClients.map((client) => (
                    <ClientCard
                      key={client.id || client.user_id || client.email}
                      client={client}
                      onDelete={handleDeleteClients}
                    />
                  ))}
                </div>

                {paginationTotalItems > 0 && (
                  <>
                    <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
                      <label htmlFor="clients-page-size">Na stronie:</label>
                      <select
                        id="clients-page-size"
                        value={clientsPageSize}
                        onChange={(e) => setClientsPageSize(Number(e.target.value))}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700"
                      >
                        {CLIENTS_PAGE_SIZES.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                    <OrdersPagination
                      page={safeClientsPage}
                      pageSize={clientsPageSize}
                      totalItems={paginationTotalItems}
                      onPageChange={setClientsPage}
                    />
                  </>
                )}
              </div>

              <div className="space-y-4 xl:sticky xl:top-6">
                <ClientsActionsPanel
                  onFetch={() =>
                    setFetchModal({
                      open: true,
                      phase: 'setup',
                      progress: INITIAL_PROGRESS,
                      error: '',
                      resultCount: 0,
                    })
                  }
                  onManage={() => setManageModalOpen(true)}
                  fetchDisabled={fetching || !isConfigured}
                />
              </div>

              <div className="space-y-4 xl:sticky xl:top-6">
                <ClientsFilters
                  filters={filters}
                  onChange={setFilters}
                  clientSort={clientSort}
                  onSortChange={setClientSort}
                  onResetFilters={() => setFilters(EMPTY_CLIENT_FILTERS)}
                  filteredCount={filteredCount}
                  totalCount={
                    activeSource === 'server' ? serverClientsTotal : localClientsTotal
                  }
                />

                <div className="rounded-3xl border border-slate-200 bg-white p-4 text-xs text-slate-500 leading-relaxed">
                  <p>
                    <strong>API:</strong>{' '}
                    <a
                      href="https://api.sellasist.pl/#/Klienci/get_users"
                      className="text-sky-700 underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      GET /users
                    </a>{' '}
                    (offset, limit)
                  </p>
                  <p className="mt-2">
                    Strona na paczki: {CLIENTS_PAGE_SIZES.join(', ')} — zmiana rozmiaru strony w
                    paginacji listy.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </PageShell>

      <ClientsFetchModal
        open={fetchModal.open}
        phase={fetchModal.phase}
        progress={fetchModal.progress}
        error={fetchModal.error}
        resultCount={fetchModal.resultCount}
        onClose={() => {
          if (fetchModal.phase === 'downloading') return;
          setFetchModal((prev) => ({ ...prev, open: false, phase: 'idle' }));
        }}
        onStart={runFetch}
      />

      <ClientsManageModal
        open={manageModalOpen}
        activeSource={activeSource}
        localCount={localClientsTotal}
        serverCount={serverClientsTotal}
        onClose={() => setManageModalOpen(false)}
        onClearLocal={handleClearLocal}
        onClearServer={handleClearServer}
      />

      <SellasistConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
    </>
  );
}

export default function ClientsPage() {
  return (
    <RequireAuth>
      <ClientsView />
    </RequireAuth>
  );
}

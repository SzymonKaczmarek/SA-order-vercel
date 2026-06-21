import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackToPanelLink, PageShell, RequireAuth } from '../components/Layout';
import { ClearLogModal } from '../components/ClearLogModal';
import { IconTrash } from '../components/Icons';
import { isDefaultAdminCredentials } from '../data/users';
import {
  LOG_CATEGORIES,
  LOG_LEVELS,
  clearAllEventLogs,
  fetchEventLogsFromServer,
  logEvent,
  mergeEventLogs,
  readLocalEventLogs,
  subscribeEventLog,
} from '../utils/eventLog';

const LEVEL_STYLES = {
  info: 'bg-sky-50 text-sky-800 border-sky-200',
  warn: 'bg-amber-50 text-amber-800 border-amber-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  system: 'bg-slate-100 text-slate-700 border-slate-200',
};

function formatTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('pl-PL');
}

function EventDetails({ details }) {
  if (!details || typeof details !== 'object') return null;

  return (
    <pre className="mt-2 text-[11px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}

function LogsView() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearError, setClearError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const local = readLocalEventLogs();
      let server = [];
      try {
        server = await fetchEventLogsFromServer();
      } catch (_e) {
        // zostajemy przy lokalnych wpisach
      }
      setEntries(mergeEventLogs(local, server));
    } catch (err) {
      setError(err.message || 'Nie udało się wczytać logów.');
      setEntries(readLocalEventLogs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return subscribeEventLog(() => {
      reload();
    });
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return entries.filter((entry) => {
      if (levelFilter !== 'all' && entry.level !== levelFilter) return false;
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (!q) return true;

      const haystack = [
        entry.message,
        entry.action,
        entry.username,
        entry.accessAccountName,
        entry.category,
        entry.level,
        JSON.stringify(entry.details || {}),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [categoryFilter, entries, levelFilter, search]);

  const handleClearRequest = async ({ username, password }) => {
    if (!(await isDefaultAdminCredentials(username, password))) {
      setClearError('Nieprawidłowy login lub hasło administratora.');
      logEvent({
        level: 'warn',
        category: 'system',
        action: 'logs.clear.denied',
        message: 'Odrzucono próbę wyczyszczenia dziennika',
        details: { username: String(username || '').trim() },
      });
      return;
    }

    setClearBusy(true);
    setClearError('');

    clearAllEventLogs({ adminUsername: username.trim(), adminPassword: password })
      .then(async () => {
        setEntries([]);
        setClearModalOpen(false);
        await logEvent({
          level: 'warn',
          category: 'system',
          action: 'logs.clear',
          message: 'Wyczyszczono dziennik zdarzeń (administrator)',
          details: { username: username.trim() },
        });
        reload();
        setMessage('Dziennik zdarzeń wyczyszczony.');
      })
      .catch((err) => {
        setClearError(err.message || 'Nie udało się wyczyścić logów.');
      })
      .finally(() => {
        setClearBusy(false);
      });
  };

  return (
    <>
      <PageShell title="Dziennik zdarzeń">
        <div className="space-y-6 max-w-5xl">
          <BackToPanelLink />

          <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">Historia akcji</h2>
            <p className="text-sm text-slate-600">
              Rejestrowane są logowania, zmiany kont, konfiguracja, import i zapis zamówień, zapytania
              API oraz operacje bazy danych. Hasła i klucze API są ukrywane. Wyczyszczenie logu wymaga
              danych domyślnego konta administratora.
            </p>
          </section>

          <div className="rounded-3xl bg-white border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-end gap-3 justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-[240px]">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Poziom
                  </label>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Wszystkie</option>
                    {LOG_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Kategoria
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">Wszystkie</option>
                    {LOG_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Szukaj
                  </label>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="użytkownik, akcja, błąd…"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={reload}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50"
                >
                  Odśwież
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClearError('');
                    setClearModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-700 px-4 py-2 text-xs font-semibold hover:bg-red-50"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                  Wyczyść log
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Wyświetlane: <strong>{filtered.length}</strong> / {entries.length}
              {loading ? ' · ładowanie…' : ''}
            </p>
          </div>

          {message && (
            <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
              {message}
            </div>
          )}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <section className="space-y-3">
            {filtered.length === 0 && !loading && (
              <p className="text-sm text-slate-400 text-center py-12 rounded-3xl border border-dashed border-slate-200">
                Brak wpisów w dzienniku.
              </p>
            )}

            {filtered.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const levelStyle = LEVEL_STYLES[entry.level] || LEVEL_STYLES.info;

              return (
                <article
                  key={entry.id}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full text-left p-4 space-y-2 hover:bg-slate-50/80"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${levelStyle}`}
                      >
                        {entry.level}
                      </span>
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600">
                        {entry.category}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{entry.action}</span>
                      <span className="text-[11px] text-slate-400 ml-auto">{formatTs(entry.ts)}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{entry.message}</p>
                    <p className="text-xs text-slate-500">
                      {entry.username ? `użytkownik: ${entry.username}` : 'użytkownik: —'}
                      {entry.accessAccountName ? ` · konto: ${entry.accessAccountName}` : ''}
                    </p>
                  </button>

                  {isExpanded && entry.details && (
                    <div className="px-4 pb-4">
                      <EventDetails details={entry.details} />
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        </div>
      </PageShell>

      <ClearLogModal
        open={clearModalOpen}
        onClose={() => {
          if (!clearBusy) {
            setClearModalOpen(false);
            setClearError('');
          }
        }}
        onConfirm={handleClearRequest}
        busy={clearBusy}
        error={clearError}
      />
    </>
  );
}

export default function LogsPage() {
  return (
    <RequireAuth>
      <LogsView />
    </RequireAuth>
  );
}

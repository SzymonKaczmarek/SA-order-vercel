import React, { useEffect, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import {
  IconDownload,
  IconHourglass,
  IconX,
} from './Icons';
import { formatDownloadScopeSummary, parseDownloadScope } from '../utils/bulkOrderDownload';
import { formatBulkImportResumeSummary } from '../utils/bulkImportResume';
import { getContinueFromStoredPreview } from '../utils/storedOrderBounds';
import {
  getBulkImportHeadline,
  getBulkImportProgressRows,
} from '../utils/bulkImportProgressDisplay';
import { useSellasistConfig } from '../hooks/useSellasistConfig';
import { getImportLimitsFromConfig } from '../utils/sellasistImportLimits';

const IMPORT_DESTINATIONS = [
  {
    id: 'local',
    label: 'Bufor lokalny',
    desc: 'Zapis od razu w buforze lokalnym. Widok bufora po imporcie.',
  },
  {
    id: 'server',
    label: 'Baza danych',
    desc: 'Zapis od razu w bazie danych. Widok bazy po imporcie.',
  },
  {
    id: 'both',
    label: 'Bufor lokalny + baza danych',
    desc: 'Każda paczka trafia jednocześnie do bufora i bazy danych.',
  },
];

const DESTINATION_LABELS = {
  local: 'buforze lokalnym',
  server: 'bazie danych',
  both: 'buforze lokalnym i bazie danych',
};

function StatRow({ label, value, detail }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500 shrink-0">{label}</span>
      <div className="text-right min-w-0">
        <span className="font-semibold text-slate-800 block">{value}</span>
        {detail ? (
          <span className="text-[11px] text-slate-400 block mt-0.5 leading-snug">{detail}</span>
        ) : null}
      </div>
    </div>
  );
}

export function BulkDownloadModal({
  open,
  phase,
  progress,
  error,
  resultCount,
  downloadScope,
  importDestination = 'local',
  sellasistSummary = '',
  resumeInfo = null,
  storedOrderBounds = null,
  onCancel,
  onPause,
  onStartDownload,
  onResumeDownload,
  onDiscardResume,
  onClose,
}) {
  const { config } = useSellasistConfig();
  const importLimits = getImportLimitsFromConfig(config);
  const [scope, setScope] = useState('all');
  const [destination, setDestination] = useState('local');
  const [idFrom, setIdFrom] = useState('');
  const [idTo, setIdTo] = useState('');
  const [latestCount, setLatestCount] = useState('100');
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open || phase !== 'setup') return;
    setSetupError('');
    setDestination('local');
  }, [open, phase]);

  if (!open) return null;

  const isSetup = phase === 'setup';
  const isDownloading = phase === 'downloading';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  const handleStart = () => {
    const parsed = parseDownloadScope(scope, {
      idFrom,
      idTo,
      latestCount,
      destination,
      storedBounds: storedOrderBounds,
    });
    if (!parsed.ok) {
      setSetupError(parsed.error);
      return;
    }

    setSetupError('');
    onStartDownload({
      downloadScope: parsed.downloadScope,
      destination,
    });
  };

  const continuePreview =
    scope === 'continueFromStored' && storedOrderBounds
      ? getContinueFromStoredPreview(destination, storedOrderBounds)
      : null;

  const rangeSummary = formatDownloadScopeSummary(downloadScope);
  const savedWhere = DESTINATION_LABELS[importDestination] || DESTINATION_LABELS.local;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={isDownloading ? undefined : onClose}
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${isDownloading ? 'cursor-default' : ''}`}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl"
      >
        <div className="px-6 py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-900">Pobieranie z Sellasist</h2>
          {isSetup && (
            <p className="text-xs text-slate-500 mt-1">
              Wybierz gdzie zapisać dane i zakres pobierania przed startem importu.
            </p>
          )}
        </div>

        <div className="px-6 py-6 space-y-5">
          {isSetup && (
            <>
              {sellasistSummary && (
                <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-900">
                  Połączenie Sellasist: <strong>{sellasistSummary}</strong>
                  <p className="text-[11px] text-sky-800/80 mt-1 leading-relaxed">
                    Login do panelu SA Order Reader ≠ subdomena sklepu i klucz API Sellasist. Przed
                    importem sprawdź Konfiguracja API → „Testuj połączenie”.
                  </p>
                </div>
              )}

              {resumeInfo && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Przerwany import</p>
                    <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                      Import „Wszystkie” nie doszedł do końca (błąd sieci, API albo ręczne przerwanie).
                      Wznowienie dopina <strong>brakującą resztę tego samego importu</strong> — także
                      starsze zamówienia, których jeszcze nie ma — od ostatniej pobranej paczki.
                    </p>
                    <p className="text-xs text-amber-900/90 mt-2 font-medium">
                      {formatBulkImportResumeSummary(resumeInfo)}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onResumeDownload}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90"
                    >
                      <ButtonLabel icon={IconDownload}>Wznów pobieranie</ButtonLabel>
                    </button>
                    <button
                      type="button"
                      onClick={onDiscardResume}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-white text-amber-900 px-4 py-2.5 text-sm font-semibold hover:bg-amber-100/50"
                    >
                      Usuń wznowienie
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Gdzie zapisać pobrane zamówienia
                  </p>
                  {IMPORT_DESTINATIONS.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15"
                    >
                      <input
                        type="radio"
                        name="import-destination"
                        checked={destination === item.id}
                        onChange={() => setDestination(item.id)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                        <span className="block text-xs text-slate-500 mt-0.5">{item.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Zakres pobierania
                  </p>

                  <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15">
                  <input
                    type="radio"
                    name="download-scope"
                    checked={scope === 'all'}
                    onChange={() => setScope('all')}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      Wszystkie zamówienia
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Pełny import z API bez ograniczenia ID. Gdy urwie się w połowie — użyj u góry
                      okna <strong>„Wznów import”</strong> (dopina brakującą resztę, także starsze).
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15">
                  <input
                    type="radio"
                    name="download-scope"
                    checked={scope === 'latest'}
                    onChange={() => setScope('latest')}
                    className="mt-0.5"
                  />
                  <span className="flex-1 space-y-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Ostatnie X zamówień
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Najnowsze rekordy (offset 0, kolejne paczki w API Sellasist).
                      </span>
                    </span>

                    {scope === 'latest' && (
                      <div className="space-y-1">
                        <label
                          htmlFor="bulk-latest-count"
                          className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Liczba zamówień
                        </label>
                        <input
                          id="bulk-latest-count"
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          value={latestCount}
                          onChange={(e) => setLatestCount(e.target.value)}
                          placeholder="np. 100"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15">
                  <input
                    type="radio"
                    name="download-scope"
                    checked={scope === 'idRange'}
                    onChange={() => setScope('idRange')}
                    className="mt-0.5"
                  />
                  <span className="flex-1 space-y-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Zakres ID zamówień
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        ID od–do (włącznie). API używa parametru{' '}
                        <code className="text-[11px] bg-slate-100 px-1 rounded">from_id</code>.
                      </span>
                    </span>

                    {scope === 'idRange' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label
                            htmlFor="bulk-id-from"
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            ID od
                          </label>
                          <input
                            id="bulk-id-from"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={idFrom}
                            onChange={(e) => setIdFrom(e.target.value)}
                            placeholder="np. 1000"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label
                            htmlFor="bulk-id-to"
                            className="text-[10px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            ID do
                          </label>
                          <input
                            id="bulk-id-to"
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            value={idTo}
                            onChange={(e) => setIdTo(e.target.value)}
                            placeholder="np. 2500"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15">
                  <input
                    type="radio"
                    name="download-scope"
                    checked={scope === 'continueFromStored'}
                    onChange={() => setScope('continueFromStored')}
                    className="mt-0.5"
                  />
                  <span className="flex-1 space-y-2">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Dobij brakujące najnowsze (od ostatniego ID)
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Pobiera tylko <strong>nowe zamówienia, których jeszcze nie masz</strong> — od
                        kolejnego ID po najwyższym zapisanym rekordzie. Dokańczenie = dopięcie
                        najnowszych, nie wracanie do starszych luk. Nie czyści bufora ani bazy.
                      </span>
                    </span>

                    {scope === 'continueFromStored' && (
                      <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-900 leading-relaxed">
                        {storedOrderBounds?.loading ? (
                          'Sprawdzanie ostatniego zapisanego ID…'
                        ) : continuePreview?.ok ? (
                          <>
                            <strong>{continuePreview.preview}</strong>
                            <p className="mt-1 text-sky-800/80">
                              Tylko brakujące najnowsze (ID wyższe niż ostatni zapis). Starszych luk w
                              środku archiwum ta opcja nie uzupełnia.
                            </p>
                            <p className="mt-1 text-sky-800/80">
                              Bufor:{' '}
                              {storedOrderBounds?.localMin != null && storedOrderBounds?.localMax != null
                                ? `ID ${storedOrderBounds.localMin}–${storedOrderBounds.localMax}`
                                : 'brak danych'}
                              {' · '}
                              Baza:{' '}
                              {storedOrderBounds?.serverMin != null && storedOrderBounds?.serverMax != null
                                ? `ID ${storedOrderBounds.serverMin}–${storedOrderBounds.serverMax}`
                                : 'brak danych'}
                            </p>
                          </>
                        ) : (
                          continuePreview?.error ||
                          'Wybierz miejsce zapisu i upewnij się, że są już pobrane zamówienia.'
                        )}
                      </div>
                    )}
                  </span>
                </label>
                </div>
              </div>

              {setupError && (
                <div className="rounded-2xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
                  {setupError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 text-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90"
                >
                  <ButtonLabel icon={IconDownload}>Rozpocznij pobieranie</ButtonLabel>
                </button>
              </div>
            </>
          )}

          {isDownloading && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 space-y-1">
                <p>
                  Zakres: <strong>{rangeSummary}</strong>
                </p>
                <p>
                  Zapis:{' '}
                  <strong>
                    {importDestination === 'server' && 'baza danych'}
                    {importDestination === 'both' && 'bufor + baza danych'}
                    {importDestination !== 'server' && importDestination !== 'both' && 'bufor lokalny'}
                  </strong>
                </p>
              </div>

              <div className="flex items-center gap-4">
                <IconHourglass spinning className="w-10 h-10 text-brand-accent" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Trwa import zamówień…</p>
                  <p className="text-xs text-slate-500 mt-0.5">{getBulkImportHeadline(progress)}</p>
                </div>
              </div>

              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3">
                {getBulkImportProgressRows(progress, config).map((row) => (
                  <StatRow
                    key={row.id}
                    label={row.label}
                    value={row.value}
                    detail={row.detail}
                  />
                ))}
              </div>

              <p className="text-[11px] text-slate-500 leading-relaxed rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2">
                Limit bezpieczeństwa: maks.{' '}
                <strong>{importLimits.maxRequestsPerMinute} żądań API / minutę</strong> (limit
                Sellasist: 300/min). Paczka: <strong>{importLimits.pageSize} zamówień</strong>.
                Wartości z Konfiguracji Sellasist.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onPause}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-2.5 text-sm font-semibold hover:bg-amber-100/80"
                >
                  Przerwij pobieranie
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-100/80"
                >
                  <ButtonLabel icon={IconX}>Anuluj</ButtonLabel>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                <strong>Przerwij</strong> — zatrzymuje import i zostawia pobrane zamówienia (checkpoint
                do wznowienia). <strong>Anuluj</strong> — cofa cały bieżący import.
              </p>
            </>
          )}

          {isDone && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                Zakres: <strong>{rangeSummary}</strong>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900 space-y-2">
                <p>
                  Pobrano <strong>{resultCount}</strong> zamówień w{' '}
                  <strong>{progress.packageNum}</strong> paczkach.
                </p>
                <p>
                  Zapisano w: <strong>{savedWhere}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-3 text-sm font-semibold hover:opacity-90"
              >
                <ButtonLabel icon={IconX}>Zamknij</ButtonLabel>
              </button>
            </>
          )}

          {isError && (
            <>
              {resumeInfo && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Import można wznowić</p>
                    <p className="text-xs text-amber-900/80 mt-1 leading-relaxed">
                      {formatBulkImportResumeSummary(resumeInfo)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onResumeDownload}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-3 text-sm font-semibold hover:opacity-90"
                  >
                    <ButtonLabel icon={IconDownload}>Wznów import</ButtonLabel>
                  </button>
                </div>
              )}

              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                {error}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
              >
                <ButtonLabel icon={IconX}>Zamknij</ButtonLabel>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import {
  IconDatabase,
  IconDownload,
  IconEye,
  IconHourglass,
  IconLayers,
  IconX,
} from './Icons';
import { parseOrderIdRange } from '../utils/bulkOrderDownload';

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 text-right">{value}</span>
    </div>
  );
}

export function BulkDownloadModal({
  open,
  phase,
  progress,
  error,
  resultCount,
  idRange,
  onCancel,
  onStartDownload,
  onSaveToDb,
  onBufferOnly,
  onSaveToBoth,
  onClose,
}) {
  const [useIdRange, setUseIdRange] = useState(false);
  const [idFrom, setIdFrom] = useState('');
  const [idTo, setIdTo] = useState('');
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
  }, [open, phase]);

  if (!open) return null;

  const isSetup = phase === 'setup';
  const isDownloading = phase === 'downloading';
  const isConfirm = phase === 'confirm';
  const isError = phase === 'error';

  const handleStart = () => {
    const parsed = parseOrderIdRange(idFrom, idTo, { useRange: useIdRange });
    if (!parsed.ok) {
      setSetupError(parsed.error);
      return;
    }

    setSetupError('');
    onStartDownload(parsed.range);
  };

  const rangeSummary =
    idRange != null ? `ID ${idRange.from} – ${idRange.to}` : 'Wszystkie zamówienia';

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
        className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Pobieranie z Sellasist</h2>
          <p className="text-xs text-slate-500 mt-1">
            Limit bezpieczeństwa: maks. 150 żądań API / minutę (limit Sellasist: 300/min)
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          {isSetup && (
            <>
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Wybierz zakres zamówień do pobrania. Domyślnie pobierane są wszystkie dostępne
                  rekordy (paginacja po 50 – bezpieczniej przy limicie czasu Netlify).
                </p>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 cursor-pointer">
                  <input
                    type="radio"
                    name="download-scope"
                    checked={!useIdRange}
                    onChange={() => setUseIdRange(false)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      Wszystkie zamówienia
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5">
                      Pełny import z API bez ograniczenia ID.
                    </span>
                  </span>
                </label>

                <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15">
                  <input
                    type="radio"
                    name="download-scope"
                    checked={useIdRange}
                    onChange={() => setUseIdRange(true)}
                    className="mt-0.5"
                  />
                  <span className="flex-1 space-y-3">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900">
                        Zakres ID zamówień
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Pobierz zamówienia o ID od–do (włącznie). API Sellasist używa parametru{' '}
                        <code className="text-[11px] bg-slate-100 px-1 rounded">from_id</code>.
                      </span>
                    </span>

                    {useIdRange && (
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
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                Zakres: <strong>{rangeSummary}</strong>
              </div>

              <div className="flex items-center gap-4">
                <IconHourglass spinning className="w-10 h-10 text-brand-accent" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Trwa import zamówień…</p>
                  <p className="text-xs text-slate-500 mt-0.5">Paczka {progress.packageNum}</p>
                </div>
              </div>

              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>

              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2">
                <StatRow label="Aktualna paczka" value={`#${progress.packageNum}`} />
                <StatRow label="Pobrano łącznie" value={`${progress.fetchedTotal} zamówień`} />
                <StatRow label="W ostatniej paczce" value={progress.lastBatchSize} />
                <StatRow label="Pozostało paczek" value={progress.remainingPackages} />
                <StatRow label="Szac. pozostało zamówień" value={progress.remainingOrders} />
                <StatRow label="Przewidywany czas" value={progress.etaLabel} />
                <StatRow
                  label="Żądań w tej minucie"
                  value={`${progress.requestsThisMinute} / 150`}
                />
              </div>

              <button
                type="button"
                onClick={onCancel}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 text-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
              >
                <ButtonLabel icon={IconX}>Anuluj pobieranie</ButtonLabel>
              </button>
            </>
          )}

          {isConfirm && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600">
                Zakres: <strong>{rangeSummary}</strong>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900">
                Pobrano <strong>{resultCount}</strong> zamówień w{' '}
                <strong>{progress.packageNum}</strong> paczkach.
              </div>
              <p className="text-sm text-slate-600">Co zrobić z pobranymi danymi?</p>
              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={onSaveToDb}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-3 text-sm font-semibold hover:opacity-90"
                >
                  <ButtonLabel icon={IconDatabase}>Zapisz w bazie lokalnej</ButtonLabel>
                </button>
                <button
                  type="button"
                  onClick={onBufferOnly}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 px-4 py-3 text-sm font-semibold hover:bg-slate-50"
                >
                  <ButtonLabel icon={IconEye}>Tylko wyświetl w buforze</ButtonLabel>
                </button>
                <button
                  type="button"
                  onClick={onSaveToBoth}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-primary/30 bg-brand-primary/5 text-brand-primary px-4 py-3 text-sm font-semibold hover:bg-brand-primary/10"
                >
                  <ButtonLabel icon={IconLayers}>Zapisz w bazie i buforze</ButtonLabel>
                </button>
              </div>
            </>
          )}

          {isError && (
            <>
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">
                {error}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-3 text-sm font-semibold"
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

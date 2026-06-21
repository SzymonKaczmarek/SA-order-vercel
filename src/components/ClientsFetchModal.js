import React, { useEffect, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconDownload, IconHourglass, IconX } from './Icons';

const DESTINATIONS = [
  { id: 'local', label: 'Bufor lokalny', desc: 'Zapis w IndexedDB tej przeglądarki.' },
  { id: 'server', label: 'Baza danych', desc: 'Zapis w PostgreSQL (Neon).' },
  { id: 'both', label: 'Bufor + baza', desc: 'Każda paczka trafia do obu miejsc.' },
];

export function ClientsFetchModal({
  open,
  phase,
  progress,
  error,
  resultCount,
  onClose,
  onStart,
}) {
  const [destination, setDestination] = useState('local');

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const isSetup = phase === 'setup';
  const isDownloading = phase === 'downloading';
  const isDone = phase === 'done';
  const isError = phase === 'error';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={isDownloading ? undefined : onClose}
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm ${isDownloading ? 'cursor-default' : ''}`}
      />

      <div className="relative w-full max-w-2xl rounded-3xl bg-white border border-slate-200 shadow-2xl">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Pobieranie klientów z Sellasist</h2>
          <p className="text-xs text-slate-500 mt-1">
            Endpoint API: <code className="text-[11px] bg-slate-100 px-1 rounded">GET /users</code>{' '}
            (<a href="https://api.sellasist.pl/#/Klienci/get_users" className="text-sky-700 underline" target="_blank" rel="noreferrer">dokumentacja</a>)
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {isSetup && (
            <>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Gdzie zapisać
                </p>
                {DESTINATIONS.map((item) => (
                  <label
                    key={item.id}
                    className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 cursor-pointer has-[:checked]:border-brand-primary has-[:checked]:ring-2 has-[:checked]:ring-brand-primary/15"
                  >
                    <input
                      type="radio"
                      name="clients-destination"
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

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-slate-200 text-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
                >
                  Anuluj
                </button>
                <button
                  type="button"
                  onClick={() => onStart({ destination })}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90"
                >
                  <ButtonLabel icon={IconDownload}>Rozpocznij pobieranie</ButtonLabel>
                </button>
              </div>
            </>
          )}

          {isDownloading && (
            <>
              <div className="flex items-center gap-4">
                <IconHourglass spinning className="w-10 h-10 text-brand-accent" />
                <div>
                  <p className="text-sm font-semibold text-slate-800">Trwa import klientów…</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Paczka {progress.packageNum} · pobrano {progress.fetchedTotal}
                  </p>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-accent transition-all duration-500"
                  style={{ width: `${progress.progressPercent}%` }}
                />
              </div>
            </>
          )}

          {isDone && (
            <>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900">
                Pobrano <strong>{resultCount}</strong> klientów w <strong>{progress.packageNum}</strong> paczkach.
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-2xl bg-brand-primary text-white px-4 py-3 text-sm font-semibold hover:opacity-90"
              >
                Zamknij
              </button>
            </>
          )}

          {isError && (
            <>
              <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm text-red-700">{error}</div>
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

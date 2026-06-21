import React, { useEffect } from 'react';
import { IconDatabase, IconHourglass } from './Icons';

export function ServerOrdersLoadOverlay({
  phase,
  totalItems,
  localCount,
  missingCount,
  diffLoading,
  label,
  page,
  totalPages,
  itemFrom,
  itemTo,
  percent,
  loading,
  onLoadAll,
  onLoadMissing,
  onDecline,
}) {
  useEffect(() => {
    if (!phase) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (!phase) return null;

  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  const hasRange = totalItems > 0 && itemFrom > 0 && itemTo > 0;
  const isConfirm = phase === 'confirm';
  const missingReady = !diffLoading && missingCount != null;
  const canLoadMissing = missingReady && missingCount > 0;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="server-orders-load-title"
      aria-busy={loading ? 'true' : undefined}
    >
      <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" />

      <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <IconDatabase className="w-5 h-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 id="server-orders-load-title" className="text-sm font-semibold text-slate-900">
              {isConfirm ? 'Produkty w bazie serwerowej' : 'Pobieranie z bazy danych'}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {isConfirm ? (
                <>
                  W Neon jest{' '}
                  <span className="font-semibold text-slate-700">{totalItems}</span> produktów
                  {localCount > 0 && (
                    <>
                      {' '}
                      · lokalnie masz{' '}
                      <span className="font-semibold text-slate-700">{localCount}</span>
                    </>
                  )}
                  . Wybierz sposób ładowania.
                </>
              ) : (
                label
              )}
            </p>
          </div>
        </div>

        {isConfirm ? (
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onLoadAll}
              disabled={loading}
              className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left hover:bg-emerald-100/80 disabled:opacity-50 transition-colors"
            >
              <span className="block text-xs font-semibold text-emerald-900">
                Załaduj wszystkie z bazy
              </span>
              <span className="mt-0.5 block text-[11px] text-emerald-800/80 leading-relaxed">
                Pokaż pełną listę z Neon ({totalItems} produktów), z paginacją serwerową.
              </span>
            </button>

            <button
              type="button"
              onClick={onLoadMissing}
              disabled={loading || !canLoadMissing}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <span className="block text-xs font-semibold text-slate-900">
                Załaduj tylko brakujące (różnicówka)
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-500 leading-relaxed">
                {diffLoading && 'Liczenie różnic względem lokalnej bazy…'}
                {!diffLoading && missingCount === 0 && 'Lokalna baza zawiera już wszystkie produkty z Neon.'}
                {!diffLoading && missingCount > 0 &&
                  `Dopisz ${missingCount} nowych produktów do lokalnej bazy (bez nadpisywania istniejących).`}
                {!diffLoading && missingCount == null &&
                  'Nie udało się policzyć różnic — spróbuj ponownie.'}
              </span>
            </button>

            <button
              type="button"
              onClick={onDecline}
              disabled={loading}
              className="w-full rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Anuluj
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${safePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <IconHourglass className="w-3.5 h-3.5 shrink-0" />
                {hasRange
                  ? `Produkt ${itemFrom}${itemTo > itemFrom ? `–${itemTo}` : ''} z ${totalItems}`
                  : 'Przygotowywanie…'}
              </span>
              <span>{safePercent}%</span>
            </div>
            {totalPages > 1 && (
              <p className="text-[11px] text-center text-slate-400">
                Strona {page} z {totalPages}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

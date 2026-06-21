import React, { useEffect } from 'react';
import { IconDatabase, IconHourglass } from './Icons';

export function ServerOrdersLoadOverlay({
  phase,
  totalItems,
  label,
  page,
  totalPages,
  itemFrom,
  itemTo,
  percent,
  loading,
}) {
  useEffect(() => {
    if (phase !== 'loading') return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase !== 'loading') return null;

  const safePercent = Math.min(100, Math.max(0, Number(percent) || 0));
  const hasRange = totalItems > 0 && itemFrom > 0 && itemTo > 0;

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
              Pobieranie z bazy danych
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">{label}</p>
          </div>
        </div>

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
      </div>
    </div>
  );
}

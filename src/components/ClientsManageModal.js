import React from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconTrash, IconX } from './Icons';

export function ClientsManageModal({
  open,
  activeSource,
  localCount,
  serverCount,
  onClose,
  onClearLocal,
  onClearServer,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" aria-label="Zamknij" onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Zarządzaj klientami</h2>
            <p className="text-xs text-slate-500 mt-1">
              Bufor: {localCount} · baza: {serverCount}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={localCount === 0}
          onClick={onClearLocal}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          <ButtonLabel icon={IconTrash}>Wyczyść bufor lokalny</ButtonLabel>
        </button>

        <button
          type="button"
          disabled={serverCount === 0}
          onClick={onClearServer}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold disabled:opacity-50"
        >
          <ButtonLabel icon={IconTrash}>Wyczyść bazę danych</ButtonLabel>
        </button>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Aktywny widok: <strong>{activeSource === 'server' ? 'baza danych' : 'bufor lokalny'}</strong>.
          Czyszczenie nie usuwa danych z drugiego źródła.
        </p>
      </div>
    </div>
  );
}

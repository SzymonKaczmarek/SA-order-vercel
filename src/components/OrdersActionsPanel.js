import React from 'react';
import { ButtonLabel } from './ButtonLabel';
import {
  IconArrowRight,
  IconDatabase,
  IconDownload,
  IconFileExport,
  IconTrash,
} from './Icons';

const primaryBtnClass =
  'w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed';

const clearBtnClass =
  'w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed';

export function OrdersActionsPanel({
  onClearBuffer,
  onClearDatabase,
  onMoveSavedToBuffer,
  onMoveBufferToSaved,
  onBulkDownload,
  onExport,
  exportDisabled,
  bulkDisabled,
  clearBufferDisabled,
  clearDatabaseDisabled,
  moveSavedToBufferDisabled,
  moveBufferToSavedDisabled,
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 pb-1">
          Akcje
        </h2>
        <button
          type="button"
          onClick={onBulkDownload}
          disabled={bulkDisabled}
          className={`${primaryBtnClass} bg-brand-primary text-white hover:opacity-90`}
        >
          <ButtonLabel icon={IconDownload}>Pobierz z Sellasist</ButtonLabel>
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={exportDisabled}
          className={`${primaryBtnClass} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <ButtonLabel icon={IconFileExport}>Eksportuj (CSV)</ButtonLabel>
        </button>
        <button
          type="button"
          onClick={onMoveSavedToBuffer}
          disabled={moveSavedToBufferDisabled}
          className={`${clearBtnClass} border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
        >
          <ButtonLabel icon={IconArrowRight} iconClassName="w-3.5 h-3.5 shrink-0">
            Przenieś z bazy do bufora
          </ButtonLabel>
        </button>
        <button
          type="button"
          onClick={onMoveBufferToSaved}
          disabled={moveBufferToSavedDisabled}
          className={`${clearBtnClass} border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`}
        >
          <ButtonLabel icon={IconDatabase} iconClassName="w-3.5 h-3.5 shrink-0">
            Z bufora do bazy
          </ButtonLabel>
        </button>
        <button
          type="button"
          onClick={onClearBuffer}
          disabled={clearBufferDisabled}
          className={`${clearBtnClass} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
        >
          <ButtonLabel icon={IconTrash} iconClassName="w-3.5 h-3.5 shrink-0">
            Wyczyść bufor
          </ButtonLabel>
        </button>
        <button
          type="button"
          onClick={onClearDatabase}
          disabled={clearDatabaseDisabled}
          className={`${clearBtnClass} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
        >
          <ButtonLabel icon={IconDatabase} iconClassName="w-3.5 h-3.5 shrink-0">
            Wyczyść bazę
          </ButtonLabel>
        </button>
    </div>
  );
}

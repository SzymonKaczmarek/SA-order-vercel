import React from 'react';
import { ButtonLabel } from './ButtonLabel';
import {
  IconDatabase,
  IconDownload,
  IconFileExport,
} from './Icons';

const primaryBtnClass =
  'w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed';

const clearBtnClass =
  'w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed';

export function OrdersActionsPanel({
  onManageOrders,
  onBulkDownload,
  onExport,
  exportDisabled,
  bulkDisabled,
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
          onClick={onManageOrders}
          className={`${clearBtnClass} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
        >
          <ButtonLabel icon={IconDatabase} iconClassName="w-3.5 h-3.5 shrink-0">
            Zarządzaj zamówieniami
          </ButtonLabel>
        </button>
    </div>
  );
}

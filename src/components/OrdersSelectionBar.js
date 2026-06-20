import React from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconArrowRight, IconDatabase, IconTrash } from './Icons';

export const ORDERS_PAGE_SIZES = [5, 10, 25, 50, 100];

const btnClass =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed';

export function OrdersSelectionBar({
  selectedCount,
  visibleCount,
  allVisibleSelected,
  activeSource,
  onToggleSelectAll,
  onDeleteSelected,
  onMoveSelectedToSaved,
  onMoveSelectedToBuffer,
  pageSize,
  pageSizes = ORDERS_PAGE_SIZES,
  onPageSizeChange,
}) {
  const hasSelection = selectedCount > 0;
  const moveToSavedDisabled = !hasSelection || activeSource === 'saved';
  const moveToBufferDisabled = !hasSelection || activeSource === 'buffer';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={visibleCount > 0 && allVisibleSelected}
          disabled={visibleCount === 0}
          onChange={onToggleSelectAll}
          className="rounded border-slate-300 text-brand-primary focus:ring-brand-accent/30"
        />
        <span className="font-medium">
          {allVisibleSelected && visibleCount > 0 ? 'Odznacz widoczne' : 'Zaznacz widoczne'}
        </span>
      </label>

      {hasSelection && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {selectedCount} zazn.
        </span>
      )}

      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        className={`${btnClass} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
      >
        <ButtonLabel icon={IconTrash} iconClassName="w-3.5 h-3.5 shrink-0">
          Usuń zaznaczone
        </ButtonLabel>
      </button>
      <button
        type="button"
        onClick={onMoveSelectedToSaved}
        disabled={moveToSavedDisabled}
        className={`${btnClass} border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100`}
      >
        <ButtonLabel icon={IconDatabase} iconClassName="w-3.5 h-3.5 shrink-0">
          Do bazy
        </ButtonLabel>
      </button>
      <button
        type="button"
        onClick={onMoveSelectedToBuffer}
        disabled={moveToBufferDisabled}
        className={`${btnClass} border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}
      >
        <ButtonLabel icon={IconArrowRight} iconClassName="w-3.5 h-3.5 shrink-0">
          Do bufora
        </ButtonLabel>
      </button>

      <div className="flex flex-wrap items-center gap-2 ml-auto">
        <label htmlFor="orders-page-size" className="text-xs font-medium text-slate-500">
          Pokaż
        </label>
        <select
          id="orders-page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

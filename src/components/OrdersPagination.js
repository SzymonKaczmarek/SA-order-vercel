import React, { useMemo } from 'react';

const navBtnClass =
  'rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed';

const pageBtnClass =
  'min-w-[2rem] rounded-xl px-2 py-1.5 text-xs font-semibold transition-colors';

function buildPageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => ({ type: 'page', page: index + 1 }));
  }

  const pages = new Set([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];

  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) {
      items.push({ type: 'ellipsis', key: `gap-${sorted[index - 1]}` });
    }
    items.push({ type: 'page', page });
  });

  return items;
}

export function OrdersPagination({ page, pageSize, totalItems, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  if (totalItems === 0) return null;

  return (
    <nav
      aria-label="Paginacja listy zamówień"
      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 flex flex-wrap items-center justify-center gap-2"
    >
      <button
        type="button"
        onClick={() => onPageChange(safePage - 1)}
        disabled={safePage <= 1}
        className={navBtnClass}
      >
        Poprzednia
      </button>

      <div className="flex flex-wrap items-center justify-center gap-1">
        {pageItems.map((item) => {
          if (item.type === 'ellipsis') {
            return (
              <span
                key={`ellipsis-${item.key}`}
                className="px-1 text-xs font-semibold text-slate-400 select-none"
                aria-hidden
              >
                …
              </span>
            );
          }

          const isActive = item.page === safePage;

          return (
            <button
              key={`page-${item.page}`}
              type="button"
              onClick={() => onPageChange(item.page)}
              aria-current={isActive ? 'page' : undefined}
              className={`${pageBtnClass} ${
                isActive
                  ? 'bg-brand-primary text-white border border-brand-primary'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.page}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(safePage + 1)}
        disabled={safePage >= totalPages}
        className={navBtnClass}
      >
        Następna
      </button>

      <span className="w-full text-center text-[11px] text-slate-400 sm:w-auto sm:ml-2">
        Strona {safePage} z {totalPages}
      </span>
    </nav>
  );
}

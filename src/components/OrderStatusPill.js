import React from 'react';
import { getOrderStatusLabel, getOrderStatusStyles } from '../utils/orderFormat';

export function OrderStatusPill({ order, className = '' }) {
  const label = getOrderStatusLabel(order);
  const styles = getOrderStatusStyles(order);

  if (!label || label === '—') {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-dashed border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 ${className}`}
      >
        Brak statusu
      </span>
    );
  }

  return (
    <span
      title={`Status zamówienia: ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset shrink-0 ${styles} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label}
    </span>
  );
}

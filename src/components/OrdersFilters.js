import React from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconFilterOff } from './Icons';
import { ORDER_SORT_FIELDS, normalizeOrderSort } from '../utils/sortOrders';

function FilterField({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent';

export function OrdersFilters({
  filters,
  onChange,
  orderSort,
  onSortChange,
  statuses,
  onResetFilters,
  filteredCount,
  totalCount,
}) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const sort = normalizeOrderSort(orderSort);
  const setSortField = (field) => onSortChange({ ...sort, field });
  const setSortDirection = (direction) => onSortChange({ ...sort, direction });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Filtry
          </h2>
          <span className="text-xs text-slate-500">
            {filteredCount} / {totalCount}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <FilterField label="Sortuj po">
            <select
              value={sort.field}
              onChange={(e) => setSortField(e.target.value)}
              className={inputClass}
            >
              {ORDER_SORT_FIELDS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField label="Kierunek">
            <select
              value={sort.direction}
              onChange={(e) => setSortDirection(e.target.value)}
              className={inputClass}
            >
              <option value="desc">Malejąco</option>
              <option value="asc">Rosnąco</option>
            </select>
          </FilterField>
        </div>

        <FilterField label="Status">
          <select
            value={filters.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputClass}
          >
            <option value="">Wszystkie</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FilterField>

        <div className="grid grid-cols-2 gap-2">
          <FilterField label="ID zamówienia">
            <input
              type="text"
              inputMode="numeric"
              value={filters.orderId}
              onChange={(e) => set('orderId', e.target.value)}
              className={inputClass}
              placeholder="min. 3 znaki, np. 12345"
            />
          </FilterField>
          <FilterField label="Nazwisko">
            <input
              type="text"
              value={filters.surname}
              onChange={(e) => set('surname', e.target.value)}
              className={inputClass}
              placeholder="min. 3 znaki, np. Kowalski"
            />
          </FilterField>
        </div>

        <FilterField label="Symbol / EAN produktu">
          <input
            type="text"
            value={filters.productCode}
            onChange={(e) => set('productCode', e.target.value)}
            className={inputClass}
            placeholder="min. 3 znaki, np. SPOD-SZT lub 5063129001018"
          />
        </FilterField>

        <div className="grid grid-cols-2 gap-2">
          <FilterField label="Kwota od">
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.amountFrom}
              onChange={(e) => set('amountFrom', e.target.value)}
              className={inputClass}
              placeholder="0"
            />
          </FilterField>
          <FilterField label="Kwota do">
            <input
              type="number"
              min="0"
              step="0.01"
              value={filters.amountTo}
              onChange={(e) => set('amountTo', e.target.value)}
              className={inputClass}
              placeholder="9999"
            />
          </FilterField>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <FilterField label="Data od">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              className={inputClass}
            />
          </FilterField>
          <FilterField label="Data do">
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              className={inputClass}
            />
          </FilterField>
        </div>

        <FilterField label="E-mail">
          <input
            type="text"
            value={filters.email}
            onChange={(e) => set('email', e.target.value)}
            className={inputClass}
            placeholder="np. klient@example.com"
          />
        </FilterField>

        <FilterField label="Telefon">
          <input
            type="text"
            value={filters.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputClass}
            placeholder="np. 600123456"
          />
        </FilterField>

        <button
          type="button"
          onClick={onResetFilters}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 px-3 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-slate-100"
        >
          <ButtonLabel icon={IconFilterOff} iconClassName="w-3.5 h-3.5 shrink-0">
            Wyczyść filtry
          </ButtonLabel>
        </button>
    </div>
  );
}

import React from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconFilterOff } from './Icons';
import { CLIENT_SORT_FIELDS, normalizeClientSort } from '../utils/sortClients';

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

export function ClientsFilters({
  filters,
  onChange,
  clientSort,
  onSortChange,
  onResetFilters,
  filteredCount,
  totalCount,
}) {
  const set = (key, value) => onChange({ ...filters, [key]: value });
  const sort = normalizeClientSort(clientSort);
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
            {CLIENT_SORT_FIELDS.map((item) => (
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

      <div className="grid grid-cols-2 gap-2">
        <FilterField label="ID klienta">
          <input
            type="text"
            inputMode="numeric"
            value={filters.clientId}
            onChange={(e) => set('clientId', e.target.value)}
            className={inputClass}
            placeholder="min. 3 znaki"
          />
        </FilterField>
        <FilterField label="Nazwisko / firma">
          <input
            type="text"
            value={filters.surname}
            onChange={(e) => set('surname', e.target.value)}
            className={inputClass}
            placeholder="min. 3 znaki"
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

      <div className="grid grid-cols-2 gap-2">
        <FilterField label="Telefon">
          <input
            type="text"
            value={filters.phone}
            onChange={(e) => set('phone', e.target.value)}
            className={inputClass}
            placeholder="np. 600123456"
          />
        </FilterField>
        <FilterField label="Miasto">
          <input
            type="text"
            value={filters.city}
            onChange={(e) => set('city', e.target.value)}
            className={inputClass}
            placeholder="np. Warszawa"
          />
        </FilterField>
      </div>

      <FilterField label="NIP">
        <input
          type="text"
          value={filters.nip}
          onChange={(e) => set('nip', e.target.value)}
          className={inputClass}
          placeholder="np. 1234567890"
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

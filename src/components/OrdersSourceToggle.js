import React from 'react';
import { IconDatabase, IconLayers } from './Icons';

function buildSyncInfoMessage({ serverCount, localCount, missingInLocal }) {
  const base = `Baza danych: ${serverCount} · bufor: ${localCount}`;

  if (missingInLocal > 0) {
    return `${base} · w buforze brakuje ${missingInLocal} produktów z bazy danych.`;
  }

  if (localCount > 0) {
    return `${base} · bufor zawiera wszystkie produkty z bazy danych.`;
  }

  return `${base} · bufor jest pusty — w bazie danych są dane do załadowania.`;
}

function SourceSyncInfo({ summary }) {
  if (!summary) {
    return null;
  }

  const { serverCount, localCount, missingInLocal } = summary;
  const hasGap = missingInLocal > 0;

  return (
    <div
      role="status"
      className={`min-w-0 flex-1 rounded-2xl border px-3 py-2.5 text-[11px] leading-snug ${
        hasGap
          ? 'border-amber-200 bg-amber-50/90 text-amber-950'
          : 'border-slate-200 bg-slate-50/90 text-slate-700'
      }`}
    >
      <span className="inline-flex items-start gap-1.5">
        <IconLayers className="w-3.5 h-3.5 shrink-0 mt-0.5 opacity-70" />
        <span>{buildSyncInfoMessage({ serverCount, localCount, missingInLocal })}</span>
      </span>
    </div>
  );
}

export function OrdersSourceToggle({
  activeSource,
  localCount,
  serverCount,
  syncSummary,
  onChange,
}) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-2.5">
      <div className="flex flex-wrap gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onChange('server')}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition-colors ${
            activeSource === 'server'
              ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
          }`}
        >
          <IconDatabase className="w-4 h-4 shrink-0" />
          Baza danych
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeSource === 'server' ? 'bg-white/20' : 'bg-slate-100'
            }`}
          >
            {serverCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange('local')}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition-colors ${
            activeSource === 'local'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
          }`}
        >
          <IconDatabase className="w-4 h-4 shrink-0" />
          Bufor lokalny
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              activeSource === 'local' ? 'bg-white/20' : 'bg-slate-100'
            }`}
          >
            {localCount}
          </span>
        </button>
      </div>

      <SourceSyncInfo summary={syncSummary} />
    </div>
  );
}

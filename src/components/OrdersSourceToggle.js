import React from 'react';
import { IconDatabase, IconInbox } from './Icons';

export function OrdersSourceToggle({ activeSource, savedCount, bufferCount, serverCount, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
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
        Baza danych (serwer)
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
        onClick={() => onChange('saved')}
        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition-colors ${
          activeSource === 'saved'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
        }`}
      >
        <IconDatabase className="w-4 h-4 shrink-0" />
        Baza lokalna (localStorage)
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            activeSource === 'saved' ? 'bg-white/20' : 'bg-slate-100'
          }`}
        >
          {savedCount}
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange('buffer')}
        className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold border transition-colors ${
          activeSource === 'buffer'
            ? 'bg-brand-primary text-white border-brand-primary shadow-sm'
            : 'bg-white text-slate-600 border-slate-200 hover:border-brand-accent'
        }`}
      >
        <IconInbox className="w-4 h-4 shrink-0" />
        Bufor pobierania
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            activeSource === 'buffer' ? 'bg-white/20' : 'bg-slate-100'
          }`}
        >
          {bufferCount}
        </span>
      </button>
    </div>
  );
}

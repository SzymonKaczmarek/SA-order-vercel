import React from 'react';
import { IconDatabase } from './Icons';

export function ClientsSourceToggle({ activeSource, localCount, serverCount, onChange }) {
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
        Baza danych
        <span className={`text-xs px-2 py-0.5 rounded-full ${activeSource === 'server' ? 'bg-white/20' : 'bg-slate-100'}`}>
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
        <span className={`text-xs px-2 py-0.5 rounded-full ${activeSource === 'local' ? 'bg-white/20' : 'bg-slate-100'}`}>
          {localCount}
        </span>
      </button>
    </div>
  );
}

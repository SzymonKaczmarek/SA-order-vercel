import React, { useState } from 'react';

function MetaRow({ label, value, mono }) {
  if (!value) return null;

  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-xs">
      <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px] pt-0.5">
        {label}
      </span>
      <span className={`text-slate-300 break-all ${mono ? 'font-mono text-[11px]' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function ApiRawPanel({ payload, meta, loading }) {
  const [expanded, setExpanded] = useState(false);

  if (!meta && loading) return null;

  const sellasist = meta?.sellasist;
  const gateway = meta?.gateway;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-slate-600 bg-slate-900 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        className="w-full px-4 sm:px-6 py-3 flex items-center gap-3 text-left hover:bg-slate-800/90 transition-colors"
      >
        <svg
          className={`w-5 h-5 shrink-0 text-slate-400 transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
        </svg>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-100">Surowa odpowiedź API</p>
          {sellasist ? (
            <p className="text-[11px] text-slate-400 mt-0.5 truncate font-mono">
              {sellasist.method} {sellasist.url || sellasist.path}
              {sellasist.simulated ? ' (symulacja demo)' : ''}
            </p>
          ) : (
            <p className="text-[11px] text-slate-500 mt-0.5">
              {loading ? 'Oczekiwanie na odpowiedź…' : 'Brak metadanych żądania'}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700 max-h-[50vh] overflow-y-auto">
          {meta && (
            <div className="px-4 sm:px-6 py-4 bg-slate-800/50 border-b border-slate-700 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Szczegóły bramki
              </p>

              <div className="space-y-2">
                <MetaRow label="Proxy" value={`${gateway?.method} ${gateway?.path}`} mono />
                <MetaRow label="Opis proxy" value={gateway?.description} />
                <MetaRow
                  label="Sellasist"
                  value={`${sellasist?.method} ${sellasist?.path}`}
                  mono
                />
                <MetaRow label="URL" value={sellasist?.url} mono />
                <MetaRow
                  label="Nagłówki"
                  value={
                    sellasist?.headers
                      ? Object.entries(sellasist.headers)
                          .map(([key, val]) => `${key}: ${val}`)
                          .join(' · ')
                      : null
                  }
                  mono
                />
                <MetaRow
                  label="Query"
                  value={
                    sellasist?.queryParams && Object.keys(sellasist.queryParams).length
                      ? new URLSearchParams(
                          Object.entries(sellasist.queryParams).map(([k, v]) => [k, String(v)])
                        ).toString()
                      : '(brak)'
                  }
                  mono
                />
                {meta.documentation && (
                  <div className="grid grid-cols-[120px_1fr] gap-2 text-xs pt-1">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      Docs
                    </span>
                    <a
                      href={meta.documentation}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline font-mono text-[11px] break-all"
                    >
                      {meta.documentation}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <pre className="px-4 sm:px-6 py-4 text-xs text-emerald-300 font-mono leading-relaxed overflow-x-auto">
            {loading && payload == null
              ? '// Ładowanie…'
              : JSON.stringify(payload, null, 2) || 'Brak danych'}
          </pre>
        </div>
      )}
    </div>
  );
}

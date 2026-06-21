import React from 'react';

export function AccountsSyncPanel({
  localCount,
  serverAccountCount,
  serverHasData,
  serverSyncedAtLabel,
  serverSyncing,
  serverSyncError,
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        Synchronizacja kont
      </h2>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Baza serwerowa (Netlify)
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Status</span>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                serverHasData
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {serverSyncing ? 'Zapisywanie…' : serverHasData ? 'Zapisane' : 'Pusta'}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Kont na serwerze: <strong>{serverAccountCount}</strong>
          </p>
          <p className="text-xs text-slate-600">
            Ostatni zapis: <strong>{serverHasData ? serverSyncedAtLabel : '—'}</strong>
          </p>
          {serverSyncError && (
            <p className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {serverSyncError}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Baza lokalna (localStorage)
          </p>
          <p className="text-xs text-slate-600">
            Kont w przeglądarce: <strong>{localCount}</strong>
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Każda zmiana (utworzenie, edycja, usunięcie) jest od razu zapisywana na serwerze —
            tak samo jak zamówienia w „Zapisz na serwerze”.
          </p>
        </div>
      </div>
    </section>
  );
}

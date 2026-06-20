import React from 'react';

function SyncStatRow({ label, value, valueClassName = '' }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 text-xs min-w-0">
      <span className="text-slate-500 leading-snug">{label}</span>
      <span
        className={`text-slate-800 font-medium leading-snug [overflow-wrap:anywhere] ${valueClassName}`}
      >
        {value}
      </span>
    </div>
  );
}

function SyncSection({ title, accent, children }) {
  const accents = {
    emerald: 'border-emerald-100 bg-emerald-50/40',
    sky: 'border-sky-100 bg-sky-50/40',
    slate: 'border-slate-100 bg-slate-50/60',
    amber: 'border-amber-100 bg-amber-50/60',
  };

  return (
    <div className={`rounded-2xl border p-3 space-y-2 min-w-0 overflow-hidden ${accents[accent] || accents.slate}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function StatusPill({ active, label, tone = 'emerald' }) {
  const activeStyles = {
    emerald: 'bg-white text-emerald-700 border-emerald-200',
    sky: 'bg-white text-sky-700 border-sky-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
        active ? activeStyles[tone] : 'bg-white/70 text-slate-500 border-slate-200'
      }`}
    >
      {label}
    </span>
  );
}

export function SyncStatusPanel({ syncInfo }) {
  const {
    accountDisplay,
    storageScope,
    isDemoMode,
    activeSource,
    visibleTotal,
    visibleFiltered,
    savedCount,
    cachedCount,
    savedLocally,
    fetchedAtLabel,
    bufferCount,
    bufferFetchedAtLabel,
    bufferHasData,
    serverCount,
    serverHasData,
    serverFetchedAtLabel,
    serverSyncError,
    bulkDownloading,
    bulkProgress,
  } = syncInfo;

  const savedEmpty = savedCount === 0 && !savedLocally;
  const bufferEmpty = bufferCount === 0;
  const serverEmpty = serverCount === 0;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 space-y-3 min-w-0 overflow-hidden">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        Synchronizacja
      </h2>

      <SyncSection title="Połączenie" accent="slate">
        <SyncStatRow label="Konto" value={syncInfo.accessAccountLabel || '—'} />
        <SyncStatRow label="Sellasist" value={accountDisplay} />
        <SyncStatRow
          label="Tryb"
          value={isDemoMode ? 'Demo (dane OpenAPI)' : 'Produkcja (API Sellasist)'}
        />
        <SyncStatRow label="Zakres w localStorage" value={storageScope} valueClassName="font-mono text-[11px]" />
      </SyncSection>

      <SyncSection title="Aktywny widok listy" accent="slate">
        <div className="flex flex-wrap gap-1.5">
          <StatusPill active={activeSource === 'server'} label="Baza serwerowa" tone="emerald" />
          <StatusPill active={activeSource === 'saved'} label="Baza lokalna" tone="emerald" />
          <StatusPill active={activeSource === 'buffer'} label="Bufor sesji" tone="sky" />
        </div>
        <SyncStatRow
          label="Wyświetlane źródło"
          value={
            activeSource === 'server'
              ? 'Baza danych (serwer)'
              : activeSource === 'saved'
                ? 'Baza lokalna'
                : 'Bufor pobierania'
          }
          valueClassName="text-brand-primary"
        />
        <SyncStatRow label="Zamówienia na liście" value={visibleFiltered} />
        <SyncStatRow
          label="W źródle"
          value={`${visibleFiltered} / ${visibleTotal}`}
        />
      </SyncSection>

      {bulkDownloading && bulkProgress && (
        <SyncSection title="Trwa pobieranie z API" accent="amber">
          <SyncStatRow label="Status" value="Import w toku…" valueClassName="text-amber-800" />
          <SyncStatRow label="Aktualna paczka" value={`#${bulkProgress.packageNum}`} />
          <SyncStatRow label="Pobrano łącznie" value={`${bulkProgress.fetchedTotal} zamówień`} />
          <SyncStatRow label="W ostatniej paczce" value={bulkProgress.lastBatchSize} />
          <SyncStatRow label="Pozostało paczek" value={bulkProgress.remainingPackages} />
          <SyncStatRow label="Szac. pozostało zamówień" value={bulkProgress.remainingOrders} />
          <SyncStatRow label="Przewidywany czas" value={bulkProgress.etaLabel} />
          <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden mt-1">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${bulkProgress.progressPercent}%` }}
            />
          </div>
        </SyncSection>
      )}

      <SyncSection title="Baza danych (serwer Netlify)" accent="emerald">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
          <span className="text-xs text-slate-500 shrink-0">Status zapisu</span>
          <span
            className={`inline-flex items-center max-w-full rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border text-center [overflow-wrap:anywhere] ${
              serverHasData
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {serverHasData ? 'Zapisane' : serverEmpty ? 'Pusta' : 'Brak danych'}
          </span>
        </div>
        <SyncStatRow label="Zamówienia na serwerze" value={serverCount} />
        <SyncStatRow
          label="Ostatni zapis"
          value={serverHasData ? serverFetchedAtLabel : '—'}
        />
        {serverSyncError && (
          <p className="text-[10px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-2 py-1.5">
            {serverSyncError}
          </p>
        )}
        <p className="text-[10px] text-slate-400 leading-relaxed pt-0.5">
          Trwałe dane w Netlify Database. Zapisz po imporcie („Zapisz na serwerze”) lub przez
          „Zarządzaj zamówieniami”.
        </p>
      </SyncSection>

      <SyncSection title="Baza lokalna (localStorage)" accent="emerald">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
          <span className="text-xs text-slate-500 shrink-0">Status zapisu</span>
          <span
            className={`inline-flex items-center max-w-full rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border text-center [overflow-wrap:anywhere] ${
              savedLocally
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {savedLocally ? 'Zapisane' : savedEmpty ? 'Pusta' : 'W pamięci (bez zapisu)'}
          </span>
        </div>
        <SyncStatRow label="Zamówienia w pamięci" value={savedCount} />
        <SyncStatRow
          label="Zapis w localStorage"
          value={savedLocally ? `${cachedCount} rekordów` : 'Brak'}
        />
        <SyncStatRow label="Ostatni zapis" value={savedLocally ? fetchedAtLabel : '—'} />
        <p className="text-[10px] text-slate-400 leading-relaxed pt-0.5">
          Trwałe dane przetrwają odświeżenie strony. Zapis następuje po „Zapisz w bazie lokalnej”
          lub „Z bufora do bazy”.
        </p>
      </SyncSection>

      <SyncSection title="Bufor sesji (pamięć)" accent="sky">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0">
          <span className="text-xs text-slate-500 shrink-0">Status bufora</span>
          <span
            className={`inline-flex items-center max-w-full rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border text-center [overflow-wrap:anywhere] ${
              bufferHasData
                ? 'bg-sky-100 text-sky-800 border-sky-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            {bufferEmpty ? 'Pusty' : 'Zawiera dane'}
          </span>
        </div>
        <SyncStatRow label="Zamówienia w buforze" value={bufferCount} />
        <SyncStatRow
          label="Ostatnie pobranie do bufora"
          value={bufferHasData ? bufferFetchedAtLabel : '—'}
        />
        <p className="text-[10px] text-slate-400 leading-relaxed pt-0.5">
          Dane tymczasowe — znikną po zamknięciu karty, chyba że przeniesiesz je do bazy lokalnej.
        </p>
      </SyncSection>

      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 space-y-1">
        <SyncStatRow
          label="Razem w aplikacji"
          value={`${savedCount + bufferCount + serverCount} zamówień`}
          valueClassName="font-semibold"
        />
        <p className="text-[10px] text-slate-400">
          Serwer ({serverCount}) + lokalna ({savedCount}) + bufor ({bufferCount}) — to osobne kopie.
        </p>
      </div>
    </div>
  );
}

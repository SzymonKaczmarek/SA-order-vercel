import React, { useEffect, useMemo, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconLayers, IconTrash, IconX } from './Icons';

const actionBtn =
  'w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed';

const SYNC_ACTIONS = [
  {
    id: 'unify',
    handler: 'syncUnifyBoth',
    label: 'Ujednolić bufor z bazą danych',
    desc: 'Dopisz brakujące produkty w obie strony — bez usuwania istniejących danych.',
    disabled: (summary) =>
      !summary || (summary.missingInLocal === 0 && summary.missingInServer === 0),
  },
  {
    id: 'toLocal',
    handler: 'syncMissingToLocal',
    label: 'Dopisz brakujące do bufora',
    desc: 'Produkty z bazy danych, których nie ma w buforze lokalnym.',
    disabled: (summary) => !summary || summary.missingInLocal === 0,
  },
  {
    id: 'toServer',
    handler: 'syncMissingToServer',
    label: 'Dopisz brakujące do bazy danych',
    desc: 'Produkty z bufora, których nie ma w bazie danych.',
    disabled: (summary) => !summary || summary.missingInServer === 0,
  },
  {
    id: 'moveToLocal',
    handler: 'moveServerToLocal',
    label: 'Przenieś bazę danych → bufor lokalny',
    desc: 'Zastąp bufor pełną kopią z bazy danych (nadpisanie bufora).',
    disabled: (summary, actions) =>
      actions.moveServerToLocalDisabled || !summary || summary.serverCount === 0,
  },
  {
    id: 'moveToServer',
    handler: 'moveLocalToServer',
    label: 'Przenieś bufor lokalny → bazę danych',
    desc: 'Dopisz cały bufor do bazy danych (append, bez kasowania bazy).',
    disabled: (summary, actions) =>
      actions.moveLocalToServerDisabled || !summary || summary.localCount === 0,
  },
];

function DiffSummary({ summary, loading }) {
  if (loading) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Porównuję bazę danych z buforem lokalnym…
      </p>
    );
  }

  if (!summary || summary.serverCount === 0) {
    return (
      <p className="text-xs text-slate-500 leading-relaxed">
        Baza danych jest pusta. Zaimportuj zamówienia i zapisz w bazie, aby synchronizować z buforem.
      </p>
    );
  }

  const { serverCount, localCount, matchedCount, missingInLocal, missingInServer } = summary;

  return (
    <p className="text-xs text-slate-600 leading-relaxed">
      Baza danych: <strong>{serverCount}</strong>
      {' · '}
      bufor lokalny: <strong>{localCount}</strong>
      {' · '}
      wspólne ID: <strong>{matchedCount ?? 0}</strong>
      {missingInLocal > 0 && (
        <>
          {' · '}
          brakuje w buforze: <strong className="text-amber-700">{missingInLocal}</strong>
        </>
      )}
      {missingInServer > 0 && (
        <>
          {' · '}
          brakuje w bazie: <strong className="text-amber-700">{missingInServer}</strong>
        </>
      )}
      {missingInLocal === 0 && missingInServer === 0 && localCount > 0 && (
        <> · bufor i baza są zsynchronizowane.</>
      )}
    </p>
  );
}

export function OrdersManageModal({ open, onClose, syncSummary, summaryLoading, actions }) {
  const [selectedAction, setSelectedAction] = useState('unify');
  const [clearLocal, setClearLocal] = useState(false);
  const [clearServer, setClearServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [moveError, setMoveError] = useState('');

  useEffect(() => {
    if (!open) {
      setStatusMessage('');
      setMoveError('');
      setClearLocal(false);
      setClearServer(false);
      return;
    }

    const firstEnabled = SYNC_ACTIONS.find((item) => !item.disabled(syncSummary, actions));
    setSelectedAction(firstEnabled?.id || 'unify');
  }, [
    open,
    syncSummary,
    actions.moveServerToLocalDisabled,
    actions.moveLocalToServerDisabled,
    actions.clearLocalDisabled,
    actions.clearServerDisabled,
  ]);

  const selectedMeta = useMemo(
    () => SYNC_ACTIONS.find((item) => item.id === selectedAction) || SYNC_ACTIONS[0],
    [selectedAction]
  );

  const actionDisabled = selectedMeta.disabled(syncSummary, actions);
  const hasClear =
    (clearLocal && !actions.clearLocalDisabled) ||
    (clearServer && !actions.clearServerDisabled);

  const executeDisabled =
    busy || summaryLoading || (!hasClear && (actionDisabled || !selectedMeta.handler));

  const handleExecute = async () => {
    setBusy(true);
    setMoveError('');
    setStatusMessage('');

    const onProgress = (message) => {
      setStatusMessage(message);
    };

    try {
      const wantsClearLocal = clearLocal && !actions.clearLocalDisabled;
      const wantsClearServer = clearServer && !actions.clearServerDisabled;
      const wantsAnyClear = wantsClearLocal || wantsClearServer;
      const wantsSync = !actionDisabled && selectedMeta.handler && !wantsAnyClear;

      if (wantsSync) {
        const handler = actions[selectedMeta.handler];
        if (typeof handler === 'function') {
          await Promise.resolve(handler(onProgress));
        }
      }

      if (wantsClearLocal) {
        onProgress('Czyszczenie bufora lokalnego…');
        await Promise.resolve(actions.clearLocal());
      }

      if (wantsClearServer) {
        onProgress('Czyszczenie bazy danych…');
        await Promise.resolve(actions.clearServer());
      }

      onClose();
    } catch (err) {
      setMoveError(err?.message || 'Nie udało się wykonać operacji.');
    } finally {
      setBusy(false);
      setStatusMessage('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold text-slate-900">Zarządzaj zamówieniami</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-50"
          >
            <ButtonLabel icon={IconX}>Zamknij</ButtonLabel>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Porównanie bufora i bazy
            </p>
            <DiffSummary summary={syncSummary} loading={summaryLoading} />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Synchronizacja
            </p>
            <div className="space-y-2">
              {SYNC_ACTIONS.map((item) => {
                const disabled = item.disabled(syncSummary, actions) || busy || summaryLoading;
                const checked = selectedAction === item.id;

                return (
                  <label
                    key={item.id}
                    className={`block rounded-2xl border px-4 py-3 cursor-pointer transition-colors ${
                      disabled
                        ? 'border-slate-100 bg-slate-50/50 opacity-60 cursor-not-allowed'
                        : checked
                          ? 'border-brand-primary/40 bg-brand-primary/5'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="orders-sync-action"
                        value={item.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => setSelectedAction(item.id)}
                        className="mt-1 shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500 leading-relaxed">
                          {item.desc}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {statusMessage && (
            <p className="text-xs text-brand-primary bg-brand-primary/5 border border-brand-primary/20 rounded-xl px-3 py-2">
              {statusMessage}
            </p>
          )}

          {moveError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              {moveError}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Czyszczenie (opcjonalnie)
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={clearServer}
                onChange={(e) => setClearServer(e.target.checked)}
                disabled={actions.clearServerDisabled || busy}
              />
              Wyczyść bazę danych
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={clearLocal}
                onChange={(e) => setClearLocal(e.target.checked)}
                disabled={actions.clearLocalDisabled || busy}
              />
              Wyczyść bufor lokalny
            </label>
          </div>

          <button
            type="button"
            onClick={handleExecute}
            disabled={executeDisabled}
            className={`${actionBtn} border border-brand-primary bg-brand-primary text-white hover:opacity-90`}
          >
            <ButtonLabel icon={IconLayers}>{busy ? 'Wykonywanie…' : 'Wykonaj'}</ButtonLabel>
          </button>

          <div className="text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <IconTrash className="w-3.5 h-3.5" />
              Zaznaczone czyszczenie wykonuje się bez synchronizacji. Aby najpierw ujednolicić dane,
              uruchom synchronizację osobno.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

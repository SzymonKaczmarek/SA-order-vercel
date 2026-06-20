import React, { useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconLayers, IconTrash, IconX } from './Icons';

const actionBtn =
  'w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed';

const MOVE_HANDLERS = {
  'saved:buffer': 'moveLocalToBuffer',
  'buffer:saved': 'moveBufferToLocal',
  'server:buffer': 'moveServerToBuffer',
  'buffer:server': 'moveBufferToServer',
  'saved:server': 'moveLocalToServer',
  'server:saved': 'moveServerToLocal',
};

export function OrdersManageModal({ open, onClose, actions }) {
  const [source, setSource] = useState('buffer');
  const [target, setTarget] = useState('server');
  const [clearBuffer, setClearBuffer] = useState(false);
  const [clearLocal, setClearLocal] = useState(false);
  const [clearServer, setClearServer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState('');

  const canMove = source && target && source !== target;
  const moveHandlerKey = canMove ? MOVE_HANDLERS[`${source}:${target}`] : null;
  const moveDisabled = !moveHandlerKey || actions[`${moveHandlerKey}Disabled`];

  const runMove = async () => {
    if (!moveHandlerKey) return null;
    return actions[moveHandlerKey]();
  };

  const handleExecute = async () => {
    setBusy(true);
    setMoveError('');
    try {
      if (!moveDisabled) {
        await Promise.resolve(runMove());
      }
      if (clearBuffer && !actions.clearBufferDisabled) {
        await Promise.resolve(actions.clearBuffer());
      }
      if (clearLocal && !actions.clearLocalDisabled) {
        await Promise.resolve(actions.clearLocal());
      }
      if (clearServer && !actions.clearServerDisabled) {
        await Promise.resolve(actions.clearServer());
      }
      onClose();
    } catch (err) {
      setMoveError(err?.message || 'Nie udało się wykonać operacji.');
    } finally {
      setBusy(false);
    }
  };

  const executeDisabled =
    busy ||
    (moveDisabled &&
      (!clearBuffer || actions.clearBufferDisabled) &&
      (!clearLocal || actions.clearLocalDisabled) &&
      (!clearServer || actions.clearServerDisabled));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Zarządzaj zamówieniami</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
          >
            <ButtonLabel icon={IconX}>Zamknij</ButtonLabel>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="orders-manage-source" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Skąd przenieść
              </label>
              <select
                id="orders-manage-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="server">Baza danych (serwer)</option>
                <option value="saved">Baza lokalna (localStorage)</option>
                <option value="buffer">Bufor pobierania</option>
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="orders-manage-target" className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Dokąd przenieść
              </label>
              <select
                id="orders-manage-target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="server">Baza danych (serwer)</option>
                <option value="saved">Baza lokalna (localStorage)</option>
                <option value="buffer">Bufor pobierania</option>
              </select>
            </div>
          </div>

          {moveError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
              {moveError}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Czyszczenie (opcjonalnie)</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={clearServer}
                onChange={(e) => setClearServer(e.target.checked)}
                disabled={actions.clearServerDisabled}
              />
              Wyczyść bazę danych (serwer)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={clearLocal}
                onChange={(e) => setClearLocal(e.target.checked)}
                disabled={actions.clearLocalDisabled}
              />
              Wyczyść bazę lokalną (localStorage)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={clearBuffer}
                onChange={(e) => setClearBuffer(e.target.checked)}
                disabled={actions.clearBufferDisabled}
              />
              Wyczyść bufor pobierania
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
              Operacje czyszczenia są wykonywane niezależnie od przenoszenia.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

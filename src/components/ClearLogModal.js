import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconTrash, IconX } from './Icons';

export function ClearLogModal({ open, onClose, onConfirm, busy, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    setUsername('');
    setPassword('');

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, busy, onClose]);

  if (!open || !mounted || typeof document === 'undefined') {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm({ username, password });
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        disabled={busy}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-log-title"
        className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 id="clear-log-title" className="text-lg font-semibold text-slate-900">
            Wyczyść dziennik
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 disabled:opacity-50"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            Podaj login i hasło domyślnego konta administratora, aby wyczyścić cały dziennik
            (lokalnie i na serwerze).
          </p>
          <div className="space-y-1.5">
            <label
              htmlFor="clear-log-username"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Login
            </label>
            <input
              id="clear-log-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="clear-log-password"
              className="text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Hasło
            </label>
            <input
              id="clear-log-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-2.5 text-sm font-semibold hover:bg-red-100 disabled:opacity-60"
            >
              <IconTrash className="w-4 h-4" />
              {busy ? 'Czyszczenie…' : 'Wyczyść'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

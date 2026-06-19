import React, { useEffect } from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconX } from './Icons';

export function JsonOverlay({ open, title, subtitle, payload, onClose }) {
  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="json-overlay-title"
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-700 bg-slate-800/80">
          <div className="min-w-0">
            <h2 id="json-overlay-title" className="text-sm font-semibold text-slate-100">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] text-slate-400 mt-1 font-mono truncate">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 text-slate-300 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider hover:bg-slate-700"
          >
            <ButtonLabel icon={IconX} iconClassName="w-3.5 h-3.5 shrink-0">
              Zamknij
            </ButtonLabel>
          </button>
        </div>

        <pre className="flex-1 overflow-auto p-5 text-xs text-emerald-300 font-mono leading-relaxed">
          {JSON.stringify(payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

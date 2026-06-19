import React, { useEffect } from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconX } from './Icons';
import { SellasistConfigForm } from './SellasistConfigForm';

export function SellasistConfigModal({ open, onClose, onSaved }) {
  useEffect(() => {
    if (!open) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Konfiguracja Sellasist</h2>
            <p className="text-xs text-slate-500 mt-0.5">Zapis dla aktywnego konta dostępu</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
          >
            <ButtonLabel icon={IconX} iconClassName="w-3.5 h-3.5 shrink-0">
              Zamknij
            </ButtonLabel>
          </button>
        </div>

        <div className="p-5">
          <SellasistConfigForm
            compact
            onSaved={() => {
              onSaved?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}

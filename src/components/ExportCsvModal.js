import React, { useEffect, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import { IconFileExport } from './Icons';

const EXPORT_OPTIONS = [
  {
    id: 'visible',
    title: 'Eksportuj widoczne',
    desc: 'Zamówienia po zastosowaniu filtrów na liście.',
  },
  {
    id: 'selected',
    title: 'Eksportuj zaznaczone',
    desc: 'Tylko zamówienia z zaznaczonymi checkboxami.',
  },
  {
    id: 'all',
    title: 'Eksportuj wszystkie',
    desc: 'Pełna zawartość aktywnego źródła (baza lub bufor), bez filtrów.',
  },
];

export function ExportCsvModal({
  open,
  sourceLabel,
  counts,
  onClose,
  onExport,
}) {
  const [scope, setScope] = useState('visible');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setScope('visible');
    setError('');
  }, [open]);

  if (!open) return null;

  const countForScope = counts[scope] ?? 0;

  const handleExport = () => {
    if (countForScope === 0) {
      const messages = {
        visible: 'Brak widocznych zamówień do eksportu.',
        selected: 'Nie zaznaczono żadnych zamówień.',
        all: 'Brak zamówień w aktywnym źródle.',
      };
      setError(messages[scope] || 'Brak danych do eksportu.');
      return;
    }

    setError('');
    onExport(scope);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">Eksport CSV</h2>
          <p className="text-xs text-slate-500 mt-1">
            Źródło: <strong>{sourceLabel}</strong> · separator pola: średnik (;)
          </p>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div className="space-y-2">
            {EXPORT_OPTIONS.map((option) => {
              const count = counts[option.id] ?? 0;
              const isActive = scope === option.id;

              return (
                <label
                  key={option.id}
                  className={`flex items-start gap-3 rounded-2xl border p-4 cursor-pointer transition ${
                    isActive
                      ? 'border-brand-primary ring-2 ring-brand-primary/15 bg-brand-primary/5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="export-scope"
                    checked={isActive}
                    onChange={() => {
                      setScope(option.id);
                      setError('');
                    }}
                    className="mt-0.5"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{option.title}</span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          count > 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-400 border border-slate-200'
                        }`}
                      >
                        {count}
                      </span>
                    </span>
                    <span className="block text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {option.desc}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {error && (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 text-slate-600 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-2.5 text-sm font-semibold hover:opacity-90"
            >
              <ButtonLabel icon={IconFileExport}>Eksportuj CSV</ButtonLabel>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo } from 'react';
import { IconDatabase, IconHourglass, IconLayers } from './Icons';

const STEPS = [
  {
    id: 'local',
    label: 'Bufor lokalny',
    detail: 'Odczytujemy zapisane zamówienia z przeglądarki…',
  },
  {
    id: 'server',
    label: 'Baza danych',
    detail: 'Sprawdzamy bazę danych i porównujemy z buforem…',
  },
  {
    id: 'list',
    label: 'Przygotowanie widoku',
    detail: 'Ładujemy pierwszą stronę listy zamówień…',
  },
];

function StepRow({ stepId, active, done }) {
  const stepMeta = STEPS.find((item) => item.id === stepId);
  const stepNumber = STEPS.findIndex((item) => item.id === stepId) + 1;

  return (
    <li
      className={`flex items-start gap-2.5 text-xs leading-snug ${
        active ? 'text-slate-800' : done ? 'text-emerald-700' : 'text-slate-400'
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
          active
            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
            : done
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-400'
        }`}
      >
        {done ? '✓' : stepNumber}
      </span>
      <span>{stepMeta?.label}</span>
    </li>
  );
}

export function OrdersPageInitOverlay({
  visible,
  step,
  localCount,
  serverCount,
}) {
  useEffect(() => {
    if (!visible) return undefined;

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  const activeStep = STEPS.find((item) => item.id === step) || STEPS[0];
  const stepIndex = STEPS.findIndex((item) => item.id === step);
  const progressPercent = useMemo(() => {
    const base = Math.max(0, stepIndex) * 33;
    if (step === 'list') return 92;
    if (step === 'server') return 55;
    return 18;
  }, [step, stepIndex]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-4"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Ładowanie danych zamówień"
    >
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

      <div className="relative w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
            <IconHourglass spinning className="w-5 h-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <h2 className="text-sm font-semibold text-slate-900">Przygotowujemy widok zamówień</h2>
            <p className="text-xs text-slate-500 leading-relaxed">{activeStep.detail}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 text-center">Prosimy o chwilę cierpliwości…</p>
        </div>

        <ul className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <StepRow stepId="local" active={step === 'local'} done={stepIndex > 0} />
          <StepRow stepId="server" active={step === 'server'} done={stepIndex > 1} />
          <StepRow stepId="list" active={step === 'list'} done={false} />
        </ul>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2.5">
            <span className="inline-flex items-center gap-1 text-sky-800 font-semibold">
              <IconLayers className="w-3.5 h-3.5" />
              Bufor lokalny
            </span>
            <p className="mt-1 text-sky-900/80 tabular-nums">
              {localCount == null ? '…' : `${localCount} produktów`}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
            <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
              <IconDatabase className="w-3.5 h-3.5" />
              Baza danych
            </span>
            <p className="mt-1 text-emerald-900/80 tabular-nums">
              {serverCount == null ? '…' : `${serverCount} produktów`}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed text-center">
          Podsumowujemy dane z bufora lokalnego i bazy danych. Przy dużej liczbie produktów może to
          potrwać dłużej — prosimy nie zamykać karty.
        </p>
      </div>
    </div>
  );
}

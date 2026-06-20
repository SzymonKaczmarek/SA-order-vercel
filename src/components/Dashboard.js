import React from 'react';
import { Link } from 'gatsby';
import { useAuth } from '../context/AuthContext';
import { useAccessAccount } from '../context/AccessAccountContext';
import { useSellasistConfig } from '../hooks/useSellasistConfig';
import { formatAccessAccountHeader, getAccessAccountDisplayName } from '../data/accessAccounts';
import {
  IconArrowRight,
  IconBookOpen,
  IconCog,
  IconDatabase,
  IconInbox,
  IconLogout,
  IconPlug,
} from './Icons';

const MODULES = [
  {
    id: 'orders',
    title: 'Zamówienia Sellasist',
    desc: 'Pobieranie, filtrowanie, eksport i zarządzanie bazą zamówień.',
    path: '/orders',
    icon: IconInbox,
    accent: 'bg-brand-primary text-white',
    featured: true,
  },
  {
    id: 'accounts',
    title: 'Konta',
    desc: 'Osobne konta z loginem/hasłem, konfiguracja i baza zamówień.',
    path: '/accounts',
    icon: IconDatabase,
    accent: 'bg-slate-100 text-brand-primary',
  },
  {
    id: 'config',
    title: 'Konfiguracja API',
    desc: 'Konto Sellasist, klucz API lub tryb demo z dokumentacji.',
    path: '/config',
    icon: IconCog,
    accent: 'bg-slate-100 text-brand-primary',
  },
  {
    id: 'logs',
    title: 'Dziennik zdarzeń',
    desc: 'Historia logowań, akcji użytkowników, zapytań API i błędów.',
    path: '/logs',
    icon: IconBookOpen,
    accent: 'bg-slate-100 text-brand-primary',
  },
];

const WORKFLOW = [
  {
    step: 1,
    title: 'Konto sklepu',
    desc: 'Utwórz lub wybierz aktywne konto.',
    path: '/accounts',
  },
  {
    step: 2,
    title: 'Konfiguracja Sellasist',
    desc: 'Zapisz dane API dla aktywnego konta.',
    path: '/config',
  },
  {
    step: 3,
    title: 'Zamówienia',
    desc: 'Pobierz dane i pracuj na bazie lub buforze.',
    path: '/orders',
  },
];

function StatCard({ label, value, hint, status }) {
  const statusStyles = {
    ok: 'border-emerald-200 bg-emerald-50/80',
    warn: 'border-amber-200 bg-amber-50/80',
    info: 'border-sky-200 bg-sky-50/80',
    neutral: 'border-slate-200 bg-white',
  };

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 space-y-2 ${statusStyles[status] || statusStyles.neutral}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="text-base sm:text-lg font-semibold text-slate-900 leading-snug break-words">
        {value}
      </p>
      {hint && <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

function ModuleCard({ module }) {
  const Icon = module.icon || IconBookOpen;

  return (
    <Link
      to={module.path}
      className={`group flex items-start gap-4 rounded-2xl border p-5 transition hover:shadow-md ${
        module.featured
          ? 'border-brand-primary/20 bg-white hover:border-brand-primary/40'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div
        className={`shrink-0 rounded-xl p-3 ${module.accent}`}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-accent">
            {module.title}
          </h3>
          <IconArrowRight className="w-4 h-4 shrink-0 text-slate-300 group-hover:text-brand-accent transition" />
        </div>
        <p className="text-sm text-slate-500 leading-relaxed">{module.desc}</p>
      </div>
    </Link>
  );
}

function WorkflowStep({ item, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary text-[11px] font-bold text-white">
          {item.step}
        </span>
        {!isLast && <span className="mt-1 w-px flex-1 bg-slate-200 min-h-[1.5rem]" />}
      </div>
      <div className={`pb-5 min-w-0 ${isLast ? 'pb-0' : ''}`}>
        <Link to={item.path} className="group block">
          <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-accent">
            {item.title}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.desc}</p>
        </Link>
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const { activeAccount, accounts, ready: accountsReady } = useAccessAccount();
  const { isConfigured, config, isDemoMode } = useSellasistConfig();

  const integrationLabel = isDemoMode
    ? 'Tryb demo'
    : isConfigured
      ? 'Połączono'
      : 'Nie skonfigurowano';

  const integrationHint = isDemoMode
    ? 'Dane z dokumentacji api.sellasist.pl'
    : isConfigured
      ? `${config.account}.sellasist.pl`
      : 'Uzupełnij konfigurację API';

  const integrationStatus = isDemoMode ? 'info' : isConfigured ? 'ok' : 'warn';

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
              SA Order Reader
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Panel główny</h1>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:block text-right max-w-[280px] min-w-0">
              <p
                className="text-xs text-slate-600 [overflow-wrap:anywhere] leading-snug"
                title={
                  accountsReady && activeAccount
                    ? formatAccessAccountHeader(activeAccount)
                    : undefined
                }
              >
                {accountsReady && activeAccount
                  ? formatAccessAccountHeader(activeAccount)
                  : `${user.firstName} ${user.lastName}`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{user.username}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            >
              <IconLogout className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Witaj, {user.firstName}
          </h2>
          <p className="text-sm text-slate-500 max-w-2xl">
            Zarządzaj integracją Sellasist — każde konto ma login do panelu, własną konfigurację i bazę zamówień.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            label="Aktywne konto"
            value={accountsReady && activeAccount ? getAccessAccountDisplayName(activeAccount) : '—'}
            hint="Wybierz konto w module Konta"
            status={activeAccount ? 'neutral' : 'warn'}
          />
          <StatCard
            label="Integracja Sellasist"
            value={integrationLabel}
            hint={integrationHint}
            status={integrationStatus}
          />
          <StatCard
            label="Konta"
            value={accountsReady ? String(accounts.length) : '—'}
            hint={
              accounts.length === 1
                ? '1 konto w systemie'
                : `${accounts.length} kont w systemie`
            }
            status="neutral"
          />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] gap-6 items-start">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Moduły
              </h2>
              {!isConfigured && (
                <Link
                  to="/config"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-800"
                >
                  <IconPlug className="w-3.5 h-3.5" />
                  Uzupełnij konfigurację
                </Link>
              )}
            </div>
            <div className="space-y-3">
              {MODULES.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 lg:sticky lg:top-6">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Jak zacząć
            </h2>
            <div>
              {WORKFLOW.map((item, index) => (
                <WorkflowStep
                  key={item.step}
                  item={item}
                  isLast={index === WORKFLOW.length - 1}
                />
              ))}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

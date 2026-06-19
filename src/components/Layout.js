import React from 'react';
import { Link, navigate } from 'gatsby';
import { useAuth } from '../context/AuthContext';
import { useAccessAccount } from '../context/AccessAccountContext';
import { formatAccessAccountHeader } from '../data/accessAccounts';
import { IconArrowLeft, IconLogout } from './Icons';

export const headerBtnBase =
  'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider transition';

export const headerBtnSecondary =
  `${headerBtnBase} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900`;

export const headerBtnPrimary =
  `${headerBtnBase} border border-brand-primary bg-brand-primary text-white hover:opacity-90`;

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();

  React.useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg text-slate-500 text-sm">
        Ładowanie…
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return children;
}

export function BackToPanelLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-600 text-[10px] font-semibold uppercase tracking-[0.2em] hover:bg-slate-50"
    >
      <IconArrowLeft className="w-4 h-4 shrink-0" />
      Powrót do panelu
    </Link>
  );
}

export function PageShell({ title, children, fullWidth = false, headerActions = null }) {
  const { user, logout } = useAuth();
  const { activeAccount, ready: accountsReady } = useAccessAccount();
  const containerClass = fullWidth
    ? 'max-w-[1600px] mx-auto px-4 sm:px-6'
    : 'max-w-6xl mx-auto px-4';

  const headerAccountText =
    accountsReady && activeAccount
      ? formatAccessAccountHeader(activeAccount)
      : `${user.firstName} ${user.lastName}`;

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white">
        <div className={`${containerClass} py-4 flex items-center justify-between gap-4`}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">
              SA Order Reader
            </p>
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0 max-w-[55%] sm:max-w-none justify-end">
            <p
              className="text-xs text-slate-600 text-right leading-snug [overflow-wrap:anywhere] min-w-0"
              title={headerAccountText}
            >
              {headerAccountText}
            </p>
            {headerActions}
            <button
              type="button"
              onClick={logout}
              className={headerBtnSecondary}
            >
              <IconLogout className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Wyloguj</span>
            </button>
          </div>
        </div>
      </header>
      <main className={`${containerClass} py-8`}>{children}</main>
    </div>
  );
}

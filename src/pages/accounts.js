import React, { useState } from 'react';
import { Link, navigate } from 'gatsby';
import { BackToPanelLink, PageShell, RequireAuth } from '../components/Layout';
import { ButtonLabel } from '../components/ButtonLabel';
import { IconDatabase, IconTrash } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useAccessAccount } from '../context/AccessAccountContext';
import { AUTH_STORAGE_KEY } from '../hooks/useAuth';
import { getAccessAccountDisplayName } from '../data/accessAccounts';

function AccountEditForm({ account, onSave, onCancel }) {
  const [name, setName] = useState(account.name || '');
  const [username, setUsername] = useState(account.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    try {
      onSave({
        name,
        username,
        password: password || undefined,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/50">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Edycja konta</p>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Nazwa konta
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          required
        />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Login
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Nowe hasło
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            placeholder="Zostaw puste, aby nie zmieniać"
            autoComplete="new-password"
          />
        </div>
      </div>
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-xl bg-brand-primary text-white px-4 py-2 text-xs font-semibold"
        >
          Zapisz zmiany
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-white"
        >
          Anuluj
        </button>
      </div>
    </form>
  );
}

function AccountsView() {
  const { user, logout } = useAuth();
  const {
    accounts,
    activeAccount,
    selectAccount,
    createAccount,
    updateAccount,
    deleteAccount,
  } = useAccessAccount();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  const syncLoggedUser = (account) => {
    if (!user || user.username !== account.username) return;
    if (typeof window === 'undefined') return;

    const payload = {
      ...user,
      username: account.username,
      firstName: account.name || account.username,
      email: account.email || account.username,
      accessAccountId: account.id,
    };

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  };

  const handleCreateAccount = (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const account = createAccount({ name, username, password });
      setName('');
      setUsername('');
      setPassword('');
      setMessage(
        `Utworzono konto: ${getAccessAccountDisplayName(account)} (login: ${account.username})`
      );
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveEdit = (accountId, payload) => {
    const original = accounts.find((item) => item.id === accountId);
    const wasLoggedInAs =
      user?.accessAccountId === accountId || user?.username === original?.username;

    const updated = updateAccount(accountId, payload);
    setEditingId(null);
    setMessage(`Zaktualizowano konto: ${getAccessAccountDisplayName(updated)}`);

    if (wasLoggedInAs) {
      syncLoggedUser(updated);
    }
  };

  const handleDeleteAccount = (account) => {
    const label = getAccessAccountDisplayName(account);
    const confirmed = window.confirm(
      `Usunąć konto „${label}”?\n\nTej operacji nie można cofnąć. Konfiguracja i zamówienia tego konta pozostaną w pamięci przeglądarki / na serwerze pod starym identyfikatorem.`
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      const isOwnAccount = user?.username === account.username;
      deleteAccount(account.id);

      if (isOwnAccount) {
        logout();
        navigate('/');
        return;
      }

      if (editingId === account.id) {
        setEditingId(null);
      }

      setMessage(`Usunięto konto: ${label}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageShell title="Konta">
      <div className="space-y-6 max-w-3xl">
        <BackToPanelLink />

        <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Konta do logowania</h2>
          <p className="text-sm text-slate-600">
            Każde konto ma własny login i hasło do panelu, konfigurację Sellasist oraz osobną bazę
            zamówień. Logujesz się danymi konta — po zalogowaniu pracujesz na jego danych.
          </p>
          {activeAccount && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2">
              Aktywne konto: <strong>{getAccessAccountDisplayName(activeAccount)}</strong>
              {activeAccount.username ? ` · login: ${activeAccount.username}` : ''}
            </p>
          )}
        </section>

        <form
          onSubmit={handleCreateAccount}
          className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Nowe konto</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Nazwa konta
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
              placeholder="np. Sklep główny, Allegro, B2B"
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Login do panelu
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                placeholder="np. sklep-glowny"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Hasło do panelu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                placeholder="Hasło logowania"
                autoComplete="new-password"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary text-white px-5 py-2.5 text-sm font-semibold"
          >
            <ButtonLabel icon={IconDatabase}>Utwórz konto</ButtonLabel>
          </button>
        </form>

        {message && (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
            {message}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
            {error}
          </div>
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-[0.15em]">
            Lista kont ({accounts.length})
          </h2>

          {accounts.map((account) => {
            const isActive = activeAccount?.id === account.id;
            const isEditing = editingId === account.id;
            const label = getAccessAccountDisplayName(account);
            const canDelete = accounts.length > 1;

            return (
              <article
                key={account.id}
                className={`rounded-3xl border bg-white overflow-hidden ${
                  isActive ? 'border-brand-primary ring-2 ring-brand-primary/15' : 'border-slate-200'
                }`}
              >
                <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      login: <span className="font-mono">{account.username || '—'}</span>
                      {' · '}
                      utworzono {new Date(account.createdAt).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          selectAccount(account.id);
                          setMessage(`Aktywne konto: ${label}`);
                        }}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                      >
                        Ustaw jako aktywne
                      </button>
                    )}
                    {isActive && (
                      <span className="rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-2 text-xs font-bold uppercase">
                        Aktywne
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(isEditing ? null : account.id);
                        setError('');
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                    >
                      {isEditing ? 'Zwiń' : 'Edytuj'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(account)}
                      disabled={!canDelete}
                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 text-red-700 px-3 py-2 text-xs font-semibold hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                      Usuń
                    </button>
                    <Link
                      to="/orders"
                      className="rounded-xl bg-brand-primary text-white px-3 py-2 text-xs font-semibold hover:opacity-90"
                    >
                      Zamówienia
                    </Link>
                  </div>
                </div>

                {isEditing && (
                  <AccountEditForm
                    account={account}
                    onSave={(payload) => handleSaveEdit(account.id, payload)}
                    onCancel={() => setEditingId(null)}
                  />
                )}
              </article>
            );
          })}
        </section>
      </div>
    </PageShell>
  );
}

export default function AccountsPage() {
  return (
    <RequireAuth>
      <AccountsView />
    </RequireAuth>
  );
}

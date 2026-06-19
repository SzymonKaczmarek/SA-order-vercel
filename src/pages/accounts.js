import React, { useState } from 'react';
import { Link } from 'gatsby';
import { BackToPanelLink, PageShell, RequireAuth } from '../components/Layout';
import { ButtonLabel } from '../components/ButtonLabel';
import { IconDatabase } from '../components/Icons';
import { useAccessAccount } from '../context/AccessAccountContext';

function AccountsView() {
  const {
    accounts,
    activeAccount,
    selectAccount,
    createAccount,
    addUser,
    getUsers,
  } = useAccessAccount();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(activeAccount?.id || null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    email: '',
    firstName: '',
    lastName: '',
  });

  const handleCreateAccount = (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      const account = createAccount({ email, name });
      setEmail('');
      setName('');
      setExpandedId(account.id);
      setMessage(`Utworzono konto dostępu: ${account.email}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddUser = (e, accessAccountId) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      addUser(accessAccountId, userForm);
      setUserForm({
        username: '',
        password: '',
        email: '',
        firstName: '',
        lastName: '',
      });
      setMessage('Dodano użytkownika do konta dostępu.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <PageShell title="Konta dostępu">
      <div className="space-y-6 max-w-3xl">
        <BackToPanelLink />

        <section className="rounded-3xl bg-white border border-slate-200 p-6 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Izolacja danych</h2>
          <p className="text-sm text-slate-600">
            Każde konto dostępu (e-mail) ma własną konfigurację Sellasist, bazę zamówień w
            localStorage oraz osobną listę użytkowników. Przełącz aktywne konto, aby pracować na
            innych danych.
          </p>
          {activeAccount && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2">
              Aktywne konto: <strong>{activeAccount.email}</strong>
              {activeAccount.name ? ` (${activeAccount.name})` : ''}
            </p>
          )}
        </section>

        <form
          onSubmit={handleCreateAccount}
          className="rounded-3xl bg-white border border-slate-200 p-6 space-y-4"
        >
          <h2 className="text-sm font-semibold text-slate-900">Nowe konto dostępu</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                E-mail konta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                placeholder="sklep@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Nazwa (opcjonalnie)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
                placeholder="Sklep główny"
              />
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary text-white px-5 py-2.5 text-sm font-semibold"
          >
            <ButtonLabel icon={IconDatabase}>Utwórz konto dostępu</ButtonLabel>
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
            const users = getUsers(account.id);
            const isActive = activeAccount?.id === account.id;
            const isExpanded = expandedId === account.id;

            return (
              <article
                key={account.id}
                className={`rounded-3xl border bg-white overflow-hidden ${
                  isActive ? 'border-brand-primary ring-2 ring-brand-primary/15' : 'border-slate-200'
                }`}
              >
                <div className="p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{account.email}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {account.name} · {users.length} użytk. · utworzono{' '}
                      {new Date(account.createdAt).toLocaleString('pl-PL')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          selectAccount(account.id);
                          setMessage(`Aktywne konto: ${account.email}`);
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
                      onClick={() => setExpandedId(isExpanded ? null : account.id)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                    >
                      {isExpanded ? 'Zwiń użytkowników' : 'Użytkownicy'}
                    </button>
                    <Link
                      to="/orders"
                      className="rounded-xl bg-brand-primary text-white px-3 py-2 text-xs font-semibold hover:opacity-90"
                    >
                      Zamówienia
                    </Link>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 space-y-4 bg-slate-50/50">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Użytkownicy konta
                      </h3>
                      {users.length === 0 ? (
                        <p className="text-sm text-slate-400">Brak użytkowników.</p>
                      ) : (
                        <ul className="space-y-2">
                          {users.map((user) => (
                            <li
                              key={user.username}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm flex justify-between gap-2"
                            >
                              <span>
                                <strong>{user.username}</strong> · {user.email}
                              </span>
                              <span className="text-xs text-slate-400">
                                {user.firstName} {user.lastName}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <form
                      onSubmit={(e) => handleAddUser(e, account.id)}
                      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"
                    >
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Dodaj użytkownika
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={userForm.username}
                          onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                          placeholder="Login"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          placeholder="Hasło"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                          placeholder="E-mail użytkownika"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          required
                        />
                        <input
                          type="text"
                          value={userForm.firstName}
                          onChange={(e) => setUserForm({ ...userForm, firstName: e.target.value })}
                          placeholder="Imię"
                          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-xl bg-slate-800 text-white px-4 py-2 text-xs font-semibold"
                      >
                        Dodaj użytkownika
                      </button>
                    </form>
                  </div>
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

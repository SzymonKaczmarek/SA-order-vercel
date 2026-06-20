import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ButtonLabel } from './ButtonLabel';
import { IconLogin } from './Icons';

export function LoginPage() {
  const { login, error, setError } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await login(username.trim(), password);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-brand-bg">
      <div className="max-w-md w-full rounded-3xl shadow-xl border border-slate-200 p-8 bg-white">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">SA Order Reader</h1>
          <p className="text-sm text-slate-500 mt-2">Zaloguj się loginem i hasłem konta</p>
          <div className="w-16 h-1 bg-brand-accent mx-auto mt-4 rounded-full" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400">
              Login
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              placeholder="login"
              autoComplete="username"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-[0.2em] uppercase text-slate-400">
              Hasło
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary text-white py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            <ButtonLabel icon={IconLogin}>
              {submitting ? 'Logowanie…' : 'Zaloguj się'}
            </ButtonLabel>
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import {
  IconBookOpen,
  IconPlug,
  IconSave,
  IconToggleOff,
} from './Icons';
import {
  SELLASIST_DOCS_URL,
  SELLASIST_DEMO_PRESET,
} from '../data/sellasistDemo';
import { useSellasistConfig } from '../hooks/useSellasistConfig';
import { testSellasistConnection, normalizeSellasistAccount } from '../hooks/useSellasistApi';

export function SellasistConfigForm({ onSaved, compact = false }) {
  const { config, loaded, setConfig, isDemoMode } = useSellasistConfig();
  const [account, setAccount] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [useDemoData, setUseDemoData] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    setAccount(config.account);
    setApiKey(config.apiKey);
    setUseDemoData(config.useDemoData);
  }, [loaded, config]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    setConfig({ account, apiKey, useDemoData });
    setMessage(
      useDemoData
        ? 'Zapisano tryb demo – zamówienia pochodzą z przykładów w dokumentacji API.'
        : 'Konfiguracja zapisana dla aktywnego konta dostępu.'
    );
    setSaving(false);
    onSaved?.();
  };

  const handleUseDemo = () => {
    setError('');
    setMessage('');
    setAccount(SELLASIST_DEMO_PRESET.account);
    setApiKey('');
    setUseDemoData(true);
    setConfig(SELLASIST_DEMO_PRESET);
    setMessage(
      'Włączono tryb demo. Dane zamówień pochodzą ze schematów OpenAPI w dokumentacji Sellasist – bez wywołań do API.'
    );
    onSaved?.();
  };

  const handleDisableDemo = () => {
    setUseDemoData(false);
    setConfig({ account, apiKey, useDemoData: false });
    setMessage('Tryb demo wyłączony. Podaj własne konto i klucz API.');
    onSaved?.();
  };

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setMessage('');

    try {
      const result = await testSellasistConnection({ account, apiKey, useDemoData });
      setMessage(result.message || 'Połączenie działa poprawnie.');
    } catch (err) {
      setError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const sectionClass = compact
    ? 'rounded-2xl bg-sky-50 border border-sky-200 p-4 space-y-3'
    : 'rounded-3xl bg-sky-50 border border-sky-200 p-6 space-y-4';

  const formClass = compact
    ? 'rounded-2xl bg-white border border-slate-200 p-4 space-y-4'
    : 'rounded-3xl bg-white border border-slate-200 p-6 space-y-5';

  return (
    <div className={`space-y-4 ${compact ? '' : 'max-w-xl'}`}>
      <section className={sectionClass}>
        <div>
          <h2 className="text-sm font-semibold text-sky-900">Tryb demo (dokumentacja API)</h2>
          <p className={`text-sm text-sky-800 mt-2 ${compact ? 'text-xs' : ''}`}>
            Dokumentacja{' '}
            <a
              href={SELLASIST_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              api.sellasist.pl
            </a>{' '}
            – przykładowe zamówienia ze schematów OpenAPI, bez klucza API.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleUseDemo}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 text-white px-4 py-2 text-sm font-semibold hover:bg-sky-700"
          >
            <ButtonLabel icon={IconBookOpen}>Użyj danych demo</ButtonLabel>
          </button>
          {isDemoMode && (
            <button
              type="button"
              onClick={handleDisableDemo}
              className="inline-flex items-center gap-2 rounded-2xl border border-sky-300 bg-white text-sky-800 px-4 py-2 text-sm font-semibold"
            >
              <ButtonLabel icon={IconToggleOff}>Wyłącz tryb demo</ButtonLabel>
            </button>
          )}
        </div>
      </section>

      <form onSubmit={handleSave} className={formClass}>
        <p className="text-sm text-slate-600">
          Połączenie produkcyjne: subdomena konta Sellasist oraz klucz API.
        </p>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useDemoData}
            onChange={(e) => setUseDemoData(e.target.checked)}
            className="rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
          />
          <span className="text-sm text-slate-700">Tryb demo zamiast API</span>
        </label>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Subdomena konta
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(normalizeSellasistAccount(e.target.value))}
              disabled={useDemoData}
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
              placeholder="twoje-konto"
            />
            <span className="text-sm text-slate-400 whitespace-nowrap">.sellasist.pl</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Klucz API
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            disabled={useDemoData}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
            placeholder={useDemoData ? 'Nie wymagany w trybie demo' : 'apiKey z panelu Sellasist'}
            autoComplete="off"
          />
        </div>

        {message && (
          <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2">
            {message}
          </div>
        )}

        {error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-2xl px-4 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <ButtonLabel icon={IconSave}>
              {saving ? 'Zapisywanie…' : 'Zapisz konfigurację'}
            </ButtonLabel>
          </button>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || (!useDemoData && (!account || !apiKey))}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white text-slate-700 px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <ButtonLabel icon={IconPlug}>
              {testing ? 'Testowanie…' : 'Testuj połączenie'}
            </ButtonLabel>
          </button>
        </div>
      </form>
    </div>
  );
}

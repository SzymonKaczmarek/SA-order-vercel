import React, { useEffect, useState } from 'react';
import { ButtonLabel } from './ButtonLabel';
import {
  IconBookOpen,
  IconEye,
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
  const { config, loaded, setConfig, isDemoMode, loadError } = useSellasistConfig();
  const [account, setAccount] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [useDemoData, setUseDemoData] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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

    try {
      await setConfig({ account, apiKey, useDemoData });
      setMessage(
        useDemoData
          ? 'Zapisano tryb demo w bazie danych – zamówienia pochodzą z przykładów w dokumentacji API.'
          : 'Konfiguracja zapisana w bazie danych dla aktywnego konta dostępu.'
      );
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'Nie udało się zapisać konfiguracji w bazie danych.');
    } finally {
      setSaving(false);
    }
  };

  const handleUseDemo = async () => {
    setError('');
    setMessage('');
    setAccount(SELLASIST_DEMO_PRESET.account);
    setApiKey('');
    setUseDemoData(true);

    try {
      await setConfig(SELLASIST_DEMO_PRESET);
      setMessage(
        'Włączono tryb demo w bazie danych. Dane zamówienia pochodzą ze schematów OpenAPI w dokumentacji Sellasist – bez wywołań do API.'
      );
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'Nie udało się zapisać trybu demo w bazie danych.');
    }
  };

  const handleDisableDemo = async () => {
    setUseDemoData(false);

    try {
      await setConfig({ account, apiKey, useDemoData: false });
      setMessage('Tryb demo wyłączony. Podaj własne konto i klucz API.');
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'Nie udało się zapisać konfiguracji w bazie danych.');
    }
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
          Połączenie produkcyjne: subdomena konta Sellasist oraz klucz API. Dane zapisujemy w
          bazie danych na serwerze, przypisane do aktywnego konta dostępu — nie w przeglądarce.
        </p>

        {loadError && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2">
            {loadError}
          </div>
        )}

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
          <div className="flex items-center gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={useDemoData}
              className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm disabled:opacity-60"
              placeholder={useDemoData ? 'Nie wymagany w trybie demo' : 'apiKey z panelu Sellasist'}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((current) => !current)}
              disabled={useDemoData}
              aria-label={showApiKey ? 'Ukryj klucz API' : 'Pokaż klucz API'}
              className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <IconEye className="w-4 h-4" />
              {showApiKey ? 'Ukryj' : 'Pokaż'}
            </button>
          </div>
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

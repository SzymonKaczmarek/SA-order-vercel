import { getDemoConnectionResult, getDemoOrders } from '../data/sellasistDemo';
import { isDemoMode } from './useSellasistConfig';

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function normalizeAccount(raw) {
  let account = String(raw || '').trim().toLowerCase();
  account = account.replace(/^https?:\/\//, '');
  account = account.replace(/\.sellasist\.pl\/?.*$/, '');
  account = account.replace(/\/.*$/, '');
  return account;
}

function buildConfig(config) {
  return {
    ...config,
    account: normalizeAccount(config.account),
  };
}

function normalizeNetlifyFetchError(err, path) {
  const msg = String(err?.message || err || '');

  if (err?.name === 'AbortError' || /abort|anulow|terminated/i.test(msg)) {
    return new Error('Pobieranie przerwane (połączenie anulowane lub przekroczony czas).');
  }

  if (/failed to fetch|network|load failed|terminated/i.test(msg)) {
    const port = typeof window !== 'undefined' ? window.location.port : '';
    const hint =
      port === '8000'
        ? ' Uruchom npm run dev:netlify i wejdź na http://localhost:8888 (port 8000 nie ma funkcji Netlify).'
        : ' Sprawdź połączenie i logi Netlify (timeout funkcji ~10 s na darmowym planie).';
    return new Error(`Brak połączenia z funkcją Netlify (${path}).${hint}`);
  }

  return err instanceof Error ? err : new Error(msg || 'Błąd sieci');
}

async function callNetlifyFunction(path, payload, { signal } = {}) {
  const url = `${getBaseUrl()}/.netlify/functions/${path}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    throw normalizeNetlifyFetchError(err, path);
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    throw new Error(`Nieprawidłowa odpowiedź serwera (${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(data?.error || `Błąd serwera (${res.status}).`);
  }

  return data;
}

export async function testSellasistConnection(config) {
  if (isDemoMode(config)) {
    return getDemoConnectionResult();
  }

  return callNetlifyFunction('sellasist-test', {
    account: buildConfig(config).account,
    apiKey: config.apiKey,
  });
}

export async function fetchSellasistOrders(config, params = {}, options = {}) {
  if (isDemoMode(config)) {
    return getDemoOrders(params.limit ?? 25, params.offset ?? 0, {
      from_id: params.from_id,
      idRange: params.idRange,
    });
  }

  return callNetlifyFunction(
    'sellasist-orders',
    {
      account: buildConfig(config).account,
      apiKey: config.apiKey,
      params,
    },
    options
  );
}

export { normalizeAccount as normalizeSellasistAccount };

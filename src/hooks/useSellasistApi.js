import { getDemoConnectionResult, getDemoOrders } from '../data/sellasistDemo';
import { isDemoMode } from './useSellasistConfig';
import { logEvent } from '../utils/eventLog';

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

function normalizeApiFetchError(err, path) {
  const msg = String(err?.message || err || '');

  if (err?.name === 'AbortError' || /abort|anulow|terminated/i.test(msg)) {
    return new Error('Pobieranie przerwane (połączenie anulowane lub przekroczony czas).');
  }

  if (/failed to fetch|network|load failed|terminated/i.test(msg)) {
    const port = typeof window !== 'undefined' ? window.location.port : '';
    const hint =
      port === '8000'
        ? ' Uruchom npm run dev:vercel (vercel dev) zamiast samego gatsby develop — port 8000 nie ma API.'
        : ' Sprawdź połączenie i logi Vercel.';
    return new Error(`Brak połączenia z API (${path}).${hint}`);
  }

  return err instanceof Error ? err : new Error(msg || 'Błąd sieci');
}

async function callApi(path, payload, { signal } = {}) {
  const url = `${getBaseUrl()}/api/${path}`;
  const startedAt = Date.now();
  const safePayload = { ...payload };
  if (safePayload.apiKey) safePayload.apiKey = '[ukryte]';

  logEvent({
    level: 'system',
    category: 'api',
    action: `api.${path}.request`,
    message: `Zapytanie API: ${path}`,
    details: { path, payload: safePayload },
  });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    const normalized = normalizeApiFetchError(err, path);
    logEvent({
      level: 'error',
      category: 'api',
      action: `api.${path}.error`,
      message: `Błąd połączenia API: ${path}`,
      details: {
        path,
        durationMs: Date.now() - startedAt,
        error: normalized.message,
      },
    });
    throw normalized;
  }

  let data = null;
  try {
    data = await res.json();
  } catch (_e) {
    const parseError = new Error(`Nieprawidłowa odpowiedź serwera (${res.status}).`);
    logEvent({
      level: 'error',
      category: 'api',
      action: `api.${path}.error`,
      message: `Nieprawidłowa odpowiedź API: ${path}`,
      details: {
        path,
        status: res.status,
        durationMs: Date.now() - startedAt,
      },
    });
    throw parseError;
  }

  if (!res.ok) {
    const apiError = new Error(data?.error || `Błąd serwera (${res.status}).`);
    logEvent({
      level: 'error',
      category: 'api',
      action: `api.${path}.error`,
      message: `Błąd API: ${path}`,
      details: {
        path,
        status: res.status,
        durationMs: Date.now() - startedAt,
        error: data?.error || apiError.message,
      },
    });
    throw apiError;
  }

  logEvent({
    level: 'system',
    category: 'api',
    action: `api.${path}.response`,
    message: `Odpowiedź API: ${path}`,
    details: {
      path,
      status: res.status,
      durationMs: Date.now() - startedAt,
      meta: data?.meta || null,
    },
  });

  return data;
}

export async function testSellasistConnection(config) {
  if (isDemoMode(config)) {
    return getDemoConnectionResult();
  }

  return callApi('sellasist-test', {
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

  return callApi(
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

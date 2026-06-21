import { getDemoClientsConnectionResult, getDemoClients } from '../data/sellasistDemoClients';
import { isDemoMode } from './useSellasistConfig';
import { logEvent } from '../utils/eventLog';
import { normalizeSellasistApiErrorMessage } from './useSellasistApi';

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function buildConfig(config) {
  let account = String(config?.account || '').trim().toLowerCase();
  account = account.replace(/^https?:\/\//, '');
  account = account.replace(/\.sellasist\.pl\/?.*$/, '');
  account = account.replace(/\/.*$/, '');
  return { ...config, account };
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
    logEvent({
      level: 'error',
      category: 'api',
      action: `api.${path}.error`,
      message: `Błąd połączenia API: ${path}`,
      details: { path, durationMs: Date.now() - startedAt, error: err.message },
    });
    throw err;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const account = buildConfig(payload).account;
    const rawError = data?.error || `Błąd serwera (${res.status}).`;
    throw new Error(normalizeSellasistApiErrorMessage(rawError, account));
  }

  logEvent({
    level: 'system',
    category: 'api',
    action: `api.${path}.response`,
    message: `Odpowiedź API: ${path}`,
    details: { path, status: res.status, durationMs: Date.now() - startedAt },
  });

  return data;
}

export async function fetchSellasistClients(config, params = {}, options = {}) {
  if (isDemoMode(config)) {
    return getDemoClients(params.limit ?? 50, params.offset ?? 0);
  }

  return callApi(
    'sellasist-users',
    {
      account: buildConfig(config).account,
      apiKey: config.apiKey,
      params,
    },
    options
  );
}

export { getDemoClientsConnectionResult };

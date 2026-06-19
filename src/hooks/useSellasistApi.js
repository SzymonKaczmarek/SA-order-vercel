import { getDemoConnectionResult, getDemoOrders } from '../data/sellasistDemo';
import { isDemoMode } from './useSellasistConfig';

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export async function testSellasistConnection(config) {
  if (isDemoMode(config)) {
    return getDemoConnectionResult();
  }

  const res = await fetch(`${getBaseUrl()}/.netlify/functions/sellasist-test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: config.account,
      apiKey: config.apiKey,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Nie udało się połączyć z Sellasist.');
  }

  return data;
}

export async function fetchSellasistOrders(config, params = {}) {
  if (isDemoMode(config)) {
    return getDemoOrders(params.limit ?? 25, params.offset ?? 0, {
      from_id: params.from_id,
      idRange: params.idRange,
    });
  }

  const res = await fetch(`${getBaseUrl()}/.netlify/functions/sellasist-orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account: config.account,
      apiKey: config.apiKey,
      params,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Nie udało się pobrać zamówień.');
  }

  return data;
}

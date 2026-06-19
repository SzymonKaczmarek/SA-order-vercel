const STORAGE_KEY = 'saor_orders_local_db';

function getConfigKey(config) {
  if (config?.useDemoData) return 'demo';
  return (config?.account || 'unknown').trim().toLowerCase();
}

function buildEntryKey(accessAccountId, config) {
  return `${accessAccountId || 'default'}::${getConfigKey(config)}`;
}

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

function readAllEntries() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY), {});
}

function writeAllEntries(all) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function migrateLegacyOrdersCache(accessAccountId) {
  if (typeof window === 'undefined' || !accessAccountId) return;

  const all = readAllEntries();
  const hasTenantPrefix = Object.keys(all).some((key) => key.includes('::'));
  if (hasTenantPrefix) return;

  const next = {};
  Object.entries(all).forEach(([sellasistKey, entry]) => {
    next[buildEntryKey(accessAccountId, { account: sellasistKey === 'demo' ? '' : sellasistKey, useDemoData: sellasistKey === 'demo' })] = entry;
  });

  if (Object.keys(next).length > 0) {
    writeAllEntries(next);
  }
}

export function readOrdersCache(accessAccountId, config) {
  if (typeof window === 'undefined' || !config || !accessAccountId) return null;

  migrateLegacyOrdersCache(accessAccountId);

  try {
    const all = readAllEntries();
    const key = buildEntryKey(accessAccountId, config);
    return all[key] || null;
  } catch (_e) {
    return null;
  }
}

export function writeOrdersCache(accessAccountId, config, payload) {
  if (typeof window === 'undefined' || !config || !accessAccountId) return null;

  const key = buildEntryKey(accessAccountId, config);
  const entry = {
    fetchedAt: new Date().toISOString(),
    account: config.account || '',
    useDemoData: Boolean(config.useDemoData),
    accessAccountId,
    orders: payload.orders || [],
    raw: payload.raw ?? null,
    meta: payload.meta ?? null,
    count: Array.isArray(payload.orders) ? payload.orders.length : 0,
  };

  try {
    const all = readAllEntries();
    all[key] = entry;
    writeAllEntries(all);
    return entry;
  } catch (_e) {
    return null;
  }
}

export function clearOrdersCache(accessAccountId, config) {
  if (typeof window === 'undefined' || !config || !accessAccountId) return false;

  try {
    const all = readAllEntries();
    const key = buildEntryKey(accessAccountId, config);
    if (!(key in all)) return true;

    delete all[key];
    writeAllEntries(all);
    return true;
  } catch (_e) {
    return false;
  }
}

export function formatFetchedAt(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pl-PL');
}

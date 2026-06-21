import { getAccessAccountDisplayName, readAccessAccountsStore } from '../data/accessAccounts';

const LOCAL_LOG_KEY = 'saor_event_log';
const AUTH_STORAGE_KEY = 'saor_logged_user';
const MAX_LOCAL_ENTRIES = 300;
const MAX_SERVER_ENTRIES = 500;

const SENSITIVE_KEYS = new Set([
  'password',
  'apikey',
  'api_key',
  'apiKey',
  'token',
  'secret',
  'authorization',
]);

const listeners = new Set();

function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function generateId() {
  return `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

function isSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase();
  return SENSITIVE_KEYS.has(normalized) || normalized.includes('password') || normalized.includes('secret');
}

export function sanitizeLogDetails(value, depth = 0) {
  if (depth > 4) return '[zagnieżdżone]';
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeLogDetails(item, depth + 1));
  }
  if (typeof value !== 'object') {
    if (typeof value === 'string' && value.length > 500) {
      return `${value.slice(0, 500)}…`;
    }
    return value;
  }

  const out = {};
  Object.entries(value).forEach(([key, item]) => {
    if (isSensitiveKey(key)) {
      out[key] = '[ukryte]';
      return;
    }
    out[key] = sanitizeLogDetails(item, depth + 1);
  });
  return out;
}

function getLogContext() {
  if (typeof window === 'undefined') {
    return {
      username: null,
      accessAccountId: null,
      accessAccountName: null,
    };
  }

  const user = safeParse(window.localStorage.getItem(AUTH_STORAGE_KEY), null);
  const store = readAccessAccountsStore();
  const activeAccount =
    store.accounts.find((item) => item.id === store.activeId) || null;

  return {
    username: user?.username || null,
    accessAccountId: user?.accessAccountId || store.activeId || null,
    accessAccountName: activeAccount ? getAccessAccountDisplayName(activeAccount) : null,
  };
}

function readLocalEntries() {
  if (typeof window === 'undefined') return [];
  const data = safeParse(window.localStorage.getItem(LOCAL_LOG_KEY), { entries: [] });
  return Array.isArray(data.entries) ? data.entries : [];
}

function writeLocalEntries(entries) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    LOCAL_LOG_KEY,
    JSON.stringify({ entries: entries.slice(0, MAX_LOCAL_ENTRIES) })
  );
}

function notifyListeners(entry) {
  listeners.forEach((listener) => {
    try {
      listener(entry);
    } catch (_e) {
      // ignorujemy błędy subskrybentów
    }
  });
}

async function appendEventLogToServer(entry) {
  const res = await fetch(`${getBaseUrl()}/api/app-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'append_event_log', entry }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Błąd zapisu logu (${res.status})`);
  }
}

export function subscribeEventLog(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readLocalEventLogs() {
  return readLocalEntries();
}

export async function fetchEventLogsFromServer() {
  const res = await fetch(`${getBaseUrl()}/api/app-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_event_logs' }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Błąd odczytu logu (${res.status})`);
  }

  return Array.isArray(data?.data?.entries) ? data.data.entries : [];
}

export async function clearAllEventLogs({ adminUsername, adminPassword } = {}) {
  writeLocalEntries([]);

  const res = await fetch(`${getBaseUrl()}/api/app-db`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'clear_event_logs',
      adminUsername,
      adminPassword,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Błąd czyszczenia logu (${res.status})`);
  }
}

export function mergeEventLogs(localEntries, serverEntries) {
  const map = new Map();
  [...localEntries, ...serverEntries].forEach((entry) => {
    if (entry?.id) {
      map.set(entry.id, entry);
    }
  });

  return [...map.values()].sort((a, b) => {
    const aTs = new Date(a.ts || 0).getTime();
    const bTs = new Date(b.ts || 0).getTime();
    return bTs - aTs;
  });
}

export async function logEvent({
  level = 'info',
  category = 'system',
  action,
  message,
  details = null,
}) {
  if (typeof window === 'undefined') {
    return null;
  }

  const entry = {
    id: generateId(),
    ts: new Date().toISOString(),
    level,
    category,
    action: String(action || 'unknown'),
    message: String(message || ''),
    ...getLogContext(),
    details: details ? sanitizeLogDetails(details) : null,
  };

  const next = [entry, ...readLocalEntries()].slice(0, MAX_LOCAL_ENTRIES);
  writeLocalEntries(next);
  notifyListeners(entry);

  appendEventLogToServer(entry).catch(() => {
    // lokalna kopia zostaje — synchronizacja przy odświeżeniu strony logów
  });

  return entry;
}

export const LOG_LEVELS = ['info', 'warn', 'error', 'system'];
export const LOG_CATEGORIES = ['auth', 'account', 'config', 'orders', 'api', 'db', 'system'];
export const MAX_SERVER_ENTRIES_EXPORT = MAX_SERVER_ENTRIES;

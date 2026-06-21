import { formatDownloadScopeSummary } from './bulkOrderDownload';

const STORAGE_KEY = 'saor_bulk_import_resume';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return fallback;
  }
}

function readStore() {
  if (typeof window === 'undefined') return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY), {});
}

function writeStore(store) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readBulkImportResume(accessAccountId) {
  if (!accessAccountId) return null;
  const store = readStore();
  const entry = store[accessAccountId];
  if (!entry || typeof entry !== 'object') return null;
  if (!entry.downloadScope || !entry.destination) return null;
  return entry;
}

export function writeBulkImportResume(accessAccountId, payload) {
  if (!accessAccountId || !payload) return;
  const store = readStore();
  store[accessAccountId] = {
    ...payload,
    pausedAt: new Date().toISOString(),
  };
  writeStore(store);
}

export function clearBulkImportResume(accessAccountId) {
  if (!accessAccountId) return;
  const store = readStore();
  if (!store[accessAccountId]) return;
  delete store[accessAccountId];
  writeStore(store);
}

export function formatBulkImportResumeSummary(resume) {
  if (!resume) return '';
  const scope = formatDownloadScopeSummary(resume.downloadScope);
  const count = Number(resume.fetchedTotal) || 0;
  const dest =
    resume.destination === 'server'
      ? 'baza danych'
      : resume.destination === 'both'
        ? 'bufor + baza'
        : 'bufor lokalny';
  return `${scope} · pobrano ${count} · zapis: ${dest}`;
}

export const DEFAULT_IMPORT_PAGE_SIZE = 50;
export const DEFAULT_IMPORT_MAX_REQUESTS_PER_MINUTE = 150;

export const MIN_IMPORT_PAGE_SIZE = 1;
export const MAX_IMPORT_PAGE_SIZE = 500;
export const MIN_IMPORT_MAX_REQUESTS_PER_MINUTE = 1;
export const MAX_IMPORT_MAX_REQUESTS_PER_MINUTE = 300;

function parsePositiveInt(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min) {
    return fallback;
  }
  return Math.min(num, max);
}

export function normalizeImportLimits(raw = {}) {
  return {
    importPageSize: parsePositiveInt(
      raw.importPageSize,
      DEFAULT_IMPORT_PAGE_SIZE,
      MIN_IMPORT_PAGE_SIZE,
      MAX_IMPORT_PAGE_SIZE
    ),
    importMaxRequestsPerMinute: parsePositiveInt(
      raw.importMaxRequestsPerMinute,
      DEFAULT_IMPORT_MAX_REQUESTS_PER_MINUTE,
      MIN_IMPORT_MAX_REQUESTS_PER_MINUTE,
      MAX_IMPORT_MAX_REQUESTS_PER_MINUTE
    ),
  };
}

export function getImportLimitsFromConfig(config) {
  const normalized = normalizeImportLimits(config);
  return {
    pageSize: normalized.importPageSize,
    maxRequestsPerMinute: normalized.importMaxRequestsPerMinute,
    importPageSize: normalized.importPageSize,
    importMaxRequestsPerMinute: normalized.importMaxRequestsPerMinute,
  };
}

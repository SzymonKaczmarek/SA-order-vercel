const PG_HINTS = {
  '22P02': 'Dane zawierają niedozwolone znaki lub niepoprawny format JSON (np. null byte z API Sellasist).',
  '23505': 'Konflikt unikalności — taki rekord już istnieje w bazie.',
  '23503': 'Brak powiązanego rekordu (klucz obcy).',
  '08006': 'Utracono połączenie z bazą Neon — spróbuj ponownie za chwilę.',
  '08001': 'Nie można połączyć się z bazą Neon — sprawdź DATABASE_URL i status Neon.',
  '53300': 'Zbyt wiele połączeń do bazy — odczekaj chwilę i spróbuj ponownie.',
  '57014': 'Zapytanie przerwane (timeout) — zbyt duży zapis, spróbuj mniejszą partią.',
  ETIMEDOUT: 'Timeout połączenia z bazą danych.',
  ECONNREFUSED: 'Serwer bazy odrzucił połączenie — sprawdź konfigurację Neon.',
  ENOTFOUND: 'Nie znaleziono hosta bazy danych — błędny connection string.',
};

function enrichDbError(err, phase, extra = {}) {
  if (!err || err.phase) {
    return err;
  }

  const wrapped = err instanceof Error ? err : new Error(String(err));
  wrapped.phase = phase;
  wrapped.errorCode = err.code || err.errorCode || null;
  wrapped.details = { ...(err.details || {}), ...extra };

  if (extra.sellasistId) {
    wrapped.details.sellasistId = extra.sellasistId;
  }
  if (extra.batchIndex != null) {
    wrapped.details.batchIndex = extra.batchIndex;
  }
  if (extra.scopeKey) {
    wrapped.details.scopeKey = extra.scopeKey;
  }

  return wrapped;
}

function formatDbError(err, fallbackPhase = '') {
  const phase = err?.phase || fallbackPhase || 'database';
  const code = err?.errorCode || err?.code || '';
  const technical = String(err?.message || err || 'Nieznany błąd bazy').trim();
  const hint = PG_HINTS[code] || PG_HINTS[technical] || '';

  const phaseLabels = {
    orders_scopes: 'zapis metadanych scope (orders_scopes)',
    orders_delete: 'czyszczenie starych zamówień',
    orders_insert: 'zapis wierszy zamówień (orders)',
    order_encode: 'przygotowanie JSON pojedynczego zamówienia',
    database: 'operacja na bazie',
  };

  const phaseLabel = phaseLabels[phase] || phase;
  let message = `Błąd bazy podczas: ${phaseLabel}. ${technical}`;

  if (err?.details?.scopeKey) {
    message += ` Scope: ${err.details.scopeKey}.`;
  }
  if (err?.details?.sellasistId) {
    message += ` Zamówienie ID: ${err.details.sellasistId}.`;
  }
  if (err?.details?.batchIndex != null) {
    message += ` Partia: ${err.details.batchIndex + 1}.`;
  }
  if (err?.details?.ordersCount != null) {
    message += ` Liczba zamówień: ${err.details.ordersCount}.`;
  }
  if (hint) {
    message += ` ${hint}`;
  }

  return {
    error: message,
    errorCode: code || null,
    phase,
    hint: hint || null,
    technical,
    details: err?.details || null,
  };
}

module.exports = {
  enrichDbError,
  formatDbError,
};

export function getMaxNumericOrderId(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return null;
  }

  let max = null;
  ids.forEach((raw) => {
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 1) {
      return;
    }
    if (max == null || num > max) {
      max = num;
    }
  });

  return max;
}

export function resolveContinueFromStored(destination, bounds = {}) {
  const localMax = bounds.localMax != null ? Number(bounds.localMax) : null;
  const serverMax = bounds.serverMax != null ? Number(bounds.serverMax) : null;

  if (destination === 'local') {
    if (!Number.isFinite(localMax) || localMax < 1) {
      return {
        ok: false,
        error: 'Bufor lokalny jest pusty. Najpierw pobierz zamówienia lub wybierz inny zakres.',
      };
    }

    return {
      ok: true,
      fromId: localMax + 1,
      lastStoredId: localMax,
      storageSource: 'bufor lokalny',
    };
  }

  if (destination === 'server') {
    if (!Number.isFinite(serverMax) || serverMax < 1) {
      return {
        ok: false,
        error: 'Baza danych jest pusta. Najpierw pobierz zamówienia lub wybierz inny zakres.',
      };
    }

    return {
      ok: true,
      fromId: serverMax + 1,
      lastStoredId: serverMax,
      storageSource: 'baza danych',
    };
  }

  if (destination === 'both') {
    const candidates = [localMax, serverMax].filter((value) => Number.isFinite(value) && value >= 1);
    if (candidates.length === 0) {
      return {
        ok: false,
        error:
          'Bufor i baza są puste. Najpierw pobierz zamówienia lub wybierz inny zakres.',
      };
    }

    const lastStoredId = Math.max(...candidates);
    return {
      ok: true,
      fromId: lastStoredId + 1,
      lastStoredId,
      storageSource: 'bufor lokalny i baza danych',
    };
  }

  return { ok: false, error: 'Wybierz miejsce zapisu importu.' };
}

export function getContinueFromStoredPreview(destination, bounds = {}) {
  const resolved = resolveContinueFromStored(destination, bounds);
  if (!resolved.ok) {
    return resolved;
  }

  return {
    ok: true,
    preview: `Od ID ${resolved.fromId} (po ostatnim zapisanym: ${resolved.lastStoredId} w ${resolved.storageSource}) do końca listy w Sellasist`,
    ...resolved,
  };
}

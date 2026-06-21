function pickStoredBounds(destination, bounds = {}) {
  const localMin = bounds.localMin != null ? Number(bounds.localMin) : null;
  const localMax = bounds.localMax != null ? Number(bounds.localMax) : null;
  const serverMin = bounds.serverMin != null ? Number(bounds.serverMin) : null;
  const serverMax = bounds.serverMax != null ? Number(bounds.serverMax) : null;

  if (destination === 'local') {
    return {
      minStoredId: localMin,
      maxStoredId: localMax,
      storageSource: 'bufor lokalny',
    };
  }

  if (destination === 'server') {
    return {
      minStoredId: serverMin,
      maxStoredId: serverMax,
      storageSource: 'baza danych',
    };
  }

  if (destination === 'both') {
    const mins = [localMin, serverMin].filter((value) => Number.isFinite(value) && value >= 1);
    const maxes = [localMax, serverMax].filter((value) => Number.isFinite(value) && value >= 1);

    return {
      minStoredId: mins.length ? Math.min(...mins) : null,
      maxStoredId: maxes.length ? Math.max(...maxes) : null,
      storageSource: 'bufor lokalny i baza danych',
    };
  }

  return {
    minStoredId: null,
    maxStoredId: null,
    storageSource: '',
  };
}

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
  const { minStoredId, maxStoredId, storageSource } = pickStoredBounds(destination, bounds);

  if (!Number.isFinite(maxStoredId) || maxStoredId < 1) {
    if (destination === 'local') {
      return {
        ok: false,
        error:
          'Bufor lokalny jest pusty. Wybierz „Baza danych” jako miejsce zapisu albo najpierw pobierz dane do bufora.',
      };
    }

    if (destination === 'server') {
      return {
        ok: false,
        error: 'Baza danych jest pusta. Najpierw pobierz zamówienia lub wybierz inny zakres.',
      };
    }

    return {
      ok: false,
      error:
        'Brak zapisanych zamówień w buforze i bazie. Najpierw pobierz dane lub wybierz inny zakres.',
    };
  }

  const fromId = maxStoredId + 1;

  return {
    ok: true,
    minStoredId,
    maxStoredId,
    lastStoredId: maxStoredId,
    fromId,
    idRange: { from: fromId, to: null },
    storageSource,
  };
}

export function getContinueFromStoredPreview(destination, bounds = {}) {
  const resolved = resolveContinueFromStored(destination, bounds);
  if (!resolved.ok) {
    return resolved;
  }

  return {
    ok: true,
    preview: `Dobije brakujące najnowsze: od ID ${resolved.fromId} (po ostatnim zapisanym ${resolved.maxStoredId} w ${resolved.storageSource}). Nie uzupełnia starszych luk — do przerwanego importu służy „Wznów import”.`,
    ...resolved,
  };
}

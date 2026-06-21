import { BULK_MAX_REQUESTS_PER_MINUTE, BULK_PAGE_SIZE } from './bulkOrderDownload';

function formatCount(value) {
  return new Intl.NumberFormat('pl-PL').format(Number(value) || 0);
}

function formatEtaDetail(progress, etaSeconds) {
  const totalKnown = progress.totalKnown != null ? Number(progress.totalKnown) : null;
  const hasMore = progress.hasMore !== false;

  if (!hasMore) {
    return 'Import zakończony';
  }

  if (totalKnown != null && totalKnown > 0) {
    return 'Na podstawie tempa i pozostałej liczby zamówień';
  }

  if (etaSeconds != null && etaSeconds > 0) {
    return 'Szacunek dla co najmniej jednej kolejnej paczki — łączna liczba zamówień nieznana';
  }

  return 'Obliczanie…';
}

function formatEtaValue(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  if (safe <= 0) {
    return 'Zakończono';
  }
  if (safe < 60) {
    return `ok. ${safe} ${safe === 1 ? 'sekunda' : safe < 5 ? 'sekundy' : 'sekund'}`;
  }

  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  const minLabel = min === 1 ? 'minuta' : min < 5 ? 'minuty' : 'minut';

  if (sec <= 0) {
    return `ok. ${min} ${minLabel}`;
  }

  const secLabel = sec === 1 ? 'sekunda' : sec < 5 ? 'sekundy' : 'sekund';
  return `ok. ${min} ${minLabel} ${sec} ${secLabel}`;
}

function resolveRemainingPackages(progress) {
  const hasMore = progress.hasMore !== false;
  const totalKnown = progress.totalKnown != null ? Number(progress.totalKnown) : null;
  const fetchedTotal = Number(progress.fetchedTotal) || 0;

  if (!hasMore) {
    return { value: '0', detail: 'Wszystkie paczki zostały pobrane' };
  }

  if (totalKnown != null && totalKnown > 0) {
    const remainingOrders = Math.max(0, totalKnown - fetchedTotal);
    const remainingPackages = Math.ceil(remainingOrders / BULK_PAGE_SIZE);
    return {
      value: formatCount(remainingPackages),
      detail: `Po ${BULK_PAGE_SIZE} zamówień na paczkę · zostało ok. ${formatCount(remainingOrders)} zamówień`,
    };
  }

  return {
    value: 'Nie wiadomo',
    detail:
      'Sellasist nie podał łącznej liczby — kolejne paczki do momentu, gdy API zwróci krótszą listę',
  };
}

function resolveRemainingOrders(progress) {
  const hasMore = progress.hasMore !== false;
  const totalKnown = progress.totalKnown != null ? Number(progress.totalKnown) : null;
  const fetchedTotal = Number(progress.fetchedTotal) || 0;
  const lastBatchSize = Number(progress.lastBatchSize) || 0;

  if (!hasMore) {
    return { value: '0', detail: 'Nie ma już kolejnych zamówień do pobrania' };
  }

  if (totalKnown != null && totalKnown > 0) {
    const remaining = Math.max(0, totalKnown - fetchedTotal);
    return {
      value: formatCount(remaining),
      detail: `Z ${formatCount(totalKnown)} zamówień w sklepie`,
    };
  }

  const nextHint = lastBatchSize > 0 ? lastBatchSize : BULK_PAGE_SIZE;
  return {
    value: `co najmniej ${formatCount(nextHint)}`,
    detail: 'Pełna liczba nieznana — w kolejnej paczce może być do 50 zamówień',
  };
}

function resolveEta(progress) {
  const hasMore = progress.hasMore !== false;
  if (!hasMore) {
    return { value: 'Zakończono', detail: 'Wszystkie zaplanowane paczki pobrane' };
  }

  const etaSeconds = progress.etaSeconds != null ? Number(progress.etaSeconds) : null;
  if (etaSeconds != null && etaSeconds > 0) {
    return {
      value: formatEtaValue(etaSeconds),
      detail: formatEtaDetail(progress, etaSeconds),
    };
  }

  return {
    value: 'Obliczanie…',
    detail: 'Za chwilę pojawi się szacunek na podstawie tempa pobierania',
  };
}

function resolveProgress(progress) {
  const fetchedTotal = Number(progress.fetchedTotal) || 0;
  const totalKnown = progress.totalKnown != null ? Number(progress.totalKnown) : null;
  const hasMore = progress.hasMore !== false;
  const progressPercent = Number(progress.progressPercent) || 0;

  if (totalKnown != null && totalKnown > 0) {
    return {
      value: `${progressPercent}%`,
      detail: `${formatCount(fetchedTotal)} z ${formatCount(totalKnown)} zamówień`,
    };
  }

  return {
    value: formatCount(fetchedTotal),
    detail: hasMore
      ? 'Sellasist nie podał łącznej liczby — import trwa, dopóki API zwraca pełne paczki'
      : 'Import zakończony',
  };
}

function resolveApiUsage(progress) {
  const used = Number(progress.requestsThisMinute) || 0;
  const limit = BULK_MAX_REQUESTS_PER_MINUTE;
  const percent = Math.min(100, Math.round((used / limit) * 100));

  let loadHint = 'Niskie obciążenie';
  if (percent >= 90) {
    loadHint = 'Blisko limitu — import może na chwilę zwolnić';
  } else if (percent >= 60) {
    loadHint = 'Umiarkowane obciążenie';
  }

  return {
    value: `${used} z ${limit} żądań`,
    detail: `${percent}% bezpiecznego limitu w tej minucie · ${loadHint} (Sellasist: 300/min)`,
  };
}

/** Czytelne wiersze statystyk importu z Sellasist (modal + panel synchronizacji). */
export function getBulkImportProgressRows(progress = {}) {
  const packageNum = Number(progress.packageNum) || 0;
  const lastBatchSize = Number(progress.lastBatchSize) || 0;

  return [
    {
      id: 'progress',
      label: 'Postęp importu',
      ...resolveProgress(progress),
    },
    {
      id: 'package',
      label: 'Bieżąca paczka z API',
      value: `#${formatCount(packageNum)}`,
      detail:
        lastBatchSize > 0
          ? `${formatCount(lastBatchSize)} zamówień w tej paczce (maks. ${BULK_PAGE_SIZE} na żądanie)`
          : 'Oczekiwanie na odpowiedź API…',
    },
    {
      id: 'remaining-packages',
      label: 'Pozostałe paczki',
      ...resolveRemainingPackages(progress),
    },
    {
      id: 'remaining-orders',
      label: 'Pozostałe zamówienia',
      ...resolveRemainingOrders(progress),
    },
    {
      id: 'eta',
      label: 'Szacowany czas do końca',
      ...resolveEta(progress),
    },
    {
      id: 'api-usage',
      label: 'Obciążenie API',
      ...resolveApiUsage(progress),
    },
  ];
}

export function getBulkImportHeadline(progress = {}) {
  const packageNum = Number(progress.packageNum) || 0;
  const fetchedTotal = Number(progress.fetchedTotal) || 0;

  return `Paczka ${formatCount(packageNum)} · pobrano ${formatCount(fetchedTotal)} zamówień`;
}

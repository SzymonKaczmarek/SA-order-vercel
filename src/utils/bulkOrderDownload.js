/** Mniejsze paczki = szybsza odpowiedź funkcji Netlify (limit ~10 s na darmowym planie). */
const PAGE_SIZE = 50;
const MAX_REQUESTS_PER_MINUTE = 150;
const MINUTE_MS = 60_000;
const MAX_FETCH_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(err, signal) {
  if (signal?.aborted) return true;
  const msg = String(err?.message || err || '');
  return err?.name === 'AbortError' || /abort|anulow|terminated/i.test(msg);
}

async function fetchPageWithRetry(fetchPage, { signal }) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
    if (signal?.aborted) {
      throw new Error('Pobieranie anulowane.');
    }

    try {
      return await fetchPage();
    } catch (err) {
      if (isAbortError(err, signal)) {
        throw new Error('Pobieranie anulowane.');
      }

      lastError = err;
      if (attempt >= MAX_FETCH_RETRIES) break;
      await sleep(750 * attempt);
    }
  }

  throw lastError || new Error('Nie udało się pobrać paczki zamówień.');
}

class RequestRateLimiter {
  constructor(maxPerMinute) {
    this.max = maxPerMinute;
    this.timestamps = [];
  }

  async waitTurn() {
    while (true) {
      const now = Date.now();
      this.timestamps = this.timestamps.filter((t) => now - t < MINUTE_MS);

      if (this.timestamps.length < this.max) {
        this.timestamps.push(now);
        return;
      }

      const waitMs = MINUTE_MS - (now - this.timestamps[0]) + 250;
      await sleep(Math.max(waitMs, 500));
    }
  }
}

function formatEta(seconds) {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `~${seconds} s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `~${min} min ${sec} s` : `~${min} min`;
}

export const BULK_PAGE_SIZE = PAGE_SIZE;
export const BULK_MAX_REQUESTS_PER_MINUTE = MAX_REQUESTS_PER_MINUTE;

function getOrderNumericId(order) {
  const raw = order?.id ?? order?.order_id;
  if (raw == null || raw === '') return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

function filterOrdersByIdRange(orders, idRange) {
  if (!idRange) return orders;
  return orders.filter((order) => {
    const id = getOrderNumericId(order);
    return id != null && id >= idRange.from && id <= idRange.to;
  });
}

export function parseOrderIdRange(idFromInput, idToInput, { useRange }) {
  if (!useRange) {
    return { ok: true, range: null };
  }

  const fromStr = String(idFromInput ?? '').trim();
  const toStr = String(idToInput ?? '').trim();

  if (!fromStr || !toStr) {
    return { ok: false, error: 'Podaj oba końce zakresu ID (od i do).' };
  }

  const from = Number(fromStr);
  const to = Number(toStr);

  if (!Number.isInteger(from) || from < 1 || !Number.isInteger(to) || to < 1) {
    return { ok: false, error: 'ID muszą być dodatnimi liczbami całkowitymi.' };
  }

  if (from > to) {
    return { ok: false, error: 'ID „od” nie może być większe niż ID „do”.' };
  }

  return { ok: true, range: { from, to } };
}

export function parseLatestCountInput(input) {
  const raw = String(input ?? '').trim();

  if (!raw) {
    return { ok: false, error: 'Podaj liczbę ostatnich zamówień do pobrania.' };
  }

  const count = Number(raw);

  if (!Number.isInteger(count) || count < 1) {
    return { ok: false, error: 'Liczba musi być dodatnią liczbą całkowitą.' };
  }

  return { ok: true, count };
}

export function parseDownloadScope(scope, { idFrom, idTo, latestCount }) {
  if (scope === 'all') {
    return { ok: true, downloadScope: { type: 'all' } };
  }

  if (scope === 'latest') {
    const parsed = parseLatestCountInput(latestCount);
    if (!parsed.ok) return parsed;
    return { ok: true, downloadScope: { type: 'latest', latestCount: parsed.count } };
  }

  if (scope === 'idRange') {
    const parsed = parseOrderIdRange(idFrom, idTo, { useRange: true });
    if (!parsed.ok) return parsed;
    return { ok: true, downloadScope: { type: 'idRange', idRange: parsed.range } };
  }

  return { ok: false, error: 'Wybierz sposób pobierania zamówień.' };
}

export function formatDownloadScopeSummary(downloadScope) {
  if (!downloadScope || downloadScope.type === 'all') {
    return 'Wszystkie zamówienia';
  }

  if (downloadScope.type === 'latest') {
    return `Ostatnie ${downloadScope.latestCount} zamówień`;
  }

  if (downloadScope.type === 'idRange' && downloadScope.idRange) {
    return `ID ${downloadScope.idRange.from} – ${downloadScope.idRange.to}`;
  }

  return '—';
}

function buildFetchParams(offset, idRange, limit = PAGE_SIZE) {
  const params = { limit, offset };

  if (idRange?.from) {
    params.from_id = idRange.from - 1;
    params.idRange = idRange;
  }

  return params;
}

function shouldStopAfterBatch(rawBatch, idRange) {
  if (!idRange || rawBatch.length === 0) return false;

  const ids = rawBatch.map(getOrderNumericId).filter((id) => id != null);
  if (ids.length === 0) return false;

  const minId = Math.min(...ids);
  return minId > idRange.to;
}

export async function downloadAllOrders(
  config,
  fetchPage,
  { onProgress, onBatch, signal, downloadScope }
) {
  const idRange = downloadScope?.type === 'idRange' ? downloadScope.idRange : null;
  const latestCount = downloadScope?.type === 'latest' ? downloadScope.latestCount : null;

  const limiter = new RequestRateLimiter(MAX_REQUESTS_PER_MINUTE);
  let offset = 0;
  let packageNum = 0;
  let fetchedTotal = 0;
  const startTime = Date.now();
  let hasMore = true;
  let totalKnown =
    latestCount != null
      ? latestCount
      : idRange
        ? idRange.to - idRange.from + 1
        : null;
  let lastMeta = null;
  let lastRaw = null;

  while (hasMore) {
    if (signal?.aborted) {
      throw new Error('Pobieranie anulowane.');
    }

    if (latestCount != null && fetchedTotal >= latestCount) {
      break;
    }

    await limiter.waitTurn();
    packageNum += 1;

    const pageLimit =
      latestCount != null ? Math.min(PAGE_SIZE, latestCount - fetchedTotal) : PAGE_SIZE;

    const data = await fetchPageWithRetry(
      () => fetchPage(buildFetchParams(offset, idRange, pageLimit)),
      { signal }
    );
    const rawBatch = Array.isArray(data.orders) ? data.orders : [];
    let batch = filterOrdersByIdRange(rawBatch, idRange);

    if (latestCount != null) {
      const remaining = latestCount - fetchedTotal;
      if (remaining <= 0) break;
      if (batch.length > remaining) batch = batch.slice(0, remaining);
    }

    fetchedTotal += batch.length;
    lastMeta = data.meta ?? lastMeta;
    lastRaw = data.raw ?? lastRaw;

    if (data.demo && rawBatch.length >= PAGE_SIZE) {
      await sleep(500);
    }

    if (!idRange && !latestCount && data.total != null && totalKnown == null) {
      totalKnown = Number(data.total);
    }

    if (latestCount != null) {
      hasMore = fetchedTotal < latestCount && rawBatch.length >= pageLimit;
    } else if (idRange) {
      hasMore = rawBatch.length >= PAGE_SIZE && !shouldStopAfterBatch(rawBatch, idRange);
    } else {
      hasMore = rawBatch.length >= PAGE_SIZE;
    }

    const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
    const avgSecPerPackage = elapsedSec / packageNum;

    const remainingOrdersCount =
      totalKnown != null ? Math.max(0, totalKnown - fetchedTotal) : null;
    const remainingPackagesCount =
      remainingOrdersCount != null
        ? Math.ceil(remainingOrdersCount / PAGE_SIZE)
        : hasMore
          ? null
          : 0;

    const etaSeconds =
      hasMore && remainingPackagesCount != null
        ? Math.round(avgSecPerPackage * remainingPackagesCount)
        : hasMore
          ? Math.round(avgSecPerPackage)
          : 0;

    const progressPercent =
      totalKnown != null && totalKnown > 0
        ? Math.min(hasMore ? 99 : 100, Math.round((fetchedTotal / totalKnown) * 100))
        : hasMore
          ? Math.min(92, Math.round((packageNum / (packageNum + 1)) * 100))
          : 100;

    onProgress({
      packageNum,
      fetchedTotal,
      lastBatchSize: batch.length,
      hasMore,
      remainingPackages:
        remainingPackagesCount != null
          ? String(remainingPackagesCount)
          : hasMore
            ? '≥ 1'
            : '0',
      remainingOrders:
        remainingOrdersCount != null
          ? String(remainingOrdersCount)
          : hasMore
            ? `≥ ${PAGE_SIZE}`
            : '0',
      etaLabel: hasMore ? formatEta(etaSeconds) : 'Zakończono',
      progressPercent,
      requestsThisMinute: limiter.timestamps.length,
      status: hasMore ? 'downloading' : 'complete',
    });

    await onBatch?.({
      packageNum,
      batch,
      fetchedTotal,
      meta: lastMeta,
      apiRaw: lastRaw,
    });

    if (!hasMore) break;
    offset += PAGE_SIZE;
  }

  return {
    count: fetchedTotal,
    packages: packageNum,
    meta: lastMeta,
    apiRaw: lastRaw,
    total: totalKnown ?? fetchedTotal,
    downloadScope: downloadScope || { type: 'all' },
    idRange: idRange || null,
    latestCount: latestCount ?? null,
  };
}

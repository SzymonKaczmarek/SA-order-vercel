const PAGE_SIZE = 100;
const MAX_REQUESTS_PER_MINUTE = 150;
const MINUTE_MS = 60_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function buildFetchParams(offset, idRange) {
  const params = { limit: PAGE_SIZE, offset };

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

export async function downloadAllOrders(config, fetchPage, { onProgress, signal, idRange }) {
  const limiter = new RequestRateLimiter(MAX_REQUESTS_PER_MINUTE);
  let offset = 0;
  let packageNum = 0;
  const allOrders = [];
  const startTime = Date.now();
  let hasMore = true;
  let totalKnown = idRange ? idRange.to - idRange.from + 1 : null;
  let lastMeta = null;
  let lastRaw = null;

  while (hasMore) {
    if (signal?.aborted) {
      throw new Error('Pobieranie anulowane.');
    }

    await limiter.waitTurn();
    packageNum += 1;

    const data = await fetchPage(buildFetchParams(offset, idRange));
    const rawBatch = Array.isArray(data.orders) ? data.orders : [];
    const batch = filterOrdersByIdRange(rawBatch, idRange);
    allOrders.push(...batch);
    lastMeta = data.meta ?? lastMeta;
    lastRaw = data.raw ?? lastRaw;

    if (data.demo && rawBatch.length >= PAGE_SIZE) {
      await sleep(500);
    }

    if (!idRange && data.total != null && totalKnown == null) {
      totalKnown = Number(data.total);
    }

    if (idRange) {
      hasMore = rawBatch.length >= PAGE_SIZE && !shouldStopAfterBatch(rawBatch, idRange);
    } else {
      hasMore = rawBatch.length >= PAGE_SIZE;
    }

    const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000);
    const avgSecPerPackage = elapsedSec / packageNum;

    const remainingOrdersCount =
      totalKnown != null ? Math.max(0, totalKnown - allOrders.length) : null;
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
        ? Math.min(hasMore ? 99 : 100, Math.round((allOrders.length / totalKnown) * 100))
        : hasMore
          ? Math.min(92, Math.round((packageNum / (packageNum + 1)) * 100))
          : 100;

    onProgress({
      packageNum,
      fetchedTotal: allOrders.length,
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

    if (!hasMore) break;
    offset += PAGE_SIZE;
  }

  return {
    orders: allOrders,
    packages: packageNum,
    raw: allOrders,
    meta: lastMeta,
    apiRaw: lastRaw,
    total: totalKnown ?? allOrders.length,
    idRange: idRange || null,
  };
}

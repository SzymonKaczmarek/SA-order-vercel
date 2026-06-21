import { getImportLimitsFromConfig } from '../utils/sellasistImportLimits';

export async function downloadAllClients({
  config,
  destination = 'local',
  onProgress,
  signal,
  fetchPage,
  saveLocalBatch,
  saveServerBatch,
}) {
  const limits = getImportLimitsFromConfig(config);
  const pageSize = limits.pageSize;
  const maxRequestsPerMinute = limits.maxRequestsPerMinute;
  const minIntervalMs = Math.ceil(60000 / maxRequestsPerMinute);

  let offset = 0;
  let packageNum = 0;
  let fetchedTotal = 0;
  let lastRequestAt = 0;

  const progress = {
    phase: 'downloading',
    packageNum: 0,
    fetchedTotal: 0,
    progressPercent: 5,
    lastBatchSize: 0,
  };

  const report = (patch = {}) => {
    Object.assign(progress, patch);
    onProgress?.({ ...progress });
  };

  report();

  while (true) {
    if (signal?.aborted) {
      throw new Error('Pobieranie przerwane.');
    }

    const elapsed = Date.now() - lastRequestAt;
    if (lastRequestAt > 0 && elapsed < minIntervalMs) {
      await new Promise((resolve) => setTimeout(resolve, minIntervalMs - elapsed));
    }

    lastRequestAt = Date.now();
    const response = await fetchPage({ limit: pageSize, offset }, { signal });
    const batch = Array.isArray(response?.users) ? response.users : [];

    packageNum += 1;
    fetchedTotal += batch.length;

    if (destination === 'local' || destination === 'both') {
      await saveLocalBatch(batch, { replace: packageNum === 1 && offset === 0 });
    }

    if (destination === 'server' || destination === 'both') {
      await saveServerBatch(batch);
    }

    report({
      packageNum,
      fetchedTotal,
      lastBatchSize: batch.length,
      progressPercent: Math.min(95, 5 + packageNum * 3),
    });

    if (batch.length < pageSize) {
      break;
    }

    offset += batch.length;
  }

  report({ phase: 'done', progressPercent: 100 });
  return { fetchedTotal, packageNum };
}

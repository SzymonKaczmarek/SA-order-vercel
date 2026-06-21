const DIFF_COMPARE_CHUNK = 500;

function formatDiffEta(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return 'za chwilę';
  }

  const seconds = Math.ceil(remainingMs / 1000);
  if (seconds < 60) {
    return `~${seconds} s`;
  }

  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `~${min} min ${sec} s` : `~${min} min`;
}

function estimateDiffEta(startMs, percent) {
  if (!percent || percent >= 100) {
    return '—';
  }

  const elapsed = Date.now() - startMs;
  if (elapsed < 250) {
    return '…';
  }

  const totalEstimate = elapsed / (percent / 100);
  return formatDiffEta(totalEstimate - elapsed);
}

function yieldToUi() {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

export async function computeServerLoadDiff({
  scopeKey,
  listLocalOrderIds,
  probeServerOrders,
  listOrderIdsFromServerDb,
  onProgress,
  isCancelled,
}) {
  const startMs = Date.now();

  const report = (percent, label) => {
    if (isCancelled()) {
      return;
    }

    onProgress({
      progressPercent: Math.min(100, Math.max(0, percent)),
      progressLabel: label,
      etaLabel: estimateDiffEta(startMs, percent),
    });
  };

  report(5, 'Przygotowanie porównania…');

  let resolvedScopeKey = scopeKey;
  if (!resolvedScopeKey) {
    report(15, 'Sprawdzanie zakresu w bazie danych…');
    const resolved = await probeServerOrders();
    resolvedScopeKey = resolved?.scopeKey || null;
  }

  if (!resolvedScopeKey || isCancelled()) {
    return null;
  }

  report(28, 'Pobieranie listy ID z bazy danych…');
  const serverIds = await listOrderIdsFromServerDb(resolvedScopeKey);
  if (isCancelled()) {
    return null;
  }

  report(55, 'Pobieranie listy ID z lokalnego bufora…');
  const localKeys = await listLocalOrderIds(resolvedScopeKey);
  if (isCancelled()) {
    return null;
  }

  const localKeySet = new Set(localKeys);
  const serverKeySet = new Set(serverIds);
  const missingKeys = [];
  let matchedCount = 0;

  if (serverIds.length === 0) {
    report(90, 'Brak produktów w bazie danych — finalizowanie…');
  } else {
    for (let index = 0; index < serverIds.length; index += DIFF_COMPARE_CHUNK) {
      if (isCancelled()) {
        return null;
      }

      const chunk = serverIds.slice(index, index + DIFF_COMPARE_CHUNK);
      for (const id of chunk) {
        if (localKeySet.has(id)) {
          matchedCount += 1;
        } else {
          missingKeys.push(id);
        }
      }

      const processed = Math.min(index + chunk.length, serverIds.length);
      const comparePercent = 55 + Math.round((processed / serverIds.length) * 35);
      report(
        comparePercent,
        `Porównywanie ID… ${processed} / ${serverIds.length}`
      );
      await yieldToUi();
    }
  }

  let extraLocalCount = 0;
  if (localKeys.length > 0) {
    for (let index = 0; index < localKeys.length; index += DIFF_COMPARE_CHUNK) {
      if (isCancelled()) {
        return null;
      }

      const chunk = localKeys.slice(index, index + DIFF_COMPARE_CHUNK);
      for (const id of chunk) {
        if (!serverKeySet.has(id)) {
          extraLocalCount += 1;
        }
      }

      const processed = Math.min(index + chunk.length, localKeys.length);
      const finalizePercent = 92 + Math.round((processed / localKeys.length) * 7);
      report(finalizePercent, `Sprawdzanie rekordów tylko lokalnych… ${processed} / ${localKeys.length}`);
      await yieldToUi();
    }
  }

  report(100, 'Zliczono różnice');

  return {
    scopeKey: resolvedScopeKey,
    serverCount: serverIds.length,
    localCount: localKeys.length,
    matchedCount,
    missingCount: missingKeys.length,
    extraLocalCount,
    missingKeys,
  };
}

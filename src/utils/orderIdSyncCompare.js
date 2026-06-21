const DEFAULT_IDS_PAGE_SIZE = 5000;

export async function loadAllLocalOrderIds(listLocalOrderIds, scopeKey) {
  const ids = await listLocalOrderIds(scopeKey);
  return Array.isArray(ids) ? ids : [];
}

export async function loadAllServerOrderIds(listOrderIdsPage, scopeKey, pageSize = DEFAULT_IDS_PAGE_SIZE) {
  const serverKeys = new Set();
  let offset = 0;

  while (true) {
    const page = await listOrderIdsPage(scopeKey, { offset, limit: pageSize });
    const ids = Array.isArray(page?.ids) ? page.ids : Array.isArray(page) ? page : [];

    ids.forEach((id) => {
      if (id != null && id !== '') {
        serverKeys.add(String(id));
      }
    });

    if (ids.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return serverKeys;
}

export function diffOrderIdSets(localIds, serverKeysInput) {
  const localKeys = new Set(
    (Array.isArray(localIds) ? localIds : []).map((id) => String(id)).filter(Boolean)
  );
  const serverKeys =
    serverKeysInput instanceof Set
      ? serverKeysInput
      : new Set(
          (Array.isArray(serverKeysInput) ? serverKeysInput : [])
            .map((id) => String(id))
            .filter(Boolean)
        );

  const serverCount = serverKeys.size;
  const localCount = localKeys.size;
  let matchedCount = 0;
  let missingInLocal = 0;

  serverKeys.forEach((id) => {
    if (localKeys.has(id)) {
      matchedCount += 1;
      return;
    }
    missingInLocal += 1;
  });

  let missingInServer = 0;
  localKeys.forEach((id) => {
    if (!serverKeys.has(id)) {
      missingInServer += 1;
    }
  });

  return {
    serverCount,
    localCount,
    matchedCount,
    missingInLocal,
    missingInServer,
  };
}

export async function compareLocalAndServerOrderIds({
  scopeKey,
  listLocalOrderIds,
  listOrderIdsPage,
  pageSize = DEFAULT_IDS_PAGE_SIZE,
}) {
  const localIds = await loadAllLocalOrderIds(listLocalOrderIds, scopeKey);
  const serverKeys = await loadAllServerOrderIds(listOrderIdsPage, scopeKey, pageSize);
  return diffOrderIdSets(localIds, serverKeys);
}

export function listMissingInLocal(localIds, serverKeysInput) {
  const localKeys = new Set(
    (Array.isArray(localIds) ? localIds : []).map((id) => String(id)).filter(Boolean)
  );
  const serverKeys =
    serverKeysInput instanceof Set
      ? serverKeysInput
      : new Set(
          (Array.isArray(serverKeysInput) ? serverKeysInput : [])
            .map((id) => String(id))
            .filter(Boolean)
        );

  return [...serverKeys].filter((id) => !localKeys.has(id));
}

export function listMissingInServer(localIds, serverKeysInput) {
  const localKeys = (Array.isArray(localIds) ? localIds : []).map((id) => String(id)).filter(Boolean);
  const serverKeys =
    serverKeysInput instanceof Set
      ? serverKeysInput
      : new Set(
          (Array.isArray(serverKeysInput) ? serverKeysInput : [])
            .map((id) => String(id))
            .filter(Boolean)
        );

  return localKeys.filter((id) => !serverKeys.has(id));
}

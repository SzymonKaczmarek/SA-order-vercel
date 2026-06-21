function clientName(client) {
  const person = [client?.name, client?.surname].filter(Boolean).join(' ').trim();
  if (person) return person;
  return String(client?.company_name || '').trim();
}

const CLIENT_SORT_FIELDS = ['id', 'email', 'surname', 'name', 'company'];

function normalizeClientSort(sort) {
  const field = CLIENT_SORT_FIELDS.includes(sort?.field) ? sort.field : 'id';
  const direction = sort?.direction === 'asc' ? 'asc' : 'desc';
  return { field, direction };
}

function compareClients(a, b, sortInput) {
  const sort = normalizeClientSort(sortInput);
  const dir = sort.direction === 'asc' ? 1 : -1;

  if (sort.field === 'email') {
    const cmp = String(a?.email || '')
      .toLocaleLowerCase('pl')
      .localeCompare(String(b?.email || '').toLocaleLowerCase('pl'), 'pl');
    if (cmp !== 0) return cmp * dir;
  }

  if (sort.field === 'surname') {
    const cmp = String(a?.surname || '')
      .toLocaleLowerCase('pl')
      .localeCompare(String(b?.surname || '').toLocaleLowerCase('pl'), 'pl');
    if (cmp !== 0) return cmp * dir;
  }

  if (sort.field === 'name') {
    const cmp = String(a?.name || '')
      .toLocaleLowerCase('pl')
      .localeCompare(String(b?.name || '').toLocaleLowerCase('pl'), 'pl');
    if (cmp !== 0) return cmp * dir;
  }

  if (sort.field === 'company') {
    const cmp = String(a?.company_name || '')
      .toLocaleLowerCase('pl')
      .localeCompare(String(b?.company_name || '').toLocaleLowerCase('pl'), 'pl');
    if (cmp !== 0) return cmp * dir;
  }

  const idA = Number(a?.id ?? a?.user_id);
  const idB = Number(b?.id ?? b?.user_id);
  const left = Number.isFinite(idA) ? idA : 0;
  const right = Number.isFinite(idB) ? idB : 0;
  if (left !== right) return (left - right) * dir;

  return String(a?.email || '').localeCompare(String(b?.email || ''), 'pl');
}

function sortClientsList(clients, sortInput) {
  const list = Array.isArray(clients) ? [...clients] : [];
  list.sort((a, b) => compareClients(a, b, sortInput));
  return list;
}

function normalizeSortQuery({ sortBy, sortDir } = {}) {
  const field = CLIENT_SORT_FIELDS.includes(sortBy) ? sortBy : 'id';
  const direction = sortDir === 'asc' ? 'asc' : 'desc';
  return { sortBy: field, sortDir: direction };
}

module.exports = {
  normalizeClientSort,
  normalizeSortQuery,
  sortClientsList,
  clientName,
};

function extractStatusLabel(order) {
  if (order?.status && typeof order.status === 'object') {
    const name = String(order.status.name || '').trim();
    if (name) return name;
  }
  return String(order?.status_name || order?.status_label || order?.status || '').trim();
}

function customerName(order) {
  const bill = order?.bill_address;
  if (!bill) return '';
  const person = [bill.name, bill.surname].filter(Boolean).join(' ').trim();
  if (person) return person;
  return String(bill.company_name || '').trim();
}

const ORDER_SORT_FIELDS = ['date', 'id', 'status', 'surname', 'amount'];

function normalizeOrderSort(sort) {
  const field = ORDER_SORT_FIELDS.includes(sort?.field) ? sort.field : 'date';
  const direction = sort?.direction === 'asc' ? 'asc' : 'desc';
  return { field, direction };
}

function compareOrders(a, b, sortInput) {
  const sort = normalizeOrderSort(sortInput);
  const dir = sort.direction === 'asc' ? 1 : -1;

  if (sort.field === 'status') {
    const cmp = extractStatusLabel(a).toLocaleLowerCase('pl').localeCompare(
      extractStatusLabel(b).toLocaleLowerCase('pl'),
      'pl'
    );
    if (cmp !== 0) return cmp * dir;
  }

  if (sort.field === 'surname') {
    const cmp = customerName(a).toLocaleLowerCase('pl').localeCompare(
      customerName(b).toLocaleLowerCase('pl'),
      'pl'
    );
    if (cmp !== 0) return cmp * dir;
  }

  if (sort.field === 'amount') {
    const left = Number(a?.total);
    const right = Number(b?.total);
    const l = Number.isFinite(left) ? left : 0;
    const r = Number.isFinite(right) ? right : 0;
    if (l !== r) return (l - r) * dir;
  }

  if (sort.field === 'date') {
    const rawA = a?.date || a?.created_at || a?.date_add;
    const rawB = b?.date || b?.created_at || b?.date_add;
    const l = rawA ? new Date(rawA).getTime() : 0;
    const r = rawB ? new Date(rawB).getTime() : 0;
    const left = Number.isNaN(l) ? 0 : l;
    const right = Number.isNaN(r) ? 0 : r;
    if (left !== right) return (left - right) * dir;
  }

  if (sort.field === 'id') {
    const idA = Number(a?.id ?? a?.order_id);
    const idB = Number(b?.id ?? b?.order_id);
    const l = Number.isFinite(idA) ? idA : 0;
    const r = Number.isFinite(idB) ? idB : 0;
    if (l !== r) return (l - r) * dir;
  }

  const idA = Number(a?.id ?? a?.order_id);
  const idB = Number(b?.id ?? b?.order_id);
  if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
    return idB - idA;
  }

  return 0;
}

function sortOrdersList(orders, sortInput) {
  const list = Array.isArray(orders) ? [...orders] : [];
  list.sort((a, b) => compareOrders(a, b, sortInput));
  return list;
}

function normalizeSortQuery({ sortBy, sortDir } = {}) {
  const field = ORDER_SORT_FIELDS.includes(sortBy) ? sortBy : 'date';
  const direction = sortDir === 'asc' ? 'asc' : 'desc';
  return { sortBy: field, sortDir: direction };
}

module.exports = {
  normalizeOrderSort,
  normalizeSortQuery,
  sortOrdersList,
};

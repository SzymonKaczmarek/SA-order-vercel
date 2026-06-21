import {
  normalizeOrderSort as normalizeOrderSortBase,
  sortOrdersList as sortOrdersListBase,
} from '../../lib/sortOrders';

export const ORDER_SORT_FIELDS = [
  { id: 'date', label: 'Data' },
  { id: 'status', label: 'Status' },
  { id: 'surname', label: 'Nazwisko' },
  { id: 'amount', label: 'Kwota' },
];

export const DEFAULT_ORDER_SORT = {
  field: 'date',
  direction: 'desc',
};

export function normalizeOrderSort(sort) {
  if (ORDER_SORT_FIELDS.some((item) => item.id === sort?.field)) {
    return normalizeOrderSortBase(sort);
  }
  return DEFAULT_ORDER_SORT;
}

export function sortOrdersList(orders, sortInput) {
  return sortOrdersListBase(orders, normalizeOrderSort(sortInput));
}

export function getOrderSortLabel(sortInput) {
  const sort = normalizeOrderSort(sortInput);
  const field = ORDER_SORT_FIELDS.find((item) => item.id === sort.field);
  const dir = sort.direction === 'asc' ? 'rosnąco' : 'malejąco';
  return `${field?.label || 'Data'} (${dir})`;
}

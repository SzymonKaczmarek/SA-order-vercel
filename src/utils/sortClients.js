import {
  normalizeClientSort as normalizeClientSortBase,
  sortClientsList as sortClientsListBase,
} from '../../lib/sortClients';

export const CLIENT_SORT_FIELDS = [
  { id: 'id', label: 'ID' },
  { id: 'email', label: 'E-mail' },
  { id: 'surname', label: 'Nazwisko' },
  { id: 'name', label: 'Imię' },
  { id: 'company', label: 'Firma' },
];

export const DEFAULT_CLIENT_SORT = {
  field: 'id',
  direction: 'desc',
};

export function normalizeClientSort(sort) {
  if (CLIENT_SORT_FIELDS.some((item) => item.id === sort?.field)) {
    return normalizeClientSortBase(sort);
  }
  return DEFAULT_CLIENT_SORT;
}

export function sortClientsList(clients, sortInput) {
  return sortClientsListBase(clients, normalizeClientSort(sortInput));
}

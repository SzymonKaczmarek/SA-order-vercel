import { getClientFullName, getClientPhone } from './clientFormat';

export const EMPTY_CLIENT_FILTERS = {
  clientId: '',
  email: '',
  surname: '',
  phone: '',
  city: '',
  nip: '',
};

const MIN_TEXT_FILTER_LENGTH = 3;

function isDeferredTextFilter(value) {
  const text = String(value || '').trim();
  return text.length >= MIN_TEXT_FILTER_LENGTH;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function getClientIdText(client) {
  const id = client?.id ?? client?.user_id;
  if (id == null || id === '') {
    return '';
  }
  return String(id);
}

function getClientSearchText(client) {
  return [client?.name, client?.surname, client?.company_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function filterClients(clients, filters) {
  if (!filters) return clients;

  return clients.filter((client) => {
    if (isDeferredTextFilter(filters.clientId)) {
      const query = String(filters.clientId).trim();
      if (!getClientIdText(client).includes(query)) return false;
    }

    if (isDeferredTextFilter(filters.surname)) {
      const query = String(filters.surname).toLowerCase().trim();
      if (!getClientSearchText(client).includes(query)) return false;
    }

    if (filters.email) {
      const email = String(client.email || '').toLowerCase();
      if (!email.includes(String(filters.email).toLowerCase().trim())) return false;
    }

    if (filters.phone) {
      const phone = normalizePhone(getClientPhone(client));
      const query = normalizePhone(filters.phone);
      if (!phone.includes(query)) return false;
    }

    if (filters.city) {
      const city = String(client.city || '').toLowerCase();
      if (!city.includes(String(filters.city).toLowerCase().trim())) return false;
    }

    if (filters.nip) {
      const nip = normalizePhone(client.company_nip || client.nip);
      const query = normalizePhone(filters.nip);
      if (!nip.includes(query)) return false;
    }

    return true;
  });
}

export function hasActiveClientFilters(filters) {
  if (!filters) return false;

  return Object.entries(filters).some(([key, value]) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (key === 'clientId' || key === 'surname') {
      return text.length >= MIN_TEXT_FILTER_LENGTH;
    }
    return true;
  });
}

export function getClientDisplayName(client) {
  return getClientFullName(client);
}

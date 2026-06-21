import { getCustomerFullName, getOrderPhone, getOrderStatusLabel } from './orderFormat';

export const EMPTY_FILTERS = {
  status: '',
  orderId: '',
  surname: '',
  amountFrom: '',
  amountTo: '',
  dateFrom: '',
  dateTo: '',
  email: '',
  phone: '',
};

const MIN_TEXT_FILTER_LENGTH = 3;

function isDeferredTextFilter(value) {
  const text = String(value || '').trim();
  return text.length >= MIN_TEXT_FILTER_LENGTH;
}

function parseOrderDate(order) {
  const raw = order.date || order.created_at || order.date_add;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function getCustomerFilterText(order) {
  const bill = order?.bill_address;
  if (!bill) {
    return getCustomerFullName(order).toLowerCase();
  }

  return [bill.surname, bill.name, bill.company_name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getOrderIdText(order) {
  const id = order?.id ?? order?.order_id;
  if (id == null || id === '') {
    return '';
  }
  return String(id);
}

export function getUniqueOrderStatuses(orders) {
  const set = new Set();
  orders.forEach((order) => {
    const label = getOrderStatusLabel(order);
    if (label && label !== '—') set.add(String(label));
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
}

export function mergeStatusFilterOptions(statuses, selectedStatus = '') {
  const set = new Set(Array.isArray(statuses) ? statuses : []);
  const selected = String(selectedStatus || '').trim();
  if (selected) {
    set.add(selected);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pl'));
}

export function filterOrders(orders, filters) {
  if (!filters) return orders;

  return orders.filter((order) => {
    if (filters.status) {
      if (getOrderStatusLabel(order) !== filters.status) return false;
    }

    if (isDeferredTextFilter(filters.orderId)) {
      const query = String(filters.orderId).trim();
      const id = getOrderIdText(order);
      if (!id.includes(query)) return false;
    }

    if (isDeferredTextFilter(filters.surname)) {
      const query = String(filters.surname).toLowerCase().trim();
      if (!getCustomerFilterText(order).includes(query)) return false;
    }

    const total = Number(order.total);
    if (filters.amountFrom !== '' && filters.amountFrom != null) {
      const min = Number(filters.amountFrom);
      if (!Number.isNaN(min) && (Number.isNaN(total) || total < min)) return false;
    }
    if (filters.amountTo !== '' && filters.amountTo != null) {
      const max = Number(filters.amountTo);
      if (!Number.isNaN(max) && (Number.isNaN(total) || total > max)) return false;
    }

    const orderDate = parseOrderDate(order);
    if (filters.dateFrom && orderDate) {
      const from = new Date(`${filters.dateFrom}T00:00:00`);
      if (orderDate < from) return false;
    }
    if (filters.dateTo && orderDate) {
      const to = new Date(`${filters.dateTo}T23:59:59`);
      if (orderDate > to) return false;
    }
    if (filters.dateFrom && !orderDate) return false;
    if (filters.dateTo && !orderDate) return false;

    if (filters.email) {
      const email = String(order.email || '').toLowerCase();
      if (!email.includes(String(filters.email).toLowerCase().trim())) return false;
    }

    if (filters.phone) {
      const phone = normalizePhone(getOrderPhone(order));
      const query = normalizePhone(filters.phone);
      if (!phone.includes(query)) return false;
    }

    return true;
  });
}

export function hasActiveFilters(filters) {
  if (!filters) return false;

  return Object.entries(filters).some(([key, value]) => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (key === 'orderId' || key === 'surname') {
      return text.length >= MIN_TEXT_FILTER_LENGTH;
    }
    return true;
  });
}

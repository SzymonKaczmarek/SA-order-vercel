export function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return null;

  const lines = [];
  const person = [addr.name, addr.surname].filter(Boolean).join(' ');
  if (person) lines.push(person);
  if (addr.company_name) lines.push(addr.company_name);
  if (addr.company_nip) lines.push(`NIP: ${addr.company_nip}`);

  const streetParts = [addr.street, addr.home_number].filter(Boolean);
  let streetLine = streetParts.join(' ');
  if (addr.flat_number) {
    streetLine = streetLine ? `${streetLine}/${addr.flat_number}` : `/${addr.flat_number}`;
  }
  if (streetLine) lines.push(streetLine);

  const cityLine = [addr.postcode, addr.city].filter(Boolean).join(' ');
  if (cityLine) lines.push(cityLine);
  if (addr.state) lines.push(addr.state);
  if (addr.description) lines.push(addr.description);

  return lines.length ? lines : null;
}

export function getCustomerFullName(order) {
  const bill = order?.bill_address;
  if (!bill) return '—';

  const person = [bill.name, bill.surname].filter(Boolean).join(' ');
  if (person) return person;
  if (bill.company_name) return bill.company_name;
  return '—';
}

export function getOrderPhone(order) {
  return (
    order?.bill_address?.phone ||
    order?.shipment_address?.phone ||
    order?.phone ||
    null
  );
}

export function getOrderCarts(order) {
  if (Array.isArray(order?.carts)) return order.carts;
  if (Array.isArray(order?.lines)) return order.lines;
  return [];
}

const STATUS_ID_FALLBACKS = {
  1: 'Nowe',
  2: 'W realizacji',
  3: 'Wysłane',
  4: 'Zrealizowane',
  5: 'Anulowane',
};

function pickStatusName(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    return String(value.name || value.label || value.title || '').trim();
  }
  return String(value).trim();
}

function isNumericStatus(value) {
  const text = String(value ?? '').trim();
  return text !== '' && /^\d+$/.test(text);
}

export function getOrderStatusLabel(order) {
  if (!order || typeof order !== 'object') return '—';

  const fromObject = pickStatusName(order.status);
  if (fromObject && !isNumericStatus(fromObject)) {
    return fromObject;
  }

  const candidates = [
    order.status_name,
    order.order_status_name,
    order.status_label,
    pickStatusName(order.order_status),
    order.status_text,
  ];

  for (const candidate of candidates) {
    const label = pickStatusName(candidate) || String(candidate || '').trim();
    if (label && !isNumericStatus(label)) {
      return label;
    }
  }

  const statusId = order.status_id ?? (typeof order.status === 'object' ? order.status.id : order.status);
  if (statusId != null && statusId !== '') {
    const mapped = STATUS_ID_FALLBACKS[Number(statusId)];
    if (mapped) return mapped;
    if (fromObject) return fromObject;
    return `Status #${statusId}`;
  }

  if (fromObject) return fromObject;

  return '—';
}

export function getOrderStatusStyles(order) {
  const label = String(getOrderStatusLabel(order)).toLowerCase();

  if (label.includes('nowe') || label === 'new' || label.includes('oczek')) {
    return 'bg-sky-50 text-sky-800 border-sky-200 ring-sky-100';
  }
  if (
    label.includes('realiz') ||
    label.includes('trakcie') ||
    label.includes('process') ||
    label.includes('przygot')
  ) {
    return 'bg-amber-50 text-amber-900 border-amber-200 ring-amber-100';
  }
  if (label.includes('wysł') || label.includes('wysl') || label.includes('ship') || label.includes('nadano')) {
    return 'bg-violet-50 text-violet-800 border-violet-200 ring-violet-100';
  }
  if (
    label.includes('zrealiz') ||
    label.includes('dostarc') ||
    label.includes('zakoń') ||
    label.includes('zakon') ||
    label.includes('complete') ||
    label.includes('odebrane')
  ) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-100';
  }
  if (label.includes('anul') || label.includes('cancel') || label.includes('odrzu')) {
    return 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-100';
  }

  return 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-100';
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pl-PL');
}

export function formatMoney(value, currency = 'PLN') {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${num.toFixed(2)} ${currency || 'PLN'}`;
}

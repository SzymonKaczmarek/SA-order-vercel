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

export function getOrderStatusLabel(order) {
  if (order?.status && typeof order.status === 'object') {
    return order.status.name || order.status.id || '—';
  }
  return order?.status_name || order?.status_id || order?.status || '—';
}

export function getOrderStatusStyles(order) {
  const label = String(getOrderStatusLabel(order)).toLowerCase();

  if (label.includes('nowe') || label === 'new') {
    return 'bg-sky-50 text-sky-700 border-sky-200 ring-sky-100';
  }
  if (label.includes('realiz') || label.includes('trakcie') || label.includes('process')) {
    return 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-100';
  }
  if (label.includes('wysł') || label.includes('wysl') || label.includes('ship')) {
    return 'bg-violet-50 text-violet-700 border-violet-200 ring-violet-100';
  }
  if (
    label.includes('zrealiz') ||
    label.includes('dostarc') ||
    label.includes('zakoń') ||
    label.includes('zakon') ||
    label.includes('complete')
  ) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-100';
  }
  if (label.includes('anul') || label.includes('cancel') || label.includes('odrzu')) {
    return 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-100';
  }

  return 'bg-slate-100 text-slate-600 border-slate-200 ring-slate-100';
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

import {
  formatAddress,
  getCustomerFullName,
  getOrderCarts,
  getOrderPhone,
  getOrderStatusLabel,
} from './orderFormat';

function escapeCsv(value) {
  const str = value == null ? '' : String(value);
  if (/[",;\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function addressToLine(addr) {
  const lines = formatAddress(addr);
  return lines ? lines.join(', ') : '';
}

function getOrderId(order) {
  return order.id || order.order_id || '';
}

const CSV_HEADERS = [
  'typ',
  'id_zamowienia',
  'data',
  'status',
  'imie_nazwisko',
  'email',
  'telefon',
  'wartosc',
  'waluta',
  'status_platnosci',
  'zrodlo',
  'adres_faktury',
  'adres_wysylki',
  'lp_pozycji',
  'produkt',
  'product_id',
  'ilosc',
  'cena',
  'ean',
  'symbol',
];

const EMPTY_ORDER_FIELDS = ['', '', '', '', '', '', '', '', '', '', ''];

function buildOrderSummaryRow(order, cartsCount) {
  return [
    'ZAMÓWIENIE',
    getOrderId(order),
    order.date || order.created_at || order.date_add || '',
    getOrderStatusLabel(order),
    getCustomerFullName(order),
    order.email || '',
    getOrderPhone(order) || '',
    order.total ?? '',
    order.currency || 'PLN',
    order.payment_status || order.payment?.status || '',
    order.source || '',
    addressToLine(order.bill_address),
    addressToLine(order.shipment_address),
    '',
    cartsCount > 0 ? `— ${cartsCount} pozycji —` : '— brak pozycji —',
    '',
    '',
    '',
    '',
    '',
    '',
  ];
}

function buildLineItemRow(orderId, item, lineNumber) {
  return [
    'POZYCJA',
    orderId,
    ...EMPTY_ORDER_FIELDS,
    String(lineNumber),
    item.name || '',
    item.product_id ?? '',
    item.quantity ?? '',
    item.price ?? '',
    item.ean || '',
    item.symbol || item.catalog_number || '',
  ];
}

function orderToGroupedCsvRows(order) {
  const orderId = getOrderId(order);
  const carts = getOrderCarts(order);
  const rows = [buildOrderSummaryRow(order, carts.length)];

  carts.forEach((item, index) => {
    rows.push(buildLineItemRow(orderId, item, index + 1));
  });

  return rows;
}

export function buildOrdersCsvContent(orders) {
  const rows = [CSV_HEADERS];

  orders.forEach((order, index) => {
    if (index > 0) {
      rows.push(Array(CSV_HEADERS.length).fill(''));
    }

    orderToGroupedCsvRows(order).forEach((row) => rows.push(row));
  });

  return rows.map((row) => row.map(escapeCsv).join(';')).join('\n');
}

export function downloadOrdersCsv(orders, filename = 'zamowienia-sellasist.csv') {
  if (!orders?.length) return;

  const bom = '\uFEFF';
  const content = bom + buildOrdersCsvContent(orders);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function getOrderExportFilename(order) {
  const id = getOrderId(order) || 'zamowienie';
  return `zamowienie-${id}.csv`;
}

export function getOrdersExportFilename(scope, count) {
  const labels = {
    visible: 'widoczne',
    selected: 'zaznaczone',
    all: 'wszystkie',
  };
  const suffix = labels[scope] || 'eksport';
  return `zamowienia-${suffix}-${count}.csv`;
}

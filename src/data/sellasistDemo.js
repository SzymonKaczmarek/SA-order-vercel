/**
 * Przykładowe dane zamówień na podstawie schematów OpenAPI Sellasist API v1.90.x
 * @see https://api.sellasist.pl/
 */

export const SELLASIST_DOCS_URL = 'https://api.sellasist.pl/';
export const SELLASIST_DEMO_ACCOUNT = 'demo';

export const SELLASIST_DEMO_PRESET = {
  account: SELLASIST_DEMO_ACCOUNT,
  apiKey: '',
  useDemoData: true,
};

const DEMO_BILL_JERZY = {
  name: 'Jerzy',
  surname: 'Jurkowski',
  street: 'Jurkowska',
  home_number: '13',
  flat_number: '255',
  postcode: '12-345',
  city: 'Jurkowo',
  state: 'Mazowieckie',
  phone: '123456789',
  company_name: 'Jurex z.o.o',
  company_nip: '1234567890',
};

const DEMO_SHIPMENT_JERZY = {
  name: 'Jerzy',
  surname: 'Jurkowski',
  street: 'Jurkowska',
  home_number: '13',
  flat_number: '255',
  postcode: '12-345',
  city: 'Jurkowo',
  phone: '123456789',
};

const DEMO_CARTS_1 = [
  {
    id: 1,
    product_id: 341,
    variant_id: 7691,
    ean: '5063129001018',
    name: 'Spodnie sztruksowe',
    quantity: 1,
    price: 232.42,
    tax: 23,
    weight: 0.5,
    catalog_number: 'WOVMQKOWDJ',
    symbol: 'SPOD-SZT',
  },
  {
    id: 2,
    product_id: 512,
    name: 'Koszula bawełniana',
    quantity: 2,
    price: 7.36,
    ean: '1111111111111',
    catalog_number: 'X123',
  },
];

/** Pola zgodne z GET /orders_with_carts i OrderResponse w dokumentacji */
export const DEMO_ORDERS = [
  {
    id: 1,
    date: '2018-09-19 11:59:32',
    email: 'bok@sellasist.pl',
    status: { id: 1, name: 'Nowe' },
    payment: { id: 3, name: 'Przelew zwykły', status: 'paid', paid: 247.15, currency: 'PLN' },
    payment_status: 'paid',
    total: 247.15,
    currency: 'PLN',
    source: 'Allegro',
    shop: 'sellingo.pl',
    comment: 'Przykładowy komentarz',
    bill_address: DEMO_BILL_JERZY,
    shipment_address: DEMO_SHIPMENT_JERZY,
    carts: DEMO_CARTS_1,
  },
  {
    id: 10,
    date: '2018-09-12 20:32:58',
    email: 'klient@example.com',
    status: { id: 2, name: 'W realizacji' },
    payment: { id: 1, name: 'Przelewy zwykły', status: 'paid', paid: 12.34, currency: 'PLN' },
    payment_status: 'paid',
    total: 15.0,
    currency: 'PLN',
    source: '',
    shop: 'sellingo.pl',
    shipment: { id: 3, name: 'Odbiór osobisty', total: 15.0 },
    bill_address: {
      name: 'Anna',
      surname: 'Kowalska',
      street: 'Kwiatowa',
      home_number: '5',
      postcode: '00-511',
      city: 'Warszawa',
      phone: '+48 600 111 222',
    },
    shipment_address: {
      name: 'Anna',
      surname: 'Kowalska',
      street: 'Nowogrodzka',
      home_number: '27',
      postcode: '00-511',
      city: 'Warszawa',
      phone: '+48 600 111 222',
    },
    carts: [
      {
        id: 1,
        product_id: 100,
        name: 'Produkt testowy',
        quantity: 1,
        price: 15.0,
        ean: '1111111111111',
        symbol: 'S123',
      },
    ],
  },
  {
    id: 20,
    date: '2020-11-20 09:08:13',
    email: 'jan.kowalski@example.com',
    status: { id: 3, name: 'Wysłane' },
    payment: { id: 2, name: 'Płatność online', status: 'unpaid', paid: 0, currency: 'PLN' },
    payment_status: 'unpaid',
    total: 89.99,
    currency: 'PLN',
    source: 'Sklep WWW',
    shop: 'moj-sklep.pl',
    tracking_number: '20238098098432',
    bill_address: {
      name: 'Jan',
      surname: 'Kowalski',
      street: 'Polna',
      home_number: '12',
      postcode: '30-001',
      city: 'Kraków',
      phone: '+48 512 345 678',
    },
    shipment_address: {
      name: 'Jan',
      surname: 'Kowalski',
      street: 'Polna',
      home_number: '12',
      postcode: '30-001',
      city: 'Kraków',
      phone: '+48 512 345 678',
    },
    carts: [
      {
        id: 1,
        product_id: 220,
        name: 'Bluza z kapturem',
        quantity: 1,
        price: 79.99,
        catalog_number: 'BLU-001',
      },
      {
        id: 2,
        product_id: 221,
        name: 'Skarpetki sportowe (3 pary)',
        quantity: 1,
        price: 10.0,
      },
    ],
  },
  {
    id: 341,
    date: '2023-12-12 12:12:12',
    email: 'anna.nowak@example.com',
    status: { id: 4, name: 'Zrealizowane' },
    payment: { id: 3, name: 'Przelew zwykły', status: 'partial', paid: 50.0, currency: 'PLN' },
    payment_status: 'partial',
    total: 1234.56,
    currency: 'PLN',
    source: 'Amazon',
    shop: 'sellingo.pl',
    document_number: 'FV/2020/01',
    invoice: 1,
    bill_address: {
      name: 'Anna',
      surname: 'Nowak',
      street: 'Marszałkowska',
      home_number: '65',
      flat_number: '10',
      postcode: '00-102',
      city: 'Warszawa',
      phone: '+48 789 456 123',
      company_name: 'Nowak Consulting',
      company_nip: '7960599844',
    },
    shipment_address: {
      name: 'Anna',
      surname: 'Nowak',
      street: 'Marszałkowska',
      home_number: '65',
      flat_number: '10',
      postcode: '00-102',
      city: 'Warszawa',
      phone: '+48 789 456 123',
    },
    carts: [
      {
        id: 1,
        product_id: 900,
        name: 'Laptop biznesowy 15"',
        quantity: 1,
        price: 1199.0,
        ean: '5901234123457',
      },
      {
        id: 2,
        product_id: 901,
        name: 'Torba na laptop',
        quantity: 1,
        price: 35.56,
      },
    ],
  },
  {
    id: 512,
    date: '2024-06-13 14:30:00',
    email: 'firma@jurex.pl',
    status: { id: 1, name: 'Nowe' },
    payment: { id: 4, name: 'Pobranie', status: 'unpaid', cod: 1, currency: 'PLN' },
    payment_status: 'unpaid',
    total: 456.78,
    currency: 'PLN',
    source: 'eBay',
    shop: 'sellingo.pl',
    important: true,
    bill_address: {
      company_name: 'Jurex z.o.o',
      company_nip: '1234567890',
      street: 'Przemysłowa',
      home_number: '8',
      postcode: '02-100',
      city: 'Warszawa',
      phone: '+48 22 123 45 67',
    },
    shipment_address: {
      name: 'Piotr',
      surname: 'Wiśniewski',
      street: 'Leśna',
      home_number: '3',
      postcode: '05-100',
      city: 'Piaseczno',
      phone: '+48 601 999 888',
    },
    carts: [
      {
        id: 1,
        product_id: 450,
        name: 'Zestaw narzędzi warsztatowych',
        quantity: 2,
        price: 199.99,
        catalog_number: 'NARZ-450',
      },
      {
        id: 2,
        product_id: 451,
        name: 'Kombinerki 200mm',
        quantity: 3,
        price: 18.93,
      },
    ],
  },
];

export function getDemoOrders(limit = 25, offset = 0, options = {}) {
  let pool = DEMO_ORDERS;

  if (options.from_id != null) {
    const fromId = Number(options.from_id);
    pool = pool.filter((order) => order.id > fromId);
  }

  if (options.idRange) {
    pool = pool.filter(
      (order) => order.id >= options.idRange.from && order.id <= options.idRange.to
    );
  }

  const orders = pool.slice(offset, offset + limit);
  const queryParams = {
    limit,
    offset,
    ...(options.from_id != null ? { from_id: options.from_id } : {}),
    ...(options.idRange
      ? { id_from: options.idRange.from, id_to: options.idRange.to }
      : {}),
  };

  const meta = {
    gateway: {
      method: '—',
      path: 'tryb demo (lokalnie)',
      description: 'Bez wywołania proxy – dane ze schematów OpenAPI',
    },
    sellasist: {
      method: 'GET',
      path: '/api/v1/orders_with_carts',
      url: `https://${SELLASIST_DEMO_ACCOUNT}.sellasist.pl/api/v1/orders_with_carts?limit=${limit}&offset=${offset}`,
      headers: {
        apiKey: '(nie wymagany w trybie demo)',
        Accept: 'application/json',
      },
      queryParams,
      simulated: true,
    },
    documentation: `${SELLASIST_DOCS_URL}#/Zam%C3%B3wienia/get_orders_with_carts`,
  };

  return {
    orders,
    raw: orders,
    meta,
    demo: true,
    source: 'openapi',
    docsUrl: SELLASIST_DOCS_URL,
    total: pool.length,
  };
}

export function getDemoConnectionResult() {
  return {
    ok: true,
    demo: true,
    message: `Tryb demo: dane przykładowe z dokumentacji OpenAPI (${SELLASIST_DEMO_ACCOUNT}.sellasist.pl – serwer dokumentacji, bez wywołań API).`,
    docsUrl: SELLASIST_DOCS_URL,
  };
}

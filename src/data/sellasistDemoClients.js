/** Dane demo klientów zgodne z GET /users (Sellasist API v1.90). */

export const DEMO_CLIENTS = [
  {
    id: 1,
    email: 'bok@sellasist.pl',
    name: 'Jerzy',
    surname: 'Kowalski',
    phone: '600123456',
    company_name: 'Sellasist Sp. z o.o.',
    company_nip: '1234567890',
    street: 'Testowa',
    home_number: '12',
    postcode: '00-001',
    city: 'Warszawa',
  },
  {
    id: 2,
    email: 'klient@example.com',
    name: 'Anna',
    surname: 'Nowak',
    phone: '501222333',
    street: 'Kwiatowa',
    home_number: '5',
    postcode: '30-001',
    city: 'Kraków',
  },
  {
    id: 3,
    email: 'firma@hurt.pl',
    name: 'Piotr',
    surname: 'Wiśniewski',
    phone: '789456123',
    company_name: 'Hurtownia ABC',
    company_nip: '9876543210',
    street: 'Przemysłowa',
    home_number: '8',
    postcode: '40-001',
    city: 'Katowice',
  },
  {
    id: 4,
    email: 'vip@sklep.pl',
    name: 'Maria',
    surname: 'Lewandowska',
    phone: '660111222',
    street: 'Słoneczna',
    home_number: '3',
    flat_number: '12',
    postcode: '80-001',
    city: 'Gdańsk',
  },
  {
    id: 5,
    email: 'b2b@partner.pl',
    company_name: 'Partner B2B',
    company_nip: '5556667778',
    phone: '224455667',
    street: 'Biznesowa',
    home_number: '1',
    postcode: '02-001',
    city: 'Warszawa',
  },
];

export function getDemoClients(limit = 50, offset = 0) {
  const safeLimit = Math.max(1, Number(limit) || 50);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const slice = DEMO_CLIENTS.slice(safeOffset, safeOffset + safeLimit);

  return {
    users: slice,
    raw: slice,
    demo: true,
    total: DEMO_CLIENTS.length,
    meta: {
      demo: true,
      documentation: 'https://api.sellasist.pl/#/Klienci/get_users',
    },
  };
}

export function getDemoClientsConnectionResult() {
  return {
    ok: true,
    demo: true,
    message: 'Tryb demo — klienci z przykładów dokumentacji Sellasist API.',
  };
}

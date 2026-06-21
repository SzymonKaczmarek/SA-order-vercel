export function getClientFullName(client) {
  const person = [client?.name, client?.surname].filter(Boolean).join(' ').trim();
  if (person) return person;
  if (client?.company_name) return client.company_name;
  return '—';
}

export function getClientEmail(client) {
  return client?.email || null;
}

export function getClientPhone(client) {
  return client?.phone || client?.mobile || null;
}

export function getClientAddressLine(client) {
  const parts = [client?.street, client?.home_number, client?.flat_number].filter(Boolean);
  const street = parts.join(' ');
  const city = [client?.postcode, client?.city].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ') || null;
}

export function stampClientForStorage(client, importedAt = new Date().toISOString()) {
  if (!client || typeof client !== 'object') {
    return client;
  }

  if (client.saor_imported_at) {
    return client;
  }

  return {
    ...client,
    saor_imported_at: importedAt,
  };
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pl-PL');
}

export function getClientImportedAt(client) {
  return client?.saor_imported_at || client?.imported_at || null;
}

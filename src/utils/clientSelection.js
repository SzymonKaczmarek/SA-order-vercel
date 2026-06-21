export function getClientKey(client) {
  const id = client?.id ?? client?.user_id;
  if (id == null || id === '') {
    return '';
  }
  return String(id);
}

export function pickClientsByKeys(clients, keys) {
  const keySet = new Set(Array.isArray(keys) ? keys : []);
  return (Array.isArray(clients) ? clients : []).filter((client) =>
    keySet.has(getClientKey(client))
  );
}

export function getOrderKey(order) {
  const id = order?.id ?? order?.order_id;
  if (id == null || id === '') return '';
  return String(id);
}

export function mergeOrders(existing, incoming) {
  const map = new Map();
  existing.forEach((order) => {
    const key = getOrderKey(order);
    if (key) map.set(key, order);
  });
  incoming.forEach((order) => {
    const key = getOrderKey(order);
    if (key) map.set(key, order);
  });
  return Array.from(map.values());
}

export function excludeOrdersByKeys(orders, keys) {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  return orders.filter((order) => !keySet.has(getOrderKey(order)));
}

export function pickOrdersByKeys(orders, keys) {
  const keySet = keys instanceof Set ? keys : new Set(keys);
  return orders.filter((order) => keySet.has(getOrderKey(order)));
}

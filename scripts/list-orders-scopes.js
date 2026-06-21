const { listOrdersScopes } = require('../lib/ordersDb');

async function main() {
  const scopes = await listOrdersScopes();
  console.log(JSON.stringify(scopes, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

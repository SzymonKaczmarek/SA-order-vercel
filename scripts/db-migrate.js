const { ensureTable, getConnectionString } = require('../lib/db');
const { ensureOrdersSchema, migrateAllLegacyOrderScopes } = require('../lib/ordersDb');

async function main() {
  const url = getConnectionString();
  if (!url) {
    console.error('Brak DATABASE_URL / POSTGRES_URL. Uzupełnij plik .env');
    process.exit(1);
  }

  await ensureTable();
  console.log('Migracja OK: app_kv_store');

  await ensureOrdersSchema();
  console.log('Migracja OK: orders_scopes + orders');

  const result = await migrateAllLegacyOrderScopes();
  if (result.migrated > 0) {
    console.log(
      `Migracja danych z JSON: ${result.migrated} scope(ów), ${result.orders} zamówień`
    );
  }

  console.log('Baza gotowa (relacyjna tabela orders).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

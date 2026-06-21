const fs = require('fs');
const path = require('path');
const { ensureTable, getConnectionString } = require('../lib/db');

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      return;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

async function main() {
  loadEnvFile();

  const url = getConnectionString();
  if (!url) {
    console.error(
      'Brak DATABASE_URL / POSTGRES_URL. Ustaw zmienną w Vercel (integracja Neon) lub w pliku .env.'
    );
    process.exit(1);
  }

  await ensureTable();
  console.log('Migracja zakończona: tabela app_kv_store jest gotowa (Neon PostgreSQL).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

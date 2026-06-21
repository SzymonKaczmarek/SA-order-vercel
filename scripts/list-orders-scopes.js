const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

function loadEnvFile(fileName) {
  const envPath = path.join(__dirname, '..', fileName);
  if (!fs.existsSync(envPath)) {
    return;
  }

  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
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
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    console.error('Brak DATABASE_URL');
    process.exit(1);
  }

  const sql = neon(url);
  const rows = await sql`
    SELECT
      scope_key,
      jsonb_array_length(COALESCE(payload->'orders', '[]'::jsonb)) AS order_count,
      payload->>'accessAccountId' AS access_account_id,
      payload->>'account' AS sellasist_account,
      updated_at
    FROM app_kv_store
    WHERE scope_key LIKE 'orders:%'
    ORDER BY updated_at DESC
  `;

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

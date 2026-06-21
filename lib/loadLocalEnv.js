const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

const DB_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
];

function hasDbEnv() {
  return DB_ENV_KEYS.some((key) => Boolean(process.env[key]));
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const eq = trimmed.indexOf('=');
  if (eq === -1) {
    return null;
  }

  let key = trimmed.slice(0, eq).trim();
  key = key.replace(/^export\s+/, '');

  let value = trimmed.slice(eq + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile(fileName, { overrideNonEmpty = false } = {}) {
  const envPath = path.join(PROJECT_ROOT, fileName);
  if (!fs.existsSync(envPath)) {
    return;
  }

  fs.readFileSync(envPath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .forEach((line) => {
      const parsed = parseEnvLine(line);
      if (!parsed || !parsed.key || !parsed.value) {
        return;
      }

      const current = process.env[parsed.key];
      if (current && !overrideNonEmpty) {
        return;
      }

      process.env[parsed.key] = parsed.value;
    });
}

function loadLocalEnv() {
  if (hasDbEnv()) {
    return true;
  }

  // vercel env pull → .env.local (często puste "" dla Neon)
  loadEnvFile('.env.local');

  // ręczny connection string — ma pierwszeństwo
  loadEnvFile('.env', { overrideNonEmpty: true });

  return hasDbEnv();
}

function envFileHasEmptyDbKeys(fileName) {
  const envPath = path.join(PROJECT_ROOT, fileName);
  if (!fs.existsSync(envPath)) {
    return false;
  }

  return fs
    .readFileSync(envPath, 'utf8')
    .replace(/^\uFEFF/, '')
    .split('\n')
    .some((line) => {
      const parsed = parseEnvLine(line);
      if (!parsed || !parsed.key) {
        return false;
      }
      return DB_ENV_KEYS.includes(parsed.key) && !parsed.value;
    });
}

module.exports = {
  DB_ENV_KEYS,
  PROJECT_ROOT,
  envFileHasEmptyDbKeys,
  hasDbEnv,
  loadLocalEnv,
};

const fs = require('fs');
const path = require('path');
const {
  PROJECT_ROOT,
  envFileHasEmptyDbKeys,
  hasDbEnv,
  loadLocalEnv,
} = require('../lib/loadLocalEnv');

loadLocalEnv();

if (hasDbEnv()) {
  process.exit(0);
}

const envPath = path.join(PROJECT_ROOT, '.env');
const examplePath = path.join(PROJECT_ROOT, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
}

console.error('');
console.error('Brak DATABASE_URL — lokalne API nie połączy się z Neon.');
console.error('');

if (envFileHasEmptyDbKeys('.env.local')) {
  console.error('Vercel CLI pobrał klucze do .env.local, ale wartości są puste ("").');
  console.error('Tak działają wrażliwe zmienne Neon — nie da się ich ściągnąć przez env pull.');
  console.error('');
}

console.error('Uzupełnij plik .env (utworzony z .env.example):');
console.error('  DATABASE_URL=postgresql://...');
console.error('');
console.error('Skopiuj connection string z:');
console.error('  Vercel → sa-order-vercel → Settings → Environment Variables → DATABASE_URL → Reveal');
console.error('  albo Neon Console → projekt → Connection string (pooled)');
console.error('');
console.error('Potem: npm run dev:vercel');
console.error('');
console.error('Nie używaj samego "npm run develop" (port 8000) — tam nie ma /api/*.');
console.error('');

process.exit(1);

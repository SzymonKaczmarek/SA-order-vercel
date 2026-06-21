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
  console.log('DATABASE_URL jest skonfigurowany (plik .env).');
  process.exit(0);
}

if (!envFileHasEmptyDbKeys('.env.local')) {
  process.exit(0);
}

const envPath = path.join(PROJECT_ROOT, '.env');
const examplePath = path.join(PROJECT_ROOT, '.env.example');

if (!fs.existsSync(envPath) && fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, envPath);
}

console.log('');
console.log('env pull zapisał puste wartości Neon w .env.local — to normalne.');
console.log('Wklej connection string do pliku .env (DATABASE_URL=...) i uruchom npm run dev:vercel');
console.log('');

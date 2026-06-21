const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const MODE_FILE = path.join(PROJECT_ROOT, '.gatsby-last-mode');
const DEV_404 = path.join(PROJECT_ROOT, '.cache', 'dev-404-page.js');
const ASYNC_REQUIRES = path.join(
  PROJECT_ROOT,
  '.cache',
  '_this_is_virtual_fs_path_',
  '$virtual',
  'async-requires.js'
);

function runClean(reason) {
  console.error('');
  console.error(`[gatsby] ${reason}`);
  console.error('[gatsby] Czyszczenie cache (gatsby clean)...');
  console.error('');
  const result = spawnSync('npx', ['gatsby', 'clean'], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  if (fs.existsSync(MODE_FILE)) {
    fs.unlinkSync(MODE_FILE);
  }
}

function needsClean() {
  if (fs.existsSync(MODE_FILE) && fs.readFileSync(MODE_FILE, 'utf8').trim() === 'build') {
    return 'Wykryto poprzedni gatsby build — przed dev wymagane czyste .cache.';
  }

  if (!fs.existsSync(ASYNC_REQUIRES)) {
    return null;
  }

  const content = fs.readFileSync(ASYNC_REQUIRES, 'utf8');
  if (content.includes('dev-404-page.js') && !fs.existsSync(DEV_404)) {
    return 'Brak .cache/dev-404-page.js przy odwołaniu w async-requires.js.';
  }

  return null;
}

const reason = needsClean();
if (reason) {
  runClean(reason);
}

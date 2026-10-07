// Shared paths for every SlicePay test.
//   APP_DIR  — folder that holds the app's index.html (default: the project root).
//              Point it at a frozen copy to test a snapshot: APP_DIR=/path/to/copy npm test
//   TEST_OUT — where screenshots / logs / JSON go (default: tests/out, gitignored).
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const TESTS = path.join(ROOT, 'tests');
const APP_DIR = path.resolve(process.env.APP_DIR || ROOT);
const INDEX = path.join(APP_DIR, 'index.html');
if (!fs.existsSync(INDEX)) {
  console.error('FAIL index.html not found in APP_DIR=' + APP_DIR);
  process.exit(3);
}
/** file:// URL of index.html (no hash) — append '#/route?qa=params' */
const BASE = pathToFileURL(INDEX).href;
const OUT_ROOT = path.resolve(process.env.TEST_OUT || path.join(TESTS, 'out'));

/** tests/out/<name> (created) */
function outDir(name) {
  const d = path.join(OUT_ROOT, name);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

/** suite id of the running test file, e.g. 'functional/round1/delivery' */
function suiteName(file) {
  const f = file || (require.main && require.main.filename) || 'adhoc';
  return path.relative(TESTS, f).replace(/\\/g, '/').replace(/(\.test)?\.js$/, '');
}

module.exports = { ROOT, TESTS, APP_DIR, INDEX, BASE, OUT_ROOT, outDir, suiteName };

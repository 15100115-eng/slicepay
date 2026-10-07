// Runs every SlicePay test suite (tests/e2e, tests/functional, tests/regression) plus the design-parity step,
// then prints a pass/fail table. Exit code: 0 = all green, 1 = something failed.
//
// usage: node tests/run-all.js [filter ...] [--jobs=4] [--no-visual] [--visual-only] [--timeout=600]
//   filter      only suites whose id contains one of the given substrings (e.g. `orders delivery`)
//   --jobs      suites run in parallel (default 4; each starts its own Chromium)
//   env APP_DIR to test another copy of the app (default: project root), TEST_OUT for the output folder.
// Logs: tests/out/logs/<suite>.log. Each suite reports checks as lines starting with PASS / FAIL.
// Suites are discovered: every *.test.js under tests/e2e, tests/functional and tests/regression runs (v4 added
// e2e/profile.test.js and e2e/status.test.js); the parity step (tests/visual/parity.js) runs last, alone.
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { TESTS, APP_DIR, OUT_ROOT } = require('./lib/env');

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const JOBS = Math.max(1, +opt('jobs', process.env.TEST_JOBS || 4));
const TIMEOUT = +opt('timeout', 600) * 1000;
const NO_VISUAL = args.includes('--no-visual');
const VISUAL_ONLY = args.includes('--visual-only');
const filters = args.filter(a => !a.startsWith('--'));
const LOGS = path.join(OUT_ROOT, 'logs');
fs.mkdirSync(LOGS, { recursive: true });

function find(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...find(f));
    else if (e.name.endsWith('.test.js')) out.push(f);
  }
  return out.sort();
}

const suites = VISUAL_ONLY ? [] : ['e2e', 'functional', 'regression']
  .flatMap(d => find(path.join(TESTS, d)))
  .map(file => ({ file, id: path.relative(TESTS, file).replace(/\\/g, '/').replace(/\.test\.js$/, '') }))
  .filter(s => !filters.length || filters.some(f => s.id.includes(f)));
if (!NO_VISUAL && (!filters.length || filters.some(f => 'visual/parity'.includes(f)))) {
  suites.push({ file: path.join(TESTS, 'visual', 'parity.js'), id: 'visual/parity', last: true });
}

function run(s) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const log = path.join(LOGS, s.id.replace(/\//g, '__') + '.log');
    const child = spawn(process.execPath, [s.file], { cwd: path.dirname(s.file), env: process.env });
    let buf = '';
    child.stdout.on('data', d => { buf += d; });
    child.stderr.on('data', d => { buf += d; });
    const timer = setTimeout(() => { buf += '\nTIMEOUT after ' + TIMEOUT / 1000 + 's\n'; child.kill('SIGKILL'); }, TIMEOUT);
    child.on('close', code => {
      clearTimeout(timer);
      fs.writeFileSync(log, buf);
      const lines = buf.split('\n');
      const pass = lines.filter(l => /^PASS\b/.test(l)).length;
      const fail = lines.filter(l => /^FAIL\b/.test(l)).length;
      let status = 'PASS';
      if (code === null || code >= 2 || /\nTIMEOUT after/.test(buf)) status = 'ERROR';
      else if (code !== 0 || fail > 0) status = 'FAIL';
      else if (pass === 0) status = 'EMPTY';
      resolve({ ...s, code, pass, fail, status, secs: (Date.now() - t0) / 1000, log });
    });
  });
}

(async () => {
  console.log(`SlicePay tests — app: ${APP_DIR}\n${suites.length} suites, ${JOBS} in parallel; logs in ${LOGS}\n`);
  const results = [];
  const queue = suites.filter(s => !s.last);
  async function worker() {
    while (queue.length) {
      const s = queue.shift();
      const r = await run(s);
      results.push(r);
      console.log(`${r.status.padEnd(5)} ${r.id}  (${r.pass} passed, ${r.fail} failed, ${r.secs.toFixed(0)}s)`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length || 1) }, worker));
  for (const s of suites.filter(x => x.last)) { // parity runs alone: its timings must not compete with other suites
    const r = await run(s); results.push(r);
    console.log(`${r.status.padEnd(5)} ${r.id}  (${r.pass} passed, ${r.fail} failed, ${r.secs.toFixed(0)}s)`);
  }

  const order = new Map(suites.map((s, i) => [s.id, i]));
  results.sort((a, b) => order.get(a.id) - order.get(b.id));
  const w = Math.max(5, ...results.map(r => r.id.length));
  const line = '-'.repeat(w + 38);
  console.log('\n' + line);
  console.log('suite'.padEnd(w) + '  status  passed  failed   time');
  console.log(line);
  for (const r of results) {
    console.log(r.id.padEnd(w) + '  ' + r.status.padEnd(6) + String(r.pass).padStart(8) + String(r.fail).padStart(8) + (r.secs.toFixed(0) + 's').padStart(7));
  }
  console.log(line);
  const bad = results.filter(r => r.status !== 'PASS');
  const tp = results.reduce((a, r) => a + r.pass, 0), tf = results.reduce((a, r) => a + r.fail, 0);
  console.log('TOTAL'.padEnd(w) + '  ' + (bad.length ? 'FAIL' : 'PASS').padEnd(6) + String(tp).padStart(8) + String(tf).padStart(8));
  console.log(`\n${results.length - bad.length}/${results.length} suites green.`);
  for (const r of bad) console.log(`  ${r.status} ${r.id} (exit ${r.code}) — see ${path.relative(process.cwd(), r.log)}`);
  fs.writeFileSync(path.join(OUT_ROOT, 'summary.json'), JSON.stringify({ app: APP_DIR, when: new Date().toISOString(), results }, null, 1));
  process.exitCode = bad.length || !results.length ? 1 : 0;
})();

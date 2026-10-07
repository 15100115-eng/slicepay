// Design-parity check: capture every case, score it against the design frames (compare.py) and compare the
// scores with the stored baseline (baseline-scores.json). A case fails when it got worse than its baseline by
// more than the tolerance, when it is missing, or when the page logged console errors.
//
// usage: node tests/visual/parity.js [--update-baseline] [--tol-mean=1] [--tol-pct=1] [id,id,...]
//   env: APP_DIR (app folder), TEST_OUT (output root), PARITY_TOL_MEAN / PARITY_TOL_PCT, PYTHON (default python3)
// Output: tests/out/visual/shots/{<id>.png, cmp_<id>.png, scores.json}, tests/out/visual/parity.json
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { outDir, APP_DIR } = require('../lib/env');
const { capture } = require('./capture');

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const UPDATE = args.includes('--update-baseline');
const TOL_MEAN = +flag('tol-mean', process.env.PARITY_TOL_MEAN || 1);
const TOL_PCT = +flag('tol-pct', process.env.PARITY_TOL_PCT || 1);
const only = (args.find(x => !x.startsWith('--')) || '').split(',').filter(Boolean);
const PY = process.env.PYTHON || 'python3';
const BASELINE = path.join(__dirname, 'baseline-scores.json');

(async () => {
  const root = outDir('visual');
  const shots = path.join(root, 'shots');
  fs.rmSync(shots, { recursive: true, force: true });

  const py = spawnSync(PY, ['-c', 'import PIL'], { encoding: 'utf8' });
  if (py.status !== 0) {
    console.log('FAIL parity: ' + PY + ' with Pillow is required (pip3 install pillow)');
    process.exit(2);
  }

  const { errors } = await capture(shots, only);
  const r = spawnSync(PY, [path.join(__dirname, 'compare.py'), shots, only.join(',')], { encoding: 'utf8' });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); console.log('FAIL parity: compare.py crashed'); process.exit(2); }
  const scores = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(shots, 'scores.json'), 'utf8')).map(([id, mean, pct]) => [id, { mean, pct }]));

  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  if (UPDATE) {
    const ids = Object.keys(scores);
    const lines = ['{', ' "source": ' + JSON.stringify('updated ' + new Date().toISOString().slice(0, 10) + ' from ' + APP_DIR), ' "metric": ' + JSON.stringify(base.metric), ' "cases": {'];
    ids.forEach((id, i) => lines.push('  "' + id + '": { "mean": ' + scores[id].mean + ', "pct": ' + scores[id].pct + ' }' + (i < ids.length - 1 ? ',' : '')));
    lines.push(' }', '}');
    fs.writeFileSync(BASELINE, lines.join('\n') + '\n');
    console.log('baseline updated with', ids.length, 'cases');
    return;
  }

  const rows = [];
  let fails = 0;
  for (const id of Object.keys(base.cases)) {
    if (only.length && !only.includes(id)) continue;
    const b = base.cases[id], s = scores[id];
    let status = 'PASS', note = '';
    if (!s) { status = 'FAIL'; note = 'not captured'; }
    else {
      const dm = s.mean - b.mean, dp = s.pct - b.pct;
      if (dm > TOL_MEAN || dp > TOL_PCT) { status = 'FAIL'; note = 'worse than baseline'; }
      else if (dm < -TOL_MEAN || dp < -TOL_PCT) note = 'better than baseline (consider --update-baseline)';
    }
    if (errors[id]) { status = 'FAIL'; note = (note ? note + '; ' : '') + 'console errors: ' + errors[id].join(' | ').slice(0, 200); }
    if (status === 'FAIL') fails++;
    rows.push({ id, base: b, now: s || null, status, note });
  }
  const f = v => (v == null ? '   -  ' : v.toFixed(2).padStart(6));
  console.log('\ncase   base mean  now mean   base %>40  now %>40   status');
  for (const r of rows) {
    console.log(`${r.status} ${r.id.padEnd(4)} ${f(r.base.mean)}    ${f(r.now && r.now.mean)}     ${f(r.base.pct)}    ${f(r.now && r.now.pct)}   ${r.note}`);
  }
  console.log(`\nparity: ${rows.length - fails}/${rows.length} cases within tolerance (mean +${TOL_MEAN}, pct +${TOL_PCT}); comparisons in ${shots}/cmp_*.png`);
  fs.writeFileSync(path.join(root, 'parity.json'), JSON.stringify({ app: APP_DIR, tolMean: TOL_MEAN, tolPct: TOL_PCT, fails, rows }, null, 1));
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });

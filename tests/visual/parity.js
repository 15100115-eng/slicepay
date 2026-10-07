// Design-parity check: capture every case, score it against the design frames (compare.py) and compare the
// scores with the stored baseline (baseline-scores.json). A case fails when it got worse than its baseline by
// more than the tolerance, when it is missing, or when the page logged console errors.
//
// usage: node tests/visual/parity.js [--update-baseline] [--tol-mean=1] [--tol-pct=1] [id,id,...]
//   env: APP_DIR (app folder), TEST_OUT (output root), PARITY_RUN (run folder name), PARITY_TOL_MEAN / PARITY_TOL_PCT,
//        PYTHON (default python3)
// --update-baseline rewrites baseline-scores.json as valid JSON (JSON.stringify), merging the captured cases into the
//   existing ones (an id subset only replaces those ids), records a project-relative source (never an absolute path),
//   and refuses to update when a captured case logged console errors.
// Output (per run, v4f): <TEST_OUT>/visual/runs/<run>/{shots/{<id>.png, cmp_<id>.png, scores.json}, parity.json}, where
//   <run> is PARITY_RUN or a timestamp + pid, so parallel runs (two `npm test` at once, or a separate TEST_OUT-less
//   test:visual) never delete each other's shots. <TEST_OUT>/visual/parity.json is a copy of the latest run's result
//   (with its folder). Run folders older than PARITY_KEEP_HOURS (default 6) beyond the newest PARITY_KEEP (default 5)
//   are pruned; a run still in progress is always newer than that.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { outDir, APP_DIR, ROOT } = require('../lib/env');
const { capture } = require('./capture');

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const UPDATE = args.includes('--update-baseline');
const TOL_MEAN = +flag('tol-mean', process.env.PARITY_TOL_MEAN || 1);
const TOL_PCT = +flag('tol-pct', process.env.PARITY_TOL_PCT || 1);
const only = (args.find(x => !x.startsWith('--')) || '').split(',').filter(Boolean);
const PY = process.env.PYTHON || 'python3';
const BASELINE = path.join(__dirname, 'baseline-scores.json');
const KEEP = Math.max(1, +(process.env.PARITY_KEEP || 5));
const KEEP_MS = Math.max(0, +(process.env.PARITY_KEEP_HOURS || 6)) * 3600e3;

/** a fresh folder for this run under <root>/runs (never shared with another run) */
function runDir(root) {
  const runs = path.join(root, 'runs');
  fs.mkdirSync(runs, { recursive: true });
  const name = (process.env.PARITY_RUN || new Date().toISOString().replace(/[:.]/g, '-') + '-' + process.pid).replace(/[^\w.-]/g, '_');
  const dir = path.join(runs, name);
  fs.rmSync(dir, { recursive: true, force: true });   // only this run's own folder (a re-used PARITY_RUN)
  fs.mkdirSync(dir, { recursive: true });
  // prune old runs: keep the newest KEEP, and anything younger than KEEP_MS (a parallel run in progress)
  const now = Date.now();
  fs.readdirSync(runs, { withFileTypes: true }).filter(e => e.isDirectory() && path.join(runs, e.name) !== dir)
    .map(e => ({ f: path.join(runs, e.name), t: fs.statSync(path.join(runs, e.name)).mtimeMs }))
    .sort((a, b) => b.t - a.t).slice(KEEP - 1)
    .filter(r => now - r.t > KEEP_MS)
    .forEach(r => fs.rmSync(r.f, { recursive: true, force: true }));
  return dir;
}

(async () => {
  const root = outDir('visual');
  const run = runDir(root);
  const shots = path.join(run, 'shots');
  console.log('INFO parity run folder: ' + run);

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
    // refuse to bake a broken page into the baseline
    const bad = Object.keys(scores).filter(id => errors[id]);
    if (bad.length) {
      console.log('FAIL parity: not updating the baseline, these cases logged console errors: ' + bad.join(', '));
      process.exit(1);
    }
    // merge: an id subset (`--update-baseline m01`) only replaces those cases, the others are kept
    const rel = path.relative(ROOT, APP_DIR).replace(/\\/g, '/') || '.';
    // never an absolute (or machine-specific ../../..) path in a tracked file
    const app = (path.isAbsolute(rel) || rel.startsWith('..')) ? 'an APP_DIR copy outside the project' : rel;
    const next = {
      source: 'updated ' + new Date().toISOString().slice(0, 10) + ' from ' + app + ' (' + Object.keys(scores).join(',') + ')',
      metric: base.metric,
      cases: Object.assign({}, base.cases, scores),
    };
    const tmp = BASELINE + '.' + process.pid + '.tmp';
    // JSON.stringify for every value, one case per line (small diffs); parsed back below before it replaces the file
    const caseLines = Object.keys(next.cases).map(id =>
      '  ' + JSON.stringify(id) + ': { "mean": ' + JSON.stringify(next.cases[id].mean) + ', "pct": ' + JSON.stringify(next.cases[id].pct) + ' }');
    const text = ['{', ' "source": ' + JSON.stringify(next.source) + ',', ' "metric": ' + JSON.stringify(next.metric) + ',',
      ' "cases": {', caseLines.join(',\n'), ' }', '}'].join('\n') + '\n';
    fs.writeFileSync(tmp, text);
    const back = JSON.parse(fs.readFileSync(tmp, 'utf8'));   // sanity: never leave an unparsable baseline behind
    if (JSON.stringify(back) !== JSON.stringify(next)) { fs.rmSync(tmp, { force: true }); console.log('FAIL parity: baseline round-trip mismatch'); process.exit(2); }
    fs.renameSync(tmp, BASELINE);
    console.log('baseline updated: ' + Object.keys(scores).length + ' case(s) replaced, ' + Object.keys(next.cases).length + ' in total');
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
  const result = JSON.stringify({ app: APP_DIR, run, tolMean: TOL_MEAN, tolPct: TOL_PCT, fails, rows }, null, 1);
  fs.writeFileSync(path.join(run, 'parity.json'), result);
  const latest = path.join(root, 'parity.json'), tmp = latest + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, result); fs.renameSync(tmp, latest);   // atomic: a parallel run never reads a half-written file
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });

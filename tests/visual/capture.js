// Design-parity capture: screenshots every case in tests/visual/cases.json from APP_DIR/index.html.
// Mobile cases: 428x735 @2x, desktop cases: 1440x1024 @1x (the sizes of the reference frames).
// usage: node tests/visual/capture.js [outDir] [id,id,...]   (default outDir: tests/out/visual/shots)
// Also writes <outDir>/console_errors.json.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { BASE, outDir } = require('../lib/env');

const CASES = path.join(__dirname, 'cases.json');

async function capture(out, only = []) {
  fs.mkdirSync(out, { recursive: true });
  const cases = JSON.parse(fs.readFileSync(CASES, 'utf8')).filter(c => !only.length || only.includes(c.id));
  const b = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });
  const errors = {};
  try {
    for (const c of cases) {
      const mob = c.vp === 'm';
      const ctx = await b.newContext({ viewport: mob ? { width: 428, height: 735 } : { width: 1440, height: 1024 }, deviceScaleFactor: mob ? 2 : 1 });
      const p = await ctx.newPage();
      const errs = [];
      p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      p.on('pageerror', e => errs.push(String(e)));
      await p.goto(BASE + c.hash, { waitUntil: 'load' });
      try { await p.evaluate(() => document.fonts && document.fonts.ready); } catch (e) { /* ignore */ }
      await p.waitForTimeout(c.hash.includes('loading=1') ? 600 : 900);
      await p.screenshot({ path: path.join(out, c.id + '.png'), timeout: 60000 });
      if (errs.length) errors[c.id] = errs;
      await ctx.close();
    }
  } finally { await b.close(); }
  fs.writeFileSync(path.join(out, 'console_errors.json'), JSON.stringify(errors, null, 1));
  console.log('captured', cases.length, 'cases; console errors in', Object.keys(errors).length);
  return { count: cases.length, errors };
}

module.exports = { capture, CASES };

if (require.main === module) {
  const out = process.argv[2] ? path.resolve(process.argv[2]) : outDir('visual/shots');
  const only = (process.argv[3] || '').split(',').filter(Boolean);
  capture(out, only).catch(e => { console.error(e); process.exit(1); });
}

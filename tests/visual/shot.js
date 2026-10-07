// One-off screenshot helper.
// usage: node tests/visual/shot.js <url|#/hash> <out.png> [width=428] [height=735] [scale=1] [fullPage=0|1]
// A url starting with '#' is resolved against APP_DIR/index.html (e.g. '#/cart?demo=1').
const { chromium } = require('playwright');
const path = require('path');
const { BASE } = require('../lib/env');
(async () => {
  const [url, out, w, h, scale, full] = process.argv.slice(2);
  if (!url || !out) { console.error('usage: node tests/visual/shot.js <url|#/hash> <out.png> [w] [h] [scale] [fullPage]'); process.exit(2); }
  const b = await chromium.launch({ args: ['--disable-gpu', '--font-render-hinting=none'] });
  const p = await b.newPage({ viewport: { width: +w || 428, height: +h || 735 }, deviceScaleFactor: +scale || 1 });
  await p.goto(url.startsWith('#') ? BASE + url : url, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.resolve(out), fullPage: full === '1', timeout: 60000 });
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });

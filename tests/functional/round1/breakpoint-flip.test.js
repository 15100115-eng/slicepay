// ported from scratchpad tools/v2f_flip.js
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch(); const errs = []; const lg = L.mkLog('flip');
  const { ctx, p } = await L.newCtx(b, 428, errs);
  await p.goto(L.BASE + '#/payment?demo=1&method=tbc'); await L.sleep(300);
  await L.vis(p, 'label.term-chip[data-term="9"]').click(); await L.sleep(80);
  await p.focus('#term-9');
  await p.setViewportSize({ width: 1200, height: 900 }); await L.sleep(400);
  lg.check('428->1200: term 9 kept, chip selected, focus on term-9', (await L.st(p)).term === 9 && await p.isChecked('#term-9') && (await L.active(p)) === 'term-9', [await L.active(p)]);
  await p.keyboard.press('ArrowRight'); await L.sleep(80);
  lg.check('arrow works after flip', (await L.st(p)).term === 12);
  await p.setViewportSize({ width: 428, height: 735 }); await L.sleep(400);
  lg.check('back to 428: term 12 kept', (await L.st(p)).term === 12 && await p.isChecked('#term-12') && (await L.tc(p, '#pay-mo')).replace(/\s/g, '') === '50₾12თვეში', await L.tc(p, '#pay-mo'));
  for (const [h, sel] of [['#/cart?demo=1', '#cart-eta'], ['#/payment?demo=1', '#pay-eta']]) {
    for (const w of [428, 1440]) {
      await p.setViewportSize({ width: w, height: 900 }); await p.goto(L.BASE + h); await L.sleep(300);
      const s = await p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); const c = getComputedStyle(e); return c.color + ' ' + c.fontSize; }, sel);
      lg.check(h + ' ' + w + ' ETA line #666 14px', s === 'rgb(102, 102, 102) 14px', s);
    }
  }
  lg.summary(); console.log('ERRS', JSON.stringify(errs)); await b.close();
})().catch(e => { console.error(e); process.exit(2); });

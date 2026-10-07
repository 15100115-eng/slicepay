// ported from scratchpad tools/v2r3_widths.js
// v2 functional QA round 3 — new screens at many widths with long data: horizontal overflow, overlapping header
// items, clipped controls (functional usability, not pixel parity)
const L = require('../../lib/harness');
const fs = require('fs');
const WIDTHS = [320, 360, 375, 390, 768, 899, 900, 1024, 1280];
(async () => {
  const b = await L.launch();
  const errs = [];
  const lg = L.mkLog('widths');
  // build a long-data session once (1440), reuse its storage state
  const { ctx, p } = await L.newCtx(b, 1440, errs);
  await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(250);
  await L.cartAdd(p, 'https://www.amazon.com/Extremely-Long-Product-Name-With-Many-Words-For-Testing-Wrapping-Behaviour/dp/B0LONGNAME1');
  await p.evaluate(() => { const s = SlicePay.state(); s.products.forEach(x => x.qty = 3); SlicePay.save(); });
  await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
  await L.delivery(p, { first: 'ალექსანდრე-კონსტანტინე', last: 'ჯავახიშვილ-ორბელიანი', pid: '01001012345', method: 'courier', city: 'ზუგდიდი', addr: 'ზვიად გამსახურდიას სახელობის გამზირი 125, კორპუსი 7, სადარბაზო 3', note: 'ბინა 45, სართული 12, დარეკეთ კარზე ორჯერ და დაელოდეთ' });
  await L.vis(p, 'label.method[data-method="tbc"]').click(); await L.vis(p, 'label.term-chip[data-term="12"]').click();
  await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
  await L.payCard(p); await L.sleep(300);
  const oid = (await L.st(p)).order.id;
  // a second cart in progress for cart/delivery/payment
  await p.goto(L.BASE + '#/'); await L.sleep(100);
  await L.landingAdd(p, 'https://www.ebay.com/itm/Another-Very-Long-Product-Title-Here-For-Wrap/123123123');
  await p.evaluate(() => { const s = SlicePay.state(); s.products[0].qty = 40; s.method = 'tbc'; s.term = 12; s.delivery.done = true; SlicePay.save(); });
  const storage = await ctx.storageState();
  const ss = await p.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)));
  const lsv = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
  await ctx.close();
  const routes = ['#/', '#/cart', '#/delivery', '#/payment', '#/pay', '#/orders', '#/orders/' + oid, '#/orders/731954', '#/pay?order=731954', '#/register/verify?demo=1'];
  const report = [];
  for (const W of WIDTHS) {
    const c2 = await b.newContext({ viewport: { width: W, height: 800 }, storageState: storage });
    const p2 = await c2.newPage(); L.hook(p2, errs, W + ' ');
    await p2.goto(L.BASE + '#/'); await p2.evaluate(s => { const o = JSON.parse(s); for (const k in o) sessionStorage.setItem(k, o[k]); }, ss);
    await p2.evaluate(s => { const o = JSON.parse(s); for (const k in o) localStorage.setItem(k, o[k]); }, lsv);
    await p2.reload(); await L.sleep(200);
    for (const r of routes) {
      await p2.evaluate(h => { location.hash = h; }, r.slice(1)); await L.sleep(300);
      if (r === '#/orders/731954' || r === '#/pay?order=731954') { /* demo user's orders only for the demo user: skip when not found */ }
      const res = await p2.evaluate(() => {
        const out = { ovf: document.documentElement.scrollWidth - innerWidth, hash: location.hash, overlaps: [], clipped: [] };
        const head = document.querySelector('.d-head');
        if (head && head.getClientRects().length) {
          const items = [...head.querySelectorAll('.back, .logo, .acct-link')].filter(e => e.getClientRects().length).map(e => [e.className, e.getBoundingClientRect()]);
          for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
            const a = items[i][1], c = items[j][1];
            if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) out.overlaps.push(items[i][0] + ' x ' + items[j][0]);
          }
        }
        const land = document.querySelector('.landing__acct');
        if (land) { const a = land.getBoundingClientRect(); const lg = document.querySelector('.landing .logo, .landing__logo'); if (lg) { const c = lg.getBoundingClientRect(); if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) out.overlaps.push('landing acct x logo'); } }
        // interactive controls clipped by their own box or off-screen horizontally
        document.querySelectorAll('#app button, #app a, #app input, #app select, #app .term-chip, #app .rcard').forEach(e => {
          if (!e.getClientRects().length || e.classList.contains('sr-only')) return;
          const r = e.getBoundingClientRect();
          if (r.right > innerWidth + 1 || r.left < -1) out.clipped.push((e.id || e.className || e.tagName) + ' x ' + Math.round(r.left) + '..' + Math.round(r.right));
          if ((e.tagName === 'BUTTON' || e.classList.contains('term-chip')) && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible') out.clipped.push((e.id || e.className) + ' text clipped');
        });
        return out;
      });
      report.push(Object.assign({ W, r }, res));
      const ok = res.ovf <= 0 && !res.overlaps.length && !res.clipped.length;
      lg.check(`${W} ${r} (${res.hash}) no overflow / overlap / clipped control`, ok, res);
      if (!ok || W === 320 || W === 900) await p2.screenshot({ path: L.OUT + `/w_${W}_${r.replace(/[#/?=&]+/g, '_')}.png`, fullPage: true });
    }
    await c2.close();
  }
  fs.writeFileSync(L.OUT + '/widths.json', JSON.stringify(report, null, 1));
  lg.summary();
  console.log('ERRS', JSON.stringify(errs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

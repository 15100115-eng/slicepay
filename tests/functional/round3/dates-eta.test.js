// ported from scratchpad tools/v2r3_dates.js
// v2 functional QA round 3 — ETA windows / cross-month formatting / schedule with a faked page clock,
// multi-store carts, every screen that shows the ETA
const L = require('../../lib/harness');
async function etaAll(p) {
  return p.evaluate(() => {
    const t = s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); return e ? e.textContent.replace(/\s+/g, ' ').replace(/ /g, ' ').trim() : null; };
    return t('.eta-box__v') || t('.eta-line__v') || t('.receipt__dline--eta .receipt__dv');
  });
}
(async () => {
  const b = await L.launch();
  const allErrs = {};
  const cases = [
    // clock, urls, delivery, expected ETA, 1st instalment, term
    ['2026-10-20T09:00:00', ['https://www.amazon.com/Echo-Dot/dp/B0ECHO0001', 'https://www.ebay.com/itm/Old-Radio/11223344'], { method: 'courier', city: 'ფოთი', addr: 'ნიკოლაძის 4' }, '31 ოქტომბერი – 11 ნოემბერი', '20 ნოემბერი 2026'],
    ['2026-10-22T09:00:00', ['https://www.amazon.com/Fire-TV/dp/B0FIRE0001'], { method: 'pickup', branch: 'gldani' }, '31 ოქტომბერი – 5 ნოემბერი', '22 ნოემბერი 2026'],
    ['2028-01-31T09:00:00', ['https://www.amazon.com/Ring-Cam/dp/B0RING0001'], { method: 'courier', city: 'თბილისი', addr: 'ჭავჭავაძის 2' }, '10–15 თებერვალი', '29 თებერვალი 2028'],
    ['2027-02-17T09:00:00', ['https://www.amazon.com/Blink/dp/B0BLNK0001'], { method: 'pickup', branch: 'vake' }, '26 თებერვალი – 3 მარტი', '17 მარტი 2027'],
    ['2026-12-27T23:30:00', ['https://www.ebay.com/itm/Vinyl/55443322'], { method: 'courier', city: 'გორი', addr: 'სტალინის 3' }, '10–18 იანვარი', '27 იანვარი 2027'],
  ];
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('dates ' + W);
    let i = 0;
    for (const [clock, urls, dl, expEta, s1] of cases) {
      i++;
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: new Date(clock) });
      try {
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(200);
        await p.evaluate(() => { const s = SlicePay.state(); s.products = []; s.delivery = SlicePay.deliveryDefaults(); SlicePay.save(); });
        await L.landingAdd(p, urls[0]);
        for (const u of urls.slice(1)) await L.cartAdd(p, u);
        const cartBefore = await etaAll(p);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
        await L.delivery(p, Object.assign({ first: 'ა', last: 'ბ', pid: '01001012345' }, dl), false);
        const dEta = await etaAll(p);
        await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(150);
        const pEta = await etaAll(p);
        await L.go(p, '#/cart'); await L.sleep(150);
        const cEta = await etaAll(p);
        await L.go(p, '#/payment'); await L.sleep(100);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
        await L.payCard(p); await L.sleep(400);
        const sEta = await etaAll(p);
        const o = (await L.st(p)).order;
        await L.vis(p, '[data-action="orders"]').click(); await L.waitHash(p, /^#\/orders$/); await L.sleep(150);
        const lEta = await p.evaluate(id => { const a = document.querySelector('.ord-card__link[data-order="' + id + '"]'); const c = a && a.closest('.ord-card'); const e = c && c.querySelector('.eta-line__v'); return e ? e.textContent.replace(/ /g, ' ') : null; }, o.id);
        await L.go(p, '#/orders/' + o.id); await L.sleep(150);
        const det = await p.evaluate(() => ({ eta: [...document.querySelectorAll('.ord-kv__row')].map(r => r.textContent.replace(/ /g, ' ')).find(t => /სავარაუდო/.test(t)), sched: [...document.querySelectorAll('.ord-sched__d')].map(e => e.textContent) }));
        const all = { cartBefore, dEta, pEta, cEta, sEta, lEta, dtEta: det.eta };
        lg.check(`case ${i} ${clock.slice(0, 10)} ${urls.length} store(s) ${dl.method} ${dl.city || dl.branch}: ETA "${expEta}" everywhere`, [dEta, pEta, cEta, sEta, lEta].every(x => x === expEta) && det.eta === 'სავარაუდო მიღება:' + expEta, all);
        lg.info(`case ${i} cart ETA before the delivery step:`, cartBefore);
        lg.check(`case ${i} first instalment ${s1}`, det.sched[0] === s1, det.sched.slice(0, 2));
        lg.check(`case ${i} stored eta from/to ISO`, /^\d{4}-\d{2}-\d{2}$/.test(o.eta.from) && /^\d{4}-\d{2}-\d{2}$/.test(o.eta.to), o.eta);
      } catch (e) { lg.check('case ' + i + ' script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

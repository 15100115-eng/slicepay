// ported from scratchpad tools/v2r3_cheap.js
// customs-free product (item <= 300): checkbox without effect, notes, deferred parts, detail rows
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch(); const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = []; const lg = L.mkLog('cheap ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    try {
      await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(200);
      const url = await p.evaluate(() => { for (let i = 0; i < 500; i++) { const u = 'https://www.ebay.com/itm/Cheap-Cable-' + i + '/77' + i; const m = SlicePay.mockProduct(u); if (m.customs === 0) return u; } });
      await p.evaluate(() => { const s = SlicePay.state(); s.products = []; s.delivery = SlicePay.deliveryDefaults(); SlicePay.save(); });
      await L.landingAdd(p, url);
      const pr = (await L.st(p)).products[0];
      lg.info('cheap product', { item: pr.item, weight: pr.weight, customs: pr.customs, service: pr.service });
      const tot = async () => (await L.totals(p)).total;
      const t1 = await tot();
      await L.vis(p, '#defer-customs').click({ force: true }); await L.sleep(100);
      const t2 = await tot();
      lg.check('customs checkbox has no price effect (customs 0)', t1 === t2, [t1, t2]);
      await L.vis(p, '#defer-customs').click({ force: true }); await L.sleep(100);
      const notesCart = await p.evaluate(() => [...document.querySelectorAll('.bd__amt.is-struck')].length);
      await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
      await L.delivery(p, { first: 'a', last: 'b', pid: '01001012345' });
      await L.sleep(200); const pn = await p.evaluate(() => [...document.querySelectorAll('.pay-notes li')].filter(x => x.getClientRects().length).map(x => x.textContent)); lg.info('dbg', await p.evaluate(() => [location.hash, JSON.stringify(SlicePay.totals()), document.querySelectorAll('.pay-notes').length, (document.querySelector('.pay-notes')||{}).outerHTML]));
      lg.check('payment notes: only the weight deferral', JSON.stringify(pn) === JSON.stringify(['წონის თანხას მოგვიანებით გადავიხდი']), pn);
      await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
      await L.payCard(p); await L.sleep(300);
      const o = (await L.st(p)).order;
      lg.check('order: deferred.customs null, weight deferred', o.deferred.customs === null && o.deferred.weight && o.deferred.weight.prepaid === false, o.deferred);
      const sn = await p.evaluate(() => [...document.querySelectorAll('.item__note')].map(x => x.textContent));
      lg.check('success notes: only წონის გარეშე', JSON.stringify(sn) === '["წონის გარეშე"]', sn);
      await L.go(p, '#/orders/' + o.id); await L.sleep(200);
      const rows = await p.evaluate(() => [...document.querySelectorAll('.ord-part')].map(x => x.textContent.replace(/\s+/g, ' ')));
      lg.check('detail: one deferred row (weight)', rows.length === 1 && /წონის საფასური/.test(rows[0]), rows);
      // explanation from the detail: weight line for this product
      await p.click('.ord-part .info-btn'); await L.sleep(400);
      const calc = await p.evaluate(() => (document.querySelector('#modal .explain__calc') || {}).textContent);
      const kg = String(Math.round(pr.weight / 25 * 10) / 10).replace('.', ',');
      lg.check('detail info line', calc === `დაახლოებითი წონა: ${kg} კგ × 25₾ = ${pr.weight}₾`, calc);
    } catch (e) { lg.check('script error', false, String(e).slice(0, 300)); }
    await ctx.close(); lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs)); await b.close();
})();

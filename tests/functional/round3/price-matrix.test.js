// ported from scratchpad tools/v2r3_prices.js
// v2 functional QA round 3 — price matrix: 2 checkboxes × delivery fee (0/5/10) × method/term, consistent on
// cart / payment / success / orders list / order detail (+ schedule) — driven through the UI
const L = require('../../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
const MT = [['bog', 3], ['tbc', 12], ['mere', 6], ['bog', 4], ['tbc', 9], ['mere', 12], ['bog', 6], ['tbc', 3], ['mere', 4], ['tbc', 6], ['tbc', 4], ['bog', 3]];
const DL = [{ method: 'pickup', branch: 'saburtalo', fee: 0 }, { method: 'courier', city: 'თბილისი', addr: 'ყაზბეგის 5', fee: 5 }, { method: 'courier', city: 'თელავი', addr: 'ერეკლე II 3', fee: 10 }];
const num = s => s == null ? null : +String(s).replace(/[^\d]/g, '');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('prices ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
    let i = 0;
    for (const wDef of ['1', '0']) for (const cDef of ['1', '0']) for (const dl of DL) {
      const [method, term] = MT[i % MT.length]; i++;
      const tag = `#${i} w${wDef} c${cDef} fee${dl.fee} ${method}/${term}`;
      try {
        const sub = 600 + (wDef === '0' ? 100 : 0) + (cDef === '0' ? 250 : 0), total = sub + dl.fee, mon = Math.ceil(total / term);
        await p.goto(L.BASE + `#/cart?demo=1&weight=${wDef}&customs=${cDef}`); await L.sleep(250);
        // the demo seed completes a pickup delivery: re-open the step through the UI
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(150);
        await p.fill('#d-pid', '01001012345');
        if (dl.method === 'courier') { await p.click('.rcard[data-value="courier"]'); await p.selectOption('#d-city', dl.city); await p.fill('#d-addr', dl.addr); }
        else { await p.click('.rcard[data-value="pickup"]'); await p.selectOption('#d-branch', dl.branch); }
        await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(150);
        // method + term through the UI
        await L.vis(p, `label.method[data-method="${method}"]`).click(); await L.sleep(80);
        await L.vis(p, `label.term-chip[data-term="${term}"]`).click(); await L.sleep(80);
        const pay = await p.evaluate(() => {
          const v = s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
          return { total: v('.pay-total'), mo: v('.pay-mo__v'), ml: v('.pay-mo__l'),
            chips: [...document.querySelectorAll('.term-chip')].map(c => [c.querySelector('.term-chip__n').textContent, c.querySelector('.term-chip__m').textContent, c.classList.contains('is-selected')]),
            bd: [...document.querySelectorAll('#pay-bd .bd__row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()) };
        });
        const chipOk = pay.chips.every(([n, m, sel]) => { const N = parseInt(n); return m === Math.ceil(total / N) + '₾ / თვე' && sel === (N === term); });
        lg.check(`${tag} payment: total ${total}, ${mon}/mo, "${term} თვეში", chips`, num(pay.total) === total && num(pay.mo) === mon && pay.ml === term + ' თვეში' && chipOk, pay);
        const feeRow = pay.bd.find(r => /მიწოდების ფასი/.test(r));
        lg.check(`${tag} payment breakdown fee row ${dl.fee ? 'present ' + dl.fee : 'absent'} / ჯამი ${total}`, (dl.fee ? feeRow && num(feeRow) === dl.fee : !feeRow) && num(pay.bd.find(r => /ჯამი/.test(r))) === total, pay.bd);
        // cart reflects the same (fee in total once the delivery step is done, chosen term)
        await L.go(p, '#/cart'); await L.sleep(200);
        const cart = await p.evaluate(() => { const v = s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { mo: v('.cart-sum__mo'), ml: v('.cart-sum__mo-l'), tot: v('.cart-sum__total'), fee: v('.cart-sum__fee'), prod: v('.prod__price') }; });
        lg.check(`${tag} cart: სულ ${total}, ${mon} ${term} თვეში, fee line ${dl.fee || 'none'}, product ${sub}`, num(cart.tot) === total && num(cart.mo) === mon && cart.ml === term + ' თვეში' && (dl.fee ? num(cart.fee) === dl.fee : cart.fee === null) && num(cart.prod) === sub, cart);
        await L.go(p, '#/payment'); await L.sleep(150);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
        await L.payCard(p); await L.sleep(300);
        const o = (await L.st(p)).order;
        lg.check(`${tag} order snapshot total/monthly/term/fee/method`, o.total === total && o.monthly === mon && o.term === term && o.deliveryFee === dl.fee && o.method === method, { t: o.total, m: o.monthly, term: o.term, f: o.deliveryFee, me: o.method });
        const suc = await p.evaluate(() => {
          const q = s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
          return { r1: q('.ssum__row--1')[0], fee: q('.receipt__fee')[0] || null, r2: q('.ssum__row--2')[0], item: q('.item__price')[0], notes: q('.item__note'), dl: q('.receipt__dline--1')[0], method: q('.receipt__method')[0] };
        });
        lg.check(`${tag} success: თვეში ${term}x ${mon}, fee ${dl.fee || 'none'}, სულ ${total}, item ${sub}`, suc.r1 === `თვეში${term}x${mon}₾` && (dl.fee ? num(suc.fee) === dl.fee : suc.fee === null) && num(suc.r2) === total && num(suc.item) === sub, suc);
        const expNotes = [].concat(wDef === '1' ? ['წონის გარეშე'] : [], cDef === '1' ? ['განბაჟების გარეშე'] : []);
        lg.check(`${tag} success item notes ${JSON.stringify(expNotes)}`, JSON.stringify(suc.notes) === JSON.stringify(expNotes), suc.notes);
        const expDl = dl.method === 'courier' ? `კურიერით: ${dl.city}, ${dl.addr}` : 'ფილიალიდან გატანა: საბურთალოს ფილიალი';
        lg.check(`${tag} success delivery line`, suc.dl === expDl, suc.dl);
        // orders list card
        await L.vis(p, '[data-action="orders"]').click(); await L.waitHash(p, /^#\/orders$/); await L.sleep(200);
        const card = await p.evaluate(id => { const a = document.querySelector('.ord-card__link[data-order="' + id + '"]'); const c = a && a.closest('.ord-card'); if (!c) return null; const q = s => { const e = c.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { sum: q('.ord-card__sum'), pill: q('.status-pill'), due: q('.ord-due-badge'), first: document.querySelector('.ord-card') === c }; }, o.id);
        lg.check(`${tag} list card "სულ ${total}₾ · ${mon}₾ × ${term} თვე", newest first, pill მუშავდება, no due badge`, card && card.sum === `სულ ${total}₾ · ${mon}₾ × ${term} თვე` && card.first && card.pill === 'მუშავდება' /* v4 first status */ && !card.due, card);
        // detail
        await L.go(p, '#/orders/' + o.id); await L.sleep(200);
        const det = await p.evaluate(() => {
          const q = s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
          return { kv: q('#os-pay ~ .ord-kv .ord-kv__row, .ord-sec[aria-labelledby="os-pay"] .ord-kv__row'), sched: q('.ord-sched__a').map(x => +x.replace(/\D/g, '')), parts: q('.ord-part'), due: q('.ord-due__total')[0] || null, prod: q('.ord-prod__price')[0], method: q('.ord-pay__method')[0] };
        });
        const sum = det.sched.reduce((a, x) => a + x, 0);
        lg.check(`${tag} detail: ვადა ${term} თვე, fee, სულ ${total}; schedule ${term} rows sum ${total}, each ≤ ${mon} & ≥ ${mon - 1}`,
          det.kv.includes(`ვადა:${term} თვე`) && det.kv.includes(`სულ:${total}₾`) && (dl.fee ? det.kv.includes(`მიწოდების ფასი:${dl.fee}₾`) : !det.kv.some(x => /მიწოდების/.test(x))) &&
          det.sched.length === term && sum === total && det.sched.every(x => x <= mon && x >= mon - 1), det);
        lg.check(`${tag} detail method line = success method line`, det.method === suc.method, [det.method, suc.method]);
        const expParts = (wDef === '1' ? 1 : 0) + (cDef === '1' ? 1 : 0);
        lg.check(`${tag} detail: ${expParts} deferred row(s) pending, nothing due`, det.parts.length === expParts && det.parts.every(x => /განისაზღვრება ამანათის ჩამოსვლისას/.test(x)) && !det.due, det.parts);
        lg.check(`${tag} detail product price ${sub}`, num(det.prod) === sub, det.prod);
      } catch (e) { lg.check(tag + ' script error', false, String(e).slice(0, 400)); }
    }
    await ctx.close();
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

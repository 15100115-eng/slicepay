// ported from scratchpad tools/v2f_prices.js
// Price combinations: 2 checkboxes x delivery fee x terms (x method), consistent across cart / payment / success / orders
const L = require('../../lib/harness');
const BANK = { bog: 'საქართველოს ბანკი: ნაწილ-ნაწილ', tbc: 'თიბისი ბანკი: განაწილება', mere: 'მერე: ბარათით გადახდა' };
const num = s => s == null ? null : +String(s).replace(/[^\d]/g, '');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  const MT = [['bog', 3], ['tbc', 12], ['mere', 6], ['tbc', 9], ['bog', 6], ['mere', 12], ['tbc', 3], ['bog', 4], ['mere', 4], ['tbc', 6], ['bog', 3], ['tbc', 4]];
  const FEES = [['pickup', 0], ['courier', 5, 'თბილისი'], ['courier', 10, 'რუსთავი']];
  const DEF = [[true, true], [true, false], [false, true], [false, false]];
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('price ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    let i = 0;
    for (const [dw, dc] of DEF) for (const fee of FEES) {
      const [method, term] = MT[i % MT.length];
      const addMock = i % 3 === 0;
      const tag = `#${i} w${dw ? 'D' : 'P'} c${dc ? 'D' : 'P'} fee${fee[1]} ${method}/${term}${addMock ? ' +mock×2' : ''}`;
      i++;
      await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
      if (addMock) { await L.cartAdd(p, 'https://www.amazon.com/Sony-WH1000XM5-Headphones/dp/B09XS7JWHH'); await L.cartAdd(p, 'https://www.amazon.com/Sony-WH1000XM5-Headphones/dp/B09XS7JWHH'); }
      if ((await p.isChecked('#defer-weight')) !== dw) await p.click('#defer-weight', { force: true });
      if ((await p.isChecked('#defer-customs')) !== dc) await p.click('#defer-customs', { force: true });
      await L.sleep(150);
      const prods = (await L.st(p)).products;
      // expected
      let item = 0, weight = 0, customs = 0, service = 0, sub = 0;
      const perProd = prods.map(x => { const q = x.qty || 1; const pay = (x.item + x.service + (dw ? 0 : x.weight) + (dc ? 0 : x.customs)) * q; item += x.item * q; weight += x.weight * q; customs += x.customs * q; service += x.service * q; sub += pay; return pay; });
      const total = sub + fee[1], monthly = Math.ceil(total / term);
      // cart (delivery from demo is done/pickup -> no fee yet)
      const cart = await p.evaluate(() => ({ prices: [...document.querySelectorAll('.prod')].filter(e => e.getClientRects().length).map(a => a.querySelector('.prod__price').textContent), total: [...document.querySelectorAll('.cart-sum__total')].filter(e => e.getClientRects().length)[0].textContent, mo: [...document.querySelectorAll('.cart-sum__mo')].filter(e => e.getClientRects().length)[0].textContent }));
      lg.check(tag + ' cart: product prices', JSON.stringify(cart.prices.map(num)) === JSON.stringify(perProd), [cart.prices, perProd]);
      lg.check(tag + ' cart: total ' + sub + ' monthly ' + Math.ceil(sub / 4), num(cart.total) === sub && num(cart.mo) === Math.ceil(sub / 4), cart);
      // delivery
      await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
      await L.delivery(p, { pid: '01001012345', method: fee[0], city: fee[2], addr: fee[0] === 'courier' ? 'ქუჩა 1' : null });
      await L.sleep(250);
      // payment
      await L.vis(p, 'label.method[data-method="' + method + '"]').click(); await L.sleep(60);
      await L.vis(p, 'label.term-chip[data-term="' + term + '"]').click(); await L.sleep(80);
      if (!(await p.getAttribute('#pay-toggle', 'aria-expanded') === 'true')) { await L.vis(p, '#pay-toggle').click(); await L.sleep(300); }
      const pay = await p.evaluate(() => ({
        total: [...document.querySelectorAll('.pay-total')].filter(e => e.getClientRects().length)[0].textContent,
        mo: document.getElementById('pay-mo').textContent,
        chip: (document.querySelector('.term-chip.is-selected .term-chip__m') || {}).textContent,
        rows: [...document.querySelectorAll('#pay-bd .bd__row')].map(r => [r.querySelector('.bd__lab').textContent, r.querySelector('.bd__amt').firstChild.textContent.trim(), r.querySelector('.bd__amt').classList.contains('is-struck')]),
        fits: (() => { const bd = document.getElementById('pay-bd'); return bd.scrollHeight <= bd.clientHeight + 1; })(),
        notes: [...document.querySelectorAll('.pay-notes li')].map(e => e.textContent),
      }));
      const expRows = [['ნივთის ფასი', item, false], ['წონის დაახ. ფასი', weight, dw && weight > 0], ['განბაჟების დაახ. ფასი', customs, dc && customs > 0], ['მომსახურების ფასი', service, false]].concat(fee[1] ? [['მიწოდების ფასი', fee[1], false]] : []).concat([['ჯამი', total, false]]);
      lg.check(tag + ' payment: total ' + total + ', monthly ' + monthly + ' (' + term + ' თვეში), chip', num(pay.total) === total && pay.mo.replace(/\s/g, '') === (W >= 900 ? term + 'თვეში' + monthly + '₾' : monthly + '₾' + term + 'თვეში') && pay.chip === monthly + '₾ / თვე', pay);
      lg.check(tag + ' payment: breakdown rows', JSON.stringify(pay.rows.map(r => [r[0], num(r[1]), r[2]])) === JSON.stringify(expRows) && pay.fits, [pay.rows, expRows, pay.fits]);
      const expNotes = [].concat(dw && weight > 0 ? ['წონის თანხას მოგვიანებით გადავიხდი'] : []).concat(dc && customs > 0 ? ['განბაჟების თანხას მოგვიანებით გადავიხდი'] : []);
      lg.check(tag + ' payment: notes', JSON.stringify(pay.notes) === JSON.stringify(expNotes), pay.notes);
      // cart after delivery: total incl. fee and the chosen term
      await L.go(p, '#/cart'); await L.sleep(200);
      const cart2 = await p.evaluate(() => ({ total: [...document.querySelectorAll('.cart-sum__total')].filter(e => e.getClientRects().length)[0].textContent, mo: [...document.querySelectorAll('.cart-sum__mo')].filter(e => e.getClientRects().length)[0].textContent, l: [...document.querySelectorAll('.cart-sum__mo-l')].filter(e => e.getClientRects().length)[0].textContent }));
      lg.check(tag + ' cart after delivery: ' + total + ' / ' + monthly + ' ' + term + ' თვეში', num(cart2.total) === total && num(cart2.mo) === monthly && cart2.l === term + ' თვეში', cart2);
      await L.go(p, '#/payment'); await L.sleep(200);
      if ((await L.H(p)) !== '#/payment') { lg.check(tag + ' payment reachable again', false, await L.H(p)); continue; }
      await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
      await L.payCard(p); await L.sleep(400);
      // success
      const s = await p.evaluate(() => ({
        items: [...document.querySelectorAll('.receipt__items .item')].map(li => [li.querySelector('.item__qty').textContent, li.querySelector('.item__price').textContent, [...li.querySelectorAll('.item__note')].map(n => n.textContent).join('+')]),
        method: document.querySelector('.receipt__method').textContent,
        r1: document.querySelector('.ssum__row--1').innerText.replace(/\s+/g, ' '),
        fee: (document.querySelector('.receipt__fee') || {}).innerText,   // v3 low-2: the labelled fee line of the receipt's delivery section
        total: document.querySelector('.ssum__row--2 .ssum__v').textContent,
        dl: [...document.querySelectorAll('.receipt__dline')].map(e => e.textContent),
        id: SlicePay.getState().order.id,
      }));
      lg.check(tag + ' success: item prices', JSON.stringify(s.items.map(x => num(x[1]))) === JSON.stringify(perProd) && s.items.map(x => x[0]).join() === prods.map(x => (x.qty || 1) + 'x').join(), s.items);
      const expNote = (x) => [].concat(dw && x.weight > 0 ? ['წონის გარეშე'] : []).concat(dc && x.customs > 0 ? ['განბაჟების გარეშე'] : []).join('+');
      lg.check(tag + ' success: item notes', JSON.stringify(s.items.map(x => x[2])) === JSON.stringify(prods.map(expNote)), s.items.map(x => x[2]));
      lg.check(tag + ' success: method label', s.method === BANK[method], s.method);
      // v3 reconcile: split so the summary numbers and the spec'd fee row are reported separately (the fee-row half is unchanged:
      // FEATURES_SPEC "Success screen additions: Add a `მიწოდების ფასი` summary row only if > 0")
      lg.check(tag + ' success: თვეში ' + term + 'x ' + monthly + '₾, სულ ' + total, s.r1 === 'თვეში ' + term + 'x ' + monthly + '₾' && num(s.total) === total, s);
      lg.check(tag + ' success: fee row ' + (fee[1] ? 'მიწოდების ფასი ' + fee[1] + '₾' : 'absent'), fee[1] ? (s.fee || '').replace(/\s+/g, ' ').trim() === 'მიწოდების ფასი ' + fee[1] + ' ₾' : !s.fee, s);
      lg.check(tag + ' success: delivery line', s.dl[0] === (fee[0] === 'pickup' ? 'ფილიალიდან გატანა: ვაკის ფილიალი' : 'კურიერით: ' + fee[2] + ', ქუჩა 1'), s.dl);
      // orders
      await L.vis(p, '[data-action="orders"]').click(); await L.waitHash(p, /^#\/orders$/); await L.sleep(250);
      const card = await p.evaluate(id => { const a = document.querySelector('.ord-card__link[data-order="' + id + '"]'); const c = a && a.closest('.ord-card'); return c ? { sum: c.querySelector('.ord-card__sum').textContent, due: !!c.querySelector('.ord-due-badge'), pill: c.querySelector('.status-pill').textContent, more: (c.querySelector('.ord-card__more') || {}).textContent || '', badge: (c.querySelector('.badge') || {}).textContent } : null; }, s.id);
      lg.check(tag + ' orders card: სულ ' + total + '₾ · ' + monthly + '₾ × ' + term + ' თვე, მუშავდება, no due', card && card.sum === 'სულ ' + total + '₾ · ' + monthly + '₾ × ' + term + ' თვე' && !card.due && card.pill === 'მუშავდება' /* v4 first status */ && card.more === (prods.length > 1 ? '+' + (prods.length - 1) : ''), card);
      await L.go(p, '#/orders/' + s.id); await L.sleep(250);
      const d = await p.evaluate(() => ({
        sched: [...document.querySelectorAll('.ord-sched__row')].map(r => r.querySelector('.ord-sched__a').textContent),
        kv: [...document.querySelectorAll('.ord-sec .ord-kv__row')].map(r => r.innerText.replace(/\s+/g, ' ')),
        parts: [...document.querySelectorAll('.ord-part')].map(r => r.innerText.replace(/\s+/g, ' ')),
        payBtn: !!document.querySelector('[data-action="pay"]'),
        prices: [...document.querySelectorAll('.ord-prod__price')].map(e => e.textContent),
        method: (document.querySelector('.ord-pay__method') || {}).textContent,
      }));
      const sched = d.sched.map(num);
      // v3 reconcile: REV2-08 (core v2 r1, INTEGRATION_V2 SP.orderSchedule) spreads the remainder +1₾ over the first
      // instalments (605/12 -> 51 × 5 + 50 × 7), so every row is within 1₾ of the shown ceil monthly and the rows sum to
      // the total; the old 'ceil × (n−1) + smaller last' split (51 × 11 + 44) is gone.
      const base = Math.floor(total / term), rem = total - base * term;
      const expSched = Array.from({ length: term }, (_, k) => base + (k < rem ? 1 : 0));
      lg.check(tag + ' detail: ' + term + ' instalments sum ' + total, JSON.stringify(sched) === JSON.stringify(expSched), [sched, expSched]);
      lg.check(tag + ' detail: kv ვადა/fee/სულ', d.kv.includes('ვადა: ' + term + ' თვე') && d.kv.includes('სულ: ' + total + '₾') && (fee[1] ? d.kv.includes('მიწოდების ფასი: ' + fee[1] + '₾') : !d.kv.some(x => x.startsWith('მიწოდების ფასი'))), d.kv);
      const expParts = [].concat(dw && weight > 0 ? ['წონის საფასური დაახ. ' + weight + '₾ განისაზღვრება ამანათის ჩამოსვლისას'] : []).concat(dc && customs > 0 ? ['განბაჟება დაახ. ' + customs + '₾ განისაზღვრება ამანათის ჩამოსვლისას'] : []);
      lg.check(tag + ' detail: deferred rows pending, no pay button', JSON.stringify(d.parts) === JSON.stringify(expParts) && !d.payBtn, [d.parts, expParts]);
      lg.check(tag + ' detail: product prices + method', JSON.stringify(d.prices.map(num)) === JSON.stringify(perProd) && d.method === BANK[method], [d.prices, d.method]);
    }
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

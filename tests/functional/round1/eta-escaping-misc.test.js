// ported from scratchpad tools/v2f_misc.js
// ETA consistency across all screens (faked date, cross-month), escaping in orders, empty state, layout, stale fee
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('misc ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: new Date('2026-10-20T09:00:00') });
    // ETA consistency: ebay item, courier Batumi on 20 Oct -> 12+2..20+2 = 3 Nov – 11 Nov
    await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
    await L.cartAdd(p, 'https://www.ebay.com/itm/Old-Typewriter/5544332211');
    const cartEta0 = await L.tc(p, '#cart-eta');
    lg.check('cart ETA (amazon+ebay, pickup) 29 ოქტომბერი – 9 ნოემბერი', cartEta0 === 'სავარაუდო მიღება: 29 ოქტომბერი – 9 ნოემბერი', cartEta0);
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
    const XSS = '<img src=x onerror="window.__xss=1">';
    await L.delivery(p, { first: XSS, last: '<b>ბ</b>', pid: '01001012345', method: 'courier', city: 'ბათუმი', addr: '<i>ზ</i> ' + XSS, note: '"><svg onload=window.__xss=2>' }, false);
    const dEta = await L.tc(p, '#d-eta');
    await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(250);
    const pEta = await L.tc(p, '#pay-eta');
    await L.go(p, '#/cart'); const cEta = await L.tc(p, '#cart-eta');
    await L.go(p, '#/payment'); await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
    await L.payCard(p); await L.sleep(400);
    const sEta = await p.evaluate(() => [...document.querySelectorAll('.receipt__dline')].map(e => e.textContent)[1]);
    const oid = (await L.st(p)).order.id;
    await L.go(p, '#/orders'); await L.sleep(200);
    const lEta = await p.evaluate(id => document.querySelector('.ord-card__link[data-order="' + id + '"]').closest('.ord-card').querySelector('.ord-card__eta').textContent, oid);
    await L.go(p, '#/orders/' + oid); await L.sleep(200);
    const det = await L.appText(p);
    // v3 reconcile: whitespace collapsed (REV2R3-03 glues day–month with a no-break space on the orders card).
    // Expected window per spec: multi-store cart -> widest base window (amazon 9–14 + ebay 12–20 = 9–20, as the cart
    // check above confirms: 29 Oct – 9 Nov), +2 days for courier to the regions on BOTH ends: 20 Oct + 11..22 =
    // 31 Oct – 11 Nov. The old expectation (29 Oct – 11 Nov) shifted only the end; all six screens agree on 31 Oct.
    const ns = x => String(x).replace(/\s+/g, ' ');
    const all = { dEta: ns(dEta), pEta: ns(pEta), cEta: ns(cEta), sEta: ns(sEta), lEta: ns(lEta) };
    const exp = '31 ოქტომბერი – 11 ნოემბერი';
    lg.check('ETA identical on delivery/payment/cart/success/list/detail = ' + exp, all.dEta === exp && all.pEta === 'სავარაუდო მიღება: ' + exp && all.cEta === 'სავარაუდო მიღება: ' + exp && all.sEta === 'სავარაუდო მიღება: ' + exp && all.lEta === 'სავარაუდო მიღება: ' + exp && det.includes('სავარაუდო მიღება: ' + exp), all);
    lg.check('no script/markup executed from user text', !(await p.evaluate(() => window.__xss)) && !(await p.$('#app img[src="x"], #app svg[onload], #app i, #app b:not(.auth__phone)')));
    lg.check('detail shows escaped recipient + address literally', det.includes('<img src=x') && det.includes('<i>ზ</i>'), det.slice(0, 300));
    await L.go(p, '#/orders'); await L.sleep(200);
    lg.check('list shows no injected markup', !(await p.evaluate(() => window.__xss)));
    // new order detail: timeline only first step, others todo
    await L.go(p, '#/orders/' + oid); await L.sleep(200);
    const tl = await p.evaluate(() => [...document.querySelectorAll('.tl__item')].map(li => li.className.replace('tl__item ', '')));
    // v4: a new order starts at მუშავდება (current) + 6 todo
    lg.check('new order timeline: მუშავდება current, 6 todo (courier variant)', tl.join() === 'is-current,is-todo,is-todo,is-todo,is-todo,is-todo,is-todo' && (await L.appVisText(p, '.tl__item.is-current .tl__label')) === 'მუშავდება' && (await L.appText(p)).includes('კურიერთანაა'), tl);
    // layout: desktop 645 column, 20 px gaps
    if (W >= 900) {
      await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(300);
      const lay = await p.evaluate(() => { const cs = [...document.querySelectorAll('.ord-card')].map(c => c.getBoundingClientRect()); return { w: cs.map(c => Math.round(c.width)), x: cs.map(c => Math.round(c.left)), gap: cs.length > 1 ? Math.round(cs[1].top - cs[0].bottom) : null, vw: innerWidth }; });
      lg.check('desktop list: 645 px centred column, 20 px gaps', lay.w.every(x => x === 645) && Math.abs(lay.x[0] - (lay.vw - 645) / 2) <= 1 && lay.gap === 20, lay);
      await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(300);
      const lay2 = await p.evaluate(() => [...document.querySelectorAll('.ord-sec')].map(c => Math.round(c.getBoundingClientRect().width)));
      lg.check('desktop detail sections 645 px', lay2.every(x => x === 645), lay2);
      const dl = await p.evaluate(() => { const m = document.querySelector('.dlv, main'); return null; });
    }
    // empty state
    await p.goto(L.BASE + '#/orders?demo=1&empty=1'); await L.sleep(300);
    const em = await p.evaluate(() => ({ t: (document.querySelector('.ord-empty__t') || {}).textContent, btns: [...document.querySelectorAll('[data-action="new"]')].filter(e => e.getClientRects().length).map(e => e.innerText.split('\n')[0]) }));
    lg.check('empty state text + visible ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ', em.t === 'ჯერ არ გაქვთ შეკვეთები' && em.btns.length === 1 && em.btns[0] === 'ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ', em);
    await L.vis(p, '[data-action="new"]').click(); await L.sleep(300);
    lg.check('ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ -> landing', (await L.H(p)) === '#/', await L.H(p));
    await L.shot(p, 'landing_signed_in_' + W);
    // landing link style
    // v3 reconcile: on desktop the link is right-aligned to the desktop content container (landing.css
    // `.landing__acct{width:min(var(--d-container),calc(100% - 80px))}`, like the inner-screen header link), so at 1440
    // it sits 156 px from the viewport edge ((1440 − 1128) / 2), not < 80. Mobile keeps the < 80 corner check.
    const ll = await p.evaluate(() => { const a = document.querySelector('.landing__acct a'); const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
      const cont = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--d-container')) || 0;
      return { t: a.textContent, c: cs.color, fs: cs.fontSize, ico: !!a.querySelector('svg'), right: Math.round(innerWidth - r.right), top: Math.round(r.top), contRight: Math.round((innerWidth - Math.min(cont, innerWidth - 80)) / 2) }; });
    const llRightOk = W >= 900 ? Math.abs(ll.right - ll.contRight) <= 6 : ll.right < 80;
    lg.check('landing link white 16px with user icon, top-right (desktop: container edge)', ll.c === 'rgb(255, 255, 255)' && ll.fs === '16px' && ll.ico && llRightOk && ll.top < 80, ll);
    // stale fee: delivery done (courier Batumi) -> remove all products -> new cart
    await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
    await L.delivery(p, { pid: '01001012345', method: 'courier', city: 'ბათუმი', addr: 'ქ. 1' }); await L.sleep(200);
    await L.go(p, '#/cart'); await L.sleep(200);
    await L.vis(p, '#rm-demo-nike').click(); await L.sleep(500);
    lg.info('after removing the last product ->', await L.H(p));
    await p.fill('#url', 'https://www.amazon.com/Brand-New-Thing/dp/B0NEWNEW1'); await p.press('#url', 'Enter');
    await L.waitHash(p, /^#\/cart/, 8000); await L.sleep(300);
    const t = await L.totals(p);
    lg.info('new cart after emptying: totals', JSON.stringify(t), 'delivery.done', (await L.st(p)).delivery.done);
    await L.go(p, '#/payment');
    lg.info('new cart: direct #/payment ->', await L.H(p), '(delivery step skipped if #/payment)');
    // QA URLs from the spec
    for (const [h, sel, want] of [['#/delivery?demo=1&delivery=courier&err=1', '#d-city-err', 'აირჩიეთ ქალაქი'], ['#/pay?demo=1&order=731954', '.paycard__due-amt', 'გადასახდელი: 350₾'], ['#/success?demo=1&delivery=courier', '.receipt__dline--1', 'კურიერით: თბილისი, ვაჟა-ფშაველას გამზ. 12'], ['#/payment?demo=1&term=6', '#pay-mo', W >= 900 ? '6 თვეში100₾' : '100₾6 თვეში']]) {   // v3 reconcile: desktop monthly reads label-first (payment fixer v2 r1)
      await p.goto(L.BASE + h); await L.sleep(350);
      const got = await L.tc(p, sel);
      lg.check('QA ' + h + ' -> ' + want, got === want, got);
    }
    lg.check('no overflow', await L.noOverflow(p));
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

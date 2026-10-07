// ported from scratchpad tools/v2f_nav.js
// Guards, ?next handling, back/forward through the new flow, account links (landing + desktop header)
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('nav ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const fresh = async (hash) => { await p.goto('about:blank'); await p.goto(L.BASE + '#/'); await p.evaluate(() => { sessionStorage.clear(); }); await p.goto('about:blank'); await p.goto(L.BASE + hash); await L.sleep(300); return L.H(p); };
    await p.goto(L.BASE + '#/'); await p.evaluate(() => { localStorage.clear(); });
    // signed out guards
    for (const [h, exp] of [['#/delivery', '#/'], ['#/payment', '#/'], ['#/register/verify', '#/register'], ['#/orders', '#/login?next=/orders'], ['#/orders/731954', '#/login?next=/orders/731954'], ['#/orders/abc%2F..', '#/login?next=/orders/abc%252F..']]) {   // v3 reconcile: next= is URL-encoded ('%' -> '%25'), as '/pay%3Forder%3D731954' (QA r3 expectation)
      const got = await fresh(h);
      lg.check('signed out ' + h + ' -> ' + exp, got === exp, got);
    }
    // products, signed out, no remember -> register; with remember -> login
    await fresh('#/cart?demo=1&auth=0');
    await L.go(p, '#/delivery');
    lg.check('cart, signed out, no remember: #/delivery -> #/register', (await L.H(p)) === '#/register', await L.H(p));
    await p.evaluate(() => localStorage.setItem('slicepay:v1:remember', JSON.stringify('555123456')));
    await L.go(p, '#/payment');
    lg.check('cart, signed out, remembered: #/payment -> #/login', (await L.H(p)) === '#/login', await L.H(p));
    await p.evaluate(() => localStorage.removeItem('slicepay:v1:remember'));
    // login next round-trips
    const got1 = await fresh('#/orders/731954');
    await p.evaluate(() => SlicePay.api.ensureDemoUser());
    await L.login(p, '555123456', 'slicepay1'); await L.sleep(300);
    lg.check('login with next=/orders/731954 -> detail', (await L.H(p)) === '#/orders/731954', await L.H(p));
    await fresh('#/pay?order=731954');
    lg.info('signed-out #/pay?order -> ', await L.H(p));
    await L.login(p, '555123456', 'slicepay1'); await L.sleep(300);
    lg.check('login with next=/pay?order=731954 -> order pay form', (await L.H(p)) === '#/pay?order=731954' && (await L.tc(p, '.paycard__due-amt')) === 'გადასახდელი: 350₾', [await L.H(p), await L.tc(p, '.paycard__due-amt')]);
    for (const [nx, exp] of [['/register', '#/orders'], ['//evil.example', '#/orders'], ['https://evil.example', '#/orders'], ['/register/verify', '#/orders'], ['/nope', '#/orders'], ['/delivery', '#/']]) {
      await fresh('#/login?next=' + encodeURIComponent(nx));
      await L.login(p, '555123456', 'slicepay1'); await L.sleep(300);
      lg.check('login next=' + nx + ' -> ' + exp, (await L.H(p)) === exp, await L.H(p));
    }
    // register link on login keeps next
    await fresh('#/login?next=/orders');
    const regHref = await p.evaluate(() => [...document.querySelectorAll('a.link')].map(a => a.getAttribute('href')).find(h => h.startsWith('#/register')));
    lg.check('login -> register link keeps next', regHref === '#/register?next=/orders', regHref);

    // back / forward through the new flow (demo user signed in)
    await fresh('#/cart?demo=1');
    await p.evaluate(() => { const d = SlicePay.state().delivery; d.done = false; d.pid = ''; SlicePay.save(); });
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
    await L.delivery(p, { pid: '01001012345' }); await L.sleep(200);
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/); await L.sleep(200);
    lg.check('cart -> delivery -> payment -> pay', (await L.H(p)) === '#/pay');
    await p.goBack(); await L.sleep(250); const h1 = await L.H(p);
    await p.goBack(); await L.sleep(250); const h2 = await L.H(p);
    await p.goBack(); await L.sleep(250); const h3 = await L.H(p);
    // v3 reconcile: QA params stay in their entry's URL (the entry is stamped spQA, not rewritten), so the first entry is
    // still '#/cart?demo=1'; Back onto it does not re-apply the QA seed
    lg.check('Back x3: payment, delivery, cart', [h1, h2, h3].join() === '#/payment,#/delivery,#/cart?demo=1', [h1, h2, h3]);
    await p.goForward(); await L.sleep(250); const f1 = await L.H(p);
    await p.goForward(); await L.sleep(250); const f2 = await L.H(p);
    await p.goForward(); await L.sleep(250); const f3 = await L.H(p);
    lg.check('Forward x3: delivery, payment, pay', [f1, f2, f3].join() === '#/delivery,#/payment,#/pay', [f1, f2, f3]);
    // in-app back links use history (no duplicate entries)
    const len0 = await p.evaluate(() => history.length);
    await L.vis(p, '[data-back="/payment"]').click(); await L.sleep(250);
    await L.vis(p, '[data-back="/delivery"]').click(); await L.sleep(250);
    await L.vis(p, '[data-back="/cart"]').click(); await L.sleep(250);
    const len1 = await p.evaluate(() => history.length);
    lg.check('in-app back x3 -> cart, history not grown', (await L.H(p)) === '#/cart?demo=1' && len1 === len0, [await L.H(p), len0, len1]);
    await p.goForward(); await p.goForward(); await p.goForward(); await L.sleep(300);
    await L.payCard(p); await L.sleep(400);
    const oid = (await L.st(p)).order.id;
    lg.check('pay -> success', (await L.H(p)) === '#/success');
    await p.goBack(); await L.sleep(300);
    lg.check('Back from success does not reopen pay/payment (cart emptied)', !/^#\/(pay|payment|delivery)/.test(await L.H(p)), await L.H(p));
    await p.goForward(); await L.sleep(300);
    lg.info('Forward again ->', await L.H(p));
    if ((await L.H(p)) !== '#/success') await L.go(p, '#/success');
    await L.vis(p, '[data-action="orders"]').click(); await L.sleep(300);
    lg.check('success ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ -> #/orders', (await L.H(p)) === '#/orders');
    await L.vis(p, '.ord-card__link[data-order="' + oid + '"]').click(); await L.sleep(250);
    await p.goBack(); await L.sleep(250);
    lg.check('Back from detail -> list', (await L.H(p)) === '#/orders', await L.H(p));
    await L.vis(p, '[data-back="/"]').click(); await L.sleep(300);
    lg.check('orders list back (any) -> previous screen (success)', (await L.H(p)) === '#/success', await L.H(p));
    // success buttons layout
    const sb = await p.evaluate(() => { const a = document.querySelector('.success__orders'), h = document.querySelector('.success__home'); const ra = a.getBoundingClientRect(), rh = h.getBoundingClientRect(); const ca = getComputedStyle(a); return { a: a.innerText.split('\n')[0], h: h.innerText.split('\n')[0], aboveOrLeft: ra.bottom <= rh.top + 1 || ra.right <= rh.left + 1, bg: ca.backgroundColor, color: ca.color, shadow: ca.boxShadow, border: ca.borderColor + ' ' + ca.borderWidth }; });
    lg.check('success: ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ (white outline #5e34ec) before ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ', sb.a === 'ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ' && sb.h === 'ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ' && sb.aboveOrLeft && sb.bg === 'rgb(255, 255, 255)' && sb.color === 'rgb(94, 52, 236)', sb);
    await L.vis(p, '[data-action="home"]').click(); await L.sleep(300);
    lg.check('ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ -> landing, still signed in', (await L.H(p)) === '#/' && (await L.st(p)).userPhone === '555123456' && (await L.txt(p, '.landing__acct')) === 'ჩემი შეკვეთები');
    await L.vis(p, '.landing__acct a').click(); await L.sleep(250);
    lg.check('landing ჩემი შეკვეთები -> #/orders', (await L.H(p)) === '#/orders');
    const lk = await p.evaluate(() => { const a = document.querySelector('.landing__acct a'); return a ? null : 'n/a'; });
    // desktop header account link presence
    if (W >= 900) {
      const where = {};
      for (const h of ['#/cart?demo=1', '#/delivery?demo=1', '#/payment?demo=1', '#/pay?demo=1', '#/success?demo=1', '#/register', '#/login', '#/orders?demo=1', '#/orders/731954?demo=1']) {
        await p.goto(L.BASE + h); await L.sleep(250);
        // v3 reconcile: park the pointer first — the previous click on the landing link leaves it over the header link's
        // spot at 1440, which then reads the :hover colour (#4820cc) instead of the resting #5e34ec
        await p.mouse.move(700, 600); await L.sleep(50);
        // v4: two header links პროფილი · ჩემი შეკვეთები; this check reads the orders link, the profile link is checked below
        where[h] = await p.evaluate(() => { const a = document.querySelector('.d-head .acct-link--orders'), b = document.querySelector('.d-head .acct-link--profile'); return a && a.getClientRects().length ? a.textContent + '|' + getComputedStyle(a).color + (b && b.getClientRects().length ? '|' + b.textContent : '') : null; });
      }
      lg.info('desktop header account link (signed in):', JSON.stringify(where));
      lg.check('header link on cart/delivery/payment/pay/success, purple', ['#/cart?demo=1', '#/delivery?demo=1', '#/payment?demo=1', '#/pay?demo=1', '#/success?demo=1'].every(h => where[h] === 'ჩემი შეკვეთები|rgb(94, 52, 236)|პროფილი'), where);
      lg.check('no header account link on orders screens', !where['#/orders?demo=1'] && !where['#/orders/731954?demo=1']);
      await p.goto(L.BASE + '#/cart?demo=1&auth=0'); await L.sleep(250);
      lg.check('signed out: no header account link', !(await p.$('.d-head .acct-link')));
      // header link from delivery -> orders -> back (header back link) -> delivery
      await p.goto(L.BASE + '#/delivery?demo=1'); await L.sleep(250);
      await p.fill('#d-pid', '0100101');
      await p.click('.d-head .acct-link--orders'); await L.sleep(250);
      await p.click('.d-head .back'); await L.sleep(300);
      lg.check('delivery -> header orders -> back keeps typed draft', (await L.H(p)) === '#/delivery?demo=1' && (await p.inputValue('#d-pid')) === '0100101', [await L.H(p), await p.inputValue('#d-pid')]);   // v3 reconcile: entry URL keeps ?demo=1 (stamped, not re-applied)
    }
    // logout then Back -> protected screen must not render
    await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(250);
    await L.logout(p, true);   // v4: orders → პროფილი → ᲒᲐᲡᲕᲚᲐ
    await p.goBack(); await L.sleep(300);
    const hb = await L.H(p);
    lg.check('Back after logout: no order detail rendered', !(await p.$('.ord-page--detail')) && !/^#\/orders\/731954$/.test(hb), hb);
    // unknown route
    await p.goto(L.BASE + '#/orders/731954/extra'); await L.sleep(250);
    lg.check('unknown route -> landing', (await L.H(p)) === '#/', await L.H(p));
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

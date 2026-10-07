// ported from scratchpad tools/v2r3_nav.js
// v2 functional QA round 3 — guards + in-app back controls + browser Back/Forward across the new routes
const L = require('../../lib/harness');
async function fresh(b, W, errs) { return L.newCtx(b, W, errs); }
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('nav ' + W);
    const mob = W < 900;
    /* ---- guards in a fresh session ---- */
    {
      const { ctx, p } = await fresh(b, W, errs);
      try {
        const G = [['#/delivery', '#/'], ['#/payment', '#/'], ['#/pay', '#/'], ['#/orders', '#/login?next=/orders'], ['#/orders/731954', '#/login?next=/orders/731954'],
          ['#/register/verify', '#/register'], ['#/pay?order=731954', '#/login?next=/pay%3Forder%3D731954'], ['#/success', '#/'], ['#/orders/', '#/login?next=/orders']];
        for (const [from, to] of G) {
          await p.goto(L.BASE + from); await L.sleep(250);
          lg.check(`fresh ${from} -> ${to}`, (await L.H(p)) === to, await L.H(p));
        }
        // products but signed out
        await L.landingAdd(p, 'https://www.amazon.com/Lego-Set/dp/B0LEGO0001');
        await L.go(p, '#/delivery'); await L.sleep(200);
        lg.check('cart + signed out: #/delivery -> #/register', (await L.H(p)) === '#/register', await L.H(p));
        await p.evaluate(() => localStorage.setItem('slicepay:v1:remember', JSON.stringify('555123456')));
        await L.go(p, '#/payment'); await L.sleep(200);
        lg.check('cart + remembered: #/payment -> #/login', (await L.H(p)) === '#/login', await L.H(p));
        // the demo account now exists (create), sign in through the next= deep links
        await p.goto(L.BASE + '#/?demo=1'); await L.sleep(200);
        await p.evaluate(() => SlicePay.logout()); await L.sleep(250);
        await L.go(p, '#/pay?order=731954'); await L.sleep(250);
        lg.check('signed out #/pay?order -> login with next', (await L.H(p)) === '#/login?next=/pay%3Forder%3D731954', await L.H(p));
        await L.login(p, '555 123 456', 'slicepay1'); await L.sleep(300);
        lg.check('login -> #/pay?order=731954 (order mode, 350₾)', (await L.H(p)) === '#/pay?order=731954' && (await L.txt(p, '.paycard__due-amt')) === 'გადასახდელი: 350₾', [await L.H(p), await L.txt(p, '.paycard__due-amt')]);
        await p.evaluate(() => SlicePay.logout()); await L.sleep(250);
        for (const [nx, exp] of [['//evil.example', '#/orders'], ['javascript:alert(1)', '#/orders'], ['/login', '#/orders'], ['/register/verify', '#/orders'], ['/orders/999999', '#/orders'], ['/orders/548210', '#/orders/548210'], ['/cart', '#/']]) {
          await L.go(p, '#/login?next=' + encodeURIComponent(nx)); await L.sleep(200);
          await L.login(p, '555 123 456', 'slicepay1'); await L.sleep(300);
          lg.check(`login next=${nx} -> ${exp}`, (await L.H(p)) === exp, await L.H(p));
          await p.evaluate(() => SlicePay.logout()); await L.sleep(250);
        }
      } catch (e) { lg.check('guards script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }

    /* ---- the whole flow, then Back to the start and Forward to the end ---- */
    {
      const { ctx, p } = await fresh(b, W, errs);
      try {
        await L.landingAdd(p, 'https://www.amazon.com/Kindle-Scribe/dp/B0BKINDLE1');
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/register/);
        const U = { first: 'გიგა', last: 'ხუციშვილი', phone: '595 ' + String(W).slice(-3) + ' 777', pass: 'parolG123', email: 'g@example.com' };
        await L.register(p, U);
        await L.verify(p, (await L.st(p)).pendingReg.code);
        await L.delivery(p, { pid: '01010101010', method: 'courier', city: 'გორი', addr: 'სტალინის 1' });
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
        await L.payCard(p); await L.sleep(300);
        const oid = (await L.st(p)).order.id;
        await L.vis(p, '[data-action="orders"]').click(); await L.waitHash(p, /^#\/orders$/); await L.sleep(200);
        await p.click('.ord-card__link[data-order="' + oid + '"]'); await L.waitHash(p, /^#\/orders\//); await L.sleep(200);
        // in-app back from detail -> list
        await L.vis(p, '[data-back="/orders"]').click(); await L.sleep(400);
        lg.check('detail back -> #/orders (stepped back, no new entry)', (await L.H(p)) === '#/orders' && (await p.evaluate(() => history.length)) >= 1, await L.H(p));
        await p.goForward(); await L.sleep(400);
        lg.check('Forward -> detail again', (await L.H(p)) === '#/orders/' + oid, await L.H(p));
        // walk back
        const seq = [await L.H(p)];
        for (let k = 0; k < 12; k++) {
          await p.goBack(); await L.sleep(450);
          seq.push(await L.H(p));
          if (seq[seq.length - 1] === seq[seq.length - 2] && k > 2) break;
        }
        lg.info('Back walk', seq);
        lg.check('Back walk never shows verify/register/pay/payment/delivery after the purchase (no dead steps)', !seq.slice(1).some(h => /register|login|#\/pay\b|#\/payment|#\/delivery/.test(h) && !/#\/$/.test(h)), seq);
        const fw = [await L.H(p)];
        for (let k = 0; k < 12; k++) {
          await p.goForward(); await L.sleep(450);
          fw.push(await L.H(p));
          if (fw[fw.length - 1] === fw[fw.length - 2] && k > 2) break;
        }
        lg.info('Forward walk', fw);
        lg.check('Forward walk ends on the order detail', fw[fw.length - 1] === '#/orders/' + oid, fw);
        lg.check('no screen got stuck in a redirect loop (Forward reaches detail)', fw.includes('#/orders'), fw);
      } catch (e) { lg.check('walk script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }

    /* ---- in-app back controls of the new screens ---- */
    {
      const { ctx, p } = await fresh(b, W, errs);
      try {
        const backSel = mob ? '.m-bar [data-back]' : '.d-head [data-back]';
        await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(250);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(150);
        await L.vis(p, backSel).click(); await L.sleep(400);
        lg.check('delivery back -> #/cart', /^#\/cart/.test(await L.H(p)), await L.H(p));
        await p.goForward(); await L.sleep(400);
        lg.check('Forward -> delivery', (await L.H(p)) === '#/delivery', await L.H(p));
        await p.fill('#d-pid', '01001012345'); await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(150);
        await L.vis(p, backSel).click(); await L.sleep(400);
        lg.check('payment back -> #/delivery', (await L.H(p)) === '#/delivery', await L.H(p));
        await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(150);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/); await L.sleep(150);
        await L.vis(p, backSel).click(); await L.sleep(400);
        lg.check('pay back -> #/payment', (await L.H(p)) === '#/payment', await L.H(p));
        if (!mob) {
          // header account link on inner screens
          for (const h of ['#/cart', '#/delivery', '#/payment', '#/pay']) {
            await L.go(p, h); await L.sleep(200);
            // v4: the signed-in header shows პროფილი · ჩემი შეკვეთები
            const a = await p.evaluate(() => { const l = document.querySelector('.d-head .acct-link--orders'), pr = document.querySelector('.d-head .acct-link--profile'); return l ? [l.textContent, l.getAttribute('href'), getComputedStyle(l).color, pr && pr.textContent, pr && pr.getAttribute('href')] : null; });
            lg.check(`desktop header ${h}: პროფილი · ჩემი შეკვეთები links (purple)`, a && a[0] === 'ჩემი შეკვეთები' && a[1] === '#/orders' && a[2] === 'rgb(94, 52, 236)' && a[3] === 'პროფილი' && a[4] === '#/profile', a);
          }
          await p.click('.d-head .acct-link--orders'); await L.sleep(300);
          lg.check('header link -> #/orders', (await L.H(p)) === '#/orders');
          await L.vis(p, '.d-head [data-back]').click(); await L.sleep(400);
          lg.check('orders back (any) -> previous (#/pay)', (await L.H(p)) === '#/pay', await L.H(p));
          const auth = await p.evaluate(() => !!document.querySelector('.d-head .acct-link'));
          await L.go(p, '#/orders'); await L.sleep(200);
          // v4 header: the orders list shows both account links, ჩემი შეკვეთები marked aria-current="page"
          const ol = await p.evaluate(() => [...document.querySelectorAll('.d-head .acct-link')].map(a => a.textContent.trim() + (a.getAttribute('aria-current') === 'page' ? '*' : '')));
          lg.check('orders screen header: პროფილი · ჩემი შეკვეთები (current)', ol.join('|') === 'პროფილი|ჩემი შეკვეთები*', ol);
        } else {
          await L.go(p, '#/orders'); await L.sleep(200);
          await L.vis(p, '.m-bar [data-back]').click(); await L.sleep(400);
          // (reconciler r2) unlike the desktop branch (which walks #/cart … #/pay before opening the list), the mobile branch
          // opens #/orders straight from #/payment (after 'pay back -> #/payment' above), so the previous screen is #/payment
          lg.check('mobile orders ᲣᲙᲐᲜ -> previous (#/payment)', (await L.H(p)) === '#/payment', await L.H(p));
        }
        // deep-linked orders list: back -> landing
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(250);
        const ctx2 = await b.newContext({ viewport: { width: W, height: mob ? 735 : 1024 } }); const p2 = await ctx2.newPage(); L.hook(p2, errs, 'p2 ');
        await p2.goto(L.BASE + '#/orders?demo=1'); await L.sleep(300);
        await L.vis(p2, mob ? '.m-bar [data-back]' : '.d-head [data-back]').click(); await L.sleep(400);
        lg.check('deep-linked orders: back -> landing', (await L.H(p2)).replace(/\?.*/, '') === '#/', await L.H(p2));
        // landing account link (signed in) -> orders; Back -> landing
        await L.vis(p2, '.acct-link').click(); await L.sleep(300);
        lg.check('landing ჩემი შეკვეთები -> #/orders', (await L.H(p2)) === '#/orders', await L.H(p2));
        await L.vis(p2, mob ? '.m-bar [data-back]' : '.d-head [data-back]').click(); await L.sleep(400);
        lg.check('orders back -> landing (stepped back)', (await L.H(p2)).replace(/\?.*/, '') === '#/', await L.H(p2));
        // double click on the detail back control
        await L.go(p2, '#/orders'); await p2.click('.ord-card__link[data-order="548210"]'); await L.sleep(300);
        await L.vis(p2, mob ? '.m-bar [data-back]' : '.d-head [data-back]').dblclick(); await L.sleep(700);
        lg.check('double-click back on detail -> #/orders (once)', (await L.H(p2)) === '#/orders', await L.H(p2));
        await ctx2.close();
      } catch (e) { lg.check('back controls script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

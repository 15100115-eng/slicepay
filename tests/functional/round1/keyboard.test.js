// ported from scratchpad tools/v2f_kb.js
// Keyboard-only checkout through all new screens + focus visibility on every tab stop of the new screens
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('kb ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const k = (key) => p.keyboard.press(key);
    const ringOf = () => p.evaluate(() => {
      const a = document.activeElement; if (!a || a === document.body) return { el: 'BODY', ok: false };
      // v3 reconcile: the order card link draws its ring on the whole card (orders.css
      // `.ord-card:has(.ord-card__link:focus-visible){outline:var(--focus-ring)}`, the link's own outline is none)
      const t = a.matches('input.sr-only') ? (a.closest('label') || a) : a.matches('.ord-card__link') ? (a.closest('.ord-card') || a) : a;
      const cs = getComputedStyle(t), ca = getComputedStyle(t, '::after'), cb = getComputedStyle(t, '::before');
      const ok = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none') || (ca.boxShadow && ca.boxShadow !== 'none') || (ca.outlineStyle && ca.outlineStyle !== 'none' && parseFloat(ca.outlineWidth) > 0) || (cb.boxShadow && cb.boxShadow !== 'none');
      const r = t.getBoundingClientRect();
      return { el: (a.id || a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0]) + (a.dataset.action ? '[' + a.dataset.action + ']' : '') + (a.dataset.explain ? '[i:' + a.dataset.explain + ']' : ''), ok: !!ok, visible: r.width > 0 && r.height > 0 };
    });
    /** Tab until pred(activeElement) is true; records rings; returns presses or -1 */
    const tabTo = async (pred, max = 40, label = '', shift = false) => {
      const stops = [];
      for (let i = 1; i <= max; i++) {
        await k(shift ? 'Shift+Tab' : 'Tab');
        const r = await ringOf(); stops.push(r);
        if (await p.evaluate(pred)) return { n: i, stops };
      }
      return { n: -1, stops };
    };
    const noRing = (stops) => stops.filter(s => s.el !== 'BODY' && (!s.ok || !s.visible)).map(s => s.el);
    await p.goto(L.BASE + '#/'); await L.sleep(300);
    let r = await tabTo(() => document.activeElement.id === 'url', 5);
    lg.check('landing: Tab reaches account link then URL', r.n > 0 && r.stops[0].el.startsWith('a.acct-link'), r.stops.map(s => s.el));
    lg.check('landing account link has a focus ring', r.stops[0].ok, r.stops[0]);
    await p.keyboard.type('https://www.amazon.com/Nike-Air-Pegasus/dp/B0KB'); await k('Enter');
    await L.waitHash(p, /^#\/cart/, 8000); await L.sleep(300);
    r = await tabTo(() => document.activeElement.classList.contains('cart-explain__link'), 30);
    lg.check('cart: Tab reaches the explanation link', r.n > 0, r.stops.map(s => s.el));
    await k('Enter'); await L.sleep(450);
    lg.check('Enter opens explanation, focus inside', await p.evaluate(() => document.getElementById('modal').open && document.getElementById('modal').contains(document.activeElement)));
    await k('Escape'); await L.sleep(400);
    lg.check('Esc closes, focus back on link', await p.evaluate(() => document.activeElement.classList.contains('cart-explain__link')));
    r = await tabTo(() => document.activeElement.dataset.action === 'next', 10);
    lg.check('cart: Tab to ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ', r.n > 0, r.stops.map(s => s.el));
    await k('Enter'); await L.sleep(300);
    lg.check('-> register', (await L.H(p)) === '#/register');
    // register by keyboard
    r = await tabTo(() => document.activeElement.id === 'reg-first', 8); await p.keyboard.type('კლავი');
    await k('Tab'); await p.keyboard.type('ატურა');
    await k('Tab'); await p.keyboard.type('593' + String(W).padStart(6, '3'));
    r = await tabTo(() => document.activeElement.id === 'reg-pass', 4); await p.keyboard.type('keyboard11');
    r = await tabTo(() => document.activeElement.id === 'reg-email', 4); await p.keyboard.type('kb@example.com');
    r = await tabTo(() => document.activeElement.id === 'reg-terms', 8); await k('Space');
    await k('Enter');
    await L.waitHash(p, /^#\/register\/verify/); await L.sleep(200);
    const code = ((await L.toast(p)).match(/(\d{4})/) || [])[1];
    lg.check('register by keyboard -> verify', !!code, await L.H(p));
    // verify: focus is on h1; Tab stops
    r = await tabTo(() => document.activeElement.id === 'auth-submit', 12);
    lg.check('verify: all tab stops have a visible ring', noRing(r.stops).length === 0, r.stops);
    r = await tabTo(() => document.activeElement.id === 'verify-code', 12, '', true);
    await p.keyboard.type(code); await k('Enter');
    await L.waitHash(p, /^#\/delivery/); await L.sleep(300);
    lg.check('verify by keyboard -> delivery', (await L.H(p)) === '#/delivery');
    // delivery: tab through everything (pickup) recording rings
    r = await tabTo(() => document.activeElement.id === 'dlv-submit', 20);
    lg.check('delivery (pickup): all tab stops visible ring', r.n > 0 && noRing(r.stops).length === 0, r.stops);
    lg.info('delivery tab order', r.stops.map(s => s.el).join(' > '));
    r = await tabTo(() => document.activeElement.id === 'd-pid', 20, '', true);
    await p.keyboard.type('01001012345');
    r = await tabTo(() => document.activeElement.name === 'dmethod', 4);
    await k('ArrowDown'); await L.sleep(100);
    lg.check('ArrowDown -> courier, panel shown', await p.isChecked('#dmethod-courier') && await p.isVisible('#d-city'));
    await k('Tab'); lg.check('Tab from method -> city select', (await L.active(p)) === 'd-city', await L.active(p));
    await p.selectOption('#d-city', 'ბათუმი'); await p.focus('#d-city');   // headless cannot drive native select popups
    await k('Tab'); await p.keyboard.type('ბაქოს ქ. 3');
    await k('Enter');
    await L.waitHash(p, /^#\/payment/); await L.sleep(300);
    lg.check('delivery by keyboard -> payment', (await L.H(p)) === '#/payment');
    // payment: method radios and chips
    r = await tabTo(() => document.activeElement.name === 'method', 20);
    await k('ArrowDown'); await L.sleep(100);
    lg.check('ArrowDown on methods -> tbc, chips 5', (await L.st(p)).method === 'tbc' && (await p.$$('#terms input[name=term]')).length === 5);
    r = await tabTo(() => document.activeElement.name === 'term', 3);
    lg.check('Tab -> checked chip (4)', (await L.active(p)) === 'term-4' && r.stops[r.stops.length - 1].ok, r.stops);
    await k('End'); await L.sleep(80);
    lg.info('End on chips ->', (await L.st(p)).term);
    await k('ArrowRight'); await L.sleep(80);
    const t1 = (await L.st(p)).term;
    lg.check('ArrowRight changes the chip', t1 !== 4, t1);
    r = await tabTo(() => document.activeElement.dataset.action === 'next', 12);
    lg.check('payment: tab stops visible', r.n > 0 && noRing(r.stops).length === 0, r.stops);
    await k('Enter'); await L.waitHash(p, /^#\/pay$/); await L.sleep(250);
    r = await tabTo(() => document.activeElement.id === 'cc-num', 15);
    await p.keyboard.type('4242424242424242'); await k('Tab'); await p.keyboard.type('1230'); await k('Tab'); await p.keyboard.type('123'); await k('Enter');
    await L.waitHash(p, /^#\/success/, 6000); await L.sleep(400);
    lg.check('card by keyboard -> success', (await L.H(p)) === '#/success');
    r = await tabTo(() => document.activeElement.dataset.action === 'orders', 10);
    lg.check('success: Tab reaches ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ with ring', r.n > 0 && r.stops[r.stops.length - 1].ok, r.stops);
    await k('Tab'); const hr = await ringOf();
    lg.check('success: next stop ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ with ring', /\[home\]/.test(hr.el) && hr.ok, hr);
    await k('Shift+Tab'); await k('Enter'); await L.sleep(300);
    lg.check('-> orders', (await L.H(p)) === '#/orders');
    r = await tabTo(() => document.activeElement.classList.contains('ord-card__link'), 10);
    lg.check('orders list: Tab reaches card link with ring', r.n > 0 && r.stops[r.stops.length - 1].ok, r.stops);
    lg.info('orders list tab order', r.stops.map(s => s.el).join(' > '));
    await k('Enter'); await L.sleep(300);
    lg.check('Enter opens detail', /^#\/orders\/\d{6}$/.test(await L.H(p)));
    r = await tabTo(() => document.activeElement.classList.contains('info-btn'), 15);
    lg.check('detail: Tab reaches an info button with ring', r.n > 0 && r.stops[r.stops.length - 1].ok, r.stops);
    const ibKey = await p.evaluate(() => document.activeElement.dataset.explain);
    await k('Enter'); await L.sleep(450);
    lg.check('info opens (' + (W < 900 ? 'sheet' : 'dialog') + ')', await p.evaluate(() => document.getElementById('modal').open));
    await k('Escape'); await L.sleep(400);
    lg.check('Esc closes, focus returns to the info button', await p.evaluate(k => document.activeElement.classList.contains('info-btn') && document.activeElement.dataset.explain === k, ibKey));
    r = await tabTo(() => false, 25);
    lg.check('detail: all tab stops visible ring', noRing(r.stops).length === 0, noRing(r.stops));
    // demo order: pay by keyboard
    await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(300);
    r = await tabTo(() => document.activeElement.dataset.action === 'pay', 15);
    lg.check('Tab to ᲒᲐᲓᲐᲮᲓᲐ', r.n > 0 && r.stops[r.stops.length - 1].ok, r.stops.map(s => s.el));
    await k('Enter'); await L.sleep(300);
    r = await tabTo(() => document.activeElement.id === 'cc-num', 15);
    await p.keyboard.type('4242424242424242'); await k('Tab'); await p.keyboard.type('1230'); await k('Tab'); await p.keyboard.type('123'); await k('Enter');
    await L.waitHash(p, /^#\/orders\/731954$/, 6000); await L.sleep(300);
    lg.check('order pay by keyboard -> detail paid', (await L.appText(p)).includes('გადახდილია'));
    lg.info('focus after order payment:', await L.active(p));
    // logout by keyboard (v4): orders heading link პროფილი → #/profile → ᲒᲐᲡᲕᲚᲐ
    await L.go(p, '#/orders');
    r = await tabTo(() => document.activeElement.matches('.ord-top__out'), 8);
    lg.check('Tab to პროფილი with ring', r.n > 0 && r.stops[r.stops.length - 1].ok && (await L.active(p)).includes('პროფილი'), r.stops);
    await k('Enter'); await L.sleep(300);
    lg.check('Enter on პროფილი -> #/profile', (await L.H(p)) === '#/profile', await L.H(p));
    r = await tabTo(() => document.activeElement.dataset.action === 'logout', 30);
    lg.check('Tab to ᲒᲐᲡᲕᲚᲐ with ring', r.n > 0 && r.stops[r.stops.length - 1].ok && (await L.active(p)).includes('ᲒᲐᲡᲕᲚᲐ'), r.stops);
    await k('Enter'); await L.sleep(300);
    lg.check('logout by keyboard', (await L.H(p)) === '#/' && !(await L.st(p)).userPhone);
    lg.info('focus after logout:', await L.active(p));
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

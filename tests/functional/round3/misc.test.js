// ported from scratchpad tools/v2r3_misc.js
// v2 functional QA round 3 — misc: history around the paid order card form, second order with a remembered courier
// choice (cart ETA vs total), double activations of the new buttons, toasts
const L = require('../../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('misc ' + W);
    /* (i) paid card form entry in history */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(250);
        await p.click('.ord-card__link[data-order="731954"]'); await L.waitHash(p, /^#\/orders\/731954/); await L.sleep(200);
        await L.vis(p, '[data-action="pay"]').click(); await L.waitHash(p, /^#\/pay\?order/);
        await L.payCard(p); await L.sleep(400);
        lg.check('paid -> detail', (await L.H(p)) === '#/orders/731954');
        const len0 = await p.evaluate(() => history.length);
        await p.goForward(); await L.sleep(500);
        lg.check('Forward onto the paid card form -> detail', (await L.H(p)) === '#/orders/731954', await L.H(p));
        await p.goBack(); await L.sleep(500);
        const h1 = await L.H(p);
        lg.check('then Back leaves the detail (no dead Back step on a duplicate detail entry)', h1 !== '#/orders/731954', h1);
        lg.info('history after', h1, len0, await p.evaluate(() => history.length));
      } catch (e) { lg.check('(i) script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }
    /* (ii) second order: remembered courier region choice — cart ETA vs total */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(250);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
        await L.delivery(p, { pid: '01001012345', method: 'courier', city: 'ბათუმი', addr: 'ჭავჭავაძის 9' });
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
        await L.payCard(p); await L.sleep(300);
        await L.vis(p, '[data-action="home"]').click(); await L.sleep(300);
        await L.landingAdd(p, 'https://www.amazon.com/Kindle-Oasis/dp/B07L5GDTYY');
        await L.sleep(200);
        const c = await p.evaluate(() => { const v = s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }; return { eta: v('.cart-eta__line .eta-line__v'), tot: v('.cart-sum__total'), fee: v('.cart-sum__fee') }; });
        const st = await L.st(p);
        lg.info('2nd order cart (delivery not confirmed yet):', c, 'delivery', { m: st.delivery.method, city: st.delivery.city, done: st.delivery.done });
        lg.check('2nd order cart: ETA and total describe the same delivery (both pickup-based or both courier-based)', !(c.eta === '18–23 ოქტომბერი' && !c.fee), c);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
        const pre = { m: await p.isChecked('input[name="dmethod"][value="courier"]'), city: await p.inputValue('#d-city'), addr: await p.inputValue('#d-addr'), pid: await p.inputValue('#d-pid'), eta: await L.tc(p, '#d-eta') };
        lg.check('2nd order delivery form prefilled from the previous order (courier Batumi, ID)', pre.m && pre.city === 'ბათუმი' && pre.addr === 'ჭავჭავაძის 9' && pre.pid === '01001012345', pre);
      } catch (e) { lg.check('(ii) script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }
    /* (iii)-(v) double activations */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(250);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(150);
        await p.fill('#d-pid', '01001012345');
        const l0 = await p.evaluate(() => history.length);
        await p.dblclick('#dlv-submit'); await L.sleep(500);
        const l1 = await p.evaluate(() => history.length);
        lg.check('double-click ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ: one new history entry, on payment', (await L.H(p)) === '#/payment' && l1 - l0 === 1, { h: await L.H(p), d: l1 - l0 });
        await p.goBack(); await L.sleep(400);
        lg.check('Back after it -> delivery', (await L.H(p)) === '#/delivery', await L.H(p));
        await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(150);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
        await L.payCard(p); await L.sleep(300);
        const l2 = await p.evaluate(() => history.length);
        await L.vis(p, '[data-action="orders"]').dblclick(); await L.sleep(500);
        const l3 = await p.evaluate(() => history.length);
        lg.check('double-click ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ: one entry', (await L.H(p)) === '#/orders' && l3 - l2 === 1, { h: await L.H(p), d: l3 - l2 });
        await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(250);
        const l4 = await p.evaluate(() => history.length);
        await L.vis(p, '[data-action="pay"]').dblclick(); await L.sleep(500);
        const l5 = await p.evaluate(() => history.length);
        lg.check('double-click ᲒᲐᲓᲐᲮᲓᲐ: one entry', /^#\/pay\?order=731954/.test(await L.H(p)) && l5 - l4 === 1, { h: await L.H(p), d: l5 - l4 });
        // double submit of the order-mode card form
        await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '12/30'); await p.fill('#cc-cvv', '123');
        await p.dblclick('#card-submit'); await L.sleep(1800);
        const toasts = await p.evaluate(() => document.querySelectorAll('#toast-root .toast').length);
        // (reconciler r2) after an order payment pay.js steps back onto the detail entry it came from (v2f-r2-05 /
        // v2f-r3-01: no duplicate detail entry). That entry was opened above as '#/orders/731954?demo=1', so its URL keeps
        // the QA query; a Back/Forward return does not re-apply it (qaFresh), so the order shows as paid.
        const dd = await p.evaluate(() => ({ h: location.hash, len: history.length, due: !!document.querySelector('.ord-due__btn') }));
        lg.check('double-click pay (order mode): detail, one toast', /^#\/orders\/731954(\?demo=1)?$/.test(dd.h) && dd.len === l5 && !dd.due && toasts <= 1, { h: dd.h, lenBefore: l5, len: dd.len, stillDue: dd.due, toasts });
        // logout double click (v4: ᲒᲐᲡᲕᲚᲐ on #/profile)
        await L.go(p, '#/profile'); await L.sleep(200);
        await L.vis(p, '[data-action="logout"]').dblclick(); await L.sleep(400);
        const tl = await p.evaluate(() => [...document.querySelectorAll('#toast-root .toast')].map(t => t.textContent));
        lg.check('double-click ᲒᲐᲡᲕᲚᲐ: landing, one logout toast', (await L.H(p)).replace(/\?.*/, '') === '#/' && tl.length <= 1, { h: await L.H(p), tl });
      } catch (e) { lg.check('(iii) script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

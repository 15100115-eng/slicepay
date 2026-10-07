// ported from scratchpad tools/v3low2_verify.js
// v3 low-2 verifier: REV2R3-02 (send-log pruning), success fee line (label visible, '5 ₾', CTAs above the fold),
// orders detail toast vs the wrapped status pill. usage: node tests/regression/v3-low2.test.js [sent,success,orders]
const L = require('../lib/harness');
const fs = require('fs');
const OUT = L.OUT; fs.mkdirSync(OUT, { recursive: true });
const parts = (process.argv[2] || 'sent,success,orders').split(',');
const lg = L.mkLog('v3low2');
const T0 = new Date('2026-10-07T10:00:00');
const r = e => e ? (b => ({ x: +b.left.toFixed(1), y: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }))(e.getBoundingClientRect()) : null;

(async () => {
  const b = await L.launch();
  const allErrs = {};

  if (parts.includes('sent')) {
    const U = { first: 'ნინო', last: 'კაპანაძე', phone: '599 111 222', pass: 'secret123', email: 'nino@example.com' };
    const read = p => p.evaluate(() => sessionStorage.getItem('slicepay.verifySent'));
    // A) original repro, fake clock: verify → orders → sign out at once; then just wait (no navigation)
    {
      const errs = allErrs.sentA = [];
      const { ctx, p } = await L.newCtx(b, 1440, errs, { clock: T0 });
      await p.goto(L.BASE + '#/register'); await L.sleep(300);
      const code = await L.register(p, U); await L.verify(p, code); await L.sleep(200);
      await p.goto(L.BASE + '#/profile'); await L.sleep(300);   // v4: ᲒᲐᲡᲕᲚᲐ lives on the profile page
      await p.click('[data-action="logout"]'); await L.sleep(300);
      const after = await read(p);
      lg.check('sent A: entry kept right after a sign-out inside 30 s (cooldown survives)', after && after.includes('599111222'), after);
      await p.clock.runFor(31000); await L.sleep(100);
      lg.check('sent A: gone 31 s after the send with no navigation (timer prune)', (await read(p)) === null, await read(p));
      await p.goto(L.BASE + '#/login'); await L.sleep(200); await p.reload(); await L.sleep(300);
      lg.check('sent A: still gone after browsing + reload', (await read(p)) === null);
      await ctx.close();
    }
    // B) reload while the entry is live, then let the cooldown end: the boot prune re-arms the timer
    {
      const errs = allErrs.sentB = [];
      const { ctx, p } = await L.newCtx(b, 1440, errs, { clock: T0 });
      await p.goto(L.BASE + '#/register'); await L.sleep(300);
      await L.register(p, U); await L.sleep(200);
      await p.clock.runFor(10000);
      await p.reload(); await L.sleep(400);
      lg.check('sent B: entry kept across a reload inside 30 s', ((await read(p)) || '').includes('599111222'));
      await p.clock.runFor(21000); await L.sleep(100);
      lg.check('sent B: gone once the cooldown ends after the reload (boot re-arms the timer)', (await read(p)) === null, await read(p));
      await ctx.close();
    }
    // C) cooldown rules still hold: same number re-submitted inside 30 s keeps its code; after 30 s a full re-submit sends a new one
    {
      const errs = allErrs.sentC = [];
      const { ctx, p } = await L.newCtx(b, 1440, errs, { clock: T0 });
      const U2 = { first: 'ანა', last: 'ბერი', phone: '568 123 123', pass: 'parol1234', email: 'ana@example.com' };
      await p.goto(L.BASE + '#/register'); await L.sleep(300);
      await L.register(p, U2);
      const c1 = await p.evaluate(() => SlicePay.getState().pendingReg.code);
      await p.clock.runFor(5000);
      await p.goto(L.BASE + '#/register'); await L.sleep(300);
      await L.register(p, U2);
      const c2 = await p.evaluate(() => SlicePay.getState().pendingReg.code);
      lg.check('sent C: re-submit inside 30 s keeps the same code (v2f-r2-06)', c1 && c1 === c2, { c1, c2 });
      await p.clock.runFor(31000); await L.sleep(100);
      lg.check('sent C: log empty after the cooldown', (await read(p)) === null);
      await p.goto(L.BASE + '#/register'); await L.sleep(300);
      await L.register(p, U2);
      const c3 = await p.evaluate(() => SlicePay.getState().pendingReg.code);
      const ss = await p.evaluate(() => JSON.parse(sessionStorage.getItem('slicepay.verifySent') || 'null'));
      lg.check('sent C: after 30 s a full re-submit logs a fresh entry for that phone only', ss && Object.keys(ss).join() === '568123123' && ss['568123123'].code === c3, { ss, c3 });
      await ctx.close();
    }
  }

  if (parts.includes('success')) {
    const meas = p => p.evaluate(() => {
      const r = e => e ? (b => ({ x: +b.left.toFixed(1), y: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) }))(e.getBoundingClientRect()) : null;
      const f = document.querySelector('.receipt__fee');
      return { vh: innerHeight, vw: innerWidth, sw: document.documentElement.scrollWidth,
        btns: [...document.querySelectorAll('.success__actions .btn')].map(r), fee: r(f), feeTxt: f ? f.innerText.replace(/\s+/g, ' ').trim() : null,
        amt: r(document.querySelector('.receipt__dfee')), amtTxt: (document.querySelector('.receipt__dfee') || {}).textContent || null,
        price: r(document.querySelector('.item__price')), priceTxt: (document.querySelector('.item__price') || {}).textContent,
        dline: r(document.querySelector('.receipt__dline--1')), eta: r(document.querySelector('.receipt__dline--eta')),
        sum: [...document.querySelectorAll('.ssum__row')].map(e => e.innerText.replace(/\s+/g, ' ').trim()), oldRow: !!document.querySelector('.ssum__row--fee'),
        labelStyle: f ? getComputedStyle(f.querySelector('.receipt__fee-l')).color : null };
    });
    for (const [W, H] of [[1440, 1024], [1280, 1024], [1024, 1024], [900, 1024], [1920, 1080], [428, 735], [375, 667], [320, 640]]) {
      for (const q of ['', '&delivery=courier', '&delivery=courier&term=6']) {
        const name = q ? (q.includes('term') ? 'courier6' : 'courier') : 'pickup';
        const errs = allErrs['succ' + W + name] = [];
        const ctx = await b.newContext({ viewport: { width: W, height: H } }); const p = await ctx.newPage(); L.hook(p, errs);
        await p.goto(L.BASE + '#/success?demo=1&date=2025-02-15&order=112233' + q); await L.sleep(450);
        const m = await meas(p);
        if (W === 1440 || W === 428 || W === 320) await p.screenshot({ path: OUT + '/success_' + name + '_' + W + '.png', fullPage: W < 900 });
        if (W >= 900) lg.check(W + 'x' + H + ' ' + name + ': both CTAs fully visible', m.btns.length === 2 && m.btns.every(x => x.b <= m.vh), m.btns);
        if (W === 1440 && name === 'pickup') lg.check('1440 pickup: CTAs at the d17 position (948.5, unchanged)', Math.abs(m.btns[0].y - 948.5) < 0.6, m.btns);
        if (name === 'pickup') lg.check(W + ' pickup: no fee line', m.fee === null && !m.oldRow);
        else {
          const vis = await L.appVisText(p);
          lg.check(W + ' ' + name + ': visible labelled fee line "მიწოდების ფასი 5 ₾"', m.feeTxt === 'მიწოდების ფასი 5 ₾' && vis.includes('მიწოდების ფასი 5 ₾'), m.feeTxt);
          lg.check(W + ' ' + name + ': amount uses the item-price format', m.amtTxt === '5 ₾' && / ₾$/.test(m.priceTxt), { amt: m.amtTxt, price: m.priceTxt });
          lg.check(W + ' ' + name + ': amount right edge = item price right edge', Math.abs(m.amt.r - m.price.r) < 1, { amt: m.amt, price: m.price });
          lg.check(W + ' ' + name + ': fee line between the method line and the ETA', m.fee.y >= m.dline.b && m.eta.y >= m.fee.b, { d: m.dline, f: m.fee, e: m.eta });
          lg.check(W + ' ' + name + ': summary = თვეში + სულ only, total includes the fee', !m.oldRow && m.sum.length === 2 && / 605₾$/.test(m.sum[1]) && (name === 'courier6' ? /6x 101₾$/.test(m.sum[0]) : /4x 152₾$/.test(m.sum[0])), m.sum);
        }
        lg.check(W + ' ' + name + ': no horizontal overflow', m.sw <= m.vw, m.sw);
        lg.check(W + ' ' + name + ': no console errors', !errs.length, errs);
        await ctx.close();
      }
    }
    // real courier order (short Tbilisi address) through the flow at 1440x1024
    for (const [name, city, addr, fee] of [['tbilisi', 'თბილისი', 'ვაჟა-ფშაველას 12', 5], ['batumi', 'ბათუმი', 'გორგილაძის 12', 10]]) {
      const errs = allErrs['real' + name] = [];
      const { ctx, p } = await L.newCtx(b, 1440, errs, { clock: T0 });
      await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
      await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
      await L.delivery(p, { pid: '01001012345', method: 'courier', city, addr }, true);
      await L.vis(p, '[data-action="next"]').click(); await L.sleep(500);
      await L.payCard(p); await L.sleep(600);
      const m = await meas(p);
      await p.screenshot({ path: OUT + '/success_real_' + name + '_1440.png' });
      lg.check('real ' + name + ' 1440x1024: CTAs fully visible', m.btns.length === 2 && m.btns.every(x => x.b <= m.vh), m.btns);
      lg.check('real ' + name + ': fee line "მიწოდების ფასი ' + fee + ' ₾"', m.feeTxt === 'მიწოდების ფასი ' + fee + ' ₾', m.feeTxt);
      lg.check('real ' + name + ': no console errors', !errs.length, errs);
      await ctx.close();
    }
  }

  if (parts.includes('orders')) {
    for (const W of [320, 340, 360, 375, 390, 428]) {
      const errs = allErrs['ord' + W] = [];
      const ctx = await b.newContext({ viewport: { width: W, height: 700 } }); const p = await ctx.newPage(); L.hook(p, errs);
      await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(300);
      await p.locator('[data-action="pay"]:visible').first().click(); await L.sleep(400);
      await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '1230'); await p.fill('#cc-cvv', '123');
      await p.locator('#card-submit').click(); await L.sleep(1700);
      const m = await p.evaluate(() => {
        const r = e => e ? (b => ({ x: Math.round(b.left), y: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }))(e.getBoundingClientRect()) : null;
        const pill = r(document.querySelector('#app .ord-top--detail .status-pill')), t = r(document.querySelector('#toast-root .toast')), h = r(document.querySelector('#app .ord-top__h'));
        const ov = (a, c) => a && c && !(a.r <= c.x || c.r <= a.x || a.b <= c.y || c.b <= a.y);
        return { pill, t, h, toastTxt: (document.querySelector('#toast-root .toast') || {}).textContent, covPill: ov(pill, t), covH: ov(h, t), pe: getComputedStyle(document.querySelector('#toast-root .toast')).pointerEvents, tl: r(document.querySelector('#app .ord-sec--tl')) };
      });
      if (W === 320 || W === 360) await p.screenshot({ path: OUT + '/orders_toast_paid_' + W + '.png' });
      lg.check(W + ' orders paid: toast does not cover the status pill or the title', m.toastTxt && !m.covPill && !m.covH, m);
      if (W >= 375) lg.check(W + ' orders paid: toast keeps top 72 when the pill fits', m.t.y === 72, m.t);
      lg.check(W + ' orders: toast lets taps through', m.pe === 'none', m.pe);
      lg.check(W + ' orders: no console errors', !errs.length, errs);
      await ctx.close();
    }
  }
  const f = lg.summary();
  fs.writeFileSync(OUT + '/result.json', JSON.stringify({ fails: f, errs: allErrs }, null, 1));
  await b.close();
})();

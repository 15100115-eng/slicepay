// ported from scratchpad tools/v2r3_explain.js
// v2 functional QA round 3 — "approximate amounts" explanation: entry points, product-specific weight line,
// sheet / dialog behaviour, keyboard (Esc, focus return, Tab containment)
const L = require('../../lib/harness');
const E = {
  title: 'დაახლოებითი თანხები',
  wH: 'წონის საფასური', wP: 'ითვლება ამანათის ფაქტობრივი ან მოცულობითი წონით (რომელიც მეტია) და ტრანსპორტირების ტარიფით.',
  cH: 'განბაჟება', cP: 'დამოკიდებულია ნივთის ღირებულებაზე, კატეგორიასა და მიწოდების ღირებულებაზე. საბოლოო თანხას ადგენს საბაჟო ამანათის ჩამოსვლისას.',
  dH: 'რა მოხდება, თუ თანხა განსხვავდება?',
  d1: 'წინასწარ გადახდისას: თუ ფაქტობრივი თანხა ნაკლებია, სხვაობა დაგიბრუნდებათ; თუ მეტია — სხვაობას გადაიხდით „ჩემი შეკვეთების“ გვერდიდან.',
  d2: 'მოგვიანებით გადახდისას: ზუსტ თანხას გადაიხდით ამანათის ჩამოსვლის შემდეგ, „ჩემი შეკვეთების“ გვერდიდან.'
};
const dlg = p => p.evaluate(() => {
  const d = document.getElementById('modal');
  if (!d || !d.open) return { open: false };
  const q = s => [...d.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim());
  const cs = getComputedStyle(d);
  return { open: true, sheet: d.classList.contains('modal--sheet'), handle: !!d.querySelector('.modal__handle') && getComputedStyle(d.querySelector('.modal__handle')).display !== 'none',
    title: q('.modal__title')[0], h: q('.explain__h'), p: q('.explain__sec > p'), li: q('.explain__list li'), calc: q('.explain__calc')[0] || null,
    focus: q('.explain__sec.is-focus h3')[0] || null, ok: q('[data-ok]')[0], radius: cs.borderTopLeftRadius + ' ' + cs.borderTopRightRadius + ' ' + cs.borderBottomLeftRadius,
    rect: (r => [r.left, r.top, r.right, r.bottom].map(Math.round))(d.getBoundingClientRect()) };
});
const actId = p => p.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.className || a.tagName) + '|' + (a.getAttribute('data-explain') || '') + '|' + (a.getAttribute('data-product') || '') + '|' + (a.getAttribute('aria-describedby') || '') : null; });
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('explain ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const mob = W < 900;
    try {
      await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
      // link under the checkboxes
      const link = await p.evaluate(() => { const l = [...document.querySelectorAll('[data-explain="all"]')].find(x => x.getClientRects().length); const c = [...document.querySelectorAll('.cart-checks')].find(x => x.getClientRects().length); return l && c ? { t: l.textContent, below: l.getBoundingClientRect().top >= c.getBoundingClientRect().bottom - 1 } : null; });
      lg.check('cart link "როგორ ითვლება დაახლოებითი თანხები?" under the checkboxes', link && link.t === 'როგორ ითვლება დაახლოებითი თანხები?' && link.below, link);
      await L.vis(p, '[data-explain="all"]').click(); await L.sleep(400);
      let d = await dlg(p);
      lg.check(`opens as ${mob ? 'bottom sheet (handle)' : 'dialog'}`, d.open && d.sheet === mob && d.handle === mob, d);
      lg.check('copy verbatim (title, 3 headings, 2 paragraphs, 2 bullets, ᲒᲐᲡᲐᲒᲔᲑᲘᲐ)', d.title === E.title && JSON.stringify(d.h) === JSON.stringify([E.wH, E.cH, E.dH]) && d.p[0] === E.wP && d.p[1] === E.cP && d.li[0] === E.d1 && d.li[1] === E.d2 && /ᲒᲐᲡᲐᲒᲔᲑᲘᲐ/.test(d.ok), d);
      lg.check('link opens without a product line', d.calc === null, d.calc);
      if (mob) lg.check('sheet: radius 16 on top corners, docked at the bottom', /^16px 16px 0px$/.test(d.radius) && d.rect[3] >= 735 - 1, d);
      await L.shot(p, 'explain_cart_' + W);
      // Tab containment
      // (reconciler r2) the explanation is a native modal <dialog> (showModal): the page behind is inert, and Chromium
      // lets Tab past the last stop go to the browser chrome (document unfocused, activeElement <body>), from where
      // the next Tab comes back to the first stop in the dialog. That is the platform behaviour, not a leak: the check
      // is that no stop ever lands on page content behind the dialog and that the cycle re-enters it.
      const seen = new Set(), seq = [];
      for (let k = 0; k < 6; k++) { await p.keyboard.press('Tab'); const s = await p.evaluate(() => { const a = document.activeElement; return a && a.closest('#modal') ? 'in' : (!document.hasFocus() && (!a || a === document.body)) ? 'chrome' : 'out:' + (a && a.tagName); }); seen.add(s); seq.push(s); }
      const reenters = seq.some((s, i) => s === 'chrome' && seq.slice(i + 1).includes('in'));
      lg.check('Tab stays inside the explanation (never reaches the page behind; browser chrome then back in)', seen.has('in') && [...seen].every(s => s === 'in' || s === 'chrome') && (!seen.has('chrome') || reenters), seq);
      await p.keyboard.press('Escape'); await L.sleep(350);
      lg.check('Esc closes; focus back on the link', !(await dlg(p)).open && /\|all\|/.test(await actId(p)), await actId(p));
      // OK button closes
      await L.vis(p, '[data-explain="all"]').click(); await L.sleep(400);
      await p.click('#modal [data-ok]'); await L.sleep(350);
      lg.check('ᲒᲐᲡᲐᲒᲔᲑᲘᲐ closes; focus back on the link', !(await dlg(p)).open && /\|all\|/.test(await actId(p)), await actId(p));
      // ✕ closes
      await L.vis(p, '[data-explain="all"]').click(); await L.sleep(400);
      await p.click('#modal [data-close]'); await L.sleep(350);
      lg.check('✕ closes', !(await dlg(p)).open);
      // backdrop
      await L.vis(p, '[data-explain="all"]').click(); await L.sleep(600);
      await p.mouse.click(W / 2, 20); await L.sleep(350);
      lg.check('backdrop click closes', !(await dlg(p)).open);
      // keyboard open (Enter / Space)
      await L.vis(p, '[data-explain="all"]').focus(); await p.keyboard.press('Enter'); await L.sleep(400);
      lg.check('Enter on the link opens it; focus on the title', (await dlg(p)).open && (await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('modal__title'))));
      await p.keyboard.press('Escape'); await L.sleep(300);
      await L.vis(p, '[data-explain="all"]').focus(); await p.keyboard.press(' '); await L.sleep(400);
      lg.check('Space on the link opens it', (await dlg(p)).open);
      await p.keyboard.press('Escape'); await L.sleep(300);
      if (mob) {
        // drag the handle down
        await L.vis(p, '[data-explain="all"]').click(); await L.sleep(500);
        const hb = await p.evaluate(() => { const h = document.querySelector('#modal .modal__handle'); const r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
        await p.mouse.move(hb[0], hb[1]); await p.mouse.down(); await p.mouse.move(hb[0], hb[1] + 60, { steps: 4 }); await p.mouse.up(); await L.sleep(300);
        lg.check('drag 60 px: stays open', (await dlg(p)).open);
        await p.mouse.move(hb[0], hb[1]); await p.mouse.down(); await p.mouse.move(hb[0], hb[1] + 140, { steps: 6 }); await p.mouse.up(); await L.sleep(400);
        lg.check('drag 140 px: closes', !(await dlg(p)).open);
      }
      // product info buttons (details open)
      const ib = await p.evaluate(() => { const b = [...document.querySelectorAll('.info-btn')].find(x => x.getClientRects().length); if (!b) return null; const svg = b.querySelector('svg'); const r = svg.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), w: Math.round(r.width), color: getComputedStyle(b).color }; });
      lg.info('info button (details closed may be hidden)', ib);
      await L.vis(p, '[data-toggle]').click(); await L.sleep(350);
      const ib2 = await p.evaluate(() => [...document.querySelectorAll('.prod .info-btn')].filter(x => x.getClientRects().length).map(b => { const svg = b.querySelector('svg'); const r = svg.getBoundingClientRect(); return { label: b.getAttribute('aria-label'), ex: b.getAttribute('data-explain'), w: Math.round(r.width), color: getComputedStyle(b).color, desc: document.getElementById(b.getAttribute('aria-describedby')) && document.getElementById(b.getAttribute('aria-describedby')).textContent }; }));
      lg.check('product breakdown: 2 info buttons, label როგორ ითვლება?, 16px, #79747e, described by row label', ib2.length === 2 && ib2.every(x => x.label === 'როგორ ითვლება?' && x.w === 16 && x.color === 'rgb(121, 116, 126)') && /წონის/.test(ib2[0].desc) && /განბაჟების/.test(ib2[1].desc), ib2);
      await L.vis(p, '.prod .info-btn[data-explain="weight"]').click(); await L.sleep(400);
      d = await dlg(p);
      lg.check('Nike weight info: line "დაახლოებითი წონა: 4 კგ × 25₾ = 100₾", weight section focused', d.calc === 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' && d.focus === E.wH, d);
      await p.keyboard.press('Escape'); await L.sleep(300);
      lg.check('Esc: focus back on the weight info button', /\|weight\|demo-nike\|/.test(await actId(p)), await actId(p));
      await L.vis(p, '.prod .info-btn[data-explain="customs"]').click(); await L.sleep(400);
      d = await dlg(p);
      lg.check('customs info: customs section focused', d.focus === E.cH, d.focus);
      await p.keyboard.press('Escape'); await L.sleep(300);
      // a mock product with qty 2 + the Nike
      await L.cartAdd(p, 'https://www.ebay.com/itm/Vintage-Camera-Lens/1234567');
      const mock = (await L.st(p)).products.find(x => x.id !== 'demo-nike');
      await p.evaluate(id => { const s = SlicePay.state(); s.products.find(x => x.id === id).qty = 2; s.ui.details[id] = true; SlicePay.save(); }, mock.id);
      await L.go(p, '#/'); await L.go(p, '#/cart'); await L.sleep(300);
      await p.locator(`.prod[data-id="${mock.id}"] .info-btn[data-explain="weight"]`).locator('visible=true').first().click(); await L.sleep(400);
      d = await dlg(p);
      const kg = String(Math.round(mock.weight / 25 * 2 * 10) / 10).replace('.', ',');
      const expCalc = `დაახლოებითი წონა: ${kg} კგ × 25₾ = ${mock.weight * 2}₾`;
      lg.check(`mock product ×2: "${expCalc}"`, d.calc === expCalc, d.calc);
      await p.keyboard.press('Escape'); await L.sleep(300);
      // QA params
      for (const [q, focus, calc] of [['info=weight', E.wH, true], ['info=customs', E.cH, true], ['info=all', null, false]]) {
        await p.goto(L.BASE + '#/cart?demo=1&' + q); await L.sleep(500);
        d = await dlg(p);
        lg.check(`cart ?${q}: open, focus ${focus}, product line ${calc}`, d.open && d.focus === focus && (calc ? d.calc === 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' : d.calc === null), d);
        await p.keyboard.press('Escape'); await L.sleep(300);
        const a = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
        lg.info(`after Esc on ?${q} focus ->`, a);
      }
      // payment details
      await p.goto(L.BASE + '#/payment?demo=1&details=1'); await L.sleep(400);
      const pib = await p.evaluate(() => [...document.querySelectorAll('#pay-bd .info-btn')].filter(x => x.getClientRects().length).map(b => b.getAttribute('data-explain')));
      lg.check('payment breakdown: weight + customs info buttons', JSON.stringify(pib) === '["weight","customs"]', pib);
      await L.vis(p, '#pay-bd .info-btn[data-explain="customs"]').click(); await L.sleep(400);
      d = await dlg(p);
      lg.check('payment customs info opens (customs focused)', d.open && d.focus === E.cH, d);
      lg.info('payment info calc line', d.calc);
      await p.keyboard.press('Escape'); await L.sleep(300);
      lg.check('payment: focus back on the customs info button', /\|customs\|/.test(await actId(p)), await actId(p));
      await p.goto(L.BASE + '#/payment?demo=1&info=weight'); await L.sleep(500);
      lg.check('payment ?info=weight opens', (await dlg(p)).open && (await dlg(p)).focus === E.wH);
      await p.keyboard.press('Escape'); await L.sleep(300);
      // order detail info buttons
      await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(400);
      const oib = await p.evaluate(() => [...document.querySelectorAll('.ord-part .info-btn')].map(b => [b.getAttribute('data-explain'), b.getAttribute('aria-label')]));
      lg.check('order detail: info buttons on both deferred rows', oib.length === 2 && oib.every(x => x[1] === 'როგორ ითვლება?'), oib);
      await p.click('.ord-part .info-btn[data-explain="weight"]'); await L.sleep(400);
      d = await dlg(p);
      lg.check('order detail weight info: product line 4 კგ × 25₾ = 100₾', d.open && d.calc === 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' && d.focus === E.wH, d);
      await p.keyboard.press('Escape'); await L.sleep(300);
      lg.check('order detail: focus back on the info button', /\|weight\|/.test(await actId(p)), await actId(p));
      // breakpoint flip while open (sheet <-> dialog)
      await L.vis(p, '.ord-part .info-btn[data-explain="customs"]').click(); await L.sleep(400);
      await p.setViewportSize(mob ? { width: 1200, height: 900 } : { width: 600, height: 800 }); await L.sleep(400);
      d = await dlg(p);
      lg.check('breakpoint flip while open switches sheet/dialog in place', d.open && d.sheet === !mob, d);
      await p.keyboard.press('Escape'); await L.sleep(300);
      await p.setViewportSize({ width: W, height: mob ? 735 : 1024 }); await L.sleep(300);
      // route change closes it
      await L.vis(p, '.ord-part .info-btn[data-explain="customs"]').click(); await L.sleep(400);
      await p.evaluate(() => history.back()); await L.sleep(500);
      lg.check('browser Back while open: dialog closed, scroll unlocked', !(await dlg(p)).open && (await p.evaluate(() => document.documentElement.style.overflow)) !== 'hidden', await p.evaluate(() => document.documentElement.style.overflow));
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    await ctx.close();
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

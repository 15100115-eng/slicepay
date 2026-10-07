// ported from scratchpad tools/v2f_explain.js
// "Approximate amounts" explanation: cart link, product / payment / order info buttons, sheet vs dialog, close paths, focus return
const L = require('../../lib/harness');
const E = {
  title: 'დაახლოებითი თანხები', wH: 'წონის საფასური', wP: 'ითვლება ამანათის ფაქტობრივი ან მოცულობითი წონით (რომელიც მეტია) და ტრანსპორტირების ტარიფით.',
  cH: 'განბაჟება', cP: 'დამოკიდებულია ნივთის ღირებულებაზე, კატეგორიასა და მიწოდების ღირებულებაზე. საბოლოო თანხას ადგენს საბაჟო ამანათის ჩამოსვლისას.',
  dH: 'რა მოხდება, თუ თანხა განსხვავდება?',
  d1: 'წინასწარ გადახდისას: თუ ფაქტობრივი თანხა ნაკლებია, სხვაობა დაგიბრუნდებათ; თუ მეტია — სხვაობას გადაიხდით „ჩემი შეკვეთების“ გვერდიდან.',
  d2: 'მოგვიანებით გადახდისას: ზუსტ თანხას გადაიხდით ამანათის ჩამოსვლის შემდეგ, „ჩემი შეკვეთების“ გვერდიდან.',
};
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('explain ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const modal = () => p.evaluate(() => {
      const d = document.getElementById('modal');
      const q = s => d.querySelector(s);
      return { open: d.open, sheet: d.classList.contains('modal--sheet'), handle: !!q('.modal__handle'), title: q('.modal__title') && q('.modal__title').textContent,
        h3: [...d.querySelectorAll('.explain__h')].map(e => e.textContent), ps: [...d.querySelectorAll('.explain__sec > p')].map(e => e.textContent),
        lis: [...d.querySelectorAll('.explain__list li')].map(e => e.textContent), calc: (q('.explain__calc') || {}).textContent || null,
        focusSec: (q('.explain__sec.is-focus') || {}).dataset ? (q('.explain__sec.is-focus') || { dataset: {} }).dataset.sec : null,
        ok: q('[data-ok]') && q('[data-ok]').innerText.trim(), radius: getComputedStyle(d).borderTopLeftRadius + ' ' + getComputedStyle(d).borderBottomLeftRadius,
        bottom: Math.round(d.getBoundingClientRect().bottom), vh: innerHeight, overflow: document.documentElement.style.overflow };
    });
    const closed = () => p.evaluate(() => !document.getElementById('modal').open);
    await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(400);
    await L.cartAdd(p, 'https://www.amazon.com/Kindle-Paperwhite-Signature/dp/B08N2ZL7PS');
    await L.cartAdd(p, 'https://www.amazon.com/Kindle-Paperwhite-Signature/dp/B08N2ZL7PS');
    await p.waitForFunction(() => SlicePay.getState().products.some(x => x.qty === 2), null, { timeout: 4000 }); await L.sleep(300);
    const prods = (await L.st(p)).products;
    const mock = prods[1];
    lg.info('mock product', mock.name, 'weight', mock.weight, 'kg', mock.weightKg, 'qty', mock.qty);
    // cart link
    const link = L.vis(p, '.cart-explain__link');
    lg.check('cart link copy', (await link.innerText()).trim() === 'როგორ ითვლება დაახლოებითი თანხები?');
    await link.click(); await L.sleep(450);
    let m = await modal();
    lg.check('opens as ' + (W < 900 ? 'bottom sheet with handle' : 'dialog'), m.open && m.sheet === (W < 900) && m.handle === (W < 900), m);
    lg.check('copy: title + 3 headings + 2 paragraphs + 2 bullets', m.title === E.title && m.h3.join('|') === [E.wH, E.cH, E.dH].join('|') && m.ps[0] === E.wP && m.ps.includes(E.cP) && m.lis[0] === E.d1 && m.lis[1] === E.d2, m);
    lg.check('link: no product-specific weight line', m.calc === null, m.calc);
    lg.check('button ᲒᲐᲡᲐᲒᲔᲑᲘᲐ', (m.ok || '').includes('ᲒᲐᲡᲐᲒᲔᲑᲘᲐ'), m.ok);
    if (W < 900) lg.check('sheet: 16px top radius, square bottom, anchored to bottom', m.radius.startsWith('16px') && / 0px$/.test(m.radius) && Math.abs(m.bottom - m.vh) <= 1, m);
    lg.check('scroll locked while open', m.overflow === 'hidden', m.overflow);
    // Tab stays inside the dialog
    const inside = [];
    for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); inside.push(await p.evaluate(() => !!document.activeElement.closest('#modal'))); }
    lg.info('Tab inside modal (false = browser chrome / body)', inside);
    await p.keyboard.press('Escape'); await L.sleep(400);
    lg.check('Esc closes; focus back on the link; scroll unlocked', await closed() && (await p.evaluate(() => document.activeElement.classList.contains('cart-explain__link'))) && (await p.evaluate(() => document.documentElement.style.overflow)) !== 'hidden', await L.active(p));
    // backdrop click
    await link.click(); await L.sleep(450);
    await p.mouse.click(W - 5, 5); await L.sleep(400);
    lg.check('backdrop click closes', await closed());
    // ✕ button
    await link.click(); await L.sleep(450);
    await p.click('#modal [data-close]'); await L.sleep(400);
    lg.check('✕ closes', await closed());
    // drag handle (mobile)
    if (W < 900) {
      await link.click(); await L.sleep(450);
      const hb = await p.evaluate(() => { const r = document.querySelector('#modal .modal__handle').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
      await p.mouse.move(hb[0], hb[1]); await p.mouse.down(); await p.mouse.move(hb[0], hb[1] + 40, { steps: 4 }); await p.mouse.up(); await L.sleep(400);
      lg.check('small drag (40px) does not close', !(await closed()));
      await p.mouse.move(hb[0], hb[1]); await p.mouse.down(); await p.mouse.move(hb[0], hb[1] + 150, { steps: 6 }); await p.mouse.up(); await L.sleep(400);
      lg.check('drag down 150px closes', await closed());
      // touch drag
      await link.click(); await L.sleep(450);
      const tb = await p.evaluate(() => { const r = document.querySelector('#modal .modal__title').getBoundingClientRect(); return [r.x + 20, r.y + r.height / 2]; });
      await p.dispatchEvent('#modal .modal__title', 'pointerdown', { pointerId: 7, pointerType: 'touch', clientX: tb[0], clientY: tb[1], isPrimary: true, bubbles: true });
      await p.dispatchEvent('#modal', 'pointermove', { pointerId: 7, pointerType: 'touch', clientX: tb[0], clientY: tb[1] + 120, isPrimary: true, bubbles: true });
      await p.dispatchEvent('#modal', 'pointerup', { pointerId: 7, pointerType: 'touch', clientX: tb[0], clientY: tb[1] + 120, isPrimary: true, bubbles: true });
      await L.sleep(400);
      lg.check('touch drag on the title closes', await closed());
    }
    // product info buttons
    if (!(await p.evaluate(() => [...document.querySelectorAll('.prod')].every(a => a.classList.contains('is-open'))))) {
      for (const x of prods) { const tg = L.vis(p, '#tg-' + x.id); if ((await tg.getAttribute('aria-expanded')) !== 'true') { await tg.click(); await L.sleep(350); } }
    }
    const ib = await p.evaluate(() => [...document.querySelectorAll('.prod .info-btn')].filter(e => e.getClientRects().length).map(e => ({ f: e.dataset.explain, pid: e.dataset.product, label: e.getAttribute('aria-label'), w: e.querySelector('svg') && e.querySelector('svg').getBoundingClientRect().width, c: getComputedStyle(e).color, row: e.closest('.bd__row').querySelector('.bd__lab').textContent })));
    lg.check('2 info buttons per product (weight, customs), aria-label როგორ ითვლება?, 16px #79747e', ib.length === 4 && ib.every(x => x.label === 'როგორ ითვლება?' && Math.round(x.w) === 16 && x.c === 'rgb(121, 116, 126)'), ib);
    lg.check('info rows labels (' + (W < 900 ? 'short' : 'long') + ')', ib.map(x => x.row).join('|') === (W < 900 ? 'წონის დაახ. ფასი|განბაჟების დაახ. ფასი' : 'წონის დაახლოებით ფასი|განბაჟების დაახლოებით ფასი').repeat(1) + '|' + (W < 900 ? 'წონის დაახ. ფასი|განბაჟების დაახ. ფასი' : 'წონის დაახლოებით ფასი|განბაჟების დაახლოებით ფასი'), ib.map(x => x.row));
    await L.vis(p, '.prod[data-id="demo-nike"] .info-btn[data-explain="weight"]').click(); await L.sleep(450);
    m = await modal();
    lg.check('Nike weight info: "დაახლოებითი წონა: 4 კგ × 25₾ = 100₾", weight section focused', m.calc === 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' && m.focusSec === 'weight', m);
    await p.keyboard.press('Escape'); await L.sleep(400);
    lg.check('focus returns to the info button', await p.evaluate(() => document.activeElement.classList.contains('info-btn') && document.activeElement.dataset.product === 'demo-nike'));
    await L.vis(p, '.prod[data-id="' + mock.id + '"] .info-btn[data-explain="customs"]').click(); await L.sleep(450);
    m = await modal();
    const kg = Math.round(mock.weightKg * mock.qty * 10) / 10;
    const expCalc = 'დაახლოებითი წონა: ' + String(kg).replace('.', ',') + ' კგ × 25₾ = ' + (mock.weight * mock.qty) + '₾';
    lg.check('mock product (qty ' + mock.qty + ') customs info: calc ' + expCalc + ', customs focused', m.calc === expCalc && m.focusSec === 'customs', m);
    await p.keyboard.press('Escape'); await L.sleep(400);
    // keyboard open: Tab to info button and press Enter
    await p.focus('.prod[data-id="demo-nike"] .info-btn[data-explain="customs"]' + (W < 900 ? '' : '')).catch(() => {});
    await p.evaluate(() => { const e = [...document.querySelectorAll('.prod[data-id="demo-nike"] .info-btn[data-explain="customs"]')].find(x => x.getClientRects().length); e.focus(); });
    await p.keyboard.press('Enter'); await L.sleep(450);
    lg.check('Enter on a focused info button opens', !(await closed()));
    await p.keyboard.press('Escape'); await L.sleep(400);
    // info on the payment screen (all products)
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/);
    await L.delivery(p, { pid: '01001012345' }); await L.sleep(250);
    await L.vis(p, '#pay-toggle').click(); await L.sleep(350);
    const pib = await p.evaluate(() => [...document.querySelectorAll('#pay-bd .info-btn')].map(e => e.dataset.explain + ':' + (e.dataset.product || '')));
    lg.check('payment breakdown has weight + customs info buttons', pib.join() === 'weight:,customs:', pib);
    await p.click('#pay-bd .info-btn[data-explain="weight"]'); await L.sleep(450);
    m = await modal();
    const totKg = Math.round((4 + mock.weightKg * mock.qty) * 10) / 10;
    lg.check('payment weight info: sum over the cart', m.calc === 'დაახლოებითი წონა: ' + String(totKg).replace('.', ',') + ' კგ × 25₾ = ' + (100 + mock.weight * mock.qty) + '₾', m.calc);
    await p.keyboard.press('Escape'); await L.sleep(400);
    // ?info= params
    for (const [q, foc] of [['info=weight', 'weight'], ['info=customs', 'customs'], ['info=all', null]]) {
      for (const scr of ['cart', 'payment']) {
        await p.goto(L.BASE + '#/' + scr + '?demo=1&' + q); await L.sleep(500);
        m = await modal();
        lg.check(scr + ' ?' + q + ' opens ' + (W < 900 ? 'sheet' : 'dialog') + ', focus ' + foc, m.open && m.sheet === (W < 900) && m.focusSec === foc && (foc ? m.calc === 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' : true), m);
      }
    }
    // route change while open closes it (browser back)
    await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
    await L.go(p, '#/delivery'); await L.go(p, '#/cart'); await L.sleep(200);
    await L.vis(p, '.cart-explain__link').click(); await L.sleep(450);
    await p.goBack(); await L.sleep(400);
    lg.check('browser Back while open: closes and unlocks scroll', await closed() && (await p.evaluate(() => document.documentElement.style.overflow)) !== 'hidden', await L.H(p));
    // order detail info buttons
    await p.goto(L.BASE + '#/orders/731954?demo=1'); await L.sleep(400);
    const oib = await p.evaluate(() => [...document.querySelectorAll('.ord-part .info-btn')].map(e => e.dataset.explain + ':' + e.dataset.order));
    lg.check('order detail rows have info buttons', oib.join() === 'weight:731954,customs:731954', oib);
    await p.click('.ord-part .info-btn[data-explain="weight"]'); await L.sleep(450);
    m = await modal();
    lg.check('order info: weight line from the order products', m.calc === 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' && m.focusSec === 'weight', m);
    await p.click('#modal [data-ok]'); await L.sleep(400);
    lg.check('ᲒᲐᲡᲐᲒᲔᲑᲘᲐ closes', await closed());
    // breakpoint flip while sheet open
    if (W < 900) {
      await p.goto(L.BASE + '#/cart?demo=1&info=all'); await L.sleep(500);
      await p.setViewportSize({ width: 1200, height: 800 }); await L.sleep(400);
      m = await modal();
      lg.info('sheet after resize to 1200:', JSON.stringify({ open: m.open, sheet: m.sheet, bottom: m.bottom, vh: m.vh }));
      await L.shot(p, 'explain_sheet_resized_1200');
      await p.setViewportSize({ width: 428, height: 735 });
      await p.keyboard.press('Escape'); await L.sleep(300);
    }
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

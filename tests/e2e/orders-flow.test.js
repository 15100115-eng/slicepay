// ported from scratchpad tools/v2orders_flow.js
// v2 orders engineer: drives #/orders, #/orders/:id, #/pay?order=, checkout pay -> success -> orders, keyboard, widths
const { chromium } = require('playwright');
const { BASE, outDir } = require('../lib/env');
const fs = require('fs');
const OUT = process.argv[2] || outDir('e2e/orders-flow');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ck = (w, n, c, d) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + w + ' ' + n + (d !== undefined ? ' :: ' + JSON.stringify(d) : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'] });
  const errors = {};
  for (const [w, h] of [[428, 735], [1440, 1024]]) {
    const errs = errors[w] = [];
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    p.on('requestfailed', r => { if (!r.url().startsWith('file:')) errs.push('net ' + r.url()); });
    const hash = () => p.evaluate(() => location.hash);
    const vis = sel => p.locator(sel).locator('visible=true').first();

    // list
    await p.goto(BASE + '#/orders?demo=1'); await sleep(300);
    const cards = await p.$$eval('.ord-card', els => els.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
    ck(w, 'list has 2 cards newest first', cards.length === 2 && cards[0].includes('#731954') && cards[1].includes('#548210'), cards);
    ck(w, 'due badge on #731954', cards[0].includes('გადასახდელია: 350₾'));
    ck(w, 'totals line', cards[0].includes('სულ 600₾ · 150₾ × 4 თვე') && cards[1].includes('სულ 745₾ · 125₾ × 6 თვე'));
    ck(w, 'delivered line', /ჩაბარდა: \d+ /.test(cards[1]) && cards[1].includes('+1'));
    ck(w, 'pills', await p.$$eval('.ord-card .status-pill', e => e.map(x => x.className + ':' + x.textContent)).then(a => a[0].includes('due:განბაჟება') && a[1].includes('done:ჩაბარდა')));
    // v4: the heading link is პროფილი (logout moved to #/profile)
    ck(w, 'h1 + პროფილი link, no logout on the list', (await p.textContent('h1')) === 'ჩემი შეკვეთები' && (await p.evaluate(() => { const a = document.querySelector('.ord-top__out'); return a && a.tagName === 'A' && a.textContent.trim() === 'პროფილი' && a.getAttribute('href') === '#/profile'; })) && !(await p.$('#app [data-action="logout"]')));
    await p.screenshot({ path: OUT + '/list_' + w + '.png', fullPage: true });
    // horizontal overflow
    ck(w, 'no h-overflow list', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    // keyboard: tab to first card link, Enter
    await p.evaluate(() => document.querySelector('h1').focus());
    let found = false;
    for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); if (await p.evaluate(() => document.activeElement.matches('.ord-card__link'))) { found = true; break; } }
    ck(w, 'card link reachable by Tab', found);
    const ring = await p.evaluate(() => getComputedStyle(document.activeElement.closest('.ord-card')).outlineStyle);
    ck(w, 'card focus ring', ring === 'solid', ring);
    await p.keyboard.press('Enter'); await sleep(300);
    ck(w, 'Enter opens detail', (await hash()) === '#/orders/731954');
    ck(w, 'detail h1 focused', await p.evaluate(() => document.activeElement.tagName === 'H1' && document.activeElement.textContent === 'შეკვეთა #731954'));
    const det = (await p.innerText('main')).replace(/\s+/g, ' ');
    ck(w, 'detail sections', ['პროდუქტები', 'მიწოდება', 'გადახდა', 'დარჩენილი გადასახდელი'].every(x => det.includes(x)) || det.includes('ᲞᲠᲝᲓᲣᲥᲢᲔᲑᲘ'), det.slice(0, 200));
    ck(w, 'masked pid + recipient', det.includes('პირადი ნომერი: ********345') && det.includes('მიმღები: გიორგი ბერიძე'));
    ck(w, 'schedule ordinals', det.includes('1-ლი შენატანი') && det.includes('მე-2 შენატანი') && det.includes('მე-4 შენატანი'));
    ck(w, 'deferred rows', det.includes('დაახ. 100₾') && det.includes('ფაქტობრივი 112₾') && det.includes('ფაქტობრივი 238₾') && det.includes('გადასახდელი: 350₾'));
    ck(w, 'timeline current', await p.$eval('.tl__item.is-current', e => e.textContent.includes('განბაჟება')));
    ck(w, 'no full pid anywhere', !(await p.content()).includes('01001012345'));
    // info button opens explanation with the order's weight line
    await vis('.ord-part .info-btn').click(); await sleep(350);
    const modal = await p.evaluate(() => { const d = document.getElementById('modal'); return d.open ? d.innerText : null; });
    ck(w, 'info opens explanation with weight calc', !!modal && modal.includes('4 კგ × 25₾ = 100₾'), modal && modal.slice(0, 80));
    await p.keyboard.press('Escape'); await sleep(300);
    await p.screenshot({ path: OUT + '/detail_' + w + '.png', fullPage: true });
    ck(w, 'no h-overflow detail', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    // pay
    await vis('[data-action="pay"]').click(); await sleep(300);
    ck(w, 'pay order mode', (await hash()) === '#/pay?order=731954' && (await p.innerText('#pay-due')).includes('გადასახდელი: 350₾'));
    await p.screenshot({ path: OUT + '/pay_' + w + '.png' });
    // back returns to detail
    await vis('[data-back]').click(); await sleep(300);
    ck(w, 'back → detail', (await hash()) === '#/orders/731954');
    await vis('[data-action="pay"]').click(); await sleep(300);
    await p.click('#card-submit'); await sleep(100);
    ck(w, 'empty submit shows errors', (await p.textContent('#cc-num-err')).length > 0);
    await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '12/30'); await p.fill('#cc-cvv', '123');
    await p.click('#card-submit');
    await p.waitForFunction(() => location.hash === '#/orders/731954', null, { timeout: 5000 }).catch(() => {});
    ck(w, 'pay → detail (replace)', (await hash()) === '#/orders/731954');
    await sleep(300);
    const toast = await p.evaluate(() => (document.querySelector('#toast-root .toast') || {}).textContent);
    ck(w, 'paid toast', toast === 'გადახდა წარმატებით შესრულდა', toast);
    const det2 = (await p.innerText('main')).replace(/\s+/g, ' ');
    ck(w, 'rows paid, no pay button', (det2.match(/გადახდილია/g) || []).length === 2 && !(await p.$('[data-action="pay"]')));
    ck(w, 'next status', await p.$eval('.ord-top .status-pill', e => e.textContent === 'მზადაა გასატანად' && e.classList.contains('status-pill--progress')));
    await p.screenshot({ path: OUT + '/detail_paid_' + w + '.png', fullPage: true });
    // browser back from detail does not land on the pay form again
    await p.evaluate(() => SlicePay.go('/pay?order=731954')); await sleep(300);
    ck(w, 'pay?order with nothing due → detail', (await hash()) === '#/orders/731954');
    // list back
    await vis('[data-back]').click(); await sleep(300);
    ck(w, 'detail back → list', (await hash()) === '#/orders');
    ck(w, 'list badge gone', !(await p.$('.ord-due-badge')));

    // checkout mode e2e: demo cart -> pay -> success -> orders contains the new order
    await p.evaluate(() => { location.hash = '#/pay?demo=1'; }); await sleep(400);
    ck(w, 'checkout pay no due line', !(await p.$('#pay-due')));
    await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '12/30'); await p.fill('#cc-cvv', '123');
    await p.click('#card-submit');
    await p.waitForFunction(() => location.hash === '#/success', null, { timeout: 5000 }).catch(() => {});
    ck(w, 'checkout → success', (await hash()) === '#/success');
    const st = await p.evaluate(() => { const s = SlicePay.getState(); return { id: s.order.id, prods: s.products.length, done: s.delivery.done, list: SlicePay.orders.list().map(o => o.id) }; });
    ck(w, 'completeCheckout: order stored, cart emptied, delivery reset', st.prods === 0 && st.done === false && st.list[0] === st.id, st);
    await p.evaluate(() => SlicePay.go('/orders')); await sleep(300);
    const c3 = await p.$$eval('.ord-card', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    ck(w, 'new order first with მუშავდება', c3.length === 3 && c3[0].includes('#' + st.id) && c3[0].includes('მუშავდება') && !c3[0].includes('შეკვეთილია'), c3[0]);

    // empty + new order
    await p.evaluate(() => { location.hash = '#/orders?demo=1&empty=1'; }); await sleep(300);
    ck(w, 'empty state', (await p.innerText('main')).includes('ჯერ არ გაქვთ შეკვეთები'));
    await vis('[data-action="new"]').click(); await sleep(300);
    ck(w, 'new order → landing', (await hash()) === '#/' || (await hash()) === '');

    // logout: orders → პროფილი → ᲒᲐᲡᲕᲚᲐ on the profile page (v4)
    await p.evaluate(() => { location.hash = '#/orders?demo=1'; }); await sleep(300);
    await vis('.ord-top__out').click(); await sleep(300);
    ck(w, 'პროფილი → #/profile', (await hash()) === '#/profile', await hash());
    await vis('[data-action="logout"]').click(); await sleep(300);
    ck(w, 'logout → landing + toast', ((await hash()) === '#/' ) && (await p.evaluate(() => document.querySelector('#toast-root').textContent)).includes('თქვენ გამოხვედით სისტემიდან'));
    await p.evaluate(() => { location.hash = '#/orders'; }); await sleep(300);
    ck(w, 'signed out → login?next', (await hash()).startsWith('#/login?next=/orders'), await hash());
    await ctx.close();
  }
  // widths: overflow checks
  for (const W of [320, 375, 428, 1024, 1440, 1920]) {
    const ctx = await b.newContext({ viewport: { width: W, height: W < 900 ? 700 : 1000 } });
    const p = await ctx.newPage();
    for (const r of ['#/orders?demo=1', '#/orders/731954?demo=1', '#/orders/548210?demo=1', '#/orders?demo=1&empty=1', '#/pay?demo=1&order=731954']) {
      await p.goto(BASE + r); await sleep(250);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ck(W, 'no overflow ' + r, ov <= 0, ov);
      await p.screenshot({ path: OUT + '/w' + W + '_' + r.replace(/[^a-z0-9]+/gi, '_') + '.png', fullPage: true });
    }
    await ctx.close();
  }
  fs.writeFileSync(OUT + '/console_errors.json', JSON.stringify(errors));
  console.log('errors', JSON.stringify(errors));
  console.log(fails ? fails + ' FAIL' : 'ALL PASS');
  await b.close();
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

// ported from scratchpad tools/v2_e2e.js
// SlicePay v2 integration end-to-end test (428x735@2x and 1440x1024).
// landing -> cart (checkbox, explanation) -> register (errors, valid) -> verify (wrong, toast code)
// -> delivery (errors, courier Tbilisi + address + 11-digit ID) -> payment (method switch, term 6, numbers)
// -> pay -> success (delivery, ETA, term) -> my orders (new order, masked ID) -> demo orders -> #731954
// -> pay remaining 350 via #/pay?order -> detail paid -> logout -> login next=/orders -> guards.
// usage: node tests/e2e/checkout-journey.test.js [outDir]
const { chromium } = require('playwright');
const { BASE, outDir } = require('../lib/env');
const fs = require('fs');
const OUT = process.argv[2] || outDir('e2e/checkout-journey');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0, passes = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'] });
  const errors = {};
  for (const [w, h, scale] of [[428, 735, 2], [1440, 1024, 1]]) {
    const errs = errors[w] = [];
    const ck = (n, c, d) => { if (c) passes++; else fails++; console.log((c ? 'PASS ' : 'FAIL ') + w + ' ' + n + (d !== undefined && !c ? ' :: ' + JSON.stringify(d) : '')); };
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    p.on('requestfailed', r => errs.push('requestfailed ' + r.url()));
    p.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) errs.push('network ' + r.url()); });
    const hash = () => p.evaluate(() => location.hash);
    const vis = sel => p.locator(sel).locator('visible=true').first();
    const txt = async sel => (await p.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();
    const mainText = async () => (await p.innerText('#app')).replace(/\s+/g, ' ');
    const waitHash = async (re, ms = 4000) => { try { await p.waitForFunction(r => new RegExp(r).test(location.hash), re.source, { timeout: ms }); } catch (e) { /* reported by the check */ } return hash(); };
    const toast = async () => p.evaluate(() => { const t = document.querySelector('#toast-root .toast'); return t ? t.textContent : ''; });
    const shot = async name => p.screenshot({ path: OUT + '/' + name + '_' + w + '.png', fullPage: true });
    const noOverflow = async () => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    const st = () => p.evaluate(() => SlicePay.getState());
    const phone = '599000' + String(w).slice(-3);
    const phoneFmt = phone.slice(0, 3) + ' ' + phone.slice(3, 6) + ' ' + phone.slice(6);
    const ADDR = 'ჭავჭავაძის გამზ. 1 <b>x</b>';

    /* ---------------- landing ---------------- */
    await p.goto(BASE); await sleep(300);
    ck('landing: signed-out account link "შესვლა"', (await txt('.landing__acct')).includes('შესვლა'));
    await p.fill('#url', 'https://www.amazon.com/Nike-Air-Pegasus/dp/B0TEST');
    await p.press('#url', 'Enter');
    ck('landing -> cart', (await waitHash(/^#\/cart$/, 7000)) === '#/cart');
    await sleep(300);

    /* ---------------- cart ---------------- */
    let t = await p.evaluate(() => SlicePay.totals());
    ck('cart: designed total 600 / 150 x 4', t.total === 600 && t.monthly === 150 && t.term === 4, t);
    ck('cart: ETA line visible', await vis('#cart-eta').isVisible() && /სავარაუდო მიღება: \d/.test(await txt('#cart-eta')), await txt('#cart-eta'));
    ck('cart: term label "4 თვეში"', (await txt('.cart-sum__mo-l')).includes('4 თვეში') || (await vis('.cart-sum__mo-l').innerText()).includes('4 თვეში'));
    await vis('label[for="defer-weight"], #defer-weight + *').click().catch(async () => p.click('#defer-weight', { force: true }));
    await sleep(150);
    t = await p.evaluate(() => SlicePay.totals());
    const sumTxt = await vis('.cart-sum__total').innerText();
    ck('cart: weight unchecked -> 700, summary updated', t.total === 700 && sumTxt.includes('700₾') && t.monthly === 175, [t.total, sumTxt]);
    await p.click('#defer-weight', { force: true }); await sleep(150);
    t = await p.evaluate(() => SlicePay.totals());
    ck('cart: weight re-checked -> 600', t.total === 600 && (await vis('.cart-sum__total').innerText()).includes('600₾'));
    await vis('[data-explain="all"]').click(); await sleep(450);
    let m = await p.evaluate(() => { const d = document.getElementById('modal'); return { open: d.open || d.hasAttribute('open'), sheet: d.classList.contains('modal--sheet'), text: d.innerText }; });
    ck('cart: explanation opens (' + (w < 900 ? 'sheet' : 'dialog') + ')', m.open && m.sheet === (w < 900) && m.text.includes('დაახლოებითი თანხები') && m.text.includes('რა მოხდება, თუ თანხა განსხვავდება?'), m);
    await shot('01_cart_explain');
    await p.click('#modal [data-ok]'); await sleep(450);
    ck('cart: explanation closes on ᲒᲐᲡᲐᲒᲔᲑᲘᲐ', await p.evaluate(() => !document.getElementById('modal').open));
    // product breakdown info button -> weight calc line
    await vis('[data-toggle]').click(); await sleep(400);
    await vis('.prod .info-btn[data-explain="weight"]').click(); await sleep(450);
    m = await p.evaluate(() => document.getElementById('modal').innerText);
    ck('cart: info button shows "4 კგ × 25₾ = 100₾"', m.includes('4 კგ × 25₾ = 100₾'), m.slice(0, 120));
    await p.keyboard.press('Escape'); await sleep(450);
    ck('cart: Esc closes', await p.evaluate(() => !document.getElementById('modal').open));
    ck('cart: no horizontal overflow', await noOverflow());
    await vis('[data-action="next"]').click(); await sleep(300);
    ck('cart -> register (signed out)', (await hash()) === '#/register');

    /* ---------------- register ---------------- */
    await p.click('#auth-submit'); await sleep(200);
    const regErrs = await p.evaluate(() => ['reg-first', 'reg-last', 'reg-pass', 'reg-email', 'reg-terms'].map(id => (document.getElementById(id + '-err') || {}).textContent));
    ck('register: empty submit shows errors', regErrs.every(Boolean) && (await hash()) === '#/register', regErrs);
    await p.fill('#reg-first', 'ტესტ'); await p.fill('#reg-last', 'მომხმარებელი');
    await p.fill('#reg-phone', '599');
    await p.fill('#reg-pass', 'password1'); await p.fill('#reg-email', 'bad');
    await p.click('#auth-submit'); await sleep(200);
    const e2 = await p.evaluate(() => [document.getElementById('reg-phone-err').textContent, document.getElementById('reg-email-err').textContent]);
    ck('register: bad phone + email errors', e2[0] && !e2[0].startsWith('*') && e2[1], e2);
    await p.fill('#reg-phone', phone); await p.fill('#reg-email', 't' + w + '@example.com');
    await p.click('#reg-terms', { force: true });
    await p.click('#auth-submit'); await sleep(300);
    ck('register -> verify', (await hash()) === '#/register/verify');
    const codeToast = await toast();
    const code = (codeToast.match(/(\d{4})/) || [])[1];
    ck('verify: code toast shown', /სატესტო კოდი: \d{4}/.test(codeToast), codeToast);
    ck('verify: lead shows formatted number', (await txt('#verify-lead')).includes(phoneFmt));
    ck('verify: no account yet, no plain password stored', await p.evaluate(ph => { const u = JSON.parse(localStorage.getItem('slicepay:v1:users') || '{}'); return !u[ph] && !sessionStorage.getItem('slicepay:v1:state').includes('password1') && !SlicePay.getState().userPhone; }, phone));
    ck('verify: cooldown countdown shown', /\(0:\d\d\)/.test(await txt('#verify-resend')));
    await p.click('#auth-submit'); await sleep(150);
    ck('verify: empty -> "შეიყვანეთ 4-ნიშნა კოდი"', (await txt('#verify-code-err')) === 'შეიყვანეთ 4-ნიშნა კოდი', await txt('#verify-code-err'));
    await p.fill('#verify-code', code === '0000' ? '1111' : '0000');
    await p.click('#auth-submit'); await sleep(150);
    ck('verify: wrong -> "კოდი არასწორია"', (await txt('#verify-code-err')) === 'კოდი არასწორია');
    await shot('02_verify_wrong');
    await p.fill('#verify-code', code);
    await p.click('#auth-submit');
    ck('verify -> delivery', (await waitHash(/^#\/delivery$/)) === '#/delivery');
    await sleep(200);
    ck('verify: toast "ნომერი დადასტურებულია"', (await toast()).includes('ნომერი დადასტურებულია'), await toast());
    ck('verify: account created + signed in', await p.evaluate(ph => { const u = JSON.parse(localStorage.getItem('slicepay:v1:users') || '{}'); return !!u[ph] && SlicePay.getState().userPhone === ph && !SlicePay.getState().pendingReg; }, phone));

    /* ---------------- delivery ---------------- */
    ck('delivery: names prefilled', (await p.inputValue('#d-first')) === 'ტესტ' && (await p.inputValue('#d-last')) === 'მომხმარებელი');
    ck('delivery: pickup default + ვაკე', await p.isChecked('input[name="dmethod"][value="pickup"]') && (await p.inputValue('#d-branch')) === 'vake');
    const eta0 = await txt('#d-eta');
    await p.click('#dlv-submit'); await sleep(150);
    ck('delivery: empty ID error', (await txt('#d-pid-err')) === 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან' && (await hash()) === '#/delivery');
    await p.click('.rcard[data-value="courier"]'); await sleep(150);
    ck('delivery: courier panel shown', await p.isVisible('#d-city') && !(await p.isVisible('#d-branch')));
    // v2 round 1 (delivery fixer): digits only, but an over-long ID is NOT cut — it stays visible and is flagged
    await p.fill('#d-pid', '010 0101 2345 9'); await sleep(50);
    ck('delivery: ID digits only, over-long kept', (await p.inputValue('#d-pid')) === '010010123459', await p.inputValue('#d-pid'));
    await p.click('#dlv-submit'); await sleep(150);
    ck('delivery: 12-digit ID flagged, focus on ID', (await txt('#d-pid-err')) === 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან' && (await p.evaluate(() => document.activeElement.id)) === 'd-pid');
    await p.fill('#d-pid', '01001012345'); await sleep(50);
    await p.click('#dlv-submit'); await sleep(150);
    const dErr = await p.evaluate(() => [document.getElementById('d-city-err').textContent, document.getElementById('d-addr-err').textContent, document.activeElement.id]);
    ck('delivery: city + address errors, focus on city', dErr[0] === 'აირჩიეთ ქალაქი' && dErr[1] === 'შეიყვანეთ მისამართი' && dErr[2] === 'd-city', dErr);
    await shot('03_delivery_err');
    await p.selectOption('#d-city', 'თბილისი'); await sleep(100);
    const eta1 = await txt('#d-eta');
    ck('delivery: ETA changes for courier Tbilisi', eta1 !== eta0, [eta0, eta1]);
    ck('delivery: ETA equals SP.eta (+1 day)', await p.evaluate(e => SlicePay.etaText(SlicePay.eta({ delivery: { method: 'courier', city: 'თბილისი' } })) === e, eta1));
    await p.fill('#d-addr', ADDR);
    ck('delivery: address placeholder is the hint', (await p.getAttribute('#d-addr', 'placeholder')) === 'ქუჩა, სახლის ნომერი');
    ck('delivery: city select autocomplete', (await p.getAttribute('#d-city', 'autocomplete')) === 'address-level2');
    ck('delivery: method group labelled by heading', (await p.getAttribute('.dlv__methods', 'aria-labelledby')) === 'dlv-method-h');
    ck('delivery: no injected markup', await p.evaluate(() => !document.querySelector('#app b:not(.auth__phone)') || [...document.querySelectorAll('#app b')].every(b => b.textContent !== 'x')));
    ck('delivery: no horizontal overflow', await noOverflow());
    await p.click('#dlv-submit');
    ck('delivery -> payment', (await waitHash(/^#\/payment$/)) === '#/payment');
    await sleep(300);
    let s = await st();
    ck('delivery saved (done, courier, Tbilisi, ID session only)', s.delivery.done && s.delivery.method === 'courier' && s.delivery.city === 'თბილისი' && s.delivery.pid === '01001012345' && await p.evaluate(() => !Object.keys(localStorage).some(k => (localStorage.getItem(k) || '').includes('01001012345'))), s.delivery);

    /* ---------------- payment ---------------- */
    t = await p.evaluate(() => SlicePay.totals());
    ck('payment: total 605 (fee 5), term 4 -> 152', t.total === 605 && t.delivery === 5 && t.monthly === 152, t);
    ck('payment: total shown 605₾', (await vis('.pay-total').innerText()).includes('605₾'));
    ck('payment: monthly shown 152₾ 4 თვეში', /^(152₾4თვეში|4თვეში152₾)$/.test((await txt('#pay-mo')).replace(/\s/g, '')), await txt('#pay-mo'));
    ck('payment: bog chips 3/4/6', (await p.$$eval('#terms input[name="term"]', a => a.map(i => i.value).join(','))) === '3,4,6');
    await p.click('label.method[data-method="tbc"]'); await sleep(150);
    ck('payment: tbc chips 3/4/6/9/12, term kept 4', (await p.$$eval('#terms input[name="term"]', a => a.map(i => i.value).join(','))) === '3,4,6,9,12' && (await st()).term === 4);
    await p.click('label.term-chip[data-term="6"]'); await sleep(150);
    s = await st(); t = await p.evaluate(() => SlicePay.totals());
    ck('payment: term 6 -> monthly ceil(605/6)=101', s.term === 6 && t.monthly === 101 && /^(101₾6თვეში|6თვეში101₾)$/.test((await txt('#pay-mo')).replace(/\s/g, '')), [s.term, t.monthly, await txt('#pay-mo')]);
    ck('payment: chip shows "101₾ / თვე"', (await txt('label.term-chip[data-term="6"]')).includes('101₾ / თვე'), await txt('label.term-chip[data-term="6"]'));
    await p.click('label.method[data-method="mere"]'); await sleep(150);
    ck('payment: mere keeps 6', (await st()).term === 6 && (await p.$$eval('#terms input[name="term"]', a => a.map(i => i.value).join(','))) === '4,6,12');
    await p.click('label.method[data-method="bog"]'); await sleep(150);
    ck('payment: back to bog keeps 6', (await st()).term === 6 && (await txt('#pay-mo')).includes('101₾'));
    await p.click('#pay-toggle'); await sleep(350);
    const bdTxt = (await p.innerText('#pay-bd')).replace(/\s+/g, ' ');
    ck('payment: details show მიწოდების ფასი 5₾', /მიწოდების ფასი 5 ?₾/.test(bdTxt) && /ჯამი 605 ?₾/.test(bdTxt), bdTxt);
    const bdFit = await p.evaluate(() => { const bd = document.getElementById('pay-bd'); return bd.scrollHeight <= bd.clientHeight + 1; });
    ck('payment: details box fits 6 rows', bdFit);
    ck('payment: ETA line', /სავარაუდო მიღება: /.test(await txt('#pay-eta')) && (await txt('#pay-eta')).includes(eta1));
    ck('payment: no horizontal overflow', await noOverflow());
    await shot('04_payment_term6');
    // back -> delivery keeps values, forward again
    await vis('[data-back="/delivery"]').click(); await sleep(300);
    ck('payment back -> delivery with values kept', (await hash()) === '#/delivery' && (await p.inputValue('#d-addr')) === ADDR && (await p.inputValue('#d-pid')) === '01001012345');
    await p.click('#dlv-submit'); await waitHash(/^#\/payment$/); await sleep(300);
    s = await st();
    ck('payment again: term 6 + bog kept', s.term === 6 && s.method === 'bog' && (await p.evaluate(() => SlicePay.totals().monthly)) === 101);
    await vis('[data-action="next"]').click(); await sleep(300);
    ck('payment -> pay', (await hash()) === '#/pay');

    /* ---------------- pay ---------------- */
    await p.click('#card-submit'); await sleep(150);
    ck('pay: empty errors', (await txt('#cc-num-err')).length > 0);
    await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '12/30'); await p.fill('#cc-cvv', '123');
    await p.click('#card-submit');
    ck('pay -> success', (await waitHash(/^#\/success$/, 6000)) === '#/success');
    await sleep(400);

    /* ---------------- success ---------------- */
    s = await st();
    const o = s.order;
    ck('success: order term 6, monthly 101, fee 5, total 605', o.term === 6 && o.monthly === 101 && o.deliveryFee === 5 && o.total === 605, [o.term, o.monthly, o.deliveryFee, o.total]);
    const sTxt = await mainText();
    ck('success: delivery section "კურიერით: თბილისი, <address>"', sTxt.includes('კურიერით: თბილისი, ' + ADDR), sTxt.slice(0, 400));
    ck('success: ETA line', sTxt.includes('სავარაუდო მიღება: ' + eta1));
    ck('success: summary 6x 101₾, fee row, total 605₾', /თვეში 6x 101₾/.test(sTxt) && /მიწოდების ფასი 5 ?₾/.test(sTxt) && /სულ 605₾/.test(sTxt), sTxt.match(/თვეში.*$/)?.[0]?.slice(0, 120));
    ck('success: cart emptied, delivery.done reset', s.products.length === 0 && !s.delivery.done);
    ck('success: address escaped (no <b> injected)', await p.evaluate(() => ![...document.querySelectorAll('#app b')].some(b => b.textContent === 'x')));
    ck('success: no horizontal overflow', await noOverflow());
    await shot('05_success');
    const store = await p.evaluate(() => localStorage.getItem('slicepay:v1:orders') || '');
    ck('orders store: no full ID, no card data', store.includes('********345') && !store.includes('01001012345') && !store.includes('4242'));
    await vis('[data-action="orders"]').click(); await sleep(300);

    /* ---------------- my orders ---------------- */
    ck('success -> my orders', (await hash()) === '#/orders');
    let cards = await p.$$eval('.ord-card', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    ck('orders: new order present, მუშავდება (v4 first status), 605 / 101 x 6', cards.length === 1 && cards[0].includes('#' + o.id) && cards[0].includes('მუშავდება') && cards[0].includes('სულ 605₾ · 101₾ × 6 თვე'), cards);
    await vis('.ord-card__link[data-order="' + o.id + '"]').click(); await sleep(300);
    ck('orders: detail of new order', (await hash()) === '#/orders/' + o.id);
    let d = await mainText();
    ck('orders: masked ID + recipient + courier', d.includes('პირადი ნომერი: ********345') && d.includes('მიმღები: ტესტ მომხმარებელი') && d.includes('კურიერით: თბილისი'), d.slice(0, 300));
    ck('orders: schedule 6 instalments', (await p.$$('.ord-sched__row')).length === 6);
    ck('orders: no full ID on page', !(await p.content()).includes('01001012345'));
    await shot('06_new_order_detail');

    /* ---------------- demo orders ---------------- */
    await p.evaluate(() => { location.hash = '#/orders?demo=1'; }); await sleep(400);
    cards = await p.$$eval('.ord-card', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
    ck('demo orders: #731954 (350₾ due) and #548210', cards.length === 2 && cards[0].includes('#731954') && cards[0].includes('გადასახდელია: 350₾') && cards[1].includes('#548210'), cards);
    await vis('.ord-card__link[data-order="731954"]').click(); await sleep(300);
    ck('open #731954', (await hash()) === '#/orders/731954');
    d = await mainText();
    ck('#731954: due rows and total 350₾', d.includes('ფაქტობრივი 112₾') && d.includes('ფაქტობრივი 238₾') && d.includes('გადასახდელი: 350₾'));
    await vis('[data-action="pay"]').click(); await sleep(300);
    ck('#731954 -> #/pay?order=731954', (await hash()) === '#/pay?order=731954');
    ck('order pay: "გადასახდელი: 350₾"', (await txt('.paycard__due-amt')) === 'გადასახდელი: 350₾');
    await shot('07_pay_order');
    await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '12/30'); await p.fill('#cc-cvv', '123');
    await p.click('#card-submit');
    ck('order pay -> back on detail', (await waitHash(/^#\/orders\/731954$/, 6000)) === '#/orders/731954');
    await sleep(300);
    ck('order pay: toast "გადახდა წარმატებით შესრულდა"', (await toast()).includes('გადახდა წარმატებით შესრულდა'), await toast());
    d = await mainText();
    ck('#731954: rows გადახდილია, no pay button, next status', (d.match(/გადახდილია/g) || []).length >= 2 && !(await p.$('[data-action="pay"]')) && (await txt('.ord-top .status-pill')) === 'მზადაა გასატანად', [await txt('.ord-top .status-pill')]);
    await shot('08_order_paid');
    // browser back from the detail must not land on the paid order's card form again
    await p.goBack(); await sleep(400);
    ck('order paid: browser Back does not reopen the card form', !(await hash()).startsWith('#/pay'), await hash());

    /* ---------------- logout / login next ---------------- */
    await p.evaluate(() => { location.hash = '#/orders'; }); await sleep(300);
    // v4: logout lives on #/profile; the orders heading link is პროფილი
    // v4f: desktop uses the header link (the heading-row link is mobile-only)
    const PROF = w >= 900 ? '.d-head .acct-link--profile' : '.ord-top__out';
    ck('orders პროფილი link reads პროფილი', (await txt(PROF)) === 'პროფილი', await txt(PROF));
    await vis(PROF).click(); await sleep(300);
    ck('პროფილი -> #/profile', (await hash()) === '#/profile', await hash());
    await vis('[data-action="logout"]').click(); await sleep(300);
    ck('logout -> landing + toast', (await hash()) === '#/' && (await toast()).includes('თქვენ გამოხვედით სისტემიდან') && !(await st()).userPhone);
    ck('landing link says შესვლა', (await txt('.landing__acct')).includes('შესვლა'));
    await vis('.landing__acct a, .landing__acct button').click(); await sleep(300);
    ck('შესვლა -> #/login?next=/orders', (await hash()) === '#/login?next=/orders', await hash());
    await p.fill('#log-phone', phone); await p.fill('#log-pass', 'wrongpass1');
    await p.click('#auth-submit'); await sleep(150);
    ck('login: wrong password error', (await txt('#log-pass-err')).length > 0 && (await hash()).startsWith('#/login'));
    await p.fill('#log-pass', 'password1'); await p.click('#auth-submit');
    ck('login -> next /orders', (await waitHash(/^#\/orders$/)) === '#/orders');
    await sleep(300);
    cards = await p.$$eval('.ord-card', els => els.map(e => e.innerText));
    ck('login: own order still listed', cards.length === 1 && cards[0].includes('#' + o.id), cards.length);
    await p.evaluate(() => { location.hash = '#/'; }); await sleep(300);
    ck('landing link says ჩემი შეკვეთები', (await txt('.landing__acct')).includes('ჩემი შეკვეთები'));
    // a second order by the signed-in user: landing -> cart -> next goes straight to delivery
    await p.fill('#url', 'https://www.ebay.com/itm/Vintage-Camera-Lens/1234'); await p.press('#url', 'Enter');
    ck('2nd order: landing -> cart', (await waitHash(/^#\/cart$/, 7000)) === '#/cart');
    await sleep(300);
    ck('2nd order: ebay ETA window (12-20 days)', await p.evaluate(() => { const e = SlicePay.eta(); return (new Date(e.to) - new Date(e.from)) / 864e5 === 8; }));
    await vis('[data-action="next"]').click(); await sleep(300);
    ck('2nd order: signed-in cart next -> delivery', (await hash()) === '#/delivery');
    if (w >= 900) {
      ck('desktop header account link on delivery', (await txt('.d-head .acct-link--orders')).includes('ჩემი შეკვეთები'));
      await p.click('.d-head .acct-link--orders'); await sleep(300);
      ck('header link -> #/orders', (await hash()) === '#/orders');
      await vis('.d-head [data-back]').click(); await sleep(300);
      ck('orders back -> previous (delivery)', (await hash()) === '#/delivery', await hash());
    }
    await p.selectOption('#d-branch', 'batumi');
    await p.fill('#d-first', 'ა'); await p.fill('#d-last', 'ბ'); await p.fill('#d-pid', '12345678901');
    await p.click('#dlv-submit'); await waitHash(/^#\/payment$/); await sleep(300);
    t = await p.evaluate(() => SlicePay.totals());
    ck('2nd order: pickup Batumi fee 0, term back to default 4', t.delivery === 0 && t.term === 4, t);

    /* ---------------- guards (fresh session, direct URLs) ---------------- */
    const g = await ctx.newPage();
    g.on('pageerror', e => errs.push('guard: ' + String(e)));
    g.on('console', mm => { if (mm.type() === 'error' || mm.type() === 'warning') errs.push('guard ' + mm.type() + ': ' + mm.text()); });
    const go = async (hsh) => { await g.goto('about:blank'); await g.evaluate(() => { try { sessionStorage.clear(); } catch (e) {} }); await g.goto(BASE + hsh); await sleep(250); return g.evaluate(() => location.hash); };
    // signed-out, empty session (localStorage still has accounts and orders; no remembered phone)
    await g.goto(BASE); await g.evaluate(() => { localStorage.removeItem('slicepay:v1:remember'); Object.keys(localStorage).filter(k => /remember/i.test(k)).forEach(k => localStorage.removeItem(k)); });
    const G = [
      ['#/delivery', '#/'], ['#/payment', '#/'], ['#/pay', '#/'], ['#/success', '#/'],
      ['#/orders', '#/login?next=/orders'], ['#/orders/731954', '#/login?next=/orders/731954'],
      ['#/register/verify', '#/register'], ['#/recover/code', '#/recover'],
    ];
    for (const [from, to] of G) { const got = await go(from); ck('guard ' + from + ' -> ' + to, got === to, got); }
    const pg = await go('#/pay?order=731954');
    ck('guard #/pay?order (signed out) -> login with next', pg.startsWith('#/login?next=') && decodeURIComponent(pg).includes('/pay?order=731954'), pg);
    // products + auth, delivery not done -> /delivery
    await go('#/delivery?demo=1');
    await g.evaluate(() => { location.hash = '#/payment'; }); await sleep(250);
    ck('guard #/payment without delivery -> #/delivery', (await g.evaluate(() => location.hash)) === '#/delivery');
    await g.evaluate(() => { location.hash = '#/pay'; }); await sleep(250);
    ck('guard #/pay without delivery -> #/delivery', (await g.evaluate(() => location.hash)) === '#/delivery');
    await g.evaluate(() => { location.hash = '#/orders/999999'; }); await sleep(250);
    ck('guard unknown order -> #/orders', (await g.evaluate(() => location.hash)) === '#/orders');
    await g.evaluate(() => { location.hash = '#/pay?order=548210'; }); await sleep(250);
    ck('guard #/pay?order with nothing due -> detail', (await g.evaluate(() => location.hash)) === '#/orders/548210');
    // signed in, cart empty: login target = /orders
    ck('afterLoginTarget: no next + empty cart -> /orders', await g.evaluate(() => { SlicePay.state().products.length = 0; return SlicePay.afterLoginTarget({}) === '/orders' && SlicePay.afterLoginTarget({ next: 'https://evil.example' }) === '/orders'; }));
    await g.close();

    await ctx.close();
  }
  fs.writeFileSync(OUT + '/e2e_console_errors.json', JSON.stringify(errors, null, 1));
  console.log('console', JSON.stringify(errors));
  console.log(passes + ' passed, ' + fails + ' failed');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });

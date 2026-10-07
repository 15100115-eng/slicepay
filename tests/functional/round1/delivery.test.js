// ported from scratchpad tools/v2f_dlv.js
// Delivery screen: copy, personal ID validation, method switching, fee, ETA (with faked dates), persistence, keyboard
const L = require('../../lib/harness');
const BR = ['ვაკის ფილიალი — ჭავჭავაძის გამზ. 37, თბილისი', 'საბურთალოს ფილიალი — პეკინის გამზ. 12, თბილისი', 'გლდანის ფილიალი — ხიზანიშვილის ქ. 5, თბილისი', 'ბათუმის ფილიალი — რუსთაველის ქ. 15, ბათუმი', 'ქუთაისის ფილიალი — წერეთლის ქ. 8, ქუთაისი'];
const CITIES = ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'თელავი', 'ფოთი'];
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('dlv ' + W);
    let { ctx, p } = await L.newCtx(b, W, errs, { clock: new Date('2026-10-06T12:00:00') });
    await p.goto(L.BASE + '#/delivery?demo=1'); await L.sleep(400);
    const copy = await p.evaluate(() => ({
      h1: document.querySelector('h1').textContent,
      secs: [...document.querySelectorAll('.dlv__sec-h')].map(e => e.textContent),
      labels: [...document.querySelectorAll('#app label.field__label')].map(e => e.textContent),
      note: document.getElementById('d-pid-err').textContent,
      cards: [...document.querySelectorAll('.rcard')].map(e => e.innerText.replace(/\s+/g, ' ').trim()),
      // v3 reconcile: titles are Mtavruli glyphs (aria-hidden) + an sr-only Mkhedruli twin, as on the payment method cards
      cardsVis: [...document.querySelectorAll('.rcard')].map(e => [...e.querySelectorAll('.rcard__title, .rcard__sub')].map(x => { const c = x.cloneNode(true); c.querySelectorAll('.sr-only').forEach(y => y.remove()); return c.textContent.trim(); }).join(' ')),
      cardsAx: [...document.querySelectorAll('.rcard')].map(e => [...e.querySelectorAll('.rcard__title, .rcard__sub')].map(x => { const c = x.cloneNode(true); c.querySelectorAll('[aria-hidden="true"]').forEach(y => y.remove()); return c.textContent.trim(); }).join(' ')),
      branchOpts: [...document.querySelectorAll('#d-branch option')].map(o => o.textContent),
      cityOpts: [...document.querySelectorAll('#d-city option')].map(o => o.textContent),
      addrPh: document.getElementById('d-addr').placeholder,
      eta: document.querySelector('.eta-box').innerText.replace(/\s+/g, ' ').trim(),
      pidIn: { im: document.getElementById('d-pid').inputMode, type: document.getElementById('d-pid').type },
      etaBg: getComputedStyle(document.querySelector('.eta-box')).backgroundColor,
      etaR: getComputedStyle(document.querySelector('.eta-box')).borderRadius,
      icoColor: getComputedStyle(document.querySelector('.eta-box__ico')).color,
    }));
    lg.check('heading მიწოდება', copy.h1 === 'მიწოდება', copy.h1);
    lg.check('section labels', copy.secs.join('|') === 'მიმღები|მიწოდების მეთოდი', copy.secs);
    lg.check('field labels', ['სახელი', 'გვარი', 'პირადი ნომერი', 'აირჩიეთ ფილიალი', 'ქალაქი', 'მისამართი'].every(x => copy.labels.includes(x)) && copy.labels.some(x => x.startsWith('ბინა, სართული, კომენტარი')), copy.labels);
    lg.check('orange note copy', copy.note === '*პირადი ნომერი საჭიროა ამანათის განბაჟებისთვის', copy.note);
    // v3 reconcile: method titles are drawn in Mtavruli (delivery fixer, matching the payment radio cards); the copy is
    // checked as what is seen (Mtavruli + sub) and what is announced (Mkhedruli twin, verbatim spec copy)
    lg.check('radio cards copy (visible Mtavruli title + sub)', copy.cardsVis[0] === 'ᲤᲘᲚᲘᲐᲚᲘᲓᲐᲜ ᲒᲐᲢᲐᲜᲐ უფასო' && copy.cardsVis[1] === 'ᲙᲣᲠᲘᲔᲠᲘᲗ ᲛᲘᲢᲐᲜᲐ თბილისში 5₾ · რეგიონებში 10₾', copy.cardsVis);
    lg.check('radio cards copy (accessible text verbatim)', copy.cardsAx[0] === 'ფილიალიდან გატანა უფასო' && copy.cardsAx[1] === 'კურიერით მიტანა თბილისში 5₾ · რეგიონებში 10₾', copy.cardsAx);
    lg.check('branch options exact', JSON.stringify(copy.branchOpts.slice(1)) === JSON.stringify(BR), copy.branchOpts);
    lg.check('city options exact', JSON.stringify(copy.cityOpts.slice(1)) === JSON.stringify(CITIES), copy.cityOpts);
    lg.check('address placeholder', copy.addrPh === 'ქუჩა, სახლის ნომერი', copy.addrPh);
    lg.check('ETA box copy (06 Oct, amazon pickup: 15–20 ოქტომბერი)', copy.eta === 'ამანათის სავარაუდო მიღება: 15–20 ოქტომბერი ვადა შეიძლება შეიცვალოს საბაჟო პროცედურების გამო', copy.eta);
    lg.check('ETA box #f3efff radius 8, icon #5e34ec', copy.etaBg === 'rgb(243, 239, 255)' && copy.etaR === '8px' && copy.icoColor === 'rgb(94, 52, 236)', [copy.etaBg, copy.etaR, copy.icoColor]);
    lg.check('PID input numeric', copy.pidIn.im === 'numeric', copy.pidIn);
    if (W < 900) {
      const bar = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(x => x.getClientRects().length).map(x => x.innerText.trim()));
      lg.check('mobile bar ᲣᲙᲐᲜ + ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ', bar.length === 2 && bar[0].includes('ᲣᲙᲐᲜ') && bar[1].includes('ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ'), bar);
    } else {
      // v4: the signed-in header shows პროფილი · ჩემი შეკვეთები
      lg.check('desktop header back + account links', (await L.txt(p, '.d-head .back')) === 'უკან დაბრუნება' && (await L.txt(p, '.d-head .acct-link--orders')) === 'ჩემი შეკვეთები' && (await L.txt(p, '.d-head .acct-link--profile')) === 'პროფილი');
    }
    lg.check('prefill names from profile, pickup, ვაკე', (await p.inputValue('#d-first')) === 'გიორგი' && (await p.inputValue('#d-last')) === 'ბერიძე' && (await p.inputValue('#d-branch')) === 'vake' && await p.isChecked('#dmethod-pickup'));

    /* ---- personal ID ---- */
    const noteH0 = await p.evaluate(() => document.getElementById('d-pid-err').getBoundingClientRect().height);
    const pidCase = async (name, act, expectVal) => {
      await p.fill('#d-pid', '');
      await act();
      await L.sleep(30);
      const v = await p.inputValue('#d-pid');
      lg.check('PID ' + name + ' -> "' + expectVal + '"', v === expectVal, v);
      return v;
    };
    await pidCase('10 digits typed', () => p.type('#d-pid', '0100101234'), '0100101234');
    await p.click('#dlv-submit'); await L.sleep(100);
    lg.check('PID 10 digits -> error copy, stays', (await L.tc(p, '#d-pid-err')) === 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან' && (await L.H(p)).startsWith('#/delivery'));
    lg.check('PID error: aria-invalid + focus', (await p.getAttribute('#d-pid', 'aria-invalid')) === 'true' && (await L.active(p)) === 'd-pid');
    const noteH1 = await p.evaluate(() => document.getElementById('d-pid-err').getBoundingClientRect().height);
    lg.check('PID error replaces the note without height change', noteH0 === noteH1, [noteH0, noteH1]);
    await pidCase('12 digits typed (clamped)', () => p.type('#d-pid', '010010123456'), '01001012345');
    await pidCase('letters typed', () => p.type('#d-pid', 'abcdeF'), '');
    await pidCase('mixed typed', () => p.type('#d-pid', '0a1b0'), '010');
    const paste = async (txt) => p.evaluate(t => { const i = document.getElementById('d-pid'); i.focus(); document.execCommand('insertText', false, t); }, txt);
    await pidCase('paste "010 0101 2345"', () => paste('010 0101 2345'), '01001012345');
    // v3 reconcile: a 12-digit paste is no longer silently cut at 11 (delivery fixer v2 r1): every digit is kept and flagged
    await pidCase('paste "0100 1012 3456" (12 digits w/ spaces, kept)', () => paste('0100 1012 3456'), '010010123456');
    lg.check('PID 12-digit paste flagged at once (error in the note, aria-invalid)', (await L.tc(p, '#d-pid-err')) === 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან' && (await p.getAttribute('#d-pid', 'aria-invalid')) === 'true', [await L.tc(p, '#d-pid-err'), await p.getAttribute('#d-pid', 'aria-invalid')]);
    await pidCase('paste "ID: 01001012345"', () => paste('ID: 01001012345'), '01001012345');
    await pidCase('paste "٠١٠٠١٠١٢٣٤٥" (arabic-indic digits)', () => paste('٠١٠٠١٠١٢٣٤٥'), '');
    // blur validation with a partial ID
    await p.fill('#d-pid', '12345'); await p.focus('#d-first'); await L.sleep(50);
    lg.check('partial ID: error on blur', (await L.tc(p, '#d-pid-err')) === 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან');
    await p.fill('#d-pid', '12345678901'); await L.sleep(30);
    lg.check('editing restores the orange note', (await L.tc(p, '#d-pid-err')) === '*პირადი ნომერი საჭიროა ამანათის განბაჟებისთვის' && !(await p.getAttribute('#d-pid', 'aria-invalid')));
    // 12-digit paste into a FULL field (caret at end) – should not replace digits silently
    await p.fill('#d-pid', '01001012345'); await p.focus('#d-pid'); await p.keyboard.press('End'); await p.keyboard.type('9'); await L.sleep(30);
    lg.check('extra digit at end of a full ID is dropped', (await p.inputValue('#d-pid')) === '01001012345', await p.inputValue('#d-pid'));
    await p.focus('#d-pid'); await p.keyboard.press('Home'); await p.keyboard.type('9'); await L.sleep(30);
    lg.info('typing a digit at the START of a full ID gives', await p.inputValue('#d-pid'));

    /* ---- names ---- */
    await p.fill('#d-first', ''); await p.fill('#d-last', '   '); await p.fill('#d-pid', '');
    await p.click('#dlv-submit'); await L.sleep(100);
    const e1 = await p.evaluate(() => ['d-first', 'd-last'].map(id => document.getElementById(id + '-err').textContent).concat([document.getElementById('d-pid-err').textContent, document.activeElement.id]));
    lg.check('empty names / spaces-only last -> errors, focus first', e1[0] === 'შეიყვანეთ სახელი' && e1[1] === 'შეიყვანეთ გვარი' && e1[2] === 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან' && e1[3] === 'd-first', e1);
    await L.shot(p, 'dlv_errors_' + W);
    // XSS-ish name
    await p.fill('#d-first', '<img src=x onerror=window.__x=1>'); await p.fill('#d-last', 'ბერიძე"&'); await p.fill('#d-pid', '01001012345');

    /* ---- method switching, fee, ETA ---- */
    await p.click('.rcard[data-value="courier"]'); await L.sleep(100);
    lg.check('courier: panel shown, ETA unchanged until a city (or +1?)', await p.isVisible('#d-city') && await p.isVisible('#d-addr') && await p.isVisible('#d-note') && !(await p.isVisible('#d-branch')));
    lg.info('courier w/o city ETA', await L.tc(p, '#d-eta'));
    await p.click('#dlv-submit'); await L.sleep(100);
    const e2 = await p.evaluate(() => [document.getElementById('d-city-err').textContent, document.getElementById('d-addr-err').textContent, document.activeElement.id]);
    lg.check('courier errors city/address, focus city', e2[0] === 'აირჩიეთ ქალაქი' && e2[1] === 'შეიყვანეთ მისამართი' && e2[2] === 'd-city', e2);
    await p.click('.rcard[data-value="pickup"]'); await L.sleep(100);
    lg.check('back to pickup hides courier errors', !(await p.isVisible('#d-city')) && await p.isVisible('#d-branch'));
    await p.click('.rcard[data-value="courier"]'); await L.sleep(100);
    lg.check('courier again: old errors cleared', !(await L.tc(p, '#d-city-err')) && !(await L.tc(p, '#d-addr-err')), [await L.tc(p, '#d-city-err'), await L.tc(p, '#d-addr-err')]);
    await p.selectOption('#d-city', 'თბილისი'); await L.sleep(50);
    lg.check('courier Tbilisi ETA 16–21 ოქტომბერი (+1)', (await L.tc(p, '#d-eta')) === '16–21 ოქტომბერი', await L.tc(p, '#d-eta'));
    await p.selectOption('#d-city', 'ფოთი'); await L.sleep(50);
    lg.check('courier region ETA 17–22 ოქტომბერი (+2)', (await L.tc(p, '#d-eta')) === '17–22 ოქტომბერი', await L.tc(p, '#d-eta'));
    await p.fill('#d-addr', 'რუსთაველის 1'); await p.fill('#d-note', 'ბინა 3 <b>');
    await p.click('#dlv-submit');
    lg.check('valid courier Poti -> payment', (await L.waitHash(p, /^#\/payment/)) === '#/payment');
    await L.sleep(250);
    let t = await L.totals(p);
    lg.check('Poti fee 10 -> total 610, monthly 153', t.delivery === 10 && t.total === 610 && t.monthly === 153, t);
    lg.check('payment ETA = 17–22 ოქტომბერი', (await L.tc(p, '#pay-eta')) === 'სავარაუდო მიღება: 17–22 ოქტომბერი', await L.tc(p, '#pay-eta'));
    lg.check('no injected img executed', !(await p.evaluate(() => window.__x)));
    // back to delivery -> values kept
    await L.vis(p, '[data-back="/delivery"]').click(); await L.sleep(300);
    const kept = await p.evaluate(() => ({ m: document.querySelector('input[name=dmethod]:checked').value, c: document.getElementById('d-city').value, a: document.getElementById('d-addr').value, n: document.getElementById('d-note').value, pid: document.getElementById('d-pid').value, f: document.getElementById('d-first').value }));
    lg.check('back to delivery keeps all values', kept.m === 'courier' && kept.c === 'ფოთი' && kept.a === 'რუსთაველის 1' && kept.n === 'ბინა 3 <b>' && kept.pid === '01001012345' && kept.f.startsWith('<img'), kept);
    // switch to pickup and go back to payment
    await p.click('.rcard[data-value="pickup"]'); await L.sleep(80);
    lg.check('pickup ETA back to 15–20', (await L.tc(p, '#d-eta')) === '15–20 ოქტომბერი', await L.tc(p, '#d-eta'));
    await p.selectOption('#d-branch', 'kutaisi');
    lg.check('branch address line follows', (await L.tc(p, '#d-branch-addr')) === 'წერეთლის ქ. 8, ქუთაისი', await L.tc(p, '#d-branch-addr'));
    // browser Back to payment WITHOUT pressing continue (step reopened by the edit)
    await p.goForward(); await L.sleep(300);
    lg.info('forward after editing delivery ->', await L.H(p), JSON.stringify(await L.totals(p)));
    lg.check('forward to payment after an edit is guarded back to delivery', (await L.H(p)) === '#/delivery', await L.H(p));
    if ((await L.H(p)) !== '#/delivery') await L.go(p, '#/delivery');
    await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(250);
    t = await L.totals(p);
    lg.check('pickup Kutaisi fee 0 -> total 600, no fee row', t.delivery === 0 && t.total === 600, t);
    await L.vis(p, '#pay-toggle').click(); await L.sleep(300);
    lg.check('payment breakdown has no მიწოდების ფასი row when 0', !(await p.innerText('#pay-bd')).includes('მიწოდების'));
    // cart reflects the fee after delivery is done: go to cart
    await L.go(p, '#/delivery');
    await p.click('.rcard[data-value="courier"]'); await p.selectOption('#d-city', 'თბილისი'); await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(200);
    await L.go(p, '#/cart'); await L.sleep(200);
    const cartSum = await L.txt(p, '.cart-sum__total');
    lg.info('cart after courier Tbilisi delivery done:', cartSum, JSON.stringify(await L.totals(p)));
    lg.check('cart ETA follows chosen delivery (courier Tbilisi 16–21)', (await L.tc(p, '#cart-eta')) === 'სავარაუდო მიღება: 16–21 ოქტომბერი', await L.tc(p, '#cart-eta'));
    // persistence: reload delivery keeps draft (session) and ID is never in localStorage
    await L.go(p, '#/delivery'); await p.fill('#d-pid', '98765432109'); await p.reload(); await L.sleep(400);
    lg.check('reload keeps draft ID (session)', (await p.inputValue('#d-pid')) === '98765432109');
    lg.check('ID not in localStorage', await p.evaluate(() => !JSON.stringify(Object.assign({}, localStorage)).includes('98765432109')));
    lg.check('no overflow', await L.noOverflow(p));
    // keyboard: arrow keys on method radios
    await p.focus('#dmethod-courier'); await p.keyboard.press('ArrowUp'); await L.sleep(80);
    lg.check('ArrowUp on courier selects pickup', await p.isChecked('#dmethod-pickup') && await p.isVisible('#d-branch') && (await L.active(p)) === 'dmethod-pickup', await L.active(p));
    const ring = await p.evaluate(() => { const c = document.querySelector('.rcard[data-value="pickup"]'); const cs = getComputedStyle(c); const cs2 = getComputedStyle(c, '::after'); return [cs.outlineStyle, cs.outlineWidth, cs.boxShadow, cs2.boxShadow, cs2.outlineStyle].join(' | '); });
    lg.info('focus ring on keyboard-focused radio card:', ring);
    await p.keyboard.press('ArrowDown'); await L.sleep(80);
    lg.check('ArrowDown selects courier', await p.isChecked('#dmethod-courier'));
    // Enter in a text field submits
    await p.selectOption('#d-city', 'ბათუმი'); await p.fill('#d-addr', 'გორგასლის 2');
    await p.focus('#d-addr'); await p.keyboard.press('Enter');
    lg.check('Enter submits the form', (await L.waitHash(p, /^#\/payment/)) === '#/payment');
    await L.sleep(200);
    t = await L.totals(p);
    lg.check('Batumi courier fee 10', t.delivery === 10 && t.total === 610, t);
    await ctx.close();

    /* ---- ETA formatting with faked dates ---- */
    const etaAt = async (date, setup) => {
      const c = await L.newCtx(b, W, errs, { clock: new Date(date + 'T10:00:00') });
      await c.p.goto(L.BASE + '#/delivery?demo=1'); await L.sleep(300);
      if (setup) await setup(c.p);
      const r = await L.tc(c.p, '#d-eta');
      await c.ctx.close();
      return r;
    };
    const cases = [
      ['2026-10-20', null, '29 ოქტომბერი – 3 ნოემბერი', 'amazon pickup cross-month'],
      ['2026-10-20', async q => { await q.click('.rcard[data-value="courier"]'); await q.selectOption('#d-city', 'თბილისი'); }, '30 ოქტომბერი – 4 ნოემბერი', 'courier Tbilisi cross-month'],
      ['2026-10-20', async q => { await q.click('.rcard[data-value="courier"]'); await q.selectOption('#d-city', 'გორი'); }, '31 ოქტომბერი – 5 ნოემბერი', 'courier Gori cross-month'],
      ['2026-12-20', null, '29 დეკემბერი – 3 იანვარი', 'cross-year'],
      ['2026-12-25', null, '3–8 იანვარი', 'next-year same month'],
      ['2027-02-15', null, '24 თებერვალი – 1 მარტი', 'February (non-leap)'],
      ['2028-02-15', null, '24–29 თებერვალი', 'February leap year'],
      ['2026-10-17', null, '26–31 ოქტომბერი', 'ends on 31st'],
    ];
    for (const [d, setup, exp, name] of cases) {
      const got = await etaAt(d, setup);
      lg.check('ETA ' + name + ' (' + d + ') = ' + exp, got === exp, got);
    }
    // multi-store cart (amazon + ebay) on 2026-10-20 pickup -> 9..20 days -> 29 Oct – 9 Nov
    {
      const c = await L.newCtx(b, W, errs, { clock: new Date('2026-10-20T10:00:00') });
      await c.p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(300);
      await L.cartAdd(c.p, 'https://www.ebay.com/itm/Vintage-Camera-Lens/1234567');
      const prods = (await L.st(c.p)).products.map(x => x.store);
      const cartEta = await L.tc(c.p, '#cart-eta');
      lg.check('multi-store cart ' + prods.join('+') + ' ETA 29 ოქტომბერი – 9 ნოემბერი (widest window)', cartEta === 'სავარაუდო მიღება: 29 ოქტომბერი – 9 ნოემბერი', cartEta);
      // remove the ebay product -> ETA shrinks
      const ebayId = (await L.st(c.p)).products.find(x => x.store === 'ebay').id;
      await L.vis(c.p, '#rm-' + ebayId).click(); await L.sleep(400);
      lg.check('removing the ebay item shrinks the cart ETA', (await L.tc(c.p, '#cart-eta')) === 'სავარაუდო მიღება: 29 ოქტომბერი – 3 ნოემბერი', await L.tc(c.p, '#cart-eta'));
      await c.ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

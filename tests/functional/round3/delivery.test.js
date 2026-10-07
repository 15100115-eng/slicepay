// ported from scratchpad tools/v2r3_dlv.js
// v2 functional QA round 3 — delivery step: personal ID validation, names, branch / courier, fee + ETA
const L = require('../../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
const note = p => p.evaluate(() => { const e = document.getElementById('d-pid-err'); const c = getComputedStyle(e); return { t: e.textContent, err: e.classList.contains('is-error'), color: c.color, inv: document.getElementById('d-pid').getAttribute('aria-invalid') }; });
const errOf = (p, id) => p.evaluate(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent : null; }, id);
const PIDMSG = 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან';
const NOTE = '*პირადი ნომერი საჭიროა ამანათის განბაჟებისთვის';
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('dlv ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    const paste = async (txt, clear = true) => {
      if (clear) await p.fill('#d-pid', '');
      await p.focus('#d-pid');
      await p.evaluate(t => navigator.clipboard.writeText(t), txt);
      await p.keyboard.press('Meta+V'); await L.sleep(60);
      return p.inputValue('#d-pid');
    };
    try {
      await p.goto(L.BASE + '#/delivery?demo=1'); await L.sleep(300);
      // copy / structure
      const t = await L.appText(p);
      for (const s of ['მიწოდება', 'მიმღები', 'მიწოდების მეთოდი', 'ფილიალიდან გატანა', 'უფასო', 'კურიერით მიტანა', 'თბილისში 5₾ · რეგიონებში 10₾', NOTE, 'ამანათის სავარაუდო მიღება: 16–21 ოქტომბერი', 'ვადა შეიძლება შეიცვალოს საბაჟო პროცედურების გამო'])
        lg.check('copy present: ' + s, t.includes(s) || (await p.evaluate(x => document.getElementById('app').textContent.includes(x), s)), s);
      const labels = await p.evaluate(() => ['d-first', 'd-last', 'd-pid', 'd-branch'].map(i => { const l = document.querySelector('label[for="' + i + '"]'); return l && l.textContent; }));
      lg.check('labels სახელი/გვარი/პირადი ნომერი/აირჩიეთ ფილიალი', JSON.stringify(labels) === JSON.stringify(['სახელი', 'გვარი', 'პირადი ნომერი', 'აირჩიეთ ფილიალი']), labels);
      const opts = await p.evaluate(() => [...document.querySelectorAll('#d-branch option')].filter(o => o.value).map(o => o.textContent));
      lg.check('5 branch options verbatim', JSON.stringify(opts) === JSON.stringify(['ვაკის ფილიალი — ჭავჭავაძის გამზ. 37, თბილისი', 'საბურთალოს ფილიალი — პეკინის გამზ. 12, თბილისი', 'გლდანის ფილიალი — ხიზანიშვილის ქ. 5, თბილისი', 'ბათუმის ფილიალი — რუსთაველის ქ. 15, ბათუმი', 'ქუთაისის ფილიალი — წერეთლის ქ. 8, ქუთაისი']), opts);
      lg.check('default pickup + ვაკე', (await p.inputValue('#d-branch')) === 'vake' && (await p.isChecked('input[name="dmethod"][value="pickup"]')));
      lg.check('names prefilled, ID empty', (await p.inputValue('#d-first')) === 'გიორგი' && (await p.inputValue('#d-last')) === 'ბერიძე' && (await p.inputValue('#d-pid')) === '');
      const pidAttrs = await p.evaluate(() => { const i = document.getElementById('d-pid'); return { im: i.inputMode, type: i.type }; });
      lg.check('ID input numeric', pidAttrs.im === 'numeric', pidAttrs);
      const n0 = await note(p);
      const regNoteColor = await (async () => { const pp = await ctx.newPage(); await pp.goto(L.BASE + '#/register'); await L.sleep(200); const c = await pp.evaluate(() => getComputedStyle(document.getElementById('reg-phone-err')).color); await pp.close(); return c; })();
      lg.check('ID note orange like the phone note', n0.t === NOTE && n0.color === regNoteColor, { n0, regNoteColor });

      // --- personal ID ---
      await p.fill('#d-pid', '0100101234'); await p.locator('#d-first').focus(); await L.sleep(60);
      let n = await note(p);
      lg.check('10 digits + blur -> error replaces the note', n.t === PIDMSG && n.err && n.inv === 'true', n);
      await p.fill('#d-pid', '01001012345'); await L.sleep(60);
      n = await note(p);
      lg.check('11 digits -> note back, no error', n.t === NOTE && !n.err && n.inv === null, n);
      await p.focus('#d-pid'); await p.press('#d-pid', 'End'); await p.keyboard.type('6'); await L.sleep(60);
      lg.check('typing a 12th digit is refused', (await p.inputValue('#d-pid')) === '01001012345', await p.inputValue('#d-pid'));
      await p.fill('#d-pid', ''); await p.keyboard.type('01a0b0-1 0123x45'); await L.sleep(60);
      lg.check('letters / dash / space typed are dropped', (await p.inputValue('#d-pid')) === '01001012345', await p.inputValue('#d-pid'));
      let v = await paste('010 0101 2345');
      lg.check('paste "010 0101 2345" -> 01001012345', v === '01001012345', v);
      v = await paste('010-010-123-45');
      lg.check('paste "010-010-123-45" -> 01001012345', v === '01001012345', v);
      v = await paste('ID: 01001012345.');
      lg.check('paste "ID: 01001012345." -> 01001012345', v === '01001012345', v);
      v = await paste('0100 1012 3456');
      n = await note(p);
      lg.check('paste 12 digits w/ spaces -> kept 12 and flagged at once', v === '010010123456' && n.t === PIDMSG, { v, n });
      v = await paste('abc');
      lg.check('paste letters only -> empty', v === '', v);
      v = await paste('٠١٠٠١٠١٢٣٤٥');
      lg.info('paste Arabic-Indic digits ->', JSON.stringify(v));
      // paste into the middle
      await p.fill('#d-pid', '0100145'); await p.focus('#d-pid');
      await p.evaluate(() => document.getElementById('d-pid').setSelectionRange(5, 5));
      v = await paste('01 23', false);
      const caret = await p.evaluate(() => document.getElementById('d-pid').selectionStart);
      lg.check('paste "01 23" in the middle -> 01001012345, caret after pasted digits (9)', v === '01001012345' && caret === 9, { v, caret });
      // submit with 10 digits
      await p.fill('#d-pid', '0100101234');
      await p.click('#dlv-submit'); await L.sleep(150);
      lg.check('submit with 10 digits: stays, focus on ID, error', /^#\/delivery/.test(await L.H(p)) && (await L.active(p)) === 'd-pid' && (await note(p)).t === PIDMSG, { h: await L.H(p), a: await L.active(p) });
      await p.fill('#d-pid', '010010123456');
      await p.click('#dlv-submit'); await L.sleep(150);
      lg.check('submit with 12 digits: stays, error', /^#\/delivery/.test(await L.H(p)) && (await note(p)).t === PIDMSG);
      // empty names
      await p.fill('#d-first', '   '); await p.fill('#d-last', ''); await p.fill('#d-pid', '');
      await p.click('#dlv-submit'); await L.sleep(150);
      const e3 = [await errOf(p, 'd-first'), await errOf(p, 'd-last'), (await note(p)).t];
      lg.check('empty names + ID -> შეიყვანეთ სახელი / შეიყვანეთ გვარი / ID error; focus first', JSON.stringify(e3) === JSON.stringify(['შეიყვანეთ სახელი', 'შეიყვანეთ გვარი', PIDMSG]) && (await L.active(p)) === 'd-first', { e3, a: await L.active(p) });
      await L.shot(p, 'dlv_errors_' + W);
      await p.fill('#d-first', '  ლაშა '); await p.fill('#d-last', 'ბერიძე'); await p.fill('#d-pid', '12345678901');

      // --- courier ---
      await p.click('.rcard[data-value="courier"]'); await L.sleep(120);
      lg.check('courier: city/address/note shown, branch hidden', await p.isVisible('#d-city') && await p.isVisible('#d-addr') && await p.isVisible('#d-note') && !(await p.isVisible('#d-branch')));
      const cities = await p.evaluate(() => [...document.querySelectorAll('#d-city option')].filter(o => o.value).map(o => o.value));
      lg.check('8 cities in spec order', JSON.stringify(cities) === JSON.stringify(['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'თელავი', 'ფოთი']), cities);
      const addrPh = await p.evaluate(() => { const i = document.getElementById('d-addr'); const l = document.querySelector('label[for="d-addr"]'); const nl = document.querySelector('label[for="d-note"]'); const cl = document.querySelector('label[for="d-city"]'); return [i.placeholder, l && l.textContent, nl && nl.textContent, cl && cl.textContent]; });
      lg.info('address placeholder / labels', addrPh);
      lg.check('address hint ქუჩა, სახლის ნომერი; note label ბინა, სართული, კომენტარი; city label ქალაქი', addrPh[0] === 'ქუჩა, სახლის ნომერი' && /^მისამართი/.test(addrPh[1]) && /ბინა, სართული, კომენტარი/.test(addrPh[2]) && addrPh[3] === 'ქალაქი', addrPh);
      lg.check('courier, no city: ETA covers Tbilisi+regions (17–23 ოქტომბერი)', (await L.tc(p, '#d-eta')) === '17–23 ოქტომბერი', await L.tc(p, '#d-eta'));
      await p.click('#dlv-submit'); await L.sleep(150);
      lg.check('courier submit empty -> აირჩიეთ ქალაქი / შეიყვანეთ მისამართი, focus city', (await errOf(p, 'd-city')) === 'აირჩიეთ ქალაქი' && (await errOf(p, 'd-addr')) === 'შეიყვანეთ მისამართი' && (await L.active(p)) === 'd-city', { c: await errOf(p, 'd-city'), a: await errOf(p, 'd-addr'), act: await L.active(p) });
      await p.selectOption('#d-city', 'თბილისი'); await L.sleep(60);
      lg.check('city chosen clears its error; Tbilisi ETA 17–22 ოქტომბერი', (await errOf(p, 'd-city')) === '' && (await L.tc(p, '#d-eta')) === '17–22 ოქტომბერი', await L.tc(p, '#d-eta'));
      await p.selectOption('#d-city', 'ბათუმი'); await L.sleep(60);
      lg.check('region ETA 18–23 ოქტომბერი', (await L.tc(p, '#d-eta')) === '18–23 ოქტომბერი', await L.tc(p, '#d-eta'));
      await p.fill('#d-addr', '   '); await p.click('#dlv-submit'); await L.sleep(100);
      lg.check('whitespace address -> შეიყვანეთ მისამართი', (await errOf(p, 'd-addr')) === 'შეიყვანეთ მისამართი');
      await p.fill('#d-addr', 'გორგილაძის ქ. 10'); await p.fill('#d-note', 'ბ. 4, სართ. 2');
      await p.click('#dlv-submit');
      lg.check('valid courier Batumi -> #/payment', (await L.waitHash(p, /^#\/payment/)) === '#/payment');
      await L.sleep(200);
      let s = await L.st(p);
      lg.check('state.delivery saved (trimmed names, pid, courier, city, address, note, done)', s.delivery.first === 'ლაშა' && s.delivery.pid === '12345678901' && s.delivery.method === 'courier' && s.delivery.city === 'ბათუმი' && s.delivery.address === 'გორგილაძის ქ. 10' && s.delivery.note === 'ბ. 4, სართ. 2' && s.delivery.done, s.delivery);
      let tt = await L.totals(p);
      lg.check('Batumi courier fee 10 -> 610, monthly 153', tt.delivery === 10 && tt.total === 610 && tt.monthly === 153, tt);
      const pay = await L.appText(p);
      lg.check('payment shows 610₾, 153₾, მიწოდების ფასი 10 ₾ row (details)', /610₾/.test(pay) && /153₾/.test(pay), pay.slice(0, 300));
      await L.vis(p, '#pay-toggle').click(); await L.sleep(300);
      const bdRows = await p.evaluate(() => [...document.querySelectorAll('#pay-bd .bd__row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
      lg.check('payment breakdown has მიწოდების ფასი 10 ₾ and ჯამი 610 ₾', bdRows.some(r => /მიწოდების ფასი/.test(r) && /10 ₾/.test(r)) && bdRows.some(r => /ჯამი/.test(r) && /610 ₾/.test(r)), bdRows);
      lg.check('payment ETA 18–23 ოქტომბერი', (await L.txt(p, '#pay-eta .eta-line__v')) === '18–23 ოქტომბერი', await L.txt(p, '#pay-eta'));
      // back to delivery keeps everything; switch to pickup -> fee 0
      await L.vis(p, '[data-back="/delivery"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
      lg.check('payment back -> delivery keeps courier Batumi + address', (await p.isChecked('input[name="dmethod"][value="courier"]')) && (await p.inputValue('#d-city')) === 'ბათუმი' && (await p.inputValue('#d-addr')) === 'გორგილაძის ქ. 10' && (await p.inputValue('#d-pid')) === '12345678901');
      await p.click('.rcard[data-value="pickup"]'); await L.sleep(60);
      lg.check('switch to pickup -> step not done until confirmed', (await L.st(p)).delivery.done === false);
      lg.check('pickup ETA back to 16–21 ოქტომბერი', (await L.tc(p, '#d-eta')) === '16–21 ოქტომბერი', await L.tc(p, '#d-eta'));
      await p.selectOption('#d-branch', 'batumi'); await L.sleep(60);
      const ba = await p.evaluate(() => document.getElementById('d-branch-addr').textContent);
      lg.check('branch address line follows the select', ba === 'რუსთაველის ქ. 15, ბათუმი', ba);
      lg.check('pickup at Batumi branch ETA unchanged 16–21 ოქტომბერი', (await L.tc(p, '#d-eta')) === '16–21 ოქტომბერი', await L.tc(p, '#d-eta'));
      // payment via Forward while not done -> guard to delivery
      await p.goForward(); await L.sleep(500);
      lg.check('Forward to payment while step re-opened -> back on delivery', /^#\/delivery/.test(await L.H(p)), await L.H(p));
      await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(150);
      tt = await L.totals(p);
      lg.check('pickup -> fee 0, total 600, 150', tt.delivery === 0 && tt.total === 600 && tt.monthly === 150, tt);
      s = await L.st(p);
      lg.check('pickup saved: branchId batumi', s.delivery.method === 'pickup' && s.delivery.branchId === 'batumi');
      // branch error: an invalid stored branch
      await p.evaluate(() => { const d = SlicePay.state().delivery; d.branchId = 'nope'; d.done = false; SlicePay.save(); });
      await L.go(p, '#/delivery'); await L.sleep(200);
      await p.click('#dlv-submit'); await L.sleep(150);
      lg.check('no branch chosen -> აირჩიეთ ფილიალი', (await errOf(p, 'd-branch')) === 'აირჩიეთ ფილიალი', await errOf(p, 'd-branch'));
      // err=1 QA
      await p.goto(L.BASE + '#/delivery?demo=1&delivery=courier&err=1'); await L.sleep(300);
      const errs1 = [await errOf(p, 'd-city'), await errOf(p, 'd-addr'), (await note(p)).t];
      lg.check('?demo=1&delivery=courier&err=1 shows city/address/ID errors', JSON.stringify(errs1) === JSON.stringify(['აირჩიეთ ქალაქი', 'შეიყვანეთ მისამართი', PIDMSG]), errs1);
      await L.shot(p, 'dlv_courier_err_' + W);
      // escaping
      await p.fill('#d-first', '<img src=x onerror=window.__x=1>'); await p.fill('#d-last', '"><b>'); await p.fill('#d-pid', '01001012345');
      await p.selectOption('#d-city', 'თბილისი'); await p.fill('#d-addr', '<svg onload=window.__y=1>'); await p.fill('#d-note', '</p><i>n</i>');
      await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/);
      await L.go(p, '#/delivery'); await L.sleep(200);
      lg.check('escaped values round-trip into the form', (await p.inputValue('#d-addr')) === '<svg onload=window.__y=1>' && !(await p.evaluate(() => window.__x || window.__y)));
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    await ctx.close();

    /* ---------- the ID is never persisted unmasked ---------- */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/delivery?demo=1'); await L.sleep(250);
        await p.fill('#d-pid', '98765432101');
        await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/);
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
        await L.payCard(p); await L.sleep(300);
        const ls = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
        const ss = await p.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)));
        lg.check('localStorage has no unmasked ID', !ls.includes('98765432101') && !ls.includes('9876543210'), null);
        lg.check('localStorage has the masked ID ********101', ls.includes('********101'));
        lg.check('localStorage holds no card data', !/4242|12\/30|"cvv"|cc-/.test(ls));
        lg.info('sessionStorage has the raw ID (session-only, allowed):', ss.includes('98765432101'));
        lg.check('sessionStorage holds no card data', !/4242424242|"12 \/ 30"/.test(ss));
        await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
        const ss2 = await p.evaluate(() => JSON.stringify(Object.assign({}, sessionStorage)));
        lg.check('after logout no raw ID in sessionStorage', !ss2.includes('98765432101'), ss2.slice(0, 200));
      } catch (e) { lg.check('privacy script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

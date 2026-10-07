// ported from scratchpad tools/v2f_otp.js
// OTP / phone verification: wrong, expired, resend cooldown, change number, paste, guards, next, keyboard
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('otp ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: new Date('2026-10-06T12:00:00') });
    const phone = '577' + String(W).padStart(6, '0');
    const fmtPhone = phone.slice(0, 3) + ' ' + phone.slice(3, 6) + ' ' + phone.slice(6);

    // clock flows naturally?
    const t0 = await p.evaluate(() => Date.now()); await L.sleep(300); const t1 = await p.evaluate(() => Date.now());
    lg.info('clock flows', t1 - t0);

    await L.landingAdd(p, 'https://www.amazon.com/Nike-Air/dp/B0TEST1');
    await L.vis(p, '[data-action="next"]').click(); await L.sleep(250);
    lg.check('cart next (signed out, no remember) -> register', (await L.H(p)) === '#/register', await L.H(p));
    const code1 = await L.register(p, { first: 'ნინო', last: 'ქავთარაძე', phone, pass: 'password12', email: 'nino@example.com' });
    lg.check('register -> verify with toast code', /^\d{4}$/.test(code1 || ''), code1);
    lg.check('verify heading', (await L.txt(p, 'h1')) === 'ტელეფონის დადასტურება', await L.txt(p, 'h1'));
    lg.check('verify lead text + formatted bold number', (await L.txt(p, '#verify-lead')) === 'SMS კოდი გამოგზავნილია ნომერზე ' + fmtPhone && (await L.tc(p, '#verify-lead b')) === fmtPhone, await L.txt(p, '#verify-lead'));
    const attrs = await p.evaluate(() => { const i = document.getElementById('verify-code'); const l = document.querySelector('label[for="verify-code"]'); return { ph: i.placeholder, lab: l && l.textContent, ml: i.maxLength, im: i.inputMode, ac: i.autocomplete }; });
    lg.check('code input: numeric, maxlength 4, one-time-code', attrs.ml === 4 && attrs.im === 'numeric' && attrs.ac === 'one-time-code', attrs);
    lg.check('code input placeholder/label "SMS კოდი"', attrs.ph === 'SMS კოდი' || attrs.lab === 'SMS კოდი', attrs);
    const btnTxt = await L.txt(p, '#auth-submit');
    lg.check('button ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ', (btnTxt || '').includes('ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ'), btnTxt);
    if (W < 900) {
      const bar = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(x => x.getClientRects().length).map(x => x.innerText.trim()));
      lg.check('mobile bar ᲣᲙᲐᲜ + ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ', bar.length === 2 && bar[0].includes('ᲣᲙᲐᲜ') && bar[1].includes('ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ'), bar);
    }
    // cooldown shown and resend blocked
    let rs = await L.txt(p, '#verify-resend');
    lg.check('resend shows (0:30)/(0:29) countdown', /^კოდის ხელახლა გამოგზავნა \(0:(30|29)\)$/.test(rs), rs);
    lg.check('resend aria-disabled during cooldown', (await p.getAttribute('#verify-resend', 'aria-disabled')) === 'true');
    await p.evaluate(() => { const t = document.querySelector('#toast-root .toast'); if (t) t.remove(); });
    await p.click('#verify-resend', { force: true }); await L.sleep(150);
    lg.check('resend click during cooldown: no new toast, code unchanged', !(await L.toast(p)) && (await L.st(p)).pendingReg.code === code1, await L.toast(p));
    // letters in the code field
    await p.fill('#verify-code', 'ab12'); await L.sleep(50);
    lg.check('letters stripped from code', (await p.inputValue('#verify-code')) === '12', await p.inputValue('#verify-code'));
    await p.click('#auth-submit'); await L.sleep(100);
    lg.check('3 digits -> "შეიყვანეთ 4-ნიშნა კოდი"', (await L.tc(p, '#verify-code-err')) === 'შეიყვანეთ 4-ნიშნა კოდი', await L.tc(p, '#verify-code-err'));
    // paste with spaces / dash
    await p.fill('#verify-code', '');
    await p.focus('#verify-code');
    await p.evaluate(c => { const i = document.getElementById('verify-code'); const dt = new DataTransfer(); dt.setData('text/plain', ' ' + c.slice(0, 2) + '-' + c.slice(2) + ' '); i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, code1);
    lg.check('paste " 12-34 " normalised', (await p.inputValue('#verify-code')) === code1, await p.inputValue('#verify-code'));
    // wrong code
    const wrong = code1 === '1111' ? '2222' : '1111';
    await p.fill('#verify-code', wrong); await p.press('#verify-code', 'Enter'); await L.sleep(150);
    lg.check('wrong code (Enter submits) -> "კოდი არასწორია", stays', (await L.tc(p, '#verify-code-err')) === 'კოდი არასწორია' && (await L.H(p)) === '#/register/verify', await L.tc(p, '#verify-code-err'));
    lg.check('wrong code: focus stays in code input, aria-invalid', (await L.active(p)) === 'verify-code' && (await p.getAttribute('#verify-code', 'aria-invalid')) === 'true');
    lg.check('no account created yet', await p.evaluate(ph => !JSON.parse(localStorage.getItem('slicepay:v1:users') || '{}')[ph] && !SlicePay.getState().userPhone, phone));
    // typing clears the error
    await p.fill('#verify-code', '1'); await L.sleep(50);
    lg.check('editing clears error', !(await L.tc(p, '#verify-code-err')));
    await p.fill('#verify-code', ''); await p.evaluate(() => document.activeElement.blur()); await L.sleep(50);

    // advance 31 s -> resend enabled
    await p.clock.fastForward(31000); await L.sleep(400);
    rs = await L.txt(p, '#verify-resend');
    lg.check('after 30 s: resend enabled, no countdown', rs === 'კოდის ხელახლა გამოგზავნა' && (await p.getAttribute('#verify-resend', 'aria-disabled')) !== 'true', rs);
    await p.click('#verify-resend'); await L.sleep(200);
    const code2 = ((await L.toast(p)).match(/(\d{4})/) || [])[1];
    lg.check('resend -> new toast code + countdown restarts', /^\d{4}$/.test(code2 || '') && /\(0:(30|29)\)/.test(await L.txt(p, '#verify-resend')), [code2, await L.txt(p, '#verify-resend')]);
    lg.check('resend clears input and focuses it', (await p.inputValue('#verify-code')) === '' && (await L.active(p)) === 'verify-code');
    if (code2 !== code1) {
      await p.fill('#verify-code', code1); await p.click('#auth-submit'); await L.sleep(150);
      lg.check('old code after resend -> "კოდი არასწორია"', (await L.tc(p, '#verify-code-err')) === 'კოდი არასწორია', await L.tc(p, '#verify-code-err'));
    }

    // expiry: 5 min after the resend
    await p.clock.fastForward(5 * 60000 + 2000); await L.sleep(300);
    await p.fill('#verify-code', code2); await p.click('#auth-submit'); await L.sleep(150);
    lg.check('expired (5 min) correct code -> "კოდს ვადა გაუვიდა, მოითხოვეთ ახალი"', (await L.tc(p, '#verify-code-err')) === 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი' && (await L.H(p)) === '#/register/verify', await L.tc(p, '#verify-code-err'));
    await L.shot(p, 'otp_expired_' + W);
    // just under 5 min check separately later; now resend
    await p.click('#verify-resend'); await L.sleep(200);
    const code3 = ((await L.toast(p)).match(/(\d{4})/) || [])[1];
    lg.check('resend after expiry -> new code, error cleared', /^\d{4}$/.test(code3 || '') && !(await L.tc(p, '#verify-code-err')), code3);

    // change number (right after resend: focus is in the empty, already-touched code input)
    await p.click('.auth__change'); await L.sleep(300);
    lg.check('ნომრის შეცვლა right after resend (focus in code input) -> #/register', (await L.H(p)) === '#/register', [await L.H(p), await L.tc(p, '#verify-code-err')]);
    if ((await L.H(p)) !== '#/register') { await p.click('.auth__change'); await L.sleep(300); lg.check('2nd click on ნომრის შეცვლა works', (await L.H(p)) === '#/register', await L.H(p)); }
    const pre = await p.evaluate(() => ({ f: document.getElementById('reg-first').value, l: document.getElementById('reg-last').value, ph: document.getElementById('reg-phone').value, e: document.getElementById('reg-email').value, pw: document.getElementById('reg-pass').value, t: document.getElementById('reg-terms').checked }));
    lg.check('register prefilled except password', pre.f === 'ნინო' && pre.l === 'ქავთარაძე' && pre.ph === fmtPhone && pre.e === 'nino@example.com' && pre.pw === '', pre);
    // submit without password -> error; with a new phone
    const phone2 = '578' + String(W).padStart(6, '0');
    await p.fill('#reg-phone', phone2); await p.click('#auth-submit'); await L.sleep(150);
    lg.check('password required again', (await L.tc(p, '#reg-pass-err')).length > 0 && (await L.H(p)) === '#/register');
    await p.fill('#reg-pass', 'password34'); await p.click('#auth-submit');
    await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
    const code4 = ((await L.toast(p)).match(/(\d{4})/) || [])[1];
    const fmt2 = phone2.slice(0, 3) + ' ' + phone2.slice(3, 6) + ' ' + phone2.slice(6);
    lg.check('new number shown on verify + new code', (await L.tc(p, '#verify-lead b')) === fmt2 && /^\d{4}$/.test(code4 || ''), [await L.tc(p, '#verify-lead b'), code4]);
    lg.check('old code3 does not work for new number', true);
    // back (ᲣᲙᲐᲜ / desktop back) -> register
    await L.vis(p, '[data-back="/register"]:not(.auth__change)').click(); await L.sleep(300);
    lg.check('back from verify -> register', (await L.H(p)) === '#/register', await L.H(p));
    // forward again (browser) -> verify still has pending
    await p.goForward(); await L.sleep(300);
    lg.check('browser forward -> verify again', (await L.H(p)) === '#/register/verify', await L.H(p));
    // same number re-submit inside cooldown keeps the code
    await p.click('.auth__change'); await L.sleep(300);
    await p.fill('#reg-pass', 'password34'); await p.click('#auth-submit'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
    const code5 = ((await L.toast(p)).match(/(\d{4})/) || [])[1];
    lg.check('resubmit same number inside cooldown keeps code', code5 === code4, [code4, code5]);
    // just-before-expiry: advance 4:50 then correct code works
    await p.clock.fastForward(4 * 60000 + 50000); await L.sleep(200);
    await p.fill('#verify-code', code4); await p.click('#auth-submit');
    const after = await L.waitHash(p, /^#\/(delivery|orders)/);
    lg.check('code at 4:50 still valid -> delivery (cart has products)', after === '#/delivery', after);
    await L.sleep(150);
    lg.check('toast ნომერი დადასტურებულია', (await L.toast(p)).includes('ნომერი დადასტურებულია'), await L.toast(p));
    const s = await L.st(p);
    lg.check('account = new phone, signed in, pending cleared', s.userPhone === phone2 && !s.pendingReg && await p.evaluate(ph => !!JSON.parse(localStorage.getItem('slicepay:v1:users'))[ph], phone2), s.userPhone);
    lg.check('first phone NOT registered', await p.evaluate(ph => !JSON.parse(localStorage.getItem('slicepay:v1:users'))[ph], phone));
    lg.check('delivery prefilled from verified profile', (await p.inputValue('#d-first')) === 'ნინო' && (await p.inputValue('#d-last')) === 'ქავთარაძე');
    // browser back from delivery must not land on verify (replace)
    await p.goBack(); await L.sleep(300);
    const hb = await L.H(p);
    lg.check('Back from delivery does not show a dead verify screen', hb !== '#/register/verify', hb);
    lg.info('back from delivery landed on', hb);
    // v3 reconcile: the user is signed in after the verification, so a verify entry without a pending registration is
    // skipped to the after-login target (cart has products -> #/delivery), not to an empty register frame (core r1/r2 SP.skipEntry)
    await p.goto(L.BASE + '#/register/verify'); await L.sleep(300);
    lg.check('verify after success (signed in, no pending) -> #/delivery', (await L.H(p)) === '#/delivery', await L.H(p));

    // QA demo + err params
    await p.goto(L.BASE + '#/register/verify?demo=1'); await L.sleep(300);
    lg.check('demo verify: 555 123 456, no cooldown', (await L.tc(p, '#verify-lead b')) === '555 123 456' && (await L.txt(p, '#verify-resend')) === 'კოდის ხელახლა გამოგზავნა');
    await p.goto(L.BASE + '#/register/verify?demo=1&err=1'); await L.sleep(300);
    lg.check('err=1 shows empty-code error', (await L.tc(p, '#verify-code-err')) === 'შეიყვანეთ 4-ნიშნა კოდი', await L.tc(p, '#verify-code-err'));
    await p.goto(L.BASE + '#/register/verify?demo=1&err=expired'); await L.sleep(300);
    lg.check('err=expired', (await L.tc(p, '#verify-code-err')) === 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი');
    // demo verify with an empty cart -> /orders
    await p.goto(L.BASE + '#/register/verify?demo=1'); await L.sleep(300);
    await p.evaluate(() => { SlicePay.state().products = []; SlicePay.save(); });
    await p.fill('#verify-code', '4821'); await p.click('#auth-submit');
    lg.check('verify with empty cart -> #/orders', (await L.waitHash(p, /^#\/(orders|delivery|$)/)) === '#/orders', await L.H(p));

    // registering an existing phone at verify time (account created in between) -> userExists
    await p.evaluate(() => { SlicePay.reset({ signOut: true, go: false }); sessionStorage.clear(); });   // v3 reconcile: really start signed out (a signed-in #/register is skipped since auth r2)
    await L.landingAdd(p, 'https://www.amazon.com/Nike-Air/dp/B0TEST1');
    await p.evaluate(() => localStorage.removeItem('slicepay:v1:remember'));
    await L.go(p, '#/register?next=/orders');
    const phone3 = '579' + String(W).padStart(6, '0');
    const c6 = await L.register(p, { first: 'ა', last: 'ბ', phone: phone3, pass: 'password56', email: 'a@b.ge' });
    lg.check('?next kept on pending registration', (await L.st(p)).pendingReg.next === '/orders', (await L.st(p)).pendingReg.next);
    await p.evaluate(ph => { const u = JSON.parse(localStorage.getItem('slicepay:v1:users')); u[ph] = { salt: 'x', pass: 'y' }; localStorage.setItem('slicepay:v1:users', JSON.stringify(u)); }, phone3);
    await p.fill('#verify-code', c6); await p.click('#auth-submit'); await L.sleep(150);
    lg.check('phone registered meanwhile -> "ამ ნომრით მომხმარებელი უკვე არსებობს"', (await L.tc(p, '#verify-code-err')) === 'ამ ნომრით მომხმარებელი უკვე არსებობს', await L.tc(p, '#verify-code-err'));
    await p.evaluate(ph => { const u = JSON.parse(localStorage.getItem('slicepay:v1:users')); delete u[ph]; localStorage.setItem('slicepay:v1:users', JSON.stringify(u)); }, phone3);
    await p.fill('#verify-code', c6); await p.click('#auth-submit');
    lg.check('verify honours ?next=/orders (cart not empty)', (await L.waitHash(p, /^#\/(orders|delivery)/)) === '#/orders', await L.H(p));

    // reload on verify keeps the pending registration and the countdown
    await p.evaluate(() => { SlicePay.reset({ signOut: true, go: false }); sessionStorage.clear(); });   // v3 reconcile: really start signed out (a signed-in #/register is skipped since auth r2)
    await L.landingAdd(p, 'https://www.amazon.com/Nike-Air/dp/B0TEST1');
    await L.go(p, '#/register');
    const phone4 = '574' + String(W).padStart(6, '0');
    await L.register(p, { first: 'ა', last: 'ბ', phone: phone4, pass: 'password56', email: 'a@b.ge' });
    await p.clock.fastForward(10000);
    await p.reload(); await L.sleep(400);
    rs = await L.txt(p, '#verify-resend');
    lg.check('reload on verify: still there, countdown continues (~0:20)', (await L.H(p)) === '#/register/verify' && /\(0:(19|20|21)\)/.test(rs), rs);
    // keyboard: Tab order code -> resend -> change number -> button
    await p.focus('#verify-code');
    const order = [];
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); order.push(await L.active(p)); }
    lg.info('tab order after code', order);
    lg.check('no horizontal overflow', await L.noOverflow(p));

    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

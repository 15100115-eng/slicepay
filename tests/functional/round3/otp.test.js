// ported from scratchpad tools/v2r3_otp.js
// v2 functional QA round 3 — phone verification (OTP): wrong / expired / resend cooldown / change number / paste / targets
const L = require('../../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
const visTxt = (p, sel) => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
const errOf = (p, id) => p.evaluate(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent : null; }, id);
const users = p => p.evaluate(() => JSON.parse(localStorage.getItem('slicepay:v1:users') || '{}'));
async function fillReg(p, u) {
  await p.fill('#reg-first', u.first); await p.fill('#reg-last', u.last);
  await p.fill('#reg-phone', u.phone); await p.fill('#reg-pass', u.pass); await p.fill('#reg-email', u.email);
  if (!(await p.isChecked('#reg-terms'))) await p.click('#reg-terms', { force: true });
}
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('otp ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    try {
      await L.landingAdd(p, 'https://www.amazon.com/Sony-WH1000XM5/dp/B09XS7JWHH');
      await L.vis(p, '[data-action="next"]').click();
      lg.check('cart next (signed out, not remembered) -> #/register', /^#\/register$/.test(await L.waitHash(p, /^#\/register/)));
      const U = { first: 'ნინო', last: 'კაპანაძე', phone: '599 11 22 33', pass: 'secret123', email: 'nino@example.com' };
      await fillReg(p, U);
      await p.click('#auth-submit');
      lg.check('register submit -> #/register/verify', /^#\/register\/verify$/.test(await L.waitHash(p, /^#\/register\/verify/)));
      await L.sleep(150);
      const t1 = await L.toast(p);
      const code1 = (t1.match(/(\d{4})/) || [])[1];
      lg.check('toast "სატესტო კოდი: NNNN"', /^სატესტო კოდი: \d{4}$/.test(t1.trim()), t1);
      lg.check('no account created before verification', !(await users(p))['599112233']);
      const s0 = await L.st(p);
      lg.check('not signed in while pending', s0.userPhone === null, s0.userPhone);
      lg.check('pendingReg has no plain password', s0.pendingReg && !JSON.stringify(s0.pendingReg).includes(U.pass));
      // screen copy
      const h = await visTxt(p, 'h1'); lg.check('heading ტელეფონის დადასტურება', h === 'ტელეფონის დადასტურება', h);
      const lead = await visTxt(p, '#verify-lead');
      lg.check('lead "SMS კოდი გამოგზავნილია ნომერზე 599 112 233"', lead === 'SMS კოდი გამოგზავნილია ნომერზე 599 112 233', lead);
      const bold = await p.evaluate(() => { const b = document.querySelector('#verify-lead b'); return b ? [b.textContent, getComputedStyle(b).fontWeight, getComputedStyle(b).color] : null; });
      lg.check('number is black / semibold', bold && bold[0] === '599 112 233' && +bold[1] >= 600 && bold[2] === 'rgb(0, 0, 0)', bold);
      const leadCol = await p.evaluate(() => { const e = document.getElementById('verify-lead'); const c = getComputedStyle(e); return [c.color, c.fontSize]; });
      lg.check('lead 14px #666', leadCol[0] === 'rgb(102, 102, 102)' && leadCol[1] === '14px', leadCol);
      const inp = await p.evaluate(() => { const i = document.getElementById('verify-code'); const lab = document.querySelector('label[for="verify-code"]'); return { im: i.inputMode, ml: i.maxLength, ac: i.autocomplete, lab: lab && lab.textContent, ph: i.placeholder }; });
      lg.check('input: SMS კოდი, numeric, maxlength 4, one-time-code', inp.lab === 'SMS კოდი' && inp.im === 'numeric' && inp.ml === 4 && inp.ac === 'one-time-code', inp);
      const btnTxt = await p.evaluate(() => [...document.querySelectorAll('#auth-submit .btn__label, [data-back]')].filter(e => e.getClientRects().length).map(e => (e.querySelector('[aria-hidden]') || e).textContent.trim()));
      lg.info('visible buttons', btnTxt);
      lg.check('confirm button ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ', btnTxt.some(t => /ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ/.test(t)), btnTxt);
      if (W < 900) lg.check('mobile bar ᲣᲙᲐᲜ', btnTxt.some(t => /ᲣᲙᲐᲜ/.test(t)), btnTxt);
      const rs = await p.evaluate(() => { const r = document.getElementById('verify-resend'); return [r.textContent, r.getAttribute('aria-disabled')]; });
      lg.check('resend shows (0:30)/(0:29) countdown + aria-disabled', /კოდის ხელახლა გამოგზავნა \(0:(30|29)\)/.test(rs[0]) && rs[1] === 'true', rs);
      const chg = await visTxt(p, '.auth__change'); lg.check('link ნომრის შეცვლა', chg === 'ნომრის შეცვლა', chg);

      // empty / short / letters
      await p.click('#auth-submit'); await L.sleep(100);
      lg.check('empty -> შეიყვანეთ 4-ნიშნა კოდი', (await errOf(p, 'verify-code')) === 'შეიყვანეთ 4-ნიშნა კოდი', await errOf(p, 'verify-code'));
      await p.fill('#verify-code', '12'); await p.click('#auth-submit'); await L.sleep(100);
      lg.check('2 digits -> შეიყვანეთ 4-ნიშნა კოდი', (await errOf(p, 'verify-code')) === 'შეიყვანეთ 4-ნიშნა კოდი');
      await p.fill('#verify-code', ''); await p.type('#verify-code', 'ab1c2');
      lg.check('letters are dropped while typing', (await p.inputValue('#verify-code')) === '12', await p.inputValue('#verify-code'));
      await p.fill('#verify-code', '');
      await p.focus('#verify-code');
      await p.evaluate(t => navigator.clipboard.writeText(t), ' ' + code1.slice(0, 2) + '-' + code1.slice(2) + ' ');
      await p.keyboard.press('Meta+V'); await L.sleep(50);
      lg.check('paste " 12-34 " -> 4 digits', (await p.inputValue('#verify-code')) === code1, await p.inputValue('#verify-code'));
      // wrong code
      const wrong = code1 === '1111' ? '2222' : '1111';
      await p.fill('#verify-code', wrong); await p.click('#auth-submit'); await L.sleep(150);
      lg.check('wrong code -> კოდი არასწორია', (await errOf(p, 'verify-code')) === 'კოდი არასწორია', await errOf(p, 'verify-code'));
      lg.check('wrong code: still on verify, not signed in, no account', /verify/.test(await L.H(p)) && (await L.st(p)).userPhone === null && !(await users(p))['599112233']);
      // resend during cooldown: nothing
      await p.click('#verify-resend', { force: true }); await L.sleep(150);
      lg.check('resend during cooldown: same pending code', (await L.st(p)).pendingReg.code === code1);
      // 31 s later
      await p.clock.fastForward(31000); await L.sleep(400);
      const rs2 = await p.evaluate(() => { const r = document.getElementById('verify-resend'); return [r.textContent, r.getAttribute('aria-disabled')]; });
      lg.check('after 30 s: resend enabled, no countdown', rs2[0] === 'კოდის ხელახლა გამოგზავნა' && rs2[1] === null, rs2);
      await p.click('#verify-resend'); await L.sleep(200);
      const t2 = await L.toast(p); const code2 = (t2.match(/(\d{4})/) || [])[1];
      const s2 = await L.st(p);
      lg.check('resend: new toast code = pending code', code2 && s2.pendingReg.code === code2, { t2, pc: s2.pendingReg.code });
      lg.check('resend: field cleared, error cleared, focus in field', (await p.inputValue('#verify-code')) === '' && (await errOf(p, 'verify-code')) === '' && (await L.active(p)) === 'verify-code', { v: await p.inputValue('#verify-code'), e: await errOf(p, 'verify-code'), a: await L.active(p) });
      const rs3 = await p.evaluate(() => document.getElementById('verify-resend').textContent);
      lg.check('resend: cooldown restarts (0:30)/(0:29)', /\(0:(30|29)\)/.test(rs3), rs3);
      if (code2 !== code1) {
        await p.fill('#verify-code', code1); await p.click('#auth-submit'); await L.sleep(150);
        lg.check('old code after resend -> კოდი არასწორია', (await errOf(p, 'verify-code')) === 'კოდი არასწორია', await errOf(p, 'verify-code'));
      }
      // countdown ticks
      await p.clock.fastForward(10000); await L.sleep(400);
      const rs4 = await p.evaluate(() => document.getElementById('verify-resend').textContent);
      lg.check('countdown ticks down (~0:20)', /\(0:(20|19|21)\)/.test(rs4), rs4);
      // expiry: 5 min after the resend
      await p.clock.fastForward(5 * 60000); await L.sleep(300);
      await p.fill('#verify-code', code2); await p.click('#auth-submit'); await L.sleep(150);
      lg.check('expired (5 min) -> კოდს ვადა გაუვიდა, მოითხოვეთ ახალი', (await errOf(p, 'verify-code')) === 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი', await errOf(p, 'verify-code'));
      await L.shot(p, 'otp_expired_' + W);
      // editing clears the server error
      await p.fill('#verify-code', '123'); await L.sleep(50);
      lg.check('editing clears the expired error', (await errOf(p, 'verify-code')) === '', await errOf(p, 'verify-code'));
      // new code after expiry
      await p.click('#verify-resend'); await L.sleep(200);
      const code3 = (await L.st(p)).pendingReg.code;
      await p.fill('#verify-code', code3);
      await p.press('#verify-code', 'Enter');
      const hAfter = await L.waitHash(p, /^#\/delivery/);
      lg.check('correct code (Enter) -> #/delivery', hAfter === '#/delivery', hAfter);
      await L.sleep(150);
      lg.check('toast ნომერი დადასტურებულია', /ნომერი დადასტურებულია/.test(await L.toast(p)), await L.toast(p));
      const s3 = await L.st(p);
      lg.check('signed in + account created + pending cleared', s3.userPhone === '599112233' && !!(await users(p))['599112233'] && s3.pendingReg === null, { u: s3.userPhone, pr: s3.pendingReg });
      lg.check('delivery prefilled from registration names', (await p.inputValue('#d-first')) === 'ნინო' && (await p.inputValue('#d-last')) === 'კაპანაძე');
      const usr = (await users(p))['599112233'];
      // v4 (V4_SPEC §B): the record keeps the account's own profile (names / e-mail); never the plain password
      lg.check('users store holds the own profile (names / e-mail), no plain password', usr && usr.first === 'ნინო' && usr.last === 'კაპანაძე' && usr.email === 'nino@example.com' && !JSON.stringify(usr).includes('secret123'), usr);
      // Back from delivery must not land on verify
      await p.goBack(); await L.sleep(700);
      const hb = await L.H(p);
      lg.check('browser Back from delivery skips verify/register (-> cart)', hb === '#/cart', hb);
    } catch (e) { lg.check('flow A script error', false, String(e).slice(0, 400)); }
    await ctx.close();

    /* ---------- B: change number ---------- */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await L.landingAdd(p, 'https://www.amazon.com/Kindle-Paperwhite/dp/B08KTZ8249');
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/register/);
        await fillReg(p, { first: 'ლევანი', last: 'გელაშვილი', phone: '577 000 111', pass: 'parol1234', email: 'lg@example.com' });
        await p.click('#auth-submit'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
        const codeA = (await L.st(p)).pendingReg.code;
        await p.click('.auth__change'); await L.waitHash(p, /^#\/register$/); await L.sleep(250);
        const vals = await p.evaluate(() => ['reg-first', 'reg-last', 'reg-phone', 'reg-pass', 'reg-email'].map(i => document.getElementById(i).value).concat([document.getElementById('reg-terms').checked]));
        lg.check('ნომრის შეცვლა -> register keeps first/last/phone/email (not password), terms checked', JSON.stringify(vals) === JSON.stringify(['ლევანი', 'გელაშვილი', '577 000 111', '', 'lg@example.com', true]), vals);
        lg.check('code toast dropped after leaving verify', !/სატესტო/.test(await L.toast(p)), await L.toast(p));
        await p.fill('#reg-phone', '577 000 222'); await p.fill('#reg-pass', 'parol1234');
        await p.click('#auth-submit'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
        const st = await L.st(p);
        const lead = await visTxt(p, '#verify-lead');
        lg.check('verify shows the new number 577 000 222', /577 000 222$/.test(lead), lead);
        lg.check('pending phone = new number', st.pendingReg.phone === '577000222');
        const rsB = await p.evaluate(() => document.getElementById('verify-resend').textContent);
        lg.info('resend after number change', rsB);
        // back to the old number within 30 s: same code (per-phone cooldown)
        await p.click('.auth__change'); await L.waitHash(p, /^#\/register$/); await L.sleep(200);
        await p.fill('#reg-phone', '577 000 111'); await p.fill('#reg-pass', 'parol1234');
        await p.click('#auth-submit'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
        lg.check('old number again within 30 s keeps its code', (await L.st(p)).pendingReg.code === codeA);
        // verify with the new number's code? switch back to 222
        await p.click('.auth__change'); await L.waitHash(p, /^#\/register$/); await L.sleep(200);
        await p.fill('#reg-phone', '577 000 222'); await p.fill('#reg-pass', 'parol1234');
        await p.click('#auth-submit'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
        const codeB = (await L.st(p)).pendingReg.code;
        await p.fill('#verify-code', codeB); await p.click('#auth-submit');
        lg.check('verify new number -> delivery', (await L.waitHash(p, /^#\/delivery/)) === '#/delivery');
        const us = await users(p);
        lg.check('only the new number has an account', !!us['577000222'] && !us['577000111'], Object.keys(us));
        // history: Back -> cart
        await p.goBack(); await L.sleep(700);
        lg.info('Back after change-number flow ->', await L.H(p));
      } catch (e) { lg.check('flow B script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }

    /* ---------- C: verify targets: empty cart -> /orders, next param ---------- */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/'); await L.sleep(250);
        await L.vis(p, '.acct-link').click();
        lg.check('landing შესვლა -> #/login?next=/orders', (await L.waitHash(p, /^#\/login/)) === '#/login?next=/orders', await L.H(p));
        await p.click('a[href^="#/register"]'); await L.sleep(250);
        lg.check('login -> register keeps next', (await L.H(p)) === '#/register?next=/orders', await L.H(p));
        await fillReg(p, { first: 'ანა', last: 'ბერი', phone: '568 123 123', pass: 'parol1234', email: 'ana@example.com' });
        await p.click('#auth-submit'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(150);
        await p.fill('#verify-code', (await L.st(p)).pendingReg.code); await p.click('#auth-submit');
        lg.check('verify with next=/orders and empty cart -> #/orders', (await L.waitHash(p, /^#\/orders/)) === '#/orders', await L.H(p));
        await L.sleep(200);
        lg.check('new user: empty orders state', /ჯერ არ გაქვთ შეკვეთები/.test(await L.appText(p)));
        // signed in: verify route redirects
        await L.go(p, '#/register/verify'); await L.sleep(400);
        lg.check('signed in: #/register/verify -> after-login target (/orders)', /^#\/orders/.test(await L.H(p)), await L.H(p));
        // no pending: register/verify -> register
        await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
        await L.go(p, '#/register/verify'); await L.sleep(300);
        lg.check('signed out, no pending: #/register/verify -> #/register', (await L.H(p)) === '#/register', await L.H(p));
        // existing number
        await fillReg(p, { first: 'ანა', last: 'ბერი', phone: '568 123 123', pass: 'parol1234', email: 'ana@example.com' });
        await p.click('#auth-submit'); await L.sleep(250);
        lg.check('register existing number -> userExists in the note', (await p.evaluate(() => document.getElementById('reg-phone-err').textContent)) === 'ამ ნომრით მომხმარებელი უკვე არსებობს' && /^#\/register$/.test(await L.H(p)));
        // demo QA seed
        await p.goto(L.BASE + '#/register/verify?demo=1'); await L.sleep(300);
        lg.check('demo: lead 555 123 456, no cooldown', /555 123 456$/.test(await visTxt(p, '#verify-lead')) && (await p.evaluate(() => document.getElementById('verify-resend').getAttribute('aria-disabled'))) === null);
        await p.fill('#verify-code', '4821'); await p.click('#auth-submit');
        lg.check('demo code 4821 -> #/delivery (demo cart)', (await L.waitHash(p, /^#\/(delivery|orders)/)) === '#/delivery', await L.H(p));
      } catch (e) { lg.check('flow C script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

// ported from scratchpad tools/v2auth_flow.js
// v2 auth (E1): register -> phone verification -> account; login ?next= handling. Usage: node tests/e2e/auth-flow.test.js [outDir]
const { BASE, mkLog, launch, newPage, sleep, hash, state, active } = require('../lib/harness');
const fs = require('fs');
const OUT = process.argv[2] || require('../lib/harness').OUT;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await launch();
  const allErrs = {};
  let fails = [];
  for (const W of [428, 1440]) {
    const L = mkLog(String(W));
    const errs = []; allErrs[W] = errs;
    const { ctx, p } = await newPage(b, W, errs);
    const go = async (h) => { await p.goto(BASE + h); await sleep(350); };
    const toastText = () => p.evaluate(() => { const t = document.querySelector('#toast-root'); return t ? t.innerText.trim() : ''; });
    const errText = (id) => p.evaluate(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent : null; }, id);
    const users = () => p.evaluate(() => JSON.parse(localStorage.getItem('slicepay:v1:users') || '{}'));

    // ---- 1. cart (signed out) -> register -> verify
    await go('#/cart?demo=1&auth=0');
    await go('#/register');
    L.check('register reachable', (await hash(p)) === '#/register');
    const XSS = '<img src=x onerror="window.__x=1">';
    await p.fill('#reg-first', XSS);
    await p.fill('#reg-last', 'ტესტი');
    await p.fill('#reg-phone', '599111222');
    await p.fill('#reg-pass', 'password123');
    await p.fill('#reg-email', 'a@b.ge');
    await p.check('#reg-terms', { force: true });
    await p.click('#auth-submit'); await sleep(400);
    L.check('register -> #/register/verify', (await hash(p)) === '#/register/verify', await hash(p));
    let st = await state(p);
    L.check('pending registration stored', st.pendingReg && st.pendingReg.phone === '599111222');
    L.check('not signed in yet', !st.userPhone);
    L.check('account not created yet', !(await users())['599111222']);
    L.check('pending has no plain password', !JSON.stringify(st.pendingReg).includes('password123'));
    const code1 = st.pendingReg.code;
    L.check('code toast shown', (await toastText()).includes('სატესტო კოდი: ' + code1), await toastText());
    L.check('heading', (await p.textContent('h1')).trim() === 'ტელეფონის დადასტურება');
    L.check('lead with formatted phone', (await p.textContent('#verify-lead')).replace(/\s+/g, ' ').trim() === 'SMS კოდი გამოგზავნილია ნომერზე 599 111 222');
    const attrs = await p.evaluate(() => { const i = document.getElementById('verify-code'); return { ph: i.placeholder, im: i.inputMode, ml: i.maxLength, ac: i.autocomplete, db: i.getAttribute('aria-describedby') }; });
    L.check('code input attrs', attrs.ph === 'SMS კოდი' && attrs.im === 'numeric' && attrs.ml === 4 && attrs.ac === 'one-time-code' && /verify-lead/.test(attrs.db), attrs);
    const rs = await p.evaluate(() => { const r = document.getElementById('verify-resend'); return { t: r.textContent, d: r.getAttribute('aria-disabled') }; });
    L.check('resend in cooldown (0:3x/0:2x)', rs.d === 'true' && /^კოდის ხელახლა გამოგზავნა \(0:(30|29|28)\)$/.test(rs.t), rs);
    await p.screenshot({ path: `${OUT}/verify_cooldown_${W}.png` });
    L.check('mobile bar / button label', (await p.evaluate(() => document.querySelector('#auth-submit [aria-hidden]').textContent.trim() + '|' + document.querySelector('#auth-submit .sr-only').textContent)) === 'ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ|დადასტურება');

    // ---- 2. validation
    await p.click('#auth-submit'); await sleep(150);
    L.check('empty -> 4-digit message', (await errText('verify-code')) === 'შეიყვანეთ 4-ნიშნა კოდი');
    L.check('focus on code after error', (await active(p)) === 'verify-code');
    const wrong = code1 === '1111' ? '2222' : '1111';
    await p.fill('#verify-code', wrong); await p.click('#auth-submit'); await sleep(150);
    L.check('wrong code message', (await errText('verify-code')) === 'კოდი არასწორია');
    await p.locator('#verify-code').blur(); await sleep(50);
    L.check('server error survives blur', (await errText('verify-code')) === 'კოდი არასწორია');
    await p.fill('#verify-code', '12'); await sleep(50);
    L.check('typing clears the error', (await errText('verify-code')) === '');
    await p.fill('#verify-code', 'ab12cd');
    L.check('non-digits stripped', (await p.inputValue('#verify-code')) === '12');
    await p.fill('#verify-code', '');
    await p.focus('#verify-code');
    await p.evaluate(() => { const dt = new DataTransfer(); dt.setData('text/plain', ' 48-21 '); document.getElementById('verify-code').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
    L.check('paste " 48-21 " -> 4821', (await p.inputValue('#verify-code')) === '4821', await p.inputValue('#verify-code'));

    // ---- 3. change number -> register prefilled (no password) -> same number inside cooldown keeps the code
    await p.click('.auth__change'); await sleep(350);
    L.check('change number -> #/register', (await hash(p)) === '#/register', await hash(p));
    const pre = await p.evaluate(() => ['reg-first', 'reg-last', 'reg-phone', 'reg-pass', 'reg-email'].map(i => document.getElementById(i).value).concat([document.getElementById('reg-terms').checked]));
    L.check('prefill except password', pre[0] === XSS && pre[1] === 'ტესტი' && pre[2] === '599 111 222' && pre[3] === '' && pre[4] === 'a@b.ge' && pre[5] === true, pre);
    L.check('XSS name not executed / no injected img', !(await p.evaluate(() => window.__x)) && (await p.$$('#app img[src="x"]')).length === 0);
    await p.fill('#reg-pass', 'password456');
    await p.click('#auth-submit'); await sleep(400);
    st = await state(p);
    L.check('back to verify, same code inside cooldown', (await hash(p)) === '#/register/verify' && st.pendingReg.code === code1);
    L.check('XSS name escaped in verify page', !(await p.evaluate(() => window.__x)));

    // ---- 4. expiry
    await p.evaluate(() => { SlicePay.state().pendingReg.expiresAt = Date.now() - 1; SlicePay.save(); });
    await p.fill('#verify-code', code1); await p.click('#auth-submit'); await sleep(150);
    L.check('expired message', (await errText('verify-code')) === 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი');
    await p.screenshot({ path: `${OUT}/verify_expired_${W}.png` });

    // ---- 5. cooldown ends -> resend -> new code, error + value cleared, countdown restarts
    await p.evaluate(() => { SlicePay.state().pendingReg.sentAt = Date.now() - 31000; SlicePay.save(); });
    await sleep(400);
    let r2 = await p.evaluate(() => { const r = document.getElementById('verify-resend'); return { t: r.textContent, d: r.getAttribute('aria-disabled') }; });
    L.check('resend enabled after cooldown', r2.d === null && r2.t === 'კოდის ხელახლა გამოგზავნა', r2);
    await p.click('#verify-resend'); await sleep(200);
    st = await state(p);
    const code2 = st.pendingReg.code;
    L.check('resend: new code toast', (await toastText()).includes('სატესტო კოდი: ' + code2));
    L.check('resend: expiry renewed', st.pendingReg.expiresAt > Date.now() + 200000);
    L.check('resend: error + input cleared, focus on input', (await errText('verify-code')) === '' && (await p.inputValue('#verify-code')) === '' && (await active(p)) === 'verify-code');
    r2 = await p.evaluate(() => document.getElementById('verify-resend').getAttribute('aria-disabled'));
    L.check('resend: cooldown restarted', r2 === 'true');
    const before = (await state(p)).pendingReg.code;
    await p.click('#verify-resend', { force: true }); await sleep(100);
    L.check('resend ignored during cooldown', (await state(p)).pendingReg.code === before);

    // ---- 6. success (Enter submits)
    await p.fill('#verify-code', code2); await p.press('#verify-code', 'Enter'); await sleep(450);
    st = await state(p);
    L.check('verified -> #/delivery (cart has products)', (await hash(p)) === '#/delivery', await hash(p));
    L.check('signed in + profile + pending cleared', st.userPhone === '599111222' && st.profile && st.profile.last === 'ტესტი' && !st.pendingReg);
    L.check('account created', !!(await users())['599111222']);
    L.check('verified toast', (await toastText()).includes('ნომერი დადასტურებულია'), await toastText());
    L.check('no countdown timer leaks (resend gone)', !(await p.$('#verify-resend')));

    // ---- 7. guard: verify without a pending registration
    // v3 reconcile: the user is signed in here, so a verify entry without a pending registration is skipped
    // straight to the after-login target (#/delivery with a cart), not to an empty register frame
    // (core v2 r1 + r2 SP.skipEntry; BUILD_NOTES "Expected stale checks": v2auth_flow "guard -> #/register").
    await go('#/register/verify');
    L.check('guard (signed in, no pending) -> #/delivery', (await hash(p)) === '#/delivery', await hash(p));

    // ---- 8. login ?next=
    await p.evaluate(() => { SlicePay.reset({ signOut: true, go: false }); });
    await go('#/login?next=/orders');
    L.check('login keeps next on register link', (await p.getAttribute('.auth__prompt--login a', 'href')) === '#/register?next=/orders');
    L.check('login keeps next on recover link', (await p.getAttribute('.auth__link-row a', 'href')) === '#/recover?next=/orders');
    L.check('login back -> / when cart empty', (await p.getAttribute('#auth-form [data-back]', 'data-back')) === '/');
    await p.fill('#log-phone', '599111222'); await p.fill('#log-pass', 'password456');
    await p.click('#auth-submit'); await sleep(450);
    L.check('login -> next (/orders)', (await hash(p)) === '#/orders', await hash(p));
    await p.evaluate(() => { SlicePay.reset({ signOut: true, go: false }); });
    await go('#/login?next=//evil.example');
    await p.fill('#log-phone', '599111222'); await p.fill('#log-pass', 'password456');
    await p.click('#auth-submit'); await sleep(450);
    L.check('unsafe next ignored -> /orders (empty cart)', (await hash(p)) === '#/orders', await hash(p));
    await go('#/cart?demo=1&auth=0');
    await go('#/login');
    await p.fill('#log-phone', '555123456'); await p.fill('#log-pass', 'slicepay1');
    await p.click('#auth-submit'); await sleep(450);
    L.check('login with cart -> /delivery', (await hash(p)) === '#/delivery', await hash(p));

    // ---- 9. register ?next= survives to verify -> next
    await p.evaluate(() => { SlicePay.reset({ signOut: true, go: false }); });
    await go('#/register?next=/orders');
    L.check('register login-link keeps next', (await p.getAttribute('.auth__prompt a', 'href')) === '#/login?next=/orders');
    await p.fill('#reg-first', 'ა'); await p.fill('#reg-last', 'ბ'); await p.fill('#reg-phone', '599333444');
    await p.fill('#reg-pass', 'password123'); await p.fill('#reg-email', 'c@d.ge'); await p.check('#reg-terms', { force: true });
    await p.click('#auth-submit'); await sleep(400);
    await p.fill('#verify-code', (await state(p)).pendingReg.code); await p.click('#auth-submit'); await sleep(450);
    L.check('register ?next=/orders -> verify -> /orders', (await hash(p)) === '#/orders', await hash(p));

    // ---- 10. existing number
    await p.evaluate(() => { SlicePay.reset({ signOut: true, go: false }); });
    await go('#/register');
    await p.fill('#reg-first', 'ა'); await p.fill('#reg-last', 'ბ'); await p.fill('#reg-phone', '599333444');
    await p.fill('#reg-pass', 'password123'); await p.fill('#reg-email', 'c@d.ge'); await p.check('#reg-terms', { force: true });
    await p.click('#auth-submit'); await sleep(300);
    L.check('existing number -> userExists, stays', (await hash(p)) === '#/register' && (await p.textContent('#reg-phone-err')) === 'ამ ნომრით მომხმარებელი უკვე არსებობს');

    // ---- 11. QA demo seed
    await go('#/register/verify?demo=1');
    st = await state(p);
    L.check('demo: pending 555 123 456, not signed in, no cooldown', st.pendingReg && st.pendingReg.code === '4821' && !st.userPhone &&
      (await p.getAttribute('#verify-resend', 'aria-disabled')) === null);
    await p.fill('#verify-code', '4821'); await p.click('#auth-submit'); await sleep(450);
    L.check('demo 4821 -> /delivery', (await hash(p)) === '#/delivery', await hash(p));
    await go('#/register/verify?demo=1&err=1');
    L.check('err=1 shows the 4-digit message', (await errText('verify-code')) === 'შეიყვანეთ 4-ნიშნა კოდი');

    // ---- 12. keyboard order on verify
    await go('#/register/verify?demo=1');
    await p.focus('#verify-code');
    const order = [];
    for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); order.push(await p.evaluate(() => { const a = document.activeElement; return a.id || a.className || a.tagName; })); }
    L.info('tab order after code input', order.join(' > '));
    L.check('tab: resend then change number', order[0] === 'verify-resend' && /auth__change/.test(order[1]), order);
    // keyboard activation of "ნომრის შეცვლა"
    await p.focus('.auth__change'); await p.keyboard.press('Enter'); await sleep(350);
    L.check('Enter on change number -> /register', (await hash(p)) === '#/register', await hash(p));

    fails = fails.concat(L.summary());
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/console_errors.json`, JSON.stringify(allErrs, null, 1));
  console.log('console errors', JSON.stringify(allErrs));
  console.log(fails.length ? 'FAILURES: ' + fails.length : 'ALL PASS');
  await b.close();
  process.exitCode = fails.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });

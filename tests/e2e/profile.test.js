// v4 profile editing (#/profile, docs/specs/V4_SPEC.md §B) at 428 and 1440:
//   guard + login next, layout (header link / mobile bar, no overflow), personal info save + validation + escaping,
//   the profile edit reaching the delivery prefill, phone change (required / format / same / taken, wrong / format /
//   expired code, 30 s resend cooldown, reload on the code step, success), re-keying (users store, orders,
//   remember-me, session; orders still visible; login works with the new number and not the old one),
//   password change (required / wrong current / short / mismatch / same, eye reset, success, old password refused),
//   logout (ᲒᲐᲡᲕᲚᲐ) and no console errors / network requests. v4 finish: double-click / double / held Enter guards
//   (password + phone change), a long name never locked or cut (profile + delivery prefill), spacing at 428.
// A fake clock (Playwright clock) drives the cooldown and the 5 min code expiry.
const L = require('../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
const USERS = 'slicepay:v1:users', ORD = 'slicepay:v1:orders';
const OLD = '555123456';

(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('profile ' + W);
    const c = (n, ok, d) => lg.check(n, ok, d);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
    const ev = (fn, a) => p.evaluate(fn, a);
    const val = id => p.inputValue('#' + id);
    const vt = sel => L.appVisText(p, sel);   // visible text (the sr-only lower-case twin of a Mtavruli label is left out)
    const err = id => ev(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent.trim() : null; }, id);
    const attr = (id, a) => ev(([i, x]) => { const e = document.getElementById(i); return e ? e.getAttribute(x) : 'MISSING'; }, [id, a]);
    const users = () => ev(k => JSON.parse(localStorage.getItem(k) || '{}'), USERS);
    const codeOf = t => (String(t).match(/(\d{4})/) || [])[1];
    const NEW = '577' + String(W).padStart(6, '0');                     // 577 000 428 / 577 001 440
    const NEWF = NEW.slice(0, 3) + ' ' + NEW.slice(3, 6) + ' ' + NEW.slice(6);
    try {
      /* ---------------- guard + login next ---------------- */
      await p.goto(L.BASE + '#/profile'); await L.sleep(300);
      c('signed out: #/profile → #/login?next=/profile', (await L.H(p)) === '#/login?next=/profile', await L.H(p));
      await ev(() => SlicePay.api.ensureDemoUser());
      await p.fill('#log-phone', '555 123 456'); await p.fill('#log-pass', 'slicepay1'); await p.click('#auth-submit');
      c('login returns to #/profile', (await L.waitHash(p, /^#\/profile$/)) === '#/profile', await L.H(p));

      /* ---------------- seeded demo profile + layout ---------------- */
      await p.goto(L.BASE + '#/profile?demo=1'); await L.sleep(350);
      c('heading პროფილი + 3 sections', (await L.tc(p, 'h1')) === 'პროფილი' &&
        (await ev(() => [...document.querySelectorAll('.prof-sec h2')].map(h => h.textContent).join('|'))) === 'პირადი ინფორმაცია|ტელეფონის ნომერი|პაროლის შეცვლა');
      c('prefilled გიორგი / ბერიძე / giorgi@example.com', (await val('pf-first')) === 'გიორგი' && (await val('pf-last')) === 'ბერიძე' && (await val('pf-email')) === 'giorgi@example.com');
      c('current number 555 123 456 + ნომრის შეცვლა', (await L.txt(p, '.prof-phone__v')) === '555 123 456' && (await L.txt(p, '#pf-phone-open')) === 'ნომრის შეცვლა');
      c('button labels ᲨᲔᲜᲐᲮᲕᲐ / ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ / ᲒᲐᲡᲕᲚᲐ', (await vt('#pf-save')) === 'ᲨᲔᲜᲐᲮᲕᲐ' && (await vt('#pw-submit')) === 'ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ' && (await vt('[data-action="logout"]')) === 'ᲒᲐᲡᲕᲚᲐ');
      if (W >= 900) {
        // v4 r1: every inner header has both links; on the profile page პროფილი is the current page (aria-current)
        const hd = await ev(() => [...document.querySelectorAll('.d-head .acct-link')].filter(a => a.getClientRects().length).map(a => a.textContent + '>' + a.getAttribute('href') + '>' + (a.getAttribute('aria-current') || '')));
        c('desktop header: პროფილი (aria-current=page) · ჩემი შეკვეთები', hd.join() === 'პროფილი>#/profile>page,ჩემი შეკვეთები>#/orders>', hd);
      } else {
        const bar = await ev(() => [...document.querySelectorAll('.m-bar button')].filter(x => x.getClientRects().length).map(x => x.innerText.trim().split('\n')[0]));
        c('mobile bar: ᲣᲙᲐᲜ only', bar.join('|') === 'ᲣᲙᲐᲜ', bar);
      }
      c('no horizontal overflow', await L.noOverflow(p));
      await L.go(p, '#/profile'); await L.sleep(250);   // a clean entry: a reload of the ?demo=1 URL would re-seed the demo account

      /* ---------------- personal information ---------------- */
      c('ᲨᲔᲜᲐᲮᲕᲐ starts disabled-look', (await attr('pf-save', 'aria-disabled')) === 'true');
      const t0 = await L.toast(p);
      await p.click('#pf-save', { force: true }); await L.sleep(120);
      c('unchanged save does nothing (no new toast, nothing stored)', (await L.toast(p)) === t0 && (await L.toast(p)) !== 'ცვლილებები შენახულია', await L.toast(p));
      await p.fill('#pf-last', 'ბერიძე2');
      c('an edit enables ᲨᲔᲜᲐᲮᲕᲐ', (await attr('pf-save', 'aria-disabled')) === null);
      await p.fill('#pf-last', 'ბერიძე');
      c('reverting disables it again', (await attr('pf-save', 'aria-disabled')) === 'true');
      await p.fill('#pf-first', '   '); await p.fill('#pf-email', 'bad@'); await p.click('#pf-save'); await L.sleep(120);
      c('validation: name required, e-mail invalid, focus on სახელი', (await err('pf-first')) === 'სავალდებულო ველი' && (await err('pf-email')) === 'არასწორი ელ.ფოსტა' && (await L.active(p)) === 'pf-first', [await err('pf-first'), await err('pf-email'), await L.active(p)]);
      await p.fill('#pf-email', ''); await p.press('#pf-email', 'Enter'); await L.sleep(120);
      c('validation: e-mail required (Enter submits)', (await err('pf-email')) === 'სავალდებულო ველი', await err('pf-email'));
      c('nothing stored while invalid', (await users())[OLD].first === 'გიორგი');
      await p.fill('#pf-first', '  <b>ნინო</b>  '); await p.fill('#pf-last', 'კაპანაძე'); await p.fill('#pf-email', ' nino@example.com ');
      c('typing clears the errors', (await err('pf-first')) === '' && (await err('pf-email')) === '');
      await p.click('#pf-save'); await L.sleep(150);
      c('save → toast ცვლილებები შენახულია, trimmed values, disabled-look again', (await L.toast(p)) === 'ცვლილებები შენახულია' && (await val('pf-first')) === '<b>ნინო</b>' && (await val('pf-email')) === 'nino@example.com' && (await attr('pf-save', 'aria-disabled')) === 'true', [await L.toast(p), await val('pf-first')]);
      let rec = (await users())[OLD];
      c('stored in the user record (no plain password)', rec.first === '<b>ნინო</b>' && rec.last === 'კაპანაძე' && rec.email === 'nino@example.com' && !JSON.stringify(rec).includes('slicepay1'), rec);
      c('session profile follows', JSON.stringify((await L.st(p)).profile) === JSON.stringify({ first: '<b>ნინო</b>', last: 'კაპანაძე' }), (await L.st(p)).profile);
      await p.reload(); await L.sleep(350);
      c('reload: saved values, markup stays literal text', (await val('pf-first')) === '<b>ნინო</b>' && (await val('pf-last')) === 'კაპანაძე' && !(await p.$('#app .prof b')));
      // the edit reaches the delivery step (#/profile?demo=1 no longer seeds session recipient names)
      await L.go(p, '#/delivery'); await L.sleep(250);
      c('delivery recipient prefilled from the edited profile', (await val('d-first')) === '<b>ნინო</b>' && (await val('d-last')) === 'კაპანაძე', [await val('d-first'), await val('d-last')]);
      await L.go(p, '#/profile'); await L.sleep(250);
      await p.fill('#pf-first', 'ნინო'); await p.press('#pf-first', 'Enter'); await L.sleep(120);
      c('second save', (await users())[OLD].first === 'ნინო');

      /* ---------------- phone change: errors ---------------- */
      await ev(() => SlicePay.api.remember('555123456'));
      await p.click('#pf-phone-open'); await L.sleep(100);
      c('ნომრის შეცვლა opens the form, focus on the new number', (await L.active(p)) === 'pf-phone-new' && (await vt('#pf-send')) === 'ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ');
      await p.keyboard.press('Escape'); await L.sleep(100);
      c('Esc cancels, focus back on ნომრის შეცვლა', !(await p.$('#pf-phone-new')) && (await L.active(p)) === 'pf-phone-open');
      await p.click('#pf-phone-open'); await L.sleep(80);
      await p.click('#pf-send'); await L.sleep(100);
      c('empty → სავალდებულო ველი', (await err('pf-phone-new')) === 'სავალდებულო ველი', await err('pf-phone-new'));
      await p.fill('#pf-phone-new', '123'); await p.press('#pf-phone-new', 'Enter'); await L.sleep(100);
      c('bad format → შეიყვანეთ ნომერი ფორმატით 5XX XXX XXX', (await err('pf-phone-new')) === 'შეიყვანეთ ნომერი ფორმატით 5XX XXX XXX', await err('pf-phone-new'));
      await p.fill('#pf-phone-new', '555123456'); await p.press('#pf-phone-new', 'Enter'); await L.sleep(100);
      c('same number → ახალი ნომერი ემთხვევა მიმდინარეს', (await err('pf-phone-new')) === 'ახალი ნომერი ემთხვევა მიმდინარეს', await err('pf-phone-new'));
      // another registered account (duplicate number)
      await ev(k => { const u = JSON.parse(localStorage.getItem(k)); u['599000111'] = { salt: 'x', pass: 'y', created: 1 }; localStorage.setItem(k, JSON.stringify(u)); }, USERS);
      await p.fill('#pf-phone-new', '599 000 111'); await p.press('#pf-phone-new', 'Enter'); await L.sleep(100);
      c('duplicate number → ეს ნომერი უკვე დარეგისტრირებულია', (await err('pf-phone-new')) === 'ეს ნომერი უკვე დარეგისტრირებულია', await err('pf-phone-new'));
      c('still on the number form (no code sent)', !(await p.$('#pf-code')) && !(await L.st(p)).phoneChange);

      /* ---------------- phone change: code step ---------------- */
      await p.fill('#pf-phone-new', '+995 ' + NEWF); await p.click('#pf-send'); await L.sleep(150);
      let t = await L.toast(p), code = codeOf(t);
      c('code sent: test-code toast, code step focused, lead names the new number', /^სატესტო კოდი: \d{4}$/.test(t) && (await L.active(p)) === 'pf-code' && (await L.txt(p, '#pf-code-lead')) === 'SMS კოდი გამოგზავნილია ნომერზე ' + NEWF, [t, await L.txt(p, '#pf-code-lead')]);
      c('code step labels: SMS კოდი, ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ, გაუქმება', (await L.txt(p, 'label[for="pf-code"]')) === 'SMS კოდი' && (await vt('#pf-confirm')) === 'ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ' && (await L.txt(p, '#pf-cancel')) === 'გაუქმება');
      const sentAt = (await L.st(p)).phoneChange.sentAt;
      let rs = await L.txt(p, '#pf-resend');
      c('resend cooldown running (0:30) + aria-disabled', /^კოდის ხელახლა გამოგზავნა \(0:(30|29|28)\)$/.test(rs) && (await attr('pf-resend', 'aria-disabled')) === 'true', rs);
      await p.click('#pf-resend', { force: true }); await L.sleep(100);
      const t2 = await L.toast(p);
      c('resend inside the cooldown does nothing', (t2 === '' || codeOf(t2) === code) && (await L.st(p)).phoneChange.code === code && (await L.st(p)).phoneChange.sentAt === sentAt, t2);
      await p.fill('#pf-code', '12'); await p.press('#pf-code', 'Enter'); await L.sleep(100);
      c('short code → შეიყვანეთ 4-ნიშნა კოდი', (await err('pf-code')) === 'შეიყვანეთ 4-ნიშნა კოდი', await err('pf-code'));
      const wrong = code === '1111' ? '2222' : '1111';
      await p.fill('#pf-code', wrong); await p.click('#pf-confirm'); await L.sleep(100);
      c('wrong code → კოდი არასწორია, number unchanged', (await err('pf-code')) === 'კოდი არასწორია' && (await L.st(p)).userPhone === OLD, await err('pf-code'));
      await p.reload(); await L.sleep(350);
      c('reload keeps the code step', !!(await p.$('#pf-code')) && (await L.txt(p, '#pf-code-lead')).endsWith(NEWF));
      // cooldown ends → resend gives a fresh code
      await p.clock.fastForward(31000); await L.sleep(350);
      rs = await L.txt(p, '#pf-resend');
      c('after 30 s: resend enabled, plain label', rs === 'კოდის ხელახლა გამოგზავნა' && (await attr('pf-resend', 'aria-disabled')) === null, rs);
      await p.fill('#pf-code', wrong);
      await p.click('#pf-resend'); await L.sleep(150);
      t = await L.toast(p); code = codeOf(t);
      c('resend: new code toast, field cleared + focused, cooldown restarted', /^სატესტო კოდი: \d{4}$/.test(t) && (await val('pf-code')) === '' && (await L.active(p)) === 'pf-code' && (await attr('pf-resend', 'aria-disabled')) === 'true', t);
      // the code expires after 5 min
      await p.clock.fastForward(5 * 60 * 1000 + 1000); await L.sleep(300);
      await p.fill('#pf-code', code); await p.click('#pf-confirm'); await L.sleep(120);
      c('expired code → კოდს ვადა გაუვიდა, მოითხოვეთ ახალი', (await err('pf-code')) === 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი' && (await L.st(p)).userPhone === OLD, await err('pf-code'));
      await p.click('#pf-resend'); await L.sleep(150);
      code = codeOf(await L.toast(p));
      await p.fill('#pf-code', code); await p.press('#pf-code', 'Enter'); await L.sleep(200);

      /* ---------------- phone change: success + re-keying ---------------- */
      c('success: toast ტელეფონის ნომერი შეიცვალა, new number shown, focus on ნომრის შეცვლა', (await L.toast(p)) === 'ტელეფონის ნომერი შეიცვალა' && (await L.txt(p, '.prof-phone__v')) === NEWF && (await L.active(p)) === 'pf-phone-open', [await L.toast(p), await L.txt(p, '.prof-phone__v')]);
      const us = await users(), os = await ev(k => JSON.parse(localStorage.getItem(k) || '{}'), ORD);
      c('users store re-keyed (old number free, profile kept)', !us[OLD] && us[NEW] && us[NEW].first === 'ნინო' && us[NEW].email === 'nino@example.com', Object.keys(us));
      c('orders re-keyed with the account', !os[OLD] && Array.isArray(os[NEW]) && os[NEW].map(o => o.id).sort().join() === '548210,731954', Object.keys(os));
      const s1 = await L.st(p);
      c('session + remember-me follow the new number', s1.userPhone === NEW && !s1.phoneChange && (await ev(() => SlicePay.api.remembered())) === NEW, [s1.userPhone, s1.phoneChange]);
      await L.go(p, '#/orders'); await L.sleep(250);
      const ids = await ev(() => [...document.querySelectorAll('.ord-card__link')].map(a => a.getAttribute('data-order')));
      c('orders still visible after the change', ids.join() === '731954,548210', ids);
      // v4f: desktop uses the header link (the heading-row link .ord-top__out is mobile-only)
      c('orders პროფილი link → #/profile', (await L.txt(p, L.profLinkSel(p))) === 'პროფილი');
      await L.vis(p, L.profLinkSel(p)).click(); await L.waitHash(p, /^#\/profile$/); await L.sleep(200);

      /* ---------------- password change ---------------- */
      await p.click('#pw-submit'); await L.sleep(120);
      c('empty → სავალდებულო ველი ×3, focus on მიმდინარე პაროლი', (await err('pw-current')) === 'სავალდებულო ველი' && (await err('pw-new')) === 'სავალდებულო ველი' && (await err('pw-repeat')) === 'სავალდებულო ველი' && (await L.active(p)) === 'pw-current');
      await p.fill('#pw-current', 'wrongpass1'); await p.fill('#pw-new', 'short'); await p.fill('#pw-repeat', 'other'); await p.press('#pw-repeat', 'Enter'); await L.sleep(120);
      c('wrong current / short / mismatch shown together', (await err('pw-current')) === 'მიმდინარე პაროლი არასწორია' && (await err('pw-new')) === 'მინიმუმ 8 სიმბოლო' && (await err('pw-repeat')) === 'პაროლები არ ემთხვევა', [await err('pw-current'), await err('pw-new'), await err('pw-repeat')]);
      // V4QA1-02: a wrong current password never reveals whether the new one equals the real password
      await p.fill('#pw-current', 'totallywrong'); await p.fill('#pw-new', 'slicepay1'); await p.fill('#pw-repeat', 'slicepay1'); await p.click('#pw-submit'); await L.sleep(120);
      c('wrong current + new = the real password → only the current-field error (no passSame oracle)', (await err('pw-current')) === 'მიმდინარე პაროლი არასწორია' && (await err('pw-new')) === '' && (await err('pw-repeat')) === '', [await err('pw-current'), await err('pw-new'), await err('pw-repeat')]);
      const oracle = await ev(() => SlicePay.api.changePassword({ current: '', next: 'slicepay1', repeat: 'slicepay1' }));
      c('API: empty current + real password → no passSame', !oracle.ok && oracle.error === 'required' && !oracle.errors.next, oracle);
      await p.fill('#pw-current', 'slicepay1'); await p.fill('#pw-new', 'slicepay1'); await p.fill('#pw-repeat', 'slicepay1'); await p.click('#pw-submit'); await L.sleep(120);
      c('same as current → ახალი პაროლი ემთხვევა მიმდინარეს', (await err('pw-new')) === 'ახალი პაროლი ემთხვევა მიმდინარეს' && (await err('pw-current')) === '', await err('pw-new'));
      await p.fill('#pw-new', 'newpass123'); await p.fill('#pw-repeat', 'newpass123');
      await p.click('[data-eye="pw-new"]'); await L.sleep(60);
      c('eye shows the new password', (await attr('pw-new', 'type')) === 'text');
      await p.click('#pw-submit'); await L.sleep(150);
      c('success: toast პაროლი შეიცვალა, fields cleared and hidden again', (await L.toast(p)) === 'პაროლი შეიცვალა' && (await val('pw-current')) === '' && (await val('pw-new')) === '' && (await val('pw-repeat')) === '' && (await attr('pw-new', 'type')) === 'password', await L.toast(p));
      rec = (await users())[NEW];
      c('profile kept, no plain password stored', rec.first === 'ნინო' && !JSON.stringify(rec).includes('newpass123'), rec);

      /* ---------------- logout + login with the new number / password ---------------- */
      await L.vis(p, '[data-action="logout"]').click(); await L.sleep(300);
      c('ᲒᲐᲡᲕᲚᲐ → landing + toast, session cleared', ((await L.H(p)) === '#/' || (await L.H(p)) === '') && (await L.toast(p)).includes('თქვენ გამოხვედით სისტემიდან') && !(await L.st(p)).userPhone);
      await L.go(p, '#/profile'); await L.sleep(200);
      c('signed out again: guard → login?next=/profile', (await L.H(p)) === '#/login?next=/profile', await L.H(p));
      await L.go(p, '#/login?next=/orders'); await L.sleep(200);
      await p.fill('#log-phone', '555 123 456'); await p.fill('#log-pass', 'slicepay1'); await p.click('#auth-submit'); await L.sleep(200);
      c('old number refused (ამ ნომრით მომხმარებელი არ არსებობს)', /^#\/login/.test(await L.H(p)) && (await err('log-pass')) === 'ამ ნომრით მომხმარებელი არ არსებობს' && !(await L.st(p)).userPhone, [await L.H(p), await err('log-pass')]);
      await p.fill('#log-phone', NEWF); await p.fill('#log-pass', 'slicepay1'); await p.click('#auth-submit'); await L.sleep(200);
      c('new number + old password refused', /^#\/login/.test(await L.H(p)) && (await err('log-pass')) === 'ტელეფონის ნომერი ან პაროლი არასწორია', await err('log-pass'));
      await p.fill('#log-pass', 'newpass123'); await p.click('#auth-submit');
      await L.waitHash(p, /^#\/orders$/); await L.sleep(250);
      const ids2 = await ev(() => [...document.querySelectorAll('.ord-card__link')].map(a => a.getAttribute('data-order')));
      c('new number + new password → #/orders with the same orders', (await L.H(p)) === '#/orders' && ids2.join() === '731954,548210', [await L.H(p), ids2]);
      await L.go(p, '#/profile'); await L.sleep(250);
      c('profile after re-login: new number, saved names', (await L.txt(p, '.prof-phone__v')) === NEWF && (await val('pf-first')) === 'ნინო' && (await val('pf-last')) === 'კაპანაძე');
      if (W >= 900) {
        await L.landingAdd(p, 'https://www.amazon.com/Echo-Dot-5th-Gen/dp/B09B8V1LZ3'); await L.sleep(250);
        await p.click('.d-head .acct-link--profile'); await L.sleep(250);
        c('desktop header პროფილი link (cart) → #/profile', (await L.H(p)) === '#/profile', await L.H(p));
      }
      c('no horizontal overflow (end)', await L.noOverflow(p));
      await L.shot(p, 'profile_end_' + W);
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    c('no console errors / network requests', errs.length === 0, errs);
    lg.summary();
    await ctx.close();
  }

  /* ---------------- v4 finish regressions (V4F2-01 / -02 / -03, layout) at 428 and 1440 ----------------
     A real clock here (the submit guards are time-limited): double-click / double Enter / held Enter on the password
     change, double Enter / double click in both phone-change steps, a long name never locked or cut (profile edit +
     delivery prefill, no maxlength anywhere), and the spacing: h1 → first card 24, logout ↔ mobile bar ≥ 24 at 428. */
  for (const W of [428, 1440]) {
    const errs = allErrs['r2-' + W] = [];
    const lg = L.mkLog('profile r2 ' + W);
    const c = (n, ok, d) => lg.check(n, ok, d);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const ev = (fn, a) => p.evaluate(fn, a);
    const err = id => ev(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent.trim() : null; }, id);
    const rect = s => ev(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top + scrollY, b: r.bottom + scrollY }; }, s);
    try {
      await p.goto(L.BASE + '#/profile?demo=1'); await L.sleep(350);
      /* layout */
      const h1 = await rect('.prof__h'), s1 = await rect('.prof-sec');
      c('h1 → first card 24', Math.round(s1.t - h1.b) === 24, s1.t - h1.b);
      if (W < 900) {
        await ev(() => scrollTo(0, 1e6)); await L.sleep(100);
        const lo = await rect('.prof-logout'), bar = await rect('.m-bar button');
        c('logout → bar gap 24', Math.round(bar.t - lo.b) === 24, [lo, bar]);
        for (const q of ['?demo=1&edit=phone', '?demo=1&edit=phone&step=code', '?demo=1&err=1']) {
          await p.goto(L.BASE + '#/profile' + q); await p.reload(); await L.sleep(300);
          await ev(() => scrollTo(0, 1e6)); await L.sleep(80);
          const lo2 = await rect('.prof-logout'), bar2 = await rect('.m-bar button');
          c('logout → bar gap ≥ 24 ' + q, bar2.t - lo2.b >= 23.5, [lo2, bar2]);
        }
        await p.goto(L.BASE + '#/profile?demo=1'); await p.reload(); await L.sleep(300);
      }
      /* V4F2-03: a long name stays editable and reaches the delivery prefill uncut */
      const long = 'ა'.repeat(55);
      await ev(n => SlicePay.api.updateProfile({ first: n, last: 'ბ'.repeat(48), email: 'a@b.ge' }), long);
      await L.go(p, '#/profile'); await L.sleep(200);
      await p.click('#pf-first'); await p.keyboard.press('End'); await p.keyboard.press('Backspace'); await p.keyboard.type('ბ');
      const v55 = await p.inputValue('#pf-first');
      c('55-char name: a char can be replaced (no maxlength lock)', v55.length === 55 && v55.includes('ბ') && (await p.getAttribute('#pf-first', 'maxlength')) === null, v55);
      await L.go(p, '#/delivery'); await L.sleep(250);
      const dl = await ev(() => ['d-first', 'd-last'].map(i => { const e = document.getElementById(i); return e ? [e.value.length, e.getAttribute('maxlength')] : null; }));
      c('delivery recipient prefill keeps the long name whole, no maxlength on #d-first / #d-last', JSON.stringify(dl) === JSON.stringify([[55, null], [48, null]]), dl);
      if (dl[0]) { await p.click('#d-first'); await p.keyboard.press('End'); await p.keyboard.type('ე'); c('delivery: a long prefilled name still takes typing', (await p.inputValue('#d-first')).length === 56); }
      await L.go(p, '#/profile'); await L.sleep(200);
      /* V4F2-01: double-click / double Enter / held Enter on ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ */
      await p.fill('#pw-current', 'slicepay1'); await p.fill('#pw-new', 'dblclick12'); await p.fill('#pw-repeat', 'dblclick12');
      await p.dblclick('#pw-submit'); await L.sleep(200);
      c('pw dblclick: toast + no errors + focus not pw-current', (await L.toast(p)) === 'პაროლი შეიცვალა' && !(await err('pw-current')) && !(await err('pw-new')) && !(await err('pw-repeat')) && (await L.active(p)) !== 'pw-current', [await L.toast(p), await err('pw-current'), await L.active(p)]);
      await p.fill('#pw-current', 'dblclick12'); await p.fill('#pw-new', 'dblenter12'); await p.fill('#pw-repeat', 'dblenter12');
      await p.press('#pw-repeat', 'Enter'); await p.press('#pw-repeat', 'Enter'); await L.sleep(150);
      c('pw double Enter: no errors', !(await err('pw-current')) && !(await err('pw-repeat')) && (await L.active(p)) === 'pw-repeat', [await err('pw-current'), await L.active(p)]);
      await p.fill('#pw-current', 'dblenter12'); await p.fill('#pw-new', 'heldenter1'); await p.fill('#pw-repeat', 'heldenter1');
      await p.focus('#pw-repeat');
      const cdp = await p.context().newCDPSession(p);
      const key = (type, rep) => cdp.send('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: type === 'keyDown' ? '\r' : undefined, autoRepeat: !!rep });
      await key('keyDown'); for (let i = 0; i < 25; i++) { await L.sleep(40); await key('keyDown', true); } await key('keyUp'); await L.sleep(150);
      c('pw held Enter: toast, no errors', (await L.toast(p)) === 'პაროლი შეიცვალა' && !(await err('pw-current')) && !(await err('pw-repeat')), [await err('pw-current'), await err('pw-repeat')]);
      await p.fill('#pw-current', 'heldenter1'); await p.fill('#pw-new', 'dblenter12'); await p.fill('#pw-repeat', 'dblenter12'); await p.click('#pw-submit'); await L.sleep(700);
      await p.type('#pw-current', 'x'); await p.fill('#pw-current', ''); await p.click('#pw-submit'); await L.sleep(120);
      c('pw: empty submit after an edit validates again', (await err('pw-current')) === 'სავალდებულო ველი', await err('pw-current'));
      await p.fill('#pw-current', 'dblenter12'); await p.fill('#pw-new', 'third12345'); await p.fill('#pw-repeat', 'third12345');
      await p.click('#pw-submit'); await L.sleep(900);
      await p.click('#pw-submit'); await L.sleep(120);
      c('pw: a later deliberate empty submit validates (the guard is time-limited)', (await err('pw-current')) === 'სავალდებულო ველი', await err('pw-current'));
      /* V4F2-02: double Enter / double click in the phone-change steps */
      await L.go(p, '#/profile?edit=phone'); await L.sleep(250);
      await p.fill('#pf-phone-new', '577 111 ' + String(W).padStart(3, '0').slice(-3)); await p.press('#pf-phone-new', 'Enter'); await p.keyboard.press('Enter'); await L.sleep(150);
      c('phone (a) double Enter: code step with no error, focus pf-code', !!(await p.$('#pf-code')) && !(await err('pf-code')) && (await L.active(p)) === 'pf-code', [await err('pf-code'), await L.active(p)]);
      await L.sleep(700); await p.press('#pf-code', 'Enter'); await L.sleep(100);
      c('phone: a later empty Enter validates', (await err('pf-code')) === 'შეიყვანეთ 4-ნიშნა კოდი', await err('pf-code'));
      const code = (await L.st(p)).phoneChange.code;
      await p.fill('#pf-code', code); await p.press('#pf-code', 'Enter'); await p.keyboard.press('Enter'); await L.sleep(150);
      c('phone (b) double Enter: closed, focus on ნომრის შეცვლა', !(await p.$('#pf-phone-new')) && !(await p.$('#pf-code')) && (await L.active(p)) === 'pf-phone-open' && (await L.toast(p)) === 'ტელეფონის ნომერი შეიცვალა', [await L.active(p), await L.toast(p)]);
      await L.sleep(700);
      await p.keyboard.press('Enter'); await L.sleep(120);
      c('phone: a later Enter on ნომრის შეცვლა opens the form', !!(await p.$('#pf-phone-new')) && (await L.active(p)) === 'pf-phone-new');
      await p.fill('#pf-phone-new', '577 333 ' + String(W).padStart(3, '0').slice(-3)); await p.dblclick('#pf-send'); await L.sleep(150);
      c('phone (c) dblclick send: focus on pf-code, no error', (await L.active(p)) === 'pf-code' && !(await err('pf-code')), [await L.active(p), await err('pf-code')]);
      await p.keyboard.type('12'); c('typed digits land in the code field', (await p.inputValue('#pf-code')) === '12');
      const code2 = (await L.st(p)).phoneChange.code;
      await p.fill('#pf-code', code2); await p.dblclick('#pf-confirm'); await L.sleep(150);
      c('phone dblclick confirm: closed, focus on ნომრის შეცვლა', !(await p.$('#pf-phone-new')) && (await L.active(p)) === 'pf-phone-open', await L.active(p));
      await L.shot(p, 'profile_r2_' + W);
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    c('no console errors / network requests', errs.length === 0, errs);
    lg.summary();
    await ctx.close();
  }

  /* ---------------- V4QA1-01 / V4R1-01: two tabs of one account, a phone change in one of them ----------------
     sessionStorage is per tab (tab 2 is a duplicate: its session copied), localStorage is shared. After tab 1 moves
     the account to another number, tab 2 must not stay signed in to the freed number ("zombie" session), must not
     write orders under it, and the next person registering that number must see no orders. */
  {
    const errs = allErrs['two-tabs'] = [];
    const lg = L.mkLog('profile two tabs');
    const c = (n, ok, d) => lg.check(n, ok, d);
    const { ctx, p } = await L.newCtx(b, 1440, errs);
    const A = '591111111', A2 = '597777777';
    try {
      await p.goto(L.BASE + '#/'); await L.sleep(250);
      const reg = await p.evaluate(a => SlicePay.api.startRegistration({ first: 'ანა', last: 'ლომიძე', phone: a, email: 'ana@example.com', password: 'anapass12' }), A);
      const ver = await p.evaluate(code => SlicePay.api.verify(code), reg.code);
      c('tab 1: account A registered + signed in', reg.ok && ver.ok && (await L.st(p)).userPhone === A, [reg, ver]);
      await L.go(p, '#/profile'); await L.sleep(200);
      // tab 2 = a duplicate of tab 1 (same session)
      const sess = await p.evaluate(() => Object.entries(sessionStorage));
      const p2 = await ctx.newPage(); L.hook(p2, errs, 'tab2 ');
      await p2.addInitScript(e => { if (!sessionStorage.getItem('__dup')) { e.forEach(([k, v]) => sessionStorage.setItem(k, v)); sessionStorage.setItem('__dup', '1'); } }, sess);
      await p2.goto(L.BASE + '#/profile'); await L.sleep(300);
      c('tab 2: same account on #/profile', (await L.H(p2)) === '#/profile' && (await p2.inputValue('#pf-first')) === 'ანა' && (await L.st(p2)).userPhone === A);
      // tab 1 changes the number A → A2
      const sp = await p.evaluate(n => SlicePay.api.startPhoneChange(n), A2);
      const vp = await p.evaluate(code => SlicePay.api.verifyPhoneChange(code), sp.code);
      c('tab 1: number changed A → A2', sp.ok && vp.ok && (await L.st(p)).userPhone === A2, [sp, vp]);
      await L.sleep(300);
      // tab 2 reacts to the 'storage' event: signed out, toast, guard → login
      const t2 = await L.toast(p2), h2 = await L.H(p2), s2 = await L.st(p2);
      c('tab 2: session ended right away (toast, #/login?next=/profile, no userPhone)', h2 === '#/login?next=/profile' && t2 === 'ანგარიშის მონაცემები შეიცვალა. გთხოვთ, ხელახლა შეხვიდეთ' && !s2.userPhone, [h2, t2, s2.userPhone]);
      c('tab 2: not authed, no orders for the freed number', !(await p2.evaluate(() => SlicePay.isAuthed())) && (await p2.evaluate(() => SlicePay.orders.list('591111111').length)) === 0);
      // a stale session the 'storage' event did not reach (the record removed under it): writes nothing, ends on use
      await L.go(p, '#/profile'); await L.sleep(150);
      const sess1 = await p.evaluate(() => Object.entries(sessionStorage));
      const p3 = await ctx.newPage(); L.hook(p3, errs, 'tab3 ');
      await p3.addInitScript(e => { if (!sessionStorage.getItem('__dup')) { e.forEach(([k, v]) => sessionStorage.setItem(k, v)); sessionStorage.setItem('__dup', '1'); } }, sess1);
      await p3.goto(L.BASE + '#/profile'); await L.sleep(300);
      c('tab 3: signed in to A2 on #/profile', (await L.st(p3)).userPhone === A2 && (await L.H(p3)) === '#/profile');
      await p3.evaluate(k => { const u = JSON.parse(localStorage.getItem(k)); delete u['597777777']; localStorage.setItem(k, JSON.stringify(u)); }, USERS);
      const wrote = await p3.evaluate(k => { SlicePay.orders.save({ id: '999001', status: 'processing' }); SlicePay.orders.list(); return JSON.parse(localStorage.getItem(k) || '{}'); }, ORD);
      c('stale session: SP.orders.save / list write nothing for a phone with no account', !(wrote['597777777'] || []).some(o => o.id === '999001'), Object.keys(wrote));
      await p3.fill('#pf-first', 'ზომბი'); await p3.click('#pf-save'); await L.sleep(300);
      c('stale session: ᲨᲔᲜᲐᲮᲕᲐ ends the session (toast, → login), no record re-created', (await L.H(p3)) === '#/login?next=/profile' && (await L.toast(p3)) === 'ანგარიშის მონაცემები შეიცვალა. გთხოვთ, ხელახლა შეხვიდეთ' && !(await p3.evaluate(k => JSON.parse(localStorage.getItem(k))['597777777'], USERS)), [await L.H(p3), await L.toast(p3)]);
      // orphan orders under a free number (an older build's leftovers) are never inherited by a new account
      await p2.evaluate(k => { const o = JSON.parse(localStorage.getItem(k) || '{}'); o['591111111'] = [{ id: '272132', status: 'processing', date: '2026-10-07', createdAt: 1, delivery: { recipient: 'ანა ლომიძე' } }]; localStorage.setItem(k, JSON.stringify(o)); }, ORD);
      const r3 = await p2.evaluate(a => SlicePay.api.startRegistration({ first: 'გელა', last: 'გელაშვილი', phone: a, email: 'c@example.com', password: 'cpass1234' }), A);
      const v3 = await p2.evaluate(code => SlicePay.api.verify(code), r3.code);
      await L.go(p2, '#/orders'); await L.sleep(250);
      const os = await p2.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), ORD);
      c('new owner of the freed number: no previous orders (orphan key dropped, none rendered)', r3.ok && v3.ok && !(os[A] || []).length && !(await p2.$('.ord-card')) && !(await L.appText(p2)).includes('ანა ლომიძე'), [r3.ok, v3.ok, os[A]]);
      // the demo number is reserved: a real user cannot take it
      const rd = await p2.evaluate(() => SlicePay.api.startRegistration({ first: 'x', last: 'y', phone: '555123456', email: 'x@example.com', password: 'xpass1234' }));
      const pd = await p2.evaluate(() => SlicePay.api.startPhoneChange('555 123 456'));
      c('demo number 555 123 456 reserved (register + phone change refuse it)', !rd.ok && rd.error === 'exists' && !pd.ok && pd.error === 'exists', [rd, pd]);
      await p2.close(); await p3.close();
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    c('no console errors / network requests', errs.length === 0, errs);
    lg.summary();
    await ctx.close();
  }
  /* ---------------- v4 finish r2 (v4f-r2-01 / V4F-REV2-01, -02, -04, -05, v4f-r2-05): a session belongs to the
     account RECORD (rec.uid ↔ state.userUid), not to whoever holds its number later. A tab that missed the 'storage'
     event (left the app, restored, discarded) and comes back after its number was freed and taken by someone else
     must land on the login screen, never in the other person's account. ---------------- */
  {
    const errs = allErrs['recycled'] = [];
    const lg = L.mkLog('profile recycled number');
    const c = (n, ok, d) => lg.check(n, ok, d);
    const { ctx, p } = await L.newCtx(b, 1440, errs, { clock: T0 });
    const A = '595000001', A2 = '595000002', X = '595000009';
    const ENDED = 'ანგარიშის მონაცემები შეიცვალა. გთხოვთ, ხელახლა შეხვიდეთ';
    const reg = (pg, ph, f) => pg.evaluate(([ph, f]) => { const S = SlicePay; S.reset({ signOut: true, go: false }); const r = S.api.startRegistration({ phone: ph, first: f, last: 'ტესტი', email: 'x' + ph + '@example.com', password: 'password1' }); return S.api.verify(r.code); }, [ph, f]);
    const dup = async sess => { const q = await ctx.newPage(); L.hook(q, errs, 'dup '); await q.addInitScript(e => { if (!sessionStorage.getItem('__dup')) { e.forEach(([k, v]) => sessionStorage.setItem(k, v)); sessionStorage.setItem('__dup', '1'); } }, sess); return q; };
    try {
      await p.goto(L.BASE + '#/'); await L.sleep(200);
      c('tab X: A registered, the session holds the record uid', (await reg(p, A, 'ანა')).ok && await p.evaluate(([k, a]) => { const u = JSON.parse(localStorage.getItem(k))[a]; return !!u.uid && SlicePay.state().userUid === u.uid; }, [USERS, A]));
      await p.evaluate(() => { const d = SlicePay.state().delivery; d.first = 'ანა'; d.pid = '12345678901'; SlicePay.save(); });
      await L.go(p, '#/profile'); await L.sleep(200);
      const sessA = await p.evaluate(() => Object.entries(sessionStorage));
      await p.goto('about:blank'); await L.sleep(100);   // tab X leaves the app: it gets no 'storage' events now
      // tab Y: A moves A → A2 (the uid moves with the record); C registers the freed A and has an order
      const py = await ctx.newPage(); L.hook(py, errs, 'y ');
      await py.goto(L.BASE + '#/'); await L.sleep(200);
      const mv = await py.evaluate(([A, A2]) => { const S = SlicePay; S.reset({ signOut: true, go: false }); S.signIn(A); const uid = S.state().userUid; const s = S.api.startPhoneChange(A2); const v = S.api.verifyPhoneChange(s.code); return { ok: v.ok, kept: S.state().userUid === uid && S.isAuthed() }; }, [A, A2]);
      c('tab Y: A moved to A2, the session (uid) still valid', mv.ok && mv.kept, mv);
      c('tab Y: C registered the freed number A', (await reg(py, A, 'ცირა')).ok);
      await py.evaluate(() => SlicePay.orders.save({ id: '611611', status: 'processing', date: '2026-10-07', createdAt: 1, products: [], delivery: { recipient: 'ცირა ტესტი' } }));
      // (a) tab X: Back into the app
      await p.goBack(); await L.sleep(400);
      const sx = await p.evaluate(() => ({ h: location.hash, u: SlicePay.state().userPhone, pid: SlicePay.state().delivery.pid, authed: SlicePay.isAuthed() }));
      c('(a) Back after the number was recycled → #/login?next=/profile + toast, not C\'s account', sx.h === '#/login?next=/profile' && !sx.u && !sx.authed && sx.pid === '' && (await L.toast(p)) === ENDED && !(await L.appText(p)).includes('ცირა'), [sx, await L.toast(p)]);
      // (b) a restored tab (A's sessionStorage) booted on #/orders: login, toast, C's order never read
      const pr = await dup(sessA);
      await pr.goto(L.BASE + '#/orders'); await L.sleep(400);
      c('(b) restored tab on #/orders → #/login?next=/orders + toast, no orders read', (await L.H(pr)) === '#/login?next=/orders' && (await L.toast(pr)) === ENDED && !(await L.appText(pr)).includes('611611') && (await pr.evaluate(() => SlicePay.orders.list().length)) === 0, [await L.H(pr), await L.toast(pr)]);
      await pr.close();
      // (c) a stale session that is still in memory (no route handle / 'storage' event has ended it yet) used through
      // the API: nothing of C's account is read or changed
      const api = await py.evaluate(([A, sess]) => {
        const S = SlicePay, st = S.state(), old = JSON.parse(sess.find(([k]) => k === 'slicepay:v1:state')[1]);
        st.userPhone = A; st.userUid = old.userUid;   // tab X's session, as restored
        const r = { authed: S.isAuthed(), prof: S.api.getProfile(), up: S.api.updateProfile({ first: 'x', last: 'y', email: 'z@example.com' }).error,
          sp: S.api.startPhoneChange('595000003').error, orders: S.orders.list().length };
        S.orders.save({ id: '633633', status: 'processing' });
        st.userPhone = null; st.userUid = null; S.save();
        return r;
      }, [A, sessA]);
      const cOrders = await py.evaluate(([k, a]) => (JSON.parse(localStorage.getItem(k))[a] || []).map(o => o.id), [ORD, A]);
      c('(c) a stale session is not authed, reads no profile / orders, cannot edit / re-key / write to C\'s account', !api.authed && api.prof === null && api.up === 'auth' && api.sp === 'auth' && api.orders === 0 && cOrders.join() === '611611' && (await py.evaluate(([k, a]) => JSON.parse(localStorage.getItem(k))[a].first, [USERS, A])) === 'ცირა', [api, cOrders]);
      // (d) a session saved by an older build (no userUid) is ended once, not adopted
      await py.evaluate(() => { const S = SlicePay; S.reset({ signOut: true, go: false }); S.signIn('595000002'); });
      const legacy = (await py.evaluate(() => Object.entries(sessionStorage))).map(([k, v]) => { if (k !== 'slicepay:v1:state') return [k, v]; const s = JSON.parse(v); delete s.userUid; return [k, JSON.stringify(s)]; });
      const pl = await dup(legacy);
      await pl.goto(L.BASE + '#/profile'); await L.sleep(400);
      c('(d) an older build\'s session (no uid) → login + toast once', (await L.H(pl)) === '#/login?next=/profile' && (await L.toast(pl)) === ENDED && !(await pl.evaluate(() => SlicePay.state().userPhone)), [await L.H(pl), await L.toast(pl)]);
      await pl.close();
      // V4F-REV2-04: a ?demo=1 URL signs in to the demo account properly — the previous account's receipt goes
      await py.evaluate(() => { SlicePay.state().order = { id: '622622', status: 'processing', products: [], delivery: { recipient: 'Carol Private' } }; SlicePay.save(); });
      await L.go(py, '#/orders?demo=1'); await L.sleep(250);
      const sd = await py.evaluate(() => { const s = SlicePay.state(); return { u: s.userPhone, order: s.order, authed: SlicePay.isAuthed() }; });
      c('V4F-REV2-04: ?demo=1 → demo session, no receipt of the previous account', sd.u === '555123456' && sd.authed && !sd.order, sd);
      await py.close();

      // v4f-r2-02: a resend to a number that was taken meanwhile is refused, with the message on #pf-code
      await reg(p, X, 'ნინო'); await L.go(p, '#/profile'); await L.sleep(200);
      await p.click('#pf-phone-open'); await p.fill('#pf-phone-new', '595 000 008'); await p.click('#pf-send'); await L.sleep(250);
      c('code step for 595 000 008', !!(await p.$('#pf-code')), await L.H(p));
      const pz = await ctx.newPage(); L.hook(pz, errs, 'z ');
      await pz.goto(L.BASE + '#/'); await L.sleep(200);
      c('another tab registers 595 000 008', (await reg(pz, '595000008', 'ზურა')).ok);
      await pz.close();
      await p.clock.fastForward(31000); await L.sleep(350);
      const before = await L.toast(p);
      await p.click('#pf-resend'); await L.sleep(250);
      const rs = await p.evaluate(() => SlicePay.api.resendPhoneChange());
      c('v4f-r2-02: resend → ეს ნომერი უკვე დარეგისტრირებულია on #pf-code, no new code', (await err('pf-code')) === 'ეს ნომერი უკვე დარეგისტრირებულია' && rs.error === 'exists' && !rs.code && (await p.getAttribute('#pf-code', 'aria-invalid')) === 'true', [await err('pf-code'), rs, before]);
      // V4F-REV2-05: with the record gone under the session every phone-change call answers 'auth'
      await p.evaluate(([k, x]) => { const u = JSON.parse(localStorage.getItem(k)); u.__keep = u[x]; delete u[x]; localStorage.setItem(k, JSON.stringify(u)); }, [USERS, X]);
      const au = await p.evaluate(() => { const S = SlicePay.api; return [S.startPhoneChange('595000007').error, S.resendPhoneChange().error, S.verifyPhoneChange('1234').error]; });
      c('V4F-REV2-05: start / resend / verify phone change → auth without the record', au.every(e => e === 'auth'), au);
      // v4f-r2-05: a stored status that is an Object.prototype key reads as processing
      const pills = await p.evaluate(() => ['constructor', 'toString', '__proto__', 'hasOwnProperty'].map(s => { const o = { status: s, deferred: {} }; const pl = SlicePay.orderPill(o), tl = SlicePay.orderTimeline(o); return typeof pl.label + ':' + pl.label + ':' + tl[0].state; }));
      c('v4f-r2-05: orderPill / orderTimeline treat prototype keys as unknown (მუშავდება, first step current)', pills.every(x => x === 'string:მუშავდება:current'), pills);
    } catch (e) { lg.check('script error', false, String(e.stack || e).slice(0, 400)); }
    const err2 = errs.filter(e => !/order id .* is taken/.test(e));
    c('no console errors / network requests', err2.length === 0, err2);
    lg.summary();
    await ctx.close();
    function err(id) { return p.evaluate(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent.trim() : null; }, id); }
  }

  /* ---------------- v4 finish r3 (v4f-r3-01 / V4F-REV3-01): a password recovery belongs to the account RECORD the
     code was sent for (state.recover.uid), not to whoever holds the number later, and it expires after
     SP.VERIFY_TTL. Tab 1 starts a recovery for A; A moves to another number in tab 2 and C registers the freed
     number; the old code must not change C's password. ---------------- */
  {
    const errs = allErrs['recover-recycled'] = [];
    const lg = L.mkLog('profile recover recycled');
    const c = (n, ok, d) => lg.check(n, ok, d);
    const { ctx, p } = await L.newCtx(b, 428, errs, { clock: T0 });
    const NOUSER = 'ამ ნომრით მომხმარებელი არ არსებობს', EXPIRED = 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი', DONE = 'პაროლი წარმატებით შეიცვალა';
    const reg = (pg, ph, f) => pg.evaluate(([ph, f]) => { const S = SlicePay; S.reset({ signOut: true, go: false }); const r = S.api.startRegistration({ phone: ph, first: f, last: 'ტესტი', email: 'x' + ph + '@example.com', password: 'ownpass' + ph.slice(-2) }); return S.api.verify(r.code); }, [ph, f]);
    const rekey = (pg, to) => pg.evaluate(to => { const S = SlicePay; const s = S.api.startPhoneChange(to); const v = S.api.verifyPhoneChange(s.code); S.reset({ signOut: true, go: false }); return v.ok; }, to);
    const rec = pg => pg.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), USERS);
    const err = (pg, id) => pg.evaluate(i => { const e = document.getElementById(i + '-err'); return e ? e.textContent.trim() : null; }, id);
    const startRecovery = async (pg, ph) => { await L.go(pg, '#/recover'); await L.sleep(200); await pg.fill('#rec-phone', ph); await pg.click('#auth-submit'); await L.sleep(300); return pg.evaluate(() => SlicePay.state().recover); };
    const submitCode = async (pg, code, pw) => { await pg.fill('#code', code); await pg.fill('#new-pass', pw); await pg.fill('#new-pass2', pw); await pg.click('#auth-submit'); await L.sleep(350); };
    const A = '596000001', A2 = '596000002', B = '596000011', B2 = '596000012', E = '596000021';
    try {
      await p.goto(L.BASE + '#/'); await L.sleep(200);
      const p2 = await ctx.newPage(); L.hook(p2, errs, 'tab2 ');
      await p2.goto(L.BASE + '#/'); await L.sleep(200);
      c('A registered (tab 2)', (await reg(p2, A, 'ანა')).ok);
      await p2.evaluate(() => SlicePay.reset({ signOut: true, go: false }));
      // (1) tab 1, signed out: recovery for A → bound to A's record, with an expiry
      const r1 = await startRecovery(p, A);
      const uidA = (await rec(p))[A].uid;
      c('recovery bound to A\'s record uid + expiresAt = sentAt + 5 min', (await L.H(p)) === '#/recover/code' && r1.uid === uidA && r1.expiresAt === r1.sentAt + 5 * 60000, r1);
      // (2) tab 2: A → A2, signs out; C registers the freed A
      c('tab 2: A moved A → A2', await p2.evaluate(a => { SlicePay.signIn(a); return true; }, A) && await rekey(p2, A2));
      c('tab 2: C registered the freed number A', (await reg(p2, A, 'ცირა')).ok);
      await p2.evaluate(() => SlicePay.reset({ signOut: true, go: false }));
      const cBefore = (await rec(p))[A];
      // (3) tab 1: the old code + a new password → refused, back to the number step, C untouched
      await submitCode(p, r1.code, 'hijacked1');
      const cAfter = (await rec(p))[A];
      c('old recovery: no success toast, back to #/recover with the "no user" error', (await L.H(p)) === '#/recover' && (await err(p, 'rec-phone')) === NOUSER && !(await L.toast(p)).includes(DONE), [await L.H(p), await err(p, 'rec-phone'), await L.toast(p)]);
      c('old recovery: C\'s record unchanged (uid, password hash, profile), the recovery dropped', cAfter.uid === cBefore.uid && cAfter.pass === cBefore.pass && cAfter.first === 'ცირა' && !(await p.evaluate(() => SlicePay.state().recover)), [cBefore.uid, cAfter.uid]);
      const lgn = await p.evaluate(a => [SlicePay.api.login(a, 'hijacked1').ok, SlicePay.api.login(a, 'ownpass01').ok], A);
      c('C: the hijack password refused, C\'s own password works', !lgn[0] && lgn[1], lgn);
      // the API: a recovery for another account's record, or one not bound to an account (an older build's), changes nothing
      const api = await p.evaluate(([a, uidA]) => {
        const S = SlicePay, st = S.state(), out = [S.api.resetPassword(a, 'apiwrite1', uidA).error];
        st.recover = { phone: a, code: '1234', sentAt: Date.now(), expiresAt: Date.now() + 300000 };   // no uid
        out.push(S.api.resetPassword(a, 'apiwrite1').error);
        st.recover = null; S.save();
        out.push(S.api.login(a, 'apiwrite1').ok);
        return out;
      }, [A, uidA]);
      c('resetPassword: another account\'s uid / an unbound recovery → gone, nothing written', api[0] === 'gone' && api[1] === 'gone' && api[2] === false, api);

      // (4) resend after the number was taken by someone else: no new code, the same step back
      c('B registered', (await reg(p2, B, 'ბექა')).ok); await p2.evaluate(() => SlicePay.reset({ signOut: true, go: false }));
      const rb = await startRecovery(p, B);
      await p2.evaluate(a => SlicePay.signIn(a), B); await rekey(p2, B2);
      c('D registered the freed number B', (await reg(p2, B, 'დათო')).ok); await p2.evaluate(() => SlicePay.reset({ signOut: true, go: false }));
      await p.clock.fastForward(31000); await L.sleep(350);
      await p.click('#resend'); await L.sleep(350);
      c('resend for a number now held by another account: no code, #/recover + "no user"', (await L.H(p)) === '#/recover' && (await err(p, 'rec-phone')) === NOUSER && !(await p.evaluate(() => SlicePay.state().recover)) && !!rb, [await L.H(p), await err(p, 'rec-phone')]);
      // a fresh recovery entered now for that number belongs to its current holder D (the number's owner gets the SMS)
      const rd = await startRecovery(p, B);
      c('a new recovery for B is bound to D\'s record', rd && rd.uid === (await rec(p))[B].uid && rd.uid !== rb.uid, [rd, rb]);

      // (5) expiry: the code is refused after SP.VERIFY_TTL; a resend renews it and clears the message
      c('E registered', (await reg(p2, E, 'ეკა')).ok); await p2.evaluate(() => SlicePay.reset({ signOut: true, go: false }));
      const re = await startRecovery(p, E);
      const ePass = (await rec(p))[E].pass;
      await p.clock.fastForward(5 * 60000 + 1000); await L.sleep(350);
      await submitCode(p, re.code, 'lateone1');
      c('expired code → "code expired" on #code, stays, password unchanged', (await L.H(p)) === '#/recover/code' && (await err(p, 'code')) === EXPIRED && (await rec(p))[E].pass === ePass, [await L.H(p), await err(p, 'code')]);
      c('resetPassword after the TTL → expired', (await p.evaluate(a => SlicePay.api.resetPassword(a, 'lateone1').error, E)) === 'expired');
      await p.click('#resend'); await L.sleep(350);
      const re2 = await p.evaluate(() => SlicePay.state().recover);
      c('resend: new code, expiry renewed, message + code cleared', re2.code && re2.sentAt > re.sentAt + 5 * 60000 && re2.expiresAt === re2.sentAt + 5 * 60000 && re2.uid === re.uid && (await err(p, 'code')) === '' && (await p.inputValue('#code')) === '', [re2, await err(p, 'code')]);
      await submitCode(p, re2.code, 'ontime12');
      c('in time: success toast → #/login, E\'s password changed (same uid)', (await L.H(p)) === '#/login' && (await L.toast(p)).includes(DONE) && (await p.evaluate(a => SlicePay.api.login(a, 'ontime12').ok, E)) && (await rec(p))[E].uid === re.uid, [await L.H(p), await L.toast(p)]);

      // (6) the QA seed: bound to the demo record, valid for 5 min
      await L.go(p, '#/recover/code?demo=1'); await L.sleep(250);
      const sd = await p.evaluate(() => { const r = SlicePay.state().recover, u = JSON.parse(localStorage.getItem('slicepay:v1:users'))['555123456']; return { ok: r && r.uid === u.uid && r.expiresAt > Date.now() + 200000 && r.code === '4821' }; });
      c('#/recover/code?demo=1: bound to the demo record, not expired', sd.ok, sd);
      await p2.close();
    } catch (e) { lg.check('script error', false, String(e.stack || e).slice(0, 400)); }
    c('no console errors / network requests', errs.length === 0, errs);
    lg.summary();
    await ctx.close();
  }

  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})();

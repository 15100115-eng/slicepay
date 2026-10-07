// v4 profile editing (#/profile, docs/specs/V4_SPEC.md §B) at 428 and 1440:
//   guard + login next, layout (header link / mobile bar, no overflow), personal info save + validation + escaping,
//   the profile edit reaching the delivery prefill, phone change (required / format / same / taken, wrong / format /
//   expired code, 30 s resend cooldown, reload on the code step, success), re-keying (users store, orders,
//   remember-me, session; orders still visible; login works with the new number and not the old one),
//   password change (required / wrong current / short / mismatch / same, eye reset, success, old password refused),
//   logout (ᲒᲐᲡᲕᲚᲐ) and no console errors / network requests.
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
        const hd = await ev(() => [...document.querySelectorAll('.d-head .acct-link')].filter(a => a.getClientRects().length).map(a => a.textContent + '>' + a.getAttribute('href')));
        c('desktop header: only ჩემი შეკვეთები', hd.join() === 'ჩემი შეკვეთები>#/orders', hd);
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
      c('orders heading link პროფილი → #/profile', (await L.txt(p, '.ord-top__out')) === 'პროფილი');
      await L.vis(p, '.ord-top__out').click(); await L.waitHash(p, /^#\/profile$/); await L.sleep(200);

      /* ---------------- password change ---------------- */
      await p.click('#pw-submit'); await L.sleep(120);
      c('empty → სავალდებულო ველი ×3, focus on მიმდინარე პაროლი', (await err('pw-current')) === 'სავალდებულო ველი' && (await err('pw-new')) === 'სავალდებულო ველი' && (await err('pw-repeat')) === 'სავალდებულო ველი' && (await L.active(p)) === 'pw-current');
      await p.fill('#pw-current', 'wrongpass1'); await p.fill('#pw-new', 'short'); await p.fill('#pw-repeat', 'other'); await p.press('#pw-repeat', 'Enter'); await L.sleep(120);
      c('wrong current / short / mismatch shown together', (await err('pw-current')) === 'მიმდინარე პაროლი არასწორია' && (await err('pw-new')) === 'მინიმუმ 8 სიმბოლო' && (await err('pw-repeat')) === 'პაროლები არ ემთხვევა', [await err('pw-current'), await err('pw-new'), await err('pw-repeat')]);
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
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})();

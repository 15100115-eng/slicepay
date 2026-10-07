/* =====================================================================
   SlicePay — screens/auth.js
   routes: #/register  #/register/verify (v2)  #/login  #/recover  #/recover/code
   QA: register ?terms=1 (box checked) &modal=terms · login ?remember=1
       any ?err=1 (submit-validation errors shown) · recover/code ?demo=1
       register/verify ?demo=1 (pending 555 123 456, code 4821) [&err=1|wrong|expired]
   v2: register → pending registration + SMS code → verify creates the account;
       ?next= is kept across login ↔ register ↔ recover and honoured after sign-in
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, V = SP.valid, M = SP.msg;
  var cooldown = null;   // the resend countdown of the current screen (UI.cooldownLink)
  function stopTimers() { if (cooldown) cooldown.stop(); cooldown = null; }

  /* ---------------- page scaffold ---------------- */
  /** o.any: the back controls return to the previous screen when there is one (else o.back) — used when
      login / register were opened with ?next= from anywhere (e.g. the landing's "შესვლა") */
  function page(o) {
    return '' +
      '<div class="m-page auth-page auth-page--' + o.key + '">' +
        // the designed auth header is back link + centred logo only: no "ჩემი შეკვეთები" account link
        UI.dHead(o.back, { account: false, backAny: !!o.any }) +
        '<main class="auth">' +
          '<form class="auth__form" id="auth-form" novalidate>' +
            '<h1 class="t-h1 auth__h">' + o.heading + '</h1>' +
            (o.lead || '') +
            '<div class="auth__fields">' + o.fields + '</div>' +
            '<div class="auth__spacer"></div>' +
            '<div class="auth__bottom">' +
              (o.check || '') +
              '<div class="m-bar auth__bar">' +
                '<button type="button" class="btn-text only-m" data-back="' + o.back + '"' + (o.any ? ' data-back-any' : '') + '>' + UI.mt('back') + '</button>' +
                '<button type="submit" class="btn" id="auth-submit"><span class="btn__label">' + o.submit + '</span></button>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</main>' +
      '</div>';
  }
  function f(o) { return '<div class="auth__f' + (o.wrapCls ? ' ' + o.wrapCls : '') + '">' + UI.field(o) + '</div>'; }
  /** v2: a safe ?next= carried between login ↔ register ↔ recover ('' when none) */
  function nextOf(ctx) { return (ctx && ctx.query && SP.safeNext(ctx.query.next)) || ''; }
  var withNext = SP.withNext;
  /** register / login go back to the cart, or to the landing when there is no cart (e.g. "შესვლა" on the landing) */
  function authBack() { return SP.authBackTarget(); }
  /** a signed-in user with no registration in progress has nothing to do on #/register — typically
      browser Back from #/delivery onto the register entry left behind by a completed verification.
      (?demo=1 is the QA seed for the register screen with a cart: it signs in, so it stays exempt) */
  function staleRegister(ctx) { return SP.isAuthed() && !SP.state().pendingReg && ctx.query.demo !== '1'; }
  /** the stale register entry is stepped over in the direction of travel (SP.skipEntry, v2f-r2-02): Back from delivery
      goes on back to the screen register was entered from (as in v1, where Back from delivery reached the cart),
      Forward goes on forward to delivery; a fresh / reloaded entry is replaced with the after-sign-in target */
  function leaveRegister(ctx) { SP.skipEntry(SP.afterLoginTarget(ctx.query), authBack()); }
  /** the code toast belongs to the pending number: leaving verify (number change, back, browser Back) drops it (auth-v2r2-01) */
  function dropCodeToast() {
    var t = document.querySelector('#toast-root .toast');
    if (t && /სატესტო კოდი/.test(t.textContent)) t.click();   // the toast's own click handler hides it
  }
  var PHONE = { label: 'ტელეფონის ნომერი', type: 'tel', inputmode: 'tel', autocomplete: 'tel' };   // no maxlength: it would cut pasted '+995 555 12 34 56' before SP.fmt.phone normalises it
  function phoneField(id, extra) { var o = { id: id }; for (var k in PHONE) o[k] = PHONE[k]; for (var e in extra || {}) o[e] = extra[e]; return o; }

  /* ---------------- renderers ---------------- */
  function renderRegister(ctx) {
    // v2 "ნომრის შეცვლა": the pending registration refills everything except the password
    var p = SP.state().pendingReg || {};
    var fields =
      '<div class="auth__names">' +
        f({ id: 'reg-first', label: 'სახელი', autocomplete: 'given-name', value: p.first }) +
        f({ id: 'reg-last', label: 'გვარი', autocomplete: 'family-name', value: p.last }) +
      '</div>' +
      f(phoneField('reg-phone', { noErr: true, describedby: 'reg-phone-err', value: p.phone ? SP.fmt.phone(p.phone) : '' })) +
      '<p class="t-note auth__note" id="reg-phone-err" aria-live="polite">*შეკვეთის შესახებ ინფორმაციას მიიღებთ ამ ნომერზე</p>' +
      f({ id: 'reg-pass', label: 'პაროლი', type: 'password', eye: true, autocomplete: 'new-password', wrapCls: 'auth__f--after-note' }) +
      f({ id: 'reg-email', label: 'ელ.პოსტა', type: 'email', inputmode: 'email', autocomplete: 'email', value: p.email }) +
      '<p class="t-body auth__prompt">გაქვს ანგარიში? <a class="link" href="#' + SP.esc(withNext('/login', nextOf(ctx))) + '">გაიარე ავტორიზაცია</a></p>';
    var check =
      '<div class="auth__check">' +
        // built by hand (not UI.checkbox): a <button> must not sit inside the checkbox's <label>
        '<div class="check check--auth">' +
          '<input type="checkbox" id="reg-terms"' + (ctx.query.terms === '1' || p.phone ? ' checked' : '') + ' aria-labelledby="reg-terms-l reg-terms-doc" aria-describedby="reg-terms-err" aria-required="true">' +
          '<label class="check__box" for="reg-terms" aria-hidden="true"></label>' +   // box stays clickable
          '<span class="check__label"><label for="reg-terms" id="reg-terms-l">გავეცანი და ვეთანხმები</label> <button type="button" class="link" id="reg-terms-doc" data-terms>წესებსა და პირობებს</button></span>' +
        '</div>' +
        '<p class="err" id="reg-terms-err" aria-live="polite"></p>' +
      '</div>';
    if (staleRegister(ctx)) return '<div class="m-page auth-page auth-page--register"></div>';
    return page({ key: 'register', back: authBack(), any: !!nextOf(ctx), heading: 'პირადი ინფორმაცია<span class="sr-only"> — რეგისტრაცია</span>', fields: fields, check: check, submit: UI.mt('next') });
  }
  function renderLogin(ctx) {
    var remembered = SP.api.remembered();
    var prefill = SP.state().loginPhone || remembered;   // just-recovered number wins over the remembered one
    var next = nextOf(ctx);
    var fields =
      f(phoneField('log-phone', { value: prefill ? SP.fmt.phone(prefill) : '' })) +
      f({ id: 'log-pass', label: 'პაროლი', type: 'password', eye: true, autocomplete: 'current-password' }) +
      '<p class="t-body auth__link-row"><a class="link" href="#' + SP.esc(withNext('/recover', next)) + '">პაროლის აღდგენა</a></p>' +
      '<p class="t-body auth__prompt auth__prompt--login">თუ არ გაქვს ანგარიში <a class="link" href="#' + SP.esc(withNext('/register', next)) + '">დარეგისტრირდი</a></p>';
    var check = '<div class="auth__check">' + UI.checkbox({ variant: 'auth', id: 'log-remember', checked: ctx.query.remember === '1' || !!remembered, label: 'პაროლის დამახსოვრება' }) + '</div>';
    return page({ key: 'login', back: authBack(), any: !!next, heading: 'პირადი ინფორმაცია<span class="sr-only"> — ავტორიზაცია</span>', fields: fields, check: check, submit: UI.mt('next') });
  }
  function renderRecover() {
    var rec = SP.state().recover;
    return page({ key: 'recover', back: '/login', heading: 'პაროლის აღდგენა<span class="sr-only"> — ნომრის მითითება</span>', fields: f(phoneField('rec-phone', { value: rec ? SP.fmt.phone(rec.phone) : '' })), submit: UI.mt('sendCode') });
  }
  function renderCode() {
    var fields =
      // no maxlength on #code: the browser would cut a pasted ' 4821' before the input handler strips non-digits (it clamps to 4)
      f({ id: 'code', label: 'აქტივაციის კოდი', inputmode: 'numeric', autocomplete: 'one-time-code' }) +
      '<p class="t-body auth__resend"><button type="button" class="link" id="resend">კოდის ხელახლა გამოგზავნა</button></p>' +
      '<hr class="auth__div">' +
      f({ id: 'new-pass', label: 'ახალი პაროლი', type: 'password', autocomplete: 'new-password', wrapCls: 'auth__f--after-div' }) +
      f({ id: 'new-pass2', label: 'პაროლის გამეორება', type: 'password', autocomplete: 'new-password' });
    return page({ key: 'code', back: '/recover', heading: 'პაროლის აღდგენა<span class="sr-only"> — ახალი პაროლი</span>', fields: fields, submit: UI.mt('restore') });
  }
  /** v2 #/register/verify — the recover-code layout: lead line with the number, code field, resend + change-number links */
  function renderVerify() {
    var p = SP.state().pendingReg || {};
    var lead = '<p class="t-body auth__lead" id="verify-lead">SMS კოდი გამოგზავნილია ნომერზე <b class="auth__phone">' + SP.esc(SP.fmt.phone(p.phone || '')) + '</b></p>';
    var fields =
      // maxlength 4 (spec); a pasted ' 4821' / '48-21' is normalised by the paste handler before the browser clamps it
      f({ id: 'verify-code', label: 'SMS კოდი', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 4, describedby: 'verify-lead verify-code-err' }) +
      '<div class="t-body auth__links">' +
        '<button type="button" class="link" id="verify-resend">კოდის ხელახლა გამოგზავნა</button>' +
        '<a class="link auth__change" href="#/register" data-back="/register">ნომრის შეცვლა</a>' +
      '</div>';
    return page({ key: 'verify', back: '/register', heading: 'ტელეფონის დადასტურება', lead: lead, fields: fields, submit: UI.mt('confirm') });
  }

  /* ---------------- generic form wiring ---------------- */
  /** rules: {id: fn(value, input) → message|''} */
  function wire(root, rules, onSubmit, opts) {
    opts = opts || {};
    var form = root.querySelector('#auth-form');
    var touched = {};
    var serverErr = {};   // errors returned by the (mock) backend: kept until the user edits that field
    function setErr(id, msg) {
      delete serverErr[id];
      var input = document.getElementById(id);
      if (opts.setErr && opts.setErr(id, msg, input)) return;
      if (input && input.type === 'checkbox') {
        var err = document.getElementById(id + '-err');
        if (err) err.textContent = msg || '';
        input.closest('.check').classList.toggle('is-invalid', !!msg);
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        return;
      }
      UI.setError(input, msg);
    }
    /* one submit at a time (v2f-r2-01): a double click / double Enter must not run onSubmit twice — the second run
       would act on a screen the first one already navigated away from. Released when onSubmit reports an error
       (setServerErr) or the user edits a field; a successful submit navigates and the next mount wires afresh */
    var busy = false;
    function setServerErr(id, msg) { busy = false; setErr(id, msg); if (msg) serverErr[id] = msg; }
    function markServer(id) { serverErr[id] = true; }
    function check(id) { var i = document.getElementById(id); var m = rules[id](i.type === 'checkbox' ? i.checked : i.value, i); setErr(id, m); return m; }
    function validateAll() {
      var first = null;
      Object.keys(rules).forEach(function (id) { touched[id] = true; if (check(id) && !first) first = id; });
      return first;
    }
    /* A blur caused by pressing a link / button must not validate before that press becomes a click: the new
       error line would push the links below the field (e.g. verify "კოდის ხელახლა გამოგზავნა" / "ნომრის შეცვლა",
       login "პაროლის აღდგენა") down ~21 px between pointerdown and click, and the click would miss them.
       Such blurs are held until the click: a press on a link / text button / submit drops them (the user is
       leaving, resending or submitting — submit validates everything anyway); any other target runs them then.
       Touch moves focus only after pointerup, so the press stays "in progress" until its click (or a timeout). */
    var pressing = false, held = [], pressTimer = null;
    function runHeld() {
      var ids = held; held = []; pressing = false; clearTimeout(pressTimer);
      ids.forEach(function (id) {
        var i = document.getElementById(id);
        // still this screen, the field not re-focused (e.g. resend focuses the cleared code field) and no server error
        if (!i || !root.contains(i) || document.activeElement === i || serverErr[id]) return;
        check(id);
      });
    }
    function endPress() {
      // registered as a pair: whichever fires, the other must go too, or one listener per press stays on document
      document.removeEventListener('pointerup', endPress, true);
      document.removeEventListener('pointercancel', endPress, true);
      clearTimeout(pressTimer); pressTimer = setTimeout(runHeld, 500);
    }
    root.addEventListener('pointerdown', function () {
      pressing = true; clearTimeout(pressTimer);
      document.addEventListener('pointerup', endPress, { once: true, capture: true });
      document.addEventListener('pointercancel', endPress, { once: true, capture: true });
    }, true);
    root.addEventListener('click', function (e) {
      if (!pressing && !held.length) return;
      var t = e.target.closest && e.target.closest('a[href], [data-back], .link, .btn-text, [type="submit"]');
      if (t && root.contains(t)) { held = []; pressing = false; clearTimeout(pressTimer); return; }
      setTimeout(runHeld, 0);
    }, true);
    Object.keys(rules).forEach(function (id) {
      var i = document.getElementById(id);
      if (!i) return;
      // format-only re-validation on blur must not wipe a server error (the line would collapse and swallow the next click)
      i.addEventListener('blur', function () {
        if (serverErr[id]) return;
        if (i.type !== 'checkbox' && (i.value || touched[id])) {
          touched[id] = true;
          if (pressing) { if (held.indexOf(id) < 0) held.push(id); return; }
          check(id);
        }
      });
      i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', function () { busy = false; setErr(id, ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var first = validateAll();
      if (first) { document.getElementById(first).focus(); return; }
      busy = true;
      onSubmit(setServerErr);
    });
    return { validateAll: validateAll, setErr: setErr, check: check, markServer: markServer };
  }
  function req(msg) { return function (v) { return String(v).trim() ? '' : msg || M.required; }; }
  function phoneRule(v) { return !String(v).trim() ? M.required : V.phone(v) ? '' : M.phone; }
  function passRule(v) { return !v ? M.required : V.password(v) ? '' : M.password; }

  /* ---------------- mounts ---------------- */
  function mountRegister(root, ctx) {
    if (staleRegister(ctx)) { leaveRegister(ctx); return; }
    UI.bindPhone(root.querySelector('#reg-phone'));
    var NOTE = '*შეკვეთის შესახებ ინფორმაციას მიიღებთ ამ ნომერზე';
    var w = wire(root, {
      'reg-first': req(), 'reg-last': req(),
      'reg-phone': phoneRule,
      'reg-pass': passRule,
      'reg-email': function (v) { return !String(v).trim() ? M.required : V.email(v) ? '' : M.email; },
      'reg-terms': function (v) { return v ? '' : M.terms; }
    }, function (setErr) {
      var phone = V.phone(root.querySelector('#reg-phone').value);
      var prev = SP.state().pendingReg;
      // v2: no account yet — a pending registration + an SMS code; the account is created on #/register/verify.
      // A number still inside its 30 s resend cooldown keeps the code it was sent (the API's per-phone log, v2f-r2-06)
      var r = SP.api.startRegistration({ phone: phone, first: root.querySelector('#reg-first').value.trim(), last: root.querySelector('#reg-last').value.trim(),
        email: root.querySelector('#reg-email').value.trim(), password: root.querySelector('#reg-pass').value, next: nextOf(ctx) || (prev && prev.next) || null });
      if (!r.ok) { setErr('reg-phone', M.userExists); root.querySelector('#reg-phone').focus(); return; }
      UI.codeToast(r.code);
      SP.go('/register/verify');
    }, {
      // the phone error replaces the orange note in place (no layout shift) — the shared helper (REV2R3-08);
      // its return value only says whether anything changed, the field is handled here either way
      setErr: function (id, msg, input) {
        if (id !== 'reg-phone') return false;
        UI.setNoteError(input, 'reg-phone-err', NOTE, msg);
        return true;
      }
    });
    /* "ნომრის შეცვლა" / back from #/register/verify (auth-v2r3-02): the user came back to change the number, so on
       desktop the router focuses the phone field instead of the h1, with the old number selected so typing replaces
       it. Mobile keeps the h1 (no keyboard popping over the refilled form). */
    var pr = SP.state().pendingReg, phoneIn = root.querySelector('#reg-phone');
    if (pr && pr.phone && ctx.desk && phoneIn.value) {
      phoneIn.setAttribute('data-autofocus', '');
      // the router gives a [data-autofocus] target without tabindex tabindex="-1" (meant for the h1) — that would take
      // the input out of the Tab order; an explicit 0 is what an input has natively
      phoneIn.setAttribute('tabindex', '0');
      // the router focuses [data-autofocus] synchronously right after mount; select only when that happened
      setTimeout(function () { if (document.activeElement === phoneIn) { try { phoneIn.select(); } catch (e) { /* ignore */ } } }, 0);
    }
    root.querySelector('[data-terms]').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      UI.termsModal(function () { var c = document.getElementById('reg-terms'); if (!c) return; c.checked = true; w.setErr('reg-terms', ''); });
    });
    if (ctx.entry && ctx.query.modal === 'terms') UI.termsModal(function () { var c = document.getElementById('reg-terms'); if (!c) return; c.checked = true; w.setErr('reg-terms', ''); });
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
  }

  function mountLogin(root, ctx) {
    UI.bindPhone(root.querySelector('#log-phone'));
    var phoneIn = root.querySelector('#log-phone');
    var w = wire(root, {
      'log-phone': phoneRule,
      'log-pass': function (v) { return v ? '' : M.required; }
    }, function (setErr) {
      var phone = V.phone(phoneIn.value);
      var r = SP.api.login(phone, root.querySelector('#log-pass').value);
      if (!r.ok) {
        // both messages sit under the password field (DESIGN_SYSTEM §login failure); "no user" is about the
        // phone, so the phone field — which gets focus — is marked invalid and described by that message too
        setErr('log-pass', r.error === 'nouser' ? M.noUser : M.loginFail);
        if (r.error === 'nouser') {
          w.markServer('log-phone');
          phoneIn.setAttribute('aria-invalid', 'true');
          phoneIn.setAttribute('aria-describedby', 'log-phone-err log-pass-err');
        }
        (r.error === 'nouser' ? phoneIn : root.querySelector('#log-pass')).focus();
        return;
      }
      SP.api.remember(root.querySelector('#log-remember').checked ? phone : null);
      SP.signIn(phone);
      UI.toast('ავტორიზაცია წარმატებულია');
      SP.go(SP.afterLoginTarget(ctx.query), { replace: true });
    }, {
      // any change to the phone's error state (edit, re-validation) drops a stale login-failure message
      setErr: function (id) {
        if (id !== 'log-phone') return false;
        phoneIn.setAttribute('aria-describedby', 'log-phone-err');
        var pe = document.getElementById('log-pass-err');
        if (pe && (pe.textContent === M.noUser || pe.textContent === M.loginFail)) w.setErr('log-pass', '');
        return false;
      }
    });
    // editing the password drops the "no such user" message (wire's input handler); the phone's invalid
    // state and describedby that pointed at that message must go with it
    root.querySelector('#log-pass').addEventListener('input', function () {
      if (phoneIn.getAttribute('aria-describedby') !== 'log-phone-err') w.setErr('log-phone', '');
    });
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
  }

  function mountRecover(root, ctx) {
    UI.bindPhone(root.querySelector('#rec-phone'));
    var w = wire(root, { 'rec-phone': phoneRule }, function (setErr) {
      var phone = V.phone(root.querySelector('#rec-phone').value);
      if (!SP.api.userExists(phone)) { setErr('rec-phone', M.noUser); root.querySelector('#rec-phone').focus(); return; }
      // same phone inside the 30 s cooldown → back to the pending recovery, no new code
      var rec = SP.state().recover;
      if (rec && rec.phone === phone && Date.now() - rec.sentAt < 30000) { UI.codeToast(rec.code); SP.go(withNext('/recover/code', nextOf(ctx))); return; }
      UI.codeToast(SP.api.sendCode(phone));
      SP.go(withNext('/recover/code', nextOf(ctx)));
    });
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
  }

  function mountCode(root, ctx) {
    stopTimers();   // a re-render of this route must not leave a second countdown running
    var codeIn = root.querySelector('#code');
    codeIn.addEventListener('input', function () { var v = codeIn.value.replace(/\D/g, '').slice(0, 4); if (v !== codeIn.value) codeIn.value = v; });
    var w = wire(root, {
      'code': function (v) { return !String(v).trim() ? M.required : V.code(v) ? '' : M.code; },
      'new-pass': passRule,
      'new-pass2': function (v) { return !v ? M.required : v === root.querySelector('#new-pass').value ? '' : M.match; }
    }, function (setErr) {
      var rec = SP.state().recover;
      if (!rec || codeIn.value.trim() !== rec.code) { setErr('code', M.codeWrong); codeIn.focus(); return; }
      SP.api.resetPassword(rec.phone, root.querySelector('#new-pass').value);
      SP.set({ recover: null, loginPhone: rec.phone });
      SP.go(withNext('/login', nextOf(ctx)));
      UI.toast('პაროლი წარმატებით შეიცვალა');
    });

    // a shown "passwords don't match" error follows edits of the first password too
    root.querySelector('#new-pass').addEventListener('input', function () {
      var e2 = document.getElementById('new-pass2-err');
      if (e2 && e2.textContent && root.querySelector('#new-pass2').value) w.check('new-pass2');
    });

    var resend = root.querySelector('#resend');
    cooldown = UI.cooldownLink(resend, 'კოდის ხელახლა გამოგზავნა', function () {
      var rec = SP.state().recover;
      return rec && rec.sentAt ? Math.ceil((rec.sentAt + 30000 - Date.now()) / 1000) : 0;
    });
    resend.addEventListener('click', function () {
      if (resend.getAttribute('aria-disabled') === 'true') return;
      var rec = SP.state().recover;
      UI.codeToast(SP.api.sendCode(rec.phone));
      cooldown.refresh();
    });
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
  }

  function mountVerify(root, ctx) {
    stopTimers();   // one countdown per screen, also across re-renders
    var codeIn = root.querySelector('#verify-code');
    function digits(v) { return String(v).replace(/\D/g, '').slice(0, 4); }
    codeIn.addEventListener('input', function () { var v = digits(codeIn.value); if (v !== codeIn.value) codeIn.value = v; });
    codeIn.addEventListener('paste', function (e) {
      var t = e.clipboardData && e.clipboardData.getData('text');
      if (t == null) return;
      e.preventDefault();
      var a = codeIn.selectionStart, b = codeIn.selectionEnd, v = codeIn.value;
      var nv = digits(v.slice(0, a) + t + v.slice(b));
      codeIn.value = nv;
      try { var c = Math.min(nv.length, a + digits(t).length); codeIn.setSelectionRange(c, c); } catch (x) { /* ignore */ }
      codeIn.dispatchEvent(new Event('input', { bubbles: true }));
    });
    var done = false;   // verified: any later submit of this (already left) screen is ignored (v2f-r2-01)
    var w = wire(root, {
      'verify-code': function (v) { return V.code(String(v).trim()) ? '' : M.code; }
    }, function (setErr) {
      if (done) return;
      var r = SP.api.verify(codeIn.value);
      if (!r.ok) {
        // no pending registration: back to the form — unless a navigation is already under way
        if (r.error === 'none') { if (/^#\/register\/verify(\?|$)/.test(location.hash)) SP.go('/register', { replace: true }); return; }
        setErr('verify-code', r.error === 'expired' ? M.codeExpired : r.error === 'wrong' ? M.codeWrong : r.error === 'exists' ? M.userExists : M.code);
        codeIn.focus();
        return;
      }
      done = true;
      stopTimers();
      UI.toast(SP.toastMsg.verified);
      SP.go(SP.afterRegisterTarget(r.next), { replace: true });
    });

    var resend = root.querySelector('#verify-resend');
    // the same countdown as the recover code screen
    cooldown = UI.cooldownLink(resend, 'კოდის ხელახლა გამოგზავნა', SP.verifyCooldown);
    resend.addEventListener('click', function () {
      if (resend.getAttribute('aria-disabled') === 'true') return;
      var r = SP.api.resendVerify();
      if (!r.ok) { if (r.error === 'none') SP.go('/register', { replace: true }); else cooldown.refresh(); return; }
      UI.codeToast(r.code);
      // the old code (and its expiry / wrong-code message) no longer applies
      codeIn.value = '';
      w.setErr('verify-code', '');
      cooldown.refresh();
      codeIn.focus();
    });
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
    if (ctx.entry && (ctx.query.err === 'wrong' || ctx.query.err === 'expired')) {
      codeIn.value = '1234';
      w.setErr('verify-code', ctx.query.err === 'wrong' ? M.codeWrong : M.codeExpired);
      w.markServer('verify-code');
    }
  }


  SP.route('/register', { screen: 'auth', title: 'რეგისტრაცია', render: renderRegister, mount: mountRegister });
  SP.route('/login', { screen: 'auth', title: 'ავტორიზაცია', render: renderLogin, mount: mountLogin });
  SP.route('/recover', { screen: 'auth', title: 'პაროლის აღდგენა', render: renderRecover, mount: mountRecover });
  SP.route('/register/verify', { screen: 'auth', title: 'ტელეფონის დადასტურება', render: renderVerify, mount: mountVerify, unmount: function () { stopTimers(); dropCodeToast(); } });
  SP.route('/recover/code', { screen: 'auth', title: 'პაროლის აღდგენა', render: renderCode, mount: mountCode, unmount: stopTimers });
})();

/* =====================================================================
   SlicePay — screens/auth.js
   routes: #/register  #/login  #/recover  #/recover/code
   QA: register ?terms=1 (box checked) &modal=terms · login ?remember=1
       any ?err=1 (submit-validation errors shown) · recover/code ?demo=1
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, V = SP.valid, M = SP.msg;
  var cooldownTimer = null;

  /* ---------------- page scaffold ---------------- */
  function page(o) {
    return '' +
      '<div class="m-page auth-page auth-page--' + o.key + '">' +
        UI.dHead(o.back) +
        '<main class="auth">' +
          '<form class="auth__form" id="auth-form" novalidate>' +
            '<h1 class="t-h1 auth__h">' + o.heading + '</h1>' +
            '<div class="auth__fields">' + o.fields + '</div>' +
            '<div class="auth__spacer"></div>' +
            '<div class="auth__bottom">' +
              (o.check || '') +
              '<div class="m-bar auth__bar">' +
                '<button type="button" class="btn-text only-m" data-back="' + o.back + '">' + UI.mt('back') + '</button>' +
                '<button type="submit" class="btn" id="auth-submit"><span class="btn__label">' + o.submit + '</span></button>' +
              '</div>' +
            '</div>' +
          '</form>' +
        '</main>' +
      '</div>';
  }
  function f(o) { return '<div class="auth__f' + (o.wrapCls ? ' ' + o.wrapCls : '') + '">' + UI.field(o) + '</div>'; }
  var PHONE = { label: 'ტელეფონის ნომერი', type: 'tel', inputmode: 'tel', autocomplete: 'tel' };   // no maxlength: it would cut pasted '+995 555 12 34 56' before SP.fmt.phone normalises it
  function phoneField(id, extra) { var o = { id: id }; for (var k in PHONE) o[k] = PHONE[k]; for (var e in extra || {}) o[e] = extra[e]; return o; }

  /* ---------------- renderers ---------------- */
  function renderRegister(ctx) {
    var fields =
      '<div class="auth__names">' +
        f({ id: 'reg-first', label: 'სახელი', autocomplete: 'given-name' }) +
        f({ id: 'reg-last', label: 'გვარი', autocomplete: 'family-name' }) +
      '</div>' +
      f(phoneField('reg-phone', { noErr: true, describedby: 'reg-phone-err' })) +
      '<p class="t-note auth__note" id="reg-phone-err" aria-live="polite">*შეკვეთის შესახებ ინფორმაციას მიიღებთ ამ ნომერზე</p>' +
      f({ id: 'reg-pass', label: 'პაროლი', type: 'password', eye: true, autocomplete: 'new-password', wrapCls: 'auth__f--after-note' }) +
      f({ id: 'reg-email', label: 'ელ.პოსტა', type: 'email', inputmode: 'email', autocomplete: 'email' }) +
      '<p class="t-body auth__prompt">გაქვს ანგარიში? <a class="link" href="#/login">გაიარე ავტორიზაცია</a></p>';
    var check =
      '<div class="auth__check">' +
        // built by hand (not UI.checkbox): a <button> must not sit inside the checkbox's <label>
        '<div class="check check--auth">' +
          '<input type="checkbox" id="reg-terms"' + (ctx.query.terms === '1' ? ' checked' : '') + ' aria-labelledby="reg-terms-l reg-terms-doc" aria-describedby="reg-terms-err" aria-required="true">' +
          '<label class="check__box" for="reg-terms" aria-hidden="true"></label>' +   // box stays clickable
          '<span class="check__label"><label for="reg-terms" id="reg-terms-l">გავეცანი და ვეთანხმები</label> <button type="button" class="link" id="reg-terms-doc" data-terms>წესებსა და პირობებს</button></span>' +
        '</div>' +
        '<p class="err" id="reg-terms-err" aria-live="polite"></p>' +
      '</div>';
    return page({ key: 'register', back: '/cart', heading: 'პირადი ინფორმაცია<span class="sr-only"> — რეგისტრაცია</span>', fields: fields, check: check, submit: UI.mt('next') });
  }
  function renderLogin(ctx) {
    var remembered = SP.api.remembered();
    var prefill = SP.state().loginPhone || remembered;   // just-recovered number wins over the remembered one
    var fields =
      f(phoneField('log-phone', { value: prefill ? SP.fmt.phone(prefill) : '' })) +
      f({ id: 'log-pass', label: 'პაროლი', type: 'password', eye: true, autocomplete: 'current-password' }) +
      '<p class="t-body auth__link-row"><a class="link" href="#/recover">პაროლის აღდგენა</a></p>' +
      '<p class="t-body auth__prompt auth__prompt--login">თუ არ გაქვს ანგარიში <a class="link" href="#/register">დარეგისტრირდი</a></p>';
    var check = '<div class="auth__check">' + UI.checkbox({ variant: 'auth', id: 'log-remember', checked: ctx.query.remember === '1' || !!remembered, label: 'პაროლის დამახსოვრება' }) + '</div>';
    return page({ key: 'login', back: '/cart', heading: 'პირადი ინფორმაცია<span class="sr-only"> — ავტორიზაცია</span>', fields: fields, check: check, submit: UI.mt('next') });
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
    function setServerErr(id, msg) { setErr(id, msg); if (msg) serverErr[id] = msg; }
    function markServer(id) { serverErr[id] = true; }
    function check(id) { var i = document.getElementById(id); var m = rules[id](i.type === 'checkbox' ? i.checked : i.value, i); setErr(id, m); return m; }
    function validateAll() {
      var first = null;
      Object.keys(rules).forEach(function (id) { touched[id] = true; if (check(id) && !first) first = id; });
      return first;
    }
    Object.keys(rules).forEach(function (id) {
      var i = document.getElementById(id);
      if (!i) return;
      // format-only re-validation on blur must not wipe a server error (the line would collapse and swallow the next click)
      i.addEventListener('blur', function () { if (serverErr[id]) return; if (i.type !== 'checkbox' && (i.value || touched[id])) { touched[id] = true; check(id); } });
      i.addEventListener(i.type === 'checkbox' ? 'change' : 'input', function () { setErr(id, ''); });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = validateAll();
      if (first) { document.getElementById(first).focus(); return; }
      onSubmit(setServerErr);
    });
    return { validateAll: validateAll, setErr: setErr, check: check, markServer: markServer };
  }
  function req(msg) { return function (v) { return String(v).trim() ? '' : msg || M.required; }; }
  function phoneRule(v) { return !String(v).trim() ? M.required : V.phone(v) ? '' : M.phone; }
  function passRule(v) { return !v ? M.required : V.password(v) ? '' : M.password; }

  function afterAuth(msg) {
    UI.toast(msg);
    SP.go(SP.state().products.length ? '/payment' : '/', { replace: true });
  }

  /* ---------------- mounts ---------------- */
  function mountRegister(root, ctx) {
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
      var r = SP.api.register({ phone: phone, first: root.querySelector('#reg-first').value.trim(), last: root.querySelector('#reg-last').value.trim(),
        email: root.querySelector('#reg-email').value.trim(), password: root.querySelector('#reg-pass').value });
      if (!r.ok) { setErr('reg-phone', M.userExists); root.querySelector('#reg-phone').focus(); return; }
      SP.set({ userPhone: phone });
      afterAuth('რეგისტრაცია წარმატებით დასრულდა');
    }, {
      // the phone error replaces the orange note in place (no layout shift)
      setErr: function (id, msg, input) {
        if (id !== 'reg-phone') return false;
        var note = document.getElementById('reg-phone-err');
        var t = msg || NOTE;
        if (note.textContent !== t) note.textContent = t;
        note.classList.toggle('is-error', !!msg);
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
        return true;
      }
    });
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
      SP.set({ userPhone: phone, loginPhone: null });
      afterAuth('ავტორიზაცია წარმატებულია');
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
      if (rec && rec.phone === phone && Date.now() - rec.sentAt < 30000) { UI.codeToast(rec.code); SP.go('/recover/code'); return; }
      UI.codeToast(SP.api.sendCode(phone));
      SP.go('/recover/code');
    });
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
  }

  function mountCode(root, ctx) {
    clearTimeout(cooldownTimer);   // a re-render of this route must not leave a second countdown running
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
      SP.go('/login');
      UI.toast('პაროლი წარმატებით შეიცვალა');
    });

    // a shown "passwords don't match" error follows edits of the first password too
    root.querySelector('#new-pass').addEventListener('input', function () {
      var e2 = document.getElementById('new-pass2-err');
      if (e2 && e2.textContent && root.querySelector('#new-pass2').value) w.check('new-pass2');
    });

    var resend = root.querySelector('#resend');
    function tick() {
      var rec = SP.state().recover;
      var left = rec && rec.sentAt ? Math.ceil((rec.sentAt + 30000 - Date.now()) / 1000) : 0;
      if (left > 0) {
        resend.setAttribute('aria-disabled', 'true');
        resend.textContent = 'კოდის ხელახლა გამოგზავნა (0:' + String(left).padStart(2, '0') + ')';
        cooldownTimer = setTimeout(tick, 250);
      } else {
        resend.removeAttribute('aria-disabled');
        resend.textContent = 'კოდის ხელახლა გამოგზავნა';
      }
    }
    resend.addEventListener('click', function () {
      if (resend.getAttribute('aria-disabled') === 'true') return;
      var rec = SP.state().recover;
      UI.codeToast(SP.api.sendCode(rec.phone));
      clearTimeout(cooldownTimer); tick();
    });
    tick();
    if (ctx.entry && ctx.query.err === '1') w.validateAll();
  }

  function stopTimers() { clearTimeout(cooldownTimer); }

  SP.route('/register', { screen: 'auth', title: 'რეგისტრაცია', render: renderRegister, mount: mountRegister });
  SP.route('/login', { screen: 'auth', title: 'ავტორიზაცია', render: renderLogin, mount: mountLogin });
  SP.route('/recover', { screen: 'auth', title: 'პაროლის აღდგენა', render: renderRecover, mount: mountRecover });
  SP.route('/recover/code', { screen: 'auth', title: 'პაროლის აღდგენა', render: renderCode, mount: mountCode, unmount: stopTimers });
})();

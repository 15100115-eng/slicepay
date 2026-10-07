/* =====================================================================
   SlicePay — screens/profile.js   route: #/profile   (docs/specs/V4_SPEC.md §B)
   Not in the Figma file: built from the orders / delivery language — white
   mobile page + bottom bar ᲣᲙᲐᲜ, desktop #f4f4f4 page with the standard
   header and the orders' centred 645 px column; white section cards
   (cart-card style) with 16/24 semibold section labels and the auth fields.
   Sections:
     1. პირადი ინფორმაცია — first / last (side by side) + e-mail; ᲨᲔᲜᲐᲮᲕᲐ looks
        disabled (aria-disabled) until a value differs from the saved one
     2. ტელეფონის ნომერი — current number + ნომრის შეცვლა → new number + ᲙᲝᲓᲘᲡ
        ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ → SMS კოდი + resend (30 s cooldown) + ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ; გაუქმება
     3. პაროლის შეცვლა — current / new / repeat (eye toggles) + ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ
   then the outline ᲒᲐᲡᲕᲚᲐ (UI.logout). Each section is its own <form>, so
   Enter submits that section only (the app never submits natively).
   Ids are a contract with the tests (tests/e2e/profile.test.js; docs/INTEGRATION.md "v4 changes").
   QA: #/profile?demo=1  &edit=phone  &edit=phone&step=code  &err=1
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, esc = SP.esc;

  var RESEND = 'კოდის ხელახლა გამოგზავნა';
  var phoneOpen = false;   // the new-number form is open (module state: survives a re-render of the route)
  var cooldown = null;     // the resend countdown (UI.cooldownLink)
  function stopTimers() { if (cooldown) { cooldown.stop(); cooldown = null; } }

  /* ---------------- markup ---------------- */
  function sec(key, title, inner) {
    return '<section class="card prof-sec prof-sec--' + key + '" aria-labelledby="pf-h-' + key + '">' +
      '<h2 class="prof-sec__h" id="pf-h-' + key + '">' + esc(title) + '</h2>' + inner + '</section>';
  }
  /** a field + its error line, kept together (the error line must not get the column gap) */
  function fld(o, cls) { return '<div class="prof-f' + (cls ? ' ' + cls : '') + '">' + UI.field(o) + '</div>'; }
  function btn(id, key, type, cls) {
    return '<button type="' + (type || 'submit') + '" class="btn prof-btn' + (cls ? ' ' + cls : '') + '" id="' + id + '"><span class="btn__label">' + UI.mt(key) + '</span></button>';
  }

  /** the pending phone change of the signed-in account (core ignores one started by another account) */
  function pendingFor(p) { var pc = SP.state().phoneChange; return pc && p && pc.from === p.phone ? pc : null; }

  function phoneBody(p) {
    var pc = pendingFor(p), open = phoneOpen || !!pc;
    var row = '<div class="prof-phone">' +
      '<span class="prof-phone__v">' + esc(SP.fmt.phone(p.phone)) + '</span>' +
      (open ? '' : '<button type="button" class="link prof-phone__change" id="pf-phone-open">ნომრის შეცვლა</button>') +
      '</div>';
    var cancel = '<p class="prof-cancel"><button type="button" class="link" id="pf-cancel">გაუქმება</button></p>';
    if (pc) {
      return row +
        '<form class="prof-form prof-form--code" id="pf-code-form" novalidate>' +
          '<p class="prof-note" id="pf-code-lead">SMS კოდი გამოგზავნილია ნომერზე <b>' + esc(SP.fmt.phone(pc.phone)) + '</b></p>' +
          // maxlength 4 (spec); a pasted ' 4821' / '48-21' is normalised by the paste handler before the browser clamps it
          fld({ id: 'pf-code', label: 'SMS კოდი', inputmode: 'numeric', maxlength: 4, autocomplete: 'one-time-code', describedby: 'pf-code-lead pf-code-err' }, 'prof-f--code') +
          '<p class="prof-links"><button type="button" class="link" id="pf-resend">' + RESEND + '</button></p>' +
          btn('pf-confirm', 'confirm') +
        '</form>' + cancel;
    }
    if (!open) return row;
    return row +
      '<form class="prof-form prof-form--phone" id="pf-phone-form" novalidate>' +
        // no maxlength: it would cut a pasted '+995 577 12 34 56' before SP.fmt.phone normalises it
        fld({ id: 'pf-phone-new', label: 'ახალი ტელეფონის ნომერი', type: 'tel', inputmode: 'tel', autocomplete: 'tel-national' }, 'prof-f--phone') +
        btn('pf-send', 'sendCode') +
      '</form>' + cancel;
  }

  function render(ctx) {
    if (ctx.entry) phoneOpen = ctx.query.edit === 'phone';   // render runs before mount
    var p = SP.api.getProfile() || { phone: '', first: '', last: '', email: '' };
    return '' +
      '<div class="m-page prof-page">' + UI.dHead('/', { account: 'orders', backAny: true }) +
        '<main class="prof">' +
          '<h1 class="t-h1 prof__h">პროფილი</h1>' +
          '<div class="prof-secs">' +
            sec('info', 'პირადი ინფორმაცია',
              '<form class="prof-form" id="pf-info-form" novalidate>' +
                '<div class="prof-names">' +
                  fld({ id: 'pf-first', label: 'სახელი', autocomplete: 'given-name', value: p.first, maxlength: 40 }) +
                  fld({ id: 'pf-last', label: 'გვარი', autocomplete: 'family-name', value: p.last, maxlength: 40 }) +
                '</div>' +
                fld({ id: 'pf-email', label: 'ელ.პოსტა', type: 'email', inputmode: 'email', autocomplete: 'email', value: p.email, maxlength: 100 }) +
                btn('pf-save', 'save') +
              '</form>') +
            sec('phone', 'ტელეფონის ნომერი', '<div class="prof-phone-box" id="pf-phone-box">' + phoneBody(p) + '</div>') +
            sec('pass', 'პაროლის შეცვლა',
              '<form class="prof-form" id="pf-pass-form" novalidate>' +
                // the account name for password managers (a password form should carry its username)
                '<input type="text" name="username" autocomplete="username" value="' + esc(p.phone) + '" hidden readonly tabindex="-1">' +
                fld({ id: 'pw-current', label: 'მიმდინარე პაროლი', type: 'password', eye: true, autocomplete: 'current-password' }) +
                fld({ id: 'pw-new', label: 'ახალი პაროლი', type: 'password', eye: true, autocomplete: 'new-password' }) +
                fld({ id: 'pw-repeat', label: 'პაროლის გამეორება', type: 'password', eye: true, autocomplete: 'new-password' }) +
                btn('pw-submit', 'changePassword') +
              '</form>') +
          '</div>' +
          '<div class="prof-out"><button type="button" class="btn btn--secondary prof-logout" data-action="logout"><span class="btn__label">' + UI.mt('logout') + '</span></button></div>' +
        '</main>' +
        '<div class="m-spacer only-m"></div>' +
        '<div class="only-m">' + UI.mBar({ label: UI.mt('back'), back: '/', any: true }, null) + '</div>' +
      '</div>';
  }

  /* ---------------- behaviour ---------------- */
  function mount(root, ctx) {
    stopTimers();   // one countdown per screen, also across re-renders
    var $ = function (id) { return root.querySelector('#' + id); };
    /** the toast sits at the top of the viewport (profile.css): keep the control being worked on clear of it
        (scroll-margin-top in profile.css reserves the toast's band; 'nearest' only scrolls when it is under it) */
    function keepClear(el) { if (el && el.isConnected && el.scrollIntoView) try { el.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ } }
    function toast(msg, el) { UI.toast(msg); keepClear(el); }
    /** a call made after the session ended (e.g. signed out in another tab): let the route guard take over */
    function lost(r) { if (r && r.error === 'auth') { SP.rerender(); return true; } return false; }
    function focusFirstInvalid(ids) {
      for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el && el.getAttribute('aria-invalid') === 'true') { el.focus(); return; } }
    }

    /* ---- 1. personal information: ᲨᲔᲜᲐᲮᲕᲐ looks disabled until something changed ---- */
    var INFO = ['first', 'last', 'email'];
    var saved = SP.api.getProfile() || {};
    var save = $('pf-save');
    function dirty() { return INFO.some(function (k) { return $('pf-' + k).value.trim() !== String(saved[k] || ''); }); }
    function syncSave() { if (dirty()) save.removeAttribute('aria-disabled'); else save.setAttribute('aria-disabled', 'true'); }
    INFO.forEach(function (k) { $('pf-' + k).addEventListener('input', function () { UI.setError($('pf-' + k), ''); syncSave(); }); });
    syncSave();
    function saveInfo(force) {
      if (!force && !dirty()) return;
      var r = SP.api.updateProfile({ first: $('pf-first').value, last: $('pf-last').value, email: $('pf-email').value });
      if (lost(r)) return;
      INFO.forEach(function (k) { UI.setError($('pf-' + k), r.ok ? '' : (r.errors && r.errors[k]) || ''); });
      if (!r.ok) { if (!force) focusFirstInvalid(['pf-first', 'pf-last', 'pf-email']); return; }
      saved = r.profile;
      INFO.forEach(function (k) { $('pf-' + k).value = saved[k] || ''; });   // the stored (trimmed) values
      syncSave();
      toast(SP.toastMsg.profileSaved, document.activeElement);
    }
    $('pf-info-form').addEventListener('submit', function (e) { e.preventDefault(); saveInfo(false); });

    /* ---- 2. phone number ---- */
    var box = $('pf-phone-box');
    function redrawPhone(focusId) {
      stopTimers();
      var p = SP.api.getProfile();
      if (!p) { SP.rerender(); return; }
      box.innerHTML = phoneBody(p);
      wirePhone();
      var f = focusId && $(focusId);
      if (f) f.focus();
    }
    function closePhone(focusId) { phoneOpen = false; redrawPhone(focusId || 'pf-phone-open'); }
    function digits(v) { return String(v).replace(/\D/g, '').slice(0, 4); }
    function wirePhone() {
      var open = $('pf-phone-open'), cancel = $('pf-cancel'), resend = $('pf-resend');
      var nw = $('pf-phone-new'), code = $('pf-code');
      if (open) open.addEventListener('click', function () { phoneOpen = true; redrawPhone('pf-phone-new'); });
      if (cancel) cancel.addEventListener('click', function () { SP.api.cancelPhoneChange(); closePhone(); });
      if (nw) {
        UI.bindPhone(nw);
        nw.addEventListener('input', function () { UI.setError(nw, ''); });
        $('pf-phone-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var r = SP.api.startPhoneChange(nw.value);
          if (lost(r)) return;
          if (!r.ok) { UI.setError(nw, r.message); nw.focus(); return; }
          redrawPhone('pf-code');
          UI.codeToast(r.code);
          keepClear($('pf-code'));
        });
      }
      if (code) {
        code.addEventListener('input', function () { var v = digits(code.value); if (v !== code.value) code.value = v; UI.setError(code, ''); });
        code.addEventListener('paste', function (e) {
          var t = e.clipboardData && e.clipboardData.getData('text');
          if (t == null) return;
          e.preventDefault();
          var a = code.selectionStart, b = code.selectionEnd, v = code.value, nv = digits(v.slice(0, a) + t + v.slice(b));
          code.value = nv;
          try { var c = Math.min(nv.length, a + digits(t).length); code.setSelectionRange(c, c); } catch (x) { /* ignore */ }
          code.dispatchEvent(new Event('input', { bubbles: true }));
        });
        $('pf-code-form').addEventListener('submit', function (e) {
          e.preventDefault();
          if (!SP.valid.code(code.value)) { UI.setError(code, SP.msg.code); code.focus(); return; }
          var r = SP.api.verifyPhoneChange(code.value);
          if (lost(r)) return;
          if (!r.ok) {
            if (r.error === 'none') { closePhone(); return; }   // nothing pending any more (cancelled elsewhere)
            UI.setError(code, r.message); code.focus(); return;
          }
          closePhone();
          toast(SP.toastMsg.phoneChanged, $('pf-phone-open'));
        });
      }
      if (resend) {
        cooldown = UI.cooldownLink(resend, RESEND, SP.phoneChangeCooldown);
        resend.addEventListener('click', function () {
          if (resend.getAttribute('aria-disabled') === 'true') return;
          var r = SP.api.resendPhoneChange();
          if (lost(r)) return;
          if (!r.ok) { if (r.error === 'none') closePhone(); else if (cooldown) cooldown.refresh(); return; }
          UI.codeToast(r.code);
          // the old code (and its wrong / expired message) no longer applies
          code.value = ''; UI.setError(code, '');
          if (cooldown) cooldown.refresh();
          code.focus();
          keepClear(code);
        });
      }
    }
    // Esc inside the open phone form = გაუქმება
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      var c = $('pf-cancel');
      if (c) { e.preventDefault(); c.click(); }
    });
    wirePhone();

    /* ---- 3. password ---- */
    var PW = { current: 'pw-current', next: 'pw-new', repeat: 'pw-repeat' };
    Object.keys(PW).forEach(function (k) { $(PW[k]).addEventListener('input', function () { UI.setError($(PW[k]), ''); }); });
    function changePass(quiet) {
      var r = SP.api.changePassword({ current: $('pw-current').value, next: $('pw-new').value, repeat: $('pw-repeat').value });
      if (lost(r)) return;
      Object.keys(PW).forEach(function (k) { UI.setError($(PW[k]), r.ok ? '' : (r.errors && r.errors[k]) || ''); });
      if (!r.ok) { if (!quiet) focusFirstInvalid(['pw-current', 'pw-new', 'pw-repeat']); return; }
      Object.keys(PW).forEach(function (k) {
        var i = $(PW[k]); i.value = '';
        // fields go back to hidden characters
        if (i.type !== 'password') { var eye = root.querySelector('[data-eye="' + PW[k] + '"]'); if (eye) eye.click(); }
      });
      toast(SP.toastMsg.passwordChanged, document.activeElement);
    }
    $('pf-pass-form').addEventListener('submit', function (e) { e.preventDefault(); changePass(false); });

    /* ---- 4. logout ---- */
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action="logout"]');
      if (a && root.contains(a)) UI.logout();
    });

    /* QA: &err=1 shows the validation errors (empty name, empty password fields, the phone step's own error) */
    if (ctx.entry && ctx.query.err === '1') {
      $('pf-first').value = ''; saveInfo(true); syncSave();
      changePass(true);
      if ($('pf-phone-new')) UI.setError($('pf-phone-new'), SP.msg.required);
      if ($('pf-code')) { $('pf-code').value = '1234'; UI.setError($('pf-code'), SP.msg.codeWrong); }
    }
  }

  SP.route('/profile', { screen: 'profile', title: 'პროფილი', render: render, mount: mount, unmount: stopTimers });
})();

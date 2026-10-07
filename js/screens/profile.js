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
  var onStore = null;      // the mounted screen's cross-tab 'storage' listener
  function stopTimers() { if (cooldown) { cooldown.stop(); cooldown = null; } }
  /** leaving (or re-mounting) the screen: its countdown and its 'storage' listener go */
  function teardown() {
    stopTimers();
    if (onStore) { window.removeEventListener('storage', onStore); onStore = null; }
  }

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
      '<div class="m-page prof-page">' + UI.dHead('/', { current: 'profile', backAny: true }) +
        '<main class="prof">' +
          '<h1 class="t-h1 prof__h">პროფილი</h1>' +
          '<div class="prof-secs">' +
            sec('info', 'პირადი ინფორმაცია',
              '<form class="prof-form" id="pf-info-form" novalidate>' +
                // no maxlength: validation is the register form's (which has none). A limit here would lock a longer
                // name saved at registration — the browser refuses typing until the value is cut below it (V4F2-03)
                '<div class="prof-names">' +
                  fld({ id: 'pf-first', label: 'სახელი', autocomplete: 'given-name', value: p.first }) +
                  fld({ id: 'pf-last', label: 'გვარი', autocomplete: 'family-name', value: p.last }) +
                '</div>' +
                fld({ id: 'pf-email', label: 'ელ.პოსტა', type: 'email', inputmode: 'email', autocomplete: 'email', value: p.email }) +
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
        '<div class="m-spacer prof-spacer only-m"></div>' +
        '<div class="only-m">' + UI.mBar({ label: UI.mt('back'), back: '/', any: true }, null) + '</div>' +
      '</div>';
  }

  /* ---------------- behaviour ---------------- */
  function mount(root, ctx) {
    teardown();   // one countdown / storage listener per screen, also across re-renders
    var $ = function (id) { return root.querySelector('#' + id); };
    /** the toast sits at the top of the viewport (profile.css): keep the card being worked on clear of it — its
        heading too, not only the control (V4FUX2-01) — or, when the card is taller than the room below the toast's
        band, the control itself (scroll-margin-top in profile.css reserves the band; 'nearest' only scrolls when
        the target is under it or below the fold) */
    var BAND = 76, BELOW = 24;
    function keepClear(el) {
      if (!el || !el.isConnected || !el.scrollIntoView) return;
      var s = el.closest && el.closest('.prof-sec'), vv = window.visualViewport;
      var room = (vv ? vv.height : window.innerHeight) - BAND - BELOW;
      var t = s && s.getBoundingClientRect().height <= room ? s : el;
      try { t.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
    }
    function toast(msg, el) { UI.toast(msg); keepClear(el); }
    /** the test-code toast stays tappable on the profile (select / copy the code, tap to dismiss), as on register /
        verify; the plain confirmations let taps through (profile.css, V4FUX2-03) */
    function codeToast(code) {
      UI.codeToast(code);
      var tr = document.getElementById('toast-root'), t = tr && tr.lastElementChild;
      if (t && t.classList.contains('toast')) t.classList.add('toast--code');
    }
    /** a call refused with 'auth': this tab's account record is gone (the number was changed in another tab — the
        session lives per tab, the accounts are shared). v4 r1: the session ends (toast) and the route guard sends
        the user to login; SP.rerender() covers any other cause */
    function lost(r) { if (r && r.error === 'auth') { if (!SP.dropStaleSession()) SP.rerender(); return true; } return false; }
    /* ---- double presses (V4F2-01 / V4F2-02) ----
       A step that swaps or clears the controls under the pointer / focus (the phone form redrawn, the password
       fields cleared) must not be hit by the second half of a double click or a double Enter: it would submit the
       new empty code / password form ('სავალდებულო ველი' after a success), re-open the number form right after
       'ტელეფონის ნომერი შეიცვალა' or move focus off the field the step focused. For GUARD ms after a step, the same
       kind of input that caused it does nothing inside the page and focus stays (or goes back) where the step put
       it: after a click, the rest of that multi-click (detail > 1: the browser's own double-click / double-tap
       count); after Enter, another Enter on the control the step focused — an Enter on another control (Tab /
       Shift+Tab moved focus first) is a new action and passes (v4f-r2-03). A new single click, another kind of
       input (Esc → გაუქმება, then a click), typing and programmatic clicks pass. A held Enter (repeated keydowns)
       never re-submits. */
    var GUARD = 600, stepAt = 0, stepFocus = null, stepVia = '', lastVia = '';
    function stepDone(el) { stepAt = Date.now(); stepVia = lastVia; stepFocus = el || document.activeElement; }
    function inPage(t) { return !!(t && t.closest && t.closest('.prof')); }
    function guarded(e, via) {
      return e.isTrusted && stepVia === via && Date.now() - stepAt < GUARD && inPage(e.target) &&
        (via !== 'key' || e.target === stepFocus);
    }
    function refocus() {
      var f = stepFocus;
      if (f && f.isConnected && root.contains(f) && document.activeElement !== f) try { f.focus({ preventScroll: true }); } catch (x) { /* ignore */ }
    }
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && ((e.repeat && inPage(e.target)) || guarded(e, 'key'))) { e.preventDefault(); return; }
      lastVia = 'key';   // any key (Esc → გაუქმება is a step too)
    }, true);
    function stray(e) { return e.detail > 1 && guarded(e, 'pointer'); }
    root.addEventListener('pointerdown', function (e) { if (!stray(e)) lastVia = 'pointer'; }, true);
    // typing ends it: the user is working in the new step on purpose
    root.addEventListener('input', function () { stepAt = 0; }, true);
    root.addEventListener('mousedown', function (e) { if (stray(e)) { e.preventDefault(); refocus(); } }, true);
    root.addEventListener('click', function (e) { if (stray(e)) { e.preventDefault(); e.stopPropagation(); refocus(); } }, true);

    function focusFirstInvalid(ids) {
      for (var i = 0; i < ids.length; i++) { var el = $(ids[i]); if (el && el.getAttribute('aria-invalid') === 'true') { el.focus(); return; } }
    }

    /* ---- validation on blur, as on register (DESIGN_SYSTEM §3.24) ----
       After a field's first blur with a value (or once it was submitted) its client-side rule runs on every blur;
       typing clears the line. The server-only checks (wrong current password, the same / a taken number, the new
       password equal to the current one) stay on submit: such an error is kept on blur until the field is edited. */
    var M = SP.msg, V = SP.valid;
    function reqRule(v) { return String(v).trim() ? '' : M.required; }
    var RULES = {
      'pf-first': reqRule, 'pf-last': reqRule,
      'pf-email': function (v) { return !String(v).trim() ? M.required : V.email(v) ? '' : M.email; },
      'pf-phone-new': function (v) { return !String(v).trim() ? M.required : V.phone(v) ? '' : M.phone; },
      'pw-current': function (v) { return v ? '' : M.required; },
      'pw-new': function (v) { return !v ? M.required : V.password(v) ? '' : M.password; },
      'pw-repeat': function (v) { var n = $('pw-new'); return !v ? M.required : n && v === n.value ? '' : M.match; }
    };
    var touched = {}, serverErr = {};
    /** fromSubmit: an error set by a submit (it may be server-only) — a blur does not clear it */
    function setErr(id, msg, fromSubmit) {
      var i = $(id); if (!i) return;
      UI.setError(i, msg || '');
      if (fromSubmit && msg) serverErr[id] = true; else delete serverErr[id];
    }
    function check(id) {
      var i = $(id); if (!i || !RULES[id]) return;
      var m = RULES[id](i.value);
      if (!m && serverErr[id]) return;   // the client rule passes, the server's own error stays until an edit
      setErr(id, m);
    }
    /** a submit validated these fields: they count as touched; a successful one resets them (the fields are
        cleared / saved) */
    function submitted(ids, ok) {
      ids.forEach(function (id) { if (ok) delete touched[id]; else touched[id] = true; });
      held = held.filter(function (id) { return ids.indexOf(id) < 0; });
    }
    /* A blur caused by a press must not show a new 21 px error line before that press becomes a click: it would
       push the ᲨᲔᲜᲐᲮᲕᲐ / ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ / ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ button or გაუქმება down between pointerdown and click
       and the click would miss it (auth.js wire()). Such blurs are held until the click and run after it (a submit
       of the field's own form drops them: it validated the field itself). Touch moves focus only after pointerup,
       so the press stays "in progress" until its click (or a timeout). */
    var pressing = false, held = [], pressTimer = null;
    function runHeld() {
      var ids = held; held = []; pressing = false; clearTimeout(pressTimer);
      ids.forEach(function (id) { var i = $(id); if (i && document.activeElement !== i) check(id); });
    }
    function endPress() {
      document.removeEventListener('pointerup', endPress, true);
      document.removeEventListener('pointercancel', endPress, true);
      clearTimeout(pressTimer); pressTimer = setTimeout(runHeld, 500);
    }
    root.addEventListener('pointerdown', function () {
      pressing = true; clearTimeout(pressTimer);
      document.addEventListener('pointerup', endPress, { once: true, capture: true });
      document.addEventListener('pointercancel', endPress, { once: true, capture: true });
    }, true);
    root.addEventListener('click', function () { if (pressing || held.length) setTimeout(runHeld, 0); }, true);
    /** blur → the field's rule; typing → the line clears (onInput: the field's own extra work) */
    function bindField(id, onInput) {
      var i = $(id); if (!i) return;
      delete touched[id]; delete serverErr[id];   // a fresh element (the phone form is redrawn)
      i.addEventListener('blur', function (e) {
        if (!i.isConnected || !(i.value || touched[id])) return;
        touched[id] = true;
        var ids = [id];
        // a new password changed after the repeat was filled: re-check the repeat (unless focus is going there)
        if (id === 'pw-new' && touched['pw-repeat'] && e.relatedTarget !== $('pw-repeat')) ids.push('pw-repeat');
        ids.forEach(function (x) {
          if (pressing) { if (held.indexOf(x) < 0) held.push(x); } else check(x);
        });
      });
      i.addEventListener('input', function () { setErr(id, ''); if (onInput) onInput(); });
    }

    /* ---- 1. personal information: ᲨᲔᲜᲐᲮᲕᲐ looks disabled until something changed ---- */
    var INFO = ['first', 'last', 'email'], INFO_IDS = ['pf-first', 'pf-last', 'pf-email'];
    var saved = SP.api.getProfile() || {};
    var save = $('pf-save');
    function dirty() { return INFO.some(function (k) { return $('pf-' + k).value.trim() !== String(saved[k] || ''); }); }
    function syncSave() { if (dirty()) save.removeAttribute('aria-disabled'); else save.setAttribute('aria-disabled', 'true'); }
    INFO_IDS.forEach(function (id) { bindField(id, syncSave); });
    syncSave();
    /** only the fields edited here are written; the others come from a fresh read of the record, so a save in this
        tab does not undo a change saved meanwhile in another tab (v4f-r2-04) */
    function patch() {
      var cur = SP.api.getProfile() || {}, o = {};
      INFO.forEach(function (k) {
        var v = $('pf-' + k).value;
        o[k] = v.trim() !== String(saved[k] || '') ? v : String(cur[k] == null ? v : cur[k]);
      });
      return o;
    }
    function saveInfo(force) {
      if (!force && !dirty()) return;
      var r = SP.api.updateProfile(force ? { first: $('pf-first').value, last: $('pf-last').value, email: $('pf-email').value } : patch());
      if (lost(r)) return;
      INFO.forEach(function (k) { setErr('pf-' + k, r.ok ? '' : (r.errors && r.errors[k]) || '', true); });
      submitted(INFO_IDS, r.ok);
      if (!r.ok) { if (!force) focusFirstInvalid(INFO_IDS); return; }
      saved = r.profile;
      INFO.forEach(function (k) { $('pf-' + k).value = saved[k] || ''; });   // the stored (trimmed) values
      syncSave();
      toast(SP.toastMsg.profileSaved, document.activeElement);
    }
    $('pf-info-form').addEventListener('submit', function (e) { e.preventDefault(); saveInfo(false); });
    /* another tab saved this account's profile: the fields not edited here and the ᲨᲔᲜᲐᲮᲕᲐ baseline follow it
       (core's own 'storage' listener runs first and ends a session whose account is gone) */
    onStore = function (e) {
      if (e.key !== null && e.key !== 'slicepay:v1:users') return;
      if (!root.isConnected || !$('pf-info-form')) return;
      var fresh = SP.api.getProfile();
      if (!fresh) return;
      INFO.forEach(function (k) {
        var i = $('pf-' + k);
        if (i.value.trim() === String(saved[k] || '') && i.value !== String(fresh[k] || '')) { i.value = fresh[k] || ''; setErr('pf-' + k, ''); }
      });
      saved = fresh;
      syncSave();
    };
    window.addEventListener('storage', onStore);

    /* ---- 2. phone number ---- */
    var box = $('pf-phone-box');
    function redrawPhone(focusId) {
      stopTimers();
      var p = SP.api.getProfile();
      if (!p) { SP.rerender(); return; }
      // the password form's account name follows the number (a phone change re-keys the account)
      var un = root.querySelector('#pf-pass-form input[name="username"]');
      if (un) un.value = p.phone;
      held = held.filter(function (id) { return id !== 'pf-phone-new'; });
      box.innerHTML = phoneBody(p);
      wirePhone();
      var f = focusId && $(focusId);
      if (f) f.focus();
      stepDone(f);
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
        bindField('pf-phone-new');
        $('pf-phone-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var r = SP.api.startPhoneChange(nw.value);
          if (lost(r)) return;
          submitted(['pf-phone-new'], r.ok);
          if (!r.ok) { setErr('pf-phone-new', r.message, true); nw.focus(); return; }
          redrawPhone('pf-code');
          codeToast(r.code);
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
          if (!r.ok) {
            if (r.error === 'none') { closePhone(); return; }
            // v4 finish r2: the new number was taken meanwhile — no code is sent; say so on the code field
            if (r.error === 'exists') { UI.setError(code, r.message); code.focus(); return; }
            if (cooldown) cooldown.refresh();
            return;
          }
          codeToast(r.code);
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
    var PW = { current: 'pw-current', next: 'pw-new', repeat: 'pw-repeat' }, PW_IDS = ['pw-current', 'pw-new', 'pw-repeat'];
    PW_IDS.forEach(function (id) { bindField(id); });
    function changePass(quiet) {
      var r = SP.api.changePassword({ current: $('pw-current').value, next: $('pw-new').value, repeat: $('pw-repeat').value });
      if (lost(r)) return;
      Object.keys(PW).forEach(function (k) { setErr(PW[k], r.ok ? '' : (r.errors && r.errors[k]) || '', true); });
      submitted(PW_IDS, r.ok);
      if (!r.ok) { if (!quiet) focusFirstInvalid(PW_IDS); return; }
      Object.keys(PW).forEach(function (k) {
        var i = $(PW[k]); i.value = '';
        // fields go back to hidden characters
        if (i.type !== 'password') { var eye = root.querySelector('[data-eye="' + PW[k] + '"]'); if (eye) eye.click(); }
      });
      toast(SP.toastMsg.passwordChanged, document.activeElement);
      stepDone();   // the cleared form must not be submitted again by a double click / Enter (V4F2-01)
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
      if ($('pf-phone-new')) { setErr('pf-phone-new', SP.msg.required, true); touched['pf-phone-new'] = true; }
      if ($('pf-code')) { $('pf-code').value = '1234'; UI.setError($('pf-code'), SP.msg.codeWrong); }
    }
  }

  SP.route('/profile', { screen: 'profile', title: 'პროფილი', render: render, mount: mount, unmount: teardown });
})();

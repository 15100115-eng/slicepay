/* =====================================================================
   SlicePay — screens/delivery.js   route: #/delivery
   FEATURES_SPEC §2+3+6 (delivery step, personal ID, parcel ETA), docs/INTEGRATION.md §5 E2.
   One DOM for both breakpoints (CSS media queries; not `responsive`):
   - mobile: white page like auth, sections stacked, sticky bottom bar ᲣᲙᲐᲜ + ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ (as cart / payment);
   - desktop: standard header, a centred 645 px column of white section cards
     (the cart's / payment's left-column width), method cards side by side.
   The form edits a draft that is written into state.delivery as the user types (so Back → cart →
   Next keeps it); any edit marks the step not done until ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ validates it again.
   QA: ?demo=1 (pickup, ვაკე, names prefilled, ID empty) &delivery=courier &err=1
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, M = SP.msg, esc = SP.esc;

  var PID_NOTE = '*პირადი ნომერი საჭიროა ამანათის განბაჟებისთვის';
  var PID_LEN = 11;

  /* ---------------- helpers ---------------- */
  function f(o, cls) { return '<div class="dlv__f' + (cls ? ' ' + cls : '') + '">' + UI.field(o) + '</div>'; }
  function digits(v) { return String(v || '').replace(/\D/g, ''); }

  /** the recipient prefill (V4_SPEC §B): the names typed or confirmed in this session win when non-empty, else the
      signed-in account's profile (SP.recipientPrefill). (No pending-registration fallback: a verified registration
      already set the profile, and an abandoned one may belong to another number than the signed-in account — REV2-01.)
      The personal ID never comes from the profile (it is never stored with the account). */
  function prefill(st) {
    var d = st.delivery || {}, who = SP.recipientPrefill(st) || {};
    // the ID draft is kept as typed (digits only, never cut): an over-long one must stay visible to be flagged
    return { first: String(who.first || ''), last: String(who.last || ''), pid: digits(d.pid) };
  }

  /* ---------------- render ---------------- */
  function render(ctx) {
    var st = ctx.state, d = st.delivery, who = prefill(st);
    var courier = d.method === 'courier';

    var recipient =
      '<section class="dlv__sec" aria-labelledby="dlv-rec-h">' +
        '<h2 class="dlv__sec-h" id="dlv-rec-h">მიმღები</h2>' +
        '<div class="dlv__names">' +
          // no maxlength (v4f): register and profile have none and all three validate names the same way (required,
          // trimmed). A limit here would lock a longer prefilled profile name — typing refused until it is cut below it
          f({ id: 'd-first', label: 'სახელი', autocomplete: 'given-name', value: who.first }) +
          f({ id: 'd-last', label: 'გვარი', autocomplete: 'family-name', value: who.last }) +
        '</div>' +
        // no maxlength: it would cut a pasted '010 0101 2345' before the input handler strips the spaces, and it would
        // silently drop the tail of a 12-digit paste (a wrong ID that then validates). The input handler does it instead.
        f({ id: 'd-pid', label: 'პირადი ნომერი', inputmode: 'numeric', autocomplete: 'off', value: who.pid, noErr: true, describedby: 'd-pid-err' }) +
        // the orange note doubles as the field's error line (as on register: no layout shift)
        '<p class="t-note dlv__note" id="d-pid-err" aria-live="polite">' + PID_NOTE + '</p>' +
      '</section>';

    var branchSel = UI.selectField({
      id: 'd-branch', label: 'აირჩიეთ ფილიალი',
      options: SP.BRANCHES.map(function (b) { return { value: b.id, label: b.label }; }),
      value: SP.branch(d.branchId) ? d.branchId : ''
    });
    var b = SP.branch(d.branchId);
    var citySel = UI.selectField({ id: 'd-city', label: 'ქალაქი', autocomplete: 'address-level2', options: SP.CITIES, value: SP.CITIES.indexOf(d.city) >= 0 ? d.city : '' });
    var addr = UI.field({ id: 'd-addr', label: 'მისამართი', placeholder: 'ქუჩა, სახლის ნომერი', autocomplete: 'address-line1', value: d.address, maxlength: 120 });
    var note = UI.field({ id: 'd-note', label: 'ბინა, სართული, კომენტარი', autocomplete: 'address-line2', value: d.note, maxlength: 120, optional: true, noErr: true });

    var method =
      '<section class="dlv__sec dlv__sec--method" aria-labelledby="dlv-method-h">' +
        '<h2 class="dlv__sec-h" id="dlv-method-h">მიწოდების მეთოდი</h2>' +
        UI.radioCards({ name: 'dmethod', labelledby: 'dlv-method-h', cls: 'dlv__methods', items: [
          // Mtavruli titles as on the payment method cards (Mkhedruli twin for assistive tech)
          { value: 'pickup', checked: !courier, title: UI.mtx('ფილიალიდან გატანა'), sub: 'უფასო' },
          { value: 'courier', checked: courier, title: UI.mtx('კურიერით მიტანა'), sub: 'თბილისში 5₾ · რეგიონებში 10₾' }
        ] }) +
        '<div class="dlv__panel" id="dlv-pickup"' + (courier ? ' hidden' : '') + '>' +
          '<div class="dlv__f">' + branchSel + '</div>' +
          // the full option text is often cut in the closed select on phones: repeat the chosen address (visual only)
          '<p class="dlv__branch-addr" id="d-branch-addr" aria-hidden="true">' + (b ? esc(b.addr) : '') + '</p>' +
        '</div>' +
        '<div class="dlv__panel" id="dlv-courier"' + (courier ? '' : ' hidden') + '>' +
          '<div class="dlv__addr-row">' +
            '<div class="dlv__f">' + citySel + '</div>' +
            '<div class="dlv__f dlv__f--addr">' + addr + '</div>' +
          '</div>' +
          '<div class="dlv__f dlv__f--note">' + note + '</div>' +
        '</div>' +
        // the arrival window depends on the method (and the courier city): it lives with them
        '<div class="dlv__eta">' + UI.etaBox(SP.eta({ delivery: d }), { id: 'd-eta' }) + '</div>' +
      '</section>';

    return '' +
      '<div class="m-page dlv-page">' +
        UI.dHead('/cart') +
        '<main class="dlv">' +
          '<form class="dlv__form" id="dlv-form" novalidate>' +
            '<h1 class="t-h1 dlv__h">მიწოდება</h1>' +
            '<div class="dlv__body">' +
              recipient + method +
            '</div>' +
            '<div class="dlv__spacer"></div>' +
            // phones: the shared sticky bar as on cart / payment (REV2R2-07, DLV-R3-03): ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ stays in view
            '<div class="m-bar m-bar--sticky dlv__bar">' +
              '<button type="button" class="btn-text only-m" data-back="/cart">' + UI.mt('back') + '</button>' +
              '<button type="submit" class="btn" id="dlv-submit"><span class="btn__label">' + UI.mt('next') + '</span></button>' +
            '</div>' +
          '</form>' +
        '</main>' +
      '</div>';
  }

  /* ---------------- mount ---------------- */
  function mount(root, ctx) {
    var form = root.querySelector('#dlv-form');
    var $ = function (id) { return root.querySelector('#' + id); };
    var pid = $('d-pid'), pidNote = $('d-pid-err');
    var touched = {};

    function dl() { return SP.state().delivery; }
    function method() { var r = root.querySelector('input[name="dmethod"]:checked'); return r ? r.value : 'pickup'; }
    /** the draft as SP.eta / SP.deliveryFee see it */
    function draft() {
      return { method: method(), branchId: $('d-branch').value || '', city: $('d-city').value || '', address: $('d-addr').value.trim(), note: $('d-note').value.trim() };
    }

    /* ---- errors ---- */
    function setErr(id, msg) {
      // the ID's orange note doubles as its error line: the shared helper (as register's phone, REV2R3-08)
      if (id === 'd-pid') { UI.setNoteError(pid, pidNote, PID_NOTE, msg); return; }
      UI.setError($(id), msg);
    }
    var RULES = {
      'd-first': function (v) { return v.trim() ? '' : M.first; },
      'd-last': function (v) { return v.trim() ? '' : M.last; },
      'd-pid': function (v) { return SP.valid.pid(v) ? '' : M.pid; },
      'd-branch': function (v) { return SP.branch(v) ? '' : M.branch; },
      'd-city': function (v) { return SP.CITIES.indexOf(v) >= 0 ? '' : M.city; },
      'd-addr': function (v) { return v.trim() ? '' : M.address; }
    };
    function activeIds() {
      return ['d-first', 'd-last', 'd-pid'].concat(method() === 'courier' ? ['d-city', 'd-addr'] : ['d-branch']);
    }
    function check(id) { var m = RULES[id]($(id).value); setErr(id, m); return m; }
    function validateAll() {
      var first = null;
      activeIds().forEach(function (id) { touched[id] = true; if (check(id) && !first) first = id; });
      return first;
    }

    /* ---- live draft → state (any edit re-opens the step) ---- */
    function persist(patch) {
      var d = dl();
      Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
      d.done = false;
      SP.save();
    }
    var etaV = $('d-eta');
    var etaMain = etaV && etaV.closest('.eta-box__main');
    if (etaMain) { etaMain.setAttribute('aria-live', 'polite'); etaMain.setAttribute('aria-atomic', 'true'); }
    function updateEta() {
      if (!etaV) return;
      var t = SP.etaText(SP.eta({ delivery: draft() }));
      if (etaV.textContent !== t) etaV.textContent = t;
    }
    function updateBranchAddr() {
      var b = SP.branch($('d-branch').value), el = $('d-branch-addr');
      el.textContent = b ? b.addr : '';
    }

    /* ---- personal ID: digits only (keeps the caret on paste / typing).
       A typed key that would make it longer than 11 digits is refused, as maxlength would (value and caret
       restored); a paste / drop / autofill keeps every digit, so a 12-digit ID is flagged instead of cut. ---- */
    var pidPrev = null;
    pid.addEventListener('beforeinput', function () {
      pidPrev = { v: pid.value, s: pid.selectionStart, e: pid.selectionEnd };
    });
    pid.addEventListener('input', function (e) {
      var v = pid.value, pos = pid.selectionStart == null ? v.length : pid.selectionStart;
      var clean = digits(v);
      var typed = e.inputType === 'insertText' && String(e.data || '').length <= 1;
      if (typed && pidPrev && clean.length > PID_LEN && clean.length > digits(pidPrev.v).length) {
        pid.value = pidPrev.v;
        try { pid.setSelectionRange(pidPrev.s, pidPrev.e); } catch (err) { /* ignore */ }
        pidPrev = null;
        e.stopImmediatePropagation();   // a refused key is a no-op: no draft write, no error change
        return;
      }
      pidPrev = null;
      if (clean !== v) {
        var before = digits(v.slice(0, pos)).length;
        pid.value = clean;
        try { pid.setSelectionRange(Math.min(before, clean.length), Math.min(before, clean.length)); } catch (err) { /* ignore */ }
      }
    });

    /* ---- field wiring ---- */
    var FIELD_KEY = { 'd-first': 'first', 'd-last': 'last', 'd-pid': 'pid', 'd-branch': 'branchId', 'd-city': 'city', 'd-addr': 'address', 'd-note': 'note' };
    Object.keys(FIELD_KEY).forEach(function (id) {
      var el = $(id);
      var isSel = el.tagName === 'SELECT';
      el.addEventListener(isSel ? 'change' : 'input', function () {
        var p = {}; p[FIELD_KEY[id]] = id === 'd-pid' ? digits(el.value) : el.value;
        persist(p);
        if (RULES[id]) {
          // a choice is complete on change: validate it now; a text field clears its error while typing
          // (an ID already longer than 11 digits cannot become valid by typing more: flag it right away)
          if (isSel || (id === 'd-pid' && digits(el.value).length > PID_LEN)) { touched[id] = true; check(id); } else setErr(id, '');
        }
        if (id === 'd-city') updateEta();
        if (id === 'd-branch') updateBranchAddr();
      });
      if (RULES[id] && !isSel) {
        el.addEventListener('blur', function () { if (el.value || touched[id]) { touched[id] = true; check(id); } });
      }
    });

    /* ---- method cards ---- */
    UI.bindRadioCards(root, 'dmethod', function (v) {
      var courier = v === 'courier';
      $('dlv-pickup').hidden = courier;
      $('dlv-courier').hidden = !courier;
      // errors of the panel being hidden are stale when it comes back
      (courier ? ['d-branch'] : ['d-city', 'd-addr']).forEach(function (id) { setErr(id, ''); touched[id] = false; });
      persist({ method: v });
      updateEta();
    });

    /* ---- continue ---- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = validateAll();
      if (first) { $(first).focus(); return; }
      var x = draft(), d = dl();
      d.first = $('d-first').value.trim();
      d.last = $('d-last').value.trim();
      d.pid = digits(pid.value);
      d.method = x.method;
      if (x.method === 'courier') { d.city = x.city; d.address = x.address; d.note = x.note; }
      else d.branchId = x.branchId;
      d.done = true;
      SP.save();
      SP.go('/payment');
    });

    if (ctx.entry && ctx.query.err === '1') validateAll();
  }

  SP.route('/delivery', { screen: 'delivery', title: 'მიწოდება', render: render, mount: mount });
})();

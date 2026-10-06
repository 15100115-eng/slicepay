/* =====================================================================
   SlicePay — ui.js
   Shared component renderers (HTML strings), inline icons, toast and
   modal helpers. Screens compose these.
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay;
  var esc = SP.esc;
  var UI = SP.ui = {};

  /* ------------------------------------------------------------------
     Inline icons (currentColor) — see spec_icons.md
     ------------------------------------------------------------------ */
  var ICONS = {
    'arrow-left': '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7.825 13l5.6 5.6L12 20l-8-8 8-8 1.425 1.4-5.6 5.6H20v2z"/></svg>',
    'close': '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.4 19L5 17.6l5.6-5.6L5 6.4 6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6z"/></svg>',
    'caret-down': '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7 10h10l-5 5z"/></svg>',
    'plus-circle': '<svg viewBox="0 0 43 43" width="43" height="43" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="3"><circle cx="21.5" cy="21.5" r="20"/><path stroke-linecap="round" d="M21.5 14v14.5M14.25 21.25h14.5"/></g></svg>',
    'spinner': '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false"><path fill="currentColor" d="M40 20A20 20 0 1 1 37.38 10.103L32.347 12.969A14.208 14.208 0 1 0 34.208 20z"/></svg>'
  };
  UI.icon = function (name, cls) {
    return '<span class="ico' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + (ICONS[name] || '') + '</span>';
  };
  UI.spinner = function () { return '<span class="spinner" aria-hidden="true">' + ICONS.spinner + '</span>'; };

  /* ------------------------------------------------------------------
     Copy: Mtavruli labels (literal U+1C90–U+1CBF code points)
     ------------------------------------------------------------------ */
  UI.T = {
    title: 'ᲒᲐᲛᲝᲘᲬᲔᲠᲔ ᲜᲐᲬᲘᲚ-ᲜᲐᲬᲘᲚ',
    check: 'ᲨᲔᲛᲝᲬᲛᲔᲑᲐ',
    restart: 'ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ',
    next: 'ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ',
    back: 'ᲣᲙᲐᲜ',
    total: 'ᲯᲐᲛᲘ',
    sendCode: 'ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ',
    restore: 'ᲐᲦᲓᲒᲔᲜᲐ',
    pay: 'ᲒᲐᲓᲐᲮᲓᲐ',
    received: 'ᲨᲔᲙᲕᲔᲗᲐ ᲛᲘᲦᲔᲑᲣᲚᲘᲐ',
    yourOrder: 'ᲗᲥᲕᲔᲜᲘ ᲨᲔᲙᲕᲔᲗᲐ',
    payMethod: 'ᲒᲐᲓᲐᲮᲓᲘᲡ ᲛᲔᲗᲝᲓᲘ',
    summary: 'ᲨᲔᲯᲐᲛᲔᲑᲐ',
    home: 'ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ',
    add: 'ᲓᲐᲛᲐᲢᲔᲑᲐ',
    ok: 'ᲒᲐᲡᲐᲒᲔᲑᲘᲐ'
  };
  /** Mkhedruli twins of UI.T: the accessible text (screen readers do not reliably voice Mtavruli) */
  UI.Tm = {
    title: 'გამოიწერე ნაწილ-ნაწილ',
    check: 'შემოწმება',
    restart: 'თავიდან დაწყება',
    next: 'გაგრძელება',
    back: 'უკან',
    total: 'ჯამი',
    sendCode: 'კოდის გამოგზავნა',
    restore: 'აღდგენა',
    pay: 'გადახდა',
    received: 'შეკვეთა მიღებულია',
    yourOrder: 'თქვენი შეკვეთა',
    payMethod: 'გადახდის მეთოდი',
    summary: 'შეჯამება',
    home: 'მთავარი გვერდი',
    add: 'დამატება',
    ok: 'გასაგებია'
  };
  /** Mtavruli label for markup: the glyphs are hidden from AT, the Mkhedruli twin is read instead */
  UI.mt = function (key) {
    return '<span aria-hidden="true">' + UI.T[key] + '</span><span class="sr-only">' + UI.Tm[key] + '</span>';
  };
  UI.DEFER_WEIGHT = 'წონის თანხას მოგვიანებით გადავიხდი';
  UI.DEFER_CUSTOMS = 'განბაჟების თანხას მოგვიანებით გადავიხდი';
  UI.METHODS = [
    { id: 'bog', img: 'assets/img/bog-nawil-nawil.png',
      t1: 'ᲜᲐᲬᲘᲚ-ᲜᲐᲬᲘᲚ', t2: 'ᲒᲐᲓᲐᲮᲓᲐ', s1: 'საქართველოს ბანკის', s2: 'მომხმარებლებისთვის',
      bank: 'საქართველოს ბანკი: ', plan: 'ნაწილ-ნაწილ' },
    { id: 'tbc', img: 'assets/img/tbc-ganawileba.png',
      t1: 'ᲒᲐᲜᲐᲬᲘᲚᲔᲑᲘᲗ', t2: 'ᲒᲐᲓᲐᲮᲓᲐ', s1: 'თიბისი ბანკის', s2: 'მომხმარებლებისთვის',
      bank: 'თიბისი ბანკი: ', plan: 'განაწილება' },
    { id: 'mere', img: 'assets/img/mere.png',
      t1: 'ᲛᲔᲠᲔ ᲑᲐᲠᲐᲗᲘᲗ', t2: 'ᲒᲐᲓᲐᲮᲓᲐ', s1: 'მერე ბარათის', s2: 'მფლობელებისთვის',
      bank: 'მერე: ', plan: 'ბარათით გადახდა' }
  ];
  UI.method = function (id) { return UI.METHODS.filter(function (m) { return m.id === id; })[0] || UI.METHODS[0]; };

  /* ------------------------------------------------------------------
     Shared renderers
     ------------------------------------------------------------------ */
  /** desktop header: logo + optional back link */
  UI.dHead = function (backTo) {
    return '<header class="d-head container only-d">' +
      (backTo ? '<a class="back" href="#' + esc(backTo) + '" data-back="' + esc(backTo) + '">' + UI.icon('arrow-left') + '<span>უკან დაბრუნება</span></a>' : '') +
      '<img class="logo" src="assets/icons/logo-color.svg" width="113" height="76" alt="SlicePay">' +
      '</header>';
  };

  /** mobile bottom bar. left: {label, back|action}, right: {label, action} (labels are HTML, e.g. UI.mt()) */
  UI.mBar = function (left, right) {
    var l = '', r = '';
    if (left) l = '<button type="button" class="btn-text" ' + (left.back ? 'data-back="' + esc(left.back) + '"' : 'data-action="' + esc(left.action) + '"') + '>' + left.label + '</button>';
    else if (right) l = '<span></span>';
    if (right) r = '<button type="button" class="btn" data-action="' + esc(right.action) + '"><span class="btn__label">' + right.label + '</span></button>';
    // a landmark, so the primary actions are reachable by landmark navigation (R3REV-05)
    return '<nav class="m-bar" aria-label="ნავიგაცია">' + l + r + '</nav>';
  };

  /** dotted-leader breakdown. variant: 'amount-first' | 'label-first' */
  UI.breakdown = function (t, variant, opts) {
    opts = opts || {};
    var approx = opts.long ? 'დაახლოებით' : 'დაახ.';
    var rows = [
      { l: 'ნივთის ფასი', v: t.item },
      { l: 'წონის ' + approx + ' ფასი', v: t.weight, s: t.deferWeight && t.weight > 0 },
      { l: 'განბაჟების ' + approx + ' ფასი', v: t.customs, s: t.deferCustoms && t.customs > 0 },
      { l: 'მომსახურების ფასი', v: t.service },
      { l: 'ჯამი', v: t.total, total: true }
    ];
    var html = rows.map(function (r) {
      // deferred parts: the strike-through is visual only, so say it in text for assistive tech
      var amt = '<span class="bd__amt' + (r.s ? ' is-struck' : '') + '">' + SP.fmt.moneySp(r.v) + (r.s ? '<span class="sr-only"> (მოგვიანებით)</span>' : '') + '</span>';
      var lab = '<span class="bd__lab">' + r.l + '</span>';
      var lead = '<span class="bd__lead" aria-hidden="true"></span>';
      return '<div class="bd__row' + (r.total ? ' bd__row--total' : '') + '">' +
        (variant === 'amount-first' ? amt + lead + lab : lab + lead + amt) + '</div>';
    }).join('');
    return '<div class="bd bd--' + variant + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + (opts.hidden ? ' hidden' : '') + '>' + html + '</div>';
  };

  /** "ფასი დეტალურად" toggle */
  UI.toggle = function (controls, expanded, extra) {
    return '<button type="button" class="toggle t-body" aria-expanded="' + (expanded ? 'true' : 'false') + '" aria-controls="' + controls + '" ' + (extra || '') + '>' +
      '<span>ფასი დეტალურად</span>' + UI.icon('caret-down') + '</button>';
  };

  /** checkbox row. variant: 'cart' | 'auth' */
  UI.checkbox = function (o) {
    return '<label class="check check--' + o.variant + (o.cls ? ' ' + o.cls : '') + '"' + (o.rowId ? ' id="' + o.rowId + '"' : '') + '>' +
      '<input type="checkbox" id="' + o.id + '"' + (o.name ? ' name="' + o.name + '"' : '') + (o.checked ? ' checked' : '') + (o.describedby ? ' aria-describedby="' + o.describedby + '"' : '') + '>' +
      '<span class="check__box" aria-hidden="true"></span>' +
      '<span class="check__label">' + o.label + '</span></label>';
  };

  /** auth / add-form text field.
      The placeholder shows the label while the field is empty (as designed); once it has a value the
      <label> floats onto the top border, so a visible label persists (R2-13). noErr: the caller renders
      its own message element; describedby still links it (R2-01). All fields are required unless o.optional. */
  UI.field = function (o) {
    var errId = o.id + '-err';
    var pw = o.type === 'password' && o.eye;
    var db = o.describedby || (o.noErr ? '' : errId);
    return '<div class="field' + (pw ? ' field--pw' : '') + (o.cls ? ' ' + o.cls : '') + '">' +
      '<input class="field__input" id="' + o.id + '" name="' + (o.name || o.id) + '" type="' + (o.type || 'text') + '" placeholder="' + esc(o.label) + '"' +
      (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') + (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') +
      (o.maxlength ? ' maxlength="' + o.maxlength + '"' : '') + (o.value ? ' value="' + esc(o.value) + '"' : '') +
      (db ? ' aria-describedby="' + db + '"' : '') + (o.optional ? '' : ' aria-required="true"') + ' spellcheck="false">' +
      '<label class="field__label" for="' + o.id + '">' + esc(o.label) + '</label>' +
      (pw ? '<button type="button" class="field__eye" aria-pressed="false" aria-label="პაროლის ჩვენება" data-eye="' + o.id + '"><img src="assets/icons/eye.svg" alt="" width="25" height="25"></button>' : '') +
      '</div>' + (o.noErr ? '' : '<p class="err" id="' + errId + '" aria-live="polite"></p>');
  };

  /** product thumbnail with quantity badge */
  UI.thumb = function (p) {
    var inner = p.img
      ? '<img class="thumb__img" src="' + esc(p.img) + '" alt="">'
      : '<span class="thumb__ph"><img src="assets/icons/' + (p.store === 'ebay' ? 'ebay.svg' : 'amazon.svg') + '" alt=""></span>';
    return '<div class="thumb">' + inner + '<span class="badge"><span class="sr-only">რაოდენობა </span>' + (p.qty || 1) + '</span></div>';
  };

  /* ------------------------------------------------------------------
     Field error helpers
     ------------------------------------------------------------------ */
  UI.setError = function (input, msg) {
    if (!input) return;
    var err = document.getElementById(input.id + '-err');
    if (msg) { input.setAttribute('aria-invalid', 'true'); } else { input.removeAttribute('aria-invalid'); }
    if (err) err.textContent = msg || '';
  };

  /* ------------------------------------------------------------------
     Toast
     ------------------------------------------------------------------ */
  var toastTimer = null, toastEl = null, toastLeft = 0, toastStart = 0;
  UI.toast = function (msg, opts) {
    opts = opts || {};
    var root = document.getElementById('toast-root');   // the one persistent live region (role=status in index.html)
    if (!root) return;
    if (toastEl) { toastEl.remove(); toastEl = null; }
    clearTimeout(toastTimer); toastTimer = null;
    var el = document.createElement('div');
    el.className = 'toast t-body';
    el.setAttribute('tabindex', '-1');
    if (opts.html) el.innerHTML = msg; else el.textContent = msg;
    root.appendChild(el);
    toastEl = el;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-in'); }); });
    var dur = opts.duration || 4000;
    var gone = false;
    function hide() {
      if (toastEl !== el || gone) return;
      gone = true;
      el.classList.remove('is-in');
      setTimeout(function () { if (el.parentNode) el.remove(); if (toastEl === el) toastEl = null; }, 220);
    }
    // stays while hovered OR focused; exactly one timer is live (R2-06)
    var hov = false, foc = false;
    function arm(ms) { clearTimeout(toastTimer); toastLeft = ms; toastStart = Date.now(); toastTimer = setTimeout(hide, ms); }
    function pause() {
      if (toastEl !== el || toastTimer === null) return;
      clearTimeout(toastTimer); toastTimer = null;
      toastLeft -= Date.now() - toastStart;
    }
    function resume() { if (toastEl === el && !gone && !hov && !foc && toastTimer === null) arm(Math.max(1200, toastLeft)); }
    // only a real mouse hover pauses it: touch browsers synthesise mouseenter on tap and never leave (cart-r3-02)
    el.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'mouse') return; hov = true; pause(); });
    el.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'mouse') return; hov = false; resume(); });
    el.addEventListener('focusin', function () { foc = true; pause(); });
    el.addEventListener('focusout', function () { foc = false; resume(); });
    // a tap / click dismisses it (focus from the click would otherwise keep it paused)
    el.addEventListener('click', function () {
      var sel = window.getSelection && window.getSelection();
      if (toastEl !== el || (sel && !sel.isCollapsed && el.contains(sel.anchorNode))) return;   // selecting the code is not a dismiss
      clearTimeout(toastTimer); toastTimer = null; hide();
    });
    arm(dur);
  };
  UI.codeToast = function (code) {
    UI.toast('სატესტო კოდი: <b>' + esc(code) + '</b>', { html: true, duration: 8000 });
  };

  /* ------------------------------------------------------------------
     Modal (native <dialog>)
     ------------------------------------------------------------------ */
  UI.modal = function (o) {
    var d = document.getElementById('modal');
    if (!d) return;   // never act on o.onOk without showing the content (R2-07)
    var native = typeof d.showModal === 'function';
    // an already-open modal is closed first, so its scroll lock is not captured as the "previous" value
    if (d.hasAttribute('open') && UI._closeModal) UI._closeModal(false);
    var opener = document.activeElement;
    d.innerHTML =
      '<h2 class="modal__title" id="modal-title">' + esc(o.title) + '</h2>' +
      '<button type="button" class="x-btn modal__close" aria-label="დახურვა" data-close>' + UI.icon('close') + '</button>' +
      '<div class="modal__body" tabindex="0">' + o.body + '</div>' +
      '<button type="button" class="btn" data-ok><span class="btn__label">' + (o.ok || UI.mt('ok')) + '</span></button>';
    d.setAttribute('aria-labelledby', 'modal-title');
    d.classList.remove('is-in');
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    function close(ok) {
      if (UI._closeModal === close) UI._closeModal = null;
      d.classList.remove('is-in');
      if (native) { if (d.open) d.close(); } else { d.removeAttribute('open'); d.onkeydown = null; }
      document.documentElement.style.overflow = prevOverflow;
      if (ok && o.onOk) o.onOk();
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    d.onclick = function (e) {
      // scrim: only a click outside the panel box (the dialog's own padding and gaps are also e.target === d)
      if (e.target === d) {
        var r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(false);
        return;
      }
      if (e.target.closest('[data-close]')) close(false);
      if (e.target.closest('[data-ok]')) close(true);
    };
    d.oncancel = function (e) { e.preventDefault(); close(false); };
    if (native) d.showModal();
    else {
      // no HTMLDialogElement: show it as a plain fixed panel (.modal--fallback) with Escape to close
      d.classList.add('modal--fallback');
      d.setAttribute('open', '');
      d.onkeydown = function (e) { if (e.key === 'Escape') { e.preventDefault(); close(false); } };
    }
    var t = d.querySelector('.modal__title'); t.setAttribute('tabindex', '-1'); t.focus();
    requestAnimationFrame(function () { d.classList.add('is-in'); });
    UI._closeModal = close;
  };
  UI.termsModal = function (onOk) {
    UI.modal({
      title: 'წესები და პირობები',
      body:
        '<p>SlicePay გაძლევთ საშუალებას, უცხოურ ონლაინ მაღაზიებში შეძენილი ნივთის ღირებულება გადაიხადოთ ნაწილ-ნაწილ, პარტნიორი ბანკების საშუალებით.</p>' +
        '<p>ნივთის წონისა და განბაჟების ფასი მითითებულია დაახლოებით. საბოლოო თანხა დგინდება ამანათის საქართველოში ჩამოსვლისას და შეგიძლიათ გადაიხადოთ მოგვიანებით.</p>' +
        '<p>განვადების პირობები (თვეების რაოდენობა, ყოველთვიური შენატანი) განისაზღვრება შერჩეული ბანკის მიერ. შეკვეთის დადასტურებით ეთანხმებით ბანკის მიერ თქვენი მონაცემების დამუშავებას.</p>' +
        '<p>ეს არის სადემონსტრაციო ვერსია — რეალური გადახდა არ სრულდება.</p>',
      onOk: onOk
    });
  };

  /* ------------------------------------------------------------------
     Delegated behaviour shared by all screens
     ------------------------------------------------------------------ */
  // no app form ever submits natively (a missed preventDefault would put field values, including
  // passwords, into the URL); screen handlers still run in the bubble phase (R2-11)
  document.addEventListener('submit', function (e) { if (e.target.closest && e.target.closest('#app')) e.preventDefault(); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-back]');
    // modified clicks (new tab / window) keep the link's native behaviour (R3REV-06)
    if (b && !e.defaultPrevented && !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { e.preventDefault(); SP.back(b.getAttribute('data-back')); return; }
    var eye = e.target.closest('[data-eye]');
    if (eye) {
      var inp = document.getElementById(eye.getAttribute('data-eye'));
      if (!inp) return;
      var show = inp.type === 'password';
      inp.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', show ? 'true' : 'false');
      eye.querySelector('img').src = 'assets/icons/' + (show ? 'eye-off' : 'eye') + '.svg';
    }
  });

  /** Backspace right after a group separator deletes the digit before it
      (otherwise the formatter re-inserts the space and only the caret moves) */
  UI.sepBackspace = function (input) {
    input.addEventListener('beforeinput', function (e) {
      if (e.inputType !== 'deleteContentBackward' || input.readOnly) return;
      var s = input.selectionStart, en = input.selectionEnd, v = input.value;
      if (s == null || s !== en || s < 2 || v.charAt(s - 1) !== ' ' || !/\d/.test(v.charAt(s - 2))) return;
      e.preventDefault();
      input.value = v.slice(0, s - 2) + v.slice(s);
      try { input.setSelectionRange(s - 2, s - 2); } catch (err) { /* ignore */ }
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    });
  };

  /** live phone formatting for an input */
  UI.bindPhone = function (input) {
    UI.sepBackspace(input);
    input.addEventListener('input', function () {
      var v = input.value, pos = input.selectionStart;
      var digitsBefore = v.slice(0, pos).replace(/\D/g, '').length;
      var f = SP.fmt.phone(v);
      if (f === v) return;
      input.value = f;
      var i = 0, seen = 0;
      while (i < f.length && seen < digitsBefore) { if (/\d/.test(f[i])) seen++; i++; }
      try { input.setSelectionRange(i, i); } catch (err) { /* ignore */ }
    });
  };
})();

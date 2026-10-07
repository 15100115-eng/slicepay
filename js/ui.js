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
    'spinner': '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false"><path fill="currentColor" d="M40 20A20 20 0 1 1 37.38 10.103L32.347 12.969A14.208 14.208 0 1 0 34.208 20z"/></svg>',
    // v2
    'info': '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="7.25" y="6.75" width="1.5" height="5" rx=".75" fill="currentColor"/><circle cx="8" cy="4.75" r=".95" fill="currentColor"/></svg>',
    'check': '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9.55 18l-5.7-5.7 1.425-1.425L9.55 15.15l9.175-9.175L20.15 7.4z"/></svg>',
    'user': '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 12q-1.65 0-2.825-1.175T8 8t1.175-2.825T12 4t2.825 1.175T16 8t-1.175 2.825T12 12m-8 8v-2.8q0-.85.438-1.562T5.6 14.55q1.55-.775 3.15-1.162T12 13t3.25.388t3.15 1.162q.725.375 1.163 1.088T20 17.2V20zm2-2h12v-.8q0-.275-.137-.5t-.363-.35q-1.35-.675-2.725-1.012T12 15t-2.775.338T6.5 16.35q-.225.125-.363.35T6 17.2zm6-8q.825 0 1.413-.587T14 8t-.587-1.412T12 6t-1.412.588T10 8t.588 1.413T12 10"/></svg>',
    'truck': '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 20q-1.25 0-2.125-.875T3 17H1V6q0-.825.588-1.412T3 4h14v4h3l3 4v5h-2q0 1.25-.875 2.125T18 20t-2.125-.875T15 17H9q0 1.25-.875 2.125T6 20m0-2q.425 0 .713-.288T7 17t-.288-.712T6 16t-.712.288T5 17t.288.713T6 18m-3-3h.8q.425-.45.975-.725T6 14t1.225.275T8.2 15H15V6H3zm15 3q.425 0 .713-.288T19 17t-.288-.712T18 16t-.712.288T17 17t.288.713T18 18m-1-5h4.25L19 10h-2z"/></svg>'
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
    ok: 'ᲒᲐᲡᲐᲒᲔᲑᲘᲐ',
    // v2
    confirm: 'ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ',           // phone verification
    myOrders: 'ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ',       // success secondary button
    newOrder: 'ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ',        // orders empty state / mobile bar
    delivery: 'ᲛᲘᲬᲝᲓᲔᲑᲐ',              // success receipt section heading
    // v4: profile
    save: 'ᲨᲔᲜᲐᲮᲕᲐ',                   // personal information
    changePassword: 'ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ',  // password section
    logout: 'ᲒᲐᲡᲕᲚᲐ'                  // outline logout button at the bottom
    // (the phone change uses the existing sendCode ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ and confirm ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ)
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
    ok: 'გასაგებია',
    confirm: 'დადასტურება',
    myOrders: 'ჩემი შეკვეთები',
    newOrder: 'ახალი შეკვეთა',
    delivery: 'მიწოდება',
    save: 'შენახვა',
    changePassword: 'პაროლის შეცვლა',
    logout: 'გასვლა'
  };
  /** Mtavruli label for markup: the glyphs are hidden from AT, the Mkhedruli twin is read instead */
  UI.mt = function (key) {
    return '<span aria-hidden="true">' + UI.T[key] + '</span><span class="sr-only">' + UI.Tm[key] + '</span>';
  };
  /** Mkhedruli → Mtavruli (U+10D0–10FA → U+1C90–1CBA); other characters unchanged */
  UI.toMt = function (s) {
    return String(s).replace(/[\u10D0-\u10FA\u10FD-\u10FF]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x10D0 + 0x1C90); });
  };
  /** like UI.mt() for any Mkhedruli string (escaped): Mtavruli glyphs for the eye, the Mkhedruli twin for AT */
  UI.mtx = function (mkhedruli) {
    return '<span aria-hidden="true">' + esc(UI.toMt(mkhedruli)) + '</span><span class="sr-only">' + esc(mkhedruli) + '</span>';
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
  /** desktop header: logo + optional back link + the account links top-right while signed in.
      v4: two purple links 'პროფილი' · 'ჩემი შეკვეთები' (.acct-nav); 'ჩემი შეკვეთები' keeps the right edge.
      opts.account: true / undefined = both links; 'profile' or 'orders' = only that one (e.g. the profile page
      shows only 'ჩემი შეკვეთები'); false = none (the orders screens). {backAny:true} makes the back link return
      to the previous screen when there is one (else backTo) */
  UI.dHead = function (backTo, opts) {
    opts = opts || {};
    var acct = opts.account === undefined ? true : opts.account;
    return '<header class="d-head container only-d">' +
      (backTo ? '<a class="back" href="#' + esc(backTo) + '" data-back="' + esc(backTo) + '"' + (opts.backAny ? ' data-back-any' : '') + '>' + UI.icon('arrow-left') + '<span>უკან დაბრუნება</span></a>' : '') +
      '<img class="logo" src="assets/icons/logo-color.svg" width="113" height="76" alt="SlicePay">' +
      (acct !== false && SP.isAuthed() ? UI.accountNav(acct === true ? null : acct) : '') +
      '</header>';
  };
  UI.PROFILE_LABEL = 'პროფილი';
  /** v4: the desktop header's account links (signed in): 'პროფილი' · 'ჩემი შეკვეთები'. only: 'profile' | 'orders'
      renders just that link. Each is an .acct-link (--profile / --orders) with data-acct="profile|orders" */
  UI.accountNav = function (only) {
    var links = [];
    if (only !== 'orders') links.push(UI.profileLink());
    if (only !== 'profile') links.push(UI.accountLink());
    return '<nav class="acct-nav" aria-label="ანგარიში">' + links.join('<span class="acct-nav__sep" aria-hidden="true">·</span>') + '</nav>';
  };
  /** v4: the purple 'პროფილი' link (#/profile) */
  UI.profileLink = function (cls) {
    return '<a class="acct-link acct-link--profile' + (cls ? ' ' + cls : '') + '" href="#/profile" data-acct="profile"><span>' + UI.PROFILE_LABEL + '</span></a>';
  };
  /** "ჩემი შეკვეთები" (signed in) / "შესვლა" (→ login, then my orders).
      variant 'light' = the landing's white 16 px link with a user icon; default = the purple header link
      (always "ჩემი შეკვეთები"; dHead shows it only while signed in) */
  UI.accountLink = function (variant) {
    var light = variant === 'light', authed = SP.isAuthed();
    var href = authed || !light ? '#/orders' : '#' + SP.loginUrl('/orders');
    return '<a class="acct-link acct-link--orders' + (light ? ' acct-link--light' : '') + '" href="' + esc(href) + '" data-acct="orders">' +
      (light ? UI.icon('user', 'acct-link__ico') : '') + '<span>' + (authed || !light ? 'ჩემი შეკვეთები' : 'შესვლა') + '</span></a>';
  };

  /** mobile bottom bar. left: {label, back|action[, any]}, right: {label, action} (labels are HTML, e.g. UI.mt()).
      left.any: back to the previous screen when there is one, else to left.back */
  UI.mBar = function (left, right, opts) {
    var l = '', r = '';
    if (left) l = '<button type="button" class="btn-text" ' + (left.back ? 'data-back="' + esc(left.back) + '"' + (left.any ? ' data-back-any' : '') : 'data-action="' + esc(left.action) + '"') + '>' + left.label + '</button>';
    else if (right) l = '<span></span>';
    if (right) r = '<button type="button" class="btn" data-action="' + esc(right.action) + '"><span class="btn__label">' + right.label + '</span></button>';
    // a landmark, so the primary actions are reachable by landmark navigation (R3REV-05)
    // opts.sticky: the bar sticks to the viewport bottom on phones while the page scrolls (base.css .m-bar--sticky)
    return '<nav class="m-bar' + (opts && opts.sticky ? ' m-bar--sticky' : '') + '" aria-label="ნავიგაცია">' + l + r + '</nav>';
  };

  /** dotted-leader breakdown. variant: 'amount-first' | 'label-first'.
      v2: the approximate weight / customs rows carry an info button (opts.info:false hides them; opts.productId
      ties the explanation to one cart product); a 'მიწოდების ფასი' row appears when t.delivery > 0 */
  var bdSeq = 0;   // unique label ids: the same breakdown can be rendered more than once on a page
  UI.breakdown = function (t, variant, opts) {
    opts = opts || {};
    var bdId = 'bdl' + (++bdSeq);
    var approx = opts.long ? 'დაახლოებით' : 'დაახ.';
    var rows = [
      { l: 'ნივთის ფასი', v: t.item },
      { l: 'წონის ' + approx + ' ფასი', v: t.weight, s: t.deferWeight && t.weight > 0, info: 'weight' },
      { l: 'განბაჟების ' + approx + ' ფასი', v: t.customs, s: t.deferCustoms && t.customs > 0, info: 'customs' },
      { l: 'მომსახურების ფასი', v: t.service }
    ];
    if (t.delivery > 0) rows.push({ l: 'მიწოდების ფასი', v: t.delivery });
    rows.push({ l: 'ჯამი', v: t.total, total: true });
    var html = rows.map(function (r) {
      // deferred parts: the strike-through is visual only, so say it in text for assistive tech
      var amt = '<span class="bd__amt' + (r.s ? ' is-struck' : '') + '">' + SP.fmt.moneySp(r.v) + (r.s ? '<span class="sr-only"> (მოგვიანებით)</span>' : '') + '</span>';
      var ib = '', lid = '';
      // the info button sits between the leader and the label, so labels keep their (designed) alignment;
      // it is described by its row label, so the buttons of one breakdown can be told apart (cp-11)
      if (r.info && opts.info !== false) { lid = bdId + '-' + r.info; ib = UI.infoBtn(r.info, opts.productId, null, lid); }
      var lab = '<span class="bd__lab"' + (lid ? ' id="' + lid + '"' : '') + '>' + r.l + '</span>';
      var lead = '<span class="bd__lead" aria-hidden="true"></span>';
      return '<div class="bd__row' + (r.total ? ' bd__row--total' : '') + '">' +
        (variant === 'amount-first' ? amt + lead + ib + lab : lab + ib + lead + amt) + '</div>';
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
      its own message element; describedby still links it (R2-01). All fields are required unless o.optional.
      o.placeholder: a hint shown instead of the label while empty (the label still floats once filled). */
  UI.field = function (o) {
    var errId = o.id + '-err';
    var pw = o.type === 'password' && o.eye;
    var db = o.describedby || (o.noErr ? '' : errId);
    return '<div class="field' + (pw ? ' field--pw' : '') + (o.cls ? ' ' + o.cls : '') + '">' +
      '<input class="field__input" id="' + o.id + '" name="' + (o.name || o.id) + '" type="' + (o.type || 'text') + '" placeholder="' + esc(o.placeholder || o.label) + '"' +
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
    return '<div class="thumb">' + inner + '<span class="badge"><span class="sr-only">რაოდენობა </span>' + SP.qty(p) + '</span></div>';
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
  /** v3 (REV2R3-08): a field whose orange hint note doubles as its error line (registration phone, delivery personal
      ID): the error replaces the note's text in place (no layout shift) and turns it red (.is-error); clearing it
      restores defaultText. The note must be the element the input's aria-describedby points at (usually
      '<id>-err'), so the error is announced as the field's description. noteEl: element or id (default
      input.id + '-err'). Returns true when the shown state changed. */
  UI.setNoteError = function (input, noteEl, defaultText, msg) {
    if (!input) return false;
    var note = typeof noteEl === 'string' ? document.getElementById(noteEl) : noteEl || document.getElementById(input.id + '-err');
    var t = msg || defaultText || '', changed = false;
    if (note) {
      if (note.textContent !== t) { note.textContent = t; changed = true; }
      if (note.classList.contains('is-error') !== !!msg) { note.classList.toggle('is-error', !!msg); changed = true; }
    }
    if (msg) { if (input.getAttribute('aria-invalid') !== 'true') { input.setAttribute('aria-invalid', 'true'); changed = true; } }
    else if (input.hasAttribute('aria-invalid')) { input.removeAttribute('aria-invalid'); changed = true; }
    return changed;
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
    UI.toast(esc(SP.toastMsg.testCode) + '<b>' + esc(code) + '</b>', { html: true, duration: 8000 });
  };

  /* ------------------------------------------------------------------
     Modal (native <dialog>)
     ------------------------------------------------------------------ */
  /** o: {title, body (HTML), ok (HTML label), onOk, sheet, cls, onOpen(dialogEl)}.
      sheet:true → a bottom sheet below 900 px (drag handle; slides up; backdrop / Esc / ✕ / button close it,
      as does dragging it down); the centred dialog on desktop. */
  UI.modal = function (o) {
    var d = document.getElementById('modal');
    if (!d) return;   // never act on o.onOk without showing the content (R2-07)
    var native = typeof d.showModal === 'function';
    // an already-open modal is closed first, so its scroll lock is not captured as the "previous" value
    if (d.hasAttribute('open') && UI._closeModal) UI._closeModal(false);
    var opener = document.activeElement, openerSel = controlKey(opener);
    var sheet = !!o.sheet && !SP.isDesk();
    d.className = 'modal' + (sheet ? ' modal--sheet' : '') + (o.cls ? ' ' + o.cls : '');
    d.style.transform = '';
    d.innerHTML =
      (sheet ? HANDLE : '') +
      '<h2 class="modal__title" id="modal-title">' + esc(o.title) + '</h2>' +
      '<button type="button" class="x-btn modal__close" aria-label="დახურვა" data-close>' + UI.icon('close') + '</button>' +
      '<div class="modal__body">' + o.body + '</div>' +
      '<button type="button" class="btn" data-ok><span class="btn__label">' + (o.ok || UI.mt('ok')) + '</span></button>';
    d.setAttribute('aria-labelledby', 'modal-title');
    var prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    // a breakpoint flip while open: sheet ↔ dialog in place (the responsive screens re-render behind it, REV2-05)
    var mq = o.sheet && window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
    function onFlip() {
      var sh = !!o.sheet && !SP.isDesk();
      d.classList.toggle('modal--sheet', sh);
      if (sh && !d.querySelector('.modal__handle')) d.insertAdjacentHTML('afterbegin', HANDLE);   // (hidden on desktop by CSS)
      d.classList.remove('is-dragging'); d.style.transform = '';
      fit();
    }
    // a body that scrolls gets a visible lower edge, so the hidden rest of the text is noticed (cp-08)
    function fit() {
      var b = d.querySelector('.modal__body');
      if (!b) return;
      d.classList.remove('is-scrollable');
      d.classList.toggle('is-scrollable', b.scrollHeight > b.clientHeight + 1);
      // a tab stop only when there is something to scroll with the keyboard (cp2-03)
      b.tabIndex = d.classList.contains('is-scrollable') ? 0 : -1;
    }
    function close(ok) {
      if (UI._closeModal === close) UI._closeModal = null;
      d.classList.remove('is-in', 'is-dragging');
      d.style.transform = '';
      d.onpointerdown = d.onpointermove = d.onpointerup = d.onpointercancel = null;
      if (mq) { if (mq.removeEventListener) mq.removeEventListener('change', onFlip); else if (mq.removeListener) mq.removeListener(onFlip); }
      window.removeEventListener('resize', fit);
      if (native) { if (d.open) d.close(); } else { d.removeAttribute('open'); d.onkeydown = null; }
      document.documentElement.style.overflow = prevOverflow;
      if (ok && o.onOk) o.onOk();
      returnFocus(opener, openerSel);
    }
    /* scrim: only a click outside the panel box (the dialog's own padding and gaps are also e.target === d), whose
       press also started on the scrim (a drag-select from the text ending outside is not a close), and not the
       second half of the double click / double tap that opened it (v2f-r2-04): the second press lands on the
       freshly shown backdrop at the opener's coordinates */
    function onScrim(e) {
      if (e.target !== d) return false;
      var r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    }
    var openedAt = Date.now(), scrimDown = false;
    d.onclick = function (e) {
      if (e.target === d) {
        if (onScrim(e) && scrimDown && Date.now() - openedAt > 400) close(false);
        scrimDown = false;
        return;
      }
      if (e.target.closest('[data-close]')) close(false);
      if (e.target.closest('[data-ok]')) close(true);
    };
    d.oncancel = function (e) { e.preventDefault(); close(false); };
    if (o.sheet) dragToClose(d, close);
    var dragDown = d.onpointerdown;
    d.onpointerdown = function (e) {
      scrimDown = onScrim(e) && Date.now() - openedAt > 400;
      if (dragDown) dragDown.call(d, e);
    };
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onFlip); else if (mq.addListener) mq.addListener(onFlip); }
    window.addEventListener('resize', fit);
    if (native) d.showModal();
    else {
      // no HTMLDialogElement: show it as a plain fixed panel (.modal--fallback) with Escape to close
      d.classList.add('modal--fallback');
      d.setAttribute('open', '');
      d.onkeydown = function (e) { if (e.key === 'Escape') { e.preventDefault(); close(false); } };
    }
    var t = d.querySelector('.modal__title'); t.setAttribute('tabindex', '-1'); t.focus();
    fit();
    requestAnimationFrame(function () { d.classList.add('is-in'); });
    UI._closeModal = close;
    if (o.onOpen) o.onOpen(d);
  };
  var HANDLE = '<span class="modal__handle" aria-hidden="true"></span>';
  /** a selector that finds the same control again after a re-render (id, else its data attributes) */
  var KEY_ATTRS = ['data-explain', 'data-product', 'data-order', 'data-action', 'data-terms', 'data-back'];
  function attrSel(n, v) { return '[' + n + (v ? '="' + v.replace(/["\\]/g, '\\$&') + '"' : '') + ']'; }
  function controlKey(el) {
    if (!el || el.nodeType !== 1 || el === document.body) return null;
    if (el.id) return attrSel('id', el.id);
    var sel = '';
    KEY_ATTRS.forEach(function (n) { if (el.hasAttribute(n)) sel += attrSel(n, el.getAttribute(n)); });
    return sel ? el.tagName.toLowerCase() + sel : null;
  }
  /** focus back to the opener; when a re-render replaced it, to its visible twin in #app, else (also when nothing had
      focus when it opened) the screen heading */
  function returnFocus(opener, sel) {
    // no opener at all (focus was on <body>: e.g. the explanation opened by ?info=, v2f-r3-04) counts as replaced
    if (opener === document.body || opener === document.documentElement) opener = null;
    var el = opener && document.contains(opener) ? opener : null;
    var app = document.getElementById('app');
    if (!el && sel && app) el = Array.prototype.filter.call(app.querySelectorAll(sel), function (x) { return x.getClientRects().length; })[0] || null;
    // a replaced opener, or none → the screen heading
    if (!el && app && (!opener || !document.contains(opener))) {
      el = app.querySelector('h1');
      if (el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    }
    if (el && el.focus) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  /** bottom sheet: dragging the handle / title area down by more than 80 px closes it (sheet variant only) */
  function dragToClose(d, close) {
    var y0 = null, dy = 0, id = null;
    d.onpointerdown = function (e) {
      if (!d.classList.contains('modal--sheet')) return;
      if (!e.target.closest('.modal__handle,.modal__title') || (e.pointerType === 'mouse' && e.button)) return;
      y0 = e.clientY; dy = 0; id = e.pointerId;
      try { d.setPointerCapture(id); } catch (err) { /* ignore */ }
      d.classList.add('is-dragging');
    };
    d.onpointermove = function (e) {
      if (y0 === null || e.pointerId !== id) return;
      dy = Math.max(0, e.clientY - y0);
      d.style.transform = 'translateY(' + dy + 'px)';
    };
    d.onpointerup = d.onpointercancel = function (e) {
      if (y0 === null || e.pointerId !== id) return;
      y0 = null; d.classList.remove('is-dragging'); d.style.transform = '';
      if (dy > 80 && e.type === 'pointerup') close(false);
    };
  }
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
     v2 shared components
     ------------------------------------------------------------------ */
  /** circled-i button that opens the approximate-amounts explanation. focus: 'weight' | 'customs' | null.
      describedby: id of the visible label it belongs to (the accessible name stays the spec's 'როგორ ითვლება?') */
  UI.infoBtn = function (focus, productId, orderId, describedby) {
    return '<button type="button" class="info-btn" aria-label="როგორ ითვლება?"' + (describedby ? ' aria-describedby="' + esc(describedby) + '"' : '') + ' data-explain="' + esc(focus || 'all') + '"' +
      (productId ? ' data-product="' + esc(productId) + '"' : '') + (orderId ? ' data-order="' + esc(orderId) + '"' : '') + '>' +
      UI.icon('info') + '</button>';
  };
  /** the cart's text link under the checkboxes */
  UI.explainLink = function (cls) {
    return '<button type="button" class="link t-body' + (cls ? ' ' + cls : '') + '" data-explain="all">როგორ ითვლება დაახლოებითი თანხები?</button>';
  };
  UI.EXPLAIN = {
    title: 'დაახლოებითი თანხები',
    weightH: 'წონის საფასური',
    weightP: 'ითვლება ამანათის ფაქტობრივი ან მოცულობითი წონით (რომელიც მეტია) და ტრანსპორტირების ტარიფით.',
    customsH: 'განბაჟება',
    customsP: 'დამოკიდებულია ნივთის ღირებულებაზე, კატეგორიასა და მიწოდების ღირებულებაზე. საბოლოო თანხას ადგენს საბაჟო ამანათის ჩამოსვლისას.',
    diffH: 'რა მოხდება, თუ თანხა განსხვავდება?',
    // HTML (inserted as markup; the textContent stays the spec copy verbatim): .explain__nb keeps 'მეტია —' and the
    // quoted page name on one line, so no line starts with the dash or splits the quote (cpR3-02)
    diff1: 'წინასწარ გადახდისას: თუ ფაქტობრივი თანხა ნაკლებია, სხვაობა დაგიბრუნდებათ; თუ <span class="explain__nb">მეტია —</span> სხვაობას გადაიხდით <span class="explain__nb">„ჩემი შეკვეთების“</span> გვერდიდან.',
    diff2: 'მოგვიანებით გადახდისას: ზუსტ თანხას გადაიხდით ამანათის ჩამოსვლის შემდეგ, <span class="explain__nb">„ჩემი შეკვეთების“</span> გვერდიდან.'
  };
  /** 'დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' for one product (× qty) or the sum of several; '' when weightless */
  UI.weightCalc = function (products) {
    var kg = 0, price = 0;
    (products || []).forEach(function (p) { var q = p.qty || 1; kg += SP.weightKg(p) * q; price += (p.weight || 0) * q; });
    return price > 0 ? 'დაახლოებითი წონა: ' + SP.fmt.kg(kg) + ' კგ × ' + SP.TARIFF_PER_KG + '₾ = ' + SP.fmt.money(price) : '';
  };
  /** opens the explanation: desktop = centred dialog, mobile = bottom sheet.
      o: {focus:'weight'|'customs'|null, product | products (adds the weight calculation line)} */
  UI.explain = function (o) {
    o = o || {};
    var E = UI.EXPLAIN, prods = o.products || (o.product ? [o.product] : null);
    var calc = prods ? UI.weightCalc(prods) : '';
    function sec(key, h, inner) {
      return '<section class="explain__sec' + (o.focus === key ? ' is-focus' : '') + '" data-sec="' + key + '">' +
        '<h3 class="explain__h">' + h + '</h3>' + inner + '</section>';
    }
    var body = '<div class="explain">' +
      sec('weight', E.weightH, '<p>' + E.weightP + '</p>' + (calc ? '<p class="explain__calc">' + esc(calc) + '</p>' : '')) +
      sec('customs', E.customsH, '<p>' + E.customsP + '</p>') +
      sec('diff', E.diffH, '<ul class="explain__list"><li>' + E.diff1 + '</li><li>' + E.diff2 + '</li></ul>') +
      '</div>';
    UI.modal({ title: E.title, body: body, sheet: true, cls: 'modal--explain', onOpen: function (d) {
      var f = d.querySelector('.explain__sec.is-focus');
      if (f && f.scrollIntoView) try { f.scrollIntoView({ block: 'nearest' }); } catch (e) { /* ignore */ }
    } });
  };

  /** 'N თვეში' — the chosen term in the summaries (cart, payment) */
  UI.termLabel = function (term) { return term + ' თვეში'; };
  /** the ETA line with a truck icon (cart and payment summaries, REV2R2-07). opts: {cls (row), lineCls, id (on the
      line, for live updates), centred (desktop: centred under the summary button)} */
  UI.etaRow = function (eta, opts) {
    opts = opts || {};
    return '<div class="eta-row' + (opts.centred ? ' eta-row--c' : '') + (opts.cls ? ' ' + opts.cls : '') + '">' + UI.icon('truck', 'eta-row__ico') +
      UI.etaLine(eta, { cls: opts.lineCls, id: opts.id }) + '</div>';
  };
  /** small #666 14 px line (cart summary, payment summary, order cards). opts: {cls, id, label, value}:
      value is a preformatted text instead of the window of eta (e.g. 'ჩაბარდა: 3 აგვისტო', see SP.orderArrival) */
  UI.etaLine = function (eta, opts) {
    opts = opts || {};
    return '<p class="eta-line' + (opts.cls ? ' ' + opts.cls : '') + '"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' +
      esc(opts.label || 'სავარაუდო მიღება') + ': <span class="eta-line__v">' + esc(opts.value != null ? opts.value : SP.etaText(eta)) + '</span></p>';
  };
  /** THE order arrival line (orders list cards; REV2R3-03 — the one shared implementation, screens do not re-build
      it): 'სავარაუდო მიღება: 16–21 ოქტომბერი', or 'ჩაბარდა: 3 აგვისტო' once delivered (SP.orderArrival). Each day
      is glued to its month with a no-break space, so a cross-month window that has to wrap on a narrow phone breaks
      only after the dash: '28 სექტემბერი –' / '3 ოქტომბერი'. opts: as UI.etaLine ({cls, id}), e.g.
      UI.orderEtaLine(o, {cls:'ord-card__eta'}) */
  UI.orderEtaLine = function (o, opts) {
    var a = SP.orderArrival(o), x = {};
    for (var k in opts || {}) x[k] = opts[k];
    x.label = a.label; x.value = String(a.value || '').replace(/(\d) /g, '$1\u00a0');
    return UI.etaLine(null, x);
  };
  /** light purple box with a truck icon (delivery screen). opts: {cls, id} — the id goes on the value span (live updates) */
  UI.etaBox = function (eta, opts) {
    opts = opts || {};
    return '<div class="eta-box' + (opts.cls ? ' ' + opts.cls : '') + '">' + UI.icon('truck', 'eta-box__ico') +
      '<div class="eta-box__text"><p class="eta-box__main">ამანათის სავარაუდო მიღება: <span class="eta-box__v"' + (opts.id ? ' id="' + opts.id + '"' : '') + '>' + esc(SP.etaText(eta)) + '</span></p>' +
      '<p class="eta-box__note">ვადა შეიძლება შეიცვალოს საბაჟო პროცედურების გამო</p></div></div>';
  };

  /** term selector (payment): label, radiogroup of chips ('4 თვე' / '150₾ / თვე'), note.
      o: {method, term, total, id:'terms'} — native radios name="term" (arrow keys move the selection) */
  UI.termChips = function (o) {
    var id = o.id || 'terms', list = SP.termsFor(o.method), term = SP.nearestTerm(o.method, o.term);
    return '<div class="terms" id="' + id + '">' +
      '<p class="terms__label" id="' + id + '-l">განვადების ვადა</p>' +
      '<fieldset class="terms__chips" role="radiogroup" aria-labelledby="' + id + '-l" data-n="' + list.length + '" style="--n:' + list.length + '">' +
        list.map(function (n) {
          var on = n === term;
          return '<label class="term-chip' + (on ? ' is-selected' : '') + '" data-term="' + n + '">' +
            '<input class="sr-only" type="radio" name="term" id="term-' + n + '" value="' + n + '"' + (on ? ' checked' : '') + '>' +
            '<span class="term-chip__n">' + n + ' თვე</span>' +
            '<span class="term-chip__m">' + SP.fmt.money(SP.monthly(o.total, n)) + ' / თვე</span></label>';
        }).join('') +
      '</fieldset>' +
      '<p class="terms__note">0% საკომისიო · საბოლოო პირობებს ადგენს ბანკი</p>' +
    '</div>';
  };
  /** wires the chips inside root: keeps .is-selected in sync, stores the term (SP.setTerm), calls onChange(term) */
  UI.bindTermChips = function (root, onChange) {
    root.addEventListener('change', function (e) {
      if (e.target.name !== 'term') return;
      var n = SP.setTerm(+e.target.value);
      root.querySelectorAll('.term-chip').forEach(function (c) { c.classList.toggle('is-selected', +c.getAttribute('data-term') === n); });
      if (onChange) onChange(n);
    });
  };
  /** generic radio card (delivery method …): native radio, title + optional sub. o: {name, value, checked, title, sub, id, cls} */
  UI.radioCard = function (o) {
    var id = o.id || (o.name + '-' + o.value);
    return '<label class="rcard' + (o.checked ? ' is-selected' : '') + (o.cls ? ' ' + o.cls : '') + '" data-value="' + esc(o.value) + '">' +
      '<input class="sr-only" type="radio" name="' + esc(o.name) + '" id="' + esc(id) + '" value="' + esc(o.value) + '"' + (o.checked ? ' checked' : '') + '>' +
      '<span class="rcard__radio" aria-hidden="true"></span>' +
      '<span class="rcard__text"><span class="rcard__title">' + o.title + '</span>' + (o.sub ? '<span class="rcard__sub">' + o.sub + '</span>' : '') + '</span>' +
      '</label>';
  };
  /** a radiogroup of UI.radioCard. o: {name, label (accessible name) | labelledby (id of a visible heading), items:[radioCard opts], cls} */
  UI.radioCards = function (o) {
    return '<fieldset class="rcards' + (o.cls ? ' ' + o.cls : '') + '" role="radiogroup" ' + (o.labelledby ? 'aria-labelledby="' + esc(o.labelledby) + '"' : 'aria-label="' + esc(o.label) + '"') + '>' +
      o.items.map(function (it) { it.name = o.name; return UI.radioCard(it); }).join('') + '</fieldset>';
  };
  UI.bindRadioCards = function (root, name, onChange) {
    root.addEventListener('change', function (e) {
      if (e.target.name !== name) return;
      root.querySelectorAll('input[name="' + name + '"]').forEach(function (i) { var c = i.closest('.rcard'); if (c) c.classList.toggle('is-selected', i.checked); });
      if (onChange) onChange(e.target.value);
    });
  };

  /** select styled like .field (custom caret). The empty first option is the placeholder (= label);
      the label floats once a value is chosen. o: {id, label, options:[{value,label}|string], value, optional, noErr, describedby, autocomplete, cls} */
  UI.selectField = function (o) {
    var errId = o.id + '-err';
    var db = o.describedby || (o.noErr ? '' : errId);
    var opts = (o.options || []).map(function (x) {
      var v = typeof x === 'string' ? x : x.value, l = typeof x === 'string' ? x : x.label;
      return '<option value="' + esc(v) + '"' + (o.value != null && String(o.value) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
    var empty = o.value == null || o.value === '';
    return '<div class="field field--select' + (o.cls ? ' ' + o.cls : '') + '">' +
      // only a required select carries the native required (its :invalid drives the placeholder styling); an
      // optional one is styled by base.css's :not([required]):has(option[value=""]:checked) twin rules (REV2R3-05)
      '<select class="field__input field__select" id="' + o.id + '" name="' + (o.name || o.id) + '"' + (o.optional ? '' : ' required') +
      (o.autocomplete ? ' autocomplete="' + o.autocomplete + '"' : '') +
      (db ? ' aria-describedby="' + db + '"' : '') + (o.optional ? '' : ' aria-required="true"') + '>' +
      '<option value="" disabled hidden' + (empty ? ' selected' : '') + '>' + esc(o.label) + '</option>' + opts + '</select>' +
      '<label class="field__label" for="' + o.id + '">' + esc(o.label) + '</label>' +
      UI.icon('caret-down', 'field__caret') +
      '</div>' + (o.noErr ? '' : '<p class="err" id="' + errId + '" aria-live="polite"></p>');
  };

  /** order status pill: the status name, in the due colours while a payment is due */
  UI.statusPill = function (order) {
    var p = SP.orderPill(order);
    return '<span class="status-pill status-pill--' + p.kind + '">' + esc(p.label) + '</span>';
  };
  /** vertical status timeline (done steps checked, current highlighted, future muted). Each step also says its
      state in text, which the check / ring only show visually (REV2-02). opts.labelledby: the section heading id */
  var TL_STATE = { done: 'შესრულებულია', current: 'მიმდინარე ეტაპი', todo: 'მოსალოდნელი' };
  UI.timeline = function (order, opts) {
    opts = opts || {};
    return '<ol class="tl"' + (opts.labelledby ? ' aria-labelledby="' + esc(opts.labelledby) + '"' : '') + '>' + SP.orderTimeline(order).map(function (s) {
      return '<li class="tl__item is-' + s.state + '"' + (s.state === 'current' ? ' aria-current="step"' : '') + '>' +
        '<span class="tl__dot" aria-hidden="true">' + (s.state === 'done' ? ICONS.check : '') + '</span>' +
        '<span class="tl__body"><span class="tl__label">' + esc(s.label) + '<span class="sr-only">, ' + TL_STATE[s.state] + '</span></span>' +
        (s.date ? '<span class="tl__date">' + esc(SP.fmt.date(s.date)) + '</span>' : '') + '</span></li>';
    }).join('') + '</ol>';
  };

  /** a resend link with a '(0:30)' countdown (recover code, phone verification). leftFn() → seconds left.
      Returns {refresh, stop}: refresh after a resend, stop on unmount */
  UI.cooldownLink = function (btn, base, leftFn) {
    var timer = null;
    function tick() {
      clearTimeout(timer); timer = null;
      if (!btn.isConnected) return;
      var left = Math.max(0, leftFn() || 0);
      var t = left > 0 ? base + ' (0:' + String(left).padStart(2, '0') + ')' : base;
      if (btn.textContent !== t) btn.textContent = t;
      if (left > 0) { btn.setAttribute('aria-disabled', 'true'); timer = setTimeout(tick, 250); }
      else btn.removeAttribute('aria-disabled');
    }
    tick();
    return { refresh: tick, stop: function () { clearTimeout(timer); timer = null; } };
  };

  /** sign out (toast + landing) */
  UI.logout = function () { SP.logout(); };

  /* ------------------------------------------------------------------
     Delegated behaviour shared by all screens
     ------------------------------------------------------------------ */
  // no app form ever submits natively (a missed preventDefault would put field values, including
  // passwords, into the URL); screen handlers still run in the bubble phase (R2-11)
  document.addEventListener('submit', function (e) { if (e.target.closest && e.target.closest('#app')) e.preventDefault(); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-back]');
    // modified clicks (new tab / window) keep the link's native behaviour (R3REV-06)
    if (b && !e.defaultPrevented && !(e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) { e.preventDefault(); SP.back(b.getAttribute('data-back'), { any: b.hasAttribute('data-back-any') }); return; }
    // v2: info buttons / the cart's "how is it calculated?" link open the explanation
    var x = !e.defaultPrevented && e.target.closest('[data-explain]');
    if (x) {
      var focus = x.getAttribute('data-explain'), pid = x.getAttribute('data-product'), oid = x.getAttribute('data-order');
      var st = SP.state(), prods = null;
      if (oid) { var ord = SP.orders.get(oid); prods = ord ? ord.products : null; }
      else if (pid) prods = (st.products || []).concat(st.order ? st.order.products : []).filter(function (p) { return p.id === pid; }).slice(0, 1);
      else if (focus !== 'all' && st.products.length) prods = st.products;
      UI.explain({ focus: focus === 'all' ? null : focus, products: prods && prods.length ? prods : null });
      return;
    }
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

/* =====================================================================
   SlicePay — core.js
   window.SlicePay namespace: state store (sessionStorage), hash router
   with query parsing + guards, pricing, formatting, validation, mock
   backend (users in localStorage) and QA URL parameters.
   Classic script (no modules) so the app works over file://.
   ===================================================================== */
(function () {
  'use strict';

  var SP = window.SlicePay = window.SlicePay || {};
  var STATE_KEY = 'slicepay:v1:state';
  var USERS_KEY = 'slicepay:v1:users';
  var REMEMBER_KEY = 'slicepay:v1:remember';
  var ORDERS_KEY = 'slicepay:v1:orders';      // v2: {<phone>: [order, …]} — no card data, personal ID masked
  var DESK_MQ = '(min-width: 900px)';

  /* ------------------------------------------------------------------
     Safe storage
     ------------------------------------------------------------------ */
  function storeGet(store, key) {
    try { var v = window[store].getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function storeSet(store, key, val) {
    try { window[store].setItem(key, JSON.stringify(val)); } catch (e) { /* private mode / quota */ }
  }
  function storeDel(store, key) {
    try { window[store].removeItem(key); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------
     State
     ------------------------------------------------------------------ */
  /** the delivery step's form state (v2). first/last/pid are session-only; persisted orders keep the pid masked */
  function deliveryDefaults(keep) {
    var d = { done: false, method: 'pickup', branchId: 'vake', city: '', address: '', note: '', first: '', last: '', pid: '' };
    if (keep && typeof keep === 'object') {
      ['method', 'branchId', 'city', 'address', 'note', 'first', 'last', 'pid'].forEach(function (k) { if (keep[k] != null) d[k] = keep[k]; });
    }
    return d;
  }
  SP.deliveryDefaults = deliveryDefaults;

  function defaults() {
    return {
      products: [],          // {id,name,url,store,img,item,weight,customs,service,qty,weightKg}
      deferWeight: true,     // checkbox "წონის თანხას მოგვიანებით გადავიხდი"
      deferCustoms: true,    // checkbox "განბაჟების თანხას მოგვიანებით გადავიხდი"
      method: 'bog',         // bog | tbc | mere
      term: 4,               // instalment months (v2); always one of SP.termsFor(method)
      delivery: deliveryDefaults(),   // v2 delivery step: {done, method, branchId, city, address, note, first, last, pid}
      userPhone: null,       // logged-in user (9-digit phone)
      profile: null,         // {first,last} of the account verified in this session (prefills delivery)
      pendingReg: null,      // v2 registration awaiting SMS verification: {first,last,phone,email,rec,code,sentAt,expiresAt,next,demo}
      phoneChange: null,     // v4 profile phone change awaiting SMS verification: {from, phone, code, sentAt, expiresAt, demo}
      order: null,         // snapshot created on payment (also stored in the orders store)
      recover: null,         // {phone, code, sentAt}
      loginPhone: null,      // just-recovered phone, pre-fills the login form
      ui: { details: {}, payDetails: false }
    };
  }

  /** a product's quantity as a whole number >= 1 (stored snapshots are not trusted: it reaches markup, REV2R2-10) */
  SP.qty = function (p) { var n = Math.floor(+(p && p.qty)); return n >= 1 && n < 1e6 ? n : 1; };

  var state = defaults();
  (function load() {
    var s = storeGet('sessionStorage', STATE_KEY);
    if (s && typeof s === 'object') {
      var d = defaults();
      for (var k in d) if (Object.prototype.hasOwnProperty.call(s, k)) d[k] = s[k];
      if (!Array.isArray(d.products)) d.products = [];
      d.products.forEach(function (p) { if (p && typeof p === 'object') p.qty = SP.qty(p); });
      if (d.order && Array.isArray(d.order.products)) d.order.products.forEach(function (p) { if (p && typeof p === 'object') p.qty = SP.qty(p); });
      if (d.order) withProcessing(d.order);   // v4: a receipt saved by an older build has no 'processing' step
      if (!d.ui || typeof d.ui !== 'object') d.ui = { details: {}, payDetails: false };
      if (!d.ui.details) d.ui.details = {};
      var dd = deliveryDefaults(d.delivery); dd.done = !!(d.delivery && d.delivery.done); d.delivery = dd;
      if (!(+d.term > 0)) d.term = 4;
      state = d;
    }
  })();

  SP.state = function () { return state; };
  SP.getState = function () { return JSON.parse(JSON.stringify(state)); };
  SP.save = function () { storeSet('sessionStorage', STATE_KEY, state); };
  /** merge a patch into the state and persist it (screens update their own DOM; nothing re-renders) */
  SP.set = function (patch) {
    for (var k in patch) state[k] = patch[k];
    SP.save();
  };
  /** clears the cart, order and UI state. The signed-in session survives ("start over" / "home" are not
      sign-out actions, R2-05) unless opts.signOut is passed. */
  SP.reset = function (opts) {
    opts = opts || {};
    var keepUser = opts.signOut ? null : state.userPhone;
    var keepDelivery = opts.signOut ? null : state.delivery, keepProfile = opts.signOut ? null : state.profile;
    state = defaults();
    state.userPhone = keepUser;
    // a signed-in "start over" keeps the recipient / address for the next order, but it must be confirmed again
    if (keepDelivery) state.delivery = deliveryDefaults(keepDelivery);
    state.profile = keepProfile;
    storeDel('sessionStorage', STATE_KEY);
    if (keepUser) SP.save();
    if (opts.go !== false) SP.go('/', { replace: true });
  };

  /* ------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------ */
  SP.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  SP.uid = function () { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  SP.isDesk = function () { return !!(window.matchMedia && window.matchMedia(DESK_MQ).matches); };
  SP.reducedMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  SP.noAnim = function () { return document.documentElement.classList.contains('no-anim'); };
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /** a CSS time token (base.css :root, in s or ms) in ms; fallback when it is missing or not a number */
  SP.cssMs = function (name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    var n = parseFloat(v);
    return isNaN(n) ? fallback : /ms$/.test(v) ? n : n * 1000;
  };

  /* ------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------ */
  var MONTHS = ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'];
  /** local calendar dates as 'YYYY-MM-DD' (no time zone shifts) */
  function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dateOf(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  SP.fmt = {
    money: function (n) { return String(Math.round(n)) + '₾'; },        // 600₾
    moneySp: function (n) { return String(Math.round(n)) + ' ₾'; },     // 500 ₾
    /** 'YYYY-MM-DD' → '15 თებერვალი 2025' */
    date: function (iso) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
      if (!m) return '';
      var mo = parseInt(m[2], 10), dd = parseInt(m[3], 10);
      if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return '';
      // impossible calendar dates (30 Feb, 31 Apr …) roll over in Date: reject them (R2F-09)
      var dt = new Date(+m[1], mo - 1, dd);
      if (dt.getMonth() !== mo - 1 || dt.getDate() !== dd) return '';
      return dd + ' ' + MONTHS[mo - 1] + ' ' + m[1];
    },
    todayIso: function () { return isoOf(new Date()); },
    /** 'YYYY-MM-DD' → '3 აგვისტო' (no year) */
    dayMonth: function (iso) {
      var d = dateOf(iso);
      return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : '';
    },
    /** ETA range: same month '16–21 ოქტომბერი', across months '28 ოქტომბერი – 3 ნოემბერი' */
    range: function (fromIso, toIso) {
      var a = dateOf(fromIso), b = dateOf(toIso);
      if (!a || !b) return '';
      if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
        return a.getDate() === b.getDate() ? a.getDate() + ' ' + MONTHS[a.getMonth()] : a.getDate() + '–' + b.getDate() + ' ' + MONTHS[a.getMonth()];
      }
      return a.getDate() + ' ' + MONTHS[a.getMonth()] + ' – ' + b.getDate() + ' ' + MONTHS[b.getMonth()];
    },
    addDays: function (iso, n) { var d = dateOf(iso); if (!d) return ''; d.setDate(d.getDate() + n); return isoOf(d); },
    /** calendar months later; the day is clamped to the target month (31 Jan + 1 → 28/29 Feb) */
    addMonths: function (iso, n) {
      var d = dateOf(iso); if (!d) return '';
      var day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
      var last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return isoOf(d);
    },
    /** Georgian ordinal: 1 → '1-ლი', 2 → 'მე-2' */
    ordinal: function (n) { return n === 1 ? '1-ლი' : 'მე-' + n; },
    /** kilograms with a Georgian decimal comma: 4 → '4', 1.6 → '1,6' */
    kg: function (n) { var r = Math.round(n * 10) / 10; return String(r).replace('.', ','); },
    /** personal ID → '********345' (only the last 3 digits are ever shown or persisted) */
    pidMask: function (pid) { var d = String(pid || '').replace(/\D/g, ''); return d ? new Array(Math.max(0, d.length - 3) + 1).join('*') + d.slice(-3) : ''; },
    /** digits → '5XX XXX XXX' (with optional '+995 ' prefix kept) */
    phone: function (raw) {
      var s = String(raw || '');
      var plus = /^\s*\+/.test(s);
      var d = s.replace(/\D/g, '');
      var pre = '';
      if (plus || (d.length > 9 && d.indexOf('995') === 0)) {
        if (d.indexOf('995') === 0) { pre = '+995 '; d = d.slice(3); }
        else if (plus) { return '+' + d.slice(0, 15); }
      }
      d = d.slice(0, 9);
      var out = d.slice(0, 3);
      if (d.length > 3) out += ' ' + d.slice(3, 6);
      if (d.length > 6) out += ' ' + d.slice(6, 9);
      return pre + out;
    },
    cardNumber: function (raw, brand) {
      var d = String(raw || '').replace(/\D/g, '');
      var groups = brand === 'amex' ? [4, 6, 5] : brand === 'diners' && d.length <= 14 ? [4, 6, 4] : [4, 4, 4, 4, 3];
      var max = brand === 'amex' ? 15 : 19;
      d = d.slice(0, max);
      var out = [], i = 0;
      for (var g = 0; g < groups.length && i < d.length; g++) { out.push(d.slice(i, i + groups[g])); i += groups[g]; }
      return out.join(' ');
    }
  };

  /* ------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------ */
  SP.msg = {
    required: 'სავალდებულო ველი',
    phone: 'შეიყვანეთ ნომერი ფორმატით 5XX XXX XXX',
    password: 'მინიმუმ 8 სიმბოლო',
    email: 'არასწორი ელ.ფოსტა',
    match: 'პაროლები არ ემთხვევა',
    code: 'შეიყვანეთ 4-ნიშნა კოდი',
    codeWrong: 'კოდი არასწორია',
    terms: 'გთხოვთ დაეთანხმოთ წესებს',
    url: 'შეიყვანეთ სწორი ლინკი (https://…)',
    loginFail: 'ტელეფონის ნომერი ან პაროლი არასწორია',
    noUser: 'ამ ნომრით მომხმარებელი არ არსებობს',
    userExists: 'ამ ნომრით მომხმარებელი უკვე არსებობს',
    card: 'ბარათის ნომერი არასწორია',
    exp: 'ვადა არასწორია',            // short: must fit one line in the 148 px Exp column (cs-r2-04)
    expPast: 'ვადა ამოწურულია',
    cvv: 'შეიყვანეთ CVV',            // short: one line in the CVV column down to 320 px (cs-r3-03)
    cvvBad: 'CVV არასწორია',
    // v2: phone verification
    codeExpired: 'კოდს ვადა გაუვიდა, მოითხოვეთ ახალი',
    // v2: delivery step
    first: 'შეიყვანეთ სახელი',
    last: 'შეიყვანეთ გვარი',
    pid: 'პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან',
    branch: 'აირჩიეთ ფილიალი',
    city: 'აირჩიეთ ქალაქი',
    address: 'შეიყვანეთ მისამართი',
    // v4: profile (the phone format error is SP.msg.phone, the ≥ 8 rule SP.msg.password, the mismatch SP.msg.match)
    phoneSame: 'ახალი ნომერი ემთხვევა მიმდინარეს',
    phoneTaken: 'ეს ნომერი უკვე დარეგისტრირებულია',
    passCurrent: 'მიმდინარე პაროლი არასწორია',
    passSame: 'ახალი პაროლი ემთხვევა მიმდინარეს'
  };
  /** v2 toast copy */
  SP.toastMsg = {
    testCode: 'სატესტო კოდი: ',                 // + code (UI.codeToast renders it)
    verified: 'ნომერი დადასტურებულია',
    paid: 'გადახდა წარმატებით შესრულდა',
    logout: 'თქვენ გამოხვედით სისტემიდან',
    // v4: profile
    profileSaved: 'ცვლილებები შენახულია',
    phoneChanged: 'ტელეფონის ნომერი შეიცვალა',
    passwordChanged: 'პაროლი შეიცვალა'
  };
  SP.valid = {
    /** returns the 9-digit national number or null */
    phone: function (v) {
      var d = String(v || '').replace(/\D/g, '');
      if (d.length === 12 && d.indexOf('995') === 0) d = d.slice(3);
      return /^5\d{8}$/.test(d) ? d : null;
    },
    password: function (v) { return String(v || '').trim().length >= 8; },
    email: function (v) { return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/.test(String(v || '').trim()); },
    code: function (v) { return /^\d{4}$/.test(String(v || '').trim()); },
    /** personal ID number: exactly 11 digits (spaces ignored) */
    pid: function (v) { return /^\d{11}$/.test(String(v || '').replace(/\s/g, '')); },
    /** returns a normalised URL string or null */
    url: function (v) {
      var s = String(v || '').trim();
      if (!s || /\s/.test(s)) return null;
      if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[\w-]+(\.[\w-]+)+([/?#].*)?$/.test(s)) s = 'https://' + s;
      try {
        var u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(u.hostname)) return null;
        return u.href;
      } catch (e) { return null; }
    },
    luhn: function (num) {
      var d = String(num).replace(/\D/g, ''), sum = 0, alt = false;
      for (var i = d.length - 1; i >= 0; i--) {
        var n = +d[i];
        if (alt) { n *= 2; if (n > 9) n -= 9; }
        sum += n; alt = !alt;
      }
      return d.length > 0 && sum % 10 === 0;
    },
    cardBrand: function (num) {
      var d = String(num || '').replace(/\D/g, '');
      if (/^4/.test(d)) return 'visa';
      if (/^3[47]/.test(d)) return 'amex';
      if (/^3(0[0-5]|[689])/.test(d)) return 'diners';
      if (/^(6011|65|64[4-9]|622)/.test(d)) return 'discover';
      if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
      if (/^(5[06-9]|6\d)/.test(d)) return 'maestro';
      return null;
    },
    cardNumber: function (num) {
      var d = String(num || '').replace(/\D/g, '');
      var b = SP.valid.cardBrand(d);
      if (!b) return false;
      var okLen = b === 'amex' ? d.length === 15
        : b === 'diners' ? (d.length >= 14 && d.length <= 16)
        : b === 'maestro' ? (d.length >= 12 && d.length <= 19)
        : b === 'visa' ? (d.length === 13 || d.length === 16 || d.length === 19)
        : d.length === 16;
      return okLen && SP.valid.luhn(d);
    },
    /** 'ok' | 'past' (well-formed but expired) | 'bad' */
    expState: function (v) {
      var m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(v || '').trim());
      if (!m) return 'bad';
      var mo = +m[1], yr = 2000 + (+m[2]);
      if (mo < 1 || mo > 12) return 'bad';
      var now = new Date();
      return yr > now.getFullYear() || (yr === now.getFullYear() && mo >= now.getMonth() + 1) ? 'ok' : 'past';
    },
    cvv: function (v, brand) {
      return (brand === 'amex' ? /^\d{4}$/ : /^\d{3}$/).test(String(v || ''));
    }
  };

  /* ------------------------------------------------------------------
     Products + pricing
     ------------------------------------------------------------------ */
  SP.storeOf = function (url) {
    try { return /ebay\./i.test(new URL(url).hostname) ? 'ebay' : 'amazon'; } catch (e) { return 'amazon'; }
  };
  SP.demoProduct = function (url) {
    return {
      id: 'demo-nike',
      name: 'Nike Air Pegasus 89 Men Size 9Aon ...',
      url: url || 'https://www.amazon.com/Nike-Air-Pegasus-89-Men/dp/demo',
      store: url ? SP.storeOf(url) : 'amazon',
      img: 'assets/img/product-nike.jpg',
      item: 500, weight: 100, customs: 250, service: 100, qty: 1, weightKg: 4
    };
  };
  var SLUG_SKIP = /^(dp|gp|itm|p|product|products|item|items|ref|s|b|en|us|www|html?|index)$/i;
  function nameFromUrl(url, store) {
    var best = '';
    try {
      var u = new URL(url);
      u.pathname.split('/').forEach(function (seg) {
        var t = decodeURIComponent(seg).replace(/\.(html?|php|aspx?)$/i, '');
        if (!t || SLUG_SKIP.test(t) || /^[A-Z0-9]{8,12}$/.test(t) || /^\d+$/.test(t) || /^ref=/.test(t)) return;
        if (t.replace(/[^a-z]/gi, '').length > best.replace(/[^a-z]/gi, '').length) best = t;
      });
    } catch (e) { /* ignore */ }
    best = best.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!best) return (store === 'ebay' ? 'eBay' : 'Amazon') + ' product';
    return best.split(' ').map(function (w) { return w.length > 2 && /^[a-z]+$/.test(w) ? w[0].toUpperCase() + w.slice(1) : w; }).join(' ');
  }
  SP.mockProduct = function (url) {
    var h = hashStr(url);
    var store = SP.storeOf(url);
    var item = 60 + (h % 85) * 10;                      // 60 … 900
    var weight = 20 + ((h >>> 8) % 14) * 10;            // 20 … 150
    var customs = item > 300 ? Math.round(item * 0.18 / 10) * 10 : 0;
    var service = Math.max(30, Math.round(item * 0.1 / 10) * 10);
    return { id: SP.uid(), name: nameFromUrl(url, store), url: url, store: store, img: null,
      item: item, weight: weight, customs: customs, service: service, qty: 1, weightKg: weight / SP.TARIFF_PER_KG };
  };
  /** transport tariff of the mock weight price (₾ per kg) */
  SP.TARIFF_PER_KG = 25;
  /** approximate weight of ONE unit in kg (products stored by v1 builds have no weightKg) */
  SP.weightKg = function (p) { return p && p.weightKg > 0 ? p.weightKg : (p ? (p.weight || 0) / SP.TARIFF_PER_KG : 0); };
  /** adds a product (or increments the quantity of the same URL) */
  SP.addProduct = function (url, opts) {
    var p = (opts && opts.demo) ? SP.demoProduct(url) : SP.mockProduct(url);
    for (var i = 0; i < state.products.length; i++) {
      if (state.products[i].url === p.url) { state.products[i].qty = (state.products[i].qty || 1) + 1; SP.save(); return state.products[i]; }
    }
    state.products.push(p); SP.save(); return p;
  };
  SP.removeProduct = function (id) {
    state.products = state.products.filter(function (p) { return p.id !== id; });
    delete state.ui.details[id];
    // an emptied cart ends this order: the next cart must confirm its delivery (and fee) again (v2f-r1-05);
    // the recipient and address are kept, as on "start over"
    if (!state.products.length) state.delivery.done = false;
    SP.save();
  };

  /** per-product price lines (deferred parts excluded from payable) */
  SP.price = function (p, st) {
    st = st || state;
    var q = p.qty || 1;
    var r = { item: p.item * q, weight: p.weight * q, customs: p.customs * q, service: p.service * q,
      deferWeight: !!st.deferWeight, deferCustoms: !!st.deferCustoms };
    r.full = r.item + r.weight + r.customs + r.service;
    r.payable = r.item + r.service + (r.deferWeight ? 0 : r.weight) + (r.deferCustoms ? 0 : r.customs);
    return r;
  };
  /** order totals. Works on the live state, on an order snapshot (uses its deliveryFee / term) or on any
      {products, deferWeight, deferCustoms[, term][, delivery|deliveryFee]} object (v1 callers get term 4, fee 0).
      → {item, weight, customs, service, subtotal, delivery, total, term, monthly, deferWeight, deferCustoms}
      total = payable now = item + service + non-deferred weight/customs + delivery fee */
  SP.totals = function (st) {
    st = st || state;
    var t = { item: 0, weight: 0, customs: 0, service: 0, subtotal: 0, delivery: 0, total: 0, deferWeight: !!st.deferWeight, deferCustoms: !!st.deferCustoms };
    (st.products || []).forEach(function (p) {
      var r = SP.price(p, st);
      t.item += r.item; t.weight += r.weight; t.customs += r.customs; t.service += r.service; t.subtotal += r.payable;
    });
    // the delivery fee joins the payable total once the delivery step is completed (or from the snapshot):
    // SP.confirmedDelivery is the one rule, shared with the ETA (v2f-r3-02)
    t.delivery = st.deliveryFee != null ? +st.deliveryFee || 0 : SP.deliveryFee(SP.confirmedDelivery(st));
    t.total = t.subtotal + t.delivery;
    t.term = +st.term > 0 ? +st.term : 4;
    t.monthly = SP.monthly(t.total, t.term);
    return t;
  };
  SP.monthly = function (total, term) { return Math.ceil(total / (term || 4)); };

  /* ---- instalment terms (mock, 0 %) ---- */
  SP.TERMS = { bog: [3, 4, 6], tbc: [3, 4, 6, 9, 12], mere: [4, 6, 12] };
  SP.termsFor = function (method) { return (SP.TERMS[method] || SP.TERMS.bog).slice(); };
  /** the term if the method offers it, else the nearest offered one (a tie goes to the shorter term) */
  SP.nearestTerm = function (method, term) {
    var list = SP.termsFor(method), best = list[0];
    term = +term || 4;
    list.forEach(function (n) { if (Math.abs(n - term) < Math.abs(best - term)) best = n; });
    return best;
  };
  /** select a payment method and keep the term valid for it; returns the (possibly changed) term */
  SP.setMethod = function (method) {
    if (!SP.TERMS[method]) return state.term;
    state.method = method; state.term = SP.nearestTerm(method, state.term); SP.save();
    return state.term;
  };
  SP.setTerm = function (n) { state.term = SP.nearestTerm(state.method, n); SP.save(); return state.term; };

  /* ------------------------------------------------------------------
     Delivery (v2): branches, cities, fee, ETA
     ------------------------------------------------------------------ */
  SP.BRANCHES = [
    { id: 'vake', name: 'ვაკის ფილიალი', addr: 'ჭავჭავაძის გამზ. 37, თბილისი', city: 'თბილისი' },
    { id: 'saburtalo', name: 'საბურთალოს ფილიალი', addr: 'პეკინის გამზ. 12, თბილისი', city: 'თბილისი' },
    { id: 'gldani', name: 'გლდანის ფილიალი', addr: 'ხიზანიშვილის ქ. 5, თბილისი', city: 'თბილისი' },
    { id: 'batumi', name: 'ბათუმის ფილიალი', addr: 'რუსთაველის ქ. 15, ბათუმი', city: 'ბათუმი' },
    { id: 'kutaisi', name: 'ქუთაისის ფილიალი', addr: 'წერეთლის ქ. 8, ქუთაისი', city: 'ქუთაისი' }
  ];
  SP.BRANCHES.forEach(function (b) { b.label = b.name + ' — ' + b.addr; });   // the select option text
  SP.CITIES = ['თბილისი', 'ბათუმი', 'ქუთაისი', 'რუსთავი', 'გორი', 'ზუგდიდი', 'თელავი', 'ფოთი'];
  SP.CAPITAL = 'თბილისი';
  SP.branch = function (id) { return SP.BRANCHES.filter(function (b) { return b.id === id; })[0] || null; };
  /** pickup 0; courier 5₾ in Tbilisi, 10₾ elsewhere (0 until a city is chosen) */
  SP.deliveryFee = function (d) {
    if (!d || d.method !== 'courier' || !d.city) return 0;
    return d.city === SP.CAPITAL ? 5 : 10;
  };
  /** one-line description: 'ფილიალიდან გატანა: ვაკის ფილიალი' | 'კურიერით: თბილისი, <address>' (plain text: escape it) */
  SP.deliveryLabel = function (d) {
    if (!d) return '';
    if (d.method === 'courier') return 'კურიერით: ' + [d.city, d.address].filter(Boolean).join(', ');
    var b = SP.branch(d.branchId);
    return 'ფილიალიდან გატანა: ' + (b ? b.name : d.branchName || '');
  };

  /** v3 (v2f-r3-02): THE delivery that the live checkout's fee, totals and ETA describe — one source of truth for the
      cart, payment, success and orders. Once the delivery step is confirmed (delivery.done) it is that choice; before
      that it is the default pickup (no fee, no extra days), never an unconfirmed draft (a courier choice made on
      #/delivery and left, or the previous order's remembered courier city). st: the live state (default) or any
      {delivery} object. Returns a copy; the recipient / address fields are kept (createOrder snapshots it). */
  SP.confirmedDelivery = function (st) {
    st = st || state;
    var d = st.delivery && typeof st.delivery === 'object' ? st.delivery : {}, c = {};
    for (var k in d) c[k] = d[k];
    if (d.done) return c;
    c.method = 'pickup'; c.done = false;
    if (!SP.branch(c.branchId)) c.branchId = deliveryDefaults().branchId;
    return c;
  };
  /** v3 (v2f-r3-02): everything a summary shows about one checkout, from that ONE delivery →
      {delivery, confirmed, fee, totals, eta, etaText}. st: the live state (default; delivery = SP.confirmedDelivery)
      or a stored order / state.order (its own delivery snapshot, deliveryFee and eta). The cart, payment, success and
      orders summaries read their 'მიწოდების ფასი' row, 'სულ' / monthly and 'სავარაუდო მიღება' from here, so the
      same state always shows the same numbers on every screen. */
  SP.checkoutSummary = function (st) {
    st = st || state;
    var snap = st.deliveryFee != null;   // an order snapshot
    var d = snap ? (st.delivery || {}) : SP.confirmedDelivery(st);
    var t = SP.totals(st);
    var eta = snap && st.eta ? st.eta : SP.eta({ products: st.products, delivery: d, date: snap ? st.date : null });
    return { delivery: d, confirmed: snap || !!(st.delivery && st.delivery.done), fee: t.delivery, totals: t, eta: eta, etaText: SP.etaText(eta) };
  };

  /** store base windows in days; a multi-store cart takes the widest window */
  SP.ETA_WINDOWS = { amazon: [9, 14], ebay: [12, 20], other: [12, 20] };
  SP.etaDays = function (products, delivery) {
    var from = null, to = null;
    (products || []).forEach(function (p) {
      var w = SP.ETA_WINDOWS[p.store] || SP.ETA_WINDOWS.other;
      from = from === null ? w[0] : Math.min(from, w[0]);
      to = to === null ? w[1] : Math.max(to, w[1]);
    });
    if (from === null) { from = SP.ETA_WINDOWS.amazon[0]; to = SP.ETA_WINDOWS.amazon[1]; }
    // courier: +1 day in Tbilisi, +2 in the regions; before a city is chosen the window covers both (DLV-R2-04)
    if (delivery && delivery.method === 'courier' && !delivery.city) return { from: from + 1, to: to + 2 };
    var extra = delivery && delivery.method === 'courier' ? (delivery.city !== SP.CAPITAL ? 2 : 1) : 0;
    return { from: from + extra, to: to + extra };
  };
  /** expected arrival window → {from:'YYYY-MM-DD', to:'YYYY-MM-DD'}.
      o: {products, delivery, date} — each defaults to the live state / today. The default delivery is the
      CONFIRMED one (SP.confirmedDelivery, v2f-r3-02), as in SP.totals; the delivery screen passes its draft */
  SP.eta = function (o) {
    o = o || {};
    var days = SP.etaDays(o.products || state.products, o.delivery || SP.confirmedDelivery(state));
    var base = o.date && SP.fmt.date(o.date) ? o.date : SP.fmt.todayIso();
    return { from: SP.fmt.addDays(base, days.from), to: SP.fmt.addDays(base, days.to) };
  };
  /** '16–21 ოქტომბერი' for an {from,to} window */
  SP.etaText = function (eta) { return eta ? SP.fmt.range(eta.from, eta.to) : ''; };

  /* ------------------------------------------------------------------
     Mock backend (DEMO account store in localStorage)
     Per phone: {salt, pass, created, first, last, email}. v4: the account's own
     profile (first / last name, e-mail) is persisted with it, so the profile
     page can show and edit it; never the personal ID, never card data. The hash
     is a salted, iterated FNV-1a: it only keeps plain passwords out of storage.
     This is NOT real credential security; a production backend must hash
     server-side (e.g. Argon2/bcrypt).
     ------------------------------------------------------------------ */
  function users() {
    var all = storeGet('localStorage', USERS_KEY);
    return all && typeof all === 'object' ? all : {};
  }
  function saveUsers(u) { storeSet('localStorage', USERS_KEY, u); }
  function newSalt() {
    var a = new Uint32Array(2);
    try { window.crypto.getRandomValues(a); } catch (e) { a[0] = Math.random() * 4294967296; a[1] = Date.now(); }
    return a[0].toString(36) + a[1].toString(36);
  }
  function pwHash(p, salt) {
    var h1 = hashStr('slicepay:' + salt + ':' + p), h2 = hashStr(p + ':' + salt);
    for (var i = 0; i < 2000; i++) { h1 = hashStr(h2.toString(36) + salt + h1); h2 = hashStr(h1.toString(36) + p + h2); }
    return 'h2.' + h1.toString(36) + '.' + h2.toString(36);
  }
  function legacyHash(p) { return 'h' + hashStr('slicepay:' + p).toString(36) + '.' + hashStr(p + ':salt').toString(36); }
  function record(password) { var salt = newSalt(); return { salt: salt, pass: pwHash(password, salt), created: Date.now() }; }
  function matches(u, password) { return u.salt ? u.pass === pwHash(password, u.salt) : u.pass === legacyHash(password); }
  /** the profile fields of a user record (v4): trimmed strings, '' when missing */
  function profileOf(u) {
    u = u || {};
    return { first: String(u.first || '').trim(), last: String(u.last || '').trim(), email: String(u.email || '').trim() };
  }
  /** a new password record that keeps the account's profile and creation time (password change / recovery) */
  function withPassword(u, password) {
    var r = record(password), p = profileOf(u);
    r.created = (u && u.created) || r.created;
    r.first = p.first; r.last = p.last; r.email = p.email;
    return r;
  }
  SP.DEMO_USER = { phone: '555123456', password: 'slicepay1' };
  SP.DEMO_PROFILE = { first: 'გიორგი', last: 'ბერიძე', email: 'giorgi@example.com' };
  SP.QA_NEW_PHONE = '577123456';   // the new number of the #/profile?demo=1&edit=phone&step=code seed (code 4821)
  SP.api = {
    userExists: function (phone) { return !!users()[phone]; },
    register: function (u) {
      var all = users();
      if (all[u.phone]) return { ok: false, error: 'exists' };
      var r = record(u.password), p = profileOf(u);
      r.first = p.first; r.last = p.last; r.email = p.email;
      all[u.phone] = r;
      saveUsers(all);
      return { ok: true };
    },
    login: function (phone, password) {
      var u = users()[phone];
      if (!u) return { ok: false, error: 'nouser' };
      if (!matches(u, password)) return { ok: false, error: 'password' };
      return { ok: true };
    },
    sendCode: function (phone) {
      var code = newCode();
      state.recover = { phone: phone, code: code, sentAt: Date.now() };
      SP.save();
      return code;
    },
    resetPassword: function (phone, password) {
      var all = users();
      if (!all[phone]) return { ok: false };
      all[phone] = withPassword(all[phone], password); saveUsers(all);   // the profile survives a recovery (v4)
      return { ok: true };
    },
    /** the demo account exists (password slicepay1); a demo record without a profile gets the demo profile (v4) */
    ensureDemoUser: function () {
      var all = users(), d = SP.DEMO_USER, u = all[d.phone], P = SP.DEMO_PROFILE;
      if (!u) { u = all[d.phone] = record(d.password); }
      else if (u.first || u.last || u.email) return;
      u.first = P.first; u.last = P.last; u.email = P.email;
      saveUsers(all);
    },
    /** v4 QA (#/profile?demo=1): the demo account back to its seed — password slicepay1 and the demo profile */
    resetDemoUser: function () {
      var all = users(), P = SP.DEMO_PROFILE;
      all[SP.DEMO_USER.phone] = withPassword(P, SP.DEMO_USER.password);
      saveUsers(all);
    },
    remember: function (phone) { if (phone) storeSet('localStorage', REMEMBER_KEY, phone); else storeDel('localStorage', REMEMBER_KEY); },
    remembered: function () { return storeGet('localStorage', REMEMBER_KEY); },

    /* ---- v2: registration with SMS verification ----
       startRegistration stores a PENDING registration in session state (the password only as a salted
       hash) and "sends" a code; the account is created by verify(). */
    startRegistration: function (u) {
      // the QA seed (#/register/verify?demo=1) is a pending registration for the existing demo account: resubmitting
      // that same number after 'ნომრის შეცვლა' stays the demo registration instead of 'already exists' (auth-v2r3-03).
      // It keeps the seed's code, so QA can walk verify → change number → verify with 4821
      var prev = state.pendingReg, demoRe = !!(prev && prev.demo && prev.phone === u.phone);
      if (users()[u.phone] && !demoRe) return { ok: false, error: 'exists' };
      // a number already sent a code inside its 30 s resend cooldown ("ნომრის შეცვლა" → the same number, or back
      // to it after another one) keeps that code: switching numbers cannot bypass the cooldown (v2f-r2-06)
      var sent = demoRe ? null : recentSent(u.phone), now = Date.now();
      var code = demoRe ? prev.code : sent ? sent.code : newCode();
      state.pendingReg = { first: u.first || '', last: u.last || '', phone: u.phone, email: u.email || '', rec: record(u.password),
        code: code, sentAt: demoRe ? prev.sentAt : sent ? sent.sentAt : now,
        expiresAt: demoRe ? Math.max(prev.expiresAt || 0, now + SP.VERIFY_TTL) : sent ? sent.expiresAt : now + SP.VERIFY_TTL,
        next: u.next || null, demo: demoRe };
      logSent(state.pendingReg);
      SP.save();
      return { ok: true, code: code };
    },
    /** a new code for the pending registration; refused during the 30 s cooldown → {ok:false, error:'cooldown', left} */
    resendVerify: function () {
      var p = state.pendingReg;
      if (!p) return { ok: false, error: 'none' };
      var left = SP.verifyCooldown();
      if (left > 0) return { ok: false, error: 'cooldown', left: left };
      var now = Date.now();
      p.code = newCode(); p.sentAt = now; p.expiresAt = now + SP.VERIFY_TTL;
      logSent(p);
      SP.save();
      return { ok: true, code: p.code };
    },
    /** checks the code; on success creates the account, signs in and clears the pending registration.
        → {ok:true, phone, next} | {ok:false, error:'none'|'format'|'expired'|'wrong'|'exists'} */
    verify: function (code) {
      var p = state.pendingReg;
      if (!p) return { ok: false, error: 'none' };
      code = String(code || '').trim();
      if (!/^\d{4}$/.test(code)) return { ok: false, error: 'format' };
      if (Date.now() > p.expiresAt) return { ok: false, error: 'expired' };
      if (code !== p.code) return { ok: false, error: 'wrong' };
      var all = users();
      if (p.demo) SP.api.ensureDemoUser();
      else if (all[p.phone]) return { ok: false, error: 'exists' };
      else {
        // v4: the verified account keeps its own profile (names, e-mail) with the password record
        var rec = {}, pr = profileOf(p);
        for (var k in p.rec || {}) rec[k] = p.rec[k];
        rec.first = pr.first; rec.last = pr.last; rec.email = pr.email;
        all[p.phone] = rec; saveUsers(all);
      }
      // sign in first: switching to this account resets the previous person's session data, and the verified
      // registration's own names must survive that (they prefill the delivery recipient)
      SP.signIn(p.phone);
      state.profile = { first: p.first, last: p.last };
      SP.save();
      return { ok: true, phone: p.phone, next: p.next };
    },

    /* ---- v4: profile ----
       The signed-in account's profile lives in its user record (first, last, email). Every call below needs a
       signed-in user and returns {ok:false, error:'auth'} otherwise. Field errors come back as ready-to-show
       copy: {ok:false, error:<first code>, errors:{<field>: message}}. */

    /** → {phone, first, last, email} of the signed-in account, or null. Names fall back to the session's profile
        (an account created by an older build has none stored) */
    getProfile: function () {
      var ph = state.userPhone;
      if (!ph) return null;
      var p = profileOf(users()[ph]), s = state.profile || {};
      return { phone: ph, first: p.first || String(s.first || ''), last: p.last || String(s.last || ''), email: p.email };
    },
    /** validates like the registration form (names required, e-mail required + format) and saves.
        p: {first, last, email} → {ok:true, profile} | {ok:false, error:'invalid', errors:{first|last|email: message}} */
    updateProfile: function (p) {
      var ph = state.userPhone, all = users(), u = ph && all[ph];
      if (!u) return { ok: false, error: 'auth' };
      p = profileOf(p);
      var errors = {};
      if (!p.first) errors.first = SP.msg.required;
      if (!p.last) errors.last = SP.msg.required;
      if (!p.email) errors.email = SP.msg.required;
      else if (!SP.valid.email(p.email)) errors.email = SP.msg.email;
      if (Object.keys(errors).length) return { ok: false, error: 'invalid', errors: errors };
      u.first = p.first; u.last = p.last; u.email = p.email;
      saveUsers(all);
      state.profile = { first: p.first, last: p.last };   // the session copy (delivery prefill)
      SP.save();
      return { ok: true, profile: SP.api.getProfile() };
    },
    /** p: {current, next, repeat} → {ok:true} | {ok:false, error, errors:{current|next|repeat: message}}.
        current: empty → required, wrong → passCurrent; next: empty → required, < 8 → password, the same as the
        current one → passSame; repeat: empty → required, different → match. On success the password record is
        replaced (new salt); the profile stays. */
    changePassword: function (p) {
      var ph = state.userPhone, all = users(), u = ph && all[ph];
      if (!u) return { ok: false, error: 'auth' };
      p = p || {};
      var cur = String(p.current || ''), nw = String(p.next || ''), rep = String(p.repeat || ''), errors = {}, codes = [];
      function err(f, code, msg) { if (!errors[f]) { errors[f] = msg; codes.push(code); } }
      if (!cur) err('current', 'required', SP.msg.required);
      else if (!matches(u, cur)) err('current', 'current', SP.msg.passCurrent);
      if (!nw) err('next', 'required', SP.msg.required);
      else if (!SP.valid.password(nw)) err('next', 'password', SP.msg.password);
      else if (matches(u, nw)) err('next', 'same', SP.msg.passSame);
      if (!rep) err('repeat', 'required', SP.msg.required);
      else if (rep !== nw) err('repeat', 'match', SP.msg.match);
      if (codes.length) return { ok: false, error: codes[0], errors: errors };
      all[ph] = withPassword(u, nw);
      saveUsers(all);
      return { ok: true };
    },
    /** step 1 of a phone change: "sends" a code to the new number (show UI.codeToast(r.code)).
        → {ok:true, code, phone} | {ok:false, error:'required'|'format'|'same'|'exists'|'auth', message}.
        The same per-number cooldown as registration: a number sent a code within its 30 s cooldown (and still
        valid) gets the same code back. The pending change is state.phoneChange (session only). */
    startPhoneChange: function (raw) {
      var cur = state.userPhone;
      if (!cur) return { ok: false, error: 'auth', message: '' };
      if (!String(raw || '').trim()) return { ok: false, error: 'required', message: SP.msg.required };
      var phone = SP.valid.phone(raw);
      if (!phone) return { ok: false, error: 'format', message: SP.msg.phone };
      if (phone === cur) return { ok: false, error: 'same', message: SP.msg.phoneSame };
      if (users()[phone]) return { ok: false, error: 'exists', message: SP.msg.phoneTaken };
      var prev = state.phoneChange, now = Date.now();
      // the QA seed (or a pending change) for this same number inside its cooldown keeps its code
      // (the QA seed keeps its code 4821 while valid, as the registration seed does)
      var keep = prev && prev.from === cur && prev.phone === phone && now < prev.expiresAt && (prev.demo || now - prev.sentAt < SP.VERIFY_COOLDOWN) ? prev : null;
      var sent = keep ? null : recentSent(phone);
      var src = keep || sent;
      state.phoneChange = { from: cur, phone: phone, code: src ? src.code : newCode(), sentAt: src ? src.sentAt : now,
        expiresAt: src ? src.expiresAt : now + SP.VERIFY_TTL, demo: !!(keep && keep.demo) };
      logSent(state.phoneChange);
      SP.save();
      return { ok: true, code: state.phoneChange.code, phone: phone };
    },
    /** a new code for the pending phone change → {ok:true, code} | {ok:false, error:'cooldown', left} | {ok:false, error:'none'} */
    resendPhoneChange: function () {
      var p = pendingPhoneChange();
      if (!p) return { ok: false, error: 'none' };
      var left = SP.phoneChangeCooldown();
      if (left > 0) return { ok: false, error: 'cooldown', left: left };
      var now = Date.now();
      p.code = newCode(); p.sentAt = now; p.expiresAt = now + SP.VERIFY_TTL; p.demo = false;
      logSent(p);
      SP.save();
      return { ok: true, code: p.code };
    },
    /** step 2: checks the code; on success the account is re-keyed to the new number — the users store, the
        user's orders, remember-me and the session (state.userPhone) — and the old number is free again.
        → {ok:true, phone, old} | {ok:false, error:'none'|'format'|'expired'|'wrong'|'exists', message} */
    verifyPhoneChange: function (code) {
      var p = pendingPhoneChange();
      if (!p) return { ok: false, error: 'none', message: '' };
      code = String(code || '').trim();
      if (!/^\d{4}$/.test(code)) return { ok: false, error: 'format', message: SP.msg.code };
      if (Date.now() > p.expiresAt) return { ok: false, error: 'expired', message: SP.msg.codeExpired };
      if (code !== p.code) return { ok: false, error: 'wrong', message: SP.msg.codeWrong };
      if (users()[p.phone]) return { ok: false, error: 'exists', message: SP.msg.phoneTaken };
      var old = p.from;
      if (!rekeyAccount(old, p.phone)) return { ok: false, error: 'none', message: '' };
      return { ok: true, phone: p.phone, old: old };
    },
    /** drops a pending phone change ('გაუქმება') */
    cancelPhoneChange: function () { state.phoneChange = null; SP.save(); }
  };
  /** the pending phone change of the signed-in account (one started by another account is ignored) */
  function pendingPhoneChange() {
    var p = state.phoneChange;
    return p && p.from && p.from === state.userPhone ? p : null;
  }
  /** seconds left before the phone-change code may be re-sent (0 = now) */
  SP.phoneChangeCooldown = function () {
    var p = pendingPhoneChange();
    return p && p.sentAt ? Math.max(0, Math.ceil((p.sentAt + SP.VERIFY_COOLDOWN - Date.now()) / 1000)) : 0;
  };
  /** moves an account from one phone to another: user record, orders, remember-me, session. The old key is removed */
  function rekeyAccount(old, nw) {
    var all = users();
    if (!old || !nw || old === nw || !all[old] || all[nw]) return false;
    SP.orders.list(old);   // the demo account's lazily seeded history is materialised first, so it moves with it
    all[nw] = all[old]; delete all[old]; saveUsers(all);
    var oa = ordersAll();
    oa[nw] = (oa[nw] || []).concat(oa[old] || []); delete oa[old]; ordersSave(oa);
    if (SP.api.remembered() === old) SP.api.remember(nw);
    state.userPhone = nw;
    if (state.loginPhone === old) state.loginPhone = nw;
    if (state.recover && state.recover.phone === old) state.recover = null;
    state.phoneChange = null;
    SP.save();
    return true;
  }
  /** v4: the delivery recipient prefill → {first, last}: what this session's delivery already holds (typed or
      confirmed in this session) wins, else the signed-in account's profile */
  SP.recipientPrefill = function (st) {
    st = st || state;
    var d = st.delivery || {}, p = (st === state ? SP.api.getProfile() : null) || st.profile || {};
    return { first: d.first || p.first || '', last: d.last || p.last || '' };
  };
  function newCode() { return String(1000 + Math.floor(Math.random() * 9000)); }
  /* the per-phone resend cooldown: {phone: {code, sentAt, expiresAt}} for numbers sent a code inside the last 30 s.
     Session-scoped and kept outside the state, so sign-out / "start over" do not reset a number's cooldown.
     Entries are pruned on every read (REV2R3-02), on boot, and by a timer armed for the earliest cooldown end
     whenever entries remain (v3), so a number and its code stay only while its cooldown runs and the key is removed
     once none is left: a sign-out inside the 30 s keeps the cooldown, and nothing lingers after it ends */
  var SENT_KEY = 'slicepay.verifySent', memSent = {}, sentTimer = null;
  function sentLog() {
    var v = storeGet('sessionStorage', SENT_KEY), all = v && typeof v === 'object' ? v : memSent;
    var now = Date.now(), keep = {}, n = 0, dropped = false, next = Infinity;
    for (var k in all) {
      if (all[k] && typeof all[k] === 'object' && now - all[k].sentAt < SP.VERIFY_COOLDOWN) {
        keep[k] = all[k]; n++; next = Math.min(next, all[k].sentAt + SP.VERIFY_COOLDOWN);
      } else dropped = true;
    }
    if (dropped) { memSent = keep; if (n) storeSet('sessionStorage', SENT_KEY, keep); else storeDel('sessionStorage', SENT_KEY); }
    if (sentTimer) { clearTimeout(sentTimer); sentTimer = null; }
    if (n) sentTimer = setTimeout(function () { sentTimer = null; sentLog(); }, Math.max(0, next - now) + 50);
    return keep;
  }
  function logSent(p) {
    if (!p || p.demo || !p.phone) return;
    var keep = sentLog();
    keep[p.phone] = { code: p.code, sentAt: p.sentAt, expiresAt: p.expiresAt };
    memSent = keep;
    storeSet('sessionStorage', SENT_KEY, keep);
    sentLog();   // (re)arms the prune timer for the new entry
  }
  /** the code sent to this phone inside its cooldown (and still valid), else null */
  function recentSent(phone) {
    var e = sentLog()[phone], now = Date.now();
    return e && e.code && now - e.sentAt < SP.VERIFY_COOLDOWN && now - e.sentAt >= 0 && now < e.expiresAt ? e : null;
  }
  SP.VERIFY_COOLDOWN = 30000;     // ms between "resend" requests
  SP.VERIFY_TTL = 5 * 60000;      // a code expires after 5 minutes
  /** seconds left before the verification code may be re-sent (0 = now) */
  SP.verifyCooldown = function () {
    var p = state.pendingReg;
    return p && p.sentAt ? Math.max(0, Math.ceil((p.sentAt + SP.VERIFY_COOLDOWN - Date.now()) / 1000)) : 0;
  };
  SP.isAuthed = function () { return !!state.userPhone; };
  /** marks the user as signed in (login and verified registration both end here).
      A different account than the current one (a guest becoming one included) starts from a clean personal
      session: the previous person's recipient, personal ID, address, profile, receipt and recovery must not
      carry over (v2f-r1-01, REV2-01). The cart and its per-order choices stay. The same account signing in
      again keeps its recipient / address for the next order. Any pending registration ends here. */
  SP.signIn = function (phone) {
    if (phone !== state.userPhone) {
      state.delivery = deliveryDefaults();
      state.profile = null; state.order = null; state.recover = null; state.phoneChange = null;
      state.ui = { details: {}, payDetails: false };
    }
    state.userPhone = phone; state.loginPhone = null; state.pendingReg = null;
    // v4: the account's stored names are its session profile (the delivery recipient prefill)
    var u = profileOf(users()[phone]);
    if (!state.profile && (u.first || u.last)) state.profile = { first: u.first, last: u.last };
    SP.save();
  };
  /** sign out: clears the whole session (cart, delivery, order), toasts, goes to the landing */
  SP.logout = function () {
    SP.reset({ signOut: true, go: false });
    sentLog();   // drops the verification log's expired entries and arms the timer for the rest (REV2R3-02)
    if (SP.ui && SP.ui.toast) SP.ui.toast(SP.toastMsg.logout);
    SP.go('/', { replace: true });
  };
  /** where a successful login goes: a safe ?next=, else the delivery step when the cart has products, else my orders */
  SP.afterLoginTarget = function (query) {
    return SP.safeNext(query && query.next) || (state.products.length ? '/delivery' : '/orders');
  };
  /** same rule after a verified registration (its ?next= was kept on the pending registration) */
  SP.afterRegisterTarget = function (next) { return SP.afterLoginTarget({ next: next }); };
  /** where the auth screens' own back control leads: the cart when there is one, else the landing */
  SP.authBackTarget = function () { return state.products.length ? '/cart' : '/'; };

  /* ------------------------------------------------------------------
     Orders (v2): per-user store in localStorage, status model, deferred payments.
     Persisted orders never contain card data; the personal ID only masked.
     ------------------------------------------------------------------ */
  /* v4: 'processing' (მუშავდება — SlicePay is getting the bank approval and placing the order with the store) is the
     first status, before 'ordered'. New orders start there. */
  SP.STATUS = {
    processing: 'მუშავდება', ordered: 'შეკვეთილია', transit: 'გზაშია', warehouse: 'საწყობშია', customs: 'განბაჟება',
    ready: 'მზადაა გასატანად', courier: 'კურიერთანაა', delivered: 'ჩაბარდა'
  };
  SP.FIRST_STATUS = 'processing';
  SP.DUE_LABEL = 'გადასახდელია';
  /** the 7 step keys of an order's timeline (pickup ends at "ready", courier at "courier") */
  SP.orderSteps = function (o) {
    return ['processing', 'ordered', 'transit', 'warehouse', 'customs', o && o.delivery && o.delivery.method === 'courier' ? 'courier' : 'ready', 'delivered'];
  };
  /** [{key, label, date|null, state:'done'|'current'|'todo'}]. An order stored by an older build has no
      'processing' step: it counts as done on the order date (v4) */
  SP.orderTimeline = function (o) {
    var steps = SP.orderSteps(o), cur = steps.indexOf(o.status), dates = {};
    (o.timeline || []).forEach(function (s) { if (s) dates[s.key] = s.date; });
    if (!dates.processing && o.status !== 'processing') dates.processing = o.date || null;
    if (cur < 0) cur = 0;
    return steps.map(function (k, i) {
      return { key: k, label: SP.STATUS[k], date: dates[k] || null,
        state: o.status === 'delivered' || i < cur ? 'done' : i === cur ? 'current' : 'todo' };
    });
  };
  /** one deferred / prepaid part → {due, refund, pending, paid}
      part: {est, actual|null, prepaid, paid}. Deferred: due = actual once known. Prepaid (estimate paid at
      checkout): due = actual − est when higher, refund when lower. */
  SP.partDue = function (part) {
    if (!part) return null;
    var r = { est: part.est, actual: part.actual, prepaid: !!part.prepaid, paid: !!part.paid, due: 0, refund: 0, pending: part.actual == null };
    if (r.pending) return r;
    var diff = part.actual - part.est;
    if (part.prepaid) { if (diff > 0 && !part.paid) r.due = diff; if (diff < 0) r.refund = -diff; }
    else if (!part.paid) r.due = part.actual;
    return r;
  };
  /** what an order still asks for → {weight, customs (SP.partDue or null), total, pending, deferred} */
  SP.orderDue = function (o) {
    var d = (o && o.deferred) || {};
    var w = SP.partDue(d.weight), c = SP.partDue(d.customs);
    var dw = !!(d.weight && !d.weight.prepaid), dc = !!(d.customs && !d.customs.prepaid);
    return { weight: w, customs: c, total: (w ? w.due : 0) + (c ? c.due : 0),
      pending: !!((dw && w.pending) || (dc && c.pending)), deferred: dw || dc };
  };
  /** an order's arrival: {label:'სავარაუდო მიღება', value:'16–21 ოქტომბერი'} or, once delivered, {label:'ჩაბარდა', value:'3 აგვისტო'} */
  SP.orderArrival = function (o) {
    if (o && o.status === 'delivered' && o.deliveredAt) return { label: 'ჩაბარდა', value: SP.fmt.dayMonth(o.deliveredAt) };
    return { label: 'სავარაუდო მიღება', value: SP.etaText(o && o.eta) };
  };
  /** the deferral notes of one ordered product: ['წონის გარეშე', 'განბაჟების გარეშე'] (none for a part that is 0) */
  SP.itemNotes = function (p, o) {
    var out = [];
    if (o.deferWeight && p.weight > 0) out.push('წონის გარეშე');
    if (o.deferCustoms && p.customs > 0) out.push('განბაჟების გარეშე');
    return out;
  };
  /** status pill model → {kind:'progress'|'due'|'done', label}: the status name, in the due colours while a
      payment is due (the list adds the 'გადასახდელია: N₾' badge, SP.DUE_LABEL) */
  SP.orderPill = function (o) {
    var kind = SP.orderDue(o).total > 0 ? 'due' : o.status === 'delivered' ? 'done' : 'progress';
    return { kind: kind, label: SP.STATUS[o.status] };
  };
  /** instalment schedule → [{n, label:'1-ლი შენატანი', date, amount}] (first one month after the order date).
      The remainder is spread over the first instalments (+1₾ each), so every row is within 1₾ of the shown
      monthly figure (ceil) and the sum equals the total (REV2-08: 100/12 → 4 × 9 + 8 × 8, not 11 × 9 + 1) */
  SP.orderSchedule = function (o) {
    var term = +o.term || 4, total = Math.round(+o.total || 0), base = Math.floor(total / term), rem = total - base * term, out = [];
    for (var i = 1; i <= term; i++) {
      out.push({ n: i, label: SP.fmt.ordinal(i) + ' შენატანი', date: SP.fmt.addMonths(o.date, i), amount: base + (i <= rem ? 1 : 0) });
    }
    return out;
  };

  function ordersAll() { var a = storeGet('localStorage', ORDERS_KEY); return a && typeof a === 'object' ? a : {}; }
  function ordersSave(a) { storeSet('localStorage', ORDERS_KEY, a); }
  /** a stored order as read back: product quantities forced to whole numbers (REV2R2-10) */
  function cleanOrder(o) {
    if (o && Array.isArray(o.products)) o.products.forEach(function (p) { if (p && typeof p === 'object') p.qty = SP.qty(p); });
    return withProcessing(o);
  }
  /** v4: an order saved before the 'processing' status existed gets that step, done on the order date, in front of
      its timeline (so every timeline starts with it). An unknown / missing status reads as 'processing'. */
  function withProcessing(o) {
    if (!o || typeof o !== 'object') return o;
    if (SP.STATUS && !SP.STATUS[o.status]) o.status = 'processing';   // (SP.STATUS is not defined yet while the state loads)
    var tl = Array.isArray(o.timeline) ? o.timeline.filter(function (s) { return s && typeof s === 'object'; }) : [];
    var has = tl.some(function (s) { return s.key === 'processing'; });
    if (!has) tl.unshift({ key: 'processing', date: o.date || (tl[0] && tl[0].date) || null });
    o.timeline = tl;
    return o;
  }
  function sortOrders(list) { return list.slice().sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); }); }
  SP.orders = {
    /** the signed-in user's orders, newest first (the demo user gets the demo orders on first access) */
    list: function (phone) {
      phone = phone || state.userPhone;
      if (!phone) return [];
      var all = ordersAll();
      if (!all[phone] && phone === SP.DEMO_USER.phone) { SP.orders.seedDemo(phone); all = ordersAll(); }
      return sortOrders(all[phone] || []).map(cleanOrder);
    },
    get: function (id, phone) {
      id = String(id || '');
      return SP.orders.list(phone).filter(function (o) { return o.id === id; })[0] || null;
    },
    /** insert, or update the same order (by id). A DIFFERENT order that already holds the id is never overwritten
        (REV2R3-01): the incoming order gets a free id instead (SP.orders.newId) and a console warning. "Different"
        = another creation key (o.uid, set by SP.createOrder; orders without one — the demo orders, older builds —
        count as the same order as each other). opts.replace: a deliberate replace of whatever holds the id (the QA
        receipt ids: SP.QA_ORDER_ID, ?order=). Returns the saved order (its id may have changed). */
    save: function (o, phone, opts) {
      phone = phone || state.userPhone;
      if (!phone || !o) return o;
      SP.orders.list(phone);   // the demo user's first order still gets the demo history next to it
      var all = ordersAll(), list = all[phone] || [];
      var i = list.map(function (x) { return x && x.id; }).indexOf(o.id);
      if (i >= 0 && !(opts && opts.replace) && (list[i].uid || null) !== (o.uid || null)) {
        var was = o.id;
        o.id = SP.orders.newId(phone);
        i = -1;
        if (window.console && console.warn) console.warn('SlicePay: order id ' + was + ' is taken by another order; saved as ' + o.id);
      }
      if (i >= 0) list[i] = o; else list.push(o);
      all[phone] = list; ordersSave(all);
      if (state.order && state.order.id === o.id) { state.order = o; SP.save(); }
      return o;
    },
    /** a random 6-digit order id that none of the user's orders holds and that is not reserved (the demo orders'
        548210 / 731954, the QA receipt's SP.QA_ORDER_ID) (REV2R3-01, v2f-r3-03) */
    newId: function (phone) {
      var taken = {};
      [DEMO_ORDER_IDS[0], DEMO_ORDER_IDS[1], SP.QA_ORDER_ID].forEach(function (x) { taken[x] = 1; });
      SP.orders.list(phone).forEach(function (x) { if (x) taken[x.id] = 1; });
      var id;
      for (var n = 0; n < 1000; n++) { id = String(Math.floor(100000 + Math.random() * 900000)); if (!taken[id]) return id; }
      for (var k = 100000; k < 1000000; k++) if (!taken[String(k)]) return String(k);   // (only a stubbed Math.random gets here)
      return id;
    },
    /** replaces the user's orders with the two demo orders (#548210 delivered, #731954 in customs, 350₾ due) */
    seedDemo: function (phone) {
      phone = phone || state.userPhone;
      if (!phone) return;
      var all = ordersAll(); all[phone] = demoOrders(); ordersSave(all);
    },
    remove: function (id, phone) {
      phone = phone || state.userPhone;
      if (!phone) return;
      var all = ordersAll();
      all[phone] = (all[phone] || []).filter(function (o) { return o.id !== String(id); }); ordersSave(all);
    },
    clear: function (phone) {
      phone = phone || state.userPhone;
      if (!phone) return;
      var all = ordersAll(); all[phone] = []; ordersSave(all);
    }
  };
  /** pays every amount currently due on an order (QA / mock card payment), advances a customs-blocked
      order to its next status, saves it. Returns the updated order (or null). */
  SP.payDeferred = function (orderId) {
    var o = SP.orders.get(orderId);
    if (!o) return null;
    var today = SP.fmt.todayIso(), paidAny = false;
    ['weight', 'customs'].forEach(function (k) {
      var p = o.deferred && o.deferred[k], r = SP.partDue(p);
      if (r && r.due > 0) { p.paid = true; p.paidAt = today; paidAny = true; }
    });
    // a customs-blocked order moves on only once nothing is due or still undetermined (v2f-r1-03)
    var left = SP.orderDue(o);
    if (paidAny && o.status === 'customs' && left.total === 0 && !left.pending) advance(o, today);
    SP.orders.save(o);
    return o;
  };
  function advance(o, date) {
    var steps = SP.orderSteps(o), i = steps.indexOf(o.status);
    if (i < 0 || i >= steps.length - 1) return;
    o.status = steps[i + 1];
    o.timeline = (o.timeline || []).concat([{ key: o.status, date: date }]);
    if (o.status === 'delivered') o.deliveredAt = date;
  }
  function part(est, deferred) { return est > 0 ? { est: est, actual: null, prepaid: !deferred, paid: false } : null; }
  function deliverySnap(d) {
    d = d || state.delivery;
    var b = SP.branch(d.branchId), courier = d.method === 'courier';
    return { method: courier ? 'courier' : 'pickup',
      branchId: courier ? null : d.branchId, branchName: courier || !b ? null : b.name, branchAddr: courier || !b ? null : b.addr,
      city: courier ? d.city : (b ? b.city : ''), address: courier ? d.address : '', note: courier ? d.note : '',
      recipient: [d.first, d.last].filter(Boolean).join(' '), pidMasked: SP.fmt.pidMask(d.pid), fee: SP.deliveryFee(d) };
  }

  SP.QA_ORDER_ID = '123456';   // the fabricated #/success?demo=1 receipt (no ?order=)
  /** creates the order from the live state: sets state.order (the success screen) and stores it for the
      signed-in user. over: {id, date, persist:false}. Without over.id the id is new among the user's orders
      (SP.orders.newId); over.id (the QA receipt ids) deliberately replaces an order holding it. The snapshot's
      delivery is SP.confirmedDelivery, the same one SP.totals priced (v2f-r3-02) */
  SP.createOrder = function (over) {
    over = over || {};
    var id = over.id || SP.orders.newId(state.userPhone);
    var date = over.date || SP.fmt.todayIso();
    var products = JSON.parse(JSON.stringify(state.products));
    products.forEach(function (p) { p.weightKg = SP.weightKg(p); });
    var t = SP.totals(state);
    var dsnap = deliverySnap(SP.confirmedDelivery(state));
    var w = 0, c = 0;
    products.forEach(function (p) { w += p.weight * (p.qty || 1); c += p.customs * (p.qty || 1); });
    state.order = {
      id: id, uid: SP.uid(), date: date, createdAt: Date.now(),
      products: products,
      deferWeight: state.deferWeight, deferCustoms: state.deferCustoms,
      method: state.method, term: t.term, monthly: t.monthly, total: t.total, deliveryFee: t.delivery,
      delivery: dsnap,
      eta: SP.eta({ products: products, delivery: dsnap, date: date }),
      // v4: every new order starts at 'processing' (მუშავდება)
      status: 'processing', timeline: [{ key: 'processing', date: date }], deliveredAt: null,
      deferred: { weight: part(w, state.deferWeight), customs: part(c, state.deferCustoms) }
    };
    SP.save();
    if (over.persist !== false) SP.orders.save(state.order, null, { replace: !!over.id });
    return state.order;
  };
  /** the card payment's end of checkout: creates the order, then empties the cart and resets the per-order
      choices (term, method, defers, delivery.done) so Back from success cannot pay the same cart again */
  SP.completeCheckout = function (over) {
    var o = SP.createOrder(over);
    state.products = []; state.deferWeight = true; state.deferCustoms = true; state.method = 'bog'; state.term = 4;
    state.ui = { details: {}, payDetails: false };
    state.delivery = deliveryDefaults(state.delivery);
    SP.save();
    return o;
  };

  var DEMO_ORDER_IDS = ['548210', '731954'];
  /** the two demo orders, dated relative to today */
  function demoOrders() {
    var today = SP.fmt.todayIso(), D = SP.fmt.addDays;
    var recipient = 'გიორგი ბერიძე', pidMasked = SP.fmt.pidMask('01001012345');
    // (a) #548210 — two months ago, courier in Tbilisi, delivered, everything paid
    var aDate = SP.fmt.addMonths(today, -2);
    var aProducts = [
      { id: 'demo-airpods', name: 'Apple AirPods Pro 2nd Generation', url: 'https://www.amazon.com/Apple-AirPods-Pro-2nd-Generation/dp/B0D1XD1ZV3',
        store: 'amazon', img: null, item: 420, weight: 40, customs: 0, service: 50, qty: 1, weightKg: 1.6 },
      { id: 'demo-mx', name: 'Logitech MX Master 3S', url: 'https://www.amazon.com/Logitech-Master-3S-Wireless/dp/B09HM94VDS',
        store: 'amazon', img: null, item: 180, weight: 20, customs: 0, service: 30, qty: 1, weightKg: 0.8 }
    ];
    var aDel = { method: 'courier', branchId: null, branchName: null, branchAddr: null, city: 'თბილისი', address: 'ვაჟა-ფშაველას გამზ. 12, ბ. 5', note: '',
      recipient: recipient, pidMasked: pidMasked, fee: 5 };
    var aTotal = 420 + 50 + 40 + 180 + 30 + 20 + 5;
    var a = { id: DEMO_ORDER_IDS[0], date: aDate, createdAt: dateOf(aDate).getTime(), products: aProducts,
      deferWeight: false, deferCustoms: false, method: 'tbc', term: 6, monthly: SP.monthly(aTotal, 6), total: aTotal, deliveryFee: 5,
      delivery: aDel, eta: SP.eta({ products: aProducts, delivery: aDel, date: aDate }),
      status: 'delivered',
      timeline: [{ key: 'processing', date: aDate }, { key: 'ordered', date: aDate }, { key: 'transit', date: D(aDate, 2) }, { key: 'warehouse', date: D(aDate, 6) },
        { key: 'customs', date: D(aDate, 8) }, { key: 'courier', date: D(aDate, 10) }, { key: 'delivered', date: D(aDate, 11) }],
      deliveredAt: D(aDate, 11),
      deferred: { weight: { est: 60, actual: 60, prepaid: true, paid: true }, customs: null } };
    // (b) #731954 — 9 days ago, pickup at Vake, in customs; weight 100 → 112 and customs 250 → 238 deferred: 350₾ due
    var bDate = D(today, -9);
    var bProducts = [SP.demoProduct()];
    var bDel = { method: 'pickup', branchId: 'vake', branchName: 'ვაკის ფილიალი', branchAddr: 'ჭავჭავაძის გამზ. 37, თბილისი', city: 'თბილისი',
      address: '', note: '', recipient: recipient, pidMasked: pidMasked, fee: 0 };
    var b = { id: DEMO_ORDER_IDS[1], date: bDate, createdAt: dateOf(bDate).getTime(), products: bProducts,
      deferWeight: true, deferCustoms: true, method: 'bog', term: 4, monthly: 150, total: 600, deliveryFee: 0,
      delivery: bDel, eta: SP.eta({ products: bProducts, delivery: bDel, date: bDate }),
      status: 'customs',
      timeline: [{ key: 'processing', date: bDate }, { key: 'ordered', date: bDate }, { key: 'transit', date: D(bDate, 2) }, { key: 'warehouse', date: D(bDate, 6) }, { key: 'customs', date: D(bDate, 8) }],
      deliveredAt: null,
      deferred: { weight: { est: 100, actual: 112, prepaid: false, paid: false }, customs: { est: 250, actual: 238, prepaid: false, paid: false } } };
    return [a, b];
  }

  /* ------------------------------------------------------------------
     Router
     ------------------------------------------------------------------ */
  var routes = {};
  var current = null;          // {path, query, def}
  var carryPrev;               // spPrev of an entry being replaced (SP.go replace) → stamped onto its replacement
  /* direction of travel (v2f-r2-02): every history entry gets a monotonically increasing index (spIdx) when it is
     first handled; a replacement keeps the index of the entry it replaces. Comparing the entry's index with the
     last one handled tells a Back from a Forward traversal. The counter lives in sessionStorage so a reload keeps
     it increasing (entries created after a reload still sort after the older ones). */
  var IDX_KEY = 'slicepay.histIdx';
  var carryIdx;                // spIdx of an entry being replaced → stamped onto its replacement
  var lastIdx = null;          // spIdx of the entry last handled (null until the first one)
  var navDir = 'push';         // 'push' | 'replace' | 'load' | 'back' | 'forward' | 'same'
  var traversing = false, travTimer = null;   // a history.back()/forward() of ours is under way (v2f-r2-05)
  function nextIdx() {
    var hs = window.history.state, n = +storeGet('sessionStorage', IDX_KEY) || 0;
    if (hs && typeof hs.spIdx === 'number' && hs.spIdx > n) n = hs.spIdx;
    n += 1; storeSet('sessionStorage', IDX_KEY, n);
    return n;
  }
  function entryIdx() { var hs = window.history.state; return hs && typeof hs.spIdx === 'number' ? hs.spIdx : null; }
  /** history.back() / forward() that ignores further in-app navigation until it lands (a double click on a back
      link must not step back twice). Released by the next popstate / hashchange, or after 600 ms when the step
      went nowhere (start / end of the history) */
  function traverse(dir) {
    traversing = true; clearTimeout(travTimer);
    travTimer = setTimeout(function () { traversing = false; }, 600);
    if (dir < 0) history.back(); else history.forward();
  }
  function endTraverse() { traversing = false; clearTimeout(travTimer); }
  window.addEventListener('popstate', endTraverse);
  /** how the current entry was reached: 'back' / 'forward' (history traversal), 'push' (a new entry), 'replace',
      'load' (first entry handled after a page load) or 'same' (re-entry of the same entry) */
  SP.navDir = function () { return navDir; };
  /** leaves a stale entry (e.g. #/login or #/register after the sign-in that made them pointless) in the user's
      direction of travel: Back steps on back, Forward steps on forward; a fresh entry is replaced with target.
      A Back with no in-app entry behind (the stale entry was the first one) lands on backTarget instead of
      leaving the app; a step that goes nowhere (end of the history) also falls back to a replace */
  SP.skipEntry = function (target, backTarget) {
    var hs = window.history.state, idx = entryIdx();
    var back = navDir === 'back', fwd = navDir === 'forward';
    if (back && !(hs && hs.spPrev)) { endTraverse(); SP.go(backTarget || target, { replace: true }); return; }
    if (!back && !fwd) { endTraverse(); SP.go(target, { replace: true }); return; }
    traverse(back ? -1 : 1);
    setTimeout(function () {
      if (entryIdx() === idx && idx !== null) { endTraverse(); SP.go(back ? backTarget || target : target, { replace: true }); }
    }, 400);
  };
  var lastDesk = null;
  var patterns = [];           // parameterised routes, e.g. '/orders/:id'
  /** register a screen. path may contain ':name' segments ('/orders/:id' → ctx.params.id) */
  SP.route = function (path, def) {
    routes[path] = def;
    if (path.indexOf(':') >= 0) {
      var names = [];
      var re = new RegExp('^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:(\w+)/g, function (m, n) { names.push(n); return '([^/]+)'; }) + '$');
      patterns = patterns.filter(function (p) { return p.path !== path; });
      patterns.push({ path: path, re: re, names: names });
    }
  };
  /** → {def, params, pattern} or null */
  function matchRoute(path) {
    if (routes[path] && path.indexOf(':') < 0) return { def: routes[path], params: {}, pattern: path };
    for (var i = 0; i < patterns.length; i++) {
      var m = patterns[i].re.exec(path);
      if (m) {
        var params = {};
        patterns[i].names.forEach(function (n, j) { try { params[n] = decodeURIComponent(m[j + 1]); } catch (e) { params[n] = m[j + 1]; } });
        return { def: routes[patterns[i].path], params: params, pattern: patterns[i].path };
      }
    }
    return null;
  }
  SP.matchRoute = matchRoute;
  var AUTH_ROUTES = /^\/(login|register|recover)(\/|$)/;
  /** a ?next= value that is safe to navigate to after sign-in: an in-app route, not an auth screen */
  SP.safeNext = function (next) {
    if (typeof next !== 'string' || next.charAt(0) !== '/' || next.charAt(1) === '/' || /[\\\s]/.test(next)) return null;
    var path = next.split('?')[0].replace(/\/+$/, '') || '/';
    if (AUTH_ROUTES.test(path) || !matchRoute(path)) return null;
    return next;
  };
  /** path + '?next=<next>' (path alone when there is no next): the path in next stays readable, the rest is encoded */
  SP.withNext = function (path, next) { return next ? path + '?next=' + encodeURIComponent(next).replace(/%2F/gi, '/') : path; };
  /** '/login?next=/orders' */
  SP.loginUrl = function (next) { return SP.withNext('/login', next); };

  function parseHash() {
    var h = (location.hash || '').replace(/^#/, '');
    if (!h) h = '/';
    var qi = h.indexOf('?');
    var path = qi < 0 ? h : h.slice(0, qi);
    var query = {};
    if (qi >= 0) {
      try { new URLSearchParams(h.slice(qi + 1)).forEach(function (v, k) { query[k] = v; }); } catch (e) { /* ignore */ }
    }
    if (path.charAt(0) !== '/') path = '/' + path;
    path = path.replace(/\/+$/, '') || '/';
    return { path: path, query: query };
  }
  SP.parseHash = parseHash;

  /** navigate; opts.replace uses location.replace (no history entry) */
  SP.go = function (path, opts) {
    if (traversing) return;   // a Back of ours is on its way: this click belongs to the screen being left
    var target = '#' + path;
    if (location.hash === target || (path === '/' && (location.hash === '' || location.hash === '#'))) { handle(true); return; }
    if (opts && opts.replace) {
      // location.replace drops history.state: the replacement inherits the replaced entry's origin (R3F-01)
      var hs = window.history.state;
      carryPrev = hs && ('spPrev' in hs) ? hs.spPrev : undefined;
      carryIdx = hs && typeof hs.spIdx === 'number' ? hs.spIdx : undefined;
      location.replace(target);
    } else { carryPrev = undefined; carryIdx = undefined; location.hash = target; }
  };
  /** back navigation that keeps history consistent: every history entry is stamped with the route it
      was entered from (spPrev); when that is the target, step back instead of pushing a new entry (R2-08) */
  SP.back = function (path, opts) {
    // history.state still shows the entry being left until the step lands: a second click (double click on
    // ᲣᲙᲐᲜ / 'ნომრის შეცვლა') must not step back again (v2f-r2-05)
    if (traversing) return;
    var hs = window.history.state;
    if (hs && hs.spPrev === path) { traverse(-1); return; }
    // opts.any ("back → previous screen, else <path>"): any in-app origin is stepped back to
    if (opts && opts.any && hs && hs.spPrev) { traverse(-1); return; }
    // opts.replace ("back to <path>, else replace this entry with it"): a deep-linked entry is not stacked (REV2R3-07)
    SP.go(path, opts && opts.replace ? { replace: true } : undefined);
  };
  function stampEntry(patch) {
    try { window.history.replaceState(Object.assign({}, window.history.state, patch), ''); } catch (e) { /* ignore */ }
  }

  /* ---- guards ---- */
  function guard(path, query, params) {
    query = query || {}; params = params || {};
    var hasProducts = state.products.length > 0, authed = !!state.userPhone;
    if (path === '/success') return state.order ? null : '/';
    // v4 profile: signed-in only
    if (path === '/profile') return authed ? null : SP.loginUrl('/profile');
    // my orders (v2): signed-in only; an unknown order id falls back to the list
    if (path === '/orders' || path.indexOf('/orders/') === 0) {
      if (!authed) return SP.loginUrl(path);
      if (path !== '/orders' && !SP.orders.get(params.id)) return '/orders';
      return null;
    }
    // #/pay?order=<id>: pays the deferred amounts of a stored order (no cart / delivery needed)
    if (path === '/pay' && query.order) {
      if (!authed) return SP.loginUrl('/pay?order=' + query.order);
      var o = SP.orders.get(query.order);
      if (!o) return '/orders';
      return SP.orderDue(o).total > 0 ? null : '/orders/' + o.id;
    }
    if ((path === '/cart' || path === '/delivery' || path === '/payment' || path === '/pay') && !hasProducts) return '/';
    // a returning user (remember-me) gets the pre-filled login form, as the cart's next button does (R3F-04)
    if ((path === '/delivery' || path === '/payment' || path === '/pay') && !authed) return SP.api.remembered() ? '/login' : '/register';
    if ((path === '/payment' || path === '/pay') && !state.delivery.done) return '/delivery';
    if (path === '/recover/code' && !state.recover) return '/recover';
    // signed in: login / verification have nothing to do — switching accounts means signing out first, so one
    // person's session data never reaches another account (REV2-01). ?demo=1 is the QA seed (it signs in).
    // (#/register handles this itself: Back from #/delivery onto the register entry steps on back to the cart)
    if ((path === '/login' || path === '/register/verify') && authed && query.demo !== '1') return SP.afterLoginTarget(query);
    if (path === '/register/verify' && !state.pendingReg) return '/register';
    return null;
  }

  /* ---- QA URL parameters ----
     The motion class follows the URL on every entry. State-changing params are
     applied once per history entry: on the initial load and on a new navigation,
     but not when Back/Forward returns to an entry already seeded (so a ?demo=1
     entry cannot wipe what the user did since). */
  function qaFresh() {
    if (!SP._booted) return true;
    var hs = window.history.state;
    return !(hs && hs.spQA === location.hash);
  }
  function markQA() { stampEntry({ spQA: location.hash }); }
  function applyQA(path, q) {
    var root = document.documentElement;
    root.classList.toggle('no-anim', q.anim === '0' || (path === '/' && q.loading === '1' && q.run !== '1' && q.anim !== '1'));
    if (!qaFresh()) return;
    markQA();
    var ordersRoute = path === '/orders' || path.indexOf('/orders/') === 0 || (path === '/pay' && !!q.order);
    if (q.demo === '1') {
      state.products = [SP.demoProduct()];
      state.ui.details = {};
      // the designed defaults; explicit weight/customs/method/term below still override (cs-r3-04)
      state.deferWeight = true; state.deferCustoms = true; state.method = 'bog'; state.term = 4;
      SP.api.ensureDemoUser();
      state.userPhone = SP.DEMO_USER.phone;
      state.profile = { first: 'გიორგი', last: 'ბერიძე' };
      state.phoneChange = null;
      if (path === '/profile') {
        // v4: the demo account as seeded (password slicepay1, profile გიორგი / ბერიძე / giorgi@example.com); the QA
        // phone-change number is free again, so the code step's 4821 always verifies
        SP.api.resetDemoUser();
        var us = users();
        if (us[SP.QA_NEW_PHONE]) { delete us[SP.QA_NEW_PHONE]; saveUsers(us); }
        var oa = ordersAll();
        if (oa[SP.QA_NEW_PHONE]) { delete oa[SP.QA_NEW_PHONE]; ordersSave(oa); }
        if (SP.api.remembered() === SP.QA_NEW_PHONE) SP.api.remember(null);
      }
      if (path === '/delivery') {
        // the delivery form as a new user sees it: pickup at Vake, names from the profile, ID empty
        state.delivery = deliveryDefaults({ first: 'გიორგი', last: 'ბერიძე' });
      } else if (path === '/profile') {
        // v4: no session recipient names here, so a profile name edit made on #/profile?demo=1 reaches the delivery
        // step through SP.recipientPrefill (seeded names would count as typed in this session and hide the edit)
        state.delivery = deliveryDefaults();
      } else {
        // a completed delivery (pickup, fee 0) keeps the payment / success parity cases at 600₾ / 150₾
        state.delivery = deliveryDefaults({ method: 'pickup', branchId: 'vake', first: 'გიორგი', last: 'ბერიძე', pid: '01001012345' });
        state.delivery.done = true;
      }
      if (path === '/register/verify') {
        // a pending registration for 555 123 456 with code 4821 and no resend cooldown; not signed in yet
        state.userPhone = null;
        state.pendingReg = { first: 'გიორგი', last: 'ბერიძე', phone: SP.DEMO_USER.phone, email: 'giorgi@example.com', rec: null,
          code: '4821', sentAt: 0, expiresAt: Date.now() + SP.VERIFY_TTL, next: null, demo: true };
      }
      if (path === '/recover/code') state.recover = { phone: SP.DEMO_USER.phone, code: '4821', sentAt: 0 };
      if (path === '/success') state.order = null;
      // my orders: the two demo orders (re-seeded on the orders screens so their QA states are reproducible)
      if (ordersRoute) SP.orders.seedDemo(SP.DEMO_USER.phone);
    }
    if (q.weight === '0' || q.weight === '1') state.deferWeight = q.weight === '1';
    if (q.customs === '0' || q.customs === '1') state.deferCustoms = q.customs === '1';
    if (/^(bog|tbc|mere)$/.test(q.method || '')) state.method = q.method;
    if (/^\d{1,2}$/.test(q.term || '')) state.term = +q.term;
    state.term = SP.nearestTerm(state.method, state.term);
    if (q.delivery === 'courier' || q.delivery === 'pickup') {
      state.delivery.method = q.delivery;
      // a completed (demo) delivery needs a complete courier address: Tbilisi, so the fee is 5₾
      if (q.delivery === 'courier' && state.delivery.done) {
        if (!state.delivery.city) state.delivery.city = SP.CAPITAL;
        if (!state.delivery.address) state.delivery.address = 'ვაჟა-ფშაველას გამზ. 12';
      }
    }
    if (q.empty === '1' && ordersRoute && state.userPhone) SP.orders.clear(state.userPhone);
    // v4 profile: &edit=phone opens the phone form (the screen reads it); &edit=phone&step=code seeds a pending change
    // to SP.QA_NEW_PHONE (577 123 456) with code 4821 and no resend cooldown
    if (path === '/profile' && state.userPhone && q.edit === 'phone') {
      state.phoneChange = q.step === 'code' && !users()[SP.QA_NEW_PHONE] && state.userPhone !== SP.QA_NEW_PHONE
        ? { from: state.userPhone, phone: SP.QA_NEW_PHONE, code: '4821', sentAt: 0, expiresAt: Date.now() + SP.VERIFY_TTL, demo: true }
        : null;
    }
    if (q.auth === '0') state.userPhone = null;
    if (q.details === '1' || q.details === '0') {
      var open = q.details === '1';
      if (path === '/cart') state.products.forEach(function (p) { state.ui.details[p.id] = open; });
      if (path === '/payment') state.ui.payDetails = open;
    }
    // the receipt snapshot is only fabricated for the QA demo; otherwise only a paid order is patched
    if (path === '/success' && (q.demo === '1' || state.order)) {
      var over = {};
      if (SP.fmt.date(q.date)) over.date = q.date;
      if (/^\d{6}$/.test(q.order || '')) over.id = q.order;   // order IDs are 6 digits
      // a fixed id for the fabricated QA receipt: a fresh entry replaces the previous demo receipt in the
      // demo user's history instead of adding another order every time (REV2R2-06)
      if (!state.order) { if (q.demo === '1' && state.products.length) { over.id = over.id || SP.QA_ORDER_ID; SP.createOrder(over); } }
      else if (over.date || over.id) {
        var o = state.order;
        if (over.date && over.date !== o.date) {
          // the arrival window, timeline and schedule follow the order date
          o.date = over.date;
          o.eta = SP.eta({ products: o.products, delivery: o.delivery, date: o.date });
          if (o.timeline && o.timeline[0]) o.timeline[0].date = o.date;
        }
        if (over.id && over.id !== o.id) { if (state.userPhone) SP.orders.remove(o.id); o.id = over.id; }
        // a ?order= id deliberately replaces an order holding it (QA); a date-only patch updates the same order
        if (state.userPhone && o.status) SP.orders.save(o, null, { replace: !!over.id });
      }
    }
    SP.save();
  }

  var app;
  function handle(isEntry) {
    app = app || document.getElementById('app');
    var r = parseHash();
    if (isEntry) {
      endTraverse();
      var ix = entryIdx();
      navDir = ix === null ? (carryIdx !== undefined ? 'replace' : 'push')
        : lastIdx === null ? 'load' : ix < lastIdx ? 'back' : ix > lastIdx ? 'forward' : 'same';
    }
    var hit = matchRoute(r.path);
    if (!hit) { carryPrev = undefined; carryIdx = undefined; SP.go('/', { replace: true }); return; }
    var def = hit.def;
    // QA params are applied once per history entry: whether this one is fresh is read before applyQA stamps it
    // (?info= below follows the same rule, v2f-r3-04)
    var fresh = !!isEntry && qaFresh();
    if (isEntry) applyQA(r.path, r.query);
    var g = guard(r.path, r.query, hit.params);
    if (g) {
      carryPrev = undefined;
      // signed in on a #/login or #/register/verify entry left behind by the sign-in: step over it in the direction
      // of travel, so Back / Forward never bounce onto the screen just left (v2f-r2-02)
      if ((r.path === '/login' || r.path === '/register/verify') && state.userPhone) { carryIdx = undefined; SP.skipEntry(g, SP.authBackTarget()); return; }
      // Forward onto an order's card form that has since been paid (nothing due), entered from that order's detail:
      // step back to the detail entry instead of replacing this one with a second detail entry, which would leave
      // a dead Back step (v2f-r3-01). The paid entry stays ahead and is stepped over every time
      if (r.path === '/pay' && r.query.order && state.userPhone && navDir === 'forward' && g.indexOf('/orders/') === 0) {
        var hsp = window.history.state;
        if (hsp && hsp.spPrev === g) { carryIdx = undefined; traverse(-1); return; }
      }
      SP.go(g, { replace: true });
      return;
    }
    var samePath = current && current.path === r.path;
    // unmount (which cancels a screen's pending timers) only when the route is left or re-entered;
    // a plain re-render of the same route keeps in-flight work alive
    if (isEntry && current && current.def.unmount) { try { current.def.unmount(); } catch (e) { console.warn(e); } }
    if (isEntry) {
      // the <dialog> lives outside #app: close it (and release its scroll lock) on any route entry
      var dlg = document.getElementById('modal');
      if (dlg && dlg.hasAttribute('open') && SP.ui && SP.ui._closeModal) SP.ui._closeModal(false);
    }
    if (isEntry) {
      // a new history entry (state not stamped yet) remembers the screen it was entered from;
      // Back/Forward to an existing entry keeps its original stamp
      var hs = window.history.state;
      if (!hs || !('spPrev' in hs)) stampEntry({ spPrev: carryPrev !== undefined ? carryPrev : (current ? current.path : null) });
      if (entryIdx() === null) stampEntry({ spIdx: carryIdx !== undefined ? carryIdx : nextIdx() });
      lastIdx = entryIdx();
      carryPrev = undefined; carryIdx = undefined;
    }
    var desk = SP.isDesk();
    lastDesk = desk;
    var ctx = { path: r.path, query: r.query, params: hit.params, route: hit.pattern, desk: desk, state: state, entry: !!isEntry };
    current = { path: r.path, query: r.query, def: def, ctx: ctx };
    document.body.setAttribute('data-screen', def.screen || 'page');
    var title = typeof def.title === 'function' ? def.title(ctx) : def.title;   // e.g. 'შეკვეთა #731954'
    document.title = (title ? title + ' · ' : '') + 'SlicePay';
    app.innerHTML = def.render(ctx);
    if (def.mount) def.mount(app.firstElementChild || app, ctx);   // screen element is replaced on every render → no listener build-up
    if (isEntry) {
      if (!samePath) window.scrollTo(0, 0);
      // move focus to the new screen for keyboard / screen-reader users (not on first load)
      if (SP._booted && !samePath) {
        var h = app.querySelector('[data-autofocus]') || app.querySelector('h1');
        if (h) { if (!h.hasAttribute('tabindex') && !h.matches('input, select, textarea, button, a[href], [contenteditable]')) h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      }
    }
    if (isEntry && r.query.toast === '1' && SP.ui) SP.ui.toast('სატესტო შეტყობინება', {});
    // v2 QA: ?info=weight|customs|all opens the "approximate amounts" explanation on the cart / payment — once per
    // history entry, like every other QA param: Back / Forward onto the entry does not reopen it (v2f-r3-04)
    if (fresh && /^(weight|customs|all)$/.test(r.query.info || '') && (r.path === '/cart' || r.path === '/payment') && SP.ui && SP.ui.explain) {
      // as the real controls do: the cart link ('all') has no product line, an info button has (cp-12)
      SP.ui.explain({ products: r.query.info === 'all' ? null : state.products, focus: r.query.info === 'all' ? null : r.query.info });
    }
    SP._booted = true;
  }

  /** re-render the current route without re-applying QA params */
  SP.rerender = function (opts) {
    if (!current) return;
    var a = document.activeElement;
    // the browser may already have blurred a control that the breakpoint just hid (display:none)
    if ((!a || a === document.body) && lostFocus && lostFocus.isConnected) a = lostFocus;
    lostFocus = null;
    var inApp = !!(a && app && a !== app && app.contains(a));
    var focusId = inApp && a.id;
    // controls without an id are found again by a stable attribute (R2-03): the mobile and desktop
    // variants of the same control share it (e.g. [data-action="next"], [data-back])
    var focusSel = inApp && !focusId ? focusKey(a) : null;
    var sx = window.scrollX, sy = window.scrollY;
    var snap = opts && opts.keepValues ? snapshotValues() : null;
    handle(false);
    if (snap) restoreValues(snap);
    if (inApp) {
      var el = focusId ? document.getElementById(focusId) : null;
      if (!el && focusSel) el = Array.prototype.filter.call(app.querySelectorAll(focusSel), visible)[0] || null;
      if (!el || !visible(el)) {   // no equivalent control on this layout: land on the screen heading
        el = app.querySelector('h1');
        if (el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      }
      if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
    window.scrollTo(sx, sy);
  };
  // remembers a control that lost focus only because it was hidden (focus fix-up), not because the user moved on
  var lostFocus = null;
  document.addEventListener('focusout', function (e) {
    var t = e.target;
    lostFocus = !e.relatedTarget && t && t.nodeType === 1 && app && app.contains(t) && !t.getClientRects().length ? t : null;
  }, true);
  document.addEventListener('focusin', function () { lostFocus = null; }, true);
  var FOCUS_ATTRS = ['data-action', 'data-back', 'data-toggle', 'data-remove', 'data-terms', 'data-add-cancel', 'data-explain', 'data-order', 'data-acct'];
  function focusKey(el) {
    for (var i = 0; i < FOCUS_ATTRS.length; i++) {
      var n = FOCUS_ATTRS[i];
      if (el.hasAttribute(n)) { var v = el.getAttribute(n); return v ? '[' + n + '="' + v.replace(/["\\]/g, '\\$&') + '"]' : '[' + n + ']'; }
    }
    return null;
  }
  function visible(el) { return !!(el && el.getClientRects().length); }
  /** input values plus their shown validation state survive a re-render (R2-10, generalised) */
  function snapshotValues() {
    var out = {};
    app.querySelectorAll('input[id],select[id],textarea[id]').forEach(function (i) {
      var e = document.getElementById(i.id + '-err');
      out[i.id] = i.type === 'checkbox' || i.type === 'radio' ? { c: i.checked } : { v: i.value };
      out[i.id].inv = i.getAttribute('aria-invalid') === 'true';
      out[i.id].err = e && i.getAttribute('aria-invalid') === 'true' ? e.textContent : null;
    });
    return out;
  }
  function restoreValues(s) {
    Object.keys(s).forEach(function (id) {
      var i = document.getElementById(id); if (!i) return;
      if ('c' in s[id]) i.checked = s[id].c;
      else if (i.value !== s[id].v) { i.value = s[id].v; i.dispatchEvent(new Event(i.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }
      // the 'input' above clears errors in most screens: re-apply a shown one
      if (s[id].inv && i.getAttribute('aria-invalid') !== 'true') {
        i.setAttribute('aria-invalid', 'true');
        var e = document.getElementById(id + '-err');
        if (e && s[id].err) e.textContent = s[id].err;
      }
    });
  }

  SP.start = function () {
    window.addEventListener('hashchange', function () { handle(true); });
    if (window.matchMedia) {
      var mq = window.matchMedia(DESK_MQ);
      // only screens whose markup depends on ctx.desk (def.responsive) re-render; the rest is pure CSS
      var onMq = function () {
        var d = SP.isDesk();
        if (current && d !== lastDesk && current.def.responsive) SP.rerender({ keepValues: true });
        lastDesk = d;
      };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
    sentLog();   // a reload drops expired verification-log entries and re-arms the prune timer (REV2R3-02)
    if (state.order) withProcessing(state.order);   // v4 (the status check needs SP.STATUS, defined after the load)
    handle(true);
  };
})();

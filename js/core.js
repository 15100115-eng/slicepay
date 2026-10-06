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
  function defaults() {
    return {
      products: [],          // {id,name,url,store,img,item,weight,customs,service,qty}
      deferWeight: true,     // checkbox "წონის თანხას მოგვიანებით გადავიხდი"
      deferCustoms: true,    // checkbox "განბაჟების თანხას მოგვიანებით გადავიხდი"
      method: 'bog',         // bog | tbc | mere
      userPhone: null,       // logged-in user (9-digit phone)
      order: null,           // snapshot created on payment
      recover: null,         // {phone, code, sentAt}
      loginPhone: null,      // just-recovered phone, pre-fills the login form
      ui: { details: {}, payDetails: false }
    };
  }

  var state = defaults();
  (function load() {
    var s = storeGet('sessionStorage', STATE_KEY);
    if (s && typeof s === 'object') {
      var d = defaults();
      for (var k in d) if (Object.prototype.hasOwnProperty.call(s, k)) d[k] = s[k];
      if (!Array.isArray(d.products)) d.products = [];
      if (!d.ui || typeof d.ui !== 'object') d.ui = { details: {}, payDetails: false };
      if (!d.ui.details) d.ui.details = {};
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
    state = defaults();
    state.userPhone = keepUser;
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
    todayIso: function () {
      var d = new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    },
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
    cvvBad: 'CVV არასწორია'
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
      item: 500, weight: 100, customs: 250, service: 100, qty: 1
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
      item: item, weight: weight, customs: customs, service: service, qty: 1 };
  };
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
  SP.totals = function (st) {
    st = st || state;
    var t = { item: 0, weight: 0, customs: 0, service: 0, total: 0, deferWeight: !!st.deferWeight, deferCustoms: !!st.deferCustoms };
    (st.products || []).forEach(function (p) {
      var r = SP.price(p, st);
      t.item += r.item; t.weight += r.weight; t.customs += r.customs; t.service += r.service; t.total += r.payable;
    });
    t.monthly = Math.ceil(t.total / 4);
    return t;
  };

  /* ------------------------------------------------------------------
     Mock backend (DEMO account store in localStorage)
     Only what login needs is kept: {salt, pass, created} per phone. Names and
     e-mail are never persisted (R2-19). The hash is a salted, iterated FNV-1a:
     it only keeps plain passwords out of storage. This is NOT real credential
     security; a production backend must hash server-side (e.g. Argon2/bcrypt).
     ------------------------------------------------------------------ */
  function users() {
    var all = storeGet('localStorage', USERS_KEY) || {};
    // drop PII written by older builds (first/last/email)
    for (var k in all) if (all[k] && (all[k].first || all[k].last || all[k].email)) { delete all[k].first; delete all[k].last; delete all[k].email; all.__dirty = true; }
    if (all.__dirty) { delete all.__dirty; saveUsers(all); }
    return all;
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
  SP.DEMO_USER = { phone: '555123456', password: 'slicepay1' };
  SP.api = {
    userExists: function (phone) { return !!users()[phone]; },
    register: function (u) {
      var all = users();
      if (all[u.phone]) return { ok: false, error: 'exists' };
      all[u.phone] = record(u.password);   // name / e-mail are validated by the form but not stored (demo)
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
      var code = String(1000 + Math.floor(Math.random() * 9000));
      state.recover = { phone: phone, code: code, sentAt: Date.now() };
      SP.save();
      return code;
    },
    resetPassword: function (phone, password) {
      var all = users();
      if (!all[phone]) return { ok: false };
      all[phone] = record(password); saveUsers(all);
      return { ok: true };
    },
    ensureDemoUser: function () {
      var all = users(), d = SP.DEMO_USER;
      if (!all[d.phone]) { all[d.phone] = record(d.password); saveUsers(all); }
    },
    remember: function (phone) { if (phone) storeSet('localStorage', REMEMBER_KEY, phone); else storeDel('localStorage', REMEMBER_KEY); },
    remembered: function () { return storeGet('localStorage', REMEMBER_KEY); }
  };
  SP.isAuthed = function () { return !!state.userPhone; };

  /** creates the order snapshot used by the success screen */
  SP.createOrder = function (over) {
    over = over || {};
    var id = over.id || String(Math.floor(100000 + Math.random() * 900000));
    state.order = {
      id: id,
      date: over.date || SP.fmt.todayIso(),
      products: JSON.parse(JSON.stringify(state.products)),
      deferWeight: state.deferWeight, deferCustoms: state.deferCustoms,
      method: state.method
    };
    SP.save();
    return state.order;
  };

  /* ------------------------------------------------------------------
     Router
     ------------------------------------------------------------------ */
  var routes = {};
  var current = null;          // {path, query, def}
  var carryPrev;               // spPrev of an entry being replaced (SP.go replace) → stamped onto its replacement
  var lastDesk = null;
  SP.route = function (path, def) { routes[path] = def; };

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
    var target = '#' + path;
    if (location.hash === target || (path === '/' && (location.hash === '' || location.hash === '#'))) { handle(true); return; }
    if (opts && opts.replace) {
      // location.replace drops history.state: the replacement inherits the replaced entry's origin (R3F-01)
      var hs = window.history.state;
      carryPrev = hs && ('spPrev' in hs) ? hs.spPrev : undefined;
      location.replace(target);
    } else { carryPrev = undefined; location.hash = target; }
  };
  /** back navigation that keeps history consistent: every history entry is stamped with the route it
      was entered from (spPrev); when that is the target, step back instead of pushing a new entry (R2-08) */
  SP.back = function (path) {
    var hs = window.history.state;
    if (hs && hs.spPrev === path) { history.back(); return; }
    SP.go(path);
  };
  function stampEntry(patch) {
    try { window.history.replaceState(Object.assign({}, window.history.state, patch), ''); } catch (e) { /* ignore */ }
  }

  /* ---- guards ---- */
  function guard(path) {
    var hasProducts = state.products.length > 0;
    if (path === '/success') return state.order ? null : '/';
    if ((path === '/cart' || path === '/payment' || path === '/pay') && !hasProducts) return '/';
    // a returning user (remember-me) gets the pre-filled login form, as the cart's next button does (R3F-04)
    if ((path === '/payment' || path === '/pay') && !state.userPhone) return SP.api.remembered() ? '/login' : '/register';
    if (path === '/recover/code' && !state.recover) return '/recover';
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
    if (q.demo === '1') {
      state.products = [SP.demoProduct()];
      state.ui.details = {};
      // the designed defaults; explicit weight/customs/method below still override (cs-r3-04)
      state.deferWeight = true; state.deferCustoms = true; state.method = 'bog';
      SP.api.ensureDemoUser();
      state.userPhone = SP.DEMO_USER.phone;
      if (path === '/recover/code') state.recover = { phone: SP.DEMO_USER.phone, code: '4821', sentAt: 0 };
      if (path === '/success') state.order = null;
    }
    if (q.weight === '0' || q.weight === '1') state.deferWeight = q.weight === '1';
    if (q.customs === '0' || q.customs === '1') state.deferCustoms = q.customs === '1';
    if (/^(bog|tbc|mere)$/.test(q.method || '')) state.method = q.method;
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
      if (!state.order) { if (q.demo === '1' && state.products.length) SP.createOrder(over); }
      else { if (over.date) state.order.date = over.date; if (over.id) state.order.id = over.id; }
    }
    SP.save();
  }

  var app;
  function handle(isEntry) {
    app = app || document.getElementById('app');
    var r = parseHash();
    var def = routes[r.path];
    if (!def) { carryPrev = undefined; SP.go('/', { replace: true }); return; }
    if (isEntry) applyQA(r.path, r.query);
    var g = guard(r.path);
    if (g) { carryPrev = undefined; SP.go(g, { replace: true }); return; }
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
      carryPrev = undefined;
    }
    var desk = SP.isDesk();
    lastDesk = desk;
    var ctx = { path: r.path, query: r.query, desk: desk, state: state, entry: !!isEntry };
    current = { path: r.path, query: r.query, def: def, ctx: ctx };
    document.body.setAttribute('data-screen', def.screen || 'page');
    document.title = (def.title ? def.title + ' · ' : '') + 'SlicePay';
    app.innerHTML = def.render(ctx);
    if (def.mount) def.mount(app.firstElementChild || app, ctx);   // screen element is replaced on every render → no listener build-up
    if (isEntry) {
      if (!samePath) window.scrollTo(0, 0);
      // move focus to the new screen for keyboard / screen-reader users (not on first load)
      if (SP._booted && !samePath) {
        var h = app.querySelector('[data-autofocus]') || app.querySelector('h1');
        if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
      }
    }
    if (isEntry && r.query.toast === '1' && SP.ui) SP.ui.toast('სატესტო შეტყობინება', {});
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
  var FOCUS_ATTRS = ['data-action', 'data-back', 'data-toggle', 'data-remove', 'data-terms', 'data-add-cancel'];
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
    app.querySelectorAll('input[id]').forEach(function (i) {
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
      if ('c' in s[id]) i.checked = s[id].c; else if (i.value !== s[id].v) { i.value = s[id].v; i.dispatchEvent(new Event('input', { bubbles: true })); }
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
    handle(true);
  };
})();

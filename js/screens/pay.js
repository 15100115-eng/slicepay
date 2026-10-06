/* =====================================================================
   SlicePay — screens/pay.js   route: #/pay  (card form)
   Brand detection, 4-4-4-4 grouping (Amex 4-6-5), Luhn, MM / YY not in
   the past, CVV 3 (Amex 4), ~1.2 s processing, then #/success.
   QA: ?demo=1  &err=1 (validation errors)  &processing=1 (frozen spinner)
   Test card: 4242 4242 4242 4242 · any future date · any 3 digits
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, V = SP.valid, F = SP.fmt;
  var timer = null;
  var BRANDS = [
    { id: 'visa', name: 'Visa' }, { id: 'mastercard', name: 'Mastercard' }, { id: 'diners', name: 'Diners Club' },
    { id: 'maestro', name: 'Maestro' }, { id: 'discover', name: 'Discover' }, { id: 'amex', name: 'American Express' }
  ];

  /** raw expiry text → up to 4 digits MMYY. Understands a typed separator
      after a one-digit month ('1/' → 01) and a 4-digit year ('12/2028',
      '1/2028', '122028' → 1228). maxlength=9 leaves room for 'MM / YYYY'. */
  function expDigits(raw, del) {
    var s = String(raw || ''), m;
    if ((m = /^\s*(\d{1,2})\s*\/\s*(\d{4})\s*$/.exec(s))) return ('0' + m[1]).slice(-2) + m[2].slice(2);
    if (/^(0[1-9]|1[0-2])20\d\d$/.test(s.replace(/\s/g, ''))) { s = s.replace(/\s/g, ''); return s.slice(0, 2) + s.slice(4); }
    if (!del && (m = /^\s*([1-9])\s*\/(.*)$/.exec(s))) return ('0' + m[1] + m[2].replace(/\D/g, '')).slice(0, 4);
    var d = s.replace(/\D/g, '');
    // 'MM / 20' followed by more year digits: the '20' was the century
    if (d.length > 4 && d.slice(2, 4) === '20') d = d.slice(0, 2) + d.slice(4);
    return d.slice(0, 4);
  }

  function render() {
    return '' +
      '<div class="m-page paypage">' +
        UI.dHead('/payment') +
        '<main class="paycard-wrap">' +
          '<h1 class="sr-only">ბარათით გადახდა</h1>' +
          '<form class="paycard" id="card-form" novalidate>' +
            '<p class="t-card-label paycard__label" id="brands-l" lang="en">Pay with</p>' +
            '<ul class="brands" aria-labelledby="brands-l">' +
              BRANDS.map(function (b) { return '<li class="brands__item" data-brand="' + b.id + '"><img src="assets/icons/card-' + b.id + '.svg" width="28.5" height="19" alt="' + b.name + '"></li>'; }).join('') +
            '</ul>' +
            '<p class="sr-only" id="cc-brand" aria-live="polite"></p>' +
            '<label class="t-card-label paycard__label paycard__l-num" for="cc-num" lang="en">Card number</label>' +
            '<input class="card-input card-input--num" id="cc-num" type="text" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" lang="en" aria-describedby="cc-num-err cc-brand" aria-required="true" spellcheck="false">' +
            '<p class="err" id="cc-num-err" aria-live="polite"></p>' +
            '<div class="paycard__row">' +
              '<div class="paycard__cell">' +
                '<label class="t-card-label paycard__label" for="cc-exp" lang="en">Exp Date</label>' +
                '<input class="card-input card-input--exp" id="cc-exp" type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY" lang="en" aria-describedby="cc-exp-err" aria-required="true" maxlength="9" spellcheck="false">' +
                '<p class="err" id="cc-exp-err" aria-live="polite"></p>' +
              '</div>' +
              '<div class="paycard__cell">' +
                '<label class="t-card-label paycard__label" for="cc-cvv" lang="en">CVV2</label>' +
                '<input class="card-input card-input--cvv" id="cc-cvv" type="text" inputmode="numeric" autocomplete="cc-csc" placeholder="123" lang="en" aria-describedby="cc-cvv-err" aria-required="true" spellcheck="false">' +
                '<p class="err" id="cc-cvv-err" aria-live="polite"></p>' +
              '</div>' +
            '</div>' +
            '<button type="submit" class="btn btn--card" id="card-submit"><span class="btn__label">' + UI.mt('pay') + '</span></button>' +
            '<p class="sr-only" id="card-status" aria-live="assertive"></p>' +
          '</form>' +
        '</main>' +
        '<div class="m-spacer paypage__spacer only-m"></div>' +
        '<div class="only-m">' + UI.mBar({ label: UI.mt('back'), back: '/payment' }, null) + '</div>' +
      '</div>';
  }

  function mount(root, ctx) {
    var form = root.querySelector('#card-form');
    var num = root.querySelector('#cc-num'), exp = root.querySelector('#cc-exp'), cvv = root.querySelector('#cc-cvv');
    var btn = root.querySelector('#card-submit');
    var busy = false, touched = {};
    // No maxlength on #cc-num / #cc-cvv: the browser would cut pasted text
    // (' 123', '4242 - 4242 - …') before the input handlers strip the
    // separators. F.cardNumber clamps the number; cvvMax clamps the CVV.
    var cvvMax = 3, brandNow;
    var brandOut = root.querySelector('#cc-brand');

    function brand() { return V.cardBrand(num.value); }
    function syncBrand() {
      var b = brand();
      root.querySelectorAll('.brands__item').forEach(function (li) {
        li.classList.toggle('is-dim', !!b && li.getAttribute('data-brand') !== b);
      });
      cvvMax = b === 'amex' ? 4 : 3;
      cvv.placeholder = b === 'amex' ? '1234' : '123';
      // Amex → 3-digit brand: drop the extra digit (only once a brand is known,
      // so clearing the number to retype it does not eat the CVV)
      if (b && cvv.value.length > cvvMax) cvv.value = cvv.value.slice(0, cvvMax);
      // the dimmed badges are visual only: announce the detected brand
      if (b !== brandNow) {
        brandNow = b;
        var hit = BRANDS.filter(function (x) { return x.id === b; })[0];
        brandOut.textContent = hit ? hit.name : '';
      }
    }
    var rules = {
      'cc-num': function () { var d = num.value.replace(/\D/g, ''); return !d ? 'შეიყვანეთ ბარათის ნომერი' : V.cardNumber(d) ? '' : SP.msg.card; },
      'cc-exp': function () { var s = V.expState(exp.value); return !exp.value.trim() ? 'შეიყვანეთ ვადა' : s === 'ok' ? '' : s === 'past' ? SP.msg.expPast : SP.msg.exp; },
      'cc-cvv': function () {
        if (!cvv.value) return SP.msg.cvv;
        // short: must fit one line in the CVV column down to 320 px (cs-r3-03)
        return V.cvv(cvv.value, brand()) ? '' : (SP.msg.cvvBad || 'CVV არასწორია');
      }
    };
    function check(id) { var m = rules[id](); UI.setError(document.getElementById(id), m); return m; }

    UI.sepBackspace(num);
    num.addEventListener('input', function () {
      var pos = num.selectionStart, before = num.value.slice(0, pos).replace(/\D/g, '').length;
      var f = F.cardNumber(num.value, brand());
      if (f !== num.value) {
        num.value = f;
        var i = 0, seen = 0; while (i < f.length && seen < before) { if (/\d/.test(f[i])) seen++; i++; }
        try { num.setSelectionRange(i, i); } catch (e) { /* ignore */ }
      }
      UI.setError(num, ''); syncBrand();
    });
    exp.addEventListener('input', function (e) {
      var del = e.inputType && e.inputType.indexOf('delete') === 0, m;
      // a 4-digit year being typed ('12 / 20' → '12 / 203'): hold the third
      // digit; the fourth turns '12 / 2030' into '12 / 30' via expDigits
      if (!del && (m = /^\s*(\d{2})\s*\/\s*(20\d)\s*$/.exec(exp.value))) { exp.value = m[1] + ' / ' + m[2]; UI.setError(exp, ''); return; }
      var d = expDigits(exp.value, del);
      if (d.length === 1 && +d > 1 && !del) d = '0' + d;
      var v = d.length > 2 ? d.slice(0, 2) + ' / ' + d.slice(2) : (d.length === 2 && !del ? d + ' / ' : d);
      exp.value = v; UI.setError(exp, '');
    });
    cvv.addEventListener('input', function () { var v = cvv.value.replace(/\D/g, '').slice(0, cvvMax); if (v !== cvv.value) cvv.value = v; UI.setError(cvv, ''); });
    [num, exp, cvv].forEach(function (i) { i.addEventListener('blur', function () { if (i.value || touched[i.id]) { touched[i.id] = true; check(i.id); } }); });

    function process(frozen) {
      busy = true;
      if (btn.classList.contains('is-loading')) return;
      btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
      btn.insertAdjacentHTML('beforeend', UI.spinner());
      [num, exp, cvv].forEach(function (i) { i.readOnly = true; });
      form.classList.add('is-processing');
      root.querySelector('#card-status').textContent = 'მიმდინარეობს გადახდა…';
      if (frozen) return;
      timer = setTimeout(function () {
        SP.createOrder();
        // the order snapshot is what #/success renders; empty the cart so Back
        // from success cannot offer the paid products for payment again
        // …and reset the per-order choices to the brief's defaults, so a new
        // order started after Back from success does not inherit them (the
        // receipt reads deferWeight / deferCustoms / method from the snapshot)
        SP.set({ products: [], deferWeight: true, deferCustoms: true, method: 'bog', ui: { details: {}, payDetails: false } });
        SP.go('/success', { replace: true });
      }, 1200);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var first = null;
      ['cc-num', 'cc-exp', 'cc-cvv'].forEach(function (id) { touched[id] = true; if (check(id) && !first) first = id; });
      if (first) { document.getElementById(first).focus(); return; }
      process(false);
    });

    syncBrand();
    if (ctx.entry && ctx.query.err === '1') ['cc-num', 'cc-exp', 'cc-cvv'].forEach(check);
    if (ctx.entry && ctx.query.processing === '1') process(true);
  }

  SP.route('/pay', { screen: 'pay', title: 'ბარათით გადახდა', render: render, mount: mount, unmount: function () { clearTimeout(timer); } });
})();

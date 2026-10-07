/* =====================================================================
   SlicePay — screens/landing.js   route: #/
   States: empty (store carousel) · filled · loading (ticker) · error
   v2: top-right account link (UI.accountLink('light')) in every state
   QA: ?url=<encoded>  &loading=1 [&msg=0|1|2] [&run=1]  &err=1  &anim=0
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, esc = SP.esc;
  var timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  // ticker step start times (ms after submit); the transitions themselves are --t-ticker-in/-swap/-out
  var STEP = { show1: 30, swap: 1100, exit: 2300 };
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function render(ctx) {
    var q = ctx.query;
    var url = q.url || '';
    var loading = q.loading === '1';
    var valid = !!SP.valid.url(url);
    var st = loading ? 'loading' : (url ? 'filled' : 'empty');
    // frozen QA states render their ticker step directly (no entry transition)
    var step0 = !loading ? 'off' : q.run === '1' ? 'enter' : (q.msg === '1' ? 'show1' : q.msg === '2' ? 'swap' : 'enter');
    return '' +
      '<main class="landing" data-state="' + st + '">' +
      // v2: account entry point, top-right on the gradient (ჩემი შეკვეთები / შესვლა → /login?next=/orders)
      '<nav class="landing__acct" aria-label="ანგარიში">' + UI.accountLink('light') + '</nav>' +
      '<div class="landing__inner">' +
        '<div class="landing__logo"><img class="logo" src="assets/icons/logo-white.svg" width="113" height="76" alt="SlicePay"></div>' +
        '<div class="landing__stage">' +
          '<h1 class="landing__title t-title" id="landing-title">' +
            // Mtavruli glyphs are hidden from AT; the accessible name is the Mkhedruli text (spec_landing §1.3)
            '<span aria-hidden="true">' + UI.T.title.split(' ')[0] + ' <br class="br-m">' + UI.T.title.split(' ')[1] + '</span>' +
            '<span class="sr-only">გამოიწერე ნაწილ-ნაწილ</span></h1>' +
          '<div class="ticker">' +
            '<div class="ticker__stack" aria-hidden="true" data-step="' + step0 + '">' +
              '<p class="ticker__msg t-loading">ვამოწმებთ პროდუქტის<br>დეტალებს</p>' +
              '<p class="ticker__msg t-loading">ვამუშავებთ<br>ინფორმაციას</p>' +
            '</div>' +
          '</div>' +
          '<p class="sr-only" id="ticker-sr" aria-live="polite"></p>' +
        '</div>' +
        '<div class="landing__spacer"></div>' +
        '<form class="landing__form" id="landing-form" novalidate' + (loading ? ' aria-busy="true"' : '') + '>' +
          '<div class="url-wrap">' +
            '<label class="sr-only" for="url">პროდუქტის ლინკი</label>' +
            '<input class="url-input t-input-lg" id="url" name="url" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go"' +
              ' placeholder="ჩაწერეთ ლინკი..." aria-describedby="url-err" aria-required="true" value="' + esc(url) + '"' + (loading ? ' readonly' : '') + '>' +
            '<div class="store-slot" aria-hidden="true"><div class="store-col">' +
              '<img class="store-amazon" src="assets/icons/amazon.svg" width="22" height="23" alt="">' +
              '<img class="store-ebay" src="assets/icons/ebay.svg" width="33" height="14" alt="">' +
            '</div></div>' +
          '</div>' +
          '<p class="landing__err" id="url-err" aria-live="polite"></p>' +
          '<button class="btn btn--lg' + (loading ? ' is-loading' : '') + '" id="landing-submit" type="submit" aria-label="შემოწმება" aria-disabled="' + (valid ? 'false' : 'true') + '"' + (loading ? ' aria-busy="true"' : '') + '>' +
            '<span class="btn__label">' + UI.T.check + '</span>' + (loading ? UI.spinner() : '') +
          '</button>' +
        '</form>' +
      '</div>' +
      '</main>';
  }

  function mount(root, ctx) {
    var q = ctx.query;
    var landing = root;
    var form = root.querySelector('#landing-form');
    var input = root.querySelector('#url');
    var btn = root.querySelector('#landing-submit');
    var err = root.querySelector('#url-err');
    var stack = root.querySelector('.ticker__stack');
    var sr = root.querySelector('#ticker-sr');
    var busy = false;

    function sync() {
      var v = input.value;
      landing.setAttribute('data-state', busy ? 'loading' : (v ? 'filled' : 'empty'));
      btn.setAttribute('aria-disabled', SP.valid.url(v) ? 'false' : 'true');
    }
    function showErr(msg) {
      err.textContent = msg || '';
      landing.classList.toggle('has-error', !!msg);
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    input.addEventListener('input', function () { if (busy) return; showErr(''); sync(); });

    var SR_MSG = { show1: 'ვამოწმებთ პროდუქტის დეტალებს', swap: 'ვამუშავებთ ინფორმაციას' };
    function setStep(step) {
      stack.setAttribute('data-step', step);
      // the visual stack is aria-hidden; announce each message once via the live region
      if (SR_MSG[step] && sr.textContent !== SR_MSG[step]) sr.textContent = SR_MSG[step];
    }

    function startLoading(url, opts) {
      busy = true;
      opts = opts || {};
      input.readOnly = true;
      // show the URL from its start (as in m02/d02), not the caret-end tail left by typing
      try { input.setSelectionRange(0, 0); } catch (e) {}
      input.scrollLeft = 0;
      form.setAttribute('aria-busy', 'true');
      btn.classList.add('is-loading');
      btn.setAttribute('aria-busy', 'true');
      btn.setAttribute('aria-disabled', 'false');
      if (!btn.querySelector('.spinner')) btn.insertAdjacentHTML('beforeend', UI.spinner());
      landing.setAttribute('data-state', 'loading');
      if (opts.frozen) return;
      var reduced = SP.reducedMotion();
      landing.classList.toggle('is-reduced', reduced);
      setStep('enter');
      later(function () { setStep('show1'); }, STEP.show1);
      later(function () { setStep('swap'); }, STEP.swap);
      later(function () { setStep('exit'); }, STEP.exit);
      later(function () {
        // the designed Nike demo product is used only for a first amazon URL (matches m03/d04);
        // any other URL gets a product parsed from the link
        SP.addProduct(url, { demo: !SP.state().products.length && SP.storeOf(url) === 'amazon' });
        SP.go('/cart');
      }, STEP.exit + SP.cssMs('--t-ticker-out', 200));   // after the exit fade
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var url = SP.valid.url(input.value);
      if (!url) { showErr(SP.msg.url); input.focus(); return; }
      showErr('');
      startLoading(url);
    });

    sync();
    if (q.loading === '1') {
      var url0 = SP.valid.url(q.url || '') || 'https://www.amazon.com/';
      if (q.run === '1') startLoading(url0);
      else {
        startLoading(url0, { frozen: true });
        var m = q.msg === '1' ? 'show1' : q.msg === '2' ? 'swap' : 'enter';
        setStep(m);
      }
    } else if (q.err === '1') {
      showErr(SP.msg.url);
    }
  }

  SP.route('/', { screen: 'landing', title: 'გამოიწერე ნაწილ-ნაწილ', render: render, mount: mount, unmount: clearTimers });
})();

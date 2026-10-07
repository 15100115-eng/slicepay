/* =====================================================================
   SlicePay — screens/cart.js   route: #/cart
   QA: ?demo=1 &weight=0|1 &customs=0|1 &details=0|1 &add=1 &addTile=below &term=N &info=weight|customs|all
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, esc = SP.esc, fmt = SP.fmt;
  var addOpen = false;     // inline add-product form open?
  var addBusy = false;
  var addTimer = null;
  var addErr = null;       // { v: value, m: message } of a shown add-url error, re-applied after re-renders
  var rmLock = 0;          // time of the last removal: swallow the 2nd click of a double-click (R2F-01)

  /* ---------------- pieces ---------------- */
  function product(p, desk, st) {
    var pr = SP.price(p, st);
    var open = !!st.ui.details[p.id];
    var bdId = 'bd-' + p.id;
    var bd = UI.breakdown({ item: pr.item, weight: pr.weight, customs: pr.customs, service: pr.service, total: pr.payable,
      deferWeight: pr.deferWeight, deferCustoms: pr.deferCustoms }, 'amount-first', { long: desk, productId: p.id });
    var row =
      '<div class="prod__row">' + UI.thumb(p) +
        '<div class="prod__info">' +
          '<p class="prod__title t-body" id="pt-' + p.id + '" title="' + esc(p.name) + '">' + esc(p.name) + '</p>' +
          '<div class="prod__price-row">' +
            '<span class="prod__price t-price-lg">' + fmt.money(pr.payable) + '</span>' +
            UI.toggle(bdId, open, 'id="tg-' + p.id + '" data-toggle="' + p.id + '" aria-describedby="pt-' + p.id + '"') +
          '</div>' +
        '</div>' +
        '<button type="button" class="x-btn prod__x" id="rm-' + p.id + '" data-remove="' + p.id + '" aria-label="წაშლა: ' + esc(p.name) + '">' + UI.icon('close') + '</button>' +
      '</div>';
    var details = desk
      ? '<div class="prod__det" id="' + bdId + '"' + (open ? '' : ' hidden') + '><hr>' + bd + '</div>'
      : '<div class="prod__det prod__det--m" id="' + bdId + '"' + (open ? '' : ' hidden') + '>' + bd + '</div>';
    return '<article class="prod' + (desk ? ' prod--d card' : ' prod--m') + (open ? ' is-open' : '') + '" data-id="' + p.id + '" aria-label="' + esc(p.name) + '">' + row + details + '</article>';
  }

  function addForm(desk) {
    return '<form class="add-form" id="add-form" novalidate' + (addBusy ? ' aria-busy="true"' : '') + '>' +
      '<div class="add-form__row">' +
        // the error lives in the field column, so it stays under the input when the button wraps below (<380)
        '<div class="add-form__field">' +
          UI.field({ id: 'add-url', label: 'ჩაწერეთ ლინკი...', type: 'url', inputmode: 'url', autocomplete: 'off', noErr: true, describedby: 'add-url-err' }) +
          '<p class="err" id="add-url-err" aria-live="polite"></p>' +
        '</div>' +
        '<button type="submit" class="btn btn--sm' + (addBusy ? ' is-loading' : '') + '" id="add-submit"' + (addBusy ? ' aria-busy="true"' : '') + '><span class="btn__label">' + UI.mt('add') + '</span>' + (addBusy ? UI.spinner() : '') + '</button>' +
      '</div>' +
      '<button type="button" class="link t-body add-form__cancel" data-add-cancel>გაუქმება</button>' +
      '</form>';
  }

  function checks(st) {
    return '<div class="cart-checks" role="group" aria-label="მოგვიანებით გადახდა">' +
      UI.checkbox({ variant: 'cart', id: 'defer-weight', checked: st.deferWeight, label: UI.DEFER_WEIGHT }) +
      UI.checkbox({ variant: 'cart', id: 'defer-customs', checked: st.deferCustoms, label: UI.DEFER_CUSTOMS }) +
      '</div>';
  }

  /* v2: "how is it calculated?" link (opens UI.explain, delegated in ui.js) — sits under the checkboxes, at the label x */
  function explainLink() { return '<p class="cart-explain">' + UI.explainLink('cart-explain__link') + '</p>'; }
  /* v2: parcel ETA line (§3+6): placed where it moves no designed element. v3 (v2f-r3-02): the window is the
     summary's own (s.eta), i.e. the same confirmed delivery as the fee row and 'სულ' — never an unconfirmed draft */
  function eta(desk, s) {
    // the truck sits in the checkbox column (mobile) / before the centred text (desktop); decorative
    return UI.etaRow(s.eta, { cls: 'cart-eta', lineCls: 'cart-eta__line', id: 'cart-eta', centred: desk });
  }
  /* v2: the summary shows the chosen term (state.term) */
  function termLabel(t) { return UI.termLabel(t.term); }

  /* v3 (v2f-r3-02): ONE source of truth. The whole summary — the 'მიწოდების ფასი' row, 'სულ', the monthly and
     'სავარაუდო მიღება' — comes from SP.checkoutSummary, i.e. from the CONFIRMED delivery (SP.confirmedDelivery),
     exactly as on payment / success / orders: once a delivery with a fee is confirmed the fee is in the total and
     the monthly and the row explains it (cp-05, v2f-r2-07); before that it is the default pickup (no fee, base ETA).
     deliveryFee:null keeps the live state from ever being read as an order snapshot. → {fee, totals, eta, etaText, …} */
  function summary(st) {
    return SP.checkoutSummary(Object.assign({}, st, { deliveryFee: null }));
  }
  function feeText(s) { return 'მიწოდების ფასი  ' + fmt.money(s.fee); }
  function feeLine(s) {
    return s.fee > 0 ? '<p class="t-body cart-sum__fee">' + feeText(s) + '</p>' : '';
  }

  /* persistent polite status: survives in-place price updates, so total changes are announced */
  function status() { return '<p class="sr-only" id="cart-status" role="status" aria-live="polite" aria-atomic="true"></p>'; }

  /* ---------------- mobile ---------------- */
  function renderM(st, s) {
    var t = s.totals;
    var prods = st.products.map(function (p, i) { return (i ? '<hr class="prod-sep">' : '') + product(p, false, st); }).join('');
    var last = st.products[st.products.length - 1];
    var lastOpen = last && st.ui.details[last.id];
    return '' +
      '<div class="m-page cart-m">' +
        '<main class="cart-m__content">' +
          '<h1 class="sr-only">კალათა</h1>' +
          '<section class="card cart-m__card' + (lastOpen ? ' last-open' : '') + (addOpen ? ' add-open' : '') + '">' +
            '<button type="button" class="cart-add-head" id="add-trigger" aria-expanded="' + addOpen + '" aria-controls="add-form-wrap">' +
              UI.icon('plus-circle', 'cart-add-head__ico') + '<span class="t-h1">დაამატე სხვა პროდუქტი</span>' +
            '</button>' +
            '<div id="add-form-wrap" class="cart-m__addwrap"' + (addOpen ? '' : ' hidden') + '>' + (addOpen ? addForm(false) : '') + '</div>' +
            '<hr class="cart-m__div">' +
            prods +
          '</section>' +
          '<section class="card cart-sum cart-sum--m" aria-labelledby="sum-h">' +
            '<h2 class="t-h-total" id="sum-h">' + UI.mt('total') + '</h2>' +
            '<div class="cart-sum__monthly"><span class="t-price-lg cart-sum__mo">' + fmt.money(t.monthly) + '</span><span class="t-body-16 cart-sum__mo-l">' + termLabel(t) + '</span></div>' +
            '<p class="t-body-16 cart-sum__total">სულ  ' + fmt.money(t.total) + '</p>' + feeLine(s) +
          '</section>' +
          checks(st) +
          '<div class="cart-m__extra">' + explainLink() + eta(false, s) + '</div>' +
          status() +
        '</main>' +
        '<div class="m-spacer cart-m__spacer"></div>' +
        UI.mBar({ label: UI.mt('restart'), action: 'restart' }, { label: UI.mt('next'), action: 'next' }, { sticky: true }) +
      '</div>';
  }

  /* ---------------- desktop ---------------- */
  function tile(below) {
    if (addOpen) return '<div class="cart-tile is-open" id="add-form-wrap">' + addForm(true) + '</div>';
    return '<button type="button" class="cart-tile' + (below ? ' cart-tile--light' : '') + '" id="add-trigger">' +
      '<img class="cart-tile__ico" src="assets/icons/' + (below ? 'plus-circle-gray.svg' : 'plus-circle-white.svg') + '" width="43" height="43" alt="">' +
      '<span class="t-body cart-tile__label">დაამატე სხვა პროდუქტი</span></button>';
  }
  function renderD(st, s, below) {
    var t = s.totals;
    var prods = st.products.map(function (p) { return product(p, true, st); }).join('');
    return '' +
      '<div class="d-page">' + UI.dHead('/') +
        '<main class="container cart-d">' +
          '<h1 class="sr-only">კალათა</h1>' +
          '<div class="cart-d__grid">' +
            '<div class="cart-d__main">' + (below ? '' : tile(false)) + prods + (below ? tile(true) : '') + '</div>' +
            '<aside class="card cart-sum cart-sum--d" aria-labelledby="sum-h">' +
              '<div class="cart-sum__head">' +
                '<h2 class="t-h-total" id="sum-h">' + UI.mt('total') + '</h2>' +
                '<div class="cart-sum__right"><span class="t-body-16 cart-sum__mo-l">' + termLabel(t) + '</span><span class="t-price-lg cart-sum__mo">' + fmt.money(t.monthly) + '</span></div>' +
              '</div>' +
              '<p class="t-body-16 cart-sum__total">სულ  ' + fmt.money(t.total) + '</p>' + feeLine(s) +
              '<hr class="cart-sum__div">' +
              checks(st) +
              explainLink() +
              '<button type="button" class="btn cart-sum__btn" data-action="next"><span class="btn__label">' + UI.mt('next') + '</span></button>' +
              eta(true, s) +
            '</aside>' +
          '</div>' +
          status() +
        '</main>' +
      '</div>';
  }

  function render(ctx) {
    if (ctx.entry) { clearTimeout(addTimer); addTimer = null; addOpen = ctx.query.add === '1'; addBusy = false; addErr = null; }
    var st = ctx.state, s = summary(st);
    return ctx.desk ? renderD(st, s, ctx.query.addTile === 'below') : renderM(st, s);
  }

  /* ---------------- behaviour ---------------- */
  function mount(root, ctx) {
    var st = ctx.state;

    // a re-render while an add is pending (e.g. product removal) keeps the form locked
    if (addBusy) { var bi = root.querySelector('#add-url'); if (bi) bi.readOnly = true; }
    // a re-render (breakpoint change, product removal) keeps a shown validation error (R2-10)
    if (addErr) { var ei = root.querySelector('#add-url'); if (ei) UI.setError(ei, addErr.m); }

    root.addEventListener('change', function (e) {
      var patch = null;
      if (e.target.id === 'defer-weight') patch = { deferWeight: e.target.checked };
      if (e.target.id === 'defer-customs') patch = { deferCustoms: e.target.checked };
      if (!patch) return;
      // update prices in place: no re-render, so the open add form, focus and live region survive
      SP.set(patch);
      refreshPrices(root, ctx.desk);
    });

    root.addEventListener('click', function (e) {
      var tg = e.target.closest('[data-toggle]');
      if (tg) {
        var id = tg.getAttribute('data-toggle');
        var open = !st.ui.details[id];
        st.ui.details[id] = open; SP.save();
        tg.setAttribute('aria-expanded', String(open));
        var det = document.getElementById('bd-' + id);
        var art = tg.closest('.prod');
        var sync = function () {
          if (art) art.classList.toggle('is-open', !!st.ui.details[id]);
          var card = root.querySelector('.cart-m__card');
          var last = st.products[st.products.length - 1];
          if (card && last) card.classList.toggle('last-open', !!st.ui.details[last.id]);
        };
        if (!det) { sync(); return; }
        animateDetails(det, open, sync);
        return;
      }
      var rm = e.target.closest('[data-remove]');
      if (rm) {
        // a double-click would also hit the next product's ✕, which moves under the pointer after the re-render
        if (e.detail > 1 || Date.now() - rmLock < 300) return;
        rmLock = Date.now();
        var pid = rm.getAttribute('data-remove');
        var idx = st.products.findIndex(function (p) { return p.id === pid; });
        var name = idx >= 0 ? st.products[idx].name : '';
        SP.removeProduct(pid);
        if (!st.products.length) {   // no dead Back step via the guarded #/cart
          SP.go('/', { replace: true });
          UI.toast('პროდუქტი წაიშალა' + (name ? ': ' + name : ''));   // #toast-root is outside #app: it survives the route change
          return;
        }
        SP.rerender({ keepValues: true });
        var next = st.products[Math.min(idx, st.products.length - 1)];
        var f = next && document.getElementById('rm-' + next.id);
        if (f) f.focus();
        UI.toast('პროდუქტი წაიშალა' + (name ? ': ' + name : ''));
        return;
      }
      if (e.target.closest('#add-trigger')) { openAdd(true); return; }
      if (e.target.closest('[data-add-cancel]')) { closeAdd(); return; }
      var act = e.target.closest('[data-action]');
      if (act) {
        var a = act.getAttribute('data-action');
        if (a === 'restart') SP.reset();
        // a known (remembered) user signs in; a new one registers (R2-05)
        // v2: a signed-in user continues to the delivery step
        if (a === 'next') SP.go(SP.isAuthed() ? '/delivery' : (SP.api.remembered() ? '/login' : '/register'));
      }
    });

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && addOpen && !addBusy && e.target.closest('#add-form')) { e.preventDefault(); closeAdd(); }
    });

    root.addEventListener('submit', function (e) {
      if (e.target.id !== 'add-form') return;
      e.preventDefault();
      if (addBusy) return;
      var input = document.getElementById('add-url');
      var url = SP.valid.url(input.value);
      if (!url) { addErr = { v: input.value, m: SP.msg.url }; UI.setError(input, addErr.m); input.focus(); return; }
      addErr = null; UI.setError(input, '');
      addBusy = true;
      var btn = document.getElementById('add-submit');
      btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
      btn.insertAdjacentHTML('beforeend', UI.spinner());
      input.readOnly = true;
      e.target.setAttribute('aria-busy', 'true');
      addTimer = setTimeout(function () {
        addBusy = false; addOpen = false;
        var p = SP.addProduct(url);
        SP.rerender();
        var trig = document.getElementById('add-trigger'); if (trig) trig.focus();
        UI.toast('პროდუქტი დაემატა: ' + p.name);
      }, 800);
    });

    root.addEventListener('input', function (e) {
      if (e.target.id !== 'add-url') return;
      // restoreValues() after a keepValues re-render re-dispatches 'input' with the same value: keep the error then
      if (addErr && e.target.value === addErr.v) return;
      addErr = null; UI.setError(e.target, '');
    });

  }

  /** re-price every product row + the summary without re-rendering the screen */
  function refreshPrices(root, desk) {
    var st = SP.state(), s = summary(st), t = s.totals;
    st.products.forEach(function (p) {
      var art = root.querySelector('.prod[data-id="' + p.id + '"]'); if (!art) return;
      var tmp = document.createElement('div'); tmp.innerHTML = product(p, desk, st);
      var np = tmp.querySelector('.prod__price'), op = art.querySelector('.prod__price');
      if (np && op) op.replaceWith(np);
      var nb = tmp.querySelector('.bd'), ob = art.querySelector('.bd');
      if (nb && ob) ob.replaceWith(nb);
    });
    root.querySelectorAll('.cart-sum__mo').forEach(function (e) { e.textContent = fmt.money(t.monthly); });
    root.querySelectorAll('.cart-sum__total').forEach(function (e) {
      e.textContent = 'სულ  ' + fmt.money(t.total);
      // the fee row and the ETA follow the same summary, so they can never describe another delivery than 'სულ'
      var f = e.nextElementSibling && e.nextElementSibling.classList.contains('cart-sum__fee') ? e.nextElementSibling : null;
      if (s.fee > 0) { if (f) f.textContent = feeText(s); else e.insertAdjacentHTML('afterend', feeLine(s)); }
      else if (f) f.remove();
    });
    root.querySelectorAll('#cart-eta .eta-line__v').forEach(function (e) { e.textContent = s.etaText; });
    var live = root.querySelector('#cart-status');
    root.querySelectorAll('.cart-sum__mo-l').forEach(function (e) { e.textContent = termLabel(t); });
    if (live) live.textContent = 'ჯამი ' + fmt.money(t.total) + ', ' + termLabel(t) + ' ' + fmt.money(t.monthly);
  }

  /** expand/collapse a breakdown: height, margin and opacity ease together over --t-base, in sync with the caret (§3.13) */
  function animateDetails(det, open, sync) {
    if (SP.noAnim() || SP.reducedMotion() || typeof det.animate !== 'function') {
      if (det._anim) { det._anim.onfinish = null; det._anim.cancel(); det._anim = null; }
      det.style.overflow = ''; det.hidden = !open; sync(); return;
    }
    // measure with overflow hidden: it keeps the inner .bd's top margin inside the box, as it is while animating
    det.style.overflow = 'hidden';
    var cs = getComputedStyle(det);   // mid-animation (interrupted toggle) this reads the animated values
    var from = det.hidden ? { h: 0, mt: 0, o: 0 } : { h: det.getBoundingClientRect().height, mt: parseFloat(cs.marginTop) || 0, o: parseFloat(cs.opacity) };
    if (det._anim) { det._anim.onfinish = null; det._anim.cancel(); det._anim = null; }
    det.hidden = false;
    var to = open ? { h: det.getBoundingClientRect().height, mt: parseFloat(getComputedStyle(det).marginTop) || 0, o: 1 } : { h: 0, mt: 0, o: 0 };
    var root = getComputedStyle(document.documentElement);
    var dur = SP.cssMs('--t-base', 200) || 200;   // the token may be in s or ms, like the caret's CSS transition
    var ease = root.getPropertyValue('--ease').trim() || 'ease';
    sync();   // the card's open/closed padding transitions alongside (cart.css)
    var a = det._anim = det.animate([
      { height: from.h + 'px', marginTop: from.mt + 'px', opacity: from.o },
      { height: to.h + 'px', marginTop: to.mt + 'px', opacity: to.o }
    ], { duration: dur, easing: ease });
    a.onfinish = function () {
      det._anim = null; det.style.overflow = '';
      if (!open) det.hidden = true;
    };
  }

  function openAdd(focus) {
    if (addOpen) { closeAdd(); return; }
    addOpen = true; SP.rerender();
    if (focus) { var i = document.getElementById('add-url'); if (i) i.focus(); }
  }
  function closeAdd() {
    addOpen = false; addBusy = false; addErr = null; clearTimeout(addTimer);
    SP.rerender();
    var t = document.getElementById('add-trigger'); if (t) t.focus();
  }

  SP.route('/cart', { screen: 'cart', title: 'კალათა', responsive: true, render: render, mount: mount, unmount: function () {
    // a same-route re-render (remove product, breakpoint change) must not cancel a pending add
    if (SP.parseHash().path !== '/cart') { clearTimeout(addTimer); addTimer = null; addBusy = false; }
  } });
})();

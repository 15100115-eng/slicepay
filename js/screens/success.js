/* =====================================================================
   SlicePay — screens/success.js   route: #/success
   Shows the order snapshot (state.order). QA: ?demo=1&date=YYYY-MM-DD&order=NNNNNN
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, esc = SP.esc, fmt = SP.fmt;

  function render(ctx) {
    var o = ctx.state.order;
    var st = { products: o.products, deferWeight: o.deferWeight, deferCustoms: o.deferCustoms };
    var t = SP.totals(st);
    var m = UI.method(o.method);
    // notes per product: no deferral note for a part that is 0 for this product
    var lastNotes = '';  // method-heading gap depends on whether the last item ends with a note
    var items = o.products.map(function (p) {
      var pr = SP.price(p, st);
      var notes = (o.deferWeight && p.weight > 0 ? '<p class="item__note">წონის გარეშე</p>' : '') +
                  (o.deferCustoms && p.customs > 0 ? '<p class="item__note">განბაჟების გარეშე</p>' : '');
      lastNotes = notes;
      return '<li class="item">' +
        '<div class="item__row">' +
          '<span class="item__name t-body" title="' + esc(p.name) + '">' + esc(p.name) + '</span>' +
          '<span class="item__sp"></span>' +
          '<span class="item__qty t-latin">' + (p.qty || 1) + 'x</span>' +
          '<span class="item__price t-price-item">' + fmt.moneySp(pr.payable) + '</span>' +
        '</div>' + notes + '</li>';
    }).join('');
    return '' +
      '<div class="m-page success-page">' + UI.dHead(null) +
        '<main class="success">' +
          '<section class="receipt' + (lastNotes ? '' : ' no-notes') + '" aria-labelledby="success-h">' +
            '<div class="receipt__head">' +
              '<img class="receipt__badge only-m" src="assets/icons/success-check-sm.svg" width="70" height="70" alt="">' +
              '<img class="receipt__badge only-d" src="assets/icons/success-check.svg" width="75" height="75" alt="">' +
              '<div class="receipt__hcol">' +
                '<h1 class="t-h-caps receipt__title" id="success-h" tabindex="-1" data-autofocus>' + UI.mt('received') + '</h1>' +
                '<p class="receipt__date"><span class="pill t-body">' + esc(fmt.date(o.date)) + '</span></p>' +
                '<p class="receipt__id t-body"><span class="muted t-latin" lang="en">order ID:</span>   <span class="t-latin">#' + esc(o.id) + '</span></p>' +
              '</div>' +
            '</div>' +
            '<h2 class="t-h-caps receipt__h">' + UI.mt('yourOrder') + '</h2>' +
            '<ul class="receipt__items">' + items + '</ul>' +
            '<h2 class="t-h-caps receipt__h receipt__h--method">' + UI.mt('payMethod') + '</h2>' +
            '<p class="receipt__method t-body"><span class="muted">' + m.bank + '</span>' + m.plan + '</p>' +
          '</section>' +
          '<section class="ssum" aria-labelledby="ssum-h">' +
            '<h2 class="t-h-caps-reg ssum__h" id="ssum-h">' + UI.mt('summary') + '</h2>' +
            '<div class="ssum__row ssum__row--1 t-body-16"><span>თვეში</span><span class="t-latin muted">4x</span><span class="ssum__v">' + fmt.money(t.monthly) + '</span></div>' +
            '<hr class="ssum__div">' +
            '<div class="ssum__row ssum__row--2 t-body-20"><span>სულ</span><span></span><span class="ssum__v">' + fmt.money(t.total) + '</span></div>' +
          '</section>' +
          '<button type="button" class="btn success__home" data-action="home"><span class="btn__label">' + UI.mt('home') + '</span></button>' +
        '</main>' +
      '</div>';
  }

  function mount(root) {
    // every row is its own flex line: give all prices the widest price's width so the 'Nx' column lines up
    // (re-measured once the web font is in, since the first measure may use the fallback face)
    function alignPrices() {
      var ps = root.querySelectorAll('.item__price'), w = 0;
      if (ps.length < 2 || !root.isConnected) return;
      ps.forEach(function (e) { e.style.minWidth = ''; });
      ps.forEach(function (e) { w = Math.max(w, e.getBoundingClientRect().width); });
      ps.forEach(function (e) { e.style.minWidth = w + 'px'; });
    }
    alignPrices();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(alignPrices);
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-action="home"]')) SP.reset();
    });
  }

  SP.route('/success', { screen: 'success', title: 'შეკვეთა მიღებულია', render: render, mount: mount });
})();

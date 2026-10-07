/* =====================================================================
   SlicePay — screens/success.js   route: #/success
   Shows the order snapshot (state.order). QA: ?demo=1&date=YYYY-MM-DD&order=NNNNNN [&delivery=courier] [&term=6]
   v2: delivery section + ETA in the receipt, term-aware summary, my-orders button
   v3 (LSQA-R3-01): a delivery fee (> 0) is a labelled line of the receipt's delivery section ('მიწოდების ფასი … 5 ₾'),
   not an extra summary row, so both CTAs stay above the fold at 1440x1024 for courier orders; სულ / თვეში include it
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, esc = SP.esc, fmt = SP.fmt;

  /** 'ფილიალიდან გატანა: ვაკის ფილიალი' → secondary-grey prefix + value (all parts escaped).
      v2 text: prefix uses #666 (receipt__dk), not the designed #9e9e9e of the method line (REV2R2-03) */
  function splitLine(text, keep) {
    var i = text.indexOf(': ');
    if (i < 0) return esc(text);
    var v = esc(text.slice(i + 2));
    return '<span class="receipt__dk">' + esc(text.slice(0, i + 2)) + '</span>' + (keep ? '<span class="receipt__dv">' + v + '</span>' : v);
  }
  /** v2 receipt section after the payment method: delivery method/place + ETA (FEATURES_SPEC "Success screen additions").
      v3 (LSQA-R3-01 + the spec's visible 'მიწოდების ფასი' row): a fee > 0 is its own labelled line under the method
      line — label left, amount in the item-price column and format ('5 ₾', as '600 ₾' above) — so the summary's
      სულ / თვეში (which include it) are explained on screen. No fee → v2 markup (d17/m17) */
  function deliverySection(o, fee) {
    if (!o.delivery) return '';
    var label = SP.deliveryLabel(o.delivery);
    var arr = SP.orderArrival(o), eta = arr.value ? arr.label + ': ' + arr.value : '';
    if (!label && !eta) return '';
    return '<h2 class="t-h-caps receipt__h receipt__h--delivery">' + UI.mt('delivery') + '</h2>' +
      (label ? '<p class="receipt__dline receipt__dline--1 t-body">' + splitLine(label) + '</p>' : '') +
      (fee > 0 ? '<p class="receipt__fee"><span class="receipt__fee-l t-body">მიწოდების ფასი</span>' +
        '<span class="receipt__dfee t-price-item">' + fmt.moneySp(fee) + '</span></p>' : '') +
      (eta ? '<p class="receipt__dline receipt__dline--eta t-body">' + splitLine(eta, true) + '</p>' : '');
  }

  function render(ctx) {
    var o = ctx.state.order;
    var st = { products: o.products, deferWeight: o.deferWeight, deferCustoms: o.deferCustoms };
    // v3: the order's own snapshot through the shared summary helper (v2f-r3-02), the same numbers the orders screen
    // shows; totals honour o.term and o.deliveryFee (demo parity stays 4x 150₾ / 600₾)
    var sum = SP.checkoutSummary(o), t = sum.totals, fee = +sum.fee || 0;
    var m = UI.method(o.method);
    // notes per product: no deferral note for a part that is 0 for this product
    var lastNotes = '';  // method-heading gap depends on whether the last item ends with a note
    var items = o.products.map(function (p) {
      var pr = SP.price(p, st);
      var notes = SP.itemNotes(p, o).map(function (n) { return '<p class="item__note">' + n + '</p>'; }).join('');
      lastNotes = notes;
      return '<li class="item">' +
        '<div class="item__row">' +
          '<span class="item__name t-body" title="' + esc(p.name) + '">' + esc(p.name) + '</span>' +
          '<span class="item__sp"></span>' +
          '<span class="item__qty t-latin">' + SP.qty(p) + 'x</span>' +
          '<span class="item__price t-price-item">' + fmt.moneySp(pr.payable) + '</span>' +
        '</div>' + notes + '</li>';
    }).join('');
    return '' +
      '<div class="m-page success-page">' + UI.dHead(null) +
        '<main class="success' + (fee > 0 ? ' success--fee' : '') + '">' +
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
            deliverySection(o, fee) +
          '</section>' +
          '<section class="ssum" aria-labelledby="ssum-h">' +
            '<h2 class="t-h-caps-reg ssum__h" id="ssum-h">' + UI.mt('summary') + '</h2>' +
            '<div class="ssum__row ssum__row--1 t-body-16"><span>თვეში</span><span class="t-latin muted">' + esc(String(t.term)) + 'x</span><span class="ssum__v">' + fmt.money(t.monthly) + '</span></div>' +
            '<hr class="ssum__div">' +
            '<div class="ssum__row ssum__row--2 t-body-20"><span>სულ</span><span></span><span class="ssum__v">' + fmt.money(t.total) + '</span></div>' +
          '</section>' +
          '<div class="success__actions">' +
            '<button type="button" class="btn btn--secondary success__orders" data-action="orders"><span class="btn__label">' + UI.mt('myOrders') + '</span></button>' +
            '<button type="button" class="btn success__home" data-action="home"><span class="btn__label">' + UI.mt('home') + '</span></button>' +
          '</div>' +
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
      else if (e.target.closest('[data-action="orders"]')) SP.go('/orders');
    });
  }

  SP.route('/success', { screen: 'success', title: 'შეკვეთა მიღებულია', render: render, mount: mount });
})();

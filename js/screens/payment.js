/* =====================================================================
   SlicePay — screens/payment.js   route: #/payment
   QA: ?demo=1 &method=bog|tbc|mere &details=0|1 &weight=0|1 &customs=0|1
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, fmt = SP.fmt;

  /* Mtavruli (U+1C90-1CBF) -> Mkhedruli (U+10D0-10FF) twin for AT, same convention as UI.mt() */
  function mk(s) {
    return s.replace(/[\u1C90-\u1CBA\u1CBD-\u1CBF]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x1C90 + 0x10D0); });
  }

  /* the group is named once, by aria-label (no legend: it was read as a second static-text copy) */
  function methods(st, desk) {
    return '<fieldset class="methods" role="radiogroup" aria-label="გადახდის მეთოდი">' +
      UI.METHODS.map(function (m) {
        var on = st.method === m.id;
        return '<label class="method' + (on ? ' is-selected' : '') + '" data-method="' + m.id + '">' +
          '<input class="sr-only" type="radio" name="method" id="method-' + m.id + '" value="' + m.id + '"' + (on ? ' checked' : '') + '>' +
          '<span class="method__radio" aria-hidden="true"></span>' +
          '<img class="method__logo" src="' + m.img + '" width="81" height="50" alt="">' +
          '<span class="method__text">' +
            '<span class="method__title t-btn"><span aria-hidden="true">' + m.t1 + (desk ? '<br>' : ' ') + m.t2 + '</span>' +
              '<span class="sr-only">' + mk(m.t1 + ' ' + m.t2) + '</span></span>' +
            '<span class="method__sub t-body">' + m.s1 + '<br>' + m.s2 + '</span>' +
          '</span>' +
        '</label>';
      }).join('') +
      '</fieldset>';
  }
  function notes(t) {
    var items = [];
    // only list a deferral when there is something to defer (matches UI.breakdown and success.js)
    if (t.deferWeight && t.weight > 0) items.push(UI.DEFER_WEIGHT);
    if (t.deferCustoms && t.customs > 0) items.push(UI.DEFER_CUSTOMS);
    if (!items.length) return '';
    return '<ul class="notes pay-notes">' + items.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul>';
  }

  function render(ctx) {
    var st = ctx.state, t = SP.totals(st), open = !!st.ui.payDetails;
    var bd = UI.breakdown(t, 'label-first', { id: 'pay-bd', cls: 'pay-bd', hidden: !open });
    var total = '<span class="t-price-xl pay-total">' + fmt.money(t.total) + '</span>';
    var toggle = UI.toggle('pay-bd', open, 'id="pay-toggle"');
    if (!ctx.desk) {
      return '' +
        '<div class="m-page pay-m">' +
          '<main class="pay-m__content">' +
            '<h1 class="sr-only">გადახდის მეთოდი</h1>' +
            '<div class="pay-head"><h2 class="t-h-total">' + UI.mt('total') + '</h2>' + total + '</div>' +
            '<div class="pay-toggle-row">' + toggle + '</div>' +
            bd +
            methods(st, false) +
            notes(t) +
          '</main>' +
          '<div class="m-spacer pay-m__spacer"></div>' +
          UI.mBar({ label: UI.mt('back'), back: '/cart' }, { label: UI.mt('next'), action: 'next' }) +
        '</div>';
    }
    var n = notes(t);
    return '' +
      '<div class="d-page">' + UI.dHead('/cart') +
        '<main class="container pay-d">' +
          '<h1 class="sr-only">გადახდის მეთოდი</h1>' +
          '<div class="pay-d__grid">' +
            '<div class="pay-d__main">' + methods(st, true) + '</div>' +
            '<aside class="card pay-sum' + (open ? ' is-open' : '') + (n ? '' : ' no-notes') + '" aria-labelledby="pay-sum-h">' +
              '<div class="pay-head"><h2 class="t-h-total" id="pay-sum-h">' + UI.mt('total') + '</h2>' + total + '</div>' +
              '<div class="pay-toggle-row">' + toggle + '</div>' +
              bd +
              (n ? '<hr class="pay-sum__div">' + n : '') +
              '<button type="button" class="btn pay-sum__btn" data-action="next"><span class="btn__label">' + UI.mt('next') + '</span></button>' +
            '</aside>' +
          '</div>' +
        '</main>' +
      '</div>';
  }

  function mount(root, ctx) {
    var st = ctx.state;
    root.addEventListener('change', function (e) {
      if (e.target.name !== 'method') return;
      st.method = e.target.value; SP.save();
      root.querySelectorAll('.method').forEach(function (l) { l.classList.toggle('is-selected', l.getAttribute('data-method') === st.method); });
    });
    root.addEventListener('click', function (e) {
      if (e.target.closest('#pay-toggle')) {
        var open = !st.ui.payDetails; st.ui.payDetails = open; SP.save();
        var tg = root.querySelector('#pay-toggle'); tg.setAttribute('aria-expanded', String(open));
        var bd = root.querySelector('#pay-bd'), sum = root.querySelector('.pay-sum');
        var sync = function () { if (sum) sum.classList.toggle('is-open', !!st.ui.payDetails); };
        clearTimeout(bd._leaveT);
        bd.classList.remove('is-entering', 'is-leaving');
        if (open) {
          bd.hidden = false; void bd.offsetWidth; bd.classList.add('is-entering'); sync();
        } else if (SP.noAnim() || SP.reducedMotion()) {
          bd.hidden = true; sync();
        } else {
          // collapse: 200ms fade/slide out in sync with the caret (§3.13, as in the cart), then hide;
          // desktop .is-open (divider/button spacing) only drops once the panel is gone
          var onEnd = function (ev) { if (ev.target === bd) done(); };
          var done = function () {
            clearTimeout(bd._leaveT); bd.removeEventListener('animationend', onEnd);
            if (!bd.classList.contains('is-leaving')) return;
            bd.classList.remove('is-leaving'); bd.hidden = true; sync();
          };
          bd.addEventListener('animationend', onEnd);
          bd._leaveT = setTimeout(done, 400);
          bd.classList.add('is-leaving');
        }
        return;
      }
      if (e.target.closest('[data-action="next"]')) SP.go('/pay');
    });
  }

  SP.route('/payment', { screen: 'payment', title: 'გადახდის მეთოდი', responsive: true, render: render, mount: mount });
})();

/* =====================================================================
   SlicePay — screens/payment.js   route: #/payment
   QA: ?demo=1 &method=bog|tbc|mere &details=0|1 &weight=0|1 &customs=0|1
       v2: &term=N &delivery=courier|pickup &info=weight|customs|all
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
            '<span class="method__title t-btn"><span aria-hidden="true">' + m.t1 + (desk ? ' <br>' : ' ') + m.t2 + '</span>' +
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

  /* v2 §7: monthly amount for the chosen term, shown at the left of the "ფასი დეტალურად" row (no designed
     element moves). Order follows the cart summary: mobile [amount, label], desktop [label, amount]. */
  function monthly(t, desk) {
    var v = '<span class="pay-mo__v">' + fmt.money(t.monthly) + '</span>',
        l = '<span class="pay-mo__l">' + UI.termLabel(t.term) + '</span>';
    return '<p class="pay-mo" id="pay-mo">' + (desk ? l + v : v + l) + '</p>';
  }
  /* ETA with the truck icon, as in the cart summary (desktop: centred under the button; mobile: icon in the
     card gutter, text on the bullet-notes text column) */
  function eta(desk) {
    return UI.etaRow(SP.eta(), { cls: 'pay-eta-row', lineCls: 'pay-eta', id: 'pay-eta', centred: desk });
  }
  /* polite live region: announces a term/monthly change caused by switching the method (REV2-06) */
  var LIVE = '<p class="sr-only" id="pay-live" role="status" aria-live="polite" aria-atomic="true"></p>';
  function terms(st, t) {
    return UI.termChips({ method: st.method, term: t.term, total: t.total, id: 'terms' });
  }

  function render(ctx) {
    var st = ctx.state, t = SP.totals(st), open = !!st.ui.payDetails;
    // a 6th row (მიწოდების ფასი) needs a taller details box than the designed 5-row 150px
    var bd = UI.breakdown(t, 'label-first', { id: 'pay-bd', cls: 'pay-bd' + (t.delivery > 0 ? ' pay-bd--fee' : ''), hidden: !open });
    var total = '<span class="t-price-xl pay-total">' + fmt.money(t.total) + '</span>';
    var toggle = UI.toggle('pay-bd', open, 'id="pay-toggle"');
    if (!ctx.desk) {
      return '' +
        '<div class="m-page pay-m">' +
          '<main class="pay-m__content">' +
            '<h1 class="sr-only">გადახდის მეთოდი</h1>' +
            '<div class="pay-head"><h2 class="t-h-total">' + UI.mt('total') + '</h2>' + total + '</div>' +
            '<div class="pay-toggle-row">' + monthly(t, false) + toggle + '</div>' +
            bd +
            methods(st, false) +
            terms(st, t) +
            notes(t) +
            eta(false) +
            LIVE +
          '</main>' +
          '<div class="m-spacer pay-m__spacer"></div>' +
          UI.mBar({ label: UI.mt('back'), back: '/delivery' }, { label: UI.mt('next'), action: 'next' }, { sticky: true }) +
        '</div>';
    }
    var n = notes(t);
    return '' +
      '<div class="d-page">' + UI.dHead('/delivery') +
        '<main class="container pay-d">' +
          '<h1 class="sr-only">გადახდის მეთოდი</h1>' +
          '<div class="pay-d__grid">' +
            '<div class="pay-d__main">' + methods(st, true) + terms(st, t) + LIVE + '</div>' +
            '<aside class="card pay-sum' + (open ? ' is-open' : '') + (n ? '' : ' no-notes') + '" aria-labelledby="pay-sum-h">' +
              '<div class="pay-head"><h2 class="t-h-total" id="pay-sum-h">' + UI.mt('total') + '</h2>' + total + '</div>' +
              '<div class="pay-toggle-row">' + monthly(t, true) + toggle + '</div>' +
              bd +
              (n ? '<hr class="pay-sum__div">' + n : '') +
              '<button type="button" class="btn pay-sum__btn" data-action="next"><span class="btn__label">' + UI.mt('next') + '</span></button>' +
              eta(true) +
            '</aside>' +
          '</div>' +
        '</main>' +
      '</div>';
  }

  function mount(root, ctx) {
    var st = ctx.state;
    function syncMonthly() {
      var t = SP.totals(), mo = root.querySelector('#pay-mo');
      if (!mo) return;
      mo.querySelector('.pay-mo__v').textContent = fmt.money(t.monthly);
      mo.querySelector('.pay-mo__l').textContent = UI.termLabel(t.term);
    }
    root.addEventListener('change', function (e) {
      if (e.target.name !== 'method') return;
      var prev = st.term;
      SP.setMethod(e.target.value);   // re-fits the term to the method (keeps it, else the nearest)
      root.querySelectorAll('.method').forEach(function (l) { l.classList.toggle('is-selected', l.getAttribute('data-method') === st.method); });
      // the chip set depends on the method: re-render the block (the change listener below is delegated on root)
      var tb = root.querySelector('#terms');
      if (tb) tb.outerHTML = terms(st, SP.totals());
      if (st.term !== prev) {
        syncMonthly();
        // the radio only voices the new method: say that the term (and so the monthly amount) changed too
        var t = SP.totals(), live = root.querySelector('#pay-live');
        if (live) {
          live.textContent = '';
          setTimeout(function () { live.textContent = 'განვადების ვადა: ' + t.term + ' თვე, ' + fmt.money(t.monthly) + ' / თვე'; }, 50);
        }
      }
    });
    UI.bindTermChips(root, syncMonthly);
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

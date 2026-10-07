/* =====================================================================
   SlicePay — screens/orders.js   routes: #/orders  #/orders/:id
   My orders (docs/specs/FEATURES_SPEC.md §4, docs/INTEGRATION.md §5 E6 + "v4 changes").
   List: cards (id · date, status pill, products, totals, ETA, due badge),
   empty state, link to the profile (v4). Detail: status timeline, remaining deferred
   amounts (+ pay → #/pay?order=<id>), products, delivery (masked ID),
   payment with the instalment schedule.
   QA: #/orders?demo=1  #/orders/731954?demo=1  #/orders?demo=1&empty=1
       #/orders/548210?demo=1 (delivered, everything paid)
   Status: 7-step timeline from 'მუშავდება' (processing, v4); legacy stored orders are normalised in core.
   ===================================================================== */
(function () {
  'use strict';
  var SP = window.SlicePay, UI = SP.ui, esc = SP.esc, fmt = SP.fmt;

  /* ---------------- shared bits ---------------- */
  /** 'სულ 600₾ · 150₾ × 4 თვე' */
  function totalsLine(o) {
    var term = +o.term || 4;
    return 'სულ ' + fmt.money(o.total) + ' · ' + fmt.money(o.monthly || SP.monthly(o.total, term)) + ' × ' + term + ' თვე';
  }
  /** the 'ჩემი შეკვეთები' thumbnail: first product's picture, badge = that product's own quantity
      (as in the cart); the '+N' after the name tells there are more products */
  function orderThumb(o) { return UI.thumb(o.products[0] || {}); }
  function caret() { return UI.icon('caret-down', 'ord-card__chev'); }

  /* ---------------- list ---------------- */
  function card(o) {
    var due = SP.orderDue(o).total;
    var first = o.products[0], more = o.products.length - 1;
    return '<li class="card ord-card' + (due > 0 ? ' is-due' : '') + '">' +
      '<div class="ord-card__top">' +
        '<h2 class="ord-card__h">' +
          '<a class="ord-card__link" href="#/orders/' + esc(o.id) + '" data-order="' + esc(o.id) + '">' +
            '<span class="sr-only">შეკვეთა </span><span class="ord-card__id">#' + esc(o.id) + '</span>' +
            '<span class="ord-card__date"><span aria-hidden="true"> · </span><span class="sr-only">, </span>' + esc(fmt.date(o.date)) + '</span>' +
          '</a>' +
        '</h2>' +
        UI.statusPill(o) +
      '</div>' +
      '<div class="ord-card__body">' +
        orderThumb(o) +
        '<div class="ord-card__info">' +
          '<p class="ord-card__names t-body"><span class="ord-card__name">' + esc(first ? first.name : '') + '</span>' +
            (more > 0 ? '<span class="ord-card__more">+' + more + '</span>' : '') + '</p>' +
          '<p class="ord-card__sum t-body-16">' + esc(totalsLine(o)) + '</p>' +
          // the shared arrival line (ETA or 'ჩაბარდა: …'); it glues each day to its month, so a cross-month window
          // that has to wrap on a narrow phone breaks only after the dash (REV2R3-03: one implementation, in ui.js)
          UI.orderEtaLine(o, { cls: 'ord-card__eta' }) +
          (due > 0 ? '<p class="ord-due-badge">' + SP.DUE_LABEL + ': ' + fmt.money(due) + '</p>' : '') +
        '</div>' +
        caret() +
      '</div>' +
    '</li>';
  }

  function empty() {
    return '<div class="ord-empty">' +
      '<span class="ord-empty__ico" aria-hidden="true">' + UI.icon('truck') + '</span>' +
      '<p class="ord-empty__t t-body-16">ჯერ არ გაქვთ შეკვეთები</p>' +
      // mobile has the same action in the bottom bar
      '<button type="button" class="btn ord-empty__btn only-d" data-action="new"><span class="btn__label">' + UI.mt('newOrder') + '</span></button>' +
    '</div>';
  }

  function renderList() {
    var list = SP.orders.list();
    return '' +
      '<div class="m-page ord-page">' + UI.dHead('/', { current: 'orders', backAny: true }) +   // v4 §B: both account links; ჩემი შეკვეთები marked current (as the profile marks itself)
        '<main class="ord">' +
          '<div class="ord-top">' +
            '<h1 class="t-h1 ord-top__h">ჩემი შეკვეთები</h1>' +
            // v4: logout moved to the profile page; the list heading links there instead (V4_SPEC §B entry points)
            '<a class="link t-body ord-top__out only-m" href="#/profile" data-acct="profile">' + UI.PROFILE_LABEL + '</a>' +
          '</div>' +
          (list.length ? '<ul class="ord-list" role="list">' + list.map(card).join('') + '</ul>' : empty()) +
        '</main>' +
        '<div class="m-spacer ord-spacer only-m"></div>' +
        '<div class="only-m">' + UI.mBar({ label: UI.mt('back'), back: '/', any: true }, { label: UI.mt('newOrder'), action: 'new' }) + '</div>' +
      '</div>';
  }

  /* ---------------- detail ---------------- */
  function section(key, title, inner, cls) {
    return '<section class="card ord-sec' + (cls ? ' ' + cls : '') + '" aria-labelledby="os-' + key + '">' +
      '<h2 class="t-h-caps ord-sec__h" id="os-' + key + '">' + UI.mtx(title) + '</h2>' + inner + '</section>';
  }
  function kv(label, value, cls) {
    return '<div class="ord-kv__row' + (cls ? ' ' + cls : '') + '"><dt>' + esc(label) + ':</dt><dd>' + value + '</dd></div>';
  }

  /** one deferred / prepaid part row: label (+ info) and its state */
  function partRow(key, label, r, o) {
    var v, state = r.paid ? ' is-paid' : r.pending ? ' is-pending' : '';   // (is-pending: a QA hook)
    if (r.paid) {
      v = '<span class="ord-part__amt">' + fmt.money(r.actual != null ? r.actual : r.est) + '</span>' +
          '<span class="ord-part__paid">' + UI.icon('check', 'ord-part__ok') + 'გადახდილია</span>';
    } else if (r.pending) {
      // still an estimate: muted like the estimate of a known-actual row, only the note explains it
      v = '<span class="ord-part__est">დაახ. ' + fmt.money(r.est) + '</span>' +
          '<span class="ord-part__note">განისაზღვრება ამანათის ჩამოსვლისას</span>';
    } else {
      v = '<span class="ord-part__est">დაახ. ' + fmt.money(r.est) + '</span>' +
          '<span class="ord-part__arrow" aria-hidden="true">→</span>' +
          '<span class="ord-part__act">ფაქტობრივი ' + fmt.money(r.actual) + '</span>' +
          // prepaid estimate turned out higher than the actual amount: the difference goes back
          (r.refund > 0 ? '<span class="ord-part__note ord-part__note--refund">სხვაობა ' + fmt.money(r.refund) + ' დაგიბრუნდებათ</span>' : '') +
          // prepaid estimate turned out lower: only the difference is due (what this row adds to the total)
          (r.prepaid && r.due > 0 ? '<span class="ord-part__note ord-part__note--due">სხვაობა ' + fmt.money(r.due) + ' გადასახდელია</span>' : '');
    }
    return '<li class="ord-part' + state + '">' +
      // the info buttons share the name 'როგორ ითვლება?': the visible label tells them apart (as UI.breakdown does)
      '<span class="ord-part__l"><span id="odl-' + key + '">' + label + '</span>' + UI.infoBtn(key, null, o.id, 'odl-' + key) + '</span>' +
      '<span class="ord-part__v">' + v + '</span></li>';
  }
  function dueSection(o) {
    var d = SP.orderDue(o);
    var rows = [];
    // deferred parts always; prepaid ones once their actual amount differs from the estimate
    // (difference due / paid, or refunded)
    function want(part, r) { return r && ((part && !part.prepaid) || r.due > 0 || r.refund > 0 || (r.paid && r.actual > r.est)); }
    var df = o.deferred || {};
    if (want(df.weight, d.weight)) rows.push(partRow('weight', 'წონის საფასური', d.weight, o));
    if (want(df.customs, d.customs)) rows.push(partRow('customs', 'განბაჟება', d.customs, o));
    if (!rows.length) return '';
    var foot = d.total > 0
      ? '<div class="ord-due__total"><span>გადასახდელი:</span><span class="ord-due__sum">' + fmt.money(d.total) + '</span></div>' +
        '<button type="button" class="btn ord-due__btn" data-action="pay"><span class="btn__label">' + UI.mt('pay') + '</span></button>'
      : '';
    return section('due', 'დარჩენილი გადასახდელი',
      '<ul class="ord-parts" role="list">' + rows.join('') + '</ul>' + foot, 'ord-sec--due' + (d.total > 0 ? ' is-due' : ''));
  }

  function productsSection(o) {
    var st = { products: o.products, deferWeight: o.deferWeight, deferCustoms: o.deferCustoms };
    var rows = o.products.map(function (p) {
      var pr = SP.price(p, st);
      var notes = SP.itemNotes(p, o).map(function (n) { return '<span class="ord-prod__note">' + n + '</span>'; }).join('');
      return '<li class="ord-prod">' + UI.thumb(p) +
        '<span class="ord-prod__info"><span class="ord-prod__name t-body" title="' + esc(p.name) + '">' + esc(p.name) + '</span>' + notes + '</span>' +
        '<span class="ord-prod__qty t-latin">' + SP.qty(p) + 'x</span>' +
        '<span class="ord-prod__price">' + fmt.moneySp(pr.payable) + '</span></li>';
    }).join('');
    return section('prod', 'პროდუქტები', '<ul class="ord-prods" role="list">' + rows + '</ul>');
  }

  function deliverySection(o) {
    var d = o.delivery || {};
    var sub = d.method === 'courier' ? d.note : (d.branchAddr || (SP.branch(d.branchId) || {}).addr);
    var arr = SP.orderArrival(o), when = kv(arr.label, esc(arr.value));
    return section('del', 'მიწოდება',
      '<p class="ord-del__main">' + esc(SP.deliveryLabel(d)) + '</p>' +
      (sub ? '<p class="ord-del__sub">' + esc(sub) + '</p>' : '') +
      '<dl class="ord-kv">' +
        (d.recipient ? kv('მიმღები', esc(d.recipient)) : '') +
        (d.pidMasked ? kv('პირადი ნომერი', '<span class="ord-kv__pid">' + esc(d.pidMasked) + '</span>') : '') +
        when +
      '</dl>');
  }

  function paymentSection(o) {
    var m = UI.method(o.method), term = +o.term || 4;
    var sched = SP.orderSchedule(o).map(function (s) {
      return '<li class="ord-sched__row"><span class="ord-sched__l"><span class="ord-sched__n">' + esc(s.label) + '</span>' +
        '<span class="ord-sched__sep" aria-hidden="true"> · </span><span class="sr-only">, </span>' +
        '<span class="ord-sched__d">' + esc(fmt.date(s.date)) + '</span></span>' +
        '<span class="ord-sched__a">' + fmt.money(s.amount) + '</span></li>';
    }).join('');
    return section('pay', 'გადახდა',
      '<p class="ord-pay__method"><span class="ord-muted">' + m.bank + '</span>' + m.plan + '</p>' +
      '<dl class="ord-kv">' +
        kv('ვადა', term + ' თვე') +
        (o.deliveryFee > 0 ? kv('მიწოდების ფასი', fmt.money(o.deliveryFee)) : '') +
        kv('სულ', fmt.money(o.total)) +
      '</dl>' +
      '<ol class="ord-sched" aria-label="შენატანები">' + sched + '</ol>');
  }

  function renderDetail(ctx) {
    var o = SP.orders.get(ctx.params.id);
    if (!o) return '<div class="m-page ord-page"></div>';   // the guard sends unknown ids to the list
    // 'დარჩენილი გადასახდელი' leads only while money is (or may still be) due; once settled it goes last
    var d = SP.orderDue(o), dueFirst = d.total > 0 || d.pending, due = dueSection(o);
    return '' +
      '<div class="m-page ord-page ord-page--detail">' + UI.dHead('/orders') +   // v4 §B: the same signed-in inner header as every other screen (პროფილი · ჩემი შეკვეთები, neither current)
        '<main class="ord">' +
          '<div class="ord-top ord-top--detail">' +
            '<h1 class="t-h1 ord-top__h">შეკვეთა #' + esc(o.id) + '</h1>' +
            UI.statusPill(o) +
            '<p class="ord-top__date t-body">' + esc(fmt.date(o.date)) + '</p>' +
          '</div>' +
          '<div class="ord-secs">' +
            '<section class="card ord-sec ord-sec--tl" aria-labelledby="os-tl"><h2 class="sr-only" id="os-tl">სტატუსი</h2>' + UI.timeline(o, { labelledby: 'os-tl' }) + '</section>' +
            (dueFirst ? due : '') +
            productsSection(o) +
            deliverySection(o) +
            paymentSection(o) +
            (dueFirst ? '' : due) +
          '</div>' +
        '</main>' +
        '<div class="m-spacer ord-spacer only-m"></div>' +
        '<div class="only-m">' + UI.mBar({ label: UI.mt('back'), back: '/orders' }, null) + '</div>' +
      '</div>';
  }

  /* ---------------- behaviour ---------------- */
  /** phones: the detail toast sits 10 px under the heading row (orders.css, --ord-toast-top). At 320–374 a long status
      pill ('მზადაა გასატანად' after a payment) wraps under the title, so the row's bottom is measured, not assumed:
      the toast then lands on the date line below the pill instead of on the pill (v3, from auth-v2r3-01) */
  function placeToast() {
    var top = document.querySelector('#app .ord-top--detail');
    if (!top) return;
    var y = 0;
    [top.querySelector('.ord-top__h'), top.querySelector('.status-pill')].forEach(function (e) {
      if (e) y = Math.max(y, e.getBoundingClientRect().bottom + (window.scrollY || 0));
    });
    if (y) document.body.style.setProperty('--ord-toast-top', Math.round(y + 10) + 'px');
  }
  var placeBound = false;
  function mount(root, ctx) {
    if (ctx.params && ctx.params.id) {
      placeToast();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeToast);
      if (!placeBound) { placeBound = true; window.addEventListener('resize', placeToast); }
    }
    root.addEventListener('click', function (e) {
      var a = e.target.closest('[data-action]');
      if (!a || !root.contains(a)) return;
      var act = a.getAttribute('data-action');
      if (act === 'new') SP.go('/');
      else if (act === 'pay' && ctx.params && ctx.params.id) SP.go('/pay?order=' + encodeURIComponent(ctx.params.id));
    });
  }

  SP.route('/orders', { screen: 'orders', title: 'ჩემი შეკვეთები', render: renderList, mount: mount });
  SP.route('/orders/:id', { screen: 'orders', title: function (ctx) { return 'შეკვეთა #' + ctx.params.id; }, render: renderDetail, mount: mount });
})();

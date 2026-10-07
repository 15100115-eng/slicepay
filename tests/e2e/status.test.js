// v4 first order status `processing` / „მუშავდება“ (docs/specs/V4_SPEC.md §A) at 320, 428 and 1440:
//   the status model (7 steps, processing first), a new order placed at checkout starts at მუშავდება in the list
//   (progress pill #f3efff / #5e34ec) and in the detail timeline (current + 6 to come), the demo orders carry a
//   processing step dated on the order date, and orders stored by an older build without the step still render
//   (the missing step counts as done on the order date; their own status is kept). No console errors.
const L = require('../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
const ORD = 'slicepay:v1:orders', DEMO = '555123456';
const LABELS = ['მუშავდება', 'შეკვეთილია', 'გზაშია', 'საწყობშია', 'განბაჟება'];

(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [320, 428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('status ' + W);
    const c = (n, ok, d) => lg.check(n, ok, d);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
    const ev = (fn, a) => p.evaluate(fn, a);
    /** the detail timeline rows: state class, visible label (sr-only state text left out), date */
    const timeline = () => ev(() => [...document.querySelectorAll('.tl__item')].map(li => {
      const l = li.querySelector('.tl__label').cloneNode(true); l.querySelectorAll('.sr-only').forEach(x => x.remove());
      return { st: li.className.replace('tl__item ', '').trim(), label: l.textContent.trim(), date: ((li.querySelector('.tl__date') || {}).textContent || '').trim() };
    }));
    const pillOf = sel => ev(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const cs = getComputedStyle(e); return { t: e.textContent.trim(), bg: cs.backgroundColor, fg: cs.color, cls: e.className }; }, sel);
    const cardPill = id => ev(i => { const a = document.querySelector('.ord-card__link[data-order="' + i + '"]'); const cd = a && a.closest('.ord-card'); const e = cd && cd.querySelector('.status-pill'); if (!e) return null; const cs = getComputedStyle(e); return { t: e.textContent.trim(), bg: cs.backgroundColor, fg: cs.color }; }, id);
    try {
      /* ---------------- status model ---------------- */
      await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(300);
      const today = await ev(() => SlicePay.fmt.date(SlicePay.fmt.todayIso()));
      c('fake clock: today is 7 ოქტომბერი 2026', /^7 ოქტომბერი/.test(today), today);
      const model = await ev(() => ({ keys: Object.keys(SlicePay.STATUS), first: SlicePay.FIRST_STATUS, label: SlicePay.STATUS.processing,
        steps: SlicePay.orderSteps(SlicePay.orders.get('731954')), stepsC: SlicePay.orderSteps(SlicePay.orders.get('548210')) }));
      c('SP.STATUS starts with processing: მუშავდება, FIRST_STATUS = processing', model.keys[0] === 'processing' && model.keys[1] === 'ordered' && model.label === 'მუშავდება' && model.first === 'processing', model);
      c('7 steps: processing, ordered, transit, warehouse, customs, ready|courier, delivered',
        model.steps.join() === 'processing,ordered,transit,warehouse,customs,ready,delivered' && model.stepsC.join() === 'processing,ordered,transit,warehouse,customs,courier,delivered', model);

      /* ---------------- demo orders carry the processing step ---------------- */
      for (const [id, n] of [['731954', 5], ['548210', 7]]) {
        await L.go(p, '#/orders/' + id); await L.sleep(250);
        const tl = await timeline();
        c(`#${id}: 7 rows, მუშავდება first and done, dated as შეკვეთილია`, tl.length === 7 && tl[0].label === 'მუშავდება' && tl[0].st === 'is-done' && !!tl[0].date && tl[0].date === tl[1].date && tl[1].label === 'შეკვეთილია', tl);
        c(`#${id}: ${n === 7 ? 'all done' : '4 done, განბაჟება current'}`, n === 7 ? tl.every(r => r.st === 'is-done') : tl.slice(0, 4).every(r => r.st === 'is-done') && tl[4].st === 'is-current' && tl[4].label === 'განბაჟება', tl.map(r => r.st));
        c(`#${id}: no horizontal overflow`, await L.noOverflow(p));
      }
      const stored = await ev(([k, ph]) => JSON.parse(localStorage.getItem(k) || '{}')[ph].map(o => o.id + ':' + o.timeline[0].key + ':' + (o.timeline[0].date === o.date)), [ORD, DEMO]);
      c('stored demo orders start with processing on the order date', stored.length === 2 && stored.every(x => x.endsWith(':processing:true')), stored);

      /* ---------------- a new order starts at მუშავდება ---------------- */
      await p.goto(L.BASE + '#/pay?demo=1'); await L.sleep(300);
      await L.payCard(p); await L.sleep(300);
      const o = await ev(() => SlicePay.getState().order);
      c('checkout: order created with status processing + timeline [processing, today]', o && o.status === 'processing' && o.timeline.length === 1 && o.timeline[0].key === 'processing' && o.timeline[0].date === o.date, o && { status: o.status, timeline: o.timeline });
      await L.go(p, '#/orders'); await L.sleep(300);
      const first = await ev(() => (document.querySelector('.ord-card__link') || {}).getAttribute ? document.querySelector('.ord-card__link').getAttribute('data-order') : null);
      const np = await cardPill(o.id);
      c('list: the new order first, pill მუშავდება in progress colours (#f3efff / #5e34ec)', first === o.id && np && np.t === 'მუშავდება' && np.bg === 'rgb(243, 239, 255)' && np.fg === 'rgb(94, 52, 236)', { first, np });
      c('list: demo orders keep their own pills', (await cardPill('731954')).t === 'განბაჟება' && (await cardPill('548210')).t === 'ჩაბარდა');
      await L.vis(p, '.ord-card__link[data-order="' + o.id + '"]').click(); await L.waitHash(p, /^#\/orders\/\d{6}$/); await L.sleep(250);
      const dp = await pillOf('.ord-top .status-pill');
      c('detail: pill მუშავდება (progress)', dp && dp.t === 'მუშავდება' && dp.bg === 'rgb(243, 239, 255)' && dp.fg === 'rgb(94, 52, 236)', dp);
      const tl = await timeline();
      c('detail: 7 rows, მუშავდება current (dated today), 6 to come', tl.length === 7 && tl[0].st === 'is-current' && tl[0].label === 'მუშავდება' && (!today || tl[0].date === today) && tl.slice(1).every(r => r.st === 'is-todo' && !r.date), tl);
      c('detail: step order', tl.slice(0, 5).map(r => r.label).join() === LABELS.join() && tl[5].label === 'მზადაა გასატანად' && tl[6].label === 'ჩაბარდა', tl.map(r => r.label));
      c('detail: sr-only state on the current step', await ev(() => (document.querySelector('.tl__item.is-current .sr-only') || {}).textContent === ', მიმდინარე ეტაპი'));
      c('detail: no horizontal overflow', await L.noOverflow(p));
      await L.shot(p, 'status_new_order_' + W);

      /* ---------------- orders stored by an older build (no processing step) ---------------- */
      await ev(([k, ph]) => {
        const all = JSON.parse(localStorage.getItem(k));
        const base = JSON.parse(JSON.stringify(all[ph].find(x => x.id === '548210')));
        const mk = (id, status, keys, extra) => Object.assign(JSON.parse(JSON.stringify(base)), { id, uid: 'legacy-' + id, status, deliveredAt: null, createdAt: Date.now() + Number(id.slice(-1)),
          timeline: keys.map((key, i) => ({ key, date: base.date })), deferred: { weight: null, customs: null } }, extra || {});
        all[ph].push(mk('100771', 'ordered', ['ordered']), mk('100772', 'transit', ['ordered', 'transit']), mk('100773', undefined, ['ordered']));
        localStorage.setItem(k, JSON.stringify(all));
      }, [ORD, DEMO]);
      await p.reload(); await L.sleep(400);
      await L.go(p, '#/orders'); await L.sleep(300);
      const lp = [await cardPill('100771'), await cardPill('100772'), await cardPill('100773')];
      c('legacy list pills: შეკვეთილია / გზაშია keep their status; a missing status reads მუშავდება', lp[0] && lp[0].t === 'შეკვეთილია' && lp[1] && lp[1].t === 'გზაშია' && lp[2] && lp[2].t === 'მუშავდება', lp);
      await L.go(p, '#/orders/100771'); await L.sleep(250);
      let lt = await timeline();
      c('legacy `ordered`: 7 rows, მუშავდება done on the order date, შეკვეთილია current', lt.length === 7 && lt[0].label === 'მუშავდება' && lt[0].st === 'is-done' && !!lt[0].date && lt[0].date === lt[1].date && lt[1].st === 'is-current' && lt.slice(2).every(r => r.st === 'is-todo'), lt);
      c('legacy `ordered`: pill შეკვეთილია', (await pillOf('.ord-top .status-pill')).t === 'შეკვეთილია');
      await L.go(p, '#/orders/100772'); await L.sleep(250);
      lt = await timeline();
      c('legacy `transit`: 2 done (მუშავდება, შეკვეთილია), გზაშია current', lt.length === 7 && lt[0].st === 'is-done' && lt[1].st === 'is-done' && lt[2].st === 'is-current' && lt[2].label === 'გზაშია', lt.map(r => r.st + ':' + r.label));
      await L.go(p, '#/orders/100773'); await L.sleep(250);
      lt = await timeline();
      c('legacy without a status renders (7 rows, nothing broken)', lt.length === 7 && lt[0].label === 'მუშავდება' && !!(await L.tc(p, 'h1')), lt.map(r => r.st + ':' + r.label));
      c('legacy detail: no horizontal overflow', await L.noOverflow(p));
      const norm = await ev(() => { const g = SlicePay.orders.get('100771'); return g.timeline.map(x => x.key).join() + '|' + g.status; });
      c('SP.orders.get normalises the legacy order (processing in front, status kept)', norm === 'processing,ordered|ordered', norm);
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    c('no console errors / network requests', errs.length === 0, errs);
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})();

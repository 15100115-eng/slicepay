// ported from scratchpad tools/v2r3_orders.js
// v2 functional QA round 3 — my orders: per-user persistence across reloads / logins / tabs, two users isolated,
// storage privacy, deferred payment flow (full / partial / prepaid diff / refund), pills, logout, empty state
const L = require('../../lib/harness');
const T0 = new Date('2026-10-07T10:00:00');
const ORD = 'slicepay:v1:orders';
async function regOrder(p, u, url, dl) {
  await L.landingAdd(p, url);
  await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/(register|login|delivery)/);
  if (/register/.test(await L.H(p))) {
    await L.register(p, u);
    await L.verify(p, (await L.st(p)).pendingReg.code);
  } else if (/login/.test(await L.H(p))) {
    await L.login(p, u.phone, u.pass);
  }
  await L.waitHash(p, /^#\/delivery/);
  await L.delivery(p, Object.assign({ first: u.first, last: u.last, pid: u.pid }, dl || {}));
  await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
  await L.payCard(p); await L.sleep(300);
  return (await L.st(p)).order;
}
const listIds = p => p.evaluate(() => [...document.querySelectorAll('.ord-card__link')].map(a => a.getAttribute('data-order')));
const pill = (p, sel) => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); if (!e) return null; const c = getComputedStyle(e); return { t: e.textContent, bg: c.backgroundColor, fg: c.color, cls: e.className }; }, sel);
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('orders ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
    const A = { first: 'ანა', last: 'ალანია', phone: '591 ' + String(W).slice(-3) + ' 001', pass: 'parolA123', email: 'a@example.com', pid: '11111111111' };
    const B = { first: 'ბექა', last: 'ბერია', phone: '591 ' + String(W).slice(-3) + ' 002', pass: 'parolB123', email: 'b@example.com', pid: '22222222222' };
    A.raw = A.phone.replace(/\D/g, ''); B.raw = B.phone.replace(/\D/g, '');
    try {
      const oA = await regOrder(p, A, 'https://www.amazon.com/Apple-Watch-Series/dp/B0AAA00001', { method: 'courier', city: 'რუსთავი', addr: 'მეგობრობის 7' });
      lg.check('A: order placed', !!oA && /^#\/success/.test(await L.H(p)));
      await L.vis(p, '[data-action="orders"]').click(); await L.waitHash(p, /^#\/orders$/); await L.sleep(200);
      lg.check('A: list has exactly A\'s order', JSON.stringify(await listIds(p)) === JSON.stringify([oA.id]), await listIds(p));
      const pl = await pill(p, '.ord-card .status-pill');
      lg.check('new order pill მუშავდება (v4 first status) in progress colours (#f3efff / #5e34ec)', pl.t === 'მუშავდება' && pl.bg === 'rgb(243, 239, 255)' && pl.fg === 'rgb(94, 52, 236)', pl);
      await p.reload(); await L.sleep(400);
      lg.check('reload keeps A signed in + the order', /^#\/orders$/.test(await L.H(p)) && JSON.stringify(await listIds(p)) === JSON.stringify([oA.id]), await listIds(p));
      // logout (v4: orders heading link პროფილი → ᲒᲐᲡᲕᲚᲐ on #/profile)
      await L.vis(p, '.ord-top__out').click(); await L.waitHash(p, /^#\/profile$/);
      await L.vis(p, '[data-action="logout"]').click(); await L.sleep(300);
      lg.check('logout -> landing + toast', (await L.H(p)).replace(/\?.*/, '') === '#/' && /თქვენ გამოხვედით სისტემიდან/.test(await L.toast(p)), [await L.H(p), await L.toast(p)]);
      const acct = await L.txt(p, '.acct-link');
      lg.check('landing link now შესვლა', acct === 'შესვლა', acct);
      const ss = await p.evaluate(() => sessionStorage.getItem('slicepay:v1:state'));
      lg.check('logout clears the session state (no phone, no pid)', !ss || (!ss.includes(A.raw) && !ss.includes(A.pid)), ss && ss.slice(0, 200));
      await p.goBack(); await L.sleep(500);
      lg.check('Back after logout does not reopen a signed-in screen', /^#\/(login|$)/.test(await L.H(p)), await L.H(p));

      // B
      const oB = await regOrder(p, B, 'https://www.ebay.com/itm/Retro-Console/99887766', { method: 'pickup', branch: 'kutaisi' });
      await L.go(p, '#/orders'); await L.sleep(250);
      lg.check('B: list has only B\'s order', JSON.stringify(await listIds(p)) === JSON.stringify([oB.id]), await listIds(p));
      await L.go(p, '#/orders/' + oA.id); await L.sleep(250);
      lg.check('B cannot open A\'s order (-> #/orders)', (await L.H(p)) === '#/orders', await L.H(p));
      await L.go(p, '#/pay?order=' + oA.id); await L.sleep(250);
      lg.check('B cannot pay A\'s order (-> #/orders)', (await L.H(p)) === '#/orders', await L.H(p));
      await L.go(p, '#/delivery'); await L.sleep(200);
      lg.info('B /delivery with empty cart ->', await L.H(p));
      // B's delivery form after logout/login of A must not show A's data — checked via state
      const sB = await L.st(p);
      lg.check('B session has no A data', !JSON.stringify(sB).includes(A.pid) && !JSON.stringify(sB).includes('ალანია') && !JSON.stringify(sB).includes('მეგობრობის'), null);
      await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
      // login A again
      await L.go(p, '#/login?next=/orders'); await L.sleep(200);
      await L.login(p, A.phone, A.pass); await L.sleep(250);
      lg.check('login A (next=/orders) -> only A\'s order', (await L.H(p)) === '#/orders' && JSON.stringify(await listIds(p)) === JSON.stringify([oA.id]), [await L.H(p), await listIds(p)]);
      // new tab = new session: localStorage persists, session does not
      const p2 = await ctx.newPage(); L.hook(p2, errs, 'tab2 ');
      await p2.goto(L.BASE + '#/orders'); await L.sleep(300);
      lg.check('new tab: signed out -> login?next=/orders', /^#\/login\?next=\/orders/.test(await L.H(p2)), await L.H(p2));
      await L.login(p2, B.phone, B.pass); await L.sleep(250);
      lg.check('new tab: B logs in -> B\'s persisted order only', JSON.stringify(await listIds(p2)) === JSON.stringify([oB.id]), await listIds(p2));
      await p2.close();
      // storage
      const all = await p.evaluate(k => JSON.parse(localStorage.getItem(k)), ORD);
      lg.check('orders store keyed per phone (A, B)', all && all[A.raw] && all[A.raw].length === 1 && all[B.raw] && all[B.raw].length === 1, Object.keys(all || {}));
      const raw = JSON.stringify(all);
      lg.check('orders store: IDs only masked (********111 / ********222)', !raw.includes(A.pid) && !raw.includes(B.pid) && raw.includes('********111') && raw.includes('********222'));
      lg.check('orders store: no card data', !/4242|cvv|cc-|"exp"/i.test(raw));
      const everything = await p.evaluate(() => JSON.stringify(Object.assign({}, localStorage)));
      lg.check('localStorage anywhere: no raw IDs', !everything.includes(A.pid) && !everything.includes(B.pid));

      // ---- deferred: partial / prepaid diff / refund (stored-order edits, as the warehouse would) ----
      await p.evaluate(([k, ph, id]) => {
        const a = JSON.parse(localStorage.getItem(k)); const o = a[ph].find(x => x.id === id);
        o.status = 'customs'; o.timeline.push({ key: 'ordered', date: o.timeline[0].date }, { key: 'transit', date: '2026-10-09' }, { key: 'warehouse', date: '2026-10-12' }, { key: 'customs', date: '2026-10-14' });
        o.deferred.weight.actual = o.deferred.weight.est + 7;   // known
        o.deferred.customs = o.deferred.customs || { est: 50, actual: null, prepaid: false, paid: false };
        o.deferred.customs.actual = null;                       // still pending
        localStorage.setItem(k, JSON.stringify(a));
      }, [ORD, A.raw, oA.id]);
      const est = oA.deferred.weight.est;
      await L.go(p, '#/orders/' + oA.id); await L.sleep(250);
      let det = await p.evaluate(() => ({ parts: [...document.querySelectorAll('.ord-part')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), due: (document.querySelector('.ord-due__total') || {}).textContent, btn: !!document.querySelector('.ord-due__btn'), pill: document.querySelector('.ord-top .status-pill').textContent, cur: (document.querySelector('.tl__item.is-current .tl__label') || {}).textContent }));
      lg.check(`partial: weight დაახ. ${est}₾ → ფაქტობრივი ${est + 7}₾, customs pending, due ${est + 7}`, /დაახ\.\d+₾→ფაქტობრივი/.test(det.parts[0].replace(/\s/g, '')) /* (reconciler r2) whitespace is stripped first, so no space in the pattern */ && det.parts[0].includes('ფაქტობრივი ' + (est + 7) + '₾') && /განისაზღვრება ამანათის ჩამოსვლისას/.test(det.parts[1]) && det.due && det.due.includes((est + 7) + '₾') && det.btn, det);
      lg.check('partial: pill განბაჟება, current step განბაჟება', det.pill === 'განბაჟება' && /^განბაჟება/.test(det.cur || ''), det);
      const dueP = await pill(p, '.ord-top .status-pill');
      lg.check('due pill colours #fff4e5 / #9a5c00', dueP.bg === 'rgb(255, 244, 229)' && dueP.fg === 'rgb(154, 92, 0)', dueP);
      await L.go(p, '#/orders'); await L.sleep(200);
      const badge = await L.txt(p, '.ord-due-badge');
      lg.check(`list badge გადასახდელია: ${est + 7}₾`, badge === `გადასახდელია: ${est + 7}₾`, badge);
      await L.go(p, '#/orders/' + oA.id); await L.sleep(200);
      await L.vis(p, '[data-action="pay"]').click(); await L.waitHash(p, /^#\/pay\?order=/); await L.sleep(200);
      const dueLine = await L.txt(p, '.paycard__due-amt');
      lg.check(`card form line გადასახდელი: ${est + 7}₾`, dueLine === `გადასახდელი: ${est + 7}₾`, dueLine);
      await L.payCard(p); await L.sleep(400);
      det = await p.evaluate(() => ({ h: location.hash, parts: [...document.querySelectorAll('.ord-part')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), btn: !!document.querySelector('.ord-due__btn'), pill: document.querySelector('.ord-top .status-pill').textContent }));
      lg.check('after partial pay: back on the detail, weight გადახდილია, customs still pending, pill stays განბაჟება, no pay button', det.h === '#/orders/' + oA.id && /გადახდილია/.test(det.parts[0]) && /განისაზღვრება/.test(det.parts[1]) && det.pill === 'განბაჟება' && !det.btn, det);
      lg.check('toast გადახდა წარმატებით შესრულდა', /გადახდა წარმატებით შესრულდა/.test(await L.toast(p)), await L.toast(p));
      // customs actual arrives
      await p.evaluate(([k, ph, id]) => { const a = JSON.parse(localStorage.getItem(k)); const o = a[ph].find(x => x.id === id); o.deferred.customs.actual = o.deferred.customs.est - 5; localStorage.setItem(k, JSON.stringify(a)); }, [ORD, A.raw, oA.id]);
      await L.go(p, '#/orders'); await L.go(p, '#/orders/' + oA.id); await L.sleep(250);
      await L.vis(p, '[data-action="pay"]').click(); await L.waitHash(p, /^#\/pay\?order=/); await L.payCard(p); await L.sleep(400);
      det = await p.evaluate(() => ({ parts: [...document.querySelectorAll('.ord-part')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), pill: document.querySelector('.ord-top .status-pill').textContent, cur: (document.querySelector('.tl__item.is-current .tl__label') || {}).textContent }));
      lg.check('all paid: courier order moves to კურიერთანაა', det.pill === 'კურიერთანაა' && /^კურიერთანაა/.test(det.cur || '') && det.parts.every(x => /გადახდილია/.test(x)), det);
      await p.reload(); await L.sleep(400);
      lg.check('reload keeps the paid state', (await p.evaluate(() => document.querySelector('.ord-top .status-pill').textContent)) === 'კურიერთანაა');
      // prepaid diff / refund on B's order (prepaid parts): B paid weight upfront? set deferred.weight prepaid
      await p.evaluate(([k, ph, id]) => {
        const a = JSON.parse(localStorage.getItem(k)); const o = a[ph].find(x => x.id === id);
        o.deferWeight = false; o.deferCustoms = false;
        o.deferred.weight = { est: 100, actual: 112, prepaid: true, paid: false };
        o.deferred.customs = { est: 250, actual: 238, prepaid: true, paid: false };
        localStorage.setItem(k, JSON.stringify(a));
      }, [ORD, A.raw, oA.id]);
      await L.go(p, '#/orders'); await L.go(p, '#/orders/' + oA.id); await L.sleep(250);
      det = await p.evaluate(() => ({ parts: [...document.querySelectorAll('.ord-part')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), due: (document.querySelector('.ord-due__total') || {}).textContent }));
      lg.check('prepaid: weight 100→112 "სხვაობა 12₾ გადასახდელია", customs 250→238 "სხვაობა 12₾ დაგიბრუნდებათ", due 12₾', /სხვაობა 12₾ გადასახდელია/.test(det.parts[0] || '') && /სხვაობა 12₾ დაგიბრუნდებათ/.test(det.parts[1] || '') && /12₾/.test(det.due || ''), det);

      // ---- demo user: lazily seeded, paid state persists across logins ----
      await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
      await L.go(p, '#/login?next=/orders'); await L.sleep(200);
      await L.login(p, '555 123 456', 'slicepay1'); await L.sleep(300);
      lg.info('demo login (no demo account yet?) ->', await L.H(p), await p.evaluate(() => (document.getElementById('log-pass-err') || {}).textContent));
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    await ctx.close();

    /* ---- demo orders pay flow + persistence ---- */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(300);
        const cards = await p.evaluate(() => [...document.querySelectorAll('.ord-card')].map(c => ({ id: c.querySelector('.ord-card__link').getAttribute('data-order'), head: c.querySelector('.ord-card__h').innerText.replace(/\s+/g, ' '), pill: c.querySelector('.status-pill').textContent, sum: c.querySelector('.ord-card__sum').textContent, eta: c.querySelector('.eta-line').textContent.replace(/ /g, ' '), due: (c.querySelector('.ord-due-badge') || {}).textContent || null, more: (c.querySelector('.ord-card__more') || {}).textContent || null })));
        lg.info('demo cards', cards);
        lg.check('demo list: #731954 first (newest), then #548210', cards.map(c => c.id).join() === '731954,548210', cards.map(c => c.id));
        lg.check('#731954 card: "#731954 · 28 სექტემბერი 2026", pill განბაჟება, სულ 600₾ · 150₾ × 4 თვე, badge 350₾', /#731954 · ,? ?28 სექტემბერი 2026/.test(cards[0].head) && cards[0].pill === 'განბაჟება' && cards[0].sum === 'სულ 600₾ · 150₾ × 4 თვე' && cards[0].due === 'გადასახდელია: 350₾', cards[0]);
        lg.check('#548210 card: delivered pill, ჩაბარდა line, +1', cards[1].pill === 'ჩაბარდა' && /^ჩაბარდა: /.test(cards[1].eta) && cards[1].more === '+1', cards[1]);
        const dp = await pill(p, '.ord-card:nth-child(2) .status-pill');
        lg.check('delivered pill colours #e8f5ee / #1e7b4a', dp.bg === 'rgb(232, 245, 238)' && dp.fg === 'rgb(30, 123, 74)', dp);
        await p.click('.ord-card__link[data-order="731954"]'); await L.waitHash(p, /^#\/orders\/731954/); await L.sleep(250);
        const det = await L.appText(p);
        for (const s of ['შეკვეთა #731954', 'პროდუქტები', 'მიწოდება', 'ფილიალიდან გატანა: ვაკის ფილიალი', 'მიმღები:', 'გიორგი ბერიძე', 'პირადი ნომერი:', '********345', 'გადახდა', 'ვადა:', '4 თვე', '1-ლი შენატანი', 'მე-2 შენატანი', 'დარჩენილი გადასახდელი', 'წონის საფასური', 'დაახ. 100₾', 'ფაქტობრივი 112₾', 'განბაჟება', 'დაახ. 250₾', 'ფაქტობრივი 238₾', '350₾'])
          lg.check('detail has "' + s + '"', det.includes(s));
        const sched = await p.evaluate(() => [...document.querySelectorAll('.ord-sched__row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
        lg.check('schedule "1-ლი შენატანი · 28 ოქტომბერი 2026 · 150₾"', /^1-ლი შენატანი · ,? ?28 ოქტომბერი 2026 ?150₾$/.test(sched[0]), sched);
        await L.vis(p, '[data-action="pay"]').click(); await L.waitHash(p, /^#\/pay\?order=731954/); await L.sleep(200);
        // back from the card form -> detail
        await L.vis(p, '[data-back]').click(); await L.sleep(400);
        lg.check('card form back -> #/orders/731954', (await L.H(p)) === '#/orders/731954', await L.H(p));
        await L.vis(p, '[data-action="pay"]').click(); await L.waitHash(p, /^#\/pay\?order=731954/);
        await L.payCard(p); await L.sleep(400);
        const after = await p.evaluate(() => ({ h: location.hash, pill: document.querySelector('.ord-top .status-pill').textContent, parts: [...document.querySelectorAll('.ord-part')].map(e => e.textContent.replace(/\s+/g, ' ').trim()), btn: !!document.querySelector('.ord-due__btn'), tl: [...document.querySelectorAll('.tl__item')].map(i => i.className.replace('tl__item ', '')) }));
        lg.check('paid: detail, pill მზადაა გასატანად, rows გადახდილია, no button, timeline 6th current (მუშავდება first)', after.h === '#/orders/731954' && after.pill === 'მზადაა გასატანად' && after.parts.every(x => /გადახდილია/.test(x)) && !after.btn && after.tl[5] === 'is-current' && after.tl.length === 7, after);
        await p.goForward(); await L.sleep(400);
        lg.check('Forward to the paid card form -> detail', (await L.H(p)) === '#/orders/731954', await L.H(p));
        await L.go(p, '#/orders'); await L.sleep(200);
        const c1 = await p.evaluate(() => { const c = document.querySelector('.ord-card'); return { pill: c.querySelector('.status-pill').textContent, kind: c.querySelector('.status-pill').className, due: !!c.querySelector('.ord-due-badge') }; });
        lg.check('list: #731954 pill მზადაა გასატანად (progress), no due badge', c1.pill === 'მზადაა გასატანად' && /progress/.test(c1.kind) && !c1.due, c1);
        // logout + login keeps the paid state (no re-seed)
        await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
        await L.go(p, '#/login?next=/orders'); await L.sleep(200);
        await L.login(p, '555 123 456', 'slicepay1'); await L.sleep(300);
        const c2 = await p.evaluate(() => [...document.querySelectorAll('.ord-card')].map(c => c.querySelector('.status-pill').textContent));
        lg.check('demo user re-login: #731954 still paid (not re-seeded)', c2[0] === 'მზადაა გასატანად', c2);
        // empty state
        await p.goto(L.BASE + '#/orders?demo=1&empty=1'); await L.sleep(300);
        const em = await L.appText(p);
        lg.check('empty state copy', em.includes('ჯერ არ გაქვთ შეკვეთები'));
        await L.vis(p, '[data-action="new"]').click(); await L.sleep(300);
        lg.check('ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ -> landing', (await L.H(p)).replace(/\?.*/, '') === '#/', await L.H(p));
      } catch (e) { lg.check('demo script error', false, String(e).slice(0, 400)); }
      await ctx.close();
    }
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

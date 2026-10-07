// ported from scratchpad tools/v2f_defer.js
// Orders list/detail content, deferred payment flow (#/pay?order=), statuses, pills, timeline, edge cases
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('defer ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs, { clock: new Date('2026-10-06T11:00:00') });
    await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(400);
    // v3 reconcile: read the visible card text (the orders fixer added sr-only 'შეკვეთა ' / ', ' to the heading) and
    // collapse whitespace in the ETA (REV2R3-03 glues day–month with a no-break space).
    const cards = () => p.evaluate(() => { const srOff = document.createElement('style'); srOff.textContent = '.sr-only{display:none!important}'; document.head.appendChild(srOff); const r = [...document.querySelectorAll('.ord-card')].map(c => {
      const pill = c.querySelector('.status-pill'), cs = getComputedStyle(pill);
      return { head: c.querySelector('.ord-card__h').innerText.replace(/\s+/g, ' ').trim(), pill: pill.textContent, kind: pill.className, bg: cs.backgroundColor, fg: cs.color,
        names: c.querySelector('.ord-card__names').innerText.replace(/\s+/g, ' ').trim(), sum: c.querySelector('.ord-card__sum').textContent,
        eta: c.querySelector('.ord-card__eta').textContent.replace(/\s+/g, ' '), due: (c.querySelector('.ord-due-badge') || {}).textContent || null,
        dueColor: c.querySelector('.ord-due-badge') ? getComputedStyle(c.querySelector('.ord-due-badge')).color : null,
        nameEllipsis: getComputedStyle(c.querySelector('.ord-card__name')).textOverflow };
    }); srOff.remove(); return r; });
    let cs = await cards();
    lg.check('list heading ჩემი შეკვეთები', (await L.tc(p, 'h1')) === 'ჩემი შეკვეთები');
    lg.check('card 1 #731954 · 27 სექტემბერი 2026', cs[0].head === '#731954 · 27 სექტემბერი 2026', cs[0].head);
    // v3 reconcile: the spec's due text colour #b26a00 is 4.0:1 on #fff4e5; core v2 r1 darkened it to #9a5c00 (AA 4.5:1)
    lg.check('card 1 pill status in due colours (#fff4e5/#9a5c00)', cs[0].pill === 'განბაჟება' && cs[0].bg === 'rgb(255, 244, 229)' && cs[0].fg === 'rgb(154, 92, 0)', cs[0]);
    lg.check('card 1 due badge გადასახდელია: 350₾ (orange)', cs[0].due === 'გადასახდელია: 350₾' && cs[0].dueColor === 'rgb(154, 92, 0)', [cs[0].due, cs[0].dueColor]);
    lg.check('card 1 sum სულ 600₾ · 150₾ × 4 თვე', cs[0].sum === 'სულ 600₾ · 150₾ × 4 თვე', cs[0].sum);
    lg.check('card 1 ETA (27 Sep + 9..14) სავარაუდო მიღება: 6–11 ოქტომბერი', cs[0].eta === 'სავარაუდო მიღება: 6–11 ოქტომბერი', cs[0].eta);
    lg.check('card 1 product name with ellipsis style', cs[0].names.startsWith('Nike Air Pegasus') && cs[0].nameEllipsis === 'ellipsis', cs[0]);
    lg.check('card 2 #548210 · 6 აგვისტო 2026, ჩაბარდა (green #e8f5ee/#1e7b4a)', cs[1].head === '#548210 · 6 აგვისტო 2026' && cs[1].pill === 'ჩაბარდა' && cs[1].bg === 'rgb(232, 245, 238)' && cs[1].fg === 'rgb(30, 123, 74)', cs[1]);
    lg.check('card 2 "+1", sum 745 / 125 × 6, ჩაბარდა: 17 აგვისტო, no badge', cs[1].names.endsWith('+1') && cs[1].sum === 'სულ 745₾ · 125₾ × 6 თვე' && cs[1].eta === 'ჩაბარდა: 17 აგვისტო' && !cs[1].due, cs[1]);
    await L.shot(p, 'orders_list_' + W);
    // detail
    await L.vis(p, '.ord-card__link[data-order="731954"]').click(); await L.sleep(300);
    lg.check('card link -> detail', (await L.H(p)) === '#/orders/731954');
    lg.check('title + heading შეკვეთა #731954', (await p.title()).startsWith('შეკვეთა #731954') && (await L.tc(p, 'h1')) === 'შეკვეთა #731954');
    // v3 reconcile: the timeline label now carries an sr-only state (', შესრულებულია' / ', მიმდინარე ეტაპი' / ', მოსალოდნელი'); compare the visible label
    const vlab = 'const v = e => { const c = e.cloneNode(true); c.querySelectorAll(".sr-only").forEach(x => x.remove()); return c.textContent.trim(); };';
    const tl = await p.evaluate(new Function(vlab + 'return [...document.querySelectorAll(".tl__item")].map(li => li.className.replace("tl__item ", "") + ":" + v(li.querySelector(".tl__label")) + ":" + ((li.querySelector(".tl__date") || {}).textContent || ""));'));
    const tlSr = await p.evaluate(() => [...document.querySelectorAll('.tl__item .tl__label .sr-only')].map(x => x.textContent.trim()).join('|'));
    // v4: მუშავდება is the first step (done on the order date), so 4 done before customs
    lg.check('timeline sr-only states (4 done, current, 2 future)', tlSr === ', შესრულებულია|, შესრულებულია|, შესრულებულია|, შესრულებულია|, მიმდინარე ეტაპი|, მოსალოდნელი|, მოსალოდნელი', tlSr);
    lg.check('timeline 7 steps (მუშავდება first), customs current, dates', tl.join('|') === 'is-done:მუშავდება:27 სექტემბერი 2026|is-done:შეკვეთილია:27 სექტემბერი 2026|is-done:გზაშია:29 სექტემბერი 2026|is-done:საწყობშია:3 ოქტომბერი 2026|is-current:განბაჟება:5 ოქტომბერი 2026|is-todo:მზადაა გასატანად:|is-todo:ჩაბარდა:', tl);
    const curColor = await p.evaluate(() => getComputedStyle(document.querySelector('.tl__item.is-current .tl__label')).color + ' ' + getComputedStyle(document.querySelector('.tl__item.is-current .tl__dot')).borderColor);
    lg.info('current step colours', curColor);
    let d = await L.appVisText(p);   // v3 reconcile: visible copy (sr-only ', ' between the schedule label and date)
    const want = ['დარჩენილი გადასახდელი', 'წონის საფასური', 'დაახ. 100₾', 'ფაქტობრივი 112₾', 'განბაჟება', 'დაახ. 250₾', 'ფაქტობრივი 238₾', 'გადასახდელი: 350₾', 'პროდუქტები', 'მიწოდება', 'ფილიალიდან გატანა: ვაკის ფილიალი', 'ჭავჭავაძის გამზ. 37, თბილისი', 'მიმღები: გიორგი ბერიძე', 'პირადი ნომერი: ********345', 'სავარაუდო მიღება: 6–11 ოქტომბერი', 'გადახდა', 'საქართველოს ბანკი: ნაწილ-ნაწილ', 'ვადა: 4 თვე', '1-ლი შენატანი · 27 ოქტომბერი 2026 150₾', 'მე-2 შენატანი · 27 ნოემბერი 2026 150₾', 'მე-4 შენატანი · 27 იანვარი 2027 150₾'];
    // section headings are drawn in Mtavruli (as the success receipt headings) with the lower-case name as an sr-only twin:
    // match those against the accessible text, everything else against the visible copy
    const dRaw = await L.appText(p), HEADS = ['დარჩენილი გადასახდელი', 'პროდუქტები', 'მიწოდება', 'გადახდა'];
    const miss = want.filter(x => !(d.includes(x) || (HEADS.includes(x) && dRaw.includes(x))));
    lg.check('detail content (sections, rows, masked ID, schedule)', miss.length === 0, miss);
    const order = await p.evaluate(() => [...document.querySelectorAll('.ord-sec')].map(s => (s.querySelector('h2') || {}).textContent));
    lg.info('section order', order.join(' | '));
    lg.check('pay button ᲒᲐᲓᲐᲮᲓᲐ', (await L.txt(p, '[data-action="pay"]') || '').includes('ᲒᲐᲓᲐᲮᲓᲐ'));
    if (W < 900) {
      const bar = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(x => x.getClientRects().length).map(x => x.innerText.trim().split('\n')[0]));
      lg.check('detail mobile bar: ᲣᲙᲐᲜ only', bar.join('|') === 'ᲣᲙᲐᲜ', bar);
    }
    await L.shot(p, 'order_731954_' + W);
    // pay
    await L.vis(p, '[data-action="pay"]').click(); await L.sleep(300);
    lg.check('-> #/pay?order=731954 with due line', (await L.H(p)) === '#/pay?order=731954' && (await L.tc(p, '.paycard__due-amt')) === 'გადასახდელი: 350₾');
    const fw = await p.evaluate(() => getComputedStyle(document.querySelector('.paycard__due-amt')).fontWeight);
    lg.check('due line bold', +fw >= 600, fw);
    lg.check('due line above "Pay with"', await p.evaluate(() => document.querySelector('.paycard__due').getBoundingClientRect().bottom <= document.getElementById('brands-l').getBoundingClientRect().top));
    // back from order pay -> detail
    await L.vis(p, '[data-back="/orders/731954"]').click(); await L.sleep(300);
    lg.check('back from order pay -> detail', (await L.H(p)) === '#/orders/731954', await L.H(p));
    await p.goForward(); await L.sleep(300);
    lg.check('forward -> order pay again', (await L.H(p)) === '#/pay?order=731954', await L.H(p));
    // card errors
    await p.fill('#cc-num', '4242424242424241'); await p.fill('#cc-exp', '01/20'); await p.fill('#cc-cvv', '1');
    await p.click('#card-submit'); await L.sleep(150);
    lg.check('order mode: card validation errors', (await L.tc(p, '#cc-num-err')) === 'ბარათის ნომერი არასწორია' && (await L.tc(p, '#cc-exp-err')) === 'ვადა ამოწურულია' && (await L.tc(p, '#cc-cvv-err')) === 'CVV არასწორია', [await L.tc(p, '#cc-num-err'), await L.tc(p, '#cc-exp-err'), await L.tc(p, '#cc-cvv-err')]);
    lg.check('order not paid yet', (await p.evaluate(() => SlicePay.orderDue(SlicePay.orders.get('731954')).total)) === 350);
    await L.payCard(p); await L.sleep(400);
    lg.check('paid -> detail + toast', (await L.H(p)) === '#/orders/731954' && (await L.toast(p)).includes('გადახდა წარმატებით შესრულდა'));
    d = await L.appText(p);
    const pill = await p.evaluate(() => { const e = document.querySelector('.ord-top .status-pill'); const c = getComputedStyle(e); return [e.textContent, c.backgroundColor, c.color]; });
    lg.check('pill -> მზადაა გასატანად (progress colours)', pill[0] === 'მზადაა გასატანად' && pill[1] === 'rgb(243, 239, 255)' && pill[2] === 'rgb(94, 52, 236)', pill);
    const tl2 = await p.evaluate(() => [...document.querySelectorAll('.tl__item')].map(li => li.className.replace('tl__item ', '') + ':' + ((li.querySelector('.tl__date') || {}).textContent || '')));
    lg.check('timeline: customs done, ready current dated today (6 ოქტომბერი)', tl2[4].startsWith('is-done') && tl2[5] === 'is-current:6 ოქტომბერი 2026' && tl2.length === 7, tl2);
    lg.check('rows show 112₾ / 238₾ გადახდილია, no pay button, no due total', (d.match(/გადახდილია/g) || []).length === 2 && d.includes('112₾') && d.includes('238₾') && !(await p.$('[data-action="pay"]')) && !d.includes('გადასახდელი: '), d.slice(0, 500));
    await L.shot(p, 'order_731954_paid_' + W);
    await p.reload(); await L.sleep(400);
    lg.check('reload keeps paid state', (await p.evaluate(() => SlicePay.orders.get('731954').status)) === 'ready' && (await L.appText(p)).includes('გადახდილია'));
    await L.go(p, '#/pay?order=731954');
    lg.check('#/pay?order after paid -> detail', (await L.H(p)) === '#/orders/731954', await L.H(p));
    await L.go(p, '#/orders'); await L.sleep(200);
    cs = await cards();
    lg.check('list after pay: pill მზადაა გასატანად progress, no badge', cs[0].pill === 'მზადაა გასატანად' && cs[0].bg === 'rgb(243, 239, 255)' && !cs[0].due, cs[0]);
    // delivered order detail
    await L.go(p, '#/orders/548210'); await L.sleep(200);
    d = await L.appText(p);
    // v3 reconcile: REV2-08 (core v2 r1) spreads the remainder +1₾ over the first instalments, so 745/6 is 125 + 124 × 5
    // (sums to 745, every row within 1₾ of the card's 125₾ × 6); the old 125 × 5 + 120 split is gone.
    const sched548 = await p.$$eval('.ord-sched__a', a => a.map(x => x.textContent).join());
    lg.check('#548210: courier, delivered, no due section, schedule 6 (125 + 124×5)', d.includes('კურიერით: თბილისი, ვაჟა-ფშაველას გამზ. 12, ბ. 5') && d.includes('ჩაბარდა: 17 აგვისტო') && !d.includes('დარჩენილი გადასახდელი') && sched548 === '125₾,124₾,124₾,124₾,124₾,124₾' && d.includes('მიწოდების ფასი: 5₾'), [sched548, d.slice(0, 400)]);
    const tl3 = await p.evaluate(new Function(vlab + 'return [...document.querySelectorAll(".tl__item")].map(li => li.className.replace("tl__item ", "") + ":" + v(li.querySelector(".tl__label")));'));
    lg.check('#548210 timeline courier variant all done', tl3.join() === 'is-done:მუშავდება,is-done:შეკვეთილია,is-done:გზაშია,is-done:საწყობშია,is-done:განბაჟება,is-done:კურიერთანაა,is-done:ჩაბარდა', tl3);

    /* ---- edge cases via stored orders ---- */
    const mk = (id, patch) => p.evaluate(([id, patch]) => {
      const base = JSON.parse(JSON.stringify(SlicePay.orders.get('548210')));
      base.id = id; base.createdAt = Date.now() + Math.random(); base.status = patch.status; base.deliveredAt = null;
      base.timeline = base.timeline.slice(0, ['processing', 'ordered', 'transit', 'warehouse', 'customs', 'courier', 'delivered'].indexOf(patch.status) + 1);
      base.deferred = patch.deferred;
      SlicePay.orders.save(base);
    }, [id, patch]);
    // (1) prepaid weight with a higher actual -> difference due
    await mk('100001', { status: 'warehouse', deferred: { weight: { est: 60, actual: 75, prepaid: true, paid: false }, customs: null } });
    await L.go(p, '#/orders/100001'); await L.sleep(200);
    d = await L.appText(p);
    lg.check('prepaid weight 60 -> actual 75: due 15₾ shown', d.includes('გადასახდელი: 15₾') && d.includes('დაახ. 60₾') && d.includes('ფაქტობრივი 75₾'), d.slice(0, 400));
    lg.info('prepaid-difference row reads:', (await p.$$eval('.ord-part', a => a.map(x => x.innerText.replace(/\s+/g, ' ')))).join(' / '));
    // (2) prepaid with a lower actual -> refund
    await mk('100002', { status: 'warehouse', deferred: { weight: { est: 60, actual: 40, prepaid: true, paid: false }, customs: null } });
    await L.go(p, '#/orders/100002'); await L.sleep(200);
    d = await L.appText(p);
    lg.info('refund case (prepaid 60, actual 40) shows:', d.includes('დარჩენილი გადასახდელი') ? 'due section' : 'no due section', '| mentions 20₾:', d.includes('20₾'));
    // (3) weight known, customs still pending, status customs -> pay weight only
    await mk('100003', { status: 'customs', deferred: { weight: { est: 60, actual: 64, prepaid: false, paid: false }, customs: { est: 90, actual: null, prepaid: false, paid: false } } });
    await L.go(p, '#/orders/100003'); await L.sleep(200);
    d = await L.appText(p);
    lg.check('partial: weight 64 due, customs pending row', d.includes('გადასახდელი: 64₾') && d.includes('განისაზღვრება ამანათის ჩამოსვლისას'), d.slice(0, 400));
    await L.go(p, '#/pay?order=100003'); await L.payCard(p); await L.sleep(300);
    const o3 = await p.evaluate(() => SlicePay.orders.get('100003'));
    lg.check('paying weight while customs is still undetermined must not advance past customs', o3.status === 'customs', { status: o3.status, customs: o3.deferred.customs });
    await L.shot(p, 'order_partial_paid_' + W);
    // (4) pill when due and status != customs
    await L.go(p, '#/orders'); await L.sleep(200);
    cs = await cards();
    lg.info('pills now:', cs.map(c => c.head.split(' ')[0] + '=' + c.pill + (c.due ? '(' + c.due + ')' : '')).join(', '));
    // detail back -> list; list back (any) -> previous
    await L.go(p, '#/orders/731954');
    await L.vis(p, '[data-back="/orders"]').click(); await L.sleep(300);
    lg.check('detail back -> #/orders', (await L.H(p)) === '#/orders', await L.H(p));
    lg.check('no overflow', await L.noOverflow(p));
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

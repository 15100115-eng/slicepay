// ported from scratchpad tools/v2r3_terms.js
// v2 functional QA round 3 — term selection: availability per method, fallback on method switch (every pair),
// keyboard (arrows on chips and method radios), placement, ?term= param
const L = require('../../lib/harness');
const TERMS = { bog: [3, 4, 6], tbc: [3, 4, 6, 9, 12], mere: [4, 6, 12] };
function nearest(m, t) { let best = TERMS[m][0]; for (const n of TERMS[m]) if (Math.abs(n - t) < Math.abs(best - t)) best = n; return best; }
const chipState = p => p.evaluate(() => ({
  chips: [...document.querySelectorAll('.term-chip')].map(c => +c.getAttribute('data-term')),
  sel: [...document.querySelectorAll('.term-chip.is-selected')].map(c => +c.getAttribute('data-term')),
  checked: [...document.querySelectorAll('input[name="term"]:checked')].map(i => +i.value),
  term: SlicePay.getState().term, method: SlicePay.getState().method,
  mo: ([...document.querySelectorAll('.pay-mo__v')].find(x => x.getClientRects().length) || {}).textContent,
  ml: ([...document.querySelectorAll('.pay-mo__l')].find(x => x.getClientRects().length) || {}).textContent
}));
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('terms ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    try {
      await p.goto(L.BASE + '#/payment?demo=1'); await L.sleep(300);
      const s0 = await chipState(p);
      lg.check('default bog: chips 3/4/6, 4 selected, 150₾ 4 თვეში', JSON.stringify(s0.chips) === '[3,4,6]' && JSON.stringify(s0.sel) === '[4]' && s0.mo === '150₾' && s0.ml === '4 თვეში', s0);
      const copy = await p.evaluate(() => [document.querySelector('.terms__label').textContent, document.querySelector('.terms__note').textContent, [...document.querySelectorAll('.term-chip')].map(c => c.textContent)]);
      lg.check('label განვადების ვადა + note + chip copy', copy[0] === 'განვადების ვადა' && copy[1] === '0% საკომისიო · საბოლოო პირობებს ადგენს ბანკი' && copy[2][1] === '4 თვე150₾ / თვე', copy);
      // placement
      const place = await p.evaluate(() => {
        const t = [...document.querySelectorAll('.terms')].find(x => x.getClientRects().length), m = [...document.querySelectorAll('.methods')].find(x => x.getClientRects().length);
        const n = [...document.querySelectorAll('.pay-notes')].find(x => x.getClientRects().length);
        // (reconciler r2) on phones the .methods fieldset is full-bleed with padding 0 var(--m-card-x), so its border box is
        // 0–428 while the cards themselves sit at 14–414; the visual column is the cards' column, which .terms shares
        const cards = [...m.querySelectorAll('.method')].filter(x => x.getClientRects().length);
        const tr = t.getBoundingClientRect(), mb = m.getBoundingClientRect();
        const mr = { left: Math.min(...cards.map(c => c.getBoundingClientRect().left)), right: Math.max(...cards.map(c => c.getBoundingClientRect().right)) };
        return { tTop: tr.top, mBottom: mb.bottom, tW: tr.width, mW: mr.right - mr.left, tL: tr.left, mL: mr.left, boxW: mb.width, beforeNotes: n ? !!(t.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) : null };
      });
      lg.check('term block below the method cards, same column width', place.tTop >= place.mBottom && Math.abs(place.tW - place.mW) < 2 && Math.abs(place.tL - place.mL) < 2, place);
      if (W < 900) lg.check('mobile: term block before the bullet notes', place.beforeNotes === true, place);
      // every method -> every term -> every other method
      for (const from of ['bog', 'tbc', 'mere']) for (const t of TERMS[from]) for (const to of ['bog', 'tbc', 'mere']) {
        if (to === from) continue;
        await L.vis(p, `label.method[data-method="${from}"]`).click(); await L.sleep(40);
        await L.vis(p, `label.term-chip[data-term="${t}"]`).click(); await L.sleep(40);
        await L.vis(p, `label.method[data-method="${to}"]`).click(); await L.sleep(60);
        const s = await chipState(p), exp = nearest(to, t);
        const ok = JSON.stringify(s.chips) === JSON.stringify(TERMS[to]) && JSON.stringify(s.sel) === JSON.stringify([exp]) && JSON.stringify(s.checked) === JSON.stringify([exp]) && s.term === exp && s.method === to && s.mo === Math.ceil(600 / exp) + '₾' && s.ml === exp + ' თვეში';
        lg.check(`${from} ${t} -> ${to}: ${exp}`, ok, s);
      }
      // live region announces a changed term
      await L.vis(p, 'label.method[data-method="tbc"]').click(); await L.vis(p, 'label.term-chip[data-term="9"]').click();
      await L.vis(p, 'label.method[data-method="bog"]').click(); await L.sleep(200);
      const live = await p.evaluate(() => [...document.querySelectorAll('#pay-live')].map(e => e.textContent));
      lg.check('term change on method switch announced (pay-live)', live.some(x => /განვადების ვადა: 6 თვე, 100₾ \/ თვე/.test(x)), live);

      // keyboard: chips
      await p.goto(L.BASE + '#/payment?demo=1&method=tbc&term=4'); await L.sleep(300);
      await L.vis(p, 'input[name="term"]:checked').focus();
      const ringed = await p.evaluate(() => { const c = document.activeElement.closest('.term-chip'); return c ? getComputedStyle(c).outlineStyle : null; });
      await p.keyboard.press('ArrowRight'); await L.sleep(80);
      let s = await chipState(p);
      lg.check('ArrowRight on chip 4 -> 6 (state, monthly 100₾)', s.term === 6 && JSON.stringify(s.sel) === '[6]' && s.mo === '100₾', s);
      lg.info('focused chip outline style', ringed);
      await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await L.sleep(80);
      s = await chipState(p);
      lg.check('ArrowDown ×2 -> 12 (50₾)', s.term === 12 && s.mo === '50₾', s);
      await p.keyboard.press('ArrowRight'); await L.sleep(80);
      s = await chipState(p);
      lg.check('ArrowRight on last wraps to 3 (200₾)', s.term === 3 && s.mo === '200₾', s);
      await p.keyboard.press('ArrowLeft'); await L.sleep(80);
      lg.check('ArrowLeft wraps back to 12', (await chipState(p)).term === 12);
      const fv = await p.evaluate(() => { const c = document.activeElement.closest('.term-chip'); return c ? getComputedStyle(c).outlineStyle + ' ' + getComputedStyle(c).outlineColor : 'no chip focused: ' + (document.activeElement && document.activeElement.outerHTML.slice(0, 80)); });
      lg.check('keyboard focus ring visible on the chip', /solid/.test(fv), fv);
      // keyboard: method radios (arrow) re-render the chips; focus stays on the method
      await L.vis(p, 'input[name="method"]:checked').focus();
      await p.keyboard.press('ArrowRight'); await L.sleep(120);   // tbc -> mere
      s = await chipState(p);
      const act = await p.evaluate(() => document.activeElement && document.activeElement.name + ':' + document.activeElement.value);
      lg.check('ArrowRight on method tbc -> mere; term 12 kept; focus on the mere radio', s.method === 'mere' && s.term === 12 && act === 'method:mere', { s, act });
      await p.keyboard.press('ArrowRight'); await L.sleep(120);   // mere -> bog (wrap)
      s = await chipState(p);
      lg.check('method mere -> bog: 12 -> 6', s.method === 'bog' && s.term === 6 && s.mo === '100₾', s);
      // Tab from the method group reaches the chips, then onward
      await p.keyboard.press('Tab'); await L.sleep(50);
      const a1 = await p.evaluate(() => document.activeElement && document.activeElement.name + ':' + document.activeElement.value);
      lg.check('Tab from methods -> the checked chip', a1 === 'term:6', a1);

      // ?term=
      for (const [q, exp] of [['term=6', 6], ['method=bog&term=12', 6], ['method=mere&term=3', 4], ['method=tbc&term=9', 9], ['method=tbc&term=10', 9], ['term=7', 6], ['term=abc', 4], ['method=tbc&term=11', 12]]) {
        await p.goto(L.BASE + '#/payment?demo=1&' + q); await L.sleep(250);
        const s2 = await chipState(p);
        lg.check(`?${q} -> term ${exp}`, s2.term === exp && JSON.stringify(s2.sel) === JSON.stringify([exp]), s2);
      }
      // the cart summary shows the chosen term
      await p.goto(L.BASE + '#/payment?demo=1&method=tbc&term=12'); await L.sleep(250);
      await L.go(p, '#/cart'); await L.sleep(200);
      const cl = await L.txt(p, '.cart-sum__mo-l'), cm = await L.txt(p, '.cart-sum__mo');
      lg.check('cart summary 12 თვეში / 50₾', cl === '12 თვეში' && cm === '50₾', [cl, cm]);
      // big total: chips stay readable (no overflow) with 5 chips
      await p.evaluate(() => { const s = SlicePay.state(); s.products[0].qty = 25; SlicePay.save(); });
      await L.go(p, '#/payment'); await L.sleep(250);
      const ov = await p.evaluate(() => [...document.querySelectorAll('.term-chip')].filter(c => c.getClientRects().length).map(c => [c.scrollWidth <= c.clientWidth + 1, c.querySelector('.term-chip__m').textContent]));
      lg.check('qty 25 (15000₾): every chip fits its text', ov.every(x => x[0]) && (await L.noOverflow(p)), ov);
      await L.shot(p, 'terms_big_' + W);
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    await ctx.close();
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

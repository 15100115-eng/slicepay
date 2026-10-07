// ported from scratchpad tools/v2f_terms.js
// Term chips: availability per method, fallback on method switch, keyboard, QA param, cart label, layout
const L = require('../../lib/harness');
const TERMS = { bog: [3, 4, 6], tbc: [3, 4, 6, 9, 12], mere: [4, 6, 12] };
function nearest(m, t) { let best = TERMS[m][0]; TERMS[m].forEach(n => { if (Math.abs(n - t) < Math.abs(best - t)) best = n; }); return best; }
// v3 reconcile: the desktop payment monthly reads label-first ('6 თვეში' then '100₾', payment fixer v2 r1); mobile keeps amount-first
const moStr = (W, mo, term) => W >= 900 ? term + 'თვეში' + mo + '₾' : mo + '₾' + term + 'თვეში';
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('terms ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    await p.goto(L.BASE + '#/payment?demo=1'); await L.sleep(400);
    const read = () => p.evaluate(() => ({
      chips: [...document.querySelectorAll('#terms .term-chip')].map(c => ({ t: +c.dataset.term, n: c.querySelector('.term-chip__n').textContent, m: c.querySelector('.term-chip__m').textContent, sel: c.classList.contains('is-selected'), checked: c.querySelector('input').checked })),
      label: (document.querySelector('.terms__label') || {}).textContent, note: (document.querySelector('.terms__note') || {}).textContent,
      mo: (document.getElementById('pay-mo') || {}).textContent, term: SlicePay.getState().term, method: SlicePay.getState().method,
    }));
    let r = await read();
    lg.check('label + note copy', r.label === 'განვადების ვადა' && r.note === '0% საკომისიო · საბოლოო პირობებს ადგენს ბანკი', [r.label, r.note]);
    lg.check('bog chips 3/4/6 with 200/150/100₾', r.chips.map(c => c.n + '|' + c.m).join(',') === '3 თვე|200₾ / თვე,4 თვე|150₾ / თვე,6 თვე|100₾ / თვე', r.chips);
    lg.check('default 4 selected + checked', r.chips.filter(c => c.sel && c.checked).map(c => c.t).join() === '4' && r.term === 4);
    const style = await p.evaluate(() => { const s = document.querySelector('.term-chip.is-selected'), u = document.querySelector('.term-chip:not(.is-selected)'); const a = getComputedStyle(s), c = getComputedStyle(u); return { selBg: a.backgroundColor, selBorder: a.borderColor + ' ' + a.borderWidth, selColor: getComputedStyle(s.querySelector('.term-chip__n')).color, unBorder: c.borderColor + ' ' + c.borderWidth, radius: c.borderRadius, nSize: getComputedStyle(u.querySelector('.term-chip__n')).fontSize, mSize: getComputedStyle(u.querySelector('.term-chip__m')).fontSize, mColor: getComputedStyle(u.querySelector('.term-chip__m')).color }; });
    lg.check('chip styles (#f3efff/#5e34ec selected, #d3d3d3 1px r8, 16/14px #666)', style.selBg === 'rgb(243, 239, 255)' && /rgb\(94, 52, 236\)/.test(style.selBorder) && style.selColor === 'rgb(94, 52, 236)' && /rgb\(211, 211, 211\) 1px/.test(style.unBorder) && style.radius === '8px' && style.nSize === '16px' && style.mSize === '14px' && style.mColor === 'rgb(102, 102, 102)', style);
    // placement
    const pos = await p.evaluate(() => { const t = document.getElementById('terms').getBoundingClientRect(), ms = document.querySelector('.methods').getBoundingClientRect(), n = document.querySelector('.pay-notes'); return { tTop: t.top, tW: t.width, tL: t.left, mBottom: ms.bottom, mL: ms.left, mW: ms.width, nTop: n ? n.getBoundingClientRect().top : null }; });
    lg.check('chips below the method cards' + (W < 900 ? ' and above the notes' : ', full method-column width'), pos.tTop >= pos.mBottom && (W < 900 ? pos.nTop > pos.tTop : Math.abs(pos.tW - pos.mW) < 2 && Math.abs(pos.tL - pos.mL) < 2), pos);

    // fallback matrix through the UI
    const methods = ['bog', 'tbc', 'mere'];
    const clickMethod = async m => { await L.vis(p, 'label.method[data-method="' + m + '"]').click(); await L.sleep(60); };
    const clickTerm = async t => { await L.vis(p, 'label.term-chip[data-term="' + t + '"]').click(); await L.sleep(60); };
    for (const from of methods) for (const t of TERMS[from]) for (const to of methods) {
      if (to === from) continue;
      await clickMethod(from); await clickTerm(t);
      r = await read();
      if (r.term !== t || r.method !== from) { lg.check(`select ${from} ${t}`, false, r); continue; }
      await clickMethod(to);
      r = await read();
      const exp = nearest(to, t);
      const chipsOk = r.chips.map(c => c.t).join() === TERMS[to].join() && r.chips.filter(c => c.sel && c.checked).map(c => c.t).join() === String(exp);
      const moOk = r.mo.replace(/\s/g, '') === moStr(W, Math.ceil(600 / exp), exp);
      lg.check(`${from} ${t} -> ${to}: term ${exp}`, r.term === exp && chipsOk && moOk, { term: r.term, mo: r.mo, chips: r.chips.map(c => c.t + (c.sel ? '*' : '') + (c.checked ? 'c' : '')).join(' ') });
    }
    // chip monthly amounts tbc
    await clickMethod('tbc');
    r = await read();
    lg.check('tbc chip amounts 200/150/100/67/50', r.chips.map(c => c.m).join(',') === '200₾ / თვე,150₾ / თვე,100₾ / თვე,67₾ / თვე,50₾ / თვე', r.chips.map(c => c.m));
    // keyboard
    await clickTerm(4);
    await p.focus('#term-4'); await p.keyboard.press('ArrowRight'); await L.sleep(80);
    r = await read();
    lg.check('ArrowRight 4 -> 6 (state, chip, monthly)', r.term === 6 && r.chips.find(c => c.t === 6).sel && r.mo.replace(/\s/g, '') === moStr(W, 100, 6) && (await L.active(p)) === 'term-6', [r.term, r.mo, await L.active(p)]);
    await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await L.sleep(80);
    r = await read();
    lg.check('ArrowLeft x2 -> 3', r.term === 3, r.term);
    await p.keyboard.press('ArrowLeft'); await L.sleep(80);
    r = await read();
    lg.check('ArrowLeft wraps 3 -> 12', r.term === 12, r.term);
    const fr = await p.evaluate(() => { const l = document.activeElement.closest('.term-chip'); const cs = getComputedStyle(l); return [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow].join(' | '); });
    lg.check('focused chip shows a focus ring', !/^none/.test(fr) || /rgb/.test(fr.split(' | ')[3]), fr);
    // Tab from the methods group lands on the checked chip (one tab stop)
    await p.focus('#method-tbc');
    await p.keyboard.press('Tab');
    lg.check('Tab from methods -> checked chip', (await L.active(p)) === 'term-12', await L.active(p));
    // space on a focused non-checked? (native) skip
    // cart shows the chosen term
    await clickMethod('mere'); await clickTerm(6);
    await L.go(p, '#/cart'); await L.sleep(200);
    const cartMo = await p.evaluate(() => [...document.querySelectorAll('.cart-sum__mo-l')].filter(e => e.getClientRects().length).map(e => e.textContent + ' ' + e.parentElement.querySelector('.cart-sum__mo').textContent));
    lg.check('cart summary shows "6 თვეში" 100₾', cartMo.length === 1 && cartMo[0] === '6 თვეში 100₾', cartMo);
    // toggling a checkbox in the cart keeps term label
    await p.click('#defer-weight', { force: true }); await L.sleep(150);
    const cartMo2 = await p.evaluate(() => [...document.querySelectorAll('.cart-sum__mo-l')].filter(e => e.getClientRects().length).map(e => e.textContent + ' ' + e.parentElement.querySelector('.cart-sum__mo').textContent));
    lg.check('cart: weight paid now -> 700/6 = 117₾, still 6 თვეში', cartMo2[0] === '6 თვეში 117₾', cartMo2);
    await p.click('#defer-weight', { force: true }); await L.sleep(100);
    // QA param term
    for (const [q, exp] of [['term=6', 6], ['term=9', 6], ['term=5', 4], ['method=mere&term=5', 4], ['method=tbc&term=9', 9], ['method=mere&term=3', 4], ['method=tbc&term=12', 12], ['term=0', 4], ['term=abc', 4]]) {   // v3 reconcile: ?term=0 is not a term, so it falls back to the default 4 like ?term=abc (core nearestTerm(+v || 4), BUILD_NOTES)
      await p.goto(L.BASE + '#/payment?demo=1&' + q); await L.sleep(250);
      r = await read();
      lg.check('?' + q + ' -> ' + exp, r.term === exp && r.chips.find(c => c.sel).t === exp, [r.term, r.chips.filter(c => c.sel).map(c => c.t)]);
    }
    // layout at 320 and 375 with 5 chips
    if (W < 900) {
      for (const w of [320, 375]) {
        await p.setViewportSize({ width: w, height: 735 });
        await p.goto(L.BASE + '#/payment?demo=1&method=tbc&weight=0&customs=0&delivery=courier'); await L.sleep(300);
        const lay = await p.evaluate(() => { const cs = [...document.querySelectorAll('.term-chip')].map(c => c.getBoundingClientRect()); return { rows: new Set(cs.map(c => Math.round(c.top))).size, minW: Math.min(...cs.map(c => c.width)), overflow: document.documentElement.scrollWidth > innerWidth, clipped: [...document.querySelectorAll('.term-chip__m')].some(e => e.scrollWidth > e.clientWidth + 1) }; });
        lg.check(w + 'px: 5 chips wrap, no overflow / clipping (955₾ total)', !lay.overflow && !lay.clipped, lay);
        await L.shot(p, 'terms_tbc_' + w);
      }
      await p.setViewportSize({ width: 428, height: 735 });
    } else {
      await p.goto(L.BASE + '#/payment?demo=1&method=tbc&weight=0&customs=0'); await L.sleep(300);
      await L.shot(p, 'terms_tbc_1440');
    }
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

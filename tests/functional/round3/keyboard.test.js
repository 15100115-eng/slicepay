// ported from scratchpad tools/v2r3_kb.js
// v2 functional QA round 3 — keyboard-only purchase + orders flow (Tab / arrows / Enter / Space / Esc only),
// focus visibility at every stop, no invisible tab stops
const L = require('../../lib/harness');
const FOCUS = () => {
  const a = document.activeElement; if (!a || a === document.body) return { id: 'BODY' };
  const r = a.getBoundingClientRect(), cs = getComputedStyle(a);
  // the visual focus indicator may be on the element, its chip/card/check box or (for sr-only inputs) a sibling
  const host = a.closest('.term-chip,.rcard,.method,.check,.ord-card') || a;
  const hs = getComputedStyle(host);
  const sib = a.nextElementSibling ? getComputedStyle(a.nextElementSibling) : null;
  const ring = cs.outlineStyle !== 'none' && cs.outlineWidth !== '0px' || /rgb/.test(cs.boxShadow) && cs.boxShadow !== 'none' ||
    hs.outlineStyle !== 'none' && hs.outlineWidth !== '0px' || (sib && sib.outlineStyle !== 'none' && sib.outlineWidth !== '0px') || cs.borderColor === 'rgb(94, 52, 236)';
  const vis = r.width > 0 && r.height > 0 || host !== a;
  const inView = r.bottom > 0 && r.top < innerHeight;
  return { id: a.id || '', tag: a.tagName, name: a.getAttribute('name') || '', val: a.value || '', txt: (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40),
    act: a.getAttribute('data-action') || a.getAttribute('data-back') || a.getAttribute('data-explain') || a.getAttribute('data-order') || '', ring, vis, inView, sr: a.classList.contains('sr-only') };
};
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('kb ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const stops = [];
    async function tabTo(pred, max = 40, label = '') {
      for (let k = 0; k < max; k++) {
        await p.keyboard.press('Tab'); await L.sleep(30);
        const f = await p.evaluate(FOCUS);
        stops.push(Object.assign({ at: (await L.H(p)).replace(/\?.*/, '') }, f));
        if (pred(f)) return f;
      }
      throw new Error('tabTo failed: ' + label + ' @ ' + (await L.H(p)));
    }
    const key = async k => { await p.keyboard.press(k); await L.sleep(60); };
    const type = async t => { await p.keyboard.type(t); await L.sleep(30); };
    try {
      await p.goto(L.BASE + '#/'); await L.sleep(300);
      await tabTo(f => f.id === 'url', 10, 'url');
      await type('https://www.amazon.com/Dyson-V15-Detect/dp/B0DYSON001'); await key('Enter');
      await L.waitHash(p, /^#\/cart/, 8000); await L.sleep(300);
      // explanation link by keyboard
      await tabTo(f => f.act === 'all', 30, 'explain link');
      await key('Enter'); await L.sleep(400);
      lg.check('cart: explanation opened by Enter', await p.evaluate(() => document.getElementById('modal').open));
      await key('Escape'); await L.sleep(300);
      let f = await p.evaluate(FOCUS);
      lg.check('Esc: focus back on the link with a visible ring', f.act === 'all' && f.ring, f);
      // weight checkbox via Space
      await p.keyboard.down('Shift'); await key('Tab'); await p.keyboard.up('Shift');
      f = await p.evaluate(FOCUS);
      if (f.id === 'defer-customs') { await key(' '); lg.check('Space toggles the customs checkbox', (await L.st(p)).deferCustoms === false); await key(' '); }
      else lg.info('shift-tab from link landed on', f);
      await tabTo(f => f.act === 'next' && f.vis, 30, 'cart next');
      await key('Enter'); await L.waitHash(p, /^#\/register/); await L.sleep(250);
      // register by keyboard
      await tabTo(f => f.id === 'reg-first', 10); await type('თამარ');
      await key('Tab'); await type('ჯაფარიძე');
      await key('Tab'); await type('593' + String(W).slice(-3) + '444');
      await key('Tab');
      f = await p.evaluate(FOCUS);
      if (f.id !== 'reg-pass') f = await tabTo(f => f.id === 'reg-pass', 5);
      await type('parolT123');
      await tabTo(f => f.id === 'reg-email', 5); await type('t@example.com');
      await tabTo(f => f.id === 'reg-terms', 10); await key(' ');
      lg.check('Space checks the terms box', await p.isChecked('#reg-terms'));
      await key('Enter'); await L.waitHash(p, /^#\/register\/verify/); await L.sleep(250);
      const code = (await L.st(p)).pendingReg.code;
      await tabTo(f => f.id === 'verify-code', 10); await type(code); await key('Enter');
      lg.check('verify by keyboard -> delivery', (await L.waitHash(p, /^#\/delivery/)) === '#/delivery');
      await L.sleep(250);
      // delivery by keyboard
      f = await p.evaluate(FOCUS);
      lg.info('focus on delivery entry', f);
      await tabTo(f => f.id === 'd-pid', 10); await type('01001012345');
      f = await tabTo(f => f.name === 'dmethod', 5, 'method radio');
      lg.check('method radio focus visible (card ring)', f.ring, f);
      await key('ArrowRight'); await L.sleep(100);
      lg.check('ArrowRight -> courier selected + panel shown', (await p.isChecked('input[name="dmethod"][value="courier"]')) && await p.isVisible('#d-city'));
      f = await tabTo(f => f.id === 'd-city', 5, 'city');
      // select by keyboard: type-ahead
      await type('ქ'); await L.sleep(100);
      let city = await p.inputValue('#d-city');
      if (!city) { await key('ArrowDown'); await L.sleep(100); city = await p.inputValue('#d-city'); }
      if (!city) { await key('Enter'); await L.sleep(100); city = await p.inputValue('#d-city'); }
      if (!city) { lg.info('native select popup not drivable in headless mac Chromium: selectOption used'); await p.selectOption('#d-city', 'ქუთაისი'); city = await p.inputValue('#d-city'); }
      lg.check('city chosen', !!city, city);
      lg.info('city after keyboard', city);
      await tabTo(f => f.id === 'd-addr', 5); await type('რუსთაველის 22');
      await tabTo(f => f.id === 'd-note', 5); await type('ბ. 3');
      await key('Enter');
      lg.check('Enter in a field submits delivery -> payment', (await L.waitHash(p, /^#\/payment/)) === '#/payment', await L.H(p));
      await L.sleep(250);
      // payment: methods + chips
      f = await tabTo(f => f.name === 'method', 15, 'method');
      await key('ArrowRight'); await L.sleep(120);
      lg.check('payment: arrow -> tbc', (await L.st(p)).method === 'tbc');
      f = await tabTo(f => f.name === 'term', 5, 'term');
      lg.check('Tab reaches the checked chip (4) with a ring', f.val === '4' && f.ring, f);
      await key('ArrowRight'); await key('ArrowRight'); await L.sleep(100);
      lg.check('arrows on chips -> 9', (await L.st(p)).term === 9, (await L.st(p)).term);
      // details toggle + info button by keyboard
      if (W >= 900) {
        f = await tabTo(f => f.id === 'pay-toggle', 10, 'toggle');
      } else {
        await p.keyboard.down('Shift');
        for (let k = 0; k < 15; k++) { await key('Tab'); const g = await p.evaluate(FOCUS); if (g.id === 'pay-toggle') break; }
        await p.keyboard.up('Shift');
      }
      await key('Enter'); await L.sleep(350);
      f = await tabTo(f => f.act === 'weight', 5, 'info weight');
      lg.check('payment info button: visible ring', f.ring && f.vis, f);
      await key('Enter'); await L.sleep(400);
      await key('Escape'); await L.sleep(300);
      f = await p.evaluate(FOCUS);
      lg.check('Esc returns focus to the info button', f.act === 'weight', f);
      f = await tabTo(x => x.act === 'next' && x.vis, 25, 'payment next');
      await key('Enter'); await L.waitHash(p, /^#\/pay$/); await L.sleep(250);
      await tabTo(x => x.id === 'cc-num', 15); await type('4242424242424242');
      await key('Tab'); await type('1230'); await key('Tab'); await type('123'); await key('Enter');
      lg.check('card form by keyboard -> success', /^#\/success/.test(await L.waitHash(p, /^#\/success/, 6000)));
      await L.sleep(300);
      f = await p.evaluate(FOCUS);
      lg.info('success focus', f);
      f = await tabTo(x => x.act === 'orders', 10, 'my orders btn');
      lg.check('ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ reachable with ring', f.ring, f);
      await key('Enter'); await L.waitHash(p, /^#\/orders$/); await L.sleep(250);
      const oid = (await L.st(p)).order.id;
      f = await tabTo(x => x.act === oid, 10, 'order card');
      lg.check('order card link focus visible', f.ring, f);
      await key('Enter'); await L.waitHash(p, /^#\/orders\//); await L.sleep(250);
      lg.check('Enter opens the order detail', (await L.H(p)) === '#/orders/' + oid);
      // pending deferred rows have info buttons
      f = await tabTo(x => x.act === 'weight' || x.act === 'customs', 15, 'detail info');
      await key('Enter'); await L.sleep(400);
      lg.check('detail info opened by keyboard', await p.evaluate(() => document.getElementById('modal').open));
      await key('Escape'); await L.sleep(300);
      lg.check('Esc returns focus to the detail info button', /weight|customs/.test((await p.evaluate(FOCUS)).act));
      // logout via keyboard
      // v4: the orders heading link is პროფილი; ᲒᲐᲡᲕᲚᲐ lives on #/profile
      await L.go(p, '#/orders'); await L.sleep(200);
      f = await tabTo(x => x.tag === 'A' && x.txt === 'პროფილი', 10, 'პროფილი');
      await key('Enter'); await L.sleep(300);
      lg.check('პროფილი by keyboard -> #/profile', (await L.H(p)) === '#/profile', await L.H(p));
      f = await tabTo(x => x.act === 'logout', 30, 'logout');
      await key('Enter'); await L.sleep(300);
      lg.check('logout by keyboard -> landing', (await L.H(p)).replace(/\?.*/, '') === '#/', await L.H(p));
    } catch (e) { lg.check('script error', false, String(e).slice(0, 400)); }
    const noRing = stops.filter(s => s.id !== 'BODY' && !s.ring && !s.sr);
    const invisible = stops.filter(s => s.id !== 'BODY' && !s.vis);
    lg.check('every keyboard stop has a visible focus indicator', noRing.length === 0, noRing.slice(0, 8));
    lg.check('no invisible tab stops', invisible.length === 0, invisible.slice(0, 8));
    require('fs').writeFileSync(L.OUT + '/kb_stops_' + W + '.json', JSON.stringify(stops, null, 1));
    await ctx.close();
    lg.summary();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

// ported from scratchpad tools/v3core_verify.js
// v3 polish — core: verifies every core finding of R3_LOW.json (+ the shared parts of v2f-r3-02, REV2R3-03, REV2R3-08)
const L = require('../lib/harness');
const fs = require('fs');
const OUT = L.OUT;
fs.mkdirSync(OUT, { recursive: true });
const T0 = new Date('2026-10-07T10:00:00');
const vtxt = (p, s) => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, s);

(async () => {
  const b = await L.launch();
  const allErrs = {};
  const fails = [];
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('v3core ' + W);

    /* auth-v2r3-03: QA seed verify → change number → same number → verify 4821 */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/?auth=0'); await L.sleep(200);
        await L.go(p, '#/register/verify?demo=1');
        await L.vis(p, '.auth__change').click(); await L.waitHash(p, /^#\/register$/); await L.sleep(200);
        lg.check('auth-v2r3-03 register prefilled with 555 123 456', (await p.inputValue('#reg-phone')) === '555 123 456');
        await p.fill('#reg-pass', 'whatever12');
        await p.click('#auth-submit'); await L.sleep(400);
        const h = await L.H(p), t = await L.toast(p);
        lg.check('auth-v2r3-03 resubmit the demo number → verify (not "already exists")', /^#\/register\/verify/.test(h), { h, note: await L.tc(p, '#reg-phone-err') });
        lg.check('auth-v2r3-03 the seed code 4821 is re-sent', /4821/.test(t), t);
        const s1 = await L.st(p);
        lg.check('auth-v2r3-03 pending registration stays the demo one', s1.pendingReg && s1.pendingReg.demo === true, s1.pendingReg && s1.pendingReg.demo);
        const h2 = await L.verify(p, '4821');
        lg.check('auth-v2r3-03 verify 4821 → signed in as the demo user', /^#\/(orders|delivery)/.test(h2) && (await L.st(p)).userPhone === '555123456', h2);
        // a real existing number (not the demo seed) is still refused
        await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
        await L.go(p, '#/register'); await L.sleep(150);
        await L.register(p, { first: 'ა', last: 'ბ', phone: '555 123 456', pass: 'whatever12', email: 'a@b.ge' }).catch(() => {});
        await L.sleep(200);
        lg.check('auth-v2r3-03 a normal registration of an existing number is still refused', /^#\/register$/.test(await L.H(p)) && /უკვე არსებობს/.test(await L.tc(p, '#reg-phone-err') || ''), await L.H(p));
      } catch (e) { lg.check('auth script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }

    /* REV2R3-02: verify send log pruned (sign-out within 30 s keeps the cooldown; after it nothing lingers) */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/register'); await L.sleep(200);
        const code = await L.register(p, { first: 'ნინო', last: 'ხ', phone: '599 111 222', pass: 'password12', email: 'n@x.ge' });
        await L.verify(p, code); await L.sleep(200);
        await L.go(p, '#/orders'); await L.sleep(200);
        await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
        const inCd = await p.evaluate(() => sessionStorage.getItem('slicepay.verifySent'));
        lg.check('REV2R3-02 sign-out inside the 30 s cooldown keeps the entry (cooldown not reset)', inCd && /599111222/.test(inCd), inCd);
        await p.clock.fastForward(31000); await L.sleep(100);
        await L.go(p, '#/'); await L.sleep(100);
        await p.evaluate(() => SlicePay.logout()); await L.sleep(300);
        const after = await p.evaluate(() => sessionStorage.getItem('slicepay.verifySent'));
        lg.check('REV2R3-02 sign-out after the cooldown removes the number and code', after === null, after);
        // prune on read: a stale entry written directly is gone after the next read (a registration of another number)
        await p.evaluate(() => sessionStorage.setItem('slicepay.verifySent', JSON.stringify({ 599000111: { code: '1111', sentAt: Date.now() - 60000, expiresAt: Date.now() + 240000 } })));
        await L.go(p, '#/register'); await L.sleep(200);
        await L.register(p, { first: 'ა', last: 'ბ', phone: '599 222 333', pass: 'password12', email: 'a@b.ge' });
        const log2 = JSON.parse(await p.evaluate(() => sessionStorage.getItem('slicepay.verifySent')) || '{}');
        lg.check('REV2R3-02 stale entries pruned on read', !log2['599000111'] && !!log2['599222333'], Object.keys(log2));
      } catch (e) { lg.check('REV2R3-02 script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }

    /* REV2R3-01 / v2f-r3-03: forced id collision */
    {
      const { ctx, p } = await L.newCtx(b, W, errs);
      try {
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(300);
        const before = await p.evaluate(() => SlicePay.orders.list().map(o => o.id + ':' + o.status + ':' + o.total));
        await p.goto(L.BASE + '#/pay?demo=1'); await L.sleep(300);
        await p.evaluate(() => { window.__r = Math.random; Math.random = () => (731954 - 100000 + 0.2) / 900000; });
        await L.payCard(p); await L.sleep(300);
        await p.evaluate(() => { Math.random = window.__r; });
        const after = await p.evaluate(() => SlicePay.orders.list().map(o => o.id + ':' + o.status + ':' + o.total));
        const nid = (await L.st(p)).order.id;
        lg.check('REV2R3-01 the in-customs #731954 (350₾ due) survives', after.includes('731954:customs:600') && after.includes('548210:delivered:745'), { before, after });
        lg.check('REV2R3-01 the new order got another free id and is stored', /^\d{6}$/.test(nid) && !['731954', '548210', '123456'].includes(nid) && after.some(x => x.startsWith(nid + ':processing')) /* v4: new orders start at processing */, { nid, after });
        lg.check('REV2R3-01 success receipt shows the stored id', (await L.appText(p)).includes(nid), nid);
        // save() never overwrites a different order silently
        const r = await p.evaluate(() => {
          const o = { id: '548210', uid: 'other', date: SlicePay.fmt.todayIso(), createdAt: Date.now(), products: [], status: 'ordered', total: 1, term: 4 };
          const saved = SlicePay.orders.save(o);
          return { id: saved.id, list: SlicePay.orders.list().map(x => x.id + ':' + x.status) };
        });
        lg.check('REV2R3-01 save of a different order with a taken id keeps the old one (new id)', r.id !== '548210' && r.list.includes('548210:delivered') && r.list.includes(r.id + ':ordered'), r);
        // updating the same order (payDeferred) still works in place
        const r2 = await p.evaluate(() => { SlicePay.payDeferred('731954'); return SlicePay.orders.list().filter(x => x.id === '731954').map(x => x.status + ':' + SlicePay.orderDue(x).total); });
        lg.check('REV2R3-01 same-order updates still save in place', r2.length === 1 && r2[0] === 'ready:0', r2);
        // the QA receipt id still replaces deliberately (one 123456)
        await p.goto(L.BASE + '#/success?demo=1'); await L.sleep(250);
        await p.goto(L.BASE + '#/success?demo=1&anim=0'); await L.sleep(250);
        const n123 = await p.evaluate(() => SlicePay.orders.list().filter(x => x.id === '123456').length);
        lg.check('REV2R3-01 the fabricated QA receipt keeps replacing itself (one #123456)', n123 === 1, n123);
      } catch (e) { lg.check('REV2R3-01 script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }

    /* v2f-r3-01: Forward onto the paid card form */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(250);
        await p.click('.ord-card__link[data-order="731954"]'); await L.waitHash(p, /^#\/orders\/731954/); await L.sleep(200);
        await L.vis(p, '[data-action="pay"]').click(); await L.waitHash(p, /^#\/pay\?order/);
        await L.payCard(p); await L.sleep(400);
        lg.check('v2f-r3-01 paid → detail', (await L.H(p)) === '#/orders/731954');
        await p.goForward(); await L.sleep(600);
        lg.check('v2f-r3-01 Forward onto the paid card form → detail', (await L.H(p)) === '#/orders/731954', await L.H(p));
        await p.goBack(); await L.sleep(600);
        lg.check('v2f-r3-01 then Back leaves the detail (no dead step)', /^#\/orders(\?demo=1)?$/.test(await L.H(p)), await L.H(p));
        await p.goForward(); await L.sleep(600);
        await p.goForward(); await L.sleep(600);
        lg.check('v2f-r3-01 Forward twice: detail again (paid entry stepped over)', (await L.H(p)) === '#/orders/731954', await L.H(p));
        await p.goBack(); await L.sleep(600);
        lg.check('v2f-r3-01 Back again reaches the list', /^#\/orders(\?demo=1)?$/.test(await L.H(p)), await L.H(p));
        // a fresh deep link to a paid order's card form is still replaced with the detail
        await L.go(p, '#/pay?order=731954'); await L.sleep(300);
        lg.check('v2f-r3-01 fresh #/pay?order=<paid> → detail (replace)', (await L.H(p)) === '#/orders/731954', await L.H(p));
      } catch (e) { lg.check('v2f-r3-01 script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }

    /* v2f-r3-04: ?info= once per entry; focus after Esc on the heading */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/payment?demo=1&info=weight'); await L.sleep(500);
        const op = await p.evaluate(() => document.getElementById('modal').open);
        lg.check('v2f-r3-04 ?info=weight opens the explanation', op);
        await p.keyboard.press('Escape'); await L.sleep(400);
        const f = await p.evaluate(() => { const a = document.activeElement; return a ? a.tagName : null; });
        lg.check('v2f-r3-04 Esc → focus on the screen heading, not BODY', f === 'H1', f);
        await L.go(p, '#/orders/731954?demo=1'); await L.sleep(300);
        await p.goBack(); await L.sleep(500);
        const s = await p.evaluate(() => ({ h: location.hash, open: document.getElementById('modal').open, ov: document.documentElement.style.overflow }));
        lg.check('v2f-r3-04 Back onto the ?info= entry does not reopen it / lock scroll', s.h === '#/payment?demo=1&info=weight' && !s.open && s.ov === '', s);
        await p.goForward(); await L.sleep(400); await p.goBack(); await L.sleep(500);
        const s2 = await p.evaluate(() => ({ open: document.getElementById('modal').open }));
        lg.check('v2f-r3-04 (again after Forward/Back)', !s2.open, s2);
        for (const k of ['weight', 'customs', 'all']) {
          await p.goto(L.BASE + '#/cart?demo=1&info=' + k); await L.sleep(500);
          await p.keyboard.press('Escape'); await L.sleep(400);
          const f2 = await p.evaluate(() => document.activeElement && document.activeElement.tagName);
          lg.check('v2f-r3-04 cart ?info=' + k + ' Esc → H1', f2 === 'H1', f2);
        }
        // the real path: info button → Esc → focus back on the button
        await p.goto(L.BASE + '#/cart?demo=1&details=1'); await L.sleep(300);
        await L.vis(p, '.info-btn[data-explain="weight"]').click(); await L.sleep(400);
        await p.keyboard.press('Escape'); await L.sleep(400);
        const f3 = await p.evaluate(() => { const a = document.activeElement; return a && a.getAttribute('data-explain'); });
        lg.check('v2f-r3-04 info button → Esc: focus back on the button', f3 === 'weight', f3);
      } catch (e) { lg.check('v2f-r3-04 script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }

    /* v2f-r3-02 (shared): unconfirmed courier draft → cart ETA pickup-based; confirmed courier → cart = payment */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/cart?demo=1'); await L.sleep(250);
        const eta0 = await vtxt(p, '.cart-eta__line .eta-line__v');
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(150);
        await L.delivery(p, { pid: '01001012345', method: 'courier', city: 'ბათუმი', addr: 'ჭავჭავაძის 9' }, false);
        await L.vis(p, '[data-back]').click(); await L.waitHash(p, /^#\/cart/); await L.sleep(250);
        const c = { eta: await vtxt(p, '.cart-eta__line .eta-line__v'), tot: await vtxt(p, '.cart-sum__total'), fee: await vtxt(p, '.cart-sum__fee') };
        lg.check('v2f-r3-02 unconfirmed courier draft: cart ETA = pickup window, no fee', c.eta === eta0 && c.tot === 'სულ 600₾' && !c.fee, { eta0, c });
        const cs = await p.evaluate(() => { const s = SlicePay.checkoutSummary(); return { m: s.delivery.method, fee: s.fee, total: s.totals.total, eta: s.etaText, confirmed: s.confirmed }; });
        lg.check('v2f-r3-02 SP.checkoutSummary before confirmation: pickup, fee 0', cs.m === 'pickup' && cs.fee === 0 && cs.total === 600 && !cs.confirmed && cs.eta === eta0, cs);
        // confirm it: payment and the shared summary agree
        await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(150);
        await p.click('#dlv-submit'); await L.waitHash(p, /^#\/payment/); await L.sleep(250);
        const pay = { eta: await vtxt(p, '#pay-eta .eta-line__v') || await vtxt(p, '.pay-eta .eta-line__v') };
        const cs2 = await p.evaluate(() => { const s = SlicePay.checkoutSummary(), t = SlicePay.totals(); return { fee: s.fee, total: s.totals.total, mo: s.totals.monthly, eta: s.etaText, tt: t.total, tm: t.monthly, conf: s.confirmed }; });
        lg.check('v2f-r3-02 confirmed courier Batumi: summary fee 10, total 610 = SP.totals, ETA = payment ETA', cs2.fee === 10 && cs2.total === 610 && cs2.tt === 610 && cs2.mo === cs2.tm && cs2.conf && cs2.eta === pay.eta, { cs2, pay });
        await L.vis(p, '[data-back]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
        await L.vis(p, '[data-back]').click(); await L.waitHash(p, /^#\/cart/); await L.sleep(250);
        const c2 = { eta: await vtxt(p, '.cart-eta__line .eta-line__v'), tot: await vtxt(p, '.cart-sum__total'), fee: await vtxt(p, '.cart-sum__fee') };
        lg.info('cart after Back from payment (delivery.done=' + (await L.st(p)).delivery.done + ')', c2);
        // an order snapshot through the same helper
        const os = await p.evaluate(() => { const o = SlicePay.orders.get('548210'); const s = SlicePay.checkoutSummary(o); return { fee: s.fee, total: s.totals.total, ot: o.total, eta: s.etaText, oeta: SlicePay.etaText(o.eta) }; });
        lg.check('v2f-r3-02 SP.checkoutSummary(order) = the stored order', os.fee === 5 && os.total === os.ot && os.eta === os.oeta, os);
      } catch (e) { lg.check('v2f-r3-02 script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }

    /* REV2R3-05, REV2R3-08, REV2R3-03: API probes */
    {
      const { ctx, p } = await L.newCtx(b, W, errs, { clock: T0 });
      try {
        await p.goto(L.BASE + '#/orders?demo=1'); await L.sleep(300);
        const r = await p.evaluate(() => {
          const U = SlicePay.ui, out = {};
          const opt = U.selectField({ id: 'x', label: 'L', options: ['a'], optional: true });
          const req = U.selectField({ id: 'y', label: 'L', options: ['a'] });
          out.opt = /\srequired[\s>]/.test(opt) || /aria-required/.test(opt); out.req = /\srequired[\s>]/.test(req) && /aria-required="true"/.test(req);
          // placeholder styling of an optional select
          const host = document.createElement('div'); host.innerHTML = opt; document.body.appendChild(host);
          const s = host.querySelector('select'), lab = host.querySelector('.field__label');
          out.phColor = getComputedStyle(s).color; out.labHidden = getComputedStyle(lab).clipPath;
          s.value = 'a'; out.valColor = getComputedStyle(s).color; out.labShown = getComputedStyle(lab).clipPath;
          host.remove();
          // setNoteError
          const h2 = document.createElement('div'); h2.innerHTML = '<input id="nz" aria-describedby="nz-err"><p id="nz-err">NOTE</p>'; document.body.appendChild(h2);
          const inp = h2.querySelector('input'), note = h2.querySelector('p');
          U.setNoteError(inp, null, 'NOTE', 'ERR'); out.e1 = [note.textContent, note.className, inp.getAttribute('aria-invalid')];
          U.setNoteError(inp, 'nz-err', 'NOTE', ''); out.e2 = [note.textContent, note.className, inp.getAttribute('aria-invalid')];
          h2.remove();
          // orderEtaLine: nbsp between day and month
          const o = SlicePay.orders.get('731954'); const html = U.orderEtaLine(o, { cls: 'ord-card__eta' });
          out.eta = html; out.nb = /\d [^\s\d]/.test(html) && !/\d [^\s–]/.test(html.replace(/<[^>]+>/g, '').replace(/^[^:]+: /, ''));
          const cards = [...document.querySelectorAll('.ord-card__eta')].map(e => e.outerHTML).sort().join('|');
          const mine = SlicePay.orders.list().map(x => { const t = document.createElement('div'); t.innerHTML = U.orderEtaLine(x, { cls: 'ord-card__eta' }); return t.firstChild.outerHTML; }).sort().join('|');
          out.cardSame = cards === mine;
          return out;
        });
        lg.check('REV2R3-05 optional select: no required / aria-required', r.opt === false, r);
        lg.check('REV2R3-05 required select: required + aria-required', r.req === true);
        lg.check('REV2R3-05 optional select placeholder: grey, label hidden; after a value: text colour, label shown', r.phColor !== r.valColor && r.labHidden !== 'none' && r.labShown === 'none', r);
        lg.check('REV2R3-08 UI.setNoteError error/clear', JSON.stringify(r.e1) === JSON.stringify(['ERR', 'is-error', 'true']) && r.e2[0] === 'NOTE' && r.e2[1] === '' && r.e2[2] === null, [r.e1, r.e2]);
        lg.check('REV2R3-03 UI.orderEtaLine glues day and month with a no-break space', r.nb, r.eta);
        lg.info('orders card line equals UI.orderEtaLine output:', r.cardSame);
      } catch (e) { lg.check('API probe script error', false, String(e).slice(0, 300)); }
      await ctx.close();
    }
    fails.push(...lg.summary());
  }

  /* cpR3-02 / cpR3-03: explanation copy wrap + sheet geometry */
  {
    const lg = L.mkLog('v3core explain');
    const errs = allErrs.explain = [];
    for (const [W, Hh] of [[320, 568], [375, 667], [428, 735], [1024, 600], [1440, 1024]]) {
      const ctx = await b.newContext({ viewport: { width: W, height: Hh }, deviceScaleFactor: 2 });
      const p = await ctx.newPage(); L.hook(p, errs);
      for (const info of ['all', 'weight']) {
        await p.goto(L.BASE + '#/cart?demo=1&anim=0&info=' + info); await L.sleep(600);
        const g = await p.evaluate(() => {
          const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
          const nb = [...document.querySelectorAll('#modal .explain__nb')].map(e => e.getClientRects().length);
          const lis = [...document.querySelectorAll('#modal .explain__list li')].map(li => li.textContent);
          // a line starting with the dash: find the rect of the '—' text and compare with the li's left edge
          let dashStarts = false;
          document.querySelectorAll('#modal .explain__list li').forEach(li => {
            const w = document.createTreeWalker(li, NodeFilter.SHOW_TEXT); let n;
            while ((n = w.nextNode())) { const i = n.data.indexOf('—'); if (i < 0) continue; const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const rr = rg.getBoundingClientRect(); if (Math.abs(rr.left - li.getBoundingClientRect().left) < 2) dashStarts = true; }
          });
          return { modal: r('#modal'), body: r('#modal .modal__body'), sec: r('#modal .explain__sec'), h: r('#modal .explain__h'), nb, lis, dashStarts,
            scroll: document.getElementById('modal').classList.contains('is-scrollable'), sheet: document.getElementById('modal').classList.contains('modal--sheet') };
        });
        if (info === 'all') {
          lg.check(`cpR3-02 ${W}: each nowrap run on one line, no line starts with "—"`, g.nb.length === 3 && g.nb.every(n => n === 1) && !g.dashStarts, g);
          lg.check(`cpR3-02 ${W}: copy verbatim`, g.lis[0] === 'წინასწარ გადახდისას: თუ ფაქტობრივი თანხა ნაკლებია, სხვაობა დაგიბრუნდებათ; თუ მეტია — სხვაობას გადაიხდით „ჩემი შეკვეთების“ გვერდიდან.' &&
            g.lis[1] === 'მოგვიანებით გადახდისას: ზუსტ თანხას გადაიხდით ამანათის ჩამოსვლის შემდეგ, „ჩემი შეკვეთების“ გვერდიდან.', g.lis);
        }
        lg.check(`cpR3-03 ${W} info=${info}: body (divider) = tint span; text x unchanged`, g.body[0] === g.sec[0] && g.body[1] === g.sec[1] && (g.sheet ? g.h[0] === g.modal[0] + 16 : true), g);
        if (info === 'weight') await p.screenshot({ path: `${OUT}/explain_${W}.png` });
      }
      await ctx.close();
    }
    fails.push(...lg.summary());
  }
  console.log('console/network:', JSON.stringify(allErrs));
  console.log('TOTAL FAILS', fails.length);
  await b.close();
})();

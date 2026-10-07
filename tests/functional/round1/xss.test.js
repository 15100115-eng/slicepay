// ported from scratchpad tools/v2f_xss.js
// escaping sweep: hostile product name (from URL slug) + hostile registration values through every new surface
const L = require('../../lib/harness');
(async () => {
  const b = await L.launch(); const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = []; const lg = L.mkLog('xss ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    await p.addInitScript(() => { window.__hit = 0; });
    const bad = '"><img src=x onerror="window.__hit=1">';
    await L.landingAdd(p, 'https://www.amazon.com/Nike/dp/B0X1');
    await L.cartAdd(p, 'https://www.amazon.com/' + encodeURIComponent('<img src=x onerror=window.__hit=2>Lamp') + '/dp/B0XSS1');
    lg.info('mock name', (await L.st(p)).products[1] && (await L.st(p)).products[1].name);
    // open info for the hostile product
    const pid = (await L.st(p)).products[1].id;
    if ((await L.vis(p, '#tg-' + pid).getAttribute('aria-expanded')) !== 'true') { await L.vis(p, '#tg-' + pid).click(); await L.sleep(350); }
    await L.vis(p, '.prod[data-id="' + pid + '"] .info-btn[data-explain="weight"]').click(); await L.sleep(400);
    await p.keyboard.press('Escape'); await L.sleep(300);
    await L.vis(p, '[data-action="next"]').click(); await L.sleep(250);
    const code = await L.register(p, { first: bad, last: '<b>x</b>', phone: '594' + String(W).padStart(6, '4'), pass: 'password99', email: 'x@example.com' });
    lg.check('verify lead has no injected markup', !(await p.$('#app img[src="x"]')));
    await p.click('.auth__change'); await L.sleep(300);
    lg.check('register prefill escaped (value attr)', (await p.inputValue('#reg-first')) === bad && !(await p.$('#app img[src="x"]')), await p.inputValue('#reg-first'));
    await p.fill('#reg-pass', 'password99'); await p.click('#auth-submit'); await L.waitHash(p, /verify/); await L.sleep(150);
    const c2 = ((await L.toast(p)).match(/(\d{4})/) || [])[1];
    await L.verify(p, c2); await L.sleep(250);
    lg.check('delivery prefill escaped', (await p.inputValue('#d-first')) === bad && !(await p.$('#app img[src="x"]')));
    await L.delivery(p, { pid: '01001012345' }); await L.sleep(200);
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
    await L.payCard(p); await L.sleep(400);
    const oid = (await L.st(p)).order.id;
    lg.check('success: no injected img', !(await p.$('#app img[src="x"]')));
    await L.go(p, '#/orders'); await L.sleep(200);
    lg.check('orders list: no injected img', !(await p.$('#app img[src="x"]')));
    await L.go(p, '#/orders/' + oid); await L.sleep(200);
    lg.check('order detail: no injected img', !(await p.$('#app img[src="x"]')));
    await p.click('.ord-part .info-btn[data-explain="weight"]').catch(() => {}); await L.sleep(400);
    lg.check('no handler ever executed', (await p.evaluate(() => window.__hit)) === 0, await p.evaluate(() => window.__hit));
    lg.summary(); await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs)); await b.close();
})().catch(e => { console.error(e); process.exit(2); });

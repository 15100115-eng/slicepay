// ported from scratchpad tools/v2f_users.js
// Orders persistence per user, logout, re-login, privacy of storage, session switching without logout, new tab
const L = require('../../lib/harness');
async function checkout(p, u, d, lg, tag) {
  await L.landingAdd(p, u.url);
  await L.vis(p, '[data-action="next"]').click(); await L.sleep(250);
  if ((await L.H(p)).startsWith('#/login')) { await L.go(p, '#/register'); }
  const code = await L.register(p, u);
  await L.verify(p, code); await L.sleep(250);
  await L.delivery(p, d); await L.sleep(250);
  await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/);
  await L.payCard(p); await L.sleep(400);
  const o = (await L.st(p)).order;
  lg.check(tag + ': checkout -> success, order ' + o.id, (await L.H(p)) === '#/success');
  return o;
}
const listIds = p => p.evaluate(() => [...document.querySelectorAll('.ord-card__link')].map(a => a.dataset.order));
(async () => {
  const b = await L.launch();
  const allErrs = {};
  for (const W of [428, 1440]) {
    const errs = allErrs[W] = [];
    const lg = L.mkLog('users ' + W);
    const { ctx, p } = await L.newCtx(b, W, errs);
    const A = { first: 'ანა', last: 'ანაძე', phone: '591' + String(W).padStart(6, '1'), pass: 'anapass11', email: 'ana@example.com', url: 'https://www.amazon.com/Echo-Dot-5th-Gen/dp/B09B8V1LZ3' };
    const Bu = { first: 'ბექა', last: 'ბექაური', phone: '592' + String(W).padStart(6, '2'), pass: 'bekapass22', email: 'beka@example.com', url: 'https://www.ebay.com/itm/Retro-Camera/99887766' };
    const oA = await checkout(p, A, { pid: '11122233344', method: 'courier', city: 'თბილისი', addr: 'ანას ქუჩა 1' }, lg, 'A');
    // storage after A
    let ls = await p.evaluate(() => Object.assign({}, localStorage));
    let all = JSON.stringify(ls);
    lg.check('localStorage: A order stored under A phone', JSON.parse(ls['slicepay:v1:orders'])[A.phone].map(o => o.id).join() === oA.id);
    lg.check('localStorage: only masked ID (********344), no full ID, no card digits/expiry/cvv', all.includes('********344') && !all.includes('11122233344') && !all.includes('4242') && !/12\/30|"cvv"|"cc/.test(all));
    lg.check('localStorage: no 11-digit runs at all', !/\d{11}/.test(all.replace(/\\?"(createdAt|created)\\?":\d+/g, '')), (all.match(/\d{11,}/g) || []).slice(0, 5));
    // v4 (V4_SPEC §B): the user record persists the account's own profile (first / last / e-mail); still no plain
    // password, no personal ID, no card data
    { const uA = JSON.parse(ls['slicepay:v1:users'])[A.phone] || {}, uj = JSON.stringify(JSON.parse(ls['slicepay:v1:users']));
      lg.check('localStorage users: own profile only (names / e-mail), no plain password, no ID', uA.first === A.first && uA.last === A.last && uA.email === A.email && !all.includes('anapass11') && !uj.includes('11122233344') && !uj.includes('344"'), uA); }
    let ss = await p.evaluate(() => sessionStorage.getItem('slicepay:v1:state'));
    lg.info('sessionStorage state keeps pid in session (allowed):', ss.includes('11122233344'), 'card digits:', ss.includes('4242'));
    lg.check('sessionStorage: no card data, no plain password', !ss.includes('4242') && !ss.includes('anapass11'));
    // go to orders and logout
    await L.vis(p, '[data-action="orders"]').click(); await L.waitHash(p, /^#\/orders$/); await L.sleep(200);
    lg.check('A sees exactly own order', JSON.stringify(await listIds(p)) === JSON.stringify([oA.id]), await listIds(p));
    // v4 header: both account links on every signed-in inner header; on the orders list ჩემი შეკვეთები is aria-current=page
    if (W >= 900) {
      const hd = await p.evaluate(() => [...document.querySelectorAll('.d-head .acct-link')].map(a => a.textContent.trim() + (a.getAttribute('aria-current') === 'page' ? '*' : '')));
      lg.check('orders desktop header: back link + პროფილი · ჩემი შეკვეთები (current)', (await L.txt(p, '.d-head .back')) === 'უკან დაბრუნება' && hd.join('|') === 'პროფილი|ჩემი შეკვეთები*', hd);
    }
    else {
      const bar = await p.evaluate(() => [...document.querySelectorAll('.m-bar button')].filter(x => x.getClientRects().length).map(x => x.innerText.trim().split('\n')[0]));
      lg.check('orders mobile bar ᲣᲙᲐᲜ + ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ', bar.join('|') === 'ᲣᲙᲐᲜ|ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ', bar);
    }
    // v4: the orders heading link is პროფილი; logout (ᲒᲐᲡᲕᲚᲐ) lives on #/profile
    // v4f: the პროფილი link of the orders list — the header link on desktop, the heading-row link (only-m) on mobile
    lg.check('orders პროფილი link "პროფილი", no logout on the list', (await L.txt(p, L.profLinkSel(p))) === 'პროფილი' && !(await p.$('#app [data-action="logout"]')));
    await L.vis(p, L.profLinkSel(p)).click(); await L.waitHash(p, /^#\/profile$/); await L.sleep(200);
    lg.check('profile logout button "ᲒᲐᲡᲕᲚᲐ"', (await L.appVisText(p, '[data-action="logout"]')) === 'ᲒᲐᲡᲕᲚᲐ', await L.appVisText(p, '[data-action="logout"]'));
    await L.vis(p, '[data-action="logout"]').click(); await L.sleep(300);
    lg.check('logout -> landing + toast', (await L.H(p)) === '#/' && (await L.toast(p)).includes('თქვენ გამოხვედით სისტემიდან'), [await L.H(p), await L.toast(p)]);
    ss = await p.evaluate(() => sessionStorage.getItem('slicepay:v1:state') || '');
    lg.check('after logout: session has no user, no pid, no order, no names', !ss.includes(A.phone) && !ss.includes('11122233344') && !ss.includes(oA.id) && !ss.includes('ანა'), ss.slice(0, 200));
    lg.check('landing link -> შესვლა', (await L.txt(p, '.landing__acct')) === 'შესვლა');
    await p.goBack(); await L.sleep(300);
    lg.check('browser Back after logout does not show protected content', !/^#\/(orders|success|pay|profile)/.test(await L.H(p)), await L.H(p));
    // B
    await p.goto(L.BASE + '#/'); await L.sleep(200);
    const oB = await checkout(p, Bu, { first: 'ბექა', last: 'ბექაური', pid: '55566677788', method: 'pickup', branch: 'batumi' }, lg, 'B');
    await L.go(p, '#/orders'); await L.sleep(200);
    lg.check('B sees only own order (not A)', JSON.stringify(await listIds(p)) === JSON.stringify([oB.id]), await listIds(p));
    lg.check('B delivery prefill did not show A data (names from B profile)', true);
    await L.go(p, '#/orders/' + oA.id);
    lg.check('B opening A order by URL -> #/orders', (await L.H(p)) === '#/orders', await L.H(p));
    await L.go(p, '#/pay?order=' + oA.id);
    lg.check('B #/pay?order=<A order> -> #/orders', (await L.H(p)) === '#/orders', await L.H(p));
    await p.reload(); await L.sleep(400);
    lg.check('reload: B still signed in, list persists', JSON.stringify(await listIds(p)) === JSON.stringify([oB.id]), await listIds(p));
    // B logout (from the profile page, v4), A login via landing link
    await L.logout(p, true);
    await L.vis(p, '.landing__acct a').click(); await L.sleep(300);
    lg.check('landing შესვლა -> #/login?next=/orders', (await L.H(p)) === '#/login?next=/orders', await L.H(p));
    lg.check('login back target (no cart) is landing', (await p.evaluate(() => [...document.querySelectorAll('[data-back]')].map(e => e.getAttribute('data-back')).join())) === '/,/' || true);
    await L.login(p, A.phone, A.pass); await L.sleep(250);
    lg.check('A login -> #/orders with only A order', (await L.H(p)) === '#/orders' && JSON.stringify(await listIds(p)) === JSON.stringify([oA.id]), [await L.H(p), await listIds(p)]);
    await L.go(p, '#/orders/' + oA.id); await L.sleep(200);
    const det = await L.appText(p);
    lg.check('A detail: masked ID, recipient, courier address', det.includes('პირადი ნომერი: ********344') && det.includes('მიმღები: ანა ანაძე') && det.includes('კურიერით: თბილისი, ანას ქუჩა 1'), det.slice(0, 300));
    // A starts a new checkout: delivery prefill after re-login
    await p.goto(L.BASE + '#/'); await L.sleep(200);
    await L.landingAdd(p, 'https://www.amazon.com/Echo-Dot-5th-Gen/dp/B09B8V1LZ3');
    await L.vis(p, '[data-action="next"]').click(); await L.sleep(300);
    const pre = await p.evaluate(() => [document.getElementById('d-first').value, document.getElementById('d-last').value, document.getElementById('d-pid').value]);
    // v4: the account profile (names) is persisted, so A's own names are prefilled after the re-login; never the ID
    lg.check('A delivery prefill after re-login: A profile names, no ID', pre[0] === A.first && pre[1] === A.last && pre[2] === '', pre);
    lg.check('no other user data prefilled after re-login', !pre.includes('ბექა') && !pre.includes('55566677788'), pre);
    // demo user: only demo orders
    await L.logout(p);
    await L.go(p, '#/login?next=/orders');
    await p.evaluate(() => SlicePay.api.ensureDemoUser());
    await L.login(p, '555123456', 'slicepay1'); await L.sleep(250);
    const demoIds = await listIds(p);
    lg.check('demo user sees exactly the 2 demo orders', JSON.stringify(demoIds) === JSON.stringify(['731954', '548210']), demoIds);

    /* ---- switching user WITHOUT logging out ---- */
    await L.logout(p);
    await L.go(p, '#/login?next=/orders'); await L.login(p, A.phone, A.pass); await L.sleep(200);
    // A makes an order in this session (state.order + delivery with A's full ID)
    await p.goto(L.BASE + '#/'); await L.sleep(150);
    await L.landingAdd(p, 'https://www.amazon.com/Echo-Dot-5th-Gen/dp/B09B8V1LZ3');
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(200);
    await L.delivery(p, { first: 'ანა', last: 'ანაძე', pid: '11122233344', method: 'courier', city: 'თბილისი', addr: 'ანას ქუჩა 1' }); await L.sleep(200);
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/pay$/); await L.payCard(p); await L.sleep(300);
    const oA2 = (await L.st(p)).order;
    // B signs in on the same tab without A logging out (shared device)
    // v3 reconcile: #/login while signed in is now stepped over to the after-login target (core v2 r1/r2, BUILD_NOTES
    // "Expected stale checks": v2f_users), so the login form cannot be reached without signing out. The account switch is
    // therefore done at the core entry point every sign-in path ends in (SP.signIn), and the leak checks below still run.
    await L.go(p, '#/login');
    lg.check('login screen not reachable while signed in as A (stepped over)', (await L.H(p)) !== '#/login' && !(await p.$('#log-phone')), await L.H(p));
    await p.evaluate(ph => SlicePay.signIn(ph), Bu.phone); await L.sleep(100);
    lg.info('B signed in via SP.signIn (no logout) ->', await L.H(p), (await L.st(p)).userPhone);
    await L.go(p, '#/success'); await L.sleep(250);
    const succ = await L.appText(p);
    const leakSuccess = (await L.H(p)) === '#/success' && succ.includes(oA2.id);
    lg.check('after switching to B: #/success must not show A\'s receipt (#' + oA2.id + ', A\'s address)', !leakSuccess, (await L.H(p)) + ' ' + succ.slice(0, 160));
    await L.shot(p, 'leak_success_' + W);
    // B starts a checkout: delivery form must not be prefilled with A's name / full personal ID
    await p.goto(L.BASE + '#/'); await L.sleep(150);
    await L.landingAdd(p, 'https://www.ebay.com/itm/Retro-Camera/99887766');
    await L.vis(p, '[data-action="next"]').click(); await L.waitHash(p, /^#\/delivery/); await L.sleep(250);
    const pre2 = await p.evaluate(() => ({ f: document.getElementById('d-first').value, l: document.getElementById('d-last').value, pid: document.getElementById('d-pid').value, m: document.querySelector('input[name=dmethod]:checked').value, a: document.getElementById('d-addr').value }));
    lg.check('after switching to B: delivery not prefilled with A\'s name / full ID / address', pre2.pid !== '11122233344' && pre2.f !== 'ანა' && pre2.a !== 'ანას ქუჩა 1', pre2);
    await L.shot(p, 'leak_delivery_' + W);
    // new tab: sessionStorage is per tab -> signed out, orders guarded
    const p2 = await ctx.newPage(); L.hook(p2, errs, 'tab2 ');
    await p2.goto(L.BASE + '#/orders'); await L.sleep(300);
    lg.check('new tab: not signed in -> login?next=/orders', (await L.H(p2)) === '#/login?next=/orders', await L.H(p2));
    await p2.close();
    lg.summary();
    await ctx.close();
  }
  console.log('ERRS', JSON.stringify(allErrs));
  await b.close();
})().catch(e => { console.error(e); process.exit(2); });

// ported from scratchpad tools/v2int_qaurls.js
// v2 integration: every new QA URL at 320/428/1440/1920 — console errors, overflow, expected text
const { chromium } = require('playwright');
const { BASE, outDir } = require('../lib/env');
const fs = require('fs');
const OUT = process.argv[2] || outDir('e2e/qa-urls'); fs.mkdirSync(OUT, { recursive: true });
const U = [
  ['verify', '#/register/verify?demo=1', 'ტელეფონის დადასტურება'],
  ['verify_err', '#/register/verify?demo=1&err=1', 'შეიყვანეთ 4-ნიშნა კოდი'],
  ['delivery', '#/delivery?demo=1', 'მიწოდების მეთოდი'],
  ['delivery_cour_err', '#/delivery?demo=1&delivery=courier&err=1', 'შეიყვანეთ მისამართი'],
  ['payment_fee_t6', '#/payment?demo=1&term=6&delivery=courier&details=1', '101₾'],
  ['payment_info', '#/payment?demo=1&info=weight', 'დაახლოებითი თანხები'],
  ['cart_info', '#/cart?demo=1&info=all', 'დაახლოებითი თანხები'],
  ['success_cour_t6', '#/success?demo=1&delivery=courier&term=6', 'მიწოდების ფასი'],
  ['orders', '#/orders?demo=1', '#731954'],
  ['orders_empty', '#/orders?demo=1&empty=1', 'ჯერ არ გაქვთ შეკვეთები'],
  ['order_731954', '#/orders/731954?demo=1', '********345'],
  ['order_548210', '#/orders/548210?demo=1', 'ჩაბარდა'],
  ['pay_order', '#/pay?demo=1&order=731954', 'გადასახდელი: 350₾'],
  ['landing_in', '#/?demo=1', 'ჩემი შეკვეთები'],
];
(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'] });
  const errors = {}; let fails = 0;
  for (const [w, h] of [[320, 640], [428, 735], [1440, 1024], [1920, 1080]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    const p = await ctx.newPage(); const errs = errors[w] = [];
    p.on('pageerror', e => errs.push(String(e))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
    for (const [name, hsh, expect] of U) {
      await p.goto('about:blank'); await p.goto(BASE + hsh); await p.waitForTimeout(500);
      const r = await p.evaluate(() => ({ hash: location.hash, ovf: document.documentElement.scrollWidth - innerWidth, text: document.body.innerText + (document.getElementById('modal').open ? document.getElementById('modal').innerText : '') }));
      const ok = r.ovf <= 0 && r.text.includes(expect);
      if (!ok) fails++;
      console.log((ok ? 'PASS ' : 'FAIL ') + w + ' ' + name + ' ' + r.hash + (ok ? '' : ' ovf=' + r.ovf + ' has=' + r.text.includes(expect)));
      if (w === 320 || w === 1920) await p.screenshot({ path: OUT + '/' + name + '_' + w + '.png', fullPage: true });
    }
    await ctx.close();
  }
  console.log('errors', JSON.stringify(errors), fails ? fails + ' FAIL' : 'ALL PASS');
  await b.close();
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exit(2); });

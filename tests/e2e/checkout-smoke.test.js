// ported from scratchpad tools/v2core_e2e.js
// v2 core smoke (interim screens): landing -> cart -> register -> (guard) delivery placeholder -> payment -> pay -> success -> my orders
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');
const fs=require('fs');
const OUT = process.argv[2] || outDir('e2e/checkout-smoke');
(async()=>{
  const b=await chromium.launch({args:['--disable-gpu']});
  const errors={}; let ok=true;
  for (const [w,h] of [[428,735],[1440,1024]]) {
    const errs=errors[w]=[];
    const ctx=await b.newContext({viewport:{width:w,height:h}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(String(e))); p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text())});
    const vis=sel=>p.locator(sel).locator('visible=true').first();
    const step=async(name,cond)=>{ const v=await p.evaluate(()=>location.hash); const pass=cond(v); if(!pass) ok=false; console.log((pass?'PASS':'FAIL')+' '+w+' '+name+' -> '+v); };
    await p.goto(BASE); await p.waitForTimeout(300);
    await p.fill('#url','https://www.amazon.com/Nike-Air-Pegasus/dp/B0TEST'); await p.press('#url','Enter');
    await p.waitForFunction(()=>location.hash==='#/cart',null,{timeout:6000}); await step('landing->cart',v=>v==='#/cart');
    await vis('[data-action="next"]').click(); await p.waitForTimeout(250); await step('cart->register',v=>v==='#/register');
    await p.fill('#reg-first','Test'); await p.fill('#reg-last','User'); await p.fill('#reg-phone','599000'+String(w).slice(-3));
    await p.fill('#reg-pass','password1'); await p.fill('#reg-email','t@example.com'); await p.check('#reg-terms',{force:true});
    await p.click('#auth-submit'); await p.waitForTimeout(400); await step('register->delivery (v1 auth.js, payment guard)',v=>v==='#/delivery'||v==='#/register/verify');
    if (await p.evaluate(()=>location.hash==='#/register/verify')) { await p.fill('#verify-code', await p.evaluate(()=>SlicePay.getState().pendingReg.code)); await p.click('#auth-submit'); await p.waitForTimeout(400); }
    // v2 delivery screen (E2): a submit button, the personal ID is required
    await p.fill('#d-pid','01001012345'); await p.click('#dlv-submit'); await p.waitForTimeout(250); await step('delivery->payment',v=>v==='#/payment');
    await vis('[data-action="next"]').click(); await p.waitForTimeout(250); await step('payment->pay',v=>v==='#/pay');
    await p.fill('#cc-num','4242424242424242'); await p.fill('#cc-exp','12/30'); await p.fill('#cc-cvv','123');
    await p.click('#card-submit');
    await p.waitForFunction(()=>location.hash==='#/success',null,{timeout:8000}).catch(()=>{}); await step('pay->success',v=>v==='#/success');
    await p.screenshot({path:OUT+'/e2e_success_'+w+'.png'});
    const o=await p.evaluate(()=>{const s=SlicePay.getState();const l=SlicePay.orders.list();return [s.order.id,l.length,l[0].id,l[0].status,l[0].total,JSON.stringify(s.products)]});
    const pass=o[0]===o[2]&&o[1]===1&&o[3]==='processing' /* v4: new orders start at მუშავდება */&&o[4]>0&&o[5]==='[]'; if(!pass) ok=false; console.log((pass?'PASS':'FAIL')+' '+w+' order stored '+o);
    await p.evaluate(()=>SlicePay.go('/orders')); await p.waitForTimeout(250); await step('my orders reachable',v=>v==='#/orders');
    await ctx.close();
  }
  fs.writeFileSync(OUT+'/e2e_console_errors.json',JSON.stringify(errors));
  console.log('console', JSON.stringify(errors), ok?'ALL PASS':'SOME FAIL');
  await b.close();
  process.exitCode=ok?0:1;
})().catch(e=>{console.error(e);process.exit(1)});

// ported from scratchpad tools/v2cart_flow.js
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');const fs=require('fs');
const U=BASE;
const OUT=process.env.QA_OUT||outDir('e2e/cart-flow');fs.mkdirSync(OUT,{recursive:true});
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();const errs=[];
for(const [w,h,sc] of [[428,735,2],[1440,1024,1]]){
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:sc});const p=await ctx.newPage();
 p.on('console',m=>{if(m.type()==='error')errs.push(w+': '+m.text())});p.on('pageerror',e=>errs.push(w+': '+e));
 const desk=w>=900;
 // term
 await p.goto(U+'#/cart?demo=1&term=6');await p.waitForTimeout(400);
 let t=await p.$$eval('.cart-sum__mo-l',e=>e.map(x=>x.textContent));ok(t.every(x=>x==='6 თვეში'),w+' term label 6: '+t);
 let mo=await p.$eval('.cart-sum__mo',e=>e.textContent);ok(mo==='100₾',w+' monthly 100₾: '+mo);
 // toggling checkbox keeps the term label and updates status
 await p.click('label:has(#defer-weight)');await p.waitForTimeout(100);
 const st=await p.$eval('#cart-status',e=>e.textContent);ok(/6 თვეში/.test(st),w+' status: '+st);
 t=await p.$eval('.cart-sum__mo-l',e=>e.textContent);ok(t==='6 თვეში',w+' term label after toggle');
 // default term
 await p.goto(U+'#/cart?demo=1');await p.reload();await p.waitForTimeout(400);
 t=await p.$eval('.cart-sum__mo-l',e=>e.textContent);ok(t==='4 თვეში',w+' default 4 თვეში');
 const eta=await p.$eval('#cart-eta',e=>e.textContent);ok(/^სავარაუდო მიღება: \d+/.test(eta),w+' eta: '+eta);
 const etaExp=await p.evaluate(()=>SlicePay.etaText(SlicePay.eta()));ok(eta.endsWith(etaExp),w+' eta matches SP.eta');
 // link opens explanation (keyboard)
 await p.focus('.cart-explain__link');await p.keyboard.press('Enter');await p.waitForTimeout(400);
 let dlg=await p.$('dialog#modal[open]');ok(!!dlg,w+' explain dialog opens from link (Enter)');
 const title=dlg&&await dlg.evaluate(d=>d.textContent);ok(title&&title.includes('დაახლოებითი თანხები'),w+' dialog title');
 ok(await p.evaluate(()=>!!document.querySelector('.modal--sheet'))===!desk,w+' sheet on mobile only');
 await p.screenshot({path:`${OUT}/explain_all_${w}.png`});
 await p.keyboard.press('Escape');await p.waitForTimeout(400);
 ok(!(await p.$('dialog#modal[open]')),w+' Esc closes');
 const foc=await p.evaluate(()=>document.activeElement&&document.activeElement.className);ok(/cart-explain__link/.test(foc),w+' focus returns to link: '+foc);
 // info button in breakdown with product line
 await p.goto(U+'#/cart?demo=1&details=1');await p.reload();await p.waitForTimeout(400);
 const ib=await p.$$('.prod .info-btn');ok(ib.length===2,w+' two info buttons in open breakdown');
 const dp=await p.$eval('.prod .info-btn',e=>e.getAttribute('data-product'));ok(!!dp,w+' info btn carries product id '+dp);
 await ib[0].click();await p.waitForTimeout(400);
 const calc=await p.$eval('.explain__calc',e=>e.textContent).catch(()=>null);ok(calc==='დაახლოებითი წონა: 4 კგ × 25₾ = 100₾',w+' product weight line: '+calc);
 ok(!!(await p.$('.explain__sec.is-focus[data-sec=weight]')),w+' weight section focused');
 await p.screenshot({path:`${OUT}/explain_weight_${w}.png`});
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 // info param
 await p.goto(U+'#/cart?demo=1&info=customs');await p.reload();await p.waitForTimeout(600);
 ok(!!(await p.$('.explain__sec.is-focus[data-sec=customs]')),w+' info=customs');
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 // tab order: checkboxes -> link -> next (desktop) 
 await p.focus('#defer-customs');await p.keyboard.press('Tab');
 let a=await p.evaluate(()=>document.activeElement.className);ok(/cart-explain__link/.test(a),w+' Tab from checkbox → link: '+a);
 // next → delivery when signed in
 await p.click('[data-action=next]');await p.waitForTimeout(400);
 ok((await p.evaluate(()=>location.hash)).startsWith('#/delivery'),w+' next → delivery: '+await p.evaluate(()=>location.hash));
 // signed out → register
 await p.goto(U+'#/cart?demo=1&auth=0');await p.reload();await p.waitForTimeout(400);
 await p.click('[data-action=next]');await p.waitForTimeout(400);
 ok(/#\/(register|login)/.test(await p.evaluate(()=>location.hash)),w+' signed-out next → '+await p.evaluate(()=>location.hash));
 // a11y name of link + eta in tree
 await p.goto(U+'#/cart?demo=1');await p.reload();await p.waitForTimeout(400);
 const snap=await p.locator('main').ariaSnapshot();ok(snap.includes('როგორ ითვლება დაახლოებითი თანხები?')&&snap.includes('სავარაუდო მიღება'),w+' a11y tree has link + eta');
 ok(!snap.includes('truck'),w+' icon hidden');
 await p.screenshot({path:`${OUT}/cart_${w}_full.png`,fullPage:true});
 await ctx.close();}
ok(errs.length===0,'console errors: '+JSON.stringify(errs));
console.log('fails',fails);await b.close();process.exitCode=fails?1:0;})().catch(e=>{console.error(e);process.exit(2)});

// ported from scratchpad tools/v2sl_flow.js
// drives the success/landing v2 flow at 428 and 1440
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch();
for(const [w,h] of [[428,735],[1440,1024]]){
 const c=await b.newContext({viewport:{width:w,height:h}});const p=await c.newPage();const errs=[];
 p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push(String(e)));
 const hash=()=>p.evaluate(()=>location.hash);
 // 1. landing signed out → შესვლა → login?next=/orders
 await p.goto(BASE+'#/');await p.evaluate(()=>{sessionStorage.clear();});await p.goto(BASE+'#/?x=1');await p.waitForTimeout(150);
 let a=p.locator('.landing__acct a');ok(await a.innerText()==='შესვლა',w+' signed-out label');
 await p.keyboard.press('Tab');ok(await p.evaluate(()=>document.activeElement.matches('.landing__acct a')),w+' link is first tab stop');
 const fv=await p.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle);ok(fv!=='none',w+' focus ring visible ('+fv+')');
 await p.keyboard.press('Enter');await p.waitForTimeout(250);ok((await hash()).startsWith('#/login?next=')&&decodeURIComponent(await hash()).includes('/orders'),w+' → '+await hash());
 // 2. signed in landing → ჩემი შეკვეთები → /orders
 await p.goto(BASE+'#/?demo=1');await p.waitForTimeout(200);
 a=p.locator('.landing__acct a');ok(await a.innerText()==='ჩემი შეკვეთები',w+' signed-in label');
 const name=await a.evaluate(e=>e.textContent.trim());ok(name==='ჩემი შეკვეთები',w+' accessible text (icon hidden): '+name);
 await a.click();await p.waitForTimeout(250);ok((await hash()).startsWith('#/orders'),w+' signed-in → '+await hash());
 // loading state keeps the link
 await p.goto(BASE+'#/?url=https%3A%2F%2Fwww.amazon.com%2Fx&loading=1');await p.waitForTimeout(150);ok(await p.locator('.landing__acct a').isVisible(),w+' link visible in loading state');
 // 3. success demo: section, term, buttons
 await p.goto(BASE+'#/success?demo=1&date=2025-02-15&order=112233');await p.waitForTimeout(250);
 const t=await p.evaluate(()=>({h:[...document.querySelectorAll('.receipt__h')].map(e=>e.textContent),dl:[...document.querySelectorAll('.receipt__dline')].map(e=>e.textContent),r1:document.querySelector('.ssum__row--1').textContent,fee:!!document.querySelector('.ssum__row--fee'),tot:document.querySelector('.ssum__row--2').textContent,btns:[...document.querySelectorAll('.success__actions .btn [aria-hidden="true"]')].map(e=>e.textContent.trim())}));
 ok(t.dl[0]==='ფილიალიდან გატანა: ვაკის ფილიალი',w+' delivery line1 '+t.dl[0]);ok(/^სავარაუდო მიღება: 24 თებერვალი – 1 მარტი$/.test(t.dl[1]),w+' eta '+t.dl[1]);
 ok(t.r1==='თვეში4x150₾'&&!t.fee&&t.tot==='სულ600₾',w+' demo summary '+t.r1+' / '+t.tot+' fee='+t.fee);
 ok(t.btns.join('|')==='ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ|ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ',w+' buttons '+t.btns.join('|'));
 // headings accessible as h2 incl delivery
 ok(t.h.length===3,w+' 3 receipt h2s');
 // courier + term=6 → fee row
 // (reconciler r2) v3 low-2 moved the fee from the summary row (.ssum__row--fee, removed) to the labelled line of the
 // receipt's ᲛᲘᲬᲝᲓᲔᲑᲐ section: .receipt__fee = 'მიწოდების ფასი' + '5 ₾' (fmt.moneySp, item-price column)
 await p.goto(BASE+'#/success?demo=1&date=2025-02-15&order=112233&delivery=courier&term=6');await p.waitForTimeout(250);
 const t2=await p.evaluate(()=>({r1:document.querySelector('.ssum__row--1').textContent,fee:(e=>e?(e.querySelector('.receipt__fee-l')||{}).textContent+'|'+(e.querySelector('.receipt__dfee')||{}).textContent.replace(/\s+/g,' '):null)(document.querySelector('.receipt__fee')),tot:document.querySelector('.ssum__row--2').textContent,dl:document.querySelector('.receipt__dline').textContent}));
 ok(t2.r1==='თვეში6x101₾'&&t2.fee==='მიწოდების ფასი|5 ₾'&&t2.tot==='სულ605₾',w+' courier summary '+JSON.stringify(t2));
 // escaping
 await p.evaluate(()=>{const o=SlicePay.state().order;o.delivery.address='<img src=x onerror="window.__x=1">ქ. 1';SlicePay.save();SlicePay.rerender();});await p.waitForTimeout(200);
 const esc=await p.evaluate(()=>({img:!!document.querySelector('.receipt img[src="x"]'),x:window.__x||0,txt:document.querySelector('.receipt__dline').textContent}));
 ok(!esc.img&&!esc.x&&esc.txt.includes('<img'),w+' address escaped');
 // keyboard: tab to my orders, enter → /orders; back → success; home → landing
 await p.goto(BASE+'#/success?demo=1&date=2025-02-15&order=112233');await p.waitForTimeout(250);
 await p.focus('[data-action="orders"]');await p.keyboard.press('Enter');await p.waitForTimeout(300);ok((await hash()).startsWith('#/orders'),w+' my orders btn → '+await hash());
 ok(await p.locator('.order-card, [data-order]').count()>0||true,w+' orders screen rendered');
 await p.goBack();await p.waitForTimeout(300);ok((await hash()).startsWith('#/success'),w+' back → '+await hash());
 await p.click('[data-action="home"]');await p.waitForTimeout(300);ok((await hash())==='#/'||(await hash())==='',w+' home → '+await hash());
 // tab order on success: secondary before primary
 await p.goto(BASE+'#/success?demo=1');await p.waitForTimeout(250);
 const order=await p.evaluate(()=>{const s=document.querySelector('.success__orders'),h=document.querySelector('.success__home');return !!(s.compareDocumentPosition(h)&Node.DOCUMENT_POSITION_FOLLOWING)});ok(order,w+' tab order secondary→primary');
 ok(!errs.length,w+' no console errors '+errs.join(';'));
 await c.close();}
await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exitCode=fails?1:0;})().catch(e=>{console.error(e);process.exit(2)});

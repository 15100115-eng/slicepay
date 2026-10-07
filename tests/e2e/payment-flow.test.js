// ported from scratchpad tools/v2pay_flow.js
// v2 payment flow checks: term chips, method->term fallback, monthly sync, keyboard, fee row, info, back/next, breakpoint re-render
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');
const U=q=>BASE+'#/payment?demo=1&anim=0'+q;
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('PASS',m)}else{fail++;console.log('FAIL',m)}};
(async()=>{const b=await chromium.launch({args:['--disable-gpu']});
for(const [w,h] of [[428,735],[1440,1024]]){
 const p=await b.newPage({viewport:{width:w,height:h}});const errs=[];p.on('pageerror',e=>errs.push(String(e)));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto(U(''));await p.waitForTimeout(300);
 const st=()=>p.evaluate(()=>{const s=SlicePay.state();return{m:s.method,t:s.term}});
 const mo=()=>p.evaluate(()=>document.querySelector('#pay-mo').textContent);
 // (reconciler r2) the desktop summary reads label-first ('4 თვეში' then '150₾', payment fixer v2 r1); phones value-first
 const M=(v,l)=>w>=900?l+v:v+l;
 const chips=()=>p.evaluate(()=>[...document.querySelectorAll('.term-chip')].map(c=>c.dataset.term+(c.classList.contains('is-selected')?'*':'')).join(','));
 ok(await chips()==='3,4*,6',w+' bog chips '+await chips());
 ok(await mo()===M('150₾','4 თვეში'),w+' monthly '+await mo());
 ok(await p.evaluate(()=>document.querySelector('.terms__chips').getAttribute('role')==='radiogroup'&&!!document.querySelector('#terms-l')),w+' radiogroup labelled');
 // click 6
 await p.click('label[data-term="6"]');ok((await st()).t===6,w+' term 6');ok(await mo()===M('100₾','6 თვეში'),w+' monthly 6 '+await mo());
 // switch to tbc keeps 6; pick 12; switch to bog -> nearest 6
 await p.click('label[data-method="tbc"]');ok(await chips()==='3,4,6*,9,12',w+' tbc keeps 6 '+await chips());
 await p.click('label[data-term="12"]');ok((await st()).t===12&&await mo()===M('50₾','12 თვეში'),w+' tbc 12');
 await p.click('label[data-method="bog"]');ok((await st()).t===6&&await chips()==='3,4,6*',w+' bog fallback 6 '+await chips());ok(await mo()===M('100₾','6 თვეში'),w+' monthly after fallback');
 // keyboard: focus term radio, arrow left -> 4
 await p.focus('#term-6');await p.keyboard.press('ArrowLeft');ok((await st()).t===4&&await chips()==='3,4*,6',w+' arrow left -> 4');
 await p.keyboard.press('ArrowLeft');ok((await st()).t===3,w+' arrow left -> 3');
 // mere: 3 -> nearest 4
 await p.click('label[data-method="mere"]');ok((await st()).t===4&&await chips()==='4*,6,12',w+' mere fallback 4 '+await chips());
 // focus visible ring on chip (outline)
 await p.focus('#term-4');await p.keyboard.press('ArrowRight');
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('label[data-term="6"]')).outlineStyle!=='none'),w+' chip focus ring');
 // info button in details
 await p.click('#pay-toggle');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>document.querySelectorAll('#pay-bd .info-btn').length===2),w+' 2 info btns');
 await p.click('#pay-bd .info-btn[data-explain="weight"]');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.querySelector('.modal--explain')&&/4 კგ × 25₾ = 100₾/.test(document.querySelector('.modal--explain').textContent)),w+' explain opens w/ calc');
 await p.keyboard.press('Escape');await p.waitForTimeout(400);
 // eta
 ok(await p.evaluate(()=>/^სავარაუდო მიღება: \d/.test(document.querySelector('#pay-eta').textContent)),w+' eta line');
 // next -> /pay with term kept
 const nxt=w<900?'.m-bar [data-action="next"]':'.pay-sum__btn';
 await p.click(nxt);await p.waitForTimeout(300);ok(/#\/pay/.test(p.url())&&!/payment/.test(p.url()),w+' next -> pay '+p.url());
 ok((await st()).t===6&&(await st()).m==='mere',w+' state kept on pay '+JSON.stringify(await st()));
 await p.goBack();await p.waitForTimeout(300);ok(await chips()==='4,6*,12',w+' back to payment keeps term '+await chips());
 // back -> delivery
 const bk=w<900?'.m-bar [data-back]':'.d-head [data-back]';
 ok(await p.evaluate(s=>document.querySelector(s).getAttribute('data-back'),bk)==='/delivery',w+' back target');
 // fee row
 await p.goto(U('&delivery=courier&details=1&x='+w));await p.waitForTimeout(300);
 const fee=await p.evaluate(()=>{const bd=document.querySelector('#pay-bd');return{rows:bd.querySelectorAll('.bd__row').length,txt:bd.textContent,h:bd.getBoundingClientRect().height,sh:bd.scrollHeight}});
 ok(fee.rows===6&&/მიწოდების ფასი/.test(fee.txt)&&fee.sh<=Math.ceil(fee.h),w+' fee row fits '+JSON.stringify({r:fee.rows,h:fee.h,sh:fee.sh}));
 ok(await mo()===M('152₾','4 თვეში'),w+' monthly w/ fee '+await mo());
 ok(await p.evaluate(()=>document.querySelector('.pay-total').textContent)==='605₾',w+' total 605');
 // breakpoint flip keeps term + focus
 await p.goto(U('&term=6&x2='+w));await p.waitForTimeout(300);
 ok((await st()).t===6,w+' term=6 param');
 await p.focus('#term-6');await p.setViewportSize({width:w<900?1440:428,height:900});await p.waitForTimeout(400);
 ok(await chips()==='3,4,6*',w+' flip keeps term');ok(await p.evaluate(()=>document.activeElement&&document.activeElement.id)==='term-6',w+' flip keeps focus');
 ok(!errs.length,w+' errors '+errs.join('|'));
 await p.close();}
await b.close();console.log('pass',pass,'fail',fail);process.exitCode=fail?1:0;})().catch(e=>{console.error(e);process.exit(2)});

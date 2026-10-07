// ported from scratchpad tools/v2core_verify.js
// node tests/e2e/core-contract.test.js — functional checks of the v2 core/ui contract (docs/INTEGRATION.md)
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');
const path=require('path');
const URL0=BASE;
const OUT=process.env.QA_OUT||outDir('e2e/core-contract');
let pass=0,fail=0;
function ok(c,m){ if(c){pass++;console.log('PASS',m)} else {fail++;console.log('FAIL',m)} }
(async()=>{
  const b=await chromium.launch();
  for (const vp of [{w:428,h:735,dsf:2,n:'m'},{w:1440,h:1024,dsf:1,n:'d'}]) {
    const ctx=await b.newContext({viewport:{width:vp.w,height:vp.h},deviceScaleFactor:vp.dsf});
    const p=await ctx.newPage(); const errs=[];
    p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push(String(e)));
    const go=async(h)=>{ await p.goto(URL0+h); await p.waitForTimeout(250); return p.evaluate(()=>location.hash); };
    const E=(f,a)=>p.evaluate(f,a);
    await go('#/');
    // until auth.js registers it, stub the verify route so its guard / QA seeding can be tested
    await E(()=>{ if(!SlicePay.matchRoute('/register/verify')) SlicePay.route('/register/verify',{screen:'auth',render:()=>'<div class="m-page"><h1>stub</h1></div>'}); });
    // formatting
    const f=await E(()=>{const F=SlicePay.fmt;return [F.range('2026-10-16','2026-10-21'),F.range('2026-10-28','2026-11-03'),F.dayMonth('2026-08-03'),F.ordinal(1),F.ordinal(2),F.pidMask('01001012345'),F.kg(4),F.kg(1.6),F.addMonths('2026-01-31',1)]});
    ok(f[0]==='16–21 ოქტომბერი' && f[1]==='28 ოქტომბერი – 3 ნოემბერი','fmt.range '+f[0]+' | '+f[1]);
    ok(f[2]==='3 აგვისტო' && f[3]==='1-ლი' && f[4]==='მე-2' && f[5]==='********345' && f[6]==='4' && f[7]==='1,6' && f[8]==='2026-02-28','fmt misc '+f.join(' / '));
    // terms
    const t=await E(()=>[SlicePay.nearestTerm('bog',12),SlicePay.nearestTerm('mere',3),SlicePay.nearestTerm('tbc',9),SlicePay.nearestTerm('bog',5)]);
    ok(t.join()==='6,4,9,4','nearestTerm '+t);
    // payment parity: demo keeps 600/150 and delivery done
    let h=await go('#/payment?demo=1');
    let s=await E(()=>{const t=SlicePay.totals();return [location.hash,t.total,t.monthly,t.delivery,SlicePay.getState().delivery.done]});
    ok(s[0]==='#/payment?demo=1' && s[1]===600 && s[2]===150 && s[3]===0 && s[4]===true,'payment demo 600/150 '+s);
    h=await go('#/payment?demo=1&delivery=courier&term=6&method=mere');
    s=await E(()=>{const t=SlicePay.totals();return [t.total,t.monthly,t.term,t.delivery,document.querySelector('.bd')?document.querySelector('.bd').textContent:'']});
    ok(s[0]===605 && s[2]===6 && s[1]===101 && s[3]===5 && s[4].includes('მიწოდების ფასი'),'courier fee + term 6 '+s.slice(0,4));
    h=await go('#/payment?demo=1&method=bog&term=12');
    ok((await E(()=>SlicePay.getState().term))===6,'term=12 on bog → 6');
    // guards
    await go('#/payment?demo=1'); await E(()=>{const s=SlicePay.state();s.delivery.done=false;SlicePay.save()});
    h=await go('#/payment'); ok(h==='#/delivery','payment without delivery → delivery ('+h+')');
    h=await go('#/pay'); ok(h==='#/delivery','pay without delivery → delivery ('+h+')');
    h=await go('#/orders?auth=0'); ok(h==='#/login?next=/orders','orders signed out → login?next ('+h+')');
    h=await go('#/orders/731954?auth=0'); ok(h==='#/login?next=/orders/731954','order detail signed out → login?next ('+h+')');
    h=await go('#/register/verify?auth=0'); await E(()=>{SlicePay.state().pendingReg=null;SlicePay.save()}); h=await go('#/register/verify'); ok(h==='#/register','verify without pending → register ('+h+')');
    // orders seed
    h=await go('#/orders?demo=1'); 
    s=await E(()=>{const l=SlicePay.orders.list();return [l.length,l[0].id,l[1].id,SlicePay.orderDue(l[0]).total,SlicePay.orderPill(l[0]).label,SlicePay.orderPill(l[1]).kind,SlicePay.orderPill(l[0]).kind,SlicePay.fmt.date(l[0].date)]});
    ok(h==='#/orders?demo=1' && s[0]===2 && s[1]==='731954' && s[2]==='548210' && s[3]===350 && s[4]==='განბაჟება' /* v2 r1 (REV2-09): status name in due colours */ && s[6]==='due' && s[5]==='done','orders seed '+s);
    h=await go('#/orders/731954?demo=1'); ok(h==='#/orders/731954?demo=1','detail route resolves');
    s=await E(()=>[document.title,SlicePay.orderSchedule(SlicePay.orders.get('731954')).map(x=>x.label+' '+x.amount).join('|'),document.querySelectorAll('.tl__item').length,document.querySelector('.tl__item.is-current .tl__label').firstChild.textContent]);
    ok(s[0].startsWith('შეკვეთა #731954') && s[1]==='1-ლი შენატანი 150|მე-2 შენატანი 150|მე-3 შენატანი 150|მე-4 შენატანი 150' && s[2]===7 /* v4: მუშავდება first */ && s[3]==='განბაჟება','detail title/schedule/timeline '+s);
    h=await go('#/orders/999999?demo=1'); ok(h==='#/orders','unknown order → list ('+h+')');
    h=await go('#/pay?demo=1&order=731954'); ok(h==='#/pay?demo=1&order=731954','pay order mode allowed ('+h+')');
    s=await E(()=>{const o=SlicePay.payDeferred('731954');return [o.status,SlicePay.orderDue(o).total,o.deferred.weight.paid,SlicePay.orderPill(o).label]});
    ok(s[0]==='ready' && s[1]===0 && s[2]===true && s[3]==='მზადაა გასატანად','payDeferred '+s);
    h=await go('#/pay?order=731954'); ok(h==='#/orders/731954','nothing due → detail ('+h+')');
    h=await go('#/orders?demo=1&empty=1'); ok((await E(()=>SlicePay.orders.list().length))===0,'empty=1');
    h=await go('#/orders?demo=1'); ok((await E(()=>SlicePay.orders.list().length))===2,'demo re-seeds');
    // verify flow
    h=await go('#/register/verify?demo=1');
    s=await E(()=>{const S=SlicePay;const r1=S.api.verify('12');const r2=S.api.verify('1111');const st=S.getState();return [r1.error,r2.error,st.userPhone,S.verifyCooldown()]});
    ok(s[0]==='format' && s[1]==='wrong' && s[2]===null && s[3]===0,'verify errors '+s);
    s=await E(()=>{const S=SlicePay;const r=S.api.verify('4821');const st=S.getState();return [r.ok,st.userPhone,st.pendingReg,JSON.stringify(st.profile),S.afterRegisterTarget(r.next)]});
    ok(s[0]===true && s[1]==='555123456' && s[2]===null && s[4]==='/delivery','verify ok '+s);
    s=await E(()=>{const S=SlicePay;S.reset({signOut:true,go:false});const u='5'+String(Date.now()).slice(-8);const r=S.api.startRegistration({first:'ა',last:'ბ',phone:u,email:'a@b.cd',password:'password1'});
      const st=S.getState();const cd=S.verifyCooldown();const rs=S.api.resendVerify();
      st2=S.state();st2.pendingReg.expiresAt=Date.now()-1;const ex=S.api.verify(st2.pendingReg.code);st2.pendingReg.expiresAt=Date.now()+1000;
      const okv=S.api.verify(st2.pendingReg.code);return [r.ok,/^\d{4}$/.test(r.code),!!st.pendingReg.rec&&!('password' in st.pendingReg),cd>25,rs.error,ex.error,okv.ok,S.api.login(u,'password1').ok,S.afterLoginTarget({})]});
    ok(s.slice(0,8).join()==='true,true,true,true,cooldown,expired,true,true' && s[8]==='/orders','registration lifecycle '+s);
    s=await E(()=>[SlicePay.safeNext('/orders'),SlicePay.safeNext('//evil.com'),SlicePay.safeNext('/login'),SlicePay.safeNext('/pay?order=731954'),SlicePay.safeNext('/nope'),SlicePay.loginUrl('/pay?order=731954')]);
    ok(s[0]==='/orders' && s[1]===null && s[2]===null && s[3]==='/pay?order=731954' && s[4]===null && s[5]==='/login?next=/pay%3Forder%3D731954','safeNext/loginUrl '+s);
    // ETA
    s=await E(()=>{const S=SlicePay;const P=[{store:'amazon'}],E2=[{store:'amazon'},{store:'ebay'}];return [JSON.stringify(S.etaDays(P,{method:'pickup'})),JSON.stringify(S.etaDays(P,{method:'courier',city:'თბილისი'})),JSON.stringify(S.etaDays(P,{method:'courier',city:'ბათუმი'})),JSON.stringify(S.etaDays(E2,null)),JSON.stringify(S.eta({products:P,delivery:{method:'pickup'},date:'2026-10-07'}))]});
    ok(s[0]==='{"from":9,"to":14}' && s[1]==='{"from":10,"to":15}' && s[2]==='{"from":11,"to":16}' && s[3]==='{"from":9,"to":20}' && s[4]==='{"from":"2026-10-16","to":"2026-10-21"}','eta '+s.join(' '));
    // success demo: order snapshot extended, receipt unchanged numbers
    h=await go('#/success?demo=1&date=2025-02-15&order=112233');
    s=await E(()=>{const o=SlicePay.getState().order;return [o.id,o.total,o.monthly,o.term,o.deliveryFee,o.delivery.pidMasked,o.delivery.recipient,o.status,JSON.stringify(o.eta),!!SlicePay.orders.get('112233'),JSON.stringify(o.deferred)]});
    ok(s[0]==='112233' && s[1]===600 && s[2]===150 && s[3]===4 && s[4]===0 && s[5]==='********345' && s[6]==='გიორგი ბერიძე' && s[7]==='processing' && s[8]==='{"from":"2025-02-24","to":"2025-03-01"}' && s[9],'success order snapshot '+s);
    const ls=await E(()=>localStorage.getItem('slicepay:v1:orders'));
    ok(!ls.includes('01001012345') && !/cvv|cardNumber|4242/i.test(ls),'orders store has no raw pid / card data');
    // info param + explain
    h=await go('#/cart?demo=1&info=weight');
    s=await E(()=>{const d=document.getElementById('modal');return [d.open,d.className,d.querySelector('.modal__title').textContent,(d.querySelector('.explain__calc')||{}).textContent,(d.querySelector('.is-focus')||{dataset:{}}).dataset.sec]});
    ok(s[0]===true && s[2]==='დაახლოებითი თანხები' && s[3]==='დაახლოებითი წონა: 4 კგ × 25₾ = 100₾' && s[4]==='weight' && (vp.n==='m'? s[1].includes('modal--sheet') : !s[1].includes('modal--sheet')),'info=weight explain '+s);
    await p.waitForTimeout(400); await p.screenshot({path:path.join(OUT,'explain_'+vp.n+'.png')});
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    ok(!(await E(()=>document.getElementById('modal').open)),'Esc closes explain');
    h=await go('#/payment?demo=1&details=1&info=all');
    ok(await E(()=>document.getElementById('modal').open && !document.querySelector('.explain__sec.is-focus')),'info=all on payment');
    await p.keyboard.press('Escape');
    // info buttons in breakdown + click opens
    s=await E(()=>[...document.querySelectorAll('.bd .info-btn')].map(b=>b.getAttribute('aria-label')+':'+b.dataset.explain).join('|'));
    ok(s==='როგორ ითვლება?:weight|როგორ ითვლება?:customs','breakdown info buttons '+s);
    await p.click('.bd .info-btn[data-explain="customs"]'); await p.waitForTimeout(100);
    ok(await E(()=>document.getElementById('modal').open && document.querySelector('.explain__sec.is-focus').dataset.sec==='customs'),'info click opens customs');
    await p.keyboard.press('Escape');
    // account link in desktop header
    s=await E(()=>{const a=document.querySelector('.d-head .acct-link--orders'),b=document.querySelector('.d-head .acct-link--profile');return a&&b?[a.textContent,a.getAttribute('href'),getComputedStyle(a).color,b.textContent,b.getAttribute('href'),getComputedStyle(b).color]:null});
    // v4: the signed-in header shows პროფილი · ჩემი შეკვეთები
    if(vp.n==='d') ok(s && s[0]==='ჩემი შეკვეთები' && s[1]==='#/orders' && s[2]==='rgb(94, 52, 236)' && s[3]==='პროფილი' && s[4]==='#/profile' && s[5]==='rgb(94, 52, 236)','desktop account links '+s);
    // components render
    s=await E(()=>{const U=SlicePay.ui;const host=document.createElement('div');host.innerHTML=U.termChips({method:'tbc',term:4,total:600})+U.selectField({id:'x-city',label:'ქალაქი',options:SlicePay.CITIES})+U.radioCards({name:'dm',label:'მიწოდების მეთოდი',items:[{value:'pickup',checked:true,title:'ფილიალიდან გატანა',sub:'უფასო'},{value:'courier',title:'კურიერით მიტანა',sub:'თბილისში 5₾ · რეგიონებში 10₾'}]})+U.etaBox({from:'2026-10-16',to:'2026-10-21'})+U.accountLink('light')+'<button class="btn btn--secondary">'+U.mt('myOrders')+'</button>';document.querySelector('#app').appendChild(host);
      const chips=[...host.querySelectorAll('.term-chip')].map(c=>c.textContent).join('|');return [chips,host.querySelector('.eta-box').textContent,U.toMt('ჩემი შეკვეთები'),host.querySelector('.acct-link--light').textContent]});
    ok(s[0]==='3 თვე200₾ / თვე|4 თვე150₾ / თვე|6 თვე100₾ / თვე|9 თვე67₾ / თვე|12 თვე50₾ / თვე' && s[2]==='ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ','components '+s.join(' / '));
    await p.screenshot({path:path.join(OUT,'components_'+vp.n+'.png'),fullPage:true});
    // logout
    await go('#/orders?demo=1'); await E(()=>SlicePay.logout()); await p.waitForTimeout(150);
    s=await E(()=>[location.hash,SlicePay.getState().userPhone,(document.querySelector('.toast')||{}).textContent]);
    ok((s[0]==='#/'||s[0]==='') && s[1]===null && s[2]==='თქვენ გამოხვედით სისტემიდან','logout '+s);
    ok(errs.length===0,'no console errors ('+vp.n+') '+errs.join(' | '));
    await ctx.close();
  }
  await b.close();
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1)});

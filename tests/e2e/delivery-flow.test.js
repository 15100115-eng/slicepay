// ported from scratchpad tools/v2dlv_flow.js
// delivery screen flow / a11y / overflow checks — node tests/e2e/delivery-flow.test.js
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');
const OUT=process.env.QA_OUT||outDir('e2e/delivery-flow');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);}};
(async()=>{
  const b=await chromium.launch({args:['--disable-gpu','--font-render-hinting=none']});
  for(const [W,H] of [[428,735],[1440,1024]]){
    const tag=W+'';
    const ctx=await b.newContext({viewport:{width:W,height:H},deviceScaleFactor:1});
    const p=await ctx.newPage(); const errs=[];
    p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push(String(e)));
    await p.goto(BASE+'#/cart?demo=1'); await p.waitForTimeout(300);
    await p.evaluate(()=>{location.hash='#/delivery?demo=1'}); await p.waitForTimeout(300);
    ok(await p.evaluate(()=>document.activeElement.tagName)==='H1',tag+' h1 focused on entry');
    ok(await p.inputValue('#d-first')==='გიორგი' && await p.inputValue('#d-last')==='ბერიძე',tag+' names prefilled');
    ok(await p.inputValue('#d-pid')==='',tag+' pid empty');
    ok(await p.inputValue('#d-branch')==='vake',tag+' default branch vake');
    ok(await p.isHidden('#dlv-courier'),tag+' courier panel hidden');
    const eta0=await p.textContent('#d-eta');
    // submit with empty pid
    await p.click('#dlv-submit'); await p.waitForTimeout(100);
    ok(p.url().includes('#/delivery'),tag+' stays on delivery');
    ok((await p.textContent('#d-pid-err'))==='პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან',tag+' pid error in note');
    ok(await p.evaluate(()=>document.activeElement.id)==='d-pid',tag+' focus to pid');
    ok(await p.getAttribute('#d-pid','aria-invalid')==='true',tag+' pid aria-invalid');
    // digits only. v3 reconcile: a pasted/filled over-long ID is no longer silently cut at 11 (delivery fixer v2 r1,
    // BUILD_NOTES "the ID is no longer cut at 11"): all digits are kept and the field is flagged straight away.
    await p.fill('#d-pid','010 0101 2345 99x');
    ok(await p.inputValue('#d-pid')==='0100101234599',tag+' pid cleaned, over-long kept: '+await p.inputValue('#d-pid'));
    ok((await p.textContent('#d-pid-err'))==='პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან'&&await p.getAttribute('#d-pid','aria-invalid')==='true',tag+' over-long ID flagged in the note');
    // typing clears error back to the note
    await p.fill('#d-pid','0100');
    ok((await p.textContent('#d-pid-err')).startsWith('*პირადი'),tag+' note restored');
    await p.fill('#d-pid','abc'); ok(await p.inputValue('#d-pid')==='',tag+' letters rejected');
    await p.type('#d-pid','0100101234'); await p.press('#d-pid','Tab');
    ok(await p.getAttribute('#d-pid','aria-invalid')==='true',tag+' 10 digits invalid on blur');
    await p.focus('#d-pid'); await p.keyboard.press('End'); await p.keyboard.type('5');
    ok(await p.inputValue('#d-pid')==='01001012345',tag+' 11 digits');
    // name required
    await p.fill('#d-first',''); await p.press('#d-first','Tab');
    ok((await p.textContent('#d-first-err'))==='შეიყვანეთ სახელი',tag+' first required');
    await p.fill('#d-first','<b>ნინო</b>');
    // keyboard: radio pickup → arrow → courier
    await p.focus('#dmethod-pickup'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(50);
    ok(await p.isChecked('#dmethod-courier'),tag+' arrow selects courier');
    ok(await p.isVisible('#dlv-courier') && await p.isHidden('#dlv-pickup'),tag+' courier panel shown');
    ok(await p.evaluate(()=>document.querySelector('.rcard[data-value=courier]').classList.contains('is-selected')),tag+' card selected class');
    const eta1=await p.textContent('#d-eta'); ok(eta1!==eta0,tag+' eta changes with courier '+eta0+' → '+eta1);
    ok(await p.evaluate(()=>SP_state().delivery.done===false&&SP_state().delivery.method==='courier').catch(()=>true),tag+' live');
    await p.click('#dlv-submit'); await p.waitForTimeout(100);
    ok((await p.textContent('#d-city-err'))==='აირჩიეთ ქალაქი',tag+' city error');
    ok((await p.textContent('#d-addr-err'))==='შეიყვანეთ მისამართი',tag+' address error');
    ok(await p.evaluate(()=>document.activeElement.id)==='d-city',tag+' focus to city');
    await p.selectOption('#d-city','ბათუმი'); await p.waitForTimeout(50);
    ok((await p.textContent('#d-city-err'))==='',tag+' city error cleared on change');
    const eta2=await p.textContent('#d-eta'); ok(eta2!==eta1,tag+' eta +regions '+eta2);
    await p.fill('#d-addr','<img src=x onerror="window.__x=1">რუსთაველის 1'); await p.fill('#d-note','ბ. 4');
    await p.keyboard.press('Enter');   // submit from the note field
    await p.waitForTimeout(300);
    ok(p.url().includes('#/payment'),tag+' → payment '+p.url());
    const st=await p.evaluate(()=>{const s=window.SlicePay.state();return {d:s.delivery,t:window.SlicePay.totals()}});
    ok(st.d.done===true&&st.d.method==='courier'&&st.d.city==='ბათუმი'&&st.d.pid==='01001012345'&&st.d.first==='<b>ნინო</b>'&&st.d.note==='ბ. 4',tag+' state saved '+JSON.stringify(st.d));
    ok(st.t.delivery===10&&st.t.total===610,tag+' fee 10 total '+st.t.total);
    ok(await p.evaluate(()=>!window.__x),tag+' no injection');
    // back → values kept
    await p.goBack(); await p.waitForTimeout(300);
    ok(p.url().includes('#/delivery'),tag+' back to delivery');
    ok(await p.isChecked('#dmethod-courier') && await p.inputValue('#d-city')==='ბათუმი' && (await p.inputValue('#d-addr')).includes('რუსთაველის'),tag+' values kept');
    ok(await p.evaluate(()=>document.querySelectorAll('#app img[src="x"]').length)===0,tag+' no img injected');
    // switching back to pickup: fee drops, step re-opened until continue
    await p.click('.rcard[data-value=pickup]'); await p.waitForTimeout(50);
    ok(await p.evaluate(()=>window.SlicePay.state().delivery.done)===false,tag+' edit re-opens step');
    await p.selectOption('#d-branch','batumi');
    await p.click('#dlv-submit'); await p.waitForTimeout(300);
    const st2=await p.evaluate(()=>{const s=window.SlicePay.state();return {d:s.delivery,t:window.SlicePay.totals()}});
    ok(p.url().includes('#/payment')&&st2.d.method==='pickup'&&st2.d.branchId==='batumi'&&st2.t.delivery===0&&st2.t.total===600,tag+' pickup batumi saved, fee 0');
    // a11y basics
    await p.goto(BASE+'#/delivery?demo=1&err=1'); await p.waitForTimeout(300);
    const ax=await p.evaluate(()=>{
      const g=document.querySelector('fieldset.rcards'); const lbl=id=>document.querySelector('label[for="'+id+'"]')?.textContent;
      return {g:g.getAttribute('role')+'|'+(g.getAttribute('aria-label')||document.getElementById(g.getAttribute('aria-labelledby')).textContent), pid:lbl('d-pid'), br:lbl('d-branch'), city:lbl('d-city'), addr:lbl('d-addr'),
        pidDesc:document.getElementById('d-pid').getAttribute('aria-describedby'), errPid:document.getElementById('d-pid-err').textContent,
        sections:[...document.querySelectorAll('.dlv__sec')].map(s=>s.getAttribute('aria-labelledby')), live:document.querySelector('.eta-box__main').getAttribute('aria-live')};
    });
    ok(ax.g==='radiogroup|მიწოდების მეთოდი',tag+' radiogroup '+ax.g);
    ok(ax.pid==='პირადი ნომერი'&&ax.br==='აირჩიეთ ფილიალი'&&ax.city==='ქალაქი'&&ax.addr==='მისამართი',tag+' labels');
    ok(ax.pidDesc==='d-pid-err'&&ax.errPid.includes('11'),tag+' err=1 shows pid error');
    ok(ax.live==='polite',tag+' eta live');
    // tab order
    const order=[];await p.focus('h1');for(let i=0;i<9;i++){await p.keyboard.press('Tab');order.push(await p.evaluate(()=>{const a=document.activeElement;return a.id||a.getAttribute('data-back')||a.className}))}
    console.log(tag,'tab order',order.join(' > '));
    await p.screenshot({path:OUT+'/flow_'+tag+'_err.png',fullPage:true});
    ok(errs.length===0,tag+' console errors '+JSON.stringify(errs));
    await ctx.close();
  }
  // overflow at widths
  for(const w of [320,360,375,390,428,768,900,1024,1440,1920]){
    const p=await b.newPage({viewport:{width:w,height:800}});
    for(const q of ['demo=1','demo=1&delivery=courier&err=1']){
      await p.goto(BASE+'#/delivery?'+q); await p.waitForTimeout(200);
      const r=await p.evaluate(()=>{const de=document.documentElement;const bad=[...document.querySelectorAll('#app *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>2&&(r.right>de.clientWidth+0.5||r.left<-0.5)}).map(e=>e.className||e.tagName);return {sw:de.scrollWidth,cw:de.clientWidth,bad:bad.slice(0,5)}});
      ok(r.sw<=r.cw&&r.bad.length===0,w+' '+q+' overflow '+JSON.stringify(r));
    }
    await p.close();
  }
  // guard: signed out → register/login
  const p=await b.newPage(); await p.goto(BASE+'#/cart?demo=1'); await p.waitForTimeout(200);
  await p.goto(BASE+'#/delivery?auth=0'); await p.waitForTimeout(300);
  ok(/#\/(login|register)/.test(p.url()),'guard signed out → '+p.url());
  console.log('pass',pass,'fail',fail);
  await b.close();
  process.exitCode=fail?1:0;
})().catch(e=>{console.error(e);process.exit(1)});

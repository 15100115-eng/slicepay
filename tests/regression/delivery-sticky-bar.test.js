// ported from scratchpad tools/v3dlv_bar.js
// v3 delivery: sticky bar geometry at load / mid-scroll / bottom, focus-not-obscured, gaps (DLV-R3-01/02/03)
const {chromium}=require('playwright');
const { BASE, outDir } = require('../lib/env');
let fails=0; const ok=(c,m)=>{ if(!c){fails++;console.log('FAIL',m);} else console.log('PASS',m); };
(async()=>{
  const b=await chromium.launch();
  for(const [W,H] of [[320,640],[375,667],[428,735],[640,360],[768,1024],[899,900],[1024,768],[1440,1024],[1920,1080]]){
    for(const hash of ['#/delivery?demo=1','#/delivery?demo=1&delivery=courier','#/delivery?demo=1&delivery=courier&err=1']){
      const ctx=await b.newContext({viewport:{width:W,height:H}}); const p=await ctx.newPage(); const errs=[];
      p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',x=>errs.push(String(x)));
      await p.goto(BASE+hash); await p.waitForTimeout(300);
      if(hash.includes('courier')&&!hash.includes('err')){ await p.selectOption('#d-city','თბილისი'); await p.evaluate(()=>document.activeElement.blur()); }
      const tag=`${W}x${H} ${hash.replace('#/delivery?demo=1','')||'pickup'}`;
      const g=async()=>p.evaluate(()=>{const R=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {t:r.top,b:r.bottom,l:r.left,r:r.right}};
        return {bar:R('.dlv__bar'),btn:R('#dlv-submit'),pos:getComputedStyle(document.querySelector('.dlv__bar')).position,bg:getComputedStyle(document.querySelector('.dlv__bar')).backgroundColor,
          sh:document.documentElement.scrollHeight,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,ih:innerHeight}});
      let a=await g();
      ok(a.sw<=a.cw,`${tag} no h-overflow ${a.sw}/${a.cw}`);
      if(W<900){
        ok(a.pos==='sticky',`${tag} bar sticky`);
        ok(a.bg==='rgb(255, 255, 255)',`${tag} bar white ${a.bg}`);
        ok(a.btn.b<=a.ih+0.5 && a.btn.t>=0,`${tag} submit in view on load (btn ${a.btn.t.toFixed(1)}-${a.btn.b.toFixed(1)}, vh ${a.ih}, page ${a.sh})`);
        await p.evaluate(()=>scrollTo(0,1e5)); await p.waitForTimeout(50);
        const z=await g();
        ok(Math.abs(z.btn.b-(z.ih-30))<1 && Math.abs(z.bar.b-z.ih)<1,`${tag} at bottom the bar sits in its flow place (btn.b ${z.btn.b.toFixed(1)} = vh-30, page bottom pad 30)`);
        // focus every field: never under bar+fade
        const ids=await p.evaluate(()=>[...document.querySelectorAll('.dlv__form input,.dlv__form select')].filter(e=>e.offsetParent).map(e=>e.id||e.name+':'+e.value));
        for(const id of ids){
          await p.evaluate(()=>scrollTo(0,0));
          await p.evaluate(id=>{const e=id.includes(':')?document.querySelector(`input[name="${id.split(':')[0]}"][value="${id.split(':')[1]}"]`):document.getElementById(id); e.focus();},id);
          await p.waitForTimeout(30);
          const r=await p.evaluate(()=>{const e=document.activeElement;const t=e.closest('.rcard')||e;const pad=e.closest('.rcard')?5:0;const r=t.getBoundingClientRect();const bar=document.querySelector('.dlv__bar').getBoundingClientRect();return {b:r.bottom+pad,barT:bar.top-16,t:r.top-pad}});
          ok(r.b<=r.barT+0.5 && r.t>=0,`${tag} focus ${id} clear of bar+fade (${r.b.toFixed(1)} <= ${r.barT.toFixed(1)})`);
        }
      } else {
        ok(a.pos==='static',`${tag} desktop bar static (${a.pos})`);
      }
      ok(!errs.length,`${tag} no console errors ${errs.join('|')}`);
      await ctx.close();
    }
  }
  // submit with errors on phone: first invalid focused and visible, not under the bar
  for(const [W,H] of [[320,640],[428,735]]){
    const p=await (await b.newContext({viewport:{width:W,height:H}})).newPage();
    await p.goto(BASE+'#/delivery?demo=1&delivery=courier'); await p.waitForTimeout(300);
    await p.evaluate(()=>scrollTo(0,1e5)); await p.click('#dlv-submit'); await p.waitForTimeout(200);
    const r=await p.evaluate(()=>{const e=document.activeElement;const r=e.getBoundingClientRect();const l=document.querySelector('label[for="'+e.id+'"]').getBoundingClientRect();const bar=document.querySelector('.dlv__bar').getBoundingClientRect();return {id:e.id,t:l.top,b:r.bottom,barT:bar.top-16}});
    ok(r.id==='d-pid' && r.t>=0 && r.b<=r.barT,`${W} submit focuses ${r.id} visible (label ${r.t.toFixed(1)}, bottom ${r.b.toFixed(1)} / ${r.barT.toFixed(1)})`);
  }
  // gaps (DLV-R3-01) and note offset (DLV-R3-02)
  for(const [W,H] of [[320,640],[375,667],[428,735],[768,1024],[1440,1024]]){
    const p=await (await b.newContext({viewport:{width:W,height:H}})).newPage();
    await p.goto(BASE+'#/delivery?demo=1'); await p.waitForTimeout(300);
    const m=await p.evaluate(()=>{const R=s=>document.querySelector(s).getBoundingClientRect();
      const cards=[...document.querySelectorAll('.rcard')].map(e=>e.getBoundingClientRect());
      const ink=s=>{const rg=document.createRange();rg.selectNodeContents(document.querySelector(s));return rg.getBoundingClientRect()};
      return {h:R('#dlv-method-h').bottom,c0:cards[0].top,c0b:cards[0].bottom,panel:R('#dlv-pickup').top,brLab:ink('label[for="d-branch"]').top,fLab:ink('label[for="d-first"]').top,
        pidB:R('#d-pid').bottom,note:R('#d-pid-err').top,recH:R('#dlv-rec-h').bottom,names:R('.dlv__names').top}});
    const desk=W>=900;
    ok(Math.abs((m.c0-m.h)-16)<0.6,`${W} heading→first card 16 (${(m.c0-m.h).toFixed(1)}) = heading→names ${(m.names-m.recH).toFixed(1)}`);
    if(!desk) ok(Math.abs((m.panel-m.c0b)-16)<0.6 && Math.abs((m.brLab-m.c0b)-(m.fLab-m.recH))<0.6,`${W} pickup card→branch panel 16 (${(m.panel-m.c0b).toFixed(1)}), label clearance ${(m.brLab-m.c0b).toFixed(1)} = heading→first-name label ${(m.fLab-m.recH).toFixed(1)}`);
    ok(Math.abs((m.note-m.pidB)-15)<0.6,`${W} ID note 15 under the field (${(m.note-m.pidB).toFixed(1)})`);
  }
  // courier panel gap
  {
    const p=await (await b.newContext({viewport:{width:428,height:735}})).newPage();
    await p.goto(BASE+'#/delivery?demo=1&delivery=courier'); await p.waitForTimeout(300); await p.selectOption('#d-city','თბილისი');
    const m=await p.evaluate(()=>{const c=document.querySelector('.rcard[data-value="courier"]').getBoundingClientRect();const pn=document.getElementById('dlv-courier').getBoundingClientRect();
      const rg=document.createRange();rg.selectNodeContents(document.querySelector('label[for="d-city"]'));const rg2=document.createRange();rg2.selectNodeContents(document.querySelector('label[for="d-first"]'));
      return {gap:pn.top-c.bottom,ink:rg.getBoundingClientRect().top-c.bottom,ref:rg2.getBoundingClientRect().top-document.getElementById('dlv-rec-h').getBoundingClientRect().bottom}});
    ok(Math.abs(m.gap-16)<0.6 && Math.abs(m.ink-m.ref)<0.6,`428 courier card→panel 16 (${m.gap.toFixed(1)}), city label clearance ${m.ink.toFixed(1)} = ${m.ref.toFixed(1)}`);
  }
  // REV2R3-08: shared note/error helper behaviour
  {
    const p=await (await b.newContext({viewport:{width:428,height:735}})).newPage();
    await p.goto(BASE+'#/delivery?demo=1'); await p.waitForTimeout(300);
    const r=await p.evaluate(async()=>{const i=document.getElementById('d-pid'),n=document.getElementById('d-pid-err');const o=[];
      const snap=()=>({t:n.textContent,err:n.classList.contains('is-error'),inv:i.getAttribute('aria-invalid'),desc:i.getAttribute('aria-describedby'),top:n.getBoundingClientRect().top});
      o.push(snap()); i.focus(); i.value='123'; i.dispatchEvent(new Event('input',{bubbles:true})); i.blur(); o.push(snap());
      i.focus(); i.value='01001012345'; i.dispatchEvent(new Event('input',{bubbles:true})); o.push(snap()); i.blur(); o.push(snap()); return o;});
    ok(r[0].t.startsWith('*პირადი')&&!r[0].err&&r[0].inv===null,'note default: orange note, no aria-invalid');
    ok(r[1].err&&r[1].inv==='true'&&!r[1].t.startsWith('*')&&r[1].top===r[0].top,`short ID on blur: error "${r[1].t}" in place, aria-invalid`);
    ok(r[2].t===r[0].t&&!r[2].err&&r[2].inv===null,'typing clears back to the note');
    ok(r[3].t===r[0].t&&!r[3].err&&r[3].inv===null&&r[0].desc&&r[0].desc.includes('d-pid-err'),'valid ID on blur stays the note; describedby kept');
  }
  console.log(fails?`FAILED ${fails}`:'ALL PASS'); await b.close(); process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(2)});

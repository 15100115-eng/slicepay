// Shared Playwright helpers for the functional / regression suites (ported from the v2 QA round 1 + round 3 libs,
// which were identical apart from the output folder and appVisText; plus newPage() from the round-1 auth lib).
// Every check() is counted; if any check failed the process exits non-zero, so run-all.js and CI see it.
const { chromium } = require('playwright');
const fs = require('fs');
const { BASE, outDir, suiteName } = require('./env');
const OUT = process.env.QA_OUT || outDir(suiteName());
let FAILED = 0;
process.on('exit', code => { if (!code && FAILED) process.exitCode = 1; });
const sleep = ms => new Promise(r => setTimeout(r, ms));

function mkLog(tag) {
  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail });
    if (!cond) FAILED++;
    console.log((cond ? 'PASS ' : 'FAIL ') + '[' + tag + '] ' + name + (detail !== undefined && !cond ? '  :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
    return !!cond;
  }
  function info(...a) { console.log('INFO [' + tag + ']', ...a.map(x => typeof x === 'string' ? x : JSON.stringify(x))); }
  function summary() {
    const f = results.filter(r => !r.ok);
    console.log(`SUMMARY [${tag}] ${results.length - f.length}/${results.length} passed`);
    return f;
  }
  return { check, info, summary, results };
}

async function launch() { return chromium.launch({ args: ['--disable-gpu'] }); }
async function newCtx(browser, W, errs, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: W < 900 ? 735 : 1024 }, deviceScaleFactor: opts.scale || 1 });
  if (opts.clock) await ctx.clock.install({ time: opts.clock });
  const p = await ctx.newPage();
  hook(p, errs);
  return { ctx, p };
}
function hook(p, errs, tag = '') {
  p.on('pageerror', e => errs.push(tag + 'pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(tag + m.type() + ': ' + m.text()); });
  p.on('requestfailed', r => errs.push(tag + 'requestfailed: ' + r.url()));
  p.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) errs.push(tag + 'network: ' + r.url()); });
}
const H = p => p.evaluate(() => location.hash);
async function waitHash(p, re, ms = 5000) {
  try { await p.waitForFunction(r => new RegExp(r).test(location.hash), re.source, { timeout: ms }); } catch (e) { /* reported by caller */ }
  return H(p);
}
async function go(p, hash) { await p.evaluate(h => { location.hash = h; }, hash); await sleep(250); return H(p); }
async function txt(p, sel) {
  return p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.getClientRects().length) || document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; }, sel);
}
async function tc(p, sel) { return p.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel); }
const vis = (p, sel) => p.locator(sel).locator('visible=true').first();
async function toast(p) { return p.evaluate(() => { const t = document.querySelector('#toast-root .toast'); return t ? t.textContent : ''; }); }
async function appText(p) { return (await p.innerText('#app')).replace(/\s+/g, ' '); }
// v3 reconcile: the visible text only. Screen-reader-only runs (.sr-only: 'შეკვეთა ', ', ', the timeline state
// ', შესრულებულია', the 'რაოდენობა' qty label, the lower-case twin of a Mtavruli heading) are added for a11y in v2 r1–r3
// and are not part of the designed copy, so copy checks read the page with them hidden.
async function appVisText(p, sel) {
  return p.evaluate(s => {
    const st = document.createElement('style'); st.textContent = '.sr-only{display:none!important}'; document.head.appendChild(st);
    const e = [...document.querySelectorAll(s || '#app')].find(x => x.getClientRects().length) || document.querySelector(s || '#app');
    const t = e ? e.innerText.replace(/\s+/g, ' ').trim() : null;
    st.remove(); return t;
  }, sel);
}
const st = p => p.evaluate(() => SlicePay.getState());
const totals = p => p.evaluate(() => SlicePay.totals());
async function noOverflow(p) { return p.evaluate(() => document.documentElement.scrollWidth <= innerWidth); }
async function active(p) { return p.evaluate(() => { const a = document.activeElement; if (!a) return null; return a.id || (a.tagName + '.' + (a.className || '') + '[' + (a.getAttribute('data-action') || a.getAttribute('data-explain') || a.getAttribute('data-back') || '') + '] "' + (a.innerText || a.value || '').slice(0, 30).replace(/\s+/g, ' ') + '"'); }); }

/** plain page without the network hook (round-1 auth suite) */
async function newPage(browser, W, errs) {
  const ctx = await browser.newContext({ viewport: { width: W, height: W < 900 ? 735 : 1024 } });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('pageerror: ' + String(e)));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  p.on('requestfailed', r => errs.push('requestfailed: ' + r.url()));
  return { ctx, p };
}
async function state(p) { return p.evaluate(() => SlicePay.getState()); }
async function visTxt(p, sel) {
  return p.evaluate(s => {
    const els = [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null || getComputedStyle(e).position === 'fixed');
    return els.length ? els[0].innerText.replace(/\s+/g, ' ').trim() : null;
  }, sel);
}
const hash = H;

/* ---- flows ---- */
async function landingAdd(p, url) {
  await p.goto(BASE + '#/'); await sleep(250);
  await p.fill('#url', url); await p.press('#url', 'Enter');
  return waitHash(p, /^#\/cart/, 8000);
}
/** add a product from the cart's add form (mock product) */
async function cartAdd(p, url) {
  await vis(p, '#add-trigger').click(); await sleep(250);
  await p.fill('#add-url', url); await p.press('#add-url', 'Enter');
  await p.waitForFunction(u => SlicePay.getState().products.some(x => x.url === u || x.url === u + '/'), url, { timeout: 4000 }).catch(() => {});
  await sleep(250);
}
/** register (valid) → returns the code from the toast; leaves the page on #/register/verify */
async function register(p, u) {
  await p.fill('#reg-first', u.first); await p.fill('#reg-last', u.last);
  await p.fill('#reg-phone', u.phone); await p.fill('#reg-pass', u.pass); await p.fill('#reg-email', u.email);
  if (!(await p.isChecked('#reg-terms'))) await p.click('#reg-terms', { force: true });
  await p.click('#auth-submit');
  await waitHash(p, /^#\/register\/verify/);
  await sleep(150);
  const t = await toast(p);
  return (t.match(/(\d{4})/) || [])[1];
}
async function verify(p, code) {
  await p.fill('#verify-code', code); await p.click('#auth-submit');
  return waitHash(p, /^#\/(delivery|orders)/);
}
async function login(p, phone, pass) {
  await p.fill('#log-phone', phone); await p.fill('#log-pass', pass); await p.click('#auth-submit');
  return waitHash(p, /^#\/(delivery|orders|pay|payment|cart|success)/);
}
/** fill the delivery form. d: {first,last,pid, method:'pickup'|'courier', branch, city, addr, note} */
async function delivery(p, d, submit = true) {
  if (d.first != null) await p.fill('#d-first', d.first);
  if (d.last != null) await p.fill('#d-last', d.last);
  if (d.pid != null) await p.fill('#d-pid', d.pid);
  if (d.method) { await p.click('.rcard[data-value="' + d.method + '"]'); await sleep(80); }
  if (d.method === 'courier') {
    if (d.city) await p.selectOption('#d-city', d.city);
    if (d.addr != null) await p.fill('#d-addr', d.addr);
    if (d.note != null) await p.fill('#d-note', d.note);
  } else if (d.branch) await p.selectOption('#d-branch', d.branch);
  if (submit) { await p.click('#dlv-submit'); return waitHash(p, /^#\/payment/); }
}
async function payCard(p) {
  await p.fill('#cc-num', '4242424242424242'); await p.fill('#cc-exp', '12/30'); await p.fill('#cc-cvv', '123');
  await p.click('#card-submit');
  return waitHash(p, /^#\/(success|orders\/)/, 6000);
}
/** v4: logout lives on #/profile (ᲒᲐᲡᲕᲚᲐ, [data-action="logout"]); the orders heading link is პროფილი. Opens the
    profile page directly (or through the orders heading link when viaOrders) and clicks ᲒᲐᲡᲕᲚᲐ. */
async function logout(p, viaOrders = false) {
  if (viaOrders) { await go(p, '#/orders'); await sleep(150); await vis(p, '.ord-top__out').click(); await waitHash(p, /^#\/profile$/); }
  else await go(p, '#/profile');
  await sleep(150);
  await vis(p, '[data-action="logout"]').click(); await sleep(300);
}
async function shot(p, name) { await p.screenshot({ path: OUT + '/' + name + '.png', fullPage: true }); }

module.exports = { BASE, OUT, sleep, newPage, state, visTxt, hash, mkLog, launch, newCtx, hook, H, waitHash, go, txt, tc, vis, toast, appText, appVisText, st, totals, noOverflow, active,
  landingAdd, cartAdd, register, verify, login, delivery, payCard, logout, shot };

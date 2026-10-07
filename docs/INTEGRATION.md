# SlicePay v2 — integration contract for screen engineers

> **Source of truth.** This file and [`ARCHITECTURE.md`](ARCHITECTURE.md) are the only maintained project docs (from v4
> on). The sections are cumulative: v2 below, then "v3 changes" and "v4 changes"; a later section supersedes an earlier
> one where they differ (e.g. v4 moves logout from the orders list to `#/profile`, and the user record now keeps the
> account's own profile). Old `tools/<name>.js` and `SCRATCH/...` paths are historical; the maintained tests are in
> `tests/` (see [`tests/README.md`](../tests/README.md)).

The core engineer wrote this. It is authoritative for everything SHARED: `index.html`, `css/base.css`,
`css/fonts.css`, `js/core.js`, `js/ui.js` and `js/app.js`. **Do not edit those files.** If you need a
shared change, ask the core owner and explain why. Screen copy is in [`FEATURES_SPEC.md`](specs/FEATURES_SPEC.md) and is final:
use it verbatim. The visual language is in [`DESIGN_SYSTEM.md`](design/DESIGN_SYSTEM.md).

The project is plain HTML/CSS/vanilla JS with classic scripts. It must work over file://, use no
libraries and make no network calls. Escape all user text with `SP.esc` before it goes into
innerHTML. Never persist card data. Keep the personal ID in session state only; it is persisted only
masked.

`SP` = `window.SlicePay`, `UI` = `SP.ui`.

---

## 0. File ownership (one engineer per row; touch only your files)

| Engineer | Files | Feature work (FEATURES_SPEC section) |
|---|---|---|
| **E1 Auth** | `js/screens/auth.js`, `css/screens/auth.css` | §1 phone verification: register → pending + code → **new route `/register/verify`**; login `next` handling; register prefill on "ნომრის შეცვლა" |
| **E2 Delivery** | `js/screens/delivery.js`, `css/screens/delivery.css` (core left placeholders: **replace them entirely**) | §2+3+6 delivery step, personal ID, ETA box |
| **E3 Cart + Landing** | `js/screens/cart.js`, `css/screens/cart.css`, `js/screens/landing.js`, `css/screens/landing.css` | cart ETA line, "how is it calculated?" link, cart term label `N თვეში`, next → `/delivery`; landing account link |
| **E4 Payment + card form** | `js/screens/payment.js`, `css/screens/payment.css`, `js/screens/pay.js`, `css/screens/pay.css` | §7 term chips, payment summary monthly + ETA, back → `/delivery`; card form: `completeCheckout()`, order mode `#/pay?order=<id>` |
| **E5 Success** | `js/screens/success.js`, `css/screens/success.css` | delivery section, term-aware summary, delivery fee row, `ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ` + `ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ` buttons |
| **E6 Orders** | `js/screens/orders.js`, `css/screens/orders.css` (core left placeholders: **replace them entirely**) | §4 list, detail, logout, empty state |

`index.html` already loads every file above in this order: core, ui, landing, cart, auth, payment, pay,
success, delivery, orders, app. The CSS loads in the same order.

---

## 1. State shape (`SP.state()`; persisted in sessionStorage `slicepay:v1:state`)

```js
{
  products: [{ id, name, url, store:'amazon'|'ebay', img|null, item, weight, customs, service, qty, weightKg }],
  deferWeight: true, deferCustoms: true,
  method: 'bog'|'tbc'|'mere',
  term: 4,                        // NEW: always a member of SP.termsFor(method)
  delivery: {                     // NEW (always an object)
    done: false,                  // true once the delivery step is completed → fee joins the total; /payment & /pay require it
    method: 'pickup'|'courier',   // default 'pickup'
    branchId: 'vake',             // pickup branch id (SP.BRANCHES)
    city: '', address: '', note: '',   // courier fields (city ∈ SP.CITIES, '' = not chosen)
    first: '', last: '', pid: ''  // recipient; pid = 11 digits, SESSION ONLY
  },
  userPhone: '555123456'|null,
  profile: { first, last }|null,  // NEW: names of the account verified in this session (delivery prefill)
  pendingReg: null | {            // NEW: registration awaiting SMS verification
    first, last, phone, email,    // phone = 9 digits
    rec,                          // salted password hash record (never the plain password)
    code, sentAt, expiresAt,      // 4-digit code, ms timestamps (30 s cooldown, 5 min expiry)
    next,                         // optional ?next= carried from register
    demo                          // true only for the QA seed
  },
  order: <order snapshot>|null,   // last paid checkout (success screen); same object shape as stored orders
  recover, loginPhone,
  ui: { details:{}, payDetails:false }
}
```

Mutate state through the helpers below when one exists (`SP.setMethod`, `SP.setTerm`,
`SP.completeCheckout`, `SP.signIn`, `SP.api.*`). For plain fields, mutate `SP.state()` and call
`SP.save()`, or call `SP.set(patch)`. `SP.set` replaces top-level keys, so to change one delivery
field do `var d = SP.state().delivery; d.city = 'ბათუმი'; SP.save();`.

### Order object (state.order and every stored order)

```js
{
  id: '731954', date: '2026-09-27', createdAt: 1790000000000,
  products: [...product snapshots incl. weightKg],
  deferWeight, deferCustoms,
  method: 'bog', term: 4, monthly: 150, total: 600,   // total = what was paid/financed at checkout (incl. delivery fee)
  deliveryFee: 0,
  delivery: { method:'pickup'|'courier', branchId, branchName, branchAddr, city, address, note,
              recipient: 'გიორგი ბერიძე', pidMasked: '********345', fee },
  eta: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' },
  status: 'ordered'|'transit'|'warehouse'|'customs'|'ready'|'courier'|'delivered',
  timeline: [{ key:'ordered', date:'2026-09-27' }, ...],   // steps reached so far, with dates
  deliveredAt: 'YYYY-MM-DD'|null,
  deferred: {
    weight:  { est:100, actual:112|null, prepaid:false, paid:false, paidAt? } | null,   // null = part is 0
    customs: { est:250, actual:238|null, prepaid:false, paid:false } | null
  }   // prepaid:true = the estimate was paid at checkout (a higher actual → the difference is due)
}
```

Orders are persisted in localStorage `slicepay:v1:orders` as `{ <phone>: [order…] }`. They contain no
card data, and the personal ID only as `pidMasked`.

---

## 2. Core API (`js/core.js`)

### Formatting (`SP.fmt`)

| Function | Example |
|---|---|
| `money(n)` / `moneySp(n)` | `600₾` / `600 ₾` (existing) |
| `date(iso)` | `'2026-09-27'` → `27 სექტემბერი 2026` (existing) |
| `dayMonth(iso)` | `'2026-08-03'` → `3 აგვისტო` (for `ჩაბარდა: 3 აგვისტო`) |
| `range(fromIso, toIso)` | `16–21 ოქტომბერი`; across months `28 ოქტომბერი – 3 ნოემბერი` |
| `addDays(iso, n)`, `addMonths(iso, n)`, `todayIso()` | ISO strings, local calendar |
| `ordinal(n)` | `1-ლი`, `მე-2` (schedule rows: `ordinal(n) + ' შენატანი'`) |
| `kg(n)` | `4`, `1,6` |
| `pidMask(pid)` | `01001012345` → `********345` |
| `phone(raw)` | `555 123 456` (existing) |

### Validation and copy

- `SP.valid.pid(v)` returns true for exactly 11 digits. `SP.valid.code(v)` and `SP.valid.phone(v)` are unchanged.
- `SP.msg` adds `codeExpired`, `first`, `last`, `pid`, `branch`, `city` and `address`, in the exact spec copy. `code` and `codeWrong` already exist.
- `SP.toastMsg` holds `{verified, paid, logout, testCode}`.

### Pricing and terms

- `SP.totals(st?)` returns `{item, weight, customs, service, subtotal, delivery, total, term, monthly, deferWeight, deferCustoms}`.
  - `total` = `subtotal` + delivery fee. The delivery fee is counted only when `st.delivery.done`, or from `st.deliveryFee` on an order snapshot.
  - `monthly` = `ceil(total / term)`.
  - It works on the live state (the default), on an order (`SP.totals(order)`), or on any `{products, deferWeight, deferCustoms[, term][, delivery|deliveryFee]}`. Old callers get term 4 and fee 0.
- `SP.monthly(total, term)` returns `ceil(total / term)`.
- `SP.TERMS = {bog:[3,4,6], tbc:[3,4,6,9,12], mere:[4,6,12]}`. `SP.termsFor(method)` returns a copy.
- `SP.nearestTerm(method, term)` returns the term if the method offers it, otherwise the nearest one (a tie goes to the shorter term).
- `SP.setMethod(method)` sets the method, re-fits the term, saves, and returns the term. **The payment screen must use this, not `st.method = …`.**
- `SP.setTerm(n)` fits `n` to the method, saves, and returns the stored term.
- `SP.TARIFF_PER_KG = 25`. `SP.weightKg(p)` returns kg per unit (`weightKg`, else `weight / 25`). The Nike demo is 4 and mock products are `weight / 25`.

### Delivery and ETA

- `SP.BRANCHES`: `[{id, name, addr, city, label}]`. Ids are `vake`, `saburtalo`, `gldani`, `batumi` and `kutaisi`. `label` is the exact option text, e.g. `ვაკის ფილიალი — ჭავჭავაძის გამზ. 37, თბილისი`.
- `SP.CITIES` holds the 8 courier cities in spec order. `SP.CAPITAL = 'თბილისი'`. `SP.branch(id)` returns a branch or null.
- `SP.deliveryFee(d)`: pickup 0; courier 5 in Tbilisi and 10 elsewhere; 0 while no city is chosen.
- `SP.deliveryLabel(d)` gives `ფილიალიდან გატანა: ვაკის ფილიალი` or `კურიერით: თბილისი, <address>`. It works for `state.delivery` and for `order.delivery`. The result is plain text, so escape it.
- `SP.etaDays(products, delivery)` returns `{from, to}` in days.
  - Store windows: amazon 9–14, ebay 12–20, other 12–20.
  - A multi-store cart takes the widest window.
  - Courier adds +1 day in Tbilisi and +2 in the regions. *(v2 r2)* Courier with no city yet: +1 / +2 (`{from+1, to+2}`), the window covering both.
- `SP.eta({products?, delivery?, date?})` returns `{from:iso, to:iso}`. Each input defaults to the live state or today. The delivery screen passes its draft: `SP.eta({delivery: draft})`.
- `SP.etaText(eta)` returns `16–21 ოქტომბერი`.
- `SP.deliveryDefaults(keep?)` returns a fresh delivery object, keeping the fields of `keep`.
- *(v2 r2)* `SP.deliverySnapshot` is no longer exported (internal to `createOrder`).
- `SP.qty(p)` *(v2 r2)*: a product's quantity as a whole number ≥ 1. Use it wherever a quantity is rendered (stored snapshots are not trusted). Quantities are also normalised when the state and stored orders are read.
- `SP.QA_ORDER_ID` *(v2 r2)*: `'123456'`, the id of the fabricated `#/success?demo=1` receipt when no `?order=` is given.

### Auth, registration and verification

| Call | Returns / effect |
|---|---|
| `SP.api.startRegistration({first,last,phone,email,password,next?})` | `{ok:true, code}` and stores `state.pendingReg` (password hashed). `{ok:false, error:'exists'}` if the phone is registered. Show `UI.codeToast(code)` and go to `/register/verify`. *(v2 r2)* The per-phone 30 s cooldown lives here: a number sent a code within its cooldown (and still valid) gets the same code, `sentAt` and `expiresAt` back. The log is sessionStorage `slicepay.verifySent`, outside the state, so sign-out does not reset it |
| `SP.api.resendVerify()` | `{ok:true, code}` (new code, cooldown and expiry restart). `{ok:false, error:'cooldown', left}` or `{ok:false, error:'none'}` |
| `SP.verifyCooldown()` | Seconds before a resend is allowed (0 = now). Drive the `(0:30)` countdown from it every 250 ms, as recover does |
| `SP.api.verify(code)` | `{ok:true, phone, next}`: the account is created, the user is signed in (`SP.signIn`), `profile` is set and `pendingReg` is cleared. Errors: `'format'` → `SP.msg.code`; `'wrong'` → `SP.msg.codeWrong`; `'expired'` → `SP.msg.codeExpired`; `'exists'` → `SP.msg.userExists`; `'none'` → go to `/register` |
| `SP.VERIFY_COOLDOWN` (30000), `SP.VERIFY_TTL` (300000) | ms |
| `SP.signIn(phone)` | Sets `userPhone`, clears `loginPhone` and `pendingReg`, saves. **Login must use it** instead of `SP.set({userPhone})`. *(v2 r1)* A different phone than the current `userPhone` (a guest included) first resets `delivery` (fresh defaults), `profile`, `order`, `recover` and `ui`; the cart stays. `SP.api.verify` sets `profile` after it |
| `SP.afterLoginTarget(ctx.query)` | A safe `next`, else `/delivery` when the cart has products, else `/orders` |
| `SP.afterRegisterTarget(r.next)` | The same rule after a verification |
| `SP.safeNext(next)` | The value if it is an in-app, non-auth route; otherwise `null` |
| `SP.loginUrl(next)` | `'/login?next=/orders'` (use with `SP.go`) |
| `SP.withNext(path, next)` *(v2 r1)* | `path + '?next=…'` with the same encoding (path alone when `next` is empty). Auth uses it for login ↔ register ↔ recover links |
| `SP.logout()` / `UI.logout()` | Clears the whole session, shows the toast `თქვენ გამოხვედით სისტემიდან`, goes to `#/` |
| `SP.isAuthed()` | Unchanged |

### Orders

| Call | Returns / effect |
|---|---|
| `SP.orders.list()` | The signed-in user's orders, newest first. **The demo user (555 123 456) gets the two demo orders automatically on first access** |
| `SP.orders.get(id)` | An order or `null` |
| `SP.orders.save(order)` | Upsert by id (also refreshes `state.order` when it is the same id) |
| `SP.orders.seedDemo(phone?)`, `.clear(phone?)`, `.remove(id)` | QA helpers |
| `SP.STATUS` | `{ordered:'შეკვეთილია', transit:'გზაშია', warehouse:'საწყობშია', customs:'განბაჟება', ready:'მზადაა გასატანად', courier:'კურიერთანაა', delivered:'ჩაბარდა'}` |
| `SP.orderSteps(o)` | The 6 step keys (pickup ends in `ready`, courier in `courier`) |
| `SP.orderTimeline(o)` | `[{key, label, date|null, state:'done'|'current'|'todo'}]` |
| `SP.orderDue(o)` | `{weight, customs, total, pending, deferred}`. `weight` and `customs` are `SP.partDue` objects or null. `total` = amount payable now (350 for #731954). `pending` = a deferred amount is still unknown (`განისაზღვრება ამანათის ჩამოსვლისას`) |
| `SP.partDue(part)` | `{est, actual, prepaid, paid, due, refund, pending}`. **Row rendering:**<br>• `paid` → `გადახდილია`<br>• `pending` → `დაახ. 100₾` + `განისაზღვრება ამანათის ჩამოსვლისას`<br>• otherwise → `დაახ. 100₾` → `ფაქტობრივი 112₾` |
| `SP.orderPill(o)` | *(v2 r1)* `{kind:'progress'|'due'|'done', label}`. `label` is always the status name; `kind` is `due` while something is due (the list adds the `SP.DUE_LABEL + ': N₾'` badge) |
| `SP.orderArrival(o)` *(v2 r1)* | `{label:'სავარაუდო მიღება', value:'16–21 ოქტომბერი'}`, or `{label:'ჩაბარდა', value:'3 აგვისტო'}` once delivered |
| `SP.itemNotes(p, o)` *(v2 r1)* | `['წონის გარეშე', 'განბაჟების გარეშე']` for one ordered product (success + order detail) |
| `SP.orderSchedule(o)` | `[{n, label:'1-ლი შენატანი', date, amount}]`. The first instalment is one month after the order date. *(v2 r1)* The remainder is spread +1₾ over the first instalments (605/4 → 152, 151, 151, 151) |
| `SP.payDeferred(id)` | Marks everything due as paid. A `customs` order moves to its next status (`ready` / `courier`) dated today — *(v2 r1)* only once nothing is due or still undetermined. Saves and returns the order |
| `SP.createOrder(over?)` | Builds the full order from the live state, sets `state.order` and stores it. `over = {id, date, persist:false}` |
| `SP.completeCheckout(over?)` | **The card form calls this on success.** It runs `createOrder`, then empties the cart and resets `deferWeight`/`deferCustoms`/`method`/`term`/`ui`. `delivery.done` becomes false; the recipient and address are kept for the next order. Returns the order |

### Router

- `SP.route('/orders/:id', def)` supports params, read as `ctx.params.id`. `ctx` = `{path, query, params, route, desk, state, entry}`.
- `def.title` may be a function: `title: function (ctx) { return 'შეკვეთა #' + ctx.params.id; }`.
- `SP.matchRoute(path)` returns `{def, params, pattern}` or null.
- `SP.back(path, {any:true})` steps back when there is any in-app previous entry, otherwise goes to `path`. Use it for "back → previous / landing" on the orders list.
- *(v2 r2)* While a `history.back()` of `SP.back` (or `SP.skipEntry`) is under way, further `SP.back` / `SP.go` calls are ignored until the next popstate / hashchange (600 ms safety timeout), so a double click steps back once.
- *(v2 r2)* Every history entry is stamped with a monotonically increasing `spIdx` (sessionStorage `slicepay.histIdx`); a replacement keeps the replaced entry's index. `SP.navDir()` → `'back' | 'forward' | 'push' | 'replace' | 'load' | 'same'` for the current entry.
- *(v2 r2)* `SP.skipEntry(target, backTarget)` leaves a stale entry in the direction of travel: Back steps on back, Forward steps on forward, a fresh entry is replaced with `target`. Back with no in-app entry behind lands on `backTarget`. The router uses it for signed-in `#/login` and `#/register/verify`; `auth.js` uses it for the stale `#/register` entry.
- *(v2 r2)* `SP.authBackTarget()`: `/cart` when the cart has products, else `/` (the auth screens' back target).
- `SP.go`, `SP.rerender`, `SP.set` and `SP.save` are unchanged.
- Re-render value restore (`SP.rerender({keepValues:true})`) now also covers `<select>` and `<textarea>`.
- Focus restore keys add `data-explain`, `data-order` and `data-acct`.

#### Routes and guards (all implemented in core)

| Route | Registered by | Guard |
|---|---|---|
| `#/register/verify` | **E1 (auth.js), `screen:'auth'`** | No `pendingReg` → `/register`. *(v2 r1)* Signed in (not `?demo=1`) → `SP.afterLoginTarget` |
| `#/login` *(v2 r1)* | E1 | Signed in (not `?demo=1`) → `SP.afterLoginTarget` (switching accounts = sign out first) |
| `#/delivery` | E2 | No products → `/`; not signed in → `/login` (remembered phone) or `/register` |
| `#/payment` | E4 | Products + auth (as above) + `delivery.done`, else `/delivery` |
| `#/pay` | E4 | Checkout mode: same as `/payment` |
| `#/pay?order=<id>` | E4 | Not signed in → `/login?next=/pay%3Forder%3D<id>`; unknown order → `/orders`; nothing due → `/orders/<id>` |
| `#/orders` | E6 | Not signed in → `/login?next=/orders` |
| `#/orders/:id` | E6 | Not signed in → `/login?next=/orders/<id>`; unknown id → `/orders` |
| `#/success` | E5 | Unchanged (`state.order`) |

#### Back targets (use `UI.dHead(target)` + `UI.mBar({back: target})`)

| From | Target |
|---|---|
| register/verify | `/register` (also "ნომრის შეცვლა") |
| delivery | `/cart` |
| payment | **`/delivery`** (was `/cart`) |
| pay (checkout) | `/payment` |
| pay (order mode) | `/orders/<id>` |
| orders list | previous screen, else `/` (`{backAny:true}` / `left.any`) |
| orders detail | `/orders` |

Cart "next" always goes to `/delivery` when signed in. Otherwise it goes to `/login` (remembered phone) or `/register`, as now.

---

## 3. Shared UI (`js/ui.js`) and CSS classes (`css/base.css`)

| Function | What it renders / does | Main classes |
|---|---|---|
| `UI.T` / `UI.Tm` + `UI.mt(key)` | New keys:<br>• `confirm` ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ<br>• `myOrders` ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ<br>• `newOrder` ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ<br>• `delivery` ᲛᲘᲬᲝᲓᲔᲑᲐ (receipt heading)<br>Existing keys: `next`, `back`, `pay` (ᲒᲐᲓᲐᲮᲓᲐ), `ok` (ᲒᲐᲡᲐᲒᲔᲑᲘᲐ), `home` | |
| `UI.toMt(s)`, `UI.mtx(s)` | Converts any Mkhedruli string to Mtavruli; `mtx` renders the Mtavruli plus an sr-only Mkhedruli twin (escaped) | |
| `UI.dHead(backTo, {account, backAny})` | Desktop header. **While signed in it adds the purple top-right link `ჩემი შეკვეთები`** (`#/orders`). Pass `{account:false}` on the orders screens | `.d-head .acct-link` |
| `UI.accountLink('light')` | The landing's white 16 px link with a user icon: `ჩემი შეკვეთები` (signed in) or `შესვლა` (→ `#/login?next=/orders`). The landing positions it (top-right) | `.acct-link.acct-link--light` |
| `UI.mBar(left, right, opts)` | `left.any:true` → back to the previous screen, else `left.back`. *(v2 r2)* `opts.sticky` → `.m-bar--sticky`: below 900 px the bar sticks to the viewport bottom (90 px box, 16 px fade, `scroll-padding-bottom:110px`) and stays in flow when the page fits (cart, payment) | `.m-bar`, `.m-bar--sticky` |
| `UI.breakdown(t, variant, opts)` | Weight and customs rows now carry an info button, placed between leader and label so labels keep their alignment (`opts.info:false` hides it; `opts.productId` ties it to one product). Adds the row `მიწოდების ფასი` when `t.delivery > 0`. **Payment: `.pay-bd` has a fixed `height:150px`; make it fit a 6th row when the fee > 0** | `.bd .info-btn` |
| `UI.infoBtn(focus, productId?, orderId?, describedby?)` | *(v2 r1: `describedby` = id of its row label; `UI.breakdown` sets it)* 24 px button with a 16 px circled i (#79747e), `aria-label="როგორ ითვლება?"`, `data-explain`. Clicks are delegated in ui.js: no wiring needed | `.info-btn` |
| `UI.explainLink(cls?)` | The cart's `როგორ ითვლება დაახლოებითი თანხები?` link button (`data-explain="all"`) | `.link` |
| `UI.explain({focus, product|products})` | The explanation: a desktop dialog, or a bottom sheet below 900 px (handle, drag-down / backdrop / Esc / ✕ / ᲒᲐᲡᲐᲒᲔᲑᲘᲐ close it). Copy is in `UI.EXPLAIN`. Products add the line `დაახლოებითი წონა: 4 კგ × 25₾ = 100₾` (`UI.weightCalc`) | `.modal--sheet`, `.modal--explain`, `.explain__sec(.is-focus)`, `.modal__handle` |
| `UI.modal({…, sheet, cls, onOpen})` | Existing modal, plus the sheet option | `.modal` |
| `UI.etaRow(eta, {cls, lineCls, id, centred})` *(v2 r2)* | Truck icon + `UI.etaLine` (cart and payment summaries). `centred` = under the desktop summary button | `.eta-row`, `.eta-row__ico`, `.eta-row--c` |
| `UI.termLabel(term)` *(v2 r2)* | `N თვეში` (cart and payment summaries) | |
| `UI.etaLine(eta, {cls,id,label,value})` | `<p class="eta-line">` 14 px #666. `label` overrides `სავარაუდო მიღება`; *(v2 r1)* `value` replaces the ETA window text. `.eta-line__v` is `nowrap` in base | `.eta-line`, `.eta-line__v` |
| `UI.orderEtaLine(o, {cls,id})` *(v2 r1)* | The order card line from `SP.orderArrival` (ETA or `ჩაბარდა: …`) | `.eta-line` |
| `UI.cooldownLink(btn, base, leftFn)` *(v2 r1)* | Drives a resend link's `(0:30)` countdown + `aria-disabled` every 250 ms; returns `{refresh, stop}` (recover code + phone verification) | |
| `UI.etaBox(eta, {cls,id})` | Light purple box: truck icon, `ამანათის სავარაუდო მიღება: <b>…</b>`, and the note `ვადა შეიძლება შეიცვალოს საბაჟო პროცედურების გამო`. `id` goes on the value span, for live updates via `textContent = SP.etaText(…)` | `.eta-box`, `.eta-box__v` |
| `UI.termChips({method, term, total, id})` | Label `განვადების ვადა` + `<fieldset role="radiogroup">` of native radios (`name="term"`, ids `term-N`; arrow keys native) + note `0% საკომისიო · საბოლოო პირობებს ადგენს ბანკი`. Chips show `4 თვე` / `150₾ / თვე`. 5 chips fall back to 3 + 2 rows below a 432 px container | `.terms`, `.term-chip(.is-selected)`, `.term-chip__n/__m`, `.terms__note` |
| `UI.bindTermChips(root, onChange)` | Wires the chips: `SP.setTerm`, `.is-selected`, `onChange(term)`. On a method change, re-render the block with `el.outerHTML = UI.termChips(…)` | |
| `UI.radioCards({name, label, items:[{value, checked, title, sub}]})`, `UI.radioCard(o)`, `UI.bindRadioCards(root, name, onChange)` | Generic radio cards in the payment-card language (24 px radio, 16/24 600 title, 14/18 #666 sub; selected = #f3efff bg + #5e34ec border) | `.rcards`, `.rcard(.is-selected)`, `.rcard__radio/__title/__sub` |
| `UI.selectField({id, label, options, value, optional, noErr, describedby})` | A `<select>` styled like `.field__input` (50 px, #878787 border, custom caret). The empty option is the placeholder (= label); the label floats once a value is chosen. Errors use `UI.setError(select, msg)` → `#<id>-err`. Options are strings or `{value, label}` | `.field--select`, `.field__select`, `.field__caret` |
| `UI.statusPill(order)` | *(v2 r1)* The status name in: progress #f3efff/#5e34ec, due #fff4e5/#9a5c00 (AA), delivered #e8f5ee/#1e7b4a | `.status-pill--progress/--due/--done` |
| `UI.timeline(order, {labelledby})` | Vertical stepper: done = check, current = ring + dot in #5e34ec (`aria-current="step"`), todo = #666, with dates. *(v2 r1)* Each step carries an sr-only state (`შესრულებულია` / `მიმდინარე ეტაპი` / `მოსალოდნელი`) | `.tl`, `.tl__item.is-done/.is-current/.is-todo` |
| `.btn.btn--secondary` | Outline button: white bg, #5e34ec text and 1 px inset border, 60 px high like `.btn` | |
| `UI.codeToast(code)`, `UI.toast(msg)` | Unchanged | |

Body backgrounds: `data-screen="delivery"` and `"orders"` are white on mobile and #f4f4f4 on desktop,
like auth. Register `/register/verify` with `screen:'auth'`.

---

## 4. QA URL params (applied once per history entry on route entry)

| Param | Where | Effect |
|---|---|---|
| `demo=1` | everywhere | • Nike demo product, demo user signed in, bog, term 4, both defers, profile `გიორგი ბერიძე`.<br>• **Except on `/delivery`:** a completed delivery (pickup, ვაკე, `გიორგი ბერიძე`, ID `01001012345`), so the payment/pay/success parity stays at 600₾ / 150₾. |
| `demo=1` | `/delivery` | Delivery not done: pickup, ვაკე, names prefilled, ID empty |
| `demo=1` | `/register/verify` | `pendingReg` for 555 123 456 with code **4821**, no cooldown, **not signed in** (the demo account is reused on success) |
| `demo=1` | `/orders`, `/orders/:id`, `/pay?order=` | Re-seeds the two demo orders: #548210 delivered (2 months ago, courier, tbc 6×125, 745₾); #731954 in customs (9 days ago, pickup ვაკე, 600₾ = 150₾ × 4, **350₾ due**) |
| `delivery=courier\|pickup` | any | Sets `delivery.method`. On a completed (demo) delivery, courier fills in თბილისი + `ვაჟა-ფშაველას გამზ. 12` (fee 5₾ → 605₾, monthly 152₾) |
| `term=N` | any | `state.term` = nearest available for the method (e.g. `term=6`) |
| `info=weight\|customs\|all` | `/cart`, `/payment` | Opens the explanation (core does it after mount) |
| `empty=1` | `/orders` | Clears the user's orders (empty state) |
| `order=<id>` | `/pay` | Order-payment mode |
| `err=1` | delivery, verify | Show validation errors (screen implements) |

The existing params (`weight`, `customs`, `method`, `details`, `err`, `processing`, `date`, `order` on
success, `auth=0`, `anim=0`, `toast=1` …) are unchanged.

---

## 5. What each screen must do

### E1 Auth (`auth.js`)

1. **Register submit (valid):** call `r = SP.api.startRegistration({first, last, phone, email, password, next: ctx.query.next})`.
   - On `exists`, set the phone error `SP.msg.userExists` (as now).
   - Otherwise call `UI.codeToast(r.code)`, then `SP.go('/register/verify')`.
   - Do **not** create the account or sign in here.
2. **Register prefill:** if `SP.state().pendingReg` exists, prefill first, last, phone and email (not the password). This is the "ნომრის შეცვლა" path.
3. **`/register/verify`:** same layout as recover/code. Use input id **`verify-code`** (tests use it).
   - Heading `ტელეფონის დადასტურება`.
   - Text `SMS კოდი გამოგზავნილია ნომერზე <b>555 123 456</b>`, using `SP.fmt.phone(p.phone)`.
   - Input placeholder `SMS კოდი`, numeric, maxlength 4, `autocomplete=one-time-code`.
   - Resend link with the `(0:30)` countdown from `SP.verifyCooldown()`; it calls `SP.api.resendVerify()` → `UI.codeToast`.
   - Link `ნომრის შეცვლა` → `SP.go('/register')`.
   - Button `UI.mt('confirm')`. Mobile bar `ᲣᲙᲐᲜ` (→ `/register`) + `ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ`.
   - Errors map from `SP.api.verify`. Clear the countdown timer on unmount.
4. **Verify success:** `UI.toast(SP.toastMsg.verified)` and `SP.go(SP.afterRegisterTarget(r.next), {replace:true})`.
5. **Login success:** `SP.signIn(phone)` (instead of `SP.set`), keep remember-me, then `SP.go(SP.afterLoginTarget(ctx.query), {replace:true})`. Keep the `next` param when linking login ↔ register (`#/register?next=…`).

### E2 Delivery (`delivery.js`, `screen:'delivery'`)

1. Use the layout in the spec. `UI.dHead('/cart')` provides the account link. Mobile bar: `ᲣᲙᲐᲜ` → `/cart`, `ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ`.
2. **Recipient fields** use `UI.field`. Prefill each from `state.delivery.first/last/pid`, falling back to `state.profile` (and `pendingReg` if any). The `პირადი ნომერი` field is numeric with 11 digits. Below it goes the orange note in the register-note style (`.t-note.auth__note` look; copy your own class).
3. **Method:** `UI.radioCards({name:'dmethod', …})` + `UI.bindRadioCards`.
   - Pickup shows the branch select: `UI.selectField({id:'d-branch', label:'აირჩიეთ ფილიალი', options: SP.BRANCHES.map(b => ({value:b.id, label:b.label})), value: d.branchId})`.
   - Courier shows the city select (`SP.CITIES`), the address field and the optional note field (`optional:true`).
4. **ETA box:** `UI.etaBox(SP.eta({delivery: draft}), {id:'d-eta'})`. Update it when the method or city changes.
5. **Validate** with the `SP.msg.*` delivery messages and `SP.valid.pid`. On success, write the fields into `SP.state().delivery`, set `done = true`, call `SP.save()`, then `SP.go('/payment')`.
6. Support `?err=1`; `?delivery=courier` is already applied to the state.

### E3 Cart + Landing

- **Cart summary:**
  - Use `'N თვეში'` with `t.term` (from `SP.totals()`) instead of the literal 4. `t.monthly` already honours the term and the delivery fee.
  - Add `UI.etaLine(SP.eta())` without moving designed elements: below the checkboxes on mobile, under the summary divider on desktop.
  - Add `UI.explainLink()` under the two checkboxes.
- **Cart breakdown:** pass `{productId: p.id}` in the `UI.breakdown` opts so the product's weight line shows. The info buttons are already there.
- **Cart next:** go to `/delivery` when signed in.
- **Landing:** place `UI.accountLink('light')` top-right on the gradient (white, 16 px, user icon), in both states.

### E4 Payment + card form

- **Payment:**
  - Use `SP.setMethod(value)` on method change, then re-render the term block (`UI.termChips` + `UI.bindTermChips`).
  - Desktop: the term block goes in the empty area under the method cards (645 wide). Mobile: after the cards, before the notes.
  - The summary shows the monthly amount (`t.monthly`) and an ETA line.
  - The breakdown gets the delivery row when the fee > 0 (fix the fixed 150 px height).
  - Back goes to `/delivery`.
  - `?term=6` is applied by core.
- **Card form (checkout):** on success call `SP.completeCheckout()` instead of `SP.createOrder()` + `SP.set(…)`, then `SP.go('/success', {replace:true})`.
- **Order mode `#/pay?order=<id>` (`ctx.query.order`):**
  1. `o = SP.orders.get(id)` and `due = SP.orderDue(o).total`.
  2. Show the line `გადასახდელი: 350₾` (bold) above "Pay with".
  3. Back (desktop header and mobile ᲣᲙᲐᲜ) goes to `/orders/<id>`.
  4. On success: `SP.payDeferred(id)`, `UI.toast(SP.toastMsg.paid)`, `SP.go('/orders/' + id, {replace:true})`.

### E5 Success

1. Read everything from the snapshot: `o = state.order` and `t = SP.totals(o)` (uses `o.term` and `o.deliveryFee`).
2. **Summary:** `თვეში` `<o.term>x` `<t.monthly>`, plus the row `მიწოდების ფასი` only when `o.deliveryFee > 0`. The parity demo must stay `4x 150₾ / 600₾`.
3. **Receipt section** after `გადახდის მეთოდი`: heading `UI.mt('delivery')`, then line 1 `SP.deliveryLabel(o.delivery)` (escaped) and line 2 the ETA (`SP.etaText(o.eta)`; *(v2 r2)* `UI.etaText` is removed).
4. **Buttons:** `<button class="btn btn--secondary" data-action="orders">UI.mt('myOrders')</button>` → `SP.go('/orders')`, then the existing primary `ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ`.

### E6 Orders (`orders.js`, `screen:'orders'`)

- **List (`/orders`):**
  - Header: `UI.dHead('/', {account:false, backAny:true})`. Heading `ჩემი შეკვეთები` + the link `გასვლა` → `UI.logout()`.
  - Cards, newest first from `SP.orders.list()`:
    - `#id · SP.fmt.date(o.date)`
    - `UI.statusPill(o)`
    - product names (ellipsis, `+N`)
    - `სულ 600₾ · 150₾ × 4 თვე`
    - `UI.etaLine(o.eta)`, or `ჩაბარდა: ` + `SP.fmt.dayMonth(o.deliveredAt)`
    - the due badge `გადასახდელია: ` + `SP.fmt.money(SP.orderDue(o).total)` when it is > 0
  - Empty state: `ჯერ არ გაქვთ შეკვეთები` + `UI.mt('newOrder')` → `/`.
  - Mobile bar: `ᲣᲙᲐᲜ` (`any:true`, back `/`) + `ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ`.
- **Detail (`/orders/:id`, `ctx.params.id`):**
  - Heading `შეკვეთა #id` and `UI.timeline(o)`.
  - Sections `პროდუქტები` (`UI.thumb`), `მიწოდება` (`SP.deliveryLabel`, recipient, `პირადი ნომერი: ` + `o.delivery.pidMasked`, ETA) and `გადახდა` (`UI.method(o.method)` bank + plan, `ვადა: N თვე`, `SP.orderSchedule(o)`).
  - `დარჩენილი გადასახდელი` when `SP.orderDue(o).deferred` or `.total > 0`, with rows from `SP.partDue`. Info buttons may use `UI.infoBtn('weight', null, o.id)`.
  - Total due + `ᲒᲐᲓᲐᲮᲓᲐ` → `SP.go('/pay?order=' + o.id)`.
  - Back goes to `/orders`.
- After payment the detail renders the new state (`გადახდილია` rows, the next status pill). The pay screen shows the toast.
- The desktop column is 645 px under the standard header; cards are 20 px apart.

---

## 6. Verification the core ran

- `tests/e2e/core-contract.test.js` (was `tools/v2core_verify.js`): 71/71 checks at 428 and 1440, zero console errors. It covers:
  - formatting, terms and guards;
  - the orders seed, schedule, timeline and `payDeferred`;
  - the registration lifecycle (cooldown, expiry, wrong code, success), `safeNext` and ETA;
  - the success snapshot, and the privacy of the orders store;
  - `info=` explanation sheet and dialog, breakdown info buttons, the account link, components and logout.
- `tests/e2e/checkout-smoke.test.js` (was `tools/v2core_e2e.js`): landing → cart → register → delivery → payment → pay → success → orders. It runs at 428 and 1440 with the interim screens; it passes with no console errors.
- **Parity (34 cases):** see [ARCHITECTURE.md](ARCHITECTURE.md) "v2 core". Changes appear only where shared UI was added on purpose: the desktop account link on signed-in screens (+0.04) and the breakdown info buttons (m07/m15/d07/d15).

---

## v3 changes (core, v3 polish)

New or changed shared APIs. Screens keep working unchanged; the screen fixers switch to the new helpers.

### Delivery / fee / ETA: one source of truth (v2f-r3-02)

| Call | Returns / effect |
|---|---|
| `SP.confirmedDelivery(st?)` **new** | The delivery the live checkout is priced and dated with. When `st.delivery.done`, it is that confirmed choice. Before that it is the default pickup (`method:'pickup'`, fee 0, no extra ETA days). An unconfirmed draft is never used: not a courier choice made on `#/delivery` and then left, and not the courier city remembered from the previous order (`completeCheckout` keeps it with `done:false`). Returns a copy, with the recipient and address fields kept |
| `SP.checkoutSummary(st?)` **new** | `{delivery, confirmed, fee, totals, eta, etaText}` from that ONE delivery. `st` defaults to the live state; a stored order or `state.order` (anything with `deliveryFee`) uses its own snapshot (`delivery`, `deliveryFee`, `eta`). **The cart, payment, success and orders summaries should read the `მიწოდების ფასი` row (`fee > 0`), `სულ` / monthly (`totals.total` / `totals.monthly`) and `სავარაუდო მიღება` (`etaText`) from here**, so one state always shows the same numbers on every screen |
| `SP.totals(st?)` *(changed internally)* | The fee is now `SP.deliveryFee(SP.confirmedDelivery(st))` (or `st.deliveryFee` on a snapshot). The numbers are unchanged |
| `SP.eta(o?)` *(changed default)* | When `o.delivery` is not given, it uses `SP.confirmedDelivery(state)` instead of `state.delivery`, so `SP.eta()` always matches `SP.totals()`. The delivery screen passes its draft explicitly, as before |
| `SP.createOrder` *(changed)* | It snapshots `SP.confirmedDelivery(state)`, the same delivery `SP.totals` priced |

Cart: in `eta()` (and in `refreshPrices` if the ETA is refreshed there), use `UI.etaRow(SP.checkoutSummary().eta, …)`, or simply `SP.eta()`, which is already correct. The cart's fee line and total can come from `SP.checkoutSummary().fee` and `.totals`.

### Orders: unique ids, no silent overwrite (REV2R3-01 / v2f-r3-03)

| Call | Returns / effect |
|---|---|
| `SP.orders.newId(phone?)` **new** | A random 6-digit id that none of the user's orders holds. The reserved ids `548210`, `731954` and `SP.QA_ORDER_ID` (`123456`) are also excluded |
| `SP.createOrder(over?)` *(changed)* | Without `over.id`, it uses `SP.orders.newId`. Every created order gets a creation key `uid`. `over.id` (the QA receipt: `SP.QA_ORDER_ID`, `?order=`) still deliberately replaces the order holding that id |
| `SP.orders.save(o, phone?, opts?)` *(changed)* | It upserts the same order: same id and same `uid`. Orders without a `uid` (the demo orders, older builds) count as the same order as each other. If a **different** order already holds `o.id`, it is never overwritten: `o` gets a free id (`newId`), a `console.warn` is logged, and the saved order is returned (read the id from it). `opts.replace:true` deliberately replaces whatever holds the id. Only the QA paths use it |

### Shared UI

| Call | Returns / effect |
|---|---|
| `UI.setNoteError(input, noteEl, defaultText, msg)` **new** (REV2R3-08) | For a field whose orange hint note doubles as its error line (the registration phone `reg-phone` / `#reg-phone-err`, and the delivery personal ID `d-pid` with its note). `msg` replaces the note's text in place and adds `.is-error` and `aria-invalid="true"`. An empty `msg` restores `defaultText`, drops `.is-error` and removes `aria-invalid`. `noteEl` is an element or id; it defaults to `input.id + '-err'`. It returns true when something changed. **auth.js** (the `setErr` override for `reg-phone`) and **delivery.js** (`setErr('d-pid')`) should call it in place of their hand-written copies: `UI.setNoteError(input, note, NOTE, msg)` / `UI.setNoteError($('d-pid'), pidNote, PID_NOTE, msg)` |
| `UI.orderEtaLine(o, opts)` *(kept; now THE one implementation, REV2R3-03)* | The order card's arrival line: `სავარაუდო მიღება: 16–21 ოქტომბერი`, or `ჩაბარდა: 3 აგვისტო`. Each day is now glued to its month with a no-break space, the step orders.js did locally, so the output is byte-identical to orders.js `etaLine(o)`. **orders.js `card()` should call `UI.orderEtaLine(o, {cls:'ord-card__eta'})` and delete its local `etaLine`** |
| `UI.selectField({…, optional:true})` *(fixed, REV2R3-05)* | The native `required` is emitted only when `!o.optional`, as `aria-required` already was. The placeholder look of an optional select comes from `base.css` `.field__select:not([required]):has(option[value=""]:checked)`. Required selects are unchanged (`:invalid`) |
| `UI.EXPLAIN.diff1` / `.diff2` *(markup)* | They now contain `<span class="explain__nb">` runs (`white-space:nowrap`; cpR3-02). They are HTML, not plain text, and their textContent is the spec copy verbatim. Use them only as markup, as `UI.explain` does |
| Modal focus return *(fixed, v2f-r3-04)* | When nothing had focus when a modal opened (the opener was `<body>`, e.g. `?info=`), closing it focuses the screen `h1` (`tabindex=-1`) |

### Router / QA

- **`SP.back(path, {replace:true})` (REV2R3-07).** Steps back when the previous entry is `path`; otherwise it replaces the current entry with `path` (`SP.go(path, {replace:true})`), so a deep-linked entry is not stacked. Callers without `replace` behave as before.
- **Focus on entry (hardening).** The router adds `tabindex=-1` only to a non-interactive focus target (the `h1`). A `[data-autofocus]` input / select / textarea / button / link / contenteditable keeps its place in the Tab order (auth.js's `tabindex="0"` on `#reg-phone` is now redundant but harmless).
- **`?info=weight|customs|all` (v2f-r3-04).** It now opens only on a fresh history entry, like every other QA param (`qaFresh()` is read before `applyQA` stamps the entry). Browser Back or Forward onto the entry no longer reopens the dialog or locks scroll.
- **`#/pay?order=<id>` guard (v2f-r3-01).** Forward onto a paid card-form entry that was entered from the order's detail (`spPrev === '/orders/<id>'`) steps back to that detail entry (`history.back()`). It no longer replaces the entry with a second detail entry. A fresh entry or a deep link is still replaced with `/orders/<id>`.
- **`SP.api.startRegistration` (auth-v2r3-03).** When the pending registration is the QA demo seed (`pendingReg.demo`) and the same number is submitted again, it stays the demo registration (`demo:true`) with the seed's code (4821). It does not return `'exists'`. Any other existing number is still refused.
- **Verification log `slicepay.verifySent` (REV2R3-02).** Entries are pruned on every read, and the key is removed once it is empty. `SP.logout` runs the prune. A number sent a code less than 30 s ago survives sign-out (its cooldown must not reset). After that, no number or code lingers.

### CSS (`base.css`)

- `.explain__nb{white-space:nowrap}`.
- Mobile sheet only: `.modal--sheet.modal--explain .modal__body{margin-inline:-8px;padding-inline:8px}`. The scrollable body and its divider span x 8–312 at 320, the same as the focus tint. The text stays at 16 (cpR3-03).
- The optional-select placeholder rules described above.

## v4 changes (core: `მუშავდება` status + profile editing)

Spec: [`V4_SPEC.md`](specs/V4_SPEC.md) (authoritative). The core changed `index.html`, `css/base.css`, `js/core.js` and `js/ui.js`, and
created the **placeholders** `js/screens/profile.js` and `css/screens/profile.css`. The pre-v4 copies are in
`SCRATCH/qa/v4-core/pre/`. The same rules apply as before: escape user text (`SP.esc`, or `UI.field({value})`, which
escapes), copy is verbatim from the spec, button labels come from `UI.mt(key)`, classic scripts only, no network.

### File ownership (v4)

| Engineer | Files | Work |
|---|---|---|
| **Profile** | `js/screens/profile.js`, `css/screens/profile.css` (core placeholders: **replace them entirely**) | V4_SPEC §B screen |
| **Orders** | `js/screens/orders.js`, `css/screens/orders.css` | list heading link `გასვლა` → `პროფილი`; check the 7-step timeline and the `მუშავდება` pill |
| **Delivery** | `js/screens/delivery.js` | recipient prefill through `SP.recipientPrefill()` (optional: it already works, see below) |

`index.html` now loads `css/screens/profile.css` after `orders.css`, and `js/screens/profile.js` after `orders.js`.

### A. Status `processing` / `მუშავდება` (core: done; screens need no code change)

| Item | v4 |
|---|---|
| `SP.STATUS` | `{processing:'მუშავდება', ordered:'შეკვეთილია', transit, warehouse, customs, ready, courier, delivered}`. `processing` is the first key. `SP.FIRST_STATUS = 'processing'` |
| `SP.orderSteps(o)` | **7** keys: `processing, ordered, transit, warehouse, customs, ready\|courier, delivered` |
| `SP.createOrder` | `status:'processing'`, `timeline:[{key:'processing', date}]` |
| Demo seeds | #548210 and #731954 get `{key:'processing', date:<order date>}` before `ordered`. Everything else is unchanged (#731954 is still in `customs` with 350₾ due) |
| `SP.orderTimeline(o)` | 7 rows. A missing `processing` date counts as done on `o.date` (unless the order is itself `processing`) |
| Old stored orders | Orders read from `slicepay:v1:orders` (`SP.orders.list/get`) and a `state.order` from an older build are normalised on read: `processing` is put in front of the timeline, dated on the order date. An unknown or missing status reads as `processing`. The old order keeps its own status (e.g. `ordered` → pill `შეკვეთილია`, timeline `processing` done + `ordered` current) |
| `SP.orderPill(o)` | Unchanged rule: `processing` is the `progress` kind (#f3efff / #5e34ec) → `UI.statusPill` shows `მუშავდება` in the in-progress style |
| `SP.payDeferred` | Unchanged: only a `customs` order advances (to `ready` / `courier`), dated today, once nothing is due or pending. The step index now accounts for the extra first step |
| `?date=` on `#/success` | Still moves `timeline[0]` (now the `processing` step) to the new order date |

Orders screen: `UI.timeline(o)` and `UI.statusPill(o)` already render the new step and pill. Check the layout with 7
steps; nothing in orders.js referenced `ordered`.

### B. Profile data model

User record (localStorage `slicepay:v1:users`, keyed by the 9-digit phone):

```js
{ salt, pass, created,          // password record (unchanged hashing)
  first, last, email }          // NEW v4: the account's own profile. Never the personal ID, never card data
```

- **Registration** (`SP.api.verify`) stores the pending registration's `first`, `last` and `email` in the new record.
  The legacy `SP.api.register(u)` stores them too.
- **Password recovery** (`SP.api.resetPassword`) keeps the profile.
- **The old PII strip in `users()` is removed** (it deleted first/last/email on every read; R2-19 is superseded by V4_SPEC §B).
- **Demo account** 555 123 456 / `slicepay1`: `SP.DEMO_PROFILE = {first:'გიორგი', last:'ბერიძე', email:'giorgi@example.com'}`.
  `SP.api.ensureDemoUser()` adds that profile to a demo record that has none (it never overwrites an edited one).
  `SP.api.resetDemoUser()` restores the full seed (password and profile), which `#/profile?demo=1` uses.
- **`SP.signIn(phone)`** sets `state.profile = {first, last}` from the account record when the session has no profile
  yet. So after a plain login, the delivery recipient prefill works (it used to be empty after a sign-out).
- New state key `phoneChange` (sessionStorage, session only): `null | {from, phone, code, sentAt, expiresAt, demo}`.
  It is cleared by sign-out, by switching accounts (`SP.signIn` with another phone), by `?demo=1` and on success.

### B. Profile APIs (`js/core.js`)

Every call needs a signed-in user; otherwise it returns `{ok:false, error:'auth'}`. Field errors come back as
ready-to-show copy.

| Call | Returns / effect |
|---|---|
| `SP.api.getProfile()` | `{phone, first, last, email}` of the signed-in account, or `null`. Names fall back to `state.profile` for an account stored by an older build |
| `SP.api.updateProfile({first, last, email})` | The register rules: names required (trimmed) → `SP.msg.required`; e-mail required → `SP.msg.required`, invalid → `SP.msg.email`. Result `{ok:false, error:'invalid', errors:{first?, last?, email?}}` or `{ok:true, profile}`. On success it saves the record and `state.profile = {first, last}`. Then show `UI.toast(SP.toastMsg.profileSaved)` (`ცვლილებები შენახულია`) |
| `SP.api.changePassword({current, next, repeat})` | `{ok:true}` or `{ok:false, error:<first code>, errors:{current?, next?, repeat?}}`.<br>• `current`: empty → `required`; wrong → `SP.msg.passCurrent` `მიმდინარე პაროლი არასწორია`.<br>• `next`: empty → `required`; < 8 → `SP.msg.password` `მინიმუმ 8 სიმბოლო`; same as the current → `SP.msg.passSame` `ახალი პაროლი ემთხვევა მიმდინარეს`.<br>• `repeat`: empty → `required`; different → `SP.msg.match` `პაროლები არ ემთხვევა`.<br>Every field is checked, so all errors show at once. On success: a new salted record (profile kept). Then clear the fields and `UI.toast(SP.toastMsg.passwordChanged)` (`პაროლი შეიცვალა`) |
| `SP.api.startPhoneChange(raw)` | `{ok:true, code, phone}` → `UI.codeToast(r.code)` and show the code step.<br>`{ok:false, error, message}`:<br>• `'required'` (`სავალდებულო ველი`)<br>• `'format'` (`SP.msg.phone` `შეიყვანეთ ნომერი ფორმატით 5XX XXX XXX`, the existing phone message the spec says to reuse)<br>• `'same'` (`SP.msg.phoneSame` `ახალი ნომერი ემთხვევა მიმდინარეს`)<br>• `'exists'` (`SP.msg.phoneTaken` `ეს ნომერი უკვე დარეგისტრირებულია`)<br>It reuses the registration machinery: the per-number send log (`slicepay.verifySent`), the 30 s cooldown (a number sent a code inside its cooldown gets the same code back) and the 5 min expiry. The QA seed for the same number keeps 4821 |
| `SP.phoneChangeCooldown()` | Seconds before a resend is allowed (0 = now). Drive the link with `UI.cooldownLink(btn, 'კოდის ხელახლა გამოგზავნა', SP.phoneChangeCooldown)` and call `.stop()` on unmount |
| `SP.api.resendPhoneChange()` | `{ok:true, code}` → `UI.codeToast`, then `cooldown.refresh()`. Or `{ok:false, error:'cooldown', left}` or `{ok:false, error:'none'}` |
| `SP.api.verifyPhoneChange(code)` | `{ok:true, phone, old}` → `UI.toast(SP.toastMsg.phoneChanged)` (`ტელეფონის ნომერი შეიცვალა`) and re-render.<br>Errors (`{ok:false, error, message}`):<br>• `'format'` → `SP.msg.code`<br>• `'wrong'` → `კოდი არასწორია`<br>• `'expired'` → `კოდს ვადა გაუვიდა, მოითხოვეთ ახალი`<br>• `'exists'` (the number was registered meanwhile) → `phoneTaken`<br>• `'none'` (no pending change: close the form)<br>**On success the account is re-keyed:** the users store (`all[new] = all[old]`, old key deleted, so the old number is free), the user's orders (`slicepay:v1:orders[new]`; the demo account's lazily seeded history is materialised first, so it moves too), remember-me (when it held the old number), and the session (`state.userPhone`, `loginPhone`). `state.phoneChange` is cleared |
| `SP.api.cancelPhoneChange()` | Drops the pending change (`გაუქმება`) |
| `SP.recipientPrefill(st?)` | `{first, last}` for the delivery recipient: the session's `state.delivery.first/last` win when non-empty (typed or confirmed in this session), else the account profile (`getProfile`, else `state.profile`) |
| `SP.msg` | New: `phoneSame`, `phoneTaken`, `passCurrent`, `passSame` |
| `SP.toastMsg` | New: `profileSaved`, `phoneChanged`, `passwordChanged` |
| `SP.DEMO_PROFILE`, `SP.QA_NEW_PHONE` (`'577123456'`) | QA constants |

### B. Route, guard and QA params

| Route | Registered by | Guard |
|---|---|---|
| `#/profile` | **Profile engineer** (`profile.js`), `screen:'profile'` | Not signed in → `#/login?next=/profile` (`SP.loginUrl('/profile')`). `SP.safeNext('/profile')` is accepted, so login returns to the profile |

Body background: `data-screen="profile"` is white below 900 px and `#f4f4f4` on desktop, like orders (base.css).

| Param | Effect (applied once per history entry, like every QA param) |
|---|---|
| `#/profile?demo=1` | The usual `demo=1` seed (demo user signed in, Nike cart, profile `გიორგი ბერიძე`), plus `SP.api.resetDemoUser()`: password `slicepay1`, profile `გიორგი` / `ბერიძე` / `giorgi@example.com`. The QA number 577 123 456 is freed (its user, orders and remember-me are removed). `state.phoneChange` is cleared |
| `&edit=phone` | Core clears `state.phoneChange`. **The screen opens the phone form when `ctx.query.edit === 'phone'` on entry.** Read it in `render`, which runs before `mount` |
| `&edit=phone&step=code` | Core seeds `state.phoneChange = {from:<user>, phone:'577123456', code:'4821', sentAt:0 (no cooldown), expiresAt:+5 min, demo:true}`. The screen shows the code step whenever `state.phoneChange` is pending for the signed-in user (also after a reload). 4821 verifies and re-keys the demo account to 577 123 456; the next `?demo=1` restores 555 123 456 |
| `&err=1` | The screen shows validation errors (the placeholder: empty name, empty password fields, the new-number required message, `კოდი არასწორია` on the code step) |

### Shared UI (`js/ui.js`, `css/base.css`)

| Item | v4 |
|---|---|
| `UI.dHead(backTo, opts)` | While signed in the header's right side shows **two links `პროფილი` · `ჩემი შეკვეთები`** in `<nav class="acct-nav" aria-label="ანგარიში">`. `ჩემი შეკვეთები` keeps its exact old place (right edge, top 22); `პროფილი` + a #666 `·` sit to its left (gap 8).<br>`opts.account`: `true`/omitted = both; `'orders'` = only `ჩემი შეკვეთები` (**use on the profile page**); `'profile'` = only `პროფილი`; `false` = none (the orders screens keep `false`) |
| `UI.accountNav(only?)`, `UI.profileLink(cls?)` | The header nav and its purple `პროფილი` link (`.acct-link.acct-link--profile`, `href="#/profile"`, `data-acct="profile"`). The orders link is now `.acct-link.acct-link--orders` with `data-acct="orders"` (the landing's light variant too). **Tests that read `.d-head .acct-link` should read `.d-head .acct-link--orders`** |
| `UI.PROFILE_LABEL` | `'პროფილი'` |
| `UI.T` / `UI.Tm` | New keys: `save` ᲨᲔᲜᲐᲮᲕᲐ, `changePassword` ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ, `logout` ᲒᲐᲡᲕᲚᲐ. The phone change reuses `sendCode` ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ and `confirm` ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ; the bar uses `back` ᲣᲙᲐᲜ |
| CSS | `.acct-nav`, `.acct-nav .acct-link{position:static}`, `.acct-nav__sep`, `.acct-link[aria-current="page"]` (black, no underline, for a "you are here" link if wanted). `body[data-screen="profile"]` backgrounds. Existing: `.card`, `.btn`, `.btn[aria-disabled="true"]` (the "disabled-look" save button), `.btn--secondary` (outline logout), `.link`, `UI.field({type:'password', eye:true})` (eye toggles are delegated) |

### What each engineer must do

**Profile (`profile.js`, `profile.css`, replace the placeholders).**
1. Use the layout from V4_SPEC §B.
   - Desktop: `UI.dHead('/', {account:'orders', backAny:true})` and the centred 645 px column like orders.
   - Mobile: a white page with `UI.mBar({label: UI.mt('back'), back:'/', any:true}, null)`.
   - Heading `პროფილი`, three `.card` sections, then the outline `ᲒᲐᲡᲕᲚᲐ` (`UI.logout()`).
2. **Personal info:**
   - Prefill from `SP.api.getProfile()`.
   - The save button `UI.mt('save')` has `aria-disabled="true"` until a value differs from the saved one (it still validates on click when forced by `err=1`).
   - Errors come from `updateProfile().errors` via `UI.setError`.
   - On success, show the toast.
3. **Phone:**
   - Show `SP.fmt.phone(profile.phone)` and the link `ნომრის შეცვლა`.
   - Form: input `ახალი ტელეფონის ნომერი` (`UI.bindPhone`), button `UI.mt('sendCode')`, link `გაუქმება`.
   - Code step: input `SMS კოდი` (numeric, maxlength 4, one-time-code), the resend link with the cooldown, button `UI.mt('confirm')` and `გაუქმება` (`cancelPhoneChange`).
   - Map the errors from the API `message`.
   - On success: toast, close the form, re-render (the shown number changes).
4. **Password:**
   - Three `UI.field({type:'password', eye:true})`: `მიმდინარე პაროლი`, `ახალი პაროლი`, `პაროლის გამეორება`.
   - Button `UI.mt('changePassword')`; errors come from `changePassword().errors`.
   - On success: clear the fields and show the toast.
5. **QA params:** `edit`, `step`, `err` as above.
6. **Keep these ids** (`tools/v4core_verify.js` uses them):
   - info: `pf-first`, `pf-last`, `pf-email`, `pf-save`
   - phone: `pf-phone-open`, `pf-phone-new`, `pf-send`, `pf-code`, `pf-resend`, `pf-confirm`, `pf-cancel`, and the current number in `.prof-phone__v`
   - password: `pw-current`, `pw-new`, `pw-repeat`, `pw-submit`
   - logout: `[data-action="logout"]`
   - Error elements are `<id>-err` (`UI.field`).
7. **Toast placement:** the base default is the mobile bottom area. Place it so it does not cover the section being edited (as orders/delivery do with `body[data-screen="profile"] #toast-root`). Clear the cooldown timer on unmount.

**Orders (`orders.js`, `orders.css`).**
1. **List heading:** replace `<button … data-action="logout">გასვლა</button>` with a link to the profile, for example `<a class="link t-body ord-top__out" href="#/profile" data-acct="profile">` + `UI.PROFILE_LABEL` + `</a>`. Logout now lives on the profile page. Don't use `UI.profileLink()` here: `.acct-link` is absolutely positioned outside `.acct-nav`.
2. Keep `UI.dHead(…, {account:false})` on the orders screens (V4_SPEC keeps the header links for the other inner screens).
3. **Status:** nothing to code. Check the detail timeline with 7 steps (`მუშავდება` first) at 320–1440, and the new-order pill `მუშავდება`.
4. **Stale tests:** `v2f_users.js` "logout link გასვლა" and `v2f_kb.js` "Tab to გასვლა" will need updating with this change.

**Delivery (`delivery.js`).** The recipient prefill already works without a change, because `SP.signIn` now fills `state.profile` from the account. To follow the spec rule exactly ("session values win, else the profile"), replace the local `prefill(st)` names with `SP.recipientPrefill(st)` (keep the local `pid` digits handling).

**Landing / other inner screens.** No change. The landing link stays `ჩემი შეკვეთები`. Every screen using `UI.dHead(back)` while signed in (delivery, cart, auth-signed-in, payment, pay, success) now shows both header links.

### v4 integration (final state)

All three screen engineers landed; the contract above is implemented as written, with these final details:

| Area | Final v4 behaviour |
|---|---|
| Profile (`profile.js`, `profile.css`) | The real `#/profile` screen replaces the core placeholders. Desktop: `UI.dHead('/', {account:'orders', backAny:true})`, #f4f4f4, the orders' centred 645 px column. Mobile: white page, bar `ᲣᲙᲐᲜ` only. Three white cards (personal info, phone, password) + the outline `ᲒᲐᲡᲕᲚᲐ` (`[data-action="logout"]`). First/last name side by side, stacked below a 300 px card. Each section is its own `<form>` (Enter submits only that section). The toast sits at the top on phones (top 12, taps pass through), and the control being edited is kept clear of it (`scroll-margin-top: 72` + `scrollIntoView({block:'nearest'})`). Phone success redraws only the phone section, so unsaved personal-info edits survive. The resend countdown stops on unmount. Ids as listed above |
| Orders (`orders.js`) | The list heading link is `<a class="link t-body ord-top__out" href="#/profile" data-acct="profile">პროფილი</a>` (same box as the old `გასვლა`). **The orders list has no logout control any more.** Pill and 7-step timeline come from `UI.statusPill` / `UI.timeline` unchanged |
| Delivery (`delivery.js`) | `prefill()` uses `SP.recipientPrefill(st)`; the personal ID is never taken from the profile |
| Core QA seed (`#/profile?demo=1`) | The `demo=1` seed no longer writes `გიორგი` / `ბერიძე` into `state.delivery` on `/profile`: the delivery form is the fresh default (not done, no names). So a profile name edit made on `#/profile?demo=1` reaches the delivery step through `SP.recipientPrefill` (before, the seeded names counted as typed in this session and hid the edit). Every other route keeps the old seed (completed pickup delivery with the demo names, so the payment / success parity stays 600₾ / 150₾). A *reload* of a `?demo=1` URL re-applies the seed (QA params are always fresh on boot), so test flows move to a clean `#/profile` entry before editing |
| Tests | Logout is tested on `#/profile` (`L.logout(p, viaOrders)` in `tests/lib/harness.js`). Header-link checks read `.d-head .acct-link--orders` / `--profile`. New suites: `tests/e2e/profile.test.js`, `tests/e2e/status.test.js` |


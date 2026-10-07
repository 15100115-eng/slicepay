# SlicePay prototype: build notes

> **Note (repo layout).** This file is the build log of the prototype, kept as written. `SCRATCH/...` paths point
> to the original build session's temporary workspace, which is not part of the repository; they are historical.
> What survived from it now lives in the repo: the maintained test suites in `tests/` (the old `tools/<name>.js`
> names are mapped in `tests/README.md`), the design frames in `tests/fixtures/frames/`, the parity baseline in
> `tests/visual/baseline-scores.json`, the specs in `docs/`, and the Figma PDF in `docs/design/source/slice-pay.pdf`.

PROJECT = the repository root. Open `index.html` directly (file://). The app has no build step, no ES modules, and makes no network calls. Fonts are self-hosted; the CDN is only a fallback.

## Architecture

| File | Role |
|---|---|
| `index.html` | Shell with `<html lang="ka">`, `#app`, `#toast-root`, `<dialog id="modal">`, the CSS links and classic `<script>` tags |
| `css/fonts.css` | `@font-face` rules. Local `assets/fonts/*.woff2` load first and the CDN URL is the fallback. Defines `--font-*` and the `.t-*` type classes. The Noto Sans Math slash and the narrow-figure faces are removed |
| `css/base.css` | `:root` tokens (DESIGN_SYSTEM §1.9), reset, focus, containers, `.only-m`/`.only-d` (900 px), desktop header and back link, `.btn` / `.btn-text` / spinner, `.m-bar`, links, toggle, breakdown (`.bd`), checkbox, `.field`, thumb and badge, ✕ button, notes, toast, modal, reduced motion |
| `css/screens/*.css` | Screen layout only (landing, cart, auth, payment, pay, success) |
| `assets/fonts/` | NSG variable (georgian, latin-ext for ₾, latin for "-"), Noto Sans latin + latin-ext (Google v42), Inter latin (v20). About 395 KB in total |
| `js/core.js` | `window.SlicePay`: state store (sessionStorage `slicepay:v1:state`), hash router with query parsing, guards and QA params, pricing, formatting (₾, Georgian dates, phone, card), validation (phone, password, e-mail, URL, Luhn, brand, expiry, CVV), mock backend (users in localStorage `slicepay:v1:users`, remember-me phone, recovery codes), order snapshot |
| `js/ui.js` | `SlicePay.ui`: inline currentColor icons, Mtavruli copy constants (`UI.T`), shared renderers (dHead, mBar, breakdown, toggle, checkbox, field, thumb), field errors, toast (pause on hover/focus, one at a time), `<dialog>` modal and terms modal, delegated back-link / eye-toggle handlers, live phone formatting |
| `js/screens/*.js` | Each file calls `SP.route(path, {screen, title, render(ctx) → html, mount(screenEl, ctx), unmount})` |
| `js/app.js` | Calls `SlicePay.start()` |

How rendering works:
- `render` returns one root element. `mount` receives that element, which is replaced on every render, so event listeners never accumulate.
- `ctx = {path, query, desk, state, entry}`. `entry` is true only on hashchange, initial load or `SP.go`. QA params are applied only then; `SP.rerender()` does not re-apply them.
- Cart and payment render different DOM for mobile and desktop (`ctx.desk`). The app re-renders when the 900 px media query flips, keeping input values and focus.
- Auth, card form and success use one DOM plus CSS media queries.

Public API: `SlicePay.reset()`, `SlicePay.getState()`, `SlicePay.totals()`, `SlicePay.go(path)`, `SlicePay.api.*`.

## Routes and guards

| Route | Screen | Guard |
|---|---|---|
| `#/` | landing | |
| `#/cart` | cart | no products → `#/` |
| `#/register`, `#/login`, `#/recover` | auth | |
| `#/recover/code` | auth | no pending recovery → `#/recover` |
| `#/payment`, `#/pay` | payment method, card form | no products → `#/`; not logged in → `#/register` |
| `#/success` | receipt | no order snapshot → `#/` |

Back navigation:
- Targets: cart → `/`, register/login → `/cart`, recover → `/login`, code → `/recover`, payment → `/cart`, pay → `/payment`.
- The app calls `history.back()` when the previous route is the target, and otherwise sets the hash.
- The card form goes to success with `location.replace`.
- "ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ" and "ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ" call `reset()`, which clears session state and replaces the hash with `#/`.

## Supported QA params (applied on route entry)

| Param | Effect |
|---|---|
| `demo=1` | Seeds the Nike demo product (500/100/250/100) and logs in the demo user (phone `555 123 456`, password `slicepay1`). On `#/recover/code` it also seeds a recovery with code `4821` and no cooldown. On `#/success` it re-creates the order snapshot |
| `weight=0\|1`, `customs=0\|1` | Deferred (checked) state of each checkbox. 1 = deferred |
| `details=0\|1` | Cart: every product's breakdown open. Payment: details box open |
| `method=bog\|tbc\|mere` | Selected payment method |
| `add=1` | Cart: inline add-product form open |
| `addTile=below` | Desktop cart: d03 layout (light tile below the product) |
| `url=<encoded>` | Landing: input value (filled state) |
| `loading=1` | Landing: frozen loading state. Implies `anim=0` unless `anim=1` is passed |
| `msg=0\|1\|2` | Landing loading frame: enter (as drawn) / show-1 / swap |
| `run=1` | With `loading=1`: run the real ticker and redirect to the cart |
| `terms=1` | Register: terms box checked (as in m08/d08) |
| `modal=terms` | Register: terms modal open |
| `remember=1` | Login: "პაროლის დამახსოვრება" checked |
| `err=1` | Landing / auth / card form: shows the validation errors |
| `processing=1` | Card form: frozen processing spinner |
| `date=YYYY-MM-DD`, `order=NNNNNN` | Success: date pill and order ID. Otherwise the app uses today's date and a random 6-digit ID, generated once per order |
| `auth=0` | Logs out the current user |
| `anim=0` | Freezes motion (carousel, spinner, transitions) |
| `toast=1` | Shows a sample toast |

## Decisions beyond the docs

1. **Fonts**:
   - Self-hosted from the exact CDN files referenced in fonts.css. Noto Sans comes from the Google Fonts v42 latin and latin-ext subsets.
   - The Noto Sans Math slash and the per-frame narrow figures were dropped, as instructed. Typed URLs are therefore about 1.7 px narrower after "//", and narrow-figure prices are about 0.5 px wider per digit.
   - All fonts were verified to load over file:// with zero external requests.
2. **First product from the landing is the Nike demo product**, so the flow always lands on the designed cart. Its store is detected from the URL. Further URLs (the add form, or the landing when the cart already has items) create mock products: the name comes from the longest slug segment, and the prices come deterministically from an FNV hash of the URL. Mock products show the store logo on #f4f4f4. Adding a URL that is already in the cart increments its quantity (badge, "Nx", price × qty).
3. **The QA case for m08 uses `#/register?terms=1` to show the checked terms box** (frame m08). The modal therefore moved to `modal=terms`. DESIGN_SYSTEM §3.23 listed `terms=1` for the modal.
4. **`loading=1` is a frozen QA state.** It does not auto-redirect, so captures are stable; use `run=1` for the live flow. The real submit runs the full 2.5 s ticker, then goes to `#/cart`.
5. **Mobile cart product row height is pinned to the thumbnail** (`grid-template-rows:65px`). The info column, at 66.6 px, otherwise made the card 1.6 px taller than drawn.
6. **Mobile cart spacer minimum is 38 px**, so the bar sits 40 px below the last checkbox box, which puts it at 720 in m07. DESIGN_SYSTEM's table said 24 but described "last box bottom + 40".
7. **Success item spacer minimum is 29 px** (31 in the docs), so the full demo title (241.96 px) does not ellipsize at 428 px.
8. **Mobile payment cards use `min-height:100px`.** The text column is 99.6 px tall.
9. **Below 400 px, bottom-bar button labels wrap to 2 lines** instead of truncating, for example "ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ" at 320.
10. **Narrow phones (< 380 px)**:
    - the landing title scales to `min(36px, 9.6vw)`;
    - the cart breakdown box drops its 64 px indent;
    - payment cards use a 64×40 logo and may wrap the title;
    - the receipt uses 20 px insets.
11. **Error copy**: login failure shows "ამ ნომრით მომხმარებელი არ არსებობს" or "ტელეფონის ნომერი ან პაროლი არასწორია" under the password field. Additional messages were added:
    - wrong recovery code: "კოდი არასწორია";
    - registering an existing phone: "ამ ნომრით მომხმარებელი უკვე არსებობს";
    - card errors: "ბარათის ნომერი არასწორია", "ვადა არასწორია ან ამოწურულია", "შეიყვანეთ CVV კოდი", and the "შეიყვანეთ …" required variants.
12. **Toasts**:
    - product added or removed (cart);
    - registration and login success;
    - SMS code ("სატესტო კოდი: NNNN", 8 s);
    - password changed (shown on the login screen).
13. **Remember-me** stores the phone in localStorage. On return, the login form is pre-filled and the box is checked.
14. **Programmatic focus**: on a route change, focus moves to the screen's `h1` (a visually hidden one on cart and payment). Elements with `tabindex="-1"` get no focus ring.
15. **d00 keeps the input at 525 and the button at 607 in every state** (DESIGN_SYSTEM #31). Its score is therefore high by design.
    - The logo and title region match: mean 1.16 against `pdf/tmp/land_d00_true_origin_3718.png`.
    - Only the input and button are offset, by 63 px.
16. **Deliberate residual differences** (expected and accepted):
    - m07/d07/m15: deferred amounts struck through, and total = payable (600, not the drawn 950);
    - m10/m11: unified 32 px form padding (drawn at 34);
    - m12–m15: method title at x 167 (drawn at 170 in cards 1–2) and no header tracking;
    - m01/d01: the QA URL is longer than the drawn string.

## Verification

- `tests/visual/capture.js` + `tests/visual/compare.py` (then named `qa_capture.js` + `qa_compare.py`) were run for all 34 cases. Output is in `SCRATCH/qa/final-1`; `console_errors.json` is `{}`.
- Every route was captured at 320, 375, 768, 1024 and 1920 px, full page (`SCRATCH/qa/w-2`, script `tools/widths.js`). There is no horizontal overflow at any width. The only flags are the 1 px `.sr-only` clip boxes, which are not visible.
- `tools/e2e.js` passed at 428 and 1440 with zero JS errors. It covers:
  - landing validation → loading → cart;
  - adding a product from a URL, the checkbox totals and the details toggle;
  - removing a product;
  - register validation, the terms modal and auto-formatting;
  - payment method selection and the details toggle;
  - card validation (empty, Luhn, past expiry), Amex and Visa grouping, brand dimming, processing → success;
  - back and forward from success;
  - home reset;
  - login failure and success;
  - recovery: code toast, 30 s cooldown, wrong code, reset, then login with the new password;
  - guards.
- Keyboard: Tab reaches every control in DOM order and arrow keys switch the payment radios. Focus rings are visible, including the method-card ring.

### Final score table (mean abs diff 0–255, lower is better; % of pixels with diff > 40)

| Case | Mean | >40 | Case | Mean | >40 |
|---|---|---|---|---|---|
| m00 | 1.89 | 0.88% | d00 | 22.41* | 10.03% |
| m01 | 2.84 | 1.63% | d01 | 2.59 | 1.14% |
| m02 | 1.52 | 0.73% | d02 | 0.81 | 0.21% |
| m03 | 1.44 | 1.04% | d04 | 0.36 | 0.23% |
| m04 | 1.50 | 1.09% | d05 | 0.36 | 0.24% |
| m05 | 1.44 | 1.04% | d07 | 0.57 | 0.46% |
| m06 | 1.65 | 1.16% | d08 | 0.76 | 0.77% |
| m07 | 4.97 | 3.47% | d09 | 0.66 | 0.55% |
| m08 | 2.42 | 2.00% | d10 | 0.16 | 0.18% |
| m09 | 1.84 | 1.32% | d11 | 0.32 | 0.42% |
| m10 | 1.38 | 1.17% | d12 | 0.47 | 0.32% |
| m11 | 2.53 | 2.26% | d13 | 0.47 | 0.32% |
| m12 | 3.74 | 1.79% | d14 | 0.47 | 0.32% |
| m13 | 3.54 | 1.80% | d15 | 0.60 | 0.38% |
| m14 | 3.36 | 1.80% | d16 | 0.39 | 0.23% |
| m15 | 4.36 | 2.18% | d17 | 0.65 | 0.51% |
| m16 | 1.70 | 0.90% | | | |
| m17 | 3.17 | 2.11% | | | |

\* d00: deliberate hybrid (decision 15). The logo and title region scores 1.16.

The extra state d03 (`#/cart?demo=1&addTile=below`), compared by hand with `frames/d03`, scores 0.35.

## Round 1 fixes (core)

The core fixer changed index.html (no change needed), `css/base.css`, `css/fonts.css`, `js/core.js` and `js/ui.js`, plus the coordinated screen-file edits listed below. Each finding was reproduced before it was fixed, using the reviewer scripts `tools/r1rev_*.js`, `qa_edge.js`, `qa_nav.js` and `qa_modal.js`. The new checks are in `tools/r1core_verify.js`, which passed 27/27 with zero console or page errors. Its output is in `SCRATCH/qa/r1-core-verify/`.

### Router and re-render model (R1-01, F01, L3)
- `handle()` calls `unmount()` only on a route entry (hashchange, `SP.go`, initial load). A plain `SP.rerender()` keeps the screen's pending timers.
- The 900 px media-query flip re-renders only routes that declare `responsive: true`, which are `/cart` and `/payment` (their DOM depends on `ctx.desk`). Landing, auth, card form and success are single-DOM plus CSS. Crossing the breakpoint therefore no longer drops the landing ticker, a card payment, a cart add, or visible validation errors.
- `pay.js` keeps a module-level `processing` flag. A re-render during the 1.2 s payment re-applies the busy state.
- `auth.js` `mountCode` clears any previous countdown before it starts a new one.

### Modal (auth-r1-01, F05, R1-02, R1-03, R1-04, auth-r1-02, auth-r1-05)
- Any route entry closes an open `<dialog>` through `UI._closeModal` and restores `<html>` overflow.
- `UI.modal` closes an already-open modal first, so the "previous overflow" it captures is never its own lock. `_closeModal` clears itself when it is used.
- The scrim test is now geometric: only clicks outside the dialog's box close it. Clicks in its padding or flex gaps do not.
- The terms `onOk` callbacks return early when `#reg-terms` is missing.
- `.modal{max-width:none}` gives 16 px gutters (396 at 428, 288 at 320).
- `.modal > .btn`, `.modal__title` and `.modal__close` are `flex:none`, so only `.modal__body` shrinks and scrolls. At 320×568 the title wraps to its natural 2 lines, which is not squashing.
- `.modal__body:focus-visible` shows the focus ring.

### QA params and guards (F03, F04, F14, R1-20, R1-22)
- QA params that change state are applied once per history entry. The entry is stamped with `history.replaceState({spQA: hash})`. Back/Forward to a stamped entry skips them, while the initial load and new navigations apply them.
- The `anim` / `no-anim` class still follows the URL on every entry. Visual params read by screens (`modal`, `err`, `loading`, …) are unchanged.
- `#/success` only creates an order snapshot with `demo=1`. Without it, `?date` / `?order` only patch an existing paid order, so typing `#/success` with an unpaid cart redirects to `#/`.
- F04: the screen fixer already made `pay.js` empty the cart after `createOrder()`. Back from success therefore lands on `#/` through the no-products guard (verified at 428 and 1440).
  - The suggested `state.order` guard was not added: it would trap a user who starts a new order from the landing on `#/success`.
- `fmt.date` rejects month 13+ and day 32+. An invalid `?date=` falls back to today.

### Visual and responsive
- **Slash glyph (L9).** `assets/fonts/noto-sans-math-slash.woff2` (2.8 KB, U+002F only) is the `'SlicePay Slash'` face, placed second in `--font-input`. This supersedes decision 1's "slash dropped", and typed URLs now match the design's advance (m01/m02/d01/d02 improved).
- **Toasts:**
  - mobile auth screens use `bottom:154px`, 16 px above the checkbox row;
  - desktop uses `top:12px`, which ends at 56, under the logo top at 60;
  - the desktop cart uses `bottom:24px` with an upward slide, clear of the sticky summary;
  - `overflow-wrap:anywhere` wraps unbroken names.
- **Bar labels.** Below 400 px, `.m-bar .btn-text{padding:0 2px}` keeps "ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ" on one line at 360, 375 and 390.
- **Link underlines.** `.link` and `.back` underlines are 0.7 px thick at a 1.75 px offset.

### Accessibility
- `.btn.is-loading .btn__label` uses `opacity:0`, not `visibility:hidden`, so loading buttons keep their name (L5).
- A focused invalid field gets an extra 3 px danger ring (auth-r1-06).
- `.err:empty` and `.landing__err:empty` are no longer `display:none`, so live regions exist before their first message (R1-06).
- Deferred amounts carry sr-only text " (მოგვიანებით)" instead of an `aria-label` on a `<span>`. The quantity badge has an sr-only prefix, and the cart price span lost its `aria-label` (R1-05).
- `UI.breakdown` strikes weight and customs only when they are > 0.
- Disabled links use `--c-text-secondary` (5.7:1) (R1-09).
- Under reduced motion, the `det-in` / `det-out` animations are off (R1-11).
- The password eye keeps a constant name and toggles only `aria-pressed` (R1-14).
- `payment.js` `.pay-head` dropped its inert `aria-live`.
- `success.js` marks "order ID:" as `lang="en"`.

### Behaviour
- `UI.sepBackspace(input)`: Backspace directly after a group space deletes the digit before it. It is used by the phone fields (`UI.bindPhone`) and the card number (F12).
- `nameFromUrl` capitalises only all-lowercase words, so "Apple iPhone" stays as written (cart-r1-08).
- `SP.valid.password` trims, so whitespace-only passwords are rejected.
- `state.loginPhone` is in `defaults()`, so it survives a reload.

### Code hygiene (R1-23, R1-24)
- **Removed JS:** `SP.fmt.exp`, `SP.mt`, `SP.current`, the product `demo` flag, the toast `type` branches, and the `is-active` toggle in `pay.js`. `SP.noAnim` is kept because `cart.js` uses it.
- **Removed CSS:**
  - the classes `.t-input`, `.t-btn-lg`, `.t-link`, `.bd__anim`, `.toast--error` and `.toast--success`;
  - the custom properties `--sp-*`, `--z-modal`, `--z-overlay`, `--c-grad-start`, `--c-icon-eye`, `--c-logo-accent`, `--c-success-*`, `--d-content-top`, `--fw-semibold`, `--fw-bold`, `--m-bar-inset` and `--m-landing-x`.
- `opacity:1.5` is now `1`.
- **New tokens:** `--c-input-hover`, `--c-card-input-hover`, `--c-tint-hover`, `--c-tint-active`, `--c-primary-wash-weak`, `--c-primary-wash-strong`, `--c-hover-wash`, `--c-hover-wash-2`, `--c-state-off`, `--c-state-on`, `--ring-on-dark`, `--c-danger-strong`, `--c-danger-ring`.
- `--sh-receipt-m` is now the value `success.css` actually uses.
- No hex or `rgb()` literals remain outside `:root`; `#fff` became `--c-white` or `--c-on-primary`.
- The duplicate font stacks in `cart.css` and `success.css` are gone.

### Not changed
- **cart-r1-09:** no `#sr-live` was added to `index.html`. `cart.js` now keeps its own persistent `#cart-status`, and checkbox toggles no longer re-render.
- **F10:** the optional guard that sends logged-in users from register/login to payment was not added. It would block switching accounts, and there is no logout UI.
- **`UI.checkbox` `after` slot:** not added (optional; `auth.js` builds the terms row by hand).
- **Old test scripts:** `qa_edge.js` card rows "fail" only on the removed `.is-active` class (formatting and validity are correct). `qa_modal.js` times out because the modal it expects to remain open is now closed. `r1rev_misc` T7 throws because the terms row no longer has a wrapping `<label>`.

### Round 1 score table (`SCRATCH/qa/r1-core`, all 34 cases; console_errors.json `{}`)

| Case | Before | After | Case | Before | After |
|---|---|---|---|---|---|
| m00 | 1.89 | 1.89 | d00 | 22.41* | 22.41* |
| m01 | 2.84 | **2.43** | d01 | 2.59 | **2.50** |
| m02 | 1.52 | **1.10** | d02 | 0.81 | **0.71** |
| m03 | 1.34 | 1.34 | d04 | 0.36 | 0.35 |
| m04 | 1.39 | 1.39 | d05 | 0.36 | 0.36 |
| m05 | 1.33 | 1.33 | d07 | 0.57 | 0.57 |
| m06 | 1.54 | 1.54 | d08 | 0.73 | 0.72 |
| m07 | 4.90 | 4.90 | d09 | 0.66 | 0.65 |
| m08 | 2.24 | 2.20 | d10 | 0.16 | 0.16 |
| m09 | 1.84 | 1.81 | d11 | 0.32 | 0.31 |
| m10 | 1.38 | 1.38 | d12 | 0.31 | 0.31 |
| m11 | 2.53 | 2.51 | d13 | 0.31 | 0.31 |
| m12 | 3.15 | 3.15 | d14 | 0.31 | 0.31 |
| m13 | 2.96 | 2.96 | d15 | 0.44 | 0.43 |
| m14 | 2.79 | 2.79 | d16 | 0.39 | 0.39 |
| m15 | 3.73 | 3.73 | d17 | 0.33 | 0.33 |
| m16 | 1.71 | 1.71 | | | |
| m17 | 1.76 | 1.76 | | | |

"Before" is `qa/r1-core-base`, captured after the screen fixers' round 1 and before the core changes. No case got worse.

\* d00: deliberate hybrid (decision 15).

## Round 2 fixes (core)

The core fixer changed `index.html`, `css/base.css`, `css/fonts.css`, `js/core.js` and `js/ui.js`, plus the coordinated screen edits listed below (`cart.js/css`, `auth.js/css`, `payment.js/css`, `pay.js`, `success.js`, `landing.js/css`). Each finding was reproduced first with the reviewer scripts (`r2rev_a`, `r2rev_focus`, `r2rev_back`, `r2rev_toast`, `r2rev_flow`, `r2rev_adderr`, `r2f_sweep`); all of them now pass. New checks and the end-to-end smoke flow are in `tools/r2core_verify.js` (67/67 pass, zero console/page errors; output in `SCRATCH/qa/r2-core/smoke/`).

### Superseded statements above
- **Back navigation:** `SP.back(path)` no longer uses a single `_prevPath`. Every new history entry is stamped `history.state.spPrev` = the route it was entered from (Back/Forward keep the original stamp). In-app Back calls `history.back()` when the current entry's `spPrev` is the target, otherwise it pushes the target (R2-08). pay → ᲣᲙᲐᲜ → ᲣᲙᲐᲜ now walks back through history, and browser Back from that cart no longer lands on payment.
- **`reset()`** ("ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ", "ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ") clears cart, order and UI state but keeps the signed-in user (R2-05). `SlicePay.reset({signOut:true})` clears everything. The cart's "next" sends a signed-out user with a remembered phone to `#/login` (otherwise `#/register`).
- **`?order=`** accepts exactly 6 digits; **`?date=`** rejects impossible calendar dates (30 Feb, 31 Apr) and falls back to today (R2F-09).
- **Card expiry copy (decision 11):** "ვადა არასწორია" (malformed / month 13+) and "ვადა ამოწურულია" (past). Both fit one line in the 148 px Exp column at 320–1440; the old "ვადა არასწორია ან ამოწურულია" wrapped to 2 lines (cs-r2-04). `SP.valid.expState(v)` returns `'ok' | 'past' | 'bad'`; `SP.valid.exp` wraps it.
- **`SP.set(patch)`** only merges and saves; it never re-renders (the render path had no caller). The `{render:false}` arguments were removed from callers.
- **Account store (decision 13 / mock backend):** see Privacy below.

### Accessibility
- **Field descriptions (cart-r2-02, R2-01):** `UI.field` keeps `describedby` when `noErr` is set: `#add-url` → `add-url-err`, `#reg-phone` → `reg-phone-err` (the AX description now equals the visible note or error).
- **Required state (R2-14):** `UI.field` adds `aria-required="true"` unless `o.optional`. Added by hand to `#reg-terms`, `#cc-num`, `#cc-exp`, `#cc-cvv` and the landing `#url`.
- **Persistent visible label (R2-13):** `UI.field` renders a real `<label class="field__label">` after the input. While the field is empty it is visually hidden and the placeholder shows the label (as designed, so no QA frame changes). Once the field has a value, the label floats onto the top border (12/16, `--c-text-secondary`; primary when focused, danger when invalid). Its background is a half-white gradient, so it also sits cleanly on the #f4f4f4 page and the lavender add tile.
- **Mkhedruli accessible names (L-5 follow-up):** `UI.Tm` holds the Mkhedruli twin of every `UI.T` label, and `UI.mt(key)` renders `<span aria-hidden="true">MTAVRULI</span><span class="sr-only">mkhedruli</span>`. Used for every Mtavruli button and heading in cart, auth, payment, card form, success and the modal OK button. The landing keeps its own local markup. The old `aria` option of `UI.mBar` is gone (the restart button's name now comes from the twin).
- **One live region for toasts (R2-15):** `#toast-root` is `role="status" aria-live="polite"`; injected `.toast` elements no longer carry `role="status"`.
- **Focus across the 900 px re-render (R2-03):** `SP.rerender` restores focus by id, else by a stable attribute (`data-action`, `data-back`, `data-toggle`, `data-remove`, `data-terms`, `data-add-cancel`) on the first visible match, else on the screen `h1`. Chrome blurs a control as soon as the breakpoint hides it (focus fix-up), so a capture-phase `focusout` listener remembers a control that lost focus because it became hidden. Desktop back link ↔ mobile ᲣᲙᲐᲜ, and desktop ↔ mobile ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ now keep focus; the cart restart button (no desktop twin) lands on the `h1`.
- **Re-render keeps validation state (R2-10, general):** `snapshotValues`/`restoreValues` also restore `aria-invalid` and the `-err` text after re-dispatching `input`.
- **Contrast (R2-12, partial):** the design colours stay the default. Under `@media (prefers-contrast:more)` the text tokens switch to 4.5:1 values: `--c-warn-text` #a65a00 (new token, used by `.auth__note`), `--c-placeholder` #767676 (new token, field placeholders), `--c-placeholder-landing`, `--c-gray-400`, `--c-text-receipt` #767676, `--c-text-muted` #6b6b6b, `--c-text-note` #666. Changing the defaults needs design sign-off and would move every QA frame.
- **Forced colours:** a checked `.check__box` keeps a `Highlight` fill with its white tick.

### Behaviour
- **Toast timers (R2-06):** the toast stays while it is hovered OR focused. `arm()` clears the previous timer, `pause()` is a no-op when nothing is armed (no double subtraction), and `resume()` arms only when neither hover nor focus remains.
- **Modal without `showModal` (R2-07):** `onOk` is never called automatically. The dialog opens as a plain fixed panel (`.modal--fallback`: centred, spread-shadow scrim, Escape closes); only the OK button consents. Route entries close it via `hasAttribute('open')`.
- **No native form submits (R2-11):** a capture-phase `submit` listener in `ui.js` calls `preventDefault()` for any form inside `#app`; screen handlers still run.
- **Resend cooldown colour (auth-r2-04):** `.link[aria-disabled="true"]` uses `--c-text-muted` (#878787), as spec §4.4 says. This replaces round 1's `--c-text-secondary`. Inactive controls are exempt from 1.4.3, and `prefers-contrast:more` raises it to #6b6b6b.
- **Back-link underline at 1x (cart-r2-06):** new token `--c-back-underline`, set to `rgb(94 52 236/.65)` under `@media (max-resolution:1.49dppx)`. The 1 px line at y=41 is now #9277ef instead of #5e34ec, close to the design's two-row #cbc1f1/#b7a7f0. 2x screens keep the full colour; hover uses `currentColor`.

### Privacy (R2-19)
- The account store keeps only `{salt, pass, created}` per phone. First/last name and e-mail are validated by the form but never persisted, and `users()` strips them from entries written by older builds.
- Passwords use a per-user random salt (`crypto.getRandomValues`) and 2000 rounds of FNV-1a. This is still demo-grade and is documented in `core.js`: it keeps plain passwords out of storage and is not real credential security. Old unsalted hashes still verify, and a reset or register rewrites the record in the new format.
- The store stays in localStorage, so remember-me and registered demo accounts survive a browser restart. Card data is never stored.

### Code hygiene (R2-17, R2-18, pay-r2-05)
- **Removed:**
  - `UI.METHODS[].alt`;
  - `UI.mBar`'s `cls`, `right.type`, `right.id` and `right.form` (and `left.aria`);
  - `pay.js`'s `processing` flag and its unreachable `!ctx.entry` re-apply branch;
  - the `btn.disabled = true` that ran right before `SP.go` in `auth.js`;
  - the duplicate length check in `passRule`.
- **Font weights:** `--fw-regular`, `--fw-semibold` and `--fw-bold` are now used by every `.t-*` rule in `fonts.css`.
- **Radii:** `.back`, `.toggle` → `var(--r-4)`; `.link` → `var(--r-2)`; `.cart-add-head` → `calc(var(--r-8) - 1px)`; its focus ring and `.method__logo` → `var(--r-8)`.
- **Landing ticker timing:**
  - new tokens `--t-ticker-in` (250 ms), `--t-ticker-swap` (400 ms) and `--t-ticker-out` (200 ms), used by `landing.css`;
  - `landing.js` keeps the step start times in one `STEP` object and schedules the redirect at `STEP.exit + --t-ticker-out`, read from CSS (still 2.5 s; verified).
- **Keyframes:** `@keyframes det-in` was deleted from `cart.css`. Nothing used it: the cart animates with WAAPI, and `payment.css` has its own `pay-bd-in` / `pay-bd-out`. The stale comments are fixed, and the reduced-motion selector is now `.pay-bd.is-entering,.pay-bd.is-leaving`.

### Old test scripts
`r1core_verify.js` reports 4 stale failures:
- L5 expects the landing button's name in Mtavruli, but the screen fixer gave it the Mkhedruli `aria-label` "შემოწმება".
- cart-r1-04 counts the client rects of the whole `.btn-text`, which now include the 1 px sr-only twin.

Measuring only the visible `aria-hidden` span (`tools/r2core_lines.js`) shows every Mtavruli label on one line at 360/375/390, and at 320 on recover, payment and success. Cart restart at 320 wraps to 2 lines as before (decision 9).

### Round 2 score table (`SCRATCH/qa/r2-core`, all 34 cases; console_errors.json `{}`)

"Before" is `qa/r2-core-base`, captured after the screen fixers' round 2 and before these core changes. No case got worse.

| Case | Before | After | Case | Before | After |
|---|---|---|---|---|---|
| m00 | 1.26 | 1.26 | d00 | 22.27* | 22.27* |
| m01 | 1.81 | 1.81 | d01 | 2.50 | 2.50 |
| m02 | 1.10 | 1.10 | d02 | 0.71 | 0.71 |
| m03 | 1.34 | 1.34 | d04 | 0.35 | 0.35 |
| m04 | 1.39 | 1.39 | d05 | 0.36 | 0.36 |
| m05 | 1.33 | 1.33 | d07 | 0.57 | **0.56** |
| m06 | 1.54 | 1.54 | d08 | 0.72 | 0.72 |
| m07 | 4.90 | 4.90 | d09 | 0.65 | 0.65 |
| m08 | 2.20 | 2.20 | d10 | 0.16 | 0.16 |
| m09 | 1.81 | 1.81 | d11 | 0.31 | 0.31 |
| m10 | 1.38 | 1.38 | d12 | 0.30 | 0.30 |
| m11 | 2.51 | 2.51 | d13 | 0.31 | **0.30** |
| m12 | 2.72 | 2.72 | d14 | 0.31 | **0.30** |
| m13 | 2.52 | 2.52 | d15 | 0.43 | 0.43 |
| m14 | 2.35 | 2.35 | d16 | 0.39 | 0.39 |
| m15 | 3.78 | 3.78 | d17 | 0.33 | 0.33 |
| m16 | 1.71 | 1.71 | | | |
| m17 | 1.76 | 1.76 | | | |

\* d00: deliberate hybrid (decision 15).

## Round 3 fixes (core)

All 14 core findings were reproduced first (`tools/r3rev_nav.js`, `r3f_nav.js`, `r3f_back_login.js`, `r3f_guard_rem.js`, `r3rev_modclick.js`, `r3rev_a11y.js`, plus the new `tools/r3core_toast2.js` and `tools/r3core_misc.js`), then fixed. Backups of the pre-round files are in `SCRATCH/r3core_bak/`.

### Navigation / history
- **R3F-01 = R3REV-01 (replace loses the history stamp):** `location.replace` clears `history.state`, so a replacement entry was stamped with the screen it replaced. `SP.go(path,{replace:true})` now saves the replaced entry's `spPrev` in `carryPrev`, and `handle()` stamps the new entry with it (falling back to `current.path`), then clears it. The unknown-route and guard redirects also clear it first. Result: payment reached through register or login has `spPrev:'/cart'`, in-app Back calls `history.back()` (history length stays 4), and browser Back from that cart goes to `#/`. `r3rev_nav.js` 9/9, `r3f_nav.js` 76/76, `r3f_back_login.js` passes at 428 and 1440.
- **R3F-04:** the guard sends signed-out `#/payment` and `#/pay` to `#/login` when a remembered phone exists, and to `#/register` otherwise. This matches the cart's next button.
- **R3REV-06:** the `[data-back]` click handler ignores modified or non-primary clicks (`button`, meta, ctrl, shift, alt), so "open in new tab" works on the desktop back link.

### QA hooks
- **L3-04:** `no-anim` is no longer set when the URL has `run=1`. `#/?url=…&loading=1&run=1` now plays the real ticker: the spinner animates (`sp-spin`), `.ticker__stack` transitions over 0.25 s, and the flow still ends on `#/cart`. Frozen `loading=1` states (with or without `msg=`) keep `no-anim`.
- **cs-r3-04:** `demo=1` now sets the designed defaults (`deferWeight`, `deferCustoms` and `method:'bog'`). Explicit `weight`, `customs` and `method` params still override them. In the same tab, `#/cart?demo=1&weight=1&customs=0` followed by `#/success?demo=1` shows the designed receipt again.

### Toast (cart-r3-02)
- Only a real mouse hover pauses the toast. The handlers are now `pointerenter`/`pointerleave` and ignore any `pointerType` other than `mouse`.
- A tap or click dismisses the toast unless the user is selecting text inside it, so the recover code can still be copied.
- A `gone` flag stops `resume()` from re-arming a toast that is already hiding.
- On a real tap in Chromium mobile emulation, the toast receives `pointerenter:touch, mouseenter, focusin, click`. The old code paused on both `mouseenter` and `focusin`; the toast is now dismissed.
- The old R2 checks "R2-06 hovered toast stays" and "TO1/R2-06 focused (clicked) toast stays" in `r2core_verify.js` and `r2rev_toast.js` now fail, and this is expected:
  - The click checks fail because a click now dismisses the toast by design.
  - The mobile-cart hover check could no longer pass anyway, because `cart.css` sets `.toast{pointer-events:none}` on the mobile cart.
  - `r3core_toast.js` confirms that a desktop mouse hover still pauses the toast and that leaving resumes it.

### CSS
- **cart-r3-03 (dotted leader at 1x):** under `@media (max-resolution:1.49dppx)`, `.bd__lead` uses a tiled `linear-gradient(90deg,gray-400 3.27px,transparent 0) 0 0/4.25px 100% repeat-x`.
  - d07 row y=456 now reads `186,240,183,183,183,249,183,183,183,228,198,…`, so every gap is partly light, as in the design.
  - At 2x the repeating gradient is kept. The tiled version changed the m15 pixels and scored very slightly worse (3.7845 → 3.7863), so it is limited to 1x.
- **auth-r3-01:** `.link` uses `text-decoration-color:var(--c-back-underline)`, which is 65% primary at 1x and full primary at 2x and above, the same as the desktop back link. On hover it uses `currentColor`. d08, d09 and d11 improved.
- **auth-r3-02:** `.link:focus-visible{outline-offset:0}` keeps the ring clear of the preceding word.
- **auth-r3-03:** `.field__input[aria-invalid="true"]:not(:placeholder-shown):focus` drops the 3 px outer halo and keeps only the inset red line, so nothing shows through the floating label. Empty invalid fields keep the halo.
- **R3REV-03:** the floating label of an invalid field uses `--c-danger-strong` (#b3261e). The add tile (#f3efff) and the desktop auth page (#f4f4f4) now reach 4.5:1 or better.

### Markup / a11y
- **R3REV-05:** `UI.mBar` renders `<nav class="m-bar" aria-label="ნავიგაცია">`. The cart, payment and pay bars are now in a landmark (`r3rev_a11y.js` "controls outside landmarks" passes). The bar height is unchanged at 60 px, and all captures are pixel-identical.

### Code hygiene (R3REV-08 and screen-fixer requests)
- Removed `SP.valid.exp`, which had no caller (pay.js uses `expState`), and the `SP.hashStr` export. The private `hashStr` stays.
- `UI.dHead(backTo)` no longer takes the unused `opts`.
- `SP.parseHash` stays, because `cart.js` uses it now.
- New `SP.cssMs(name, fallback)` reads a CSS time token in ms or s. `landing.js` uses it in place of its private `cssMs`, and `cart.js` uses it in place of its inline parser in `animateDetails`.
- `SP.msg.cvvBad = 'CVV არასწორია'` was added.
- `SP.msg.cvv` was shortened to `'შეიყვანეთ CVV'`. `r3fixpay_cvvempty.js` shows it on one 16 px line at 320, 360, 375, 390, 428 and 1440.

### Known stale checks (not regressions)
- `r3f_flow.js` "luhn / past / short cvv errors" expects 'შეიყვანეთ 3-ნიშნა CVV'. pay.js has shown `SP.msg.cvvBad` since the round 3 pay fixes.
- `r3rev_a11y.js` "#/: no Mtavruli in AX tree" is a landing-screen item. It already failed before this round.

### Smoke test
`tools/r3core_e2e.js` runs at 428×735 and 1440×1024: landing (type URL, Enter) → cart → next → register → submit → payment (`history.state.spPrev` is '/cart') → next → pay (4242…, 12/30, 123) → success. Every step passes, and `qa/r3-core/e2e_console_errors.json` is `{"428":[],"1440":[]}`.

### Round 3 score table (`SCRATCH/qa/r3-core`, all 34 cases; console_errors.json `{}`)

"Before" is `qa/r3-core-base`, captured after the screen fixers' round 3 and before these core changes. No case got worse at 4-decimal precision. The changed cases are d07 (0.5624 → 0.5597), d08 (0.7210 → 0.7128), d09 (0.6473 → 0.6409), d11 (0.3085 → 0.3032) and d15 (0.4290 → 0.4275). Every other case is pixel-identical.

| Case | Before | After | Case | Before | After |
|---|---|---|---|---|---|
| m00 | 1.26 | 1.26 | d00 | 22.27* | 22.27* |
| m01 | 1.81 | 1.81 | d01 | 2.50 | 2.50 |
| m02 | 1.10 | 1.10 | d02 | 0.71 | 0.71 |
| m03 | 1.34 | 1.34 | d04 | 0.35 | 0.35 |
| m04 | 1.39 | 1.39 | d05 | 0.36 | 0.36 |
| m05 | 1.33 | 1.33 | d07 | 0.56 | 0.56 |
| m06 | 1.54 | 1.54 | d08 | 0.72 | **0.71** |
| m07 | 4.90 | 4.90 | d09 | 0.65 | **0.64** |
| m08 | 2.20 | 2.20 | d10 | 0.16 | 0.16 |
| m09 | 1.81 | 1.81 | d11 | 0.31 | **0.30** |
| m10 | 1.38 | 1.38 | d12 | 0.30 | 0.30 |
| m11 | 2.51 | 2.51 | d13 | 0.30 | 0.30 |
| m12 | 2.72 | 2.72 | d14 | 0.30 | 0.30 |
| m13 | 2.52 | 2.52 | d15 | 0.43 | 0.43 |
| m14 | 2.35 | 2.35 | d16 | 0.39 | 0.39 |
| m15 | 3.78 | 3.78 | d17 | 0.33 | 0.33 |
| m16 | 1.71 | 1.71 | | | |
| m17 | 1.76 | 1.76 | | | |

\* d00: deliberate hybrid (decision 15).

## v2 core (shared layer for the 7 new features)

The spec is in [`FEATURES_SPEC.md`](specs/FEATURES_SPEC.md). The **full contract for screen engineers is [`INTEGRATION.md`](INTEGRATION.md)**:
state shape, every new `SP.*` / `UI.*` function, CSS classes, QA params, file ownership and per-screen
tasks.

- Backup of the v1 files: `SCRATCH/backup-v1`.
- Pre-v2-core copies of the core files: `SCRATCH/v2core_bak/`.

### Files

- **`index.html`:** now also loads `css/screens/delivery.css` and `css/screens/orders.css`, and `js/screens/delivery.js` and `js/screens/orders.js` (after success).
- **`js/screens/delivery.js` and `js/screens/orders.js`:** PLACEHOLDERS that let the flow run. The delivery placeholder marks the delivery done and goes to payment. The orders placeholder shows a bare list and a timeline. The delivery and orders engineers replace both.
- **CSS placeholders:** the new CSS files only contain a header comment.
- **`/register/verify`:** registered by `auth.js` (E1). Until then the route is unknown and falls back to `#/`.

### Architecture additions (`js/core.js`)

- **State:** `term` (4), `delivery {done, method, branchId, city, address, note, first, last, pid}`, `profile {first,last}` and `pendingReg {…, rec, code, sentAt, expiresAt, next, demo}`.
  - `SP.reset()` keeps the signed-in user, the profile and the delivery details, but sets `delivery.done = false`.
  - The personal ID stays in sessionStorage only.
- **Pricing:**
  - `SP.totals` adds `subtotal`, `delivery` (fee, counted once `delivery.done`, or from `order.deliveryFee`), `term`, and `monthly = ceil(total/term)`.
  - Terms: `SP.TERMS` / `termsFor` / `nearestTerm` / `setMethod` / `setTerm`.
  - `product.weightKg`: the demo is 4; mock products are `weight/25`. `SP.TARIFF_PER_KG = 25`.
- **Delivery:** `SP.BRANCHES`, `SP.CITIES`, `SP.deliveryFee` (pickup 0; courier 5 in Tbilisi, 10 elsewhere), `SP.deliveryLabel`, `SP.etaDays` / `SP.eta` / `SP.etaText`, and `SP.fmt.range` ('16–21 ოქტომბერი', '28 ოქტომბერი – 3 ნოემბერი').
- **Registration:**
  - `SP.api.startRegistration` stores a pending registration; the password is kept only as the salted hash record.
  - `SP.api.resendVerify` enforces the 30 s cooldown (`SP.verifyCooldown()`).
  - `SP.api.verify` checks the format, the 5 min expiry and the code, then creates the account and signs in.
  - `SP.signIn` and `SP.logout`.
  - `SP.afterLoginTarget(query)` returns the safe `next`, else `/delivery` (cart has products), else `/orders`.
  - `SP.safeNext` and `SP.loginUrl`.
- **Orders:** localStorage `slicepay:v1:orders` = `{phone: [order]}`, with the personal ID masked and no card data.
  - `SP.orders.list/get/save/remove/seedDemo/clear`. The demo user is seeded lazily on first access.
  - Status model `SP.STATUS` / `orderSteps` / `orderTimeline` / `orderPill`.
  - Deferred bookkeeping `SP.partDue` / `orderDue` / `payDeferred`. Prepaid parts with a higher actual amount owe the difference, as the explanation copy promises.
  - `SP.orderSchedule`.
  - `SP.createOrder` builds the full order (term, monthly, total incl. fee, deliveryFee, delivery snapshot, eta, status, timeline, deferred) and stores it.
  - `SP.completeCheckout` = createOrder plus the per-order reset (the card form should use it).
- **Router:**
  - Parameterised routes (`'/orders/:id'` → `ctx.params`), function titles, `ctx.route`.
  - `guard(path, query, params)` with the new guards (FEATURES_SPEC "Routes").
  - `SP.back(path, {any:true})`.
  - Focus keys gained `data-explain`, `data-order` and `data-acct`. The value snapshot covers `select` and `textarea`.
  - `?info=` opens the explanation after mount on cart and payment.

### Shared UI (`js/ui.js`, `css/base.css`)

- **New Mtavruli keys:** `UI.T/Tm`: `confirm` ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ, `myOrders` ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ, `newOrder` ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ, `delivery` ᲛᲘᲬᲝᲓᲔᲑᲐ. `UI.toMt` and `UI.mtx` handle any string.
- **New icons:** info, check, user, truck.
- **`UI.dHead(backTo, {account, backAny})`:** adds the purple top-right account link `ჩემი შეკვეთები` while signed in (`.acct-link`). `UI.accountLink('light')` is the landing variant.
- **`UI.breakdown`:**
  - Info buttons on the weight and customs rows, placed **between the leader and the label** so labels keep their designed alignment. The first try put them after the label, which pushed the right-aligned cart labels 20 px left (m07 5.29); the final placement scores m07 4.96.
  - A `მიწოდების ფასი` row when `t.delivery > 0`.
- **`UI.explain`:**
  - Desktop: the existing dialog. Mobile: a bottom sheet.
  - `UI.modal` gained `sheet`, `cls` and `onOpen`. The sheet has a handle, slides up and closes on drag-down beyond 80 px, backdrop, Esc, ✕ or the button.
  - Copy is in `UI.EXPLAIN`. Clicks on `[data-explain]` are delegated; `UI.explainLink()` renders the cart link.
- **ETA:** `UI.etaLine`, `UI.etaBox`, `UI.etaText`.
- **Term chips:**
  - `UI.termChips` + `UI.bindTermChips` (native radios, arrow keys) and `UI.radioKeys` for custom radiogroups.
  - The chips use a container query: 5 chips fall back to 3 + 2 below 432 px, because "1500₾ / თვე" needs about 80 px.
- **Radio cards:** `UI.radioCards` / `UI.radioCard` / `UI.bindRadioCards` (`.rcard`).
- **Select:** `UI.selectField` (`.field--select`, custom caret). The label float is driven by `:valid` / `:invalid`, because selects never match `:placeholder-shown`.
- **Orders display:** `UI.statusPill` (`.status-pill--progress/--due/--done`) and `UI.timeline` (`.tl`).
- **Other:** `.btn--secondary` (outline), body backgrounds for `data-screen="delivery"` and `"orders"`, and `UI.logout`.
- **New tokens:** `--c-due-bg`, `--c-due` (#8a5200 under `prefers-contrast:more`), `--c-done-bg`, `--c-done`, `--r-16`, `--t-sheet`.

### QA params (v2)

- `demo=1` now also seeds:
  - term 4 and profile გიორგი ბერიძე everywhere;
  - a completed pickup delivery (ID 01001012345) except on `/delivery`, so the payment/pay/success parity stays at 600/150;
  - on `/delivery`: pickup ვაკე, empty ID;
  - on `/register/verify`: pending 555 123 456, code 4821, no cooldown, signed out;
  - on `/orders*` and `/pay?order=`: a re-seed of #548210 and #731954.
- New params: `delivery=courier|pickup`, `term=N`, `info=weight|customs|all`, `empty=1` and `order=<id>` on `/pay`.
- On success, `?date=` also recomputes the order's ETA. `?order=` renames the stored order.

### Verification

- **`tests/e2e/core-contract.test.js` (was `tools/v2core_verify.js`):** 71/71 at 428 and 1440 with zero console errors. Screens are in `SCRATCH/qa/v2-core/`: `explain_m.png` (bottom sheet), `explain_d.png`, `components_*.png` and `components2_m.png`.
- **`tests/e2e/checkout-smoke.test.js` (was `tools/v2core_e2e.js`):** landing → cart → register → (guard) delivery → payment → pay → success → order stored → `#/orders`. It passes at 428 and 1440 with no console errors. It uses the v1 auth.js; once E1 lands it fills `#verify-code` automatically.
- **Parity:** 34 cases (`SCRATCH/qa/v2-core`), `console_errors.json` `{}`. The baseline `qa/v2-core-base` was identical to round 3.

  | Case | Before | After | Reason |
  |---|---|---|---|
  | m07 | 4.90 | 4.96 | info buttons in the open cart breakdown |
  | m15 | 3.78 | 3.82 | info buttons in the payment details |
  | d07 | 0.56 | 0.62 | info buttons + account link |
  | d15 | 0.43 | 0.48 | info buttons + account link |
  | d04 d05 d11 d12 d13 d14 d16 d17 | 0.35 / 0.36 / 0.30 / 0.30 / 0.30 / 0.30 / 0.39 / 0.33 | +0.04 each | desktop account link "ჩემი შეკვეთები" (signed-in demo) |

  Every other case is unchanged. The screen-level additions (cart ETA line, term chips, success delivery section and buttons, landing link) will add their own deliberate diffs.
- **Expected stale old checks:**
  - `r3core_e2e.js` expects register → payment; it now lands on `#/delivery` (guard).
  - Old tests that read `SP.totals().monthly` as `total/4` still pass while the term is 4.

## v2 integration (all 7 features merged)

All six screen engineers' work is merged. The core requests are applied, and the full flow passes end to end. Backups of the files this round changed are in `SCRATCH/v2int_bak/` (`ui.js`, `delivery.js`).

### Routes and guards (v2, final)

| Route | Screen | Guard |
|---|---|---|
| `#/` | landing (top-right `ჩემი შეკვეთები` when signed in / `შესვლა` → `#/login?next=/orders`) | |
| `#/cart` | cart (+ ETA line, `როგორ ითვლება დაახლოებითი თანხები?`, `N თვეში`) | no products → `#/` |
| `#/register`, `#/login`, `#/recover`, `#/recover/code` | auth (`?next=` kept across login ↔ register ↔ recover) | code: no recovery → `#/recover` |
| `#/register/verify` | auth: phone verification | no `pendingReg` → `#/register` |
| `#/delivery` | delivery: recipient, personal ID, method, ETA box | no products → `#/`; signed out → `#/login` (remembered) / `#/register` |
| `#/payment` | payment + term chips | as delivery, plus `delivery.done`, else `#/delivery` |
| `#/pay` | card form, checkout mode | as payment |
| `#/pay?order=<id>` | card form, order mode (pays deferred amounts) | signed out → `#/login?next=/pay?order=<id>`; unknown → `#/orders`; nothing due → `#/orders/<id>` |
| `#/success` | receipt (+ delivery section, term, fee row, `ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ`) | no order → `#/` |
| `#/orders`, `#/orders/:id` | my orders list / detail | signed out → `#/login?next=<path>`; unknown id → `#/orders` |

Flow: landing → cart → (register → verify) | login → delivery → payment → pay → success → my orders.
After login: a safe `next`, else `/delivery` with a cart, else `/orders`. Back targets: verify → register,
delivery → cart, payment → delivery, pay → payment (order mode → `/orders/<id>`), orders list → previous
or `/`, order detail → `/orders`.

### QA params (v2 additions; existing ones unchanged)

| Param | Where | Effect |
|---|---|---|
| `demo=1` | everywhere | Nike demo, demo user, bog, term 4, profile გიორგი ბერიძე, a completed pickup ვაკე delivery (ID 01001012345), so parity stays 600₾ / 150₾ |
| `demo=1` | `/delivery` | delivery not done: pickup ვაკე, names prefilled, ID empty |
| `demo=1` | `/register/verify` | pending 555 123 456, code 4821, no cooldown, signed out |
| `demo=1` | `/orders*`, `/pay?order=` | re-seeds #548210 (delivered) and #731954 (customs, 350₾ due) |
| `delivery=courier\|pickup` | any | delivery method (a completed courier demo = თბილისი, fee 5₾ → 605₾) |
| `term=N` | any | the nearest available term for the method |
| `info=weight\|customs\|all` | cart, payment | opens the explanation (sheet < 900 px, dialog ≥ 900 px) |
| `empty=1` | `/orders` | empty state |
| `order=<id>` | `/pay` | order-payment mode |
| `err=1` | delivery, verify | validation errors; verify also takes `err=wrong\|expired` |

### Core requests applied (shared `js/ui.js`)

- `UI.field` takes `o.placeholder`: a hint shown instead of the label while the field is empty. The label still floats once the field is filled.
- `UI.selectField` takes `o.autocomplete`.
- `UI.radioCards` takes `o.labelledby`, which renders `aria-labelledby` in place of `aria-label`.
- `delivery.js` now uses all three. The string replaces on the rendered HTML are gone: the address hint is `ქუჩა, სახლის ნომერი`, the city select is `address-level2`, and the method group is named by its visible `მიწოდების მეთოდი` heading.
- The rendered output is pixel-identical to before. `v2dlv_flow.js` passes 99/99.

### Decisions accepted at integration (from the screen reports)

1. **Mobile payment (m12–m15):**
   - The term chips sit between the method cards and the notes, as the spec requires.
   - The `.m-bar` stays in flow (DESIGN_SYSTEM §3.17: "In flow, not fixed"), so at 428×735 the page now scrolls and the bar sits below the fold.
   - Scores are about 9.5–12.4.
2. **Success (m17, d17):**
   - The required `მიწოდება` receipt section adds about 125 px, so the summary and buttons move down.
   - Everything above the new section matches the design exactly as before.
3. **Desktop cart (d04, d05, d07):**
   - The explain link sits under the checkboxes (spec), so the button moves down 20 px.
   - The ETA line is centred under the button.
   - All differences are inside the summary card.
4. **Mobile cart (m03–m07):**
   - The link and ETA rows sit under the checkboxes, and the bar stays at 645 (m03–m06).
   - In m07 (details open) the bar is pushed out of the viewport.
5. **Desktop payment:**
   - The chips sit under the method cards, in the 645 px column.
   - The monthly amount sits at the left of the toggle row.
   - The ETA line sits above the button, which moves down about 25 px.
6. **Verify:**
   - `ნომრის შეცვლა` uses `SP.back('/register')`.
   - The 5 min expiry is checked when the code is confirmed; there is no live expiry timer.
7. **Orders:**
   - Instalments are not marked as paid, because the bank owns that state.
   - On desktop, `ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ` appears only in the empty state.
   - The list pill shows the status name in due colours, together with the orange `გადასახდელია: N₾` badge.
8. **Delivery screen:**
   - The fee is shown only in the courier card sub-line (`თბილისში 5₾ · რეგიონებში 10₾`).
   - The amount joins the payment breakdown as `მიწოდების ფასი`.
   - Once the step is done, the cart total also includes the fee.
   - *(v2 round 2 note)* The cart shows the courier fee inside `სულ` and in the monthly amount, with a `მიწოდების ფასი N₾` line under the total once `delivery.done` and the fee is above 0. This supersedes cp-05 (v2f-r2-07).
9. **Re-login:**
   - Names are not persisted (privacy), so after a sign-out and sign-in the delivery form starts with empty names.
   - Within a session the recipient, address and ID are kept for the next order (`delivery.done` resets after each checkout).

### Verification (integration)

- **`tests/e2e/checkout-journey.test.js` (was `tools/v2_e2e.js`)** (new): 215/215 checks at 428×735@2x and 1440×1024, with zero console errors and zero non-file requests. Output is in `SCRATCH/qa/v2-int-e2e/`. The run covers:
  - **Landing:** the signed-out link.
  - **Cart:**
    - the totals 600 → 700 → 600 when the weight checkbox is toggled;
    - the explanation as a sheet or dialog, closed with ᲒᲐᲡᲐᲒᲔᲑᲘᲐ and with Esc;
    - the product info button with `4 კგ × 25₾ = 100₾`.
  - **Register:** empty and invalid errors, then a valid submit.
  - **Verify:**
    - the toast code, with no account and no plain password stored yet;
    - the empty and wrong-code errors, then the correct code;
    - the account is created and signed in, with the toast.
  - **Delivery:**
    - prefill and defaults;
    - the ID error, then digit cleaning and the 11-digit clamp;
    - the courier city and address errors, with focus on the city;
    - the ETA moves +1 day for courier Tbilisi;
    - the hint, autocomplete and labelledby;
    - escaping.
  - **Payment:**
    - 605 / fee 5 / 152 at term 4;
    - the chip sets for bog, tbc and mere, and keeping the term across methods;
    - term 6 → 101 (also on the chip);
    - the 6-row breakdown fits;
    - the ETA line;
    - back to delivery keeps the values.
  - **Pay → success:**
    - term 6, 101, fee 5, 605;
    - the courier line and ETA, escaped;
    - the cart emptied.
  - **Orders store:** the ID is only masked and there is no card data.
  - **My orders:**
    - the new order's card and detail (masked ID, 6 instalments);
    - the demo orders, opening #731954 and paying 350₾ via `#/pay?order`;
    - back on the detail with `გადახდილია`, the pill `მზადაა გასატანად` and the toast;
    - browser Back does not reopen the card form.
  - **Logout and login:**
    - logout, then landing `შესვლა` → `#/login?next=/orders`;
    - a wrong password, then login → `#/orders`.
  - **Second order:**
    - an ebay ETA window;
    - the signed-in cart goes straight to delivery;
    - the desktop header `ჩემი შეკვეთები` link and Back;
    - pickup Batumi gives fee 0 and term 4.
  - **Guards:**
    - 9 direct URLs in a fresh session, and `#/pay?order` signed out;
    - payment and pay without delivery;
    - an unknown order, and an order with nothing due;
    - `afterLoginTarget`.
- **`tests/e2e/qa-urls.test.js` (was `tools/v2int_qaurls.js`)** (new): all 14 v2 QA URLs at 320, 428, 1440 and 1920 show the expected copy with no horizontal overflow and no console errors (`SCRATCH/qa/v2-int-urls/`).
- **Re-run of every engineer script after the shared change** (`SCRATCH/qa/v2-int-re/`):
  - `v2core_verify` 71/71;
  - `v2auth_flow`, `v2cart_flow`, `v2pay_flow` (54/54), `v2orders_flow` and `v2sl_flow` all pass;
  - `v2dlv_flow` 99/99.
- **Stale checks fixed:**
  - `v2dlv_flow` now reads the group name through `aria-labelledby`.
  - `v2sl_flow` reads the visible Mtavruli span (it was reading innerText, which includes the sr-only twin).
  - `v2core_e2e` now fills the ID and submits `#dlv-submit`; it passes at both widths.
- **Parity:** 34 cases in `SCRATCH/qa/v2-int-par`, with `console_errors.json` `{}`. Every case equals the screen engineer's own post-change number, so integration introduced no new diffs.

  | Case | v1 final | v2 | Where |
  |---|---|---|---|
  | m00 / m01 / m02 | 1.26 / 1.81 / 1.10 | 1.46 / 2.00 / 1.30 | landing account link |
  | m03–m06 | 1.33–1.54 | 2.22–2.43 | cart link + ETA rows |
  | m07 | 4.90 | 6.71 | + bar pushed out (details open) |
  | m08–m11, d08–d10 | — | unchanged | |
  | m12–m14 / m15 | 2.35–2.72 / 3.78 | 12.00–12.44 / 9.53 | term chips (decision 1) |
  | m16 / d16 | 1.71 / 0.39 | 1.71 / 0.43 | d16: account link |
  | m17 / d17 | 1.76 / 0.33 | 17.86 / 6.44 | receipt delivery section (decision 2) |
  | d00 / d01 / d02 | 22.27 / 2.50 / 0.71 | 22.31 / 2.54 / 0.75 | landing account link |
  | d04 / d05 / d07 | 0.35 / 0.36 / 0.56 | 2.74 / 2.74 / 2.96 | cart summary card (decision 3) |
  | d11 | 0.30 | 0.34 | account link |
  | d12–d14 / d15 | 0.30 / 0.43 | 3.53–3.61 / 3.96 | chips, monthly, ETA, button (decision 5) |

## v2 round 1 (core)

The core fixer's pass over the shared layer for the round 1 findings. Backups of every file before this pass are in `SCRATCH/v2r1core_bak/` (`js/`, `css/`, `index.html`). [`INTEGRATION.md`](INTEGRATION.md) rows marked *(v2 r1)* describe the changed APIs (its old copy is `INTEGRATION_V2.md.v2r1bak`).

### Privacy: one person's session never reaches another account (v2f-r1-01, REV2-01)

- `SP.signIn(phone)` with a phone other than the current `userPhone` (a guest included) first resets `delivery` (fresh defaults, so no names, personal ID or address, and `done=false`), `profile`, `order`, `recover` and `ui`. The cart and its per-order choices stay.
- Every successful sign-in clears `pendingReg`, so an abandoned registration of another number ends at login.
- `SP.api.verify` now signs in first and sets `profile` after, so a verified registration keeps its own names.
- The same account signing in again keeps its recipient, address and ID, as decided earlier.
- New guards: `#/login` and `#/register/verify` while signed in go to `SP.afterLoginTarget(query)`; `?demo=1` is exempt because it is the QA seed. Switching accounts now means signing out first.
- The core `#/register` guard that a screen fixer requested was **not** added. `auth.js` already handles a signed-in `#/register` itself: Back from `#/delivery` steps on back to the cart. A guard replace would leave a duplicate delivery entry in history.
- `delivery.js` `prefill()` no longer falls back to `pendingReg` names; a verified registration already set `profile`.

### Orders and checkout

- **v2f-r1-03:** `SP.payDeferred` moves a `customs` order on only when nothing is due **and** nothing is still undetermined (`SP.orderDue(o).total === 0 && !pending`).
- **v2f-r1-05:** `SP.removeProduct` emptying the cart sets `delivery.done = false`. Recipient and address are kept, as on "start over".
- **REV2-08:** `SP.orderSchedule` spreads the remainder +1₾ over the first instalments, so every row is within 1₾ of the shown monthly figure and the rows still sum to the total. Examples: 100/12 → 4 × 9 + 8 × 8; 605/4 → 152, 151, 151, 151; 600/4 → 150 × 4.
- **REV2-09:** `SP.orderPill` returns `{kind, label}`, and `label` is always the status name. `UI.statusPill(order)` has no options. `SP.DUE_LABEL` is still used for the list badge.

### Explanation sheet / modal (cp-06, cp-07, cp-08, cp-12, REV2-05)

- **cp-06:** below 900 px the sheet is `min(100%, 560px)` wide and centred at the bottom. Phones are unchanged.
- **cp-07:** in the sheet, the focus tint on `.explain__sec` is inset 8 px from the sheet edges. Text stays at x 16.
- **cp-08:** `UI.modal` toggles `.is-scrollable` on open and on resize. `.modal--explain.is-scrollable .modal__body` gets a 1 px bottom border and 12 px padding. Example sizes: on at 320×568 and 375×667, off at 428×735.
- **cp-12:** `?info=all` opens without the product line, matching the real cart link. `info=weight|customs` keeps the line.
- **REV2-05:**
  - While a sheet-capable modal is open, a breakpoint flip toggles `modal--sheet` in place. The handle is added if missing. Dragging works only in the sheet variant.
  - On close, focus returns to the opener. If a re-render replaced the opener, focus goes to its visible twin in `#app` (matched by id, else by `data-explain` / `data-product` / `data-order` / `data-action` / `data-terms` / `data-back`). Otherwise it goes to the screen's h1.

### Accessibility / contrast (cp-11, op-02, REV2-02, REV2-03)

- **cp-11:** each breakdown info button keeps the spec name `როგორ ითვლება?` and gets `aria-describedby` pointing to its row label. Ids are unique per render (`bdl<N>-weight`). `.bd .info-btn:focus-visible` has `outline-offset:-3px`.
- **op-02 / REV2-03:** `--c-due` is now `#9a5c00` (4.95:1 on `#fff4e5`). The `prefers-contrast:more` value stays `#8a5200`. This applies to the pill and the `გადასახდელია` badge.
- **REV2-03, new text moved to `--c-text-secondary` #666:**
  - timeline future labels (base; the orders.css override is removed);
  - order card `+N`;
  - order detail product note and quantity.
- **REV2-03, kept:** `.pay-mo__l` (`N თვეში` in the payment summary) stays `--c-text-muted`, because it reproduces the designed cart summary label. `.ord-part__est` was already #666.
- **REV2-02:** `UI.timeline(o, {labelledby})` adds an sr-only state to each step (`, შესრულებულია` / `, მიმდინარე ეტაპი` / `, მოსალოდნელი`). The orders detail passes `labelledby:'os-tl'`.

### Toast placement (DLV-R1-06, op-03)

- **DLV-R1-06:** the suggested `bottom:24px` was tried and rejected. Once the user scrolls down, the toast covers the delivery bar's `ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ` and intercepts its click (`v2_e2e.js` timed out on `#dlv-submit` behind the verify toast).
  - The mobile delivery toast now uses the cart's pattern: `top:12px`, entering from −8 px, over the non-interactive heading `მიწოდება`.
  - It has `pointer-events:none`, so taps reach whatever it covers after a scroll.
- **op-03:** the landing screen fixer already fixed this in `landing.css`: in portrait the toast sits between the title and the input. The core adds nothing. Verified with no overlap with the input, button or account link at 428×735, 375×667 and 320×640.

### Chips (cp-09)

- The tbc 5-chip fallback (container < 432) uses a 6-column grid. Every chip spans 2 columns and the 4th starts at column 2, so the bottom pair is centred and the same width as the top row.

### Shared helpers that replace duplicated screen code (REV2-10, REV2-11)

- **Core:**
  - `SP.withNext(path, next)`: `SP.loginUrl` is built on it, and `auth.js` uses it in place of its own `withNext`.
  - `SP.orderArrival(o)`: the ETA, or `ჩაბარდა: <day month>`.
  - `SP.itemNotes(p, o)`: the deferral notes.
- **UI:**
  - `UI.etaLine(eta, {value})`: takes a preformatted value.
  - `UI.orderEtaLine(o, opts)`.
  - `UI.cooldownLink(btn, base, leftFn)` → `{refresh, stop}`.
- **Screens now using these:**
  - `orders.js`: card arrival line, detail arrival row and product notes.
  - `success.js`: ETA line and product notes.
  - `auth.js`: both resend countdowns. The `stopTimers` unmount calls `cooldown.stop()`.
- **Not merged:** the success and orders item rows and delivery blocks keep their own markup, because their layouts differ by design. Only the data (notes, arrival, `SP.deliveryLabel`) is shared.
- **REV2-11:**
  - `fonts.css` already has `--fw-*`. `base.css :root` adds `--fs-note/--lh-note`, `--fs-body/--lh-body`, `--fs-body-16/--lh-body-16` and `--r-12`.
  - The v2 components in base (eta, terms, rcard, status pill with `--r-12`, timeline, explain, toast `b`, modal title), `orders.css`, `payment.css`, `pay.css` and `delivery.css` now use the tokens instead of literal 600/700/400 weights and the matching size pairs.
  - Remaining literal weights are the 3 from v1 base plus `pay.css` 500, the card-form face.
- **Screen-fixer requests applied:**
  - `.eta-line__v{white-space:nowrap}` is now in base. The copies in `cart.css`, `orders.css` and `payment.css` are removed.
  - `.eta-box__note{text-wrap:pretty}` is in base. The `delivery.css` copy is removed.
  - The timeline's future-step colour is in base.

### Dead code removed (REV2-09)

- `UI.radioKeys`.
- The unused `oh-<id>` heading id in `orders.js`.
- The unreachable term fallbacks in `success.js`.
- The `orderPill` `status` field and `statusPill` `{status}` option.
- `.ord-sec--tl{padding-block}`.

### Verification (`SCRATCH/qa/v2-r1-core/`)

- **`tools/v2r1core_verify.js`** (new): 48/48 pass, zero console errors. Screens are in `verify/`. It covers:
  - every finding above, at the widths in the finding cases: 320, 375, 428, 768 and 1440;
  - account switching: the login guard, a direct `SP.signIn(other)` wipe, the same-account keep, abandoned-registration → login, and verify → prefill.
- **`tests/e2e/checkout-journey.test.js` (was `tools/v2_e2e.js`):** 217/217, console `{}` at 428 and 1440.
  - Two stale checks from other fixers' round 1 changes were updated: the delivery ID is no longer silently cut at 11 (a 12-digit paste is kept and flagged; then 11 digits), and the desktop payment monthly reads label-first.
  - The old file is `v2_e2e.js.v2r1bak`.
- **`tests/e2e/core-contract.test.js` (was `tools/v2core_verify.js`):** 71/71. It now expects the status name in the due pill, and reads the timeline label's first text node.
- **Parity:** all 34 cases in `qa/v2-r1-core/par`, `console_errors.json` `{}`.
  - Every case equals the owning screen fixer's own latest round 1 number: m07 11.41 cart; m12–m15 5.93 / 6.00 / 5.57 / 11.03 and d12–d15 1.13 / 1.20 / 1.14 / 1.27 payment; d17 6.73 success; d11 0.30 auth.
  - All other cases equal `qa/v2-int-par`, so the core changes add no diffs. The due colour, sheet width, chip grid and toast placement are outside the parity cases.

  | Case | v1 final | v2 integration | v2 r1 |
  |---|---|---|---|
  | m00 / m01 / m02 | 1.26 / 1.81 / 1.10 | 1.46 / 2.00 / 1.30 | 1.46 / 2.00 / 1.30 |
  | m03–m06 | 1.33–1.54 | 2.23–2.43 | 2.22–2.43 |
  | m07 | 4.90 | 6.71 | 11.41 (cart fixer) |
  | m08–m11 | 2.20 / 1.81 / 1.38 / 2.51 | same | same |
  | m12 / m13 / m14 / m15 | 2.72 / 2.52 / 2.35 / 3.78 | 12.44 / 12.00 / 12.08 / 9.53 | 5.93 / 6.00 / 5.57 / 11.03 (payment fixer) |
  | m16 / m17 | 1.71 / 1.76 | 1.71 / 17.86 | 1.71 / 17.86 |
  | d00 / d01 / d02 | 22.27 / 2.50 / 0.71 | 22.31 / 2.54 / 0.75 | same |
  | d04 / d05 / d07 | 0.35 / 0.36 / 0.56 | 2.74 / 2.74 / 2.96 | same |
  | d08–d10 | 0.71 / 0.64 / 0.16 | same | same |
  | d11 | 0.30 | 0.34 | 0.30 (auth fixer) |
  | d12–d15 | 0.30 / 0.30 / 0.30 / 0.43 | 3.53 / 3.61 / 3.53 / 3.96 | 1.13 / 1.20 / 1.14 / 1.27 (payment fixer) |
  | d16 / d17 | 0.39 / 0.33 | 0.43 / 6.44 | 0.43 / 6.73 (success fixer) |

### Expected stale checks in other scripts (not regressions)

- **`v2f_users.js`** "switching user WITHOUT logging out": `#/login` while signed in now redirects (by design), so `L.login` times out at `#log-phone`. The leak itself is covered by `v2r1core_verify.js`.
- **`v2auth_flow.js`** "guard -> #/register": a signed-in `#/register/verify` without a pending registration now goes straight to `#/delivery`. The final screen is the same as before; it now skips the empty register frame.
- **`v2f_defer.js`:**
  - due colour `#b26a00` → `#9a5c00`;
  - timeline text now has the sr-only state;
  - the #548210 schedule is now 125 + 124 × 5;
  - the card heading text comes from the orders fixer.
- **`v2pay_flow.js`, `v2f_misc.js`, `v2f_terms.js` (1440):** the desktop payment monthly is label-first (payment fixer).
- **`v2dlv_flow.js`, `v2f_dlv.js`:** the ID is no longer cut at 11 (delivery fixer).
- **`v2f_misc.js` ETA:** all six screens agree; the test's own expected window is computed differently.
- **`v2f_terms.js` `?term=0 → 3`:** `?term=0` maps to 4 through `nearestTerm(…, +0 || 4)`. This is unchanged core behaviour.

## v2 round 2 (core)

The core fixer's pass over the round 2 core findings and the screen fixers' requests. Backups of every file before this pass are in `SCRATCH/v2r2core_bak/` (`js/`, `css/`, `index.html`). [`INTEGRATION.md`](INTEGRATION.md) rows marked *(v2 r2)* describe the changed APIs (its old copy is `INTEGRATION_V2.md.v2r2bak`).

### History: direction-aware stale entries (v2f-r2-02) and double-click back (v2f-r2-05)

- **Entry index:**
  - Every history entry gets a monotonically increasing `spIdx` the first time the router handles it. A `SP.go(…, {replace:true})` replacement keeps the replaced entry's index.
  - The counter is in sessionStorage `slicepay.histIdx`, so entries created after a reload still sort after older ones.
  - Comparing the entry's index with the last one handled gives `SP.navDir()`: `back`, `forward`, `push`, `replace`, `load` or `same`.
- **`SP.skipEntry(target, backTarget)`:**
  - A Back traversal steps on back and a Forward traversal steps on forward. A fresh or reloaded entry is replaced with `target`.
  - On a Back with no in-app entry behind (the stale entry was the first one), it replaces with `backTarget`, so it never leaves the app.
  - If a step goes nowhere (end of the history), it falls back to the replace after 400 ms.
- **Where it is used:**
  - The router uses it for signed-in `#/login` and `#/register/verify`. It replaces the guard's unconditional `location.replace(afterLoginTarget)`.
  - `auth.js` `leaveRegister` uses it for the stale `#/register` entry. The `lastFrom` capture listener is removed.
  - `SP.authBackTarget()` (`/cart` with a cart, else `/`) is shared by the auth back links and the skip.
- **Results:**
  - (a) Landing `შესვლა` → `დარეგისტრირდი` → verify → `#/orders`: ᲣᲙᲐᲜ / `უკან დაბრუნება` → `#/`, Forward → `#/orders`, Back → `#/`.
  - (b) Cart (remembered phone) → login → register → verify → `#/delivery`: Back → `#/cart`, Forward → `#/delivery`.
  - (c) Cart → register → verify → delivery: Back → cart, Forward → delivery. The auth fixer had already fixed this case; it still passes.
- **Double click (v2f-r2-05):**
  - `SP.back` steps with an internal `traverse()`. Until the next popstate or hashchange (600 ms safety timeout), further `SP.back` and `SP.go` calls are ignored.
  - Double-clicking `ნომრის შეცვლა` lands on `#/register`, and double-clicking ᲣᲙᲐᲜ on an order detail lands on `#/orders`.

### Explanation sheet / dialog (v2f-r2-04, cp2-03)

- **v2f-r2-04:**
  - A scrim click closes only when its pointerdown also started on the scrim, more than 400 ms after `showModal`.
  - The second half of a double click or double tap on any opener now leaves the sheet open, at 428 and 1440.
  - A later scrim click still closes it. As a bonus, a drag-select from the text that ends on the scrim no longer closes it.
- **cp2-03:**
  - `.modal__body` has no hard-coded `tabindex`. `fit()` sets `tabIndex` to 0 only while `.is-scrollable`, and to -1 otherwise.
  - At 428×735, 1440×1024 and 375×667 (cart link) Tab goes title → ✕ → button. At 320×568 it goes ✕ → body → button.

### Delivery (DLV-R2-02, DLV-R2-04)

- **DLV-R2-02:**
  - The mobile delivery toast moves to `top:22px`, so it spans 22–66.
  - It now covers the heading `მიწოდება` (ink 32–64 by range rect) at 320, 375 and 428. The label `მიმღები` stays clear.
- **DLV-R2-04:**
  - `SP.etaDays` returns `{from+1, to+2}` for courier with no city. Tbilisi (+1/+1) and the regions (+2/+2) are unchanged.
  - `#/delivery?demo=1&delivery=courier` now shows the covering window. Choosing ზუგდიდი switches it to the regions window.

### Code and privacy (REV2R2-06, -07, -08, -10)

- **REV2R2-06:** the fabricated `#/success?demo=1` receipt without `?order=` uses `SP.QA_ORDER_ID` (`123456`). Three fresh entries leave one `123456` order next to the two demo orders.
- **REV2R2-07 (shared ETA row, sticky bar, term label):**
  - `UI.etaRow(eta, {cls, lineCls, id, centred})` with base `.eta-row`, `.eta-row__ico` and `.eta-row--c`. The cart and payment keep their hooks (`.cart-eta`, `#cart-eta`, `.cart-eta__line`, `.pay-eta-row`, `.pay-eta`, `#pay-eta`). Their copied icon, line and centred rules are deleted.
  - `UI.mBar(left, right, {sticky:true})` adds `.m-bar--sticky`, the screen fixer's requested base recipe. `scroll-padding-bottom` is now 110 px on both screens; payment had 106 px. The cart keeps only its add-form overrides (bar in flow, padding 0).
  - `UI.termLabel(term)` builds `N თვეში` for cart `termLabel` and for the payment `monthly()` and sync.
- **REV2R2-08 (dead code):**
  - `UI.etaText` and the `SP.deliverySnapshot` export are deleted.
  - `UI.codeToast` builds its text from `SP.toastMsg.testCode` (escaped).
  - `sendCode` calls `newCode()`.
  - Removed classes: `is-refund`, `paypage--order`, `ord-page--list`, `pay-eta-row--m` and `dlv__f--city`.
  - Kept as documented QA hooks (used by tools): `is-due`, `is-pending`, `ord-page--detail`, `ord-sec--tl`, `success__orders`, `success__home` and `receipt__dline--eta`.
- **REV2R2-10:**
  - `SP.qty(p)` returns a whole number from 1 up to 999 999, and 1 otherwise.
  - It is used by `UI.thumb`, the orders product rows and the success item rows.
  - The state loader and `SP.orders.list` also normalise quantities.
  - A stored `qty` of `<img id="pwn">` no longer reaches the DOM on the list, the detail or success.

### Screen-fixer requests applied

- `.m-bar--sticky` in base, as above.
- BUILD_NOTES decision 8 has the cart fee note (cp-05 superseded by v2f-r2-07).
- **Per-phone resend cooldown moved into `SP.api`:**
  - `startRegistration` reuses a number's code, `sentAt` and `expiresAt` inside its cooldown. `startRegistration` and `resendVerify` log sends.
  - The log stays in sessionStorage `slicepay.verifySent`, but outside the state, so a sign-out does not reset a number's cooldown, as before.
  - `auth.js` drops `sentLog`, `logSent` and `recentSent`.
- The auth toast placement rules (register below 390: `bottom:171px`; short viewports: top 12) moved from `auth.css` to base, next to the other `#toast-root` rules. The positions measured are unchanged.
- `.term-chip > input.sr-only` covering the chip is now in base. The payment-scoped copy is removed.
- `@media (forced-colors:active){.btn{border:1px solid ButtonText}}` is in base. The success copy is now redundant but harmless.

### Verification (`SCRATCH/qa/v2-r2-core/`)

- **`tools/v2r2core_verify.js`** (new): 38/38 pass, console `[]`. It covers every finding and request above at the widths in the finding cases. Screens are in `verify/`.
- **QA repro scripts:** all pass now.
  - `v2r2_histloop` 5/5 at both widths (was 3/5).
  - `v2r2_fwd`: delivery → cart → delivery.
  - `v2r2_dblinfo` 4/4 at both widths.
  - `v2r2_dblback` 3/3 at both widths.
  - `v2r2_otpnav` 21/21.
  - `v2rev_r2_i`: no injected element.
  - `v2rev_r2_b`: one `123456` receipt.
  - Also passing: `v2r2_dbl`, `v2r2_kb` and `v2r2_toasts`.
- **`tests/e2e/checkout-journey.test.js` (was `tools/v2_e2e.js`):** 217/217, console `{}` at 428 and 1440.
- **`tests/e2e/qa-urls.test.js` (was `tools/v2int_qaurls.js`):** all pass at 320, 428, 1440 and 1920 (`qa/v2-r2-core/urls`).
- **Other scripts:**
  - `v2core_verify` 71/71.
  - `v2cart_flow` 0 fails.
  - `v2auth_flow` 50/51 (the known stale "guard -> #/register").
  - `v2pay_flow` 49/54 (the known stale desktop label-first monthly).
- **Parity:** all 34 cases in `qa/v2-r2-core/par`, `console_errors.json` `{}`. Every score equals the latest full capture (`qa/v2-ordfix-r2/cap`), so this pass adds no diffs. Against v2 r1 only m17 (17.86 → 17.98) and d17 (6.73 → 6.76) moved, both from the success fixer's round 2.

### Expected stale checks (not regressions)

- **`v2r1core_verify.js` DLV-R1-06** expects the delivery toast at y 12. It is now 22 by design (DLV-R2-02).
- **`v2r1core_verify.js` REV2-10** expects `ჩაბარდა: \d+ ` with a normal space. The date now uses a no-break space (`18&nbsp;აგვისტო`), which was already the case before this pass.
- **`fixr2_reg_v2qa_auth_r2.js` "login back → landing"** expects `#/` and gets `#/?auth=0`, the previous entry. It fails the same way on the pre-pass copy (`SCRATCH/prer2core_site`), so it is not caused by this pass.

## v3 polish — core

Scope: every `core` finding in `R3_LOW.json` (auth-v2r3-03, cpR3-02, cpR3-03, REV2R3-01, REV2R3-02, REV2R3-05, REV2R3-08, v2f-r3-01, v2f-r3-03, v2f-r3-04). Also the shared parts of v2f-r3-02 (delivery / fee / ETA source of truth), REV2R3-03 (one `UI.orderEtaLine`) and REV2R3-08 (`UI.setNoteError`). Files changed: `js/core.js`, `js/ui.js`, `css/base.css`. No screen file was touched. The pre-pass copy is in `SCRATCH/qa/v3-core/pre/`. The APIs are documented in [INTEGRATION.md](INTEGRATION.md) "v3 changes".

Each finding was reproduced first with the QA scripts: `v2r3_misc` (i)/(ii), `v2r3_dbg_collide`, `v2r3_dbg_back`, `v2r3_explain` and `cpR3_sheetgeo`.

### Fixes

- **v2f-r3-02 (shared).** New `SP.confirmedDelivery(st)` is the one delivery the live checkout uses: the confirmed choice once `delivery.done`, otherwise default pickup. `SP.totals` (fee), `SP.eta()` (default delivery) and `SP.createOrder` (snapshot) all use it. New `SP.checkoutSummary(st)` returns `{delivery, confirmed, fee, totals, eta, etaText}` for the live state or a stored order.
  - The cart ETA is already correct without a cart.js change, because cart.js calls `SP.eta()`.
  - Before confirmation: the pickup window with `სულ 600₾` and no fee line.
  - After a confirmed courier Batumi order: fee 10, `სულ 610₾`, and the courier ETA. These are identical to the payment screen.
- **REV2R3-01 / v2f-r3-03.** `SP.orders.newId(phone)` returns an id unique among the user's orders. It also excludes 548210, 731954 and 123456, and only falls back to a sequential scan when `Math.random` is stubbed.
  - `createOrder` uses it and stamps a `uid`.
  - `SP.orders.save` never overwrites a different order (different `uid`). The incoming order is re-id'd, with a `console.warn`.
  - `opts.replace` is used only by the QA receipt paths (`over.id` / `?order=`).
  - Forced collision repro: #731954 (customs, 350₾ due) survives, and the new order is stored under a free id.
- **v2f-r3-01.** In the `/pay?order=` guard, a Forward onto a paid card-form entry whose `spPrev` is the detail now does `traverse(-1)` instead of a replace. Forward → detail, Back → list. Forward twice still lands on the detail, and Back again lands on the list. A fresh deep link is still replaced.
- **v2f-r3-04.** `?info=` opens only when `qaFresh()` was true before `applyQA`, so Back or Forward onto the entry no longer reopens it or locks scroll. In `returnFocus`, a `<body>` opener counts as "no opener", so focus goes to the screen `h1`. Esc on `?info=weight|customs|all` now focuses `H1`; it was `BODY`.
- **auth-v2r3-03.** In `startRegistration`, when the pending registration is the demo seed and the same number is resubmitted, it stays the demo registration and keeps code 4821. The QA walk verify → ნომრის შეცვლა → resubmit → 4821 now signs in. Other existing numbers still get `უკვე არსებობს`.
- **REV2R3-02.** `sentLog()` prunes on read and deletes the key when it is empty. `SP.logout` calls it. Sign-out inside 30 s keeps the entry, so the cooldown survives. After 31 s, `sessionStorage['slicepay.verifySent']` is `null`.
- **REV2R3-05.** `UI.selectField` emits `required` only when the field is not optional. The placeholder styling for optional selects uses `:not([required]):has(option[value=""]:checked)` twins.
- **REV2R3-08 (shared).** Added `UI.setNoteError(input, noteEl, defaultText, msg)`. auth.js and delivery.js still have their own copies; their fixers switch to it.
- **REV2R3-03 (shared).** `UI.orderEtaLine` is kept as the single implementation, and now glues each day to its month with a no-break space. Its output is byte-identical to orders.js's local `etaLine` for every card (checked). The orders fixer switches `card()` to it and deletes the local copy.
- **cpR3-02.** `UI.EXPLAIN.diff1/diff2` wrap `მეტია —` and `„ჩემი შეკვეთების“` in `.explain__nb` (nowrap). Each run sits on one line at 320/375/428/1024/1440, and no line starts with `—`. The textContent is verbatim.
- **cpR3-03.** The mobile sheet body uses `margin-inline:-8px;padding-inline:8px`. The body and divider span 8–312 at 320 (was 4–316) and 8–367 at 375, matching the tint, and the text stays at 16. The desktop dialog is unchanged (284–740 at 1024).

### Verification (`SCRATCH/qa/v3-core/`)

- **`tests/regression/v3-core.test.js` (was `tools/v3core_verify.js`)** (new): 38/38 at 428, 38/38 at 1440, and 20/20 for explain geometry and copy at 320/375/428/1024/1440. The only console output is the two deliberate `console.warn`s from the forced "different order with a taken id" save probe. Screens are in `verify/`.
- **QA repro scripts:**
  - `v2r3_misc` (i) and (ii) now pass. The remaining "double-click pay (order mode)" fail is pre-existing: the script expects the hash without `?demo=1`.
  - `v2r3_dbg_collide`: the old orders are intact and the new id is `100000`.
  - `v2r3_dbg_back`: Back does not reopen the dialog.
  - `v2r3_explain`: focus after Esc on `?info=` is `H1`. The "Tab stays inside" fail is pre-existing (native dialog focus can leave to the browser chrome) and is not a core finding.
  - `cpR3_sheetgeo`: body = tint.
  - Also passing: `v2r3_otp` 52/52 and 51/51, `v2r3_prices` 144/144 ×2, `v2r3_dlv` 59/59 ×2.
  - `v2r3_orders` 61/62 and `v2r3_nav` 33/34 + 40/40: each remaining fail is identical to the QA round-3 logs (stale script expectations).
- **`tests/e2e/checkout-journey.test.js` (was `tools/v2_e2e.js`):** 217/217, console `{}` (`e2e.log`).
- **Parity:** all 34 cases in `par/`, `console_errors.json` `{}`. Every score is identical to `qa/v2-final/scores.json` (0 diffs).
- **`tests/e2e/qa-urls.test.js` (was `tools/v2int_qaurls.js`):** ALL PASS at 320/428/1440/1920 with no errors (`urls/`).

## v3 polish — delivery

Only js/screens/delivery.js and css/screens/delivery.css changed (pre copies: qa/v3-dlv/delivery.{js,css}.pre).
- DLV-R3-03: the bar is now the shared sticky bar (`m-bar m-bar--sticky dlv__bar`), as on cart / payment, with a white box and fade on this white page (< 900). Decision: sticky over in-flow for checkout consistency; base `scroll-padding-bottom:110px` keeps focused fields clear of it (the soft-keyboard trade-off is the same one payment already accepts). To keep a focused method card from ending up half under the bar, the card's visually hidden radio now covers the whole card (`opacity:0; pointer-events:none`, so clicks still go to the label) with `scroll-margin-block:8px`.
- DLV-R3-01: < 900, heading → first card and card → its panel are 16 (were 12); card → card stays 12. The select labels now have the same clearance as the name labels under "მიმღები".
- DLV-R3-02: the ID note is 15 px under the field, like `.auth__note` (was 5). The error still replaces it in place.
- REV2R3-09: `.dlv__sec-h` uses --fs-body-16/--lh-body-16 and `.dlv__branch-addr` uses --fs-body/--lh-body. Rendering is identical. The pay.css `.paycard__due-ref` part belongs to the payment owner.
- REV2R3-08: `setErr('d-pid')` calls `UI.setNoteError(pid, pidNote, PID_NOTE, msg)`.
Page height: +18 px on phones and +10 px on desktop. At 1440×1024 every state still fits with the button visible.
Verification: tests/regression/delivery-sticky-bar.test.js passes 288/288 (sticky bar, focus clear of bar + fade, gaps and note offset, helper behaviour; 9 viewports). The before/after captures from tools/v3dlv_cap.js are in qa/v3-dlv/{pre,post}, with no console errors. v2_e2e passes 217/217. All 34 parity cases are identical to v2-final. v2int_qaurls passes everything. v2f_dlv passes 60/62; both failures are the same stale expectations as in round 3. v2qa_dlv_r3_flow is OK. v3core_verify passes with 0 failures.

## v3 polish — low-2 (remaining small items)

Files changed: `js/core.js`, `js/screens/success.js`, `css/screens/success.css`, `js/screens/orders.js`, `css/screens/orders.css`. Pre copies are in `SCRATCH/qa/v3-low2/pre/`.

- **REV2R3-02 (send log after a quick sign-out).** `sentLog()` now arms a timer for the earliest cooldown end whenever entries remain. Each read re-arms it, and `logSent` re-arms it after adding an entry. `SP.start()` also calls `sentLog()`, so a reload prunes expired entries and re-arms the timer for live ones.
  - Register → verify → sign out inside 30 s: the entry stays, so the cooldown survives. It is removed at sentAt + 30 s with no navigation needed, and it is still gone after a reload.
  - The real-time repro `v3vcore_sent_real.js` shows the entry at t+1.5 s and `null` at t+34 s and after a reload.
  - The core.js comment now describes this behaviour.
  - Test note: the old `v3vcore_r1.js` "after 30 s a re-submit sends a new entry" check passed only by accident. Its re-submit leaves the password empty, so the form never submits. `v3low2_verify.js` (sent C) re-submits the full form instead.
- **Success fee line (LSQA-R3-01 follow-up and the reconciler's spec bug).** The receipt's `ᲛᲘᲬᲝᲓᲔᲑᲐ` section now has a visible labelled line under the method line: `მიწოდების ფასი … 5 ₾`.
  - The label is in the text colour. The amount is bold 18 in the item-price column, with the same right edge and the same `fmt.moneySp` format as `600 ₾`. The sr-only label and the unlabelled `.receipt__dfee` on the courier line are gone, and the address line is plain text again.
  - Decision: the fee stays in the receipt, not in the summary (the LSQA-R3-01 decision). The visible label is the breakdown row FEATURES_SPEC asks for on success, and it explains why თვეში and სულ, which include the fee, are 5/10₾ higher.
  - To pay for the extra 26 px on desktop, only `.success--fee` changes: `.ssum__row--1` margin-top goes from 46.79 to 30, and the CTAs keep the earlier 24 px margin-top.
  - Results at 1440×1024: the courier demo CTAs sit at 950–1010. Real courier orders (Tbilisi 5₾, Batumi 10₾) are fully visible. Pickup is unchanged (948.5, d17).
  - The dead `.ssum__row--fee` and `.receipt__drow` rules were removed.
- **Orders detail toast vs the wrapped pill (320–374).** `orders.js` measures the detail heading row, max(title bottom, pill bottom), on mount, on fonts.ready and on resize. It sets `--ord-toast-top` to that value + 10 on `<body>`, and `orders.css` uses `top:var(--ord-toast-top,72px)`.
  - From 375 up the value is 72, unchanged. When `მზადაა გასატანად` wraps (320–360), the toast moves to 104–148: over the date line, clear of the pill and title.
  - The `vlow1_pill.js` repro now reports pillCovered:false at every width.
- **QA script expectations updated.** These follow the intentional success change. Pre copies are in `qa/v3-low2/pre/tools/`.
  - `v2f_prices.js` and `v2r3_prices.js` read the fee from `.receipt__fee` (`მიწოდების ფასი 5 ₾`) instead of `.ssum__row--fee`.
  - `v2_e2e.js` success fee regex: `მიწოდების ფასი 5 ?₾`.
  - Older v3 verifiers that assert the previous unlabelled design (`v3vfy1_success.js`, `v3success_verify.js`, `v3success_probe.js`) are superseded by `v3low2_verify.js`.

Verification (`SCRATCH/qa/v3-low2/`):
- `tests/regression/v3-low2.test.js` (was `tools/v3low2_verify.js`): 187/187 checks pass with no console errors (`verify.log`, screens in `verify/`). They cover:
  - sent A/B/C;
  - success pickup and courier, plus term 6, at 1440/1280/1024/900/1920 and 428/375/320;
  - real courier orders at 1440×1024;
  - the orders toast at 320–428.
- `v3recon_succfee.js`: visibleHasLabel is true at 428 and 1440.
- `v2_e2e` passes 217/217.
- `v2int_qaurls` passes everything at 320/428/1440/1920 with no errors.
- Parity: all 34 scores are identical to `v2-final` (0 diffs), and `console_errors.json` is `{}`.
- Every `v2f_*` suite has 0 fails: defer 73, dlv 128, explain 58, flip 7, kb 64, misc 30, nav 66, otp 95, prices 408, terms 90, users 58, xss 14.
- `v2r3_prices` passes 288/288 and `v2r3_dlv` 118/118. `v2r3_misc` (2) and `v2r3_orders` (2) fail exactly the same checks as `qa/v3-vfy1`; these are known stale expectations.

## v4 core

Spec: [`V4_SPEC.md`](specs/V4_SPEC.md). The full contract for the screen engineers is in [INTEGRATION.md](INTEGRATION.md), "v4 changes".
- Files changed: `index.html`, `css/base.css`, `js/core.js`, `js/ui.js`.
- New placeholders: `js/screens/profile.js` and `css/screens/profile.css`. They are minimal but working; the profile engineer replaces both.
- Pre-v4 copies of every project file are in `SCRATCH/qa/v4-core/pre/`. The pre-v4 test scripts are in `pre/tools/`.

### A. `processing` / `მუშავდება`, the first status

- **Status model.**
  - `SP.STATUS` starts with `processing: 'მუშავდება'`, and `SP.FIRST_STATUS` is `'processing'`.
  - `SP.orderSteps` returns 7 keys: `processing, ordered, transit, warehouse, customs, ready|courier, delivered`.
- **New orders.** `createOrder` creates them with `status:'processing'` and `timeline:[{processing, date}]`. The pill is the progress kind: `მუშავდება` in #f3efff / #5e34ec.
- **Demo orders.** #548210 and #731954 get a `processing` step dated on the order date, before `ordered`. Everything else is unchanged; #731954 still owes 350₾.
- **Older data.**
  - `withProcessing()` normalises stored orders on read (`cleanOrder`) and an old `state.order` at boot. It puts `processing` in front, dated on the order date, and an unknown status reads as `processing`.
  - `SP.orderTimeline` also treats a missing `processing` date as done on `o.date`.
  - An old order keeps its own status. For example, `ordered` shows the pill `შეკვეთილია`, with `processing` done and `ordered` current.
- **Unchanged logic.**
  - `payDeferred` / `advance` were index-based already; customs → ready|courier still works.
  - The `?date=` patch on success moves `timeline[0]`, which is now the `processing` step.
  - No screen file referenced `ordered`.

### B. Profile (data + APIs + route; the screen is a placeholder)

- **User record.** It is now `{salt, pass, created, first, last, email}`, never the ID or card data.
  - The `users()` PII strip from R2-19 is removed; V4_SPEC §B supersedes that decision.
  - `verify` and the legacy `register` store the profile. `resetPassword` keeps it (`withPassword`).
- **Demo account.**
  - `ensureDemoUser` adds `SP.DEMO_PROFILE` (`გიორგი` / `ბერიძე` / `giorgi@example.com`) only to a demo record that has no profile.
  - `resetDemoUser` restores the password and profile (`#/profile?demo=1`).
- **Sign-in.** `SP.signIn` sets `state.profile` from the account record when the session has none. The delivery recipient prefill therefore also works after a plain login. Before this, names were not persisted, so the prefill was empty after a sign-out.
- **APIs.**
  - `SP.api.getProfile` / `updateProfile` / `changePassword` / `startPhoneChange` / `resendPhoneChange` / `verifyPhoneChange` / `cancelPhoneChange`.
  - `SP.phoneChangeCooldown`, `SP.recipientPrefill`.
  - New `SP.msg` keys: `phoneSame`, `phoneTaken`, `passCurrent`, `passSame`. New `SP.toastMsg` keys: `profileSaved`, `phoneChanged`, `passwordChanged`.
  - The phone change reuses the registration machinery: the per-number send log (`slicepay.verifySent`) with its 30 s cooldown and same-code reuse, `newCode`, and the 5 min TTL. The pending change is `state.phoneChange` (session only). It is cleared on sign-out, on an account switch, on `?demo=1` and on success.
- **Re-key on a verified phone change** (`rekeyAccount`):
  - users store: `new = old`, and the old key is deleted, so the old number is free;
  - orders: moved to the new key, after materialising the lazily seeded demo history;
  - remember-me, when it held the old number;
  - session: `userPhone`, plus `loginPhone` and `recover` cleanup.
- **Route and guard.** `#/profile` without a sign-in goes to `#/login?next=/profile`, and login returns to it.
- **QA params.**
  - `demo=1` resets the demo account and frees the QA number 577 123 456.
  - `&edit=phone`: the screen opens the form.
  - `&edit=phone&step=code` seeds the pending change → 577 123 456, code 4821, no cooldown.
  - `&err=1`: the screen shows the errors.
- **Shared UI.**
  - `UI.dHead` shows `პროფილი` · `ჩემი შეკვეთები` (`.acct-nav`, `UI.accountNav`, `UI.profileLink`) while signed in. The orders link keeps its exact old box (right edge, top 22).
  - `opts.account`: `true` (both links), `'orders'`, `'profile'` or `false`. The orders screens keep `false`.
  - The link classes are now `.acct-link--profile` / `.acct-link--orders`, with `data-acct="profile|orders"`.
  - New Mtavruli keys: `save` ᲨᲔᲜᲐᲮᲕᲐ, `changePassword` ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ, `logout` ᲒᲐᲡᲕᲚᲐ. All 23 `UI.T` keys were checked as `toMt(UI.Tm[k])`.
  - `body[data-screen="profile"]` gets the backgrounds.
- **Left to the screen engineers** (listed in INTEGRATION):
  - the profile screen itself;
  - orders: the list heading `გასვლა` → `პროფილი`;
  - delivery: optionally switch to `SP.recipientPrefill`.

### Verification (`SCRATCH/qa/v4-core/`)

- **`tools/v4core_verify.js`** (new): 113/113 at 428 and 1440, with console `{}`. It covers:
  - the status model and the demo timelines;
  - the new-order pill and its colours;
  - a legacy order without the step;
  - `payDeferred`;
  - the profile persisted at registration;
  - update / password / phone-change errors and successes (cooldown, same-code, wrong, format, expired);
  - the re-key of users, orders, remember-me and session, and the old number freed;
  - logout, the guard, login `next`, and the session profile after login;
  - escaping;
  - the `recipientPrefill` rule and the delivery screen prefill;
  - the header links and their geometry;
  - every QA param, including 4821 re-keying the demo account and `demo=1` restoring it;
  - no overflow.
  
  The screenshots are in `verify/`.
- **Full suite**, via `tools/v4core_runall.sh`. The baseline ran against an untouched copy of the site (`SCRATCH/v4pre_site`, scripts in `tools_v4pre/`) → `base/`. The post run is in `post/`, and the re-runs after the test updates are in `post2/` (e2e) and `post3/`.
  - `v2_e2e` passes 217/217 with console `{}`.
  - `v2int_qaurls` passes everything at 320/428/1440/1920.
  - Every `v2f_*` suite has 0 fails: defer 73, dlv 128, explain 58, flip 7, kb 64, misc 30, nav 66, otp 95, prices 408, terms 90, users 58, xss 14.
- **Parity.** All 34 cases, with `console_errors.json` `{}`.
  - Every mobile case and d00–d02, d08–d11 is identical to the baseline.
  - The signed-in desktop cases with the header links change by +0.02 to +0.03 because of the new `პროფილი ·` to the left of the unchanged `ჩემი შეკვეთები` (the spec's entry point):

    | Case | Before → after |
    |---|---|
    | d04 | 2.74 → 2.76 |
    | d05 | 2.74 → 2.77 |
    | d07 | 2.96 → 2.99 |
    | d12 | 1.13 → 1.16 |
    | d13 | 1.20 → 1.22 |
    | d14 | 1.14 → 1.16 |
    | d15 | 1.27 → 1.29 |
    | d16 | 0.43 → 0.46 |
    | d17 | 6.76 → 6.79 |
- **Test expectations updated.** These follow the spec changes only; the pre copies are in `qa/v4-core/pre/tools/`.
  - `v2_e2e.js`: the new-order card shows `მუშავდება` (was `შეკვეთილია`). The header check and click use `.d-head .acct-link--orders`, since the header now has two links.
  - `v2f_defer.js`:
    - #731954 timeline: 7 steps (`მუშავდება` done first), and the sr-only states are now 4 done, current, 2 future.
    - After paying: the done/current indexes shift by +1.
    - #548210: the courier variant starts with `მუშავდება`.
    - The edge-case order builder's step list starts with `processing`.
  - `v2f_misc.js`: a new order's timeline is current + 6 todo (was + 5).
  - `v2f_prices.js`: the 12 order-card checks expect the pill `მუშავდება`.
  - `v2f_dlv.js`, `v2f_nav.js` (2 places): `.d-head .acct-link` → `.d-head .acct-link--orders`.
  - `v2f_users.js`: "users store has no names / e-mail" is now "the user record holds only its own profile (names / e-mail), no plain password, no ID", because V4_SPEC §B persists the profile.
- **Expected to go stale once the orders engineer lands** `პროფილი` in place of `გასვლა`: `v2f_users.js` "logout link გასვლა", `v2f_kb.js` "Tab to გასვლა", and the `[data-action="logout"]` clicks in `v2f_nav.js` / `v2_e2e.js` logout steps on the orders list. Logout moves to `#/profile`.

## v4 integration (profile screen, orders link, delivery prefill, tests, git)

From v4 on, this file and [INTEGRATION.md](INTEGRATION.md) are the project's only maintained docs (they were the
scratchpad's `BUILD_NOTES.md` / `INTEGRATION_V2.md`). The v4 core section above was brought over unchanged, apart from
links; `SCRATCH/...` and `tools/<name>.js` paths in it are historical.

### What landed

| Area | Files | Result |
|---|---|---|
| Profile | `js/screens/profile.js`, `css/screens/profile.css` | The real `#/profile` (V4_SPEC §B) replaces the core placeholders: personal info (save disabled-look until a trimmed value changes; register validation; toast `ცვლილებები შენახულია`), phone change (live formatting incl. `+995` paste; required / format / same / taken; SMS code step with 30 s resend cooldown, wrong / expired code; success redraws only the phone section and re-keys the account), password change (all errors at once; fields cleared and hidden again on success), outline `ᲒᲐᲡᲕᲚᲐ`. Desktop header shows only `ჩემი შეკვეთები`; mobile bar `ᲣᲙᲐᲜ` only. Toast at the top on phones, edited control kept clear of it |
| Orders | `js/screens/orders.js` | List heading link `გასვლა` → `პროფილი` (`<a class="link t-body ord-top__out" href="#/profile" data-acct="profile">`), same box; the list has no logout control. The `მუშავდება` pill and the 7-step timeline needed no orders code |
| Delivery | `js/screens/delivery.js` | Recipient names from `SP.recipientPrefill(st)` (session names win, else the account profile); the personal ID is never prefilled from the profile |
| Core | `js/core.js` | `#/profile?demo=1` no longer seeds `გიორგი` / `ბერიძე` into `state.delivery` (fresh default delivery on `/profile`), so a name edit made there reaches the delivery step. Other `demo=1` routes are unchanged (parity stays 600₾ / 150₾) |
| Comments | `js/screens/{profile,orders,delivery}.js`, `css/base.css`, `css/screens/{profile,payment}.css` | Doc references point at `docs/` instead of the scratchpad files |

### Routes and QA params added in v4

| Route / param | Effect |
|---|---|
| `#/profile` | Profile; signed out → `#/login?next=/profile` (login returns to it) |
| `#/profile?demo=1` | Demo user signed in, password `slicepay1`, profile `გიორგი` / `ბერიძე` / `giorgi@example.com`, QA number 577 123 456 freed, fresh delivery form. A reload of the URL re-applies it (QA params are always fresh on boot) |
| `&edit=phone` / `&edit=phone&step=code` | Phone form open / code step for 577 123 456 with code 4821 and no cooldown |
| `&err=1` | Validation errors visible |

### Tests (`tests/`)

The suite was ported from the pre-v4 scripts, so the v4 expectation changes were applied here:
- new orders start at `processing` / `მუშავდება` (smoke, core-contract, checkout-journey, orders-flow, price matrices r1/r3, round3 orders, v3-core);
- 7-row timelines with `მუშავდება` first (core-contract, deferred-payment, eta-escaping-misc, round3 orders);
- the header has two links: checks read `.d-head .acct-link--orders` / `--profile` (core-contract, checkout-journey, round1 delivery, navigation-guards, round3 navigation);
- logout moved to `#/profile` (`L.logout(p, viaOrders)` in `lib/harness.js`; checkout-journey, orders-flow, users-storage, navigation-guards, round1/round3 keyboard, round3 misc and orders, v3-low2). Keyboard: Tab to `პროფილი` on the list, Enter, then Tab to `ᲒᲐᲡᲕᲚᲐ`;
- the user record keeps the account's own names / e-mail (users-storage, round3 otp), and A's re-login prefills A's own names (never the ID).

New suites (discovered by `run-all.js`):
- `e2e/profile.test.js` (119 checks at 428 / 1440, fake clock): guard + login next, layout, personal info save / validation / escaping, profile edit → delivery prefill, phone change errors (required, format, same, taken), code errors (short, wrong, expired), resend cooldown, reload on the code step, re-keying (users, orders, remember-me, session), orders still visible, old number refused at login and the new one accepted, password change (required, wrong current, short, mismatch, same, eye reset, success, old password refused), logout.
- `e2e/status.test.js` (78 checks at 320 / 428 / 1440): status model, new checkout order in list + detail, demo orders' processing step, stored legacy orders without the step (`ordered`, `transit`, no status).

### Verification (`npm test` against the live app, Playwright 1.63.0)

40/40 suites green, 3,772 checks, 0 failures, `exit=0`; every suite's console / network error list is empty, and the
parity step captured 34 cases with 0 console errors. Parity is identical to the baseline except the signed-in desktop
cases d04, d05, d07, d12–d17, which move by +0.02 to +0.03 (the `პროფილი ·` header link, as measured in "v4 core").

### Git

The project is a git repository (branch `main`). `.gitignore` excludes `node_modules/`, `tests/out/`, `.DS_Store`,
`*.log` and `.claude/settings.local.json`.

# SlicePay tests

Browser tests driven by Playwright (Chromium). The app is opened straight from `file://`; nothing is served,
and the suites flag any request that is not `file:`/`data:`/`blob:`.

```bash
npm install                 # once; Playwright 1.63.0 (run `npx playwright install chromium` if the browser is missing)
npm test                    # every suite + the design-parity step, then a summary table
npm test -- orders delivery # only suites whose id contains "orders" or "delivery"
npm test -- --no-visual     # skip the parity step
npm test -- --jobs=2        # fewer parallel browsers (default 4)
npm run test:visual         # parity step only
node tests/e2e/cart-flow.test.js   # any single suite
```

Environment:

| Variable | Default | Meaning |
|---|---|---|
| `APP_DIR` | project root | Folder with the app's `index.html`. Point it at a frozen copy to test a snapshot. |
| `TEST_OUT` | `tests/out` | Screenshots, logs (`logs/<suite>.log`), `summary.json`, parity output. Gitignored. |
| `TEST_JOBS` | 4 | Parallel suites in `run-all.js`. |
| `PARITY_TOL_MEAN`, `PARITY_TOL_PCT` | 1, 1 | Allowed regression per parity case (see below). |
| `PYTHON` | `python3` | Interpreter for `compare.py` (needs Pillow: `pip3 install pillow`). |

A relative `APP_DIR` or `TEST_OUT` is resolved once, from the directory the runner starts in, and handed to every
suite as an absolute path. Under `npm test` that directory is the project root (npm runs scripts there, whatever
folder you call it from); with `node tests/run-all.js` or a single suite it is your shell's current directory.
Only `tests/out/` is gitignored, so point any other `TEST_OUT` outside the project or use an absolute path.

Every check prints one line that starts with `PASS` or `FAIL`; a suite is green when it exits 0 and printed
no `FAIL`. `run-all.js` exits 1 when any suite is red, crashed, timed out, or printed no checks at all.

## Layout

```
tests/
  run-all.js             runner + summary table
  lib/env.js             ROOT / APP_DIR / BASE (file:// URL of index.html) / outDir()
  lib/harness.js         shared Playwright helpers + UI flows (register, login, delivery, payCard …)
  e2e/                   end-to-end flows across screens
  functional/round1/     v2 functional QA, round 1 (topic suites)
  functional/round3/     v2 functional QA, round 3 (topic suites, more edge cases)
  regression/            v3 polish verifiers
  visual/                design parity: capture.js, compare.py, parity.js, shot.js, cases.json, baseline-scores.json
  fixtures/frames/       36 reference frames rendered from the Figma PDF (m = 428x735 @2x, d = 1440x1024)
```

## Design parity

`visual/parity.js` screenshots the 34 cases in `visual/cases.json` (mobile @2x, desktop @1x), and
`visual/compare.py` scores each one against its design frame: `mean` = mean absolute grey difference
(0–255) and `pct` = % of pixels that differ by more than 40. A case fails when its `mean` or `pct` is worse
than `visual/baseline-scores.json` by more than the tolerance (default 1.0 each), or when the page logged a
console error. Each run writes to its own folder, `tests/out/visual/runs/<run>/` (`PARITY_RUN` or a timestamp + pid),
so parallel runs never delete each other's shots; side-by-side images are in `<run>/shots/cmp_<id>.png` (design | app |
diff in red), and `tests/out/visual/parity.json` is a copy of the latest run's result (it names the folder). Old run
folders are pruned (the newest `PARITY_KEEP`=5 are kept, and any younger than `PARITY_KEEP_HOURS`=6).

After an intentional visual change, review the cmp images and run
`node tests/visual/parity.js --update-baseline` (all cases) or `... --update-baseline m01,d02` (only those ids;
the other cases keep their scores). The file is rewritten as valid JSON with a project-relative `source`, and the
update is refused when a captured case logged console errors.

Notes: d03 and d06 have frames but no parity case (d03 is the `addTile=below` cart layout, checked by hand);
d00's frame is 4 px off (see `docs/design/DESIGN_SYSTEM.md`), which is part of its baseline score.
The baseline was produced with Playwright 1.63.0 / Chromium 1243 on macOS; other platforms render fonts
slightly differently, so re-baseline there instead of loosening the tolerance.

## Where the suites came from

They were ported from the build session's `tools/` folder (most of its ~590 files were one-off probes and
were not kept). Absolute paths were replaced by `lib/env.js`; output goes to `tests/out/`.

| Suite | Was | Covers |
|---|---|---|
| e2e/checkout-journey | v2_e2e.js | full journey: landing → cart → register → verify → delivery → payment → pay → success → orders → deferred payment → logout/login |
| e2e/checkout-smoke | v2core_e2e.js | short smoke of the same flow |
| e2e/auth-flow | v2auth_flow.js | register, OTP, login `?next=` |
| e2e/cart-flow | v2cart_flow.js | term label, explanation, ETA |
| e2e/delivery-flow | v2dlv_flow.js | delivery form, a11y, overflow |
| e2e/payment-flow | v2pay_flow.js | term chips, method fallback, breakpoint flip |
| e2e/success-landing-flow | v2sl_flow.js | landing account link, success CTAs |
| e2e/orders-flow | v2orders_flow.js | orders list/detail, `#/pay?order=`, widths |
| e2e/core-contract | v2core_verify.js | `SlicePay` core / `SlicePay.ui` contract (docs/INTEGRATION.md) |
| e2e/qa-urls | v2int_qaurls.js | every QA URL (v2 + v4 profile) at 320/428/1440/1920: overflow, console errors, expected text |
| e2e/profile | new in v4 (same ground as the build session's v4prof_flow.js) | `#/profile`: guard + login `next`, personal info save + validation + escaping, profile edit → delivery prefill, phone change (required / format / same / taken, wrong / short / expired code, 30 s resend cooldown, reload on the code step), re-keying (users, orders, remember-me, session; old number refused at login, new one works), password change (all errors, eye reset), logout `ᲒᲐᲡᲕᲚᲐ` |
| e2e/status | new in v4 | first status `მუშავდება`: status model (7 steps), new checkout order in list + detail, demo orders' processing step, legacy stored orders without the step (320/428/1440) |
| functional/round1/* | v2f_{defer,dlv,explain,flip,kb,misc,nav,otp,prices,terms,users,xss}.js | deferred-payment, delivery, explanation, breakpoint-flip, keyboard, eta-escaping-misc, navigation-guards, otp, price-matrix, terms, users-storage, xss |
| functional/round3/* | v2r3_{cheap,dates,dlv,explain,kb,misc,nav,orders,otp,prices,terms,widths}.js | customs-free, dates-eta, delivery, explanation, keyboard, misc, navigation, orders, otp, price-matrix, terms, widths |
| regression/v3-core | v3core_verify.js | v3 core findings (R3_LOW) |
| regression/v3-low2 | v3low2_verify.js | send-log pruning, success fee line, orders toast |
| regression/delivery-sticky-bar | v3dlv_bar.js | delivery sticky bar geometry at 9 viewports |
| visual/capture.js, compare.py, shot.js | qa_capture.js, qa_compare.py, shot.js | parity pipeline |

When the app changes on purpose, update the expectations in the affected suites in the same change.

v4 (`docs/specs/V4_SPEC.md`) did this: new orders start at `processing` / `მუშავდება` (pills, 7-row timelines,
`timeline[0]` is the processing step), the signed-in desktop header shows `პროფილი` · `ჩემი შეკვეთები` (read
`.d-head .acct-link--orders` / `--profile`, not `.d-head .acct-link`), the orders list heading link is `პროფილი`
(`.ord-top__out`) and logout lives on `#/profile` (use `L.logout(p, viaOrders)` from `lib/harness.js`), and the user
record keeps the account's own names / e-mail (never the password or the personal ID).

v4 finish: the orders list header shows both account links too (`ჩემი შეკვეთები` with `aria-current="page"`), so the
heading-row `.ord-top__out` is mobile-only (`only-m`). At desktop width click the header link
`.d-head .acct-link--profile`; `L.profLinkSel(p)` returns the right selector for the page's viewport.

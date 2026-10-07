# SlicePay design system

This is the single source of truth for the builder. It merges [`spec_landing.md`](specs/spec_landing.md), [`spec_cart.md`](specs/spec_cart.md), [`spec_auth.md`](specs/spec_auth.md), [`spec_payment.md`](specs/spec_payment.md), [`spec_card_success.md`](specs/spec_card_success.md), [`spec_fonts.md`](specs/spec_fonts.md) and [`spec_icons.md`](specs/spec_icons.md). Where those specs disagree, the value here was re-measured from the PDF and wins (marked **[re-measured]**). Behaviour still follows [`BRIEF.md`](BRIEF.md).

Implementation files that already exist:
- `PROJECT/css/fonts.css` (font faces and type classes; link it first)
- `PROJECT/assets/icons/*.svg` (26 icons)
- `PROJECT/assets/img/{product-nike.jpg, bog-nawil-nawil.png, tbc-ganawileba.png, mere.png}`

PROJECT = the repository root.

---

## 0. Conventions

- All numbers are **CSS px relative to the frame's top-left** (mobile frame 428×735, desktop 1440×1024), unless marked *abs* (absolute PDF canvas).
- **"bl"** is a text baseline. **"box"** is a CSS border-box (border included). **"ink"** is the visible glyph or vector extent.
- **d00 origin.** d00 really starts at canvas y **3718**, not 3714. Its JSON y-values and `frames/d00_*.png` are 4 px too large; every d00 value in this document is already corrected. QA must compare d00 against `SCRATCH/pdf/tmp/land_d00_true_origin_3718.png`.
- **ICC rendering.** The PNG renders come out about 1 level darker than the vector colours (for example #5e34ec renders as #5d34eb, #e7e7e7 as #e6e6e6). Tokens use the vector values, so pixel-diff tolerance should be ≥ 2 per channel.
- **Placing text from a baseline.** All UI fonts (Noto Sans Georgian and Noto Sans) share ascent 1.068 em and descent 0.292 em. For a font size `s` and line-height `L`:
  **baseline = line-box top + L/2 + 0.388·s**.
  So, to land a designed baseline: line-box top = bl − L/2 − 0.388·s.
  Inter (card form only) uses **L/2 + 0.363·s**.
- **Box-sizing.** `*,*::before,*::after{box-sizing:border-box}`. Every bordered element below is given as its border-box.
- **Padding.** Paddings written "from the outer edge" include the 1 px border, so the CSS `padding` is that value − 1. Paddings written as CSS (`padding:…`) are literal.

---

## 1. Tokens

### 1.1 Colour palette (deduplicated)

Rule: values within about 3 levels of each other were merged into the one measured from vector data. The merges are listed in the right-hand column.

| Token | Value | Used for | Merged / notes |
|---|---|---|---|
| `--c-primary` | **#5e34ec** | buttons, links, back arrow, landing input border, selected card ring, date pill, success title, check stroke | |
| `--c-primary-hover` | #5129e0 | primary hover | implied; one value for all specs |
| `--c-primary-active` | #4820cc | primary active, link hover | implied |
| `--c-primary-tint` | #f3efff | selected method card fill, light add-product (open form) tile | |
| `--c-primary-wash` | rgb(94 52 236 / .08) | text-button / add-header hover background | implied |
| `--c-logo-accent` | #8a50fc | "Pay" in the colour logo | |
| `--c-grad-start` / `--c-grad-end` | #340fb0 / #16064a | landing gradient stops | |
| `--c-white` | **#ffffff** | surfaces, button labels, unselected cards, on-gradient text | merges **#fdfdfd** (button labels on cart/auth/payment, unselected mobile cards) |
| `--c-bg-page` | **#f4f4f4** | page background on every non-landing screen except mobile auth; mobile cart breakdown box | merges **#f1f1f1** (m07 breakdown box) |
| `--c-gray-150` | **#e7e7e7** | payment details box, card-form input border, brand-badge border, card-form skeleton bars | merges #e6e6e6 and #eaeaea (both raster samples) |
| `--c-border` | #d3d3d3 | card borders, cart/payment dividers | |
| `--c-divider-receipt` | #c9c9c9 | success summary divider | |
| `--c-gray-300` | #bcbcbc | light-surface placeholder, recover-code divider, `plus-circle-gray` | |
| `--c-placeholder-landing` | #ababab | landing URL placeholder only | |
| `--c-gray-400` | **#a6a6a6** | breakdown leaders, struck (deferred) values and their line-through | merges **#a3a3a3** (struck values) |
| `--c-text-receipt` | #9e9e9e | success muted text ("order ID:", "1x", "4x", notes, bank prefix) | |
| `--c-text-muted` | **#878787** | "4 თვეში", remove ✕, auth input border | merges **#848484** (auth input border) |
| `--c-text-note` | #7b7b7b | payment bullet notes, card-form labels | |
| `--c-badge` | #767676 | product count badge fill | |
| `--c-text-secondary` | #666666 | "ფასი დეტალურად", method subtitles, d03 tile label | |
| `--c-text-value` | #505050 | breakdown rows, landing typed URL, success item price | |
| `--c-text-strong` | #353535 | monthly and "სულ" amounts, toast background | |
| `--c-icon-eye` | #1e1e1e | eye / eye-off stroke | |
| `--c-text` | #000000 | headings, body, card price | |
| `--c-m3-on` | #65558f | checkbox fill, radio on (Material 3 primary; kept as designed) | |
| `--c-m3-off` | #49454f | checkbox off border, radio off | |
| `--c-caret` | #79747e | toggle caret | |
| `--c-warn` | #ff9900 | register phone note | |
| `--c-success-disc` / `--c-success-ring` | #e8d6ff / #ab98e9 | success badge | |
| `--c-danger` | #d93025 | errors on light surfaces | **new** |
| `--c-danger-on-dark` | #ffc2c2 | error text on the landing gradient | **new** |
| `--c-danger-border-on-dark` | #ff6b6b | input error border on the gradient | **new** |
| `--c-method-hover` | #bfaef7 | unselected method card hover border | **new** |
| `--c-overlay` | rgb(22 6 74 / .55) | modal scrim (gradient-end hue) | **new** |

Disabled primary (landing only): fill `rgb(94 52 236 / .5)` and label `rgb(255 255 255 / .5)`, applied **separately** (two alphas, not group opacity). Over the gradient this renders as fill ≈ #3d1da8 and label ≈ #9c8dd1.

Gradients (Figma stores the angle per frame, so switch it at the 900 px breakpoint):
- `--grad-landing-m: linear-gradient(161.68deg, #340fb0 1.95%, #16064a 99.8%)` (< 900 px)
- `--grad-landing-d: linear-gradient(172.19deg, #340fb0 1.95%, #16064a 99.8%)` (≥ 900 px)
- `html,body` on the landing get `background:#16064a` so overscroll is never white.

Store-brand and card-brand colours exist only inside the SVG assets.

### 1.2 Radii

| Token | Value | Applies to |
|---|---|---|
| `--r-8` | **8px** | every card, button, input, add tile, thumbnail, breakdown and details box, receipt top corners, toast, inline-form controls. The JSON `r_est` of 3.6/4.0 and the brief's "≈4" are wrong (3.58 is the Bézier control offset of r = 8) |
| `--r-2` | 2px | checkbox |
| `--r-4` | 4px | success date pill |
| `--r-20` | 20px | card-form card, modal (new) |
| `--r-round` | 50% | count badge, radio, success badge |

Brand badges carry their own radius (2.5) inside the SVG.

### 1.3 Borders

All borders sit **inside** the box (`box-sizing:border-box`). **[re-measured]** This applies to payment method cards and the payment summary too: [`spec_payment.md`](specs/spec_payment.md) described a 2 px centred ring with 1 px outside, but in the renders x 13.0–14.0 is page bg, 14.0–15.0 is ring colour and 15+ is fill (m12 cards 1 and 2, d12 summary, m03). So **do not add a `box-shadow` ring**.

| Token | Value | Applies to |
|---|---|---|
| `--b-card` | 1px solid #d3d3d3 | cart cards, desktop summary cards, unselected method cards |
| `--b-card-selected` | 1px solid #5e34ec | selected method card |
| `--b-landing-input` | 1px solid #5e34ec | landing URL input |
| `--b-input` | 1px solid #878787 | auth inputs, add-product form input. Figma centres this stroke ±0.5 px on the box edge; CSS puts it 1 px inside the same box (≤ 0.5 px shift; accepted) |
| `--b-card-input` | 1px solid #e7e7e7 | card-form inputs, white brand badges |
| `--b-check-off` | 2px solid #49454f | unchecked checkbox (inside an 18×18 box) |
| `--b-input-focus` | border-color #5e34ec + `box-shadow: inset 0 0 0 1px #5e34ec` | light-surface input focus (reads as 2 px, no layout shift) |
| `--b-input-error` | border-color #d93025 + `inset 0 0 0 1px #d93025` | light-surface input error |
| Dividers | 1px #d3d3d3 (cart, payment) · 1px #bcbcbc (recover code) · 1px #c9c9c9 (success) | |

### 1.4 Shadows

The design has only three shadows. The last two are new.

| Token | Value | Use |
|---|---|---|
| `--sh-card-form-m` | `0 24px 40px -8px rgb(0 0 0 / .115), 0 2px 8px rgb(0 0 0 / .04)` | m16 card |
| `--sh-card-form-d` | `0 28px 60px -2px rgb(0 0 0 / .16), 0 2px 4px rgb(0 0 0 / .05)` | d16 card |
| `--sh-receipt-m` | `0 8px 20px rgb(0 0 0 / .10)` | m17 receipt only. It is cast by a straight-edged rect that ends at the teeth mid-line (§3.19). Desktop receipt has **no** shadow |
| `--sh-toast` | `0 6px 20px rgb(0 0 0 / .18)` | toast (**new**) |
| `--sh-modal` | `0 28px 60px -2px rgb(0 0 0 / .16), 0 2px 4px rgb(0 0 0 / .05)` | modal (**new**; reuses the d16 recipe) |

Nothing else has a shadow: no cards, buttons or inputs. The hidden #000 rects in the JSON (m07 full frame, under the d03/d04 product card, d16 mask duplicates) are masks; ignore them.

### 1.5 Spacing

The design is measured, not grid-based. Use this scale for new or implied spacing. Use the **layout constants** (frame-exact) for designed geometry.

`--sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-5:20px; --sp-6:24px; --sp-7:28px; --sp-8:32px; --sp-9:36px; --sp-10:40px`

Layout constants:

| Constant | Value | Where |
|---|---|---|
| `--m-card-x` | 14px | mobile cart/payment card side margin (cards 400 wide at 428) |
| `--m-landing-x` | 22px | mobile landing gutter (input/button 384) |
| `--m-auth-pad` | 32px left / 35px right | all four mobile auth screens |
| `--m-bar-inset` | 30px | mobile bottom-bar right and bottom inset (left text-button box at 18.5) |
| `--m-card-gap` | 19px | mobile cart card gap |
| `--m-method-gap` | 20px | mobile payment card gap (pitch 120) |
| `--d-container` | 1120px | desktop container (160 margins at 1440) |
| `--d-content-top` | 209px | top of main content on cart, payment, card form, success |
| `--d-col-gap` | 20px | cart/payment column gap; cart left-column stack gap |
| `--d-method-gap` | 21px | gap between the three desktop method cards |
| `--d-form-w` | 360px | auth form, card-form card, landing button |
| `--d-receipt-w` | 550px | success column |
| `--input-gap` | 16px | auth field stack (desktop name-row gap 20) |

### 1.6 Breakpoints and containers

| Range | Layout |
|---|---|
| **< 900px** | Mobile layout, designed at 428. Content column `max-width:560px; margin-inline:auto` on every mobile screen. Backgrounds (gradient, page colour) stay full-bleed |
| < 380px | Narrow-phone adjustments: titles may wrap, the bottom-bar left label may wrap to 2 lines, payment method titles wrap |
| **≥ 900px** | Desktop layout. `.container{width:min(1120px, 100% - 80px); margin-inline:auto}`. It is exactly 1120 with 160 margins at 1440, and stays centred at 1920+ |
| 900–1179px | Desktop, but the cart and payment two-column grids **stack**: main column full width, summary card below it (`max-width:455px; justify-self:end`). The three method cards stay in one row |
| ≥ 1180px | Two-column grids as designed: cart `minmax(0,1fr) 455px`, payment `minmax(0,645fr) minmax(0,455fr)`, gap 20 |

Containers verified on the frames: cart, payment and back link span x 160–1280; auth form and card form 540–900 (360); landing input 160–1280, landing button 540–900; success column 445–995 (550).

### 1.7 Z-index

| Token | Value | Use |
|---|---|---|
| `--z-below` | -1 | receipt shadow pseudo-element (inside `isolation:isolate`) |
| `--z-raised` | 1 | store-icon slot over the input text area, spinner over the button label |
| `--z-sticky` | 10 | optional sticky desktop summary (not in the design; off by default) |
| `--z-header` | 20 | desktop back link |
| `--z-overlay` | 900 | modal scrim |
| `--z-modal` | 1000 | modal dialog |
| `--z-toast` | 1100 | toasts |

### 1.8 Motion

| Token | Value |
|---|---|
| `--t-fast` | 120ms (hover colours, card ring, badge dimming) |
| `--t-base` | 200ms (caret rotation, details expand, toast and modal enter) |
| `--ease` | `cubic-bezier(.2,0,0,1)` |
| `--ease-io` | `ease-in-out` (ticker slide, store carousel) |
| Spinner | `spin .8s linear infinite`, clockwise |

`@media (prefers-reduced-motion: reduce)`:
- no store carousel (static amazon);
- the ticker cross-fades instead of sliding;
- no expand animation;
- the spinner keeps rotating.

The QA flag `anim=0` freezes everything: carousel on amazon, spinner at 0°, ticker at the requested keyframe.

### 1.9 `:root` block (paste into `css/tokens.css`, loaded after `fonts.css`)

```css
:root{
  --c-primary:#5e34ec; --c-primary-hover:#5129e0; --c-primary-active:#4820cc;
  --c-primary-tint:#f3efff; --c-primary-wash:rgb(94 52 236/.08); --c-logo-accent:#8a50fc;
  --c-primary-disabled:rgb(94 52 236/.5); --c-on-primary:#fff; --c-on-primary-disabled:rgb(255 255 255/.5);
  --c-grad-start:#340fb0; --c-grad-end:#16064a;
  --grad-landing-m:linear-gradient(161.68deg,#340fb0 1.95%,#16064a 99.8%);
  --grad-landing-d:linear-gradient(172.19deg,#340fb0 1.95%,#16064a 99.8%);
  --c-white:#fff; --c-bg-page:#f4f4f4; --c-gray-150:#e7e7e7; --c-border:#d3d3d3;
  --c-divider-receipt:#c9c9c9; --c-gray-300:#bcbcbc; --c-placeholder-landing:#ababab;
  --c-gray-400:#a6a6a6; --c-text-receipt:#9e9e9e; --c-text-muted:#878787; --c-text-note:#7b7b7b;
  --c-badge:#767676; --c-text-secondary:#666; --c-text-value:#505050; --c-text-strong:#353535;
  --c-icon-eye:#1e1e1e; --c-text:#000;
  --c-m3-on:#65558f; --c-m3-off:#49454f; --c-caret:#79747e; --c-warn:#ff9900;
  --c-success-disc:#e8d6ff; --c-success-ring:#ab98e9;
  --c-danger:#d93025; --c-danger-on-dark:#ffc2c2; --c-danger-border-on-dark:#ff6b6b;
  --c-method-hover:#bfaef7; --c-overlay:rgb(22 6 74/.55);
  --c-focus:#5e34ec; --c-focus-on-dark:#fff;
  --r-2:2px; --r-4:4px; --r-8:8px; --r-20:20px;
  --sh-card-form-m:0 24px 40px -8px rgb(0 0 0/.115),0 2px 8px rgb(0 0 0/.04);
  --sh-card-form-d:0 28px 60px -2px rgb(0 0 0/.16),0 2px 4px rgb(0 0 0/.05);
  --sh-receipt-m:0 8px 20px rgb(0 0 0/.10);
  --sh-toast:0 6px 20px rgb(0 0 0/.18);
  --sh-modal:0 28px 60px -2px rgb(0 0 0/.16),0 2px 4px rgb(0 0 0/.05);
  --sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:20px;--sp-6:24px;--sp-7:28px;--sp-8:32px;--sp-9:36px;--sp-10:40px;
  --d-container:1120px; --d-content-top:209px; --d-col-gap:20px; --d-method-gap:21px; --d-form-w:360px; --d-receipt-w:550px;
  --m-max:560px; --m-card-x:14px; --m-landing-x:22px; --m-bar-inset:30px;
  --z-below:-1; --z-raised:1; --z-sticky:10; --z-header:20; --z-overlay:900; --z-modal:1000; --z-toast:1100;
  --t-fast:120ms; --t-base:200ms; --ease:cubic-bezier(.2,0,0,1);
  --focus-ring:2px solid var(--c-focus); --focus-offset:2px;
}
```

---

## 2. Typography

### 2.1 Families (from `fonts.css`; do not redefine)

| Variable | Resolves to | Use |
|---|---|---|
| `--font-sans` / `--font-body` / `--font-heading` / `--font-caps` | 'SlicePay Georgian SC' (Noto Sans Georgian, **wdth 87.5**) → Noto Sans → fallbacks | all UI text (default on `html`) |
| `--font-wide` | 'SlicePay Georgian' (**wdth 100**) → Noto Sans | landing title |
| `--font-input` | 'SlicePay Georgian' (wdth 100) → 'Noto Sans Math' (only `/`) → Noto Sans | every input value and placeholder (set on `input` by fonts.css) |
| `--font-latin` | Noto Sans | pure Latin or digit strings: "1x", "4x", order ID, count badge |
| `--font-card` | Inter | card-form labels and inputs |
| `.num-narrow` / `.num-narrow-bold` | 0.550 em figures | see §2.4 |

Georgian glyphs, the space, NBSP, hyphen and ₾ come from the Georgian face. Latin letters, digits and punctuation come from Noto Sans, matching Figma's font fallback. Letter-spacing is **0 everywhere**. `font-synthesis:none`.

### 2.2 Type roles (identical size and weight on mobile and desktop unless a cell says otherwise)

Case: **MT** = Mtavruli, written as literal U+1C90–U+1CBF code points (or JS `toUpperCase()`). `text-transform:uppercase` does **not** work in Chromium. **mk** = ordinary Mkhedruli.

| Role | Class | Face (width / weight) | Size / line-height | Case | Colour | Where |
|---|---|---|---|---|---|---|
| Landing title | `.t-title` | wide 100 / **700** | 36 / 44 | MT | #fff | mobile 2 lines (break after the first word); desktop 1 line, `nowrap` |
| Loading message | `.t-loading` | SC / 400 | 26 / 35 | mk | #fff | landing ticker, 2 lines each, explicit `<br>` |
| Total heading "ᲯᲐᲛᲘ" | `.t-h-total` | SC / 600 | 30 / 36 | MT | #000 | cart summary, payment header and summary |
| Screen heading | `.t-h1` | SC / 600 | 23 / 28 | mk | #000 | auth headings; mobile cart "დაამატე სხვა პროდუქტი"; modal title |
| Section caps | `.t-h-caps` | SC / 600 | 20 / 20 | MT | #5e34ec (success title) / #000 | success headings |
| Section caps, regular | `.t-h-caps-reg` | SC / 400 | 24 / 24 | MT | #000 | "ᲨᲔᲯᲐᲛᲔᲑᲐ" |
| Button label | `.t-btn` | SC / 400 | 16 / (button height) | MT | #fff on primary; #5e34ec text buttons | all buttons except landing |
| Method title | `.t-btn` | SC / 400 | 16 / 19 | MT | #000 | payment cards (desktop: 2 lines, break before "ᲒᲐᲓᲐᲮᲓᲐ") |
| Landing button | `.t-btn-lg` | SC / 400 | 24 / 60 | MT | #fff (disabled 50% white) | "ᲨᲔᲛᲝᲬᲛᲔᲑᲐ" |
| Body 14 | `.t-body` | SC / 400 | 14 / 20 | mk | #000, or per component | checkbox labels, prompts, toggle, pill, notes |
| Link | `.t-body.t-link` | SC / 400 | 14 / 20 | mk | #5e34ec, underline from-font (≈0.7 px, ≈1.6–1.75 px below bl), skip-ink auto | all purple links incl. desktop back link |
| Body 16 | `.t-body-16` | SC / 400 | 16 / 20 | mk + digits | #878787 ("4 თვეში"), #353535 ("სულ  600₾"), #000 ("თვეში") | |
| Body 20 | `.t-body-20` | SC / 400 | 20 / 20 | mk + digits | #000 / #353535 | success "სულ" row |
| Note 12 | `.t-note` | SC / 400 | 12 / 16 | mk | #ff9900; errors #d93025 | register note, inline errors |
| Input | `.t-input` | wide 100 / 400 | 16 / 48 (inside a 50 box) | mk / Latin | value #000, placeholder #bcbcbc | auth and add-product inputs |
| Input large | `.t-input-lg` | wide 100 / 400 | 20 / 58 (inside a 60 box) | mk / Latin | value #505050, placeholder #ababab | landing URL |
| Product title | `.t-body` (Latin) | Noto Sans 400 (spaces from SC) | 14 / 20 | Latin | #000 | single line, ellipsis, `max-width:244px` (§3.11) |
| Price large | `.t-price-lg` | Noto Sans 400 + SC ₾ | 24 / 32 | digits | #000 (card price), #353535 (monthly) | cart |
| Price XL | `.t-price-xl` | Noto Sans **700** + SC ₾ | 30 / 36 | digits | #000 | payment header total |
| Item price | `.t-price-item` | **700** | 18 / 20 | digits | #505050 | success item row "600 ₾" |
| Qty / multiplier | `.t-latin` | Noto Sans 400 | 18/20 ("1x"), 16/20 ("4x") | Latin | #9e9e9e | success |
| Count badge digit | `.t-latin` | Noto Sans 400 | 14 / 14 | digit | #fff | product badge |
| Breakdown row | `.t-body` | SC / 400; total row **700** (Georgian and digits) **[re-measured: advance fit 700, err 0.01 px]** | 14 / 26 | mk + digits | #505050; struck value #a6a6a6 | cart and payment breakdowns |
| Card-form label | `.t-card-label` | Inter **600** | **14.5** / 20 | Latin | **#7b7b7b** | "Pay with", "Card number", "Exp Date", "CVV2" |
| Card-form input | — | Inter 500 | 16 / 38.5 | Latin | #000; focus placeholder #bcbcbc | |
| Toast / modal body | `.t-body` | SC / 400 | 14 / 20 (modal body 14 / 22) | mk | #fff / #353535 | **new** |

### 2.3 Baseline offsets for the line-heights above (bl − line-box top = L/2 + 0.388·s)

| s / L | Offset | s / L | Offset | s / L | Offset |
|---|---|---|---|---|---|
| 36/44 | 35.97 | 26/35 | 27.59 | 30/36 | 29.64 |
| 24/32 | 25.31 | 24/24 | 21.31 | 24/60 | 39.31 |
| 23/28 | 22.92 | 20/20 | 17.76 | 20/24 | 19.76 |
| 20/58 | 36.76 | 18/20 | 16.98 | 16/20 | 16.21 |
| 16/19 | 15.71 | 16/48 | 30.21 | 16/60 | 36.21 |
| 16/45 | 28.71 | 14/14 | 12.43 | 14/18 | 14.43 |
| 14/20 | 15.43 | 14/24 | 17.43 | 14/26 | 18.43 |
| 12/16 | 12.66 | Inter 14.5/20 | 15.27 | | |

### 2.4 Figure width per location (Figma used two digit widths)

Default is normal Noto Sans figures (0.572 em). Add the class only where listed.

| Location | Class | Frames it matches |
|---|---|---|
| Success screen: every number ("600 ₾", "150₾", "600₾", "4x", order ID, date digits) | `.num-narrow` (regular) / `.num-narrow-bold` (item price) | m17, d17 |
| Payment header "600₾", **desktop only** | `.num-narrow-bold` | d12–d15 (mobile stays normal, matching m12–m14; m15 differs by about 2 px) |
| Payment details box values, both breakpoints | `.num-narrow` / `.num-narrow-bold` (total row) | m15, d15 |
| Cart desktop "სულ  600₾" line and desktop product-title digits | `.num-narrow` | d03–d07 |
| Everything else (cart prices and monthly, cart breakdown, mobile titles, badge, "1x") | none | |

**[re-measured]** Cart breakdown digits are ordinary Noto Sans 14 px. The ink is 10.4 px tall and sits on the baseline (m07 "500": 260.8–271.2, bl 271). [`spec_cart.md`](specs/spec_cart.md)'s claim of "8.9 px Georgian-face digits raised 1.2 px" is wrong, so there is no 12.5 px workaround.

### 2.5 Mtavruli strings (exact)

| Source | Render | Code points |
|---|---|---|
| გამოიწერე ნაწილ-ნაწილ | ᲒᲐᲛᲝᲘᲬᲔᲠᲔ ᲜᲐᲬᲘᲚ-ᲜᲐᲬᲘᲚ | 1C92 1C90 1C9B 1C9D 1C98 1CAC 1C94 1CA0 1C94 · 1C9C 1C90 1CAC 1C98 1C9A 002D 1C9C 1C90 1CAC 1C98 1C9A |
| შემოწმება | ᲨᲔᲛᲝᲬᲛᲔᲑᲐ | 1CA8 1C94 1C9B 1C9D 1CAC 1C9B 1C94 1C91 1C90 |
| თავიდან დაწყება | ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ | 1C97 1C90 1C95 1C98 1C93 1C90 1C9C · 1C93 1C90 1CAC 1CA7 1C94 1C91 1C90 |
| გაგრძელება | ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ | 1C92 1C90 1C92 1CA0 1CAB 1C94 1C9A 1C94 1C91 1C90 |
| უკან | ᲣᲙᲐᲜ | 1CA3 1C99 1C90 1C9C |
| ჯამი | ᲯᲐᲛᲘ | 1CAF 1C90 1C9B 1C98 |
| კოდის გამოგზავნა | ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ | 1C99 1C9D 1C93 1C98 1CA1 · 1C92 1C90 1C9B 1C9D 1C92 1C96 1C90 1C95 1C9C 1C90 |
| აღდგენა | ᲐᲦᲓᲒᲔᲜᲐ | 1C90 1CA6 1C93 1C92 1C94 1C9C 1C90 |
| ნაწილ-ნაწილ გადახდა | ᲜᲐᲬᲘᲚ-ᲜᲐᲬᲘᲚ ᲒᲐᲓᲐᲮᲓᲐ | … |
| განაწილებით გადახდა | ᲒᲐᲜᲐᲬᲘᲚᲔᲑᲘᲗ ᲒᲐᲓᲐᲮᲓᲐ | … |
| მერე ბარათით გადახდა | ᲛᲔᲠᲔ ᲑᲐᲠᲐᲗᲘᲗ ᲒᲐᲓᲐᲮᲓᲐ | … |
| გადახდა (card-form button) | ᲒᲐᲓᲐᲮᲓᲐ | 1C92 1C90 1C93 1C90 1CAE 1C93 1C90 |
| შეკვეთა მიღებულია | ᲨᲔᲙᲕᲔᲗᲐ ᲛᲘᲦᲔᲑᲣᲚᲘᲐ | … |
| თქვენი შეკვეთა | ᲗᲥᲕᲔᲜᲘ ᲨᲔᲙᲕᲔᲗᲐ | … |
| გადახდის მეთოდი | ᲒᲐᲓᲐᲮᲓᲘᲡ ᲛᲔᲗᲝᲓᲘ | … |
| შეჯამება | ᲨᲔᲯᲐᲛᲔᲑᲐ | 1CA8 1C94 1CAF 1C90 1C9B 1C94 1C91 1C90 |
| მთავარი გვერდი | ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ | … |
| დამატება (**new**, add form) | ᲓᲐᲛᲐᲢᲔᲑᲐ | 1C93 1C90 1C9B 1C90 1CA2 1C94 1C91 1C90 |
| გასაგებია (**new**, modal) | ᲒᲐᲡᲐᲒᲔᲑᲘᲐ | 1C92 1C90 1CA1 1C90 1C92 1C94 1C91 1C98 1C90 |

Everything else is Mkhedruli, including the breakdown "ჯამი" row label, the desktop link "უკან დაბრუნება", and every heading in §2.2 that is marked mk.

The spec JSON and `frames_text` decode Mtavruli as lowercase. **[re-measured]** The text-run fit flags for "აღდგენა" (600) and "გადახდა" (500) are misfits: crops show both are Mtavruli 400.

Set `aria-label` with the Mkhedruli text only where screen-reader output matters. Mtavruli reads correctly.

### 2.6 Copy deck (exact strings)

- **Landing:**
  - placeholder `ჩაწერეთ ლინკი...`
  - loading messages `ვამოწმებთ პროდუქტის<br>დეტალებს` and `ვამუშავებთ<br>ინფორმაციას`
- **Cart:**
  - mobile header `დაამატე სხვა პროდუქტი` (23/600); desktop tile `დაამატე სხვა პროდუქტი` (14/400)
  - toggle `ფასი დეტალურად`
  - monthly label `4 თვეში`
  - total `სულ␣␣600₾` (two spaces, ink gap 9.1)
  - checkboxes `წონის თანხას მოგვიანებით გადავიხდი`, `განბაჟების თანხას მოგვიანებით გადავიხდი`
  - breakdown rows (mobile): `ნივთის ფასი`, `წონის დაახ. ფასი`, `განბაჟების დაახ. ფასი`, `მომსახურების ფასი`, `ჯამი`
  - breakdown rows (desktop): same, with `დაახლოებით` in place of `დაახ.`
  - demo product name `Nike Air Pegasus 89 Men Size 9Aon ...` (store it literally)
- **Auth:**
  - heading `პირადი ინფორმაცია` (register **and** login); `პაროლის აღდგენა` (recover)
  - placeholders `სახელი`, `გვარი`, `ტელეფონის ნომერი`, `პაროლი`, `ელ.პოსტა`, `აქტივაციის კოდი`, `ახალი პაროლი`, `პაროლის გამეორება` (typo fixed)
  - note `*შეკვეთის შესახებ ინფორმაციას მიიღებთ ამ ნომერზე`
  - register prompt `გაქვს ანგარიში? ` + link `გაიარე ავტორიზაცია`
  - login prompt `თუ არ გაქვს ანგარიში ` + link `დარეგისტრირდი` (single space, no "?", as the brief)
  - links `პაროლის აღდგენა`, `კოდის ხელახლა გამოგზავნა`
  - terms checkbox `გავეცანი და ვეთანხმები ` + link `წესებსა და პირობებს`; login checkbox `პაროლის დამახსოვრება`
- **Payment:**
  - subtitles `საქართველოს ბანკის<br>მომხმარებლებისთვის`, `თიბისი ბანკის<br>მომხმარებლებისთვის`, `მერე ბარათის<br>მფლობელებისთვის`
  - notes: the two checkbox strings
  - breakdown uses `დაახ.` on **both** breakpoints (as drawn)
- **Card form:** `Pay with`, `Card number`, `Exp Date`, `CVV2` (English, as designed)
- **Success:**
  - `order ID:` + 3 spaces (ink gap 10.9) + `#112233`
  - date `15 თებერვალი 2025` (dynamic: `D <month> YYYY`)
  - notes `წონის გარეშე`, `განბაჟების გარეშე`
  - method lines `საქართველოს ბანკი: ` + `ნაწილ-ნაწილ` | `თიბისი ბანკი: ` + `განაწილება` | `მერე: ` + `ბარათით გადახდა`
  - rows `თვეში` · `4x` · `150₾`, `სულ` · `600₾`
- **Price format:** `600₾` (no space) for card price, monthly, "სულ", header totals and success summary. `500 ₾` (with a space) in breakdown and details rows and in the success item price. No thousands grouping. `monthly = Math.ceil(payable / 4)`.

---

## 3. Component catalogue

### 3.1 Logo

| Variant | Asset | Box | Position |
|---|---|---|---|
| White (landing) | `assets/icons/logo-white.svg` | 113×76 | (157, 60) mobile; (663, 60) desktop |
| Colour (desktop inner screens: cart, auth, payment, card form, success) | `assets/icons/logo-color.svg` ("Slice" + mark #5e34ec, "Pay" #8a50fc) | 113×76 | (663, 60) |

- Ink inside the box: 0.79, 0.99, 111.72×74.32. Mark 35.88², wordmark 111.72×29.
- Centre with `left: calc(50% - 57px)` (gives 663 at 1440 and 157 at 428). Keep integer px: Chromium snaps fractional `<img>` positions.
- **No logo on mobile inner screens.**
- d00 is at 60 too: the "64" in [`spec_icons.md`](specs/spec_icons.md) came from the wrong frame origin.
- `alt="SlicePay"`. On inner screens the logo is a link to `#/`? **No:** it is decorative there. Reset happens only via the explicit buttons.

### 3.2 Desktop page header and back link

- **Header block:** `position:relative; height:136px; padding-top:60px` (logo 60–136).
- **Main content starts at y 209** (`margin-top:73px`) on cart, payment, card form and success. Auth uses its own heading flow (§4.3).
- **Back link** `<a class="back">`:
  - `position:absolute; top:22px; left:<container left>`, which is x 160 at 1440. `display:inline-flex; align-items:center; gap:4px; height:24px`.
  - Icon: `arrow-left.svg` 24-box (glyph 16×16 at +4,+4), `#5e34ec`.
  - Text "უკან დაბრუნება": `.t-body.t-link`, line-height 24, bl 39 (ink x 188.2–294.0).
  - Hover #4820cc (underline kept). Focus-visible: ring offset 2 px, radius 4.
- **Shown on:** cart, register, login, recover, recover/code, payment, and **#/pay (added; not drawn)**. **Not shown on:** landing, success.
- **Targets:**

  | From | Back goes to |
  |---|---|
  | cart | `#/` |
  | register / login | `#/cart` |
  | recover | `#/login` |
  | recover/code | `#/recover` |
  | payment | `#/cart` |
  | pay | `#/payment` |

  Browser history must stay consistent: use `history.back()` when the previous entry is the target, otherwise `location.hash`.

### 3.3 Primary button `.btn`

| Property | Value |
|---|---|
| Box | height **60**, r 8, bg #5e34ec, no border, no shadow. Label `.t-btn` (16 MT 400 #fff) centred, `line-height:60px` (bl = top + 36.2; design +36.0) |
| Widths | mobile bottom bar 180; landing 384 (mobile) / 360 (desktop); desktop auth 360; cart desktop summary 415; payment desktop summary 415; success 384 (m) / 550 (d); card form **312×45** (`.btn--card`, `line-height:45px`) |
| `.btn--lg` (landing) | label `.t-btn-lg` 24 MT 400, `line-height:60px` (bl top + 39.3; design 38.9) |
| `.btn--sm` (**new**, add form) | height 50, padding 0 24 |
| Hover | bg #5129e0 · Active bg #4820cc + `translateY(1px)` · transition 120 ms |
| Focus-visible | `outline:2px solid #5e34ec; outline-offset:2px`. On the gradient: `outline-color:#fff` |
| Disabled look (landing only, empty or invalid URL) | bg `rgb(94 52 236/.5)`, label `rgb(255 255 255/.5)`, `cursor:not-allowed`, `aria-disabled="true"` (not `disabled`, so Enter still reports the error). **No other button is ever disabled**: auth, cart, payment and card-form buttons stay enabled and validate on submit |
| Loading | bg stays solid #5e34ec; label `visibility:hidden` (kept for AT); spinner centred (§3.5); `aria-busy="true"`; `pointer-events:none`; button box unchanged (no width change; m02's 380/24 inset is a slip) |

### 3.4 Text button `.btn-text` (mobile bottom-bar left slot)

- Box 180×60 (shrinks below 428, §3.17), transparent, r 8. Label `.t-btn` 16 MT 400 **#5e34ec**, centred, no underline.
- Hover bg `rgb(94 52 236/.08)`. Active `rgb(94 52 236/.14)`. Focus-visible ring offset −2 px (inside).
- Labels: cart "ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ" (reset everything → landing). Auth, payment and pay "ᲣᲙᲐᲜ" (same targets as §3.2).

### 3.5 Spinner

- `assets/icons/spinner.svg` (40×40, white `currentColor`): outer r 20, inner r 14.208, arc 330.34° clockwise from 3 o'clock. The gap runs from 3 o'clock to about 2 o'clock.
- Rotate about its centre (`transform-origin:50% 50%`), `spin .8s linear infinite`.

| Size | Where |
|---|---|
| **40** | landing button, at (194, 617) mobile / (700, 617) desktop |
| **24** | all other buttons (same SVG scaled; ring ≈ 3.5 px) |

With `anim=0` the rotation is 0°, which matches m02/d02.

### 3.6 Inputs

**a) Landing URL input `.url-input`** (on the gradient)

| Property | Value |
|---|---|
| Box | 384×60 mobile (x 22) / 1120×60 desktop (x 160), bg #fff, `border:1px solid #5e34ec` (resting style, not just focus), r 8 |
| Text | `.t-input-lg` 20 px, `line-height:58px` → bl = top + 37.8 (design 38) |
| Empty | `padding:0 6px 0 65px` → placeholder at x = left + 66, #ababab |
| Filled | `padding-left:19px` → value at x = left + 20, #505050. Mobile `padding-right:6px` (the design string "https://www.amazon.com/Xbox-Core-" ends 7.2 px from the edge); desktop `padding-right:20px` |
| Focus-visible | keep the border; add `box-shadow:0 0 0 3px rgb(255 255 255/.35)`; `caret-color:#5e34ec` |
| Error | `border-color:#ff6b6b; box-shadow:inset 0 0 0 1px #ff6b6b`; message §3.24 (on-dark variant) |
| Loading | `readonly`, unchanged look; `aria-busy` on the form |
| Attributes | `type="url" inputmode="url" autocomplete="off" spellcheck="false" enterkeyhint="go"` |

**b) Form input `.field`** (auth, add-product)

| Property | Value |
|---|---|
| Box | height **50**, width fluid (361 m register/login, 360 desktop), bg #fff, `border:1px solid #878787`, r 8 |
| Text | `.t-input` 16 px, `padding:0 15px` (text starts 16 from the outer edge), `line-height:48px` → bl = top + 31.2 (design 31). Placeholder #bcbcbc, value #000, `caret-color:#5e34ec` |
| Hover | border #5e5e5e |
| Focus | border #5e34ec + `inset 0 0 0 1px #5e34ec` |
| Error | border #d93025 + inset; message §3.24; `aria-invalid`, `aria-describedby` |
| Labels | visually hidden `<label>` with the placeholder text (fields have no visible labels) |
| Password + eye `.field--pw` | `padding-right:56px`. Eye `<button type="button" aria-pressed aria-label="პაროლის ჩვენება / პაროლის დამალვა">`: 40×40 hit area centred on a 25×25 icon (`eye.svg` / `eye-off.svg`, stroke 1 px #1e1e1e). Icon box right edge = field right − 16, vertical centre = field centre + 0.5. Eye only on register and login password fields; **not** on recover-code fields (as designed) |
| Phone | `inputmode="tel" autocomplete="tel"`, live format `5XX XXX XXX`, optional `+995 ` prefix |
| Code | `inputmode="numeric" autocomplete="one-time-code" maxlength="4"` |

**c) Card-form input `.card-input`**

| Property | Value |
|---|---|
| Box | height **40.5**, bg #fff, `border:1px solid #e7e7e7`, r 8, `padding:0 18px` (text 19 from the outer edge) |
| Text | Inter 500 16 px, value #000, `line-height:38.5px` |
| Empty and unfocused | placeholder transparent; skeleton bars painted as a background: #e7e7e7 pills, height 9.5, r 4.75, vertically centred, starting 19 px from the outer left (background-position 18px center). Card number: bar 96.4 + gap 6 + bar 63.1. Exp: 47.6 + 4.8 + 47.6. CVV: 47.6 |
| Focus | border #5e34ec + inset 1 px; skeleton hidden; real placeholder #bcbcbc: `1234 1234 1234 1234`, `MM / YY`, `123` |
| Hover | border #cfcfcf |
| Error | as (b) |

### 3.7 Store-icon carousel (landing, empty state only)

- **Slot:** `overflow:hidden` 34×58 at input left + 16, input top + 1. That is (38, 526) on mobile and (176, 526) on desktop. `aria-hidden="true"`, `z-index:1`.
- **Column inside the slot:** `amazon.svg` 22×23 at slot (6, 19); `ebay.svg` 33×14 at slot (1, 64).
- **Animation:**
  - The cycle starts on **amazon** and holds 2.2 s.
  - It then slides the column `translateY(-42px)` (eBay at slot (1, 22)) over 400 ms ease-in-out, holds 2.2 s, and slides back.
  - The animation is paused (static amazon) when `anim=0` or with reduced motion.
- **Visibility:** the slot is **removed as soon as the input is non-empty** (m01/d01).
- "ebay" in the URL only sets the mock product's store field. There is no visible icon change, because the icon is hidden whenever text exists.

### 3.8 Checkbox `.check`

| Part | Value |
|---|---|
| Input | real `<input type="checkbox">` visually hidden inside a `<label>` row |
| Box | 18×18, r 2. **Checked:** bg #65558f + `check.svg` (white, 18-box) as background. **Unchecked:** transparent, `border:2px solid #49454f` (inside) |
| State layer (hover/focus/press) | Ø40 circle centred on the box, `rgb(101 85 143/.08)` checked / `rgb(73 69 79/.08)` unchecked; focus-visible .12 + 2 px #5e34ec outline (offset 2, r 2); pressed .12 |
| **Cart variant** `.check--cart` | label gap **15** (label x = box right + 15); label bl = box top + **15.1** (`line-height:20px; margin-top:-0.3px`); row pitch 34 (m) / 29 (d) |
| **Auth variant** `.check--auth` | label gap **8**; label bl = box top + **13** (`line-height:18px; margin-top:-1.4px`). **[re-measured]** m03 box 24,490 / label bl 505; m08 box 32,597 / bl 610 |
| Terms link | "წესებსა და პირობებს" is a `<button class="link">` inside the label that opens the modal; it stops propagation, so clicking it does not toggle the box |

### 3.9 Text link `.link`

`.t-body.t-link` 14 px #5e34ec, always underlined. Only the purple part is a link; lead-in text is #000. Hover #4820cc. Focus-visible outline 2 px, r 2.

Cooldown state (resend code): `aria-disabled="true"`, colour #878787, no underline, text "კოდის ხელახლა გამოგზავნა (0:30)" counting down to 0:00, then the link returns.

### 3.10 Details toggle `.toggle` ("ფასი დეტალურად" + caret)

- `<button aria-expanded aria-controls>`, `display:inline-flex; align-items:center; gap:4px`.
- Text `.t-body` 14 #666. Caret `caret-down.svg` 24-box (#79747e, triangle 10×5 at 7,10).
- The 24-box starts 4.7 px after the label ink.
- Open: rotate the 24-box 180° (`--t-base`), which reproduces the 1 px rise of the up-caret.
- Hover: text #353535, caret #49454f. Focus-visible: ring offset 2, r 4.

### 3.11 Product card `.product`

| | Mobile (m03) | Desktop (d04) |
|---|---|---|
| Card | part of the single mobile cart card (§3.12a): x 14–414, white, `1px #d3d3d3` inside, r 8. Content from the outer edge: left 20, right 19 (x 34–395); bottom 36 closed / 16 open | own card 645 wide, white, 1 px #d3d3d3, r 8. From the outer edge: top 16, left 17 (thumb x 177), bottom 19, right 0 (CSS `padding:15px 0 18px 16px`) |
| Row grid | `grid-template-columns:65px minmax(0,1fr) 24px; column-gap:13px` (thumb 34–99, info from 112, ✕ box right edge 395) | `grid-template-columns:73px minmax(0,1fr) 24px; column-gap:19px` (thumb 177–250, info from 269, ✕ box right edge = card right − 33) |
| Thumbnail | 65×65 r 8, `object-fit:cover; object-position:50% 50%` (`product-nike.jpg` 982×705 → centre square) | 73×73 (design 72.6) |
| Count badge | Ø27: #767676 fill + 2 px #fff border; centre on the thumb's bottom-left corner (−0.5): `left:-14px; top:51px` | Ø30 (design 29.7): `left:-15px; bottom:-14px` |
| Badge digit | 14 px Noto Sans #fff, centred | same |
| Title | `.t-body` Latin, 1 line, `max-width:244px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis`. bl = thumb top + 20 (LH 20 line box starts 4.6 below the thumb top) | bl = thumb top + 23 (line box starts 7.6 below the thumb top); `.num-narrow` |
| Price row | margin-top 10 after the title box; `display:flex; align-items:center; gap:10px; height:32px`. Price `.t-price-lg` #000 (bl = thumb top + 60), then toggle §3.10 | same; bl = thumb top + 63 |
| Remove ✕ | `<button aria-label="წაშლა">` 40×40 hit area; `close.svg` 24-box (#878787, glyph 14×14), 24-box at (371, 196): centre y 208, i.e. **5.5 px below** the thumb centre | 24-box centred on the closed card (centre y = card top + 54.3; d04 (748, 368.3)). It stays there when the card expands |
| ✕ hover | Ø40 `rgb(0 0 0/.06)` circle, icon #353535; focus ring 2 px | same |
| Closed height | thumb bottom + 36 → card bottom (m03: card 15–271) | 16 + 73 + 19 = **108** (326–434; design 433.6) |
| Expanded | breakdown box (§3.13 cart-m) below the row: `margin:8px 0 0 64px` (box x 98–395), card bottom = box bottom + 16 (m07: 15–409) | details block (§3.13 cart-d): divider 13.4 below the thumb, rows, `padding-bottom:13.3px` (d07: 326–585) |
| Several products (not designed) | in the one mobile card, each extra product is preceded by a divider (34–395) with 32.5 above and below | one card per product, gap 20 |

Remove: if the cart becomes empty, go to landing.

### 3.12 Add-product

**a) Mobile header (inside the product card, at its top)**
- Whole row is a `<button>`: `display:flex; align-items:center; gap:22px`.
- Icon `plus-circle.svg` 43×43 (#5e34ec) with its box at card-left + 23, card-top + 32 → (37, 47).
- Heading `.t-h1` 23/28 600 #000, vertically centred on the icon → bl 77.4 (design 77.2), ink x 102.
- Below: divider 1 px #d3d3d3 at y 136.5 (x 34–395; on 1× DPR snap to 136), then the product rows (thumb top = divider bottom + 32.5).
- Hover: bg `rgb(94 52 236/.04)` on the header area. Focus-visible: 2 px #5e34ec outline, offset −2, r 8.
- `< 380px`: heading `font-size:clamp(18px,5.4vw,23px)` and it may wrap.

**b) Desktop tile (canonical: d04–d07, purple, ABOVE the product cards)**
- `<button>` full column width, **height 97**, bg #5e34ec, r 8, no border, `display:flex; flex-direction:column; align-items:center; padding-top:9px`.
- Icon `plus-circle-white.svg` 43×43.
- Label `.t-body` 14 #fff, centred, `margin-top:8px; line-height:20px`: bl = icon bottom + 24.1 (d04 bl 285.1).
- Hover #5129e0, active #4820cc, focus ring offset 2.
- QA `addTile=below` renders d03 instead: tile **below** the product card, bg #f3efff, `plus-circle-gray.svg` (#bcbcbc), label #666.

**c) Open state, inline URL form (new; d03 light palette)**
- **Trigger:** clicking the header or tile expands it. QA `add=1`.
- **Desktop:** the tile becomes bg #f3efff, `height:auto; padding:20px`, icon hidden. Content row `display:flex; gap:12px`:
  - `.field` input (flex 1, height 50, placeholder "ჩაწერეთ ლინკი...");
  - `.btn--sm` "ᲓᲐᲛᲐᲢᲔᲑᲐ";
  - text link "გაუქმება" (14 #5e34ec, underlined) centred under the row, margin-top 12.
- **Mobile:** the same controls expand inside the card between the header row and the divider (`padding:0 19px 16px 20px`); the button goes full width under the input below 380 px.
- **Behaviour:**
  - Same URL validation as the landing; error §3.24 (light variant).
  - Submit shows a 24 px spinner in the button for about 800 ms, then appends a mock product and collapses the tile.
  - Esc or "გაუქმება" collapses it, and focus returns to the trigger.

### 3.13 Price breakdown `.breakdown` (dotted-leader rows)

Shared row anatomy:
- Rows `display:flex; align-items:baseline; height:26px; line-height:26px` (`.t-body` 14 #505050). Pitch 26.
- Leader: `flex:1 1 auto; height:1.1px; align-self:baseline; transform:translateY(-3.2px); background:repeating-linear-gradient(90deg,#a6a6a6 0 3.27px,transparent 3.27px 4.25px)`. That gives dash 3.27 × 1.1, period 4.25, centre at bl − 3.76. `border-style:dashed` will not match.
- **Deferred row (weight or customs deferred):** the **amount only** is #a6a6a6 with `text-decoration:line-through; text-decoration-thickness:0.7px; text-decoration-color:#a6a6a6`. The label and leader are unchanged. This is the treatment drawn in m15/d15, now used everywhere.
- **Total row "ჯამი":** weight **700** for label and amount. The amount = **payable** (deferred parts excluded). Example: both deferred → struck 100 and 250, total **600 ₾**.
- Amount format `NNN ₾` (space). `white-space:nowrap`.

| Variant | Order | Container | Geometry |
|---|---|---|---|
| **cart-m** (m07) | **amount → leader → label** (as drawn) | box bg **#f4f4f4** (design #f1f1f1, merged), r 8, x 98–395 (`margin-left:64px` from content-left 34), `padding:10px 13.5px 10px 12.5px` | first bl = box top + 28.1; amounts left at 110.5; labels right-aligned to 381.5; box 150 tall; leader margins: 1 px after the amount, 5 px before the label |
| **cart-d** (d07) | amount → leader → label | **no box**; 1 px #d3d3d3 divider on top spanning the row width (design 271–783 vs rows 269–784: align both to **269–784**) | divider at thumb bottom + 13.4 (y 428); first bl = divider bottom + 31.1 (460.1); block spans x **269–784** (left = the title column; right = card outer right − 21); card bottom = last row line box + 13.3 (from the outer edge); labels say `დაახლოებით` |
| **pay-m** (m15) | **label → leader → value** | box bg #e7e7e7, r 8, x 14–414 (400; design 401), height 150, `padding:10px 32px 10px 13px` | first bl = box top + 28 (127); values right at 382; leader 4.5 px each side; `.num-narrow` values |
| **pay-d** (d15) | label → leader → value | box #e7e7e7 r 8, 415×150 inside the summary card, `padding:10px 14px 10px 13px` | first bl box top + 28 (348); values right at 1246; `.num-narrow` |

Expand and collapse: height and opacity over 200 ms. Caret rotates in sync. The content is in the DOM with `hidden` when closed.

### 3.14 Summary blocks

**a) Cart summary, mobile** (m03 card 14,290 400×166; white, 1 px #d3d3d3, r 8). Inner left x 34. Vertical stack with paddings measured from the outer edge:

| Item | Spec |
|---|---|
| Padding-top | 20.7 (19.7 + border) |
| "ᲯᲐᲛᲘ" | `.t-h-total` 30/36, bl 340.3 |
| Monthly row | margin-top 11, height 32, `display:flex; align-items:baseline; gap:17px`. Order **[amount, label]**: "150₾" `.t-price-lg` #353535 bl 383, then "4 თვეში" `.t-body-16` #878787 with `position:relative; top:-2px` (bl 381.1) |
| "სულ␣␣600₾" | `.t-body-16` #353535, margin-top 19, LH 20, bl 425.1 |
| Padding-bottom | 27.3 |

**b) Cart summary, desktop** (d04 825,209 455×305; `padding:20px` from the outer edge; content x 845–1260):

| Item | Spec |
|---|---|
| Header row | `height:36px; display:flex; justify-content:space-between; align-items:center`. Left "ᲯᲐᲛᲘ" (bl ≈ 258.6; design 259.3). Right group `gap:13px` **[label, amount]**: "4 თვეში" #878787 16 (bl 253.1) and "150₾" 24 #353535 (bl 256.0). Ink centres all ≈ y 248 |
| "სულ␣␣600₾" | `text-align:right`, `.num-narrow`, LH 20, margin-top 16.7 → bl 298.1 |
| Divider | 1 px #d3d3d3, 30.3 below the "სულ" box → y 332 |
| Checkboxes | `.check--cart`, list `padding:15px 0 0 15px` → boxes (860, 348) and (860, 377), pitch 29 |
| Button | `.btn` 415×60 at y 434 (row-2 box bottom + 39) |
| Padding-bottom | 20 → card bottom 514 |

Optional `position:sticky; top:24px` is off by default.

**c) Payment summary, desktop** (d12 825,209 455×278; white, 1 px #d3d3d3 inside, r 8; `padding:20px` from the outer edge):

| Item | Spec |
|---|---|
| Header | `display:flex; justify-content:space-between; align-items:baseline`: "ᲯᲐᲛᲘ" `.t-h-total` and "600₾" `.t-price-xl .num-narrow-bold`, both bl 259 |
| Toggle row | `justify-content:flex-end; margin-right:-2px`; toggle bl 288, 24-box 1238–1262 × 271–295 |
| Details box | when open: pay-d box at toggle bl + 32 (box 320–470) |
| Divider | 1 px #d3d3d3 at y 323 (closed) / 489 (open): 35 below toggle bl, or 19 below the box |
| Notes (§3.16) | bl 347 / 371 (open 513 / 537): first bl = divider bottom + 23 |
| Button | `.btn` 415×60. Top = last note bl + **36 closed / 32 open** (frame-exact) → 407 / 569 |
| Padding-bottom | 20. Height 278 closed, 440 open |

**d) Payment header, mobile** (no card)
- Row 1 `display:flex; justify-content:space-between; align-items:baseline; padding:0 46px 0 40px`. Line box 32–68: "ᲯᲐᲛᲘ" bl 62 at x 40; "600₾" `.t-price-xl` (normal figures) right edge 382.
- Row 2: toggle right-aligned, line box 68–92 (bl 85, 24-box 367–391), so the toggle overhangs the total by 9 (`margin-right:-9px`).
- Details box (pay-m) at y 99 when open (toggle bottom + 7).

**e) Success summary.** See §3.19.

### 3.15 Payment method card `.method` (radio card)

| Part | Spec |
|---|---|
| Semantics | `<fieldset role="radiogroup">` with legend "გადახდის მეთოდი" (visually hidden). Each card is a `<label>` wrapping a visually hidden `<input type="radio" name="method" value="bog\|tbc\|mere">`. Arrow keys work natively. Default `bog` |
| Box | white, `border:1px solid #d3d3d3`, r 8 (1 px inside: **[re-measured]**, no outer ring) |
| Selected | bg #f3efff, `border-color:#5e34ec`, radio on. Geometry and text colours unchanged |
| Hover (unselected) | border #bfaef7, `cursor:pointer`, 120 ms |
| Focus-visible | `:has(:focus-visible)` → `outline:2px solid #5e34ec; outline-offset:3px` |
| Radio | 24-box; CSS circle 20 with `border:2px solid #49454f` (off) / #65558f (on) + 10 px `::after` dot (#65558f), inset 2. Or `radio-on.svg` / `radio-off.svg` |
| Bank logo | `<img>` 81×50, `object-fit:contain` (assets `bog-nawil-nawil.png`, `tbc-ganawileba.png`, `mere.png`; corners pre-rounded) |
| Title | `.t-btn` 16 MT #000, `line-height:19px` |
| Subtitle | `.t-body` 14 #666, `line-height:18px`, explicit `<br>` (§2.6) |

| | Mobile (400×100 rows) | Desktop (201×278 columns) |
|---|---|---|
| Layout | grid `24px 81px 1fr`, `column-gap:12px`, text column `padding-left:4px`; `padding:20px` (outer); `align-items:start` | `flex-direction:column; align-items:center; text-align:center; padding-top:41.7px` (outer) |
| Radio | 24-box at card (+20, +32) → (34, 149) | 24-box top = card top + 214.3 (423.3), centred |
| Logo | (70, card top + 20) | top = card top + 41.7, centred |
| Title | x **167** (all three cards; drawn at 170 in cards 1–2), one line `nowrap`, bl = card top + 36.1 | 2 lines (`<br>` before "ᲒᲐᲓᲐᲮᲓᲐ"), line-box top 318.6 (logo bottom + 17.9), bl 334.3 / 353.3 |
| Subtitle | bl = card top + 58 / + 76 (LH 18, line-box top = title bottom + 4.2) | margin-top 15.3 → bl 386.3 / 404.3 |
| < 380 px | title may wrap (`white-space:normal`) | n/a |

### 3.16 Bullet notes `.notes` (payment)

- `<ul>` `list-style:none; padding-left:21px; margin:0`. Items `.t-body` 14 #7b7b7b, `line-height:24px`, `position:relative`.
- `li::before`: 3.1×3.1 circle `currentColor`, `left:-12px`, centre at bl − 5.1, i.e. `top:calc(17.43px - 5.1px - 1.55px)` = 10.78 px.
- Only the deferred parts are listed. If nothing is deferred, the list is removed, and on desktop the divider too. Then the desktop button sits 36 below the toggle row.
- Mobile x: bullet centre 24.5, text from 36 (content-left 14 + 21 + 1 bearing).

### 3.17 Mobile bottom action bar `.m-bar`

- **Grid:**
  ```css
  .m-bar{display:grid;
    grid-template-columns:minmax(0,180px) minmax(0,180px);
    column-gap:12px; justify-content:space-between;
    padding:0 30px 0 18.5px; height:60px}
  ```
  At 428 this gives the left text-button box 18.5–198.5 (label centre 108.5, as measured on every frame) and the primary box 218–398.
- **In flow, not fixed.** It is the last child of a `min-height:100dvh; display:flex; flex-direction:column; padding-bottom:30px` page, preceded by a spacer `flex:1 1 auto` with a per-screen minimum:

  | Screen | Spacer minimum |
  |---|---|
  | cart | 24 (row-2 bottom → bar, i.e. last box bottom + 40) |
  | payment | 30.4 (last note line box → bar, i.e. bl + 37) |
  | auth | the checkbox row sits **inside** the bottom group, 30 above the bar; spacer minimum 32 above it |
  | pay | 24 below the card |

- At 735 px of height the bar is at **645–705**. When content is taller (m07: 721, m15: 693) the page scrolls.
- Below 400 px the columns shrink equally. Below 360 px use `padding:0 16px 0 16px`, and the left label may wrap to 2 lines (`line-height:20px`).
- Do not use `position:fixed`: the soft keyboard must never cover inputs.

### 3.18 Divider

`<hr>` 1 px, no margin of its own. Colours: #d3d3d3 cart and payment; #bcbcbc recover code; #c9c9c9 success.

### 3.19 Receipt, zig-zag, success badge, date pill

**Receipt `.receipt`**
- bg #fff, `border-radius:8px 8px 0 0`, `position:relative; isolation:isolate`.
- The body ends at the **valley line**.
- `::after` zig-zag strip:
  ```css
  .receipt::after{content:"";position:absolute;left:0;right:0;top:100%;
    aspect-ratio:51.5/1;              /* h = W/51.5 → 8.31 at 428, 10.68 at 550 */
    background:url(../assets/icons/zigzag.svg) 0 0/calc(100% / 32) 100% repeat-x}
  ```
  Exactly **32 teeth** at any width: 13.375 × 8.317 at 428, 17.1875 × 10.659 at 550. The first valley is at x 0. The next block's margin is measured from the tips, so reserve the tooth height with `margin-bottom`.
- **Mobile shadow:** `::before{content:"";position:absolute;inset:0 0 calc(-1 * tooth-height / 2) 0;z-index:-1;border-radius:8px 8px 0 0;box-shadow:var(--sh-receipt-m)}`. It is straight-edged, ending at the teeth mid-line (415.84). Desktop has no shadow.

**Success badge**

| | Mobile | Desktop |
|---|---|---|
| Asset | `success-check-sm.svg` 70×70 | `success-check.svg` 75×75 |
| Disc | r 35 #e8d6ff | r 37.5 |
| Ring | 2 px #ab98e9 at r 30.62 | 2 px at r 32.80 |
| Check | stroke 4.82 #5e34ec, miter | same |

Do not scale one file to the other size: Figma kept the stroke widths fixed.

**Date pill**
- `height:19px`, bg #5e34ec, r 4, `padding:0 6px 0 4px`, `display:inline-block`.
- Text `.t-body.num-narrow` 14 #fff, `line-height:17px` (text sits at the top), so bl = pill top + 13.9 (design 14.0).
- Width hugs the text (141 for "15 თებერვალი 2025").

### 3.20 Card form `.card-form` (rebuild of the raster; never show the raster's "Pay 100 EUR")

| Part | Mobile (m16) | Desktop (d16) |
|---|---|---|
| Card | bg #fff, r 20, `--sh-card-form-m`, `width:min(369px, 100% - 58px)`, top 55 (design 54.8), centred (x 29.5) | 360×365 at (540, 209), r 20, `--sh-card-form-d` |
| Padding | `26px 28.5px 28px` (content 312) | `26px 24px 28px` (content 312) |

Vertical chain (card-relative, the same on both; total 365):

| Step | Value | Detail |
|---|---|---|
| Top padding | 26 | |
| "Pay with" | 20 | `.t-card-label`, LH 20, bl ≈ +41.3 (design 41.7) |
| Gap | 18 | |
| Badge row | 19 | `display:flex; gap:9.6px; margin-left:1px`. Badges `card-visa/mastercard/diners/maestro/discover/amex.svg` 28.5×19 at pitch 38.1 |
| Gap | 28 | |
| "Card number" | 20 | |
| Gap | 5 | |
| Card-number input | 40.5 | |
| Gap | 22.5 | |
| Exp / CVV row | | `grid 1fr 1fr; column-gap:14.3px`, each cell a label (20) + gap 5 + input (40.5) |
| Gap | 28 | |
| Button | 45 | `.btn--card` 312×45 "ᲒᲐᲓᲐᲮᲓᲐ" (label bl = top + 28.7; design 28.0) |
| Bottom padding | 28 | |

Resulting tops: badges 64, input 136, labels-2 199, inputs-2 224, button 292.5, total **365.5** (= m16). Design 64.3 / 135.7 / 199.1 / 223.9 / 292.2. On desktop, use bottom padding 27.5 to get the drawn 365.

States:
- **Brand detected:** the detected badge stays at 100%; the others go to `opacity:.3; filter:grayscale(1)` (120 ms). Nothing is dimmed while the brand is unknown.
- **Field rules:**
  - number auto-groups 4-4-4-4 (Amex 4-6-5) and must pass Luhn;
  - Exp `MM/YY`, not in the past;
  - CVV 3 digits (Amex 4).
  Errors per §3.24 (light variant), placed under the field; the chain grows by 21 px per message.
- **Processing (about 1.2 s):** 24 px spinner in the button; inputs `readonly` + opacity .6; then `location.replace('#/success')`.

### 3.21 Loading ticker `.ticker` (landing)

- **Window:** 395×73, `overflow:hidden`, horizontally centred. Top at **355** (mobile) / **353** (desktop). `aria-live="polite"`.
- **Content:** a stack of two message blocks, each 70 tall (2 × 35), 22 apart (pitch 92). `.t-loading`, centred.
- **Rest position:** the stack top sits at window top **− 4.59**, so line-1 bl = window top + 23 and line-2 bl = window top + 58.
- **Keyframes** (message-1 bl relative to the window top):

  | Keyframe | Bl | State |
  |---|---|---|
  | enter | +26 | opacity 0 (this is the frozen m02/d02 frame) |
  | show-1 | +23 | |
  | swap | stack −92 | message 2 at +23 |
  | exit | message 2 at +15 | opacity 0 |

- **Timing (about 2.5 s, then route to `#/cart`):**

  | Time | Event |
  |---|---|
  | 0–250 ms | title fades out; message 1 fades in and rises 3 px |
  | until 1.1 s | hold |
  | 1.1–1.5 s | slide −92 (ease-in-out) |
  | until 2.3 s | hold |
  | 2.3–2.5 s | message 2 rises 8 px and fades out |

- **QA:** `msg=0` freezes at enter (opacity 0, which equals the PNG); `msg=1` at show-1; `msg=2` at swap.

### 3.22 Toast (new)

- `role="status"` (`role="alert"` for errors), `position:fixed`, horizontally centred, `width:max-content; max-width:min(400px, 100% - 32px)`.
- Style: bg #353535, text `.t-body` 14/20 #fff, `padding:12px 16px`, r 8, `--sh-toast`, `z-index:var(--z-toast)`.
- **Position:**
  - mobile: `bottom:106px` (16 above a bottom bar at 735);
  - desktop: `top:24px`.
- **Variants:**
  - default #353535;
  - error bg #d93025;
  - the code toast shows "სატესტო კოდი: 4821" with the 4 digits in `.num-narrow` 600 weight.
- **Timing:**
  - Enter: opacity 0 → 1 with `translateY(8px)` → 0 (mobile) / `-8px` → 0 (desktop), 200 ms.
  - Auto-dismiss after 4 s (SMS code: 8 s).
  - Hover or focus pauses the timer.
  - One toast at a time; a new one replaces the old.
- **QA:** `toast=1`.

### 3.23 Modal (new; terms "წესებსა და პირობებს")

- Native `<dialog>` opened with `showModal()`.
- **Scrim** (`::backdrop`): `rgb(22 6 74/.55)`.
- **Dialog:**
  - bg #fff, r 20, `--sh-modal`, `width:min(480px, 100% - 32px)`, `max-height:calc(100dvh - 32px)`, `padding:28px 24px 24px`.
  - `display:flex; flex-direction:column; gap:16px`.
- **Title:** `.t-h1` 23/28 600 #000, "წესები და პირობები", with `padding-right:40px`.
- **Close:** `<button aria-label="დახურვა">` 40×40 at top 12 / right 12, `close.svg` #878787 (hover bg `rgb(0 0 0/.06)` circle).
- **Body:** `.t-body` 14/22 #353535, `overflow:auto`. Mock terms text, 3–4 short paragraphs, 12 px apart.
- **Footer:** `.btn` full width "ᲒᲐᲡᲐᲒᲔᲑᲘᲐ"; it closes the dialog and checks the terms box.
- **Behaviour:**
  - Enter: opacity + `scale(.96 → 1)` 200 ms.
  - Esc, the scrim and ✕ close it. Focus goes to the dialog on open and returns to the link on close. Scroll is locked behind it.
- **QA:** `#/register?terms=1`.

### 3.24 Inline error (new)

| Surface | Field style | Message |
|---|---|---|
| Light (auth, add form, card form) | `--b-input-error` | `<p id=… class="err">` `.t-note` 12/16 **#d93025**, left-aligned at the field's outer x, `margin-top:5px` (bl ≈ field bottom + 17.7), `aria-live="polite"`. Pushes the following content down 21 px |
| Register phone field | same | the error **replaces the orange note text and colour in place** (bl field bottom + 28). No layout shift |
| Landing (gradient) | border #ff6b6b + inset 1 px | `.t-body` 14/20 **#ffc2c2**, centred under the input, `margin-top:8px`. The block is 28 tall. Desktop: the button moves down 28. Mobile: the form is bottom-anchored, so the input moves up 28 |
| Login failure | password field error state | "ტელეფონის ნომერი ან პაროლი არასწორია" (or "ამ ნომრით მომხმარებელი არ არსებობს") under the password field |

- **When errors show:** on submit; after a field's first blur; cleared on input.
- **Focus:** on submit, focus moves to the first invalid field.
- **Messages:**

  | Rule | Message |
  |---|---|
  | required | "სავალდებულო ველი" |
  | phone | "შეიყვანეთ ნომერი ფორმატით 5XX XXX XXX" |
  | password | "მინიმუმ 8 სიმბოლო" |
  | email | "არასწორი ელ.ფოსტა" |
  | match | "პაროლები არ ემთხვევა" |
  | code | "შეიყვანეთ 4-ნიშნა კოდი" |
  | terms | "გთხოვთ დაეთანხმოთ წესებს" (under the terms row) |
  | URL | "შეიყვანეთ სწორი ლინკი (https://…)" |

### 3.25 Focus ring

- **Global:** `:focus-visible{outline:2px solid #5e34ec; outline-offset:2px}`; on the landing gradient `outline-color:#fff`.
- Inputs use their focus border instead (`outline:none`).
- Never remove focus styles without a replacement.

---

## 4. Screens

### 4.0 Scaffolds

| Scaffold | Recipe |
|---|---|
| Mobile page `.m-page` | `min-height:100dvh; display:flex; flex-direction:column; max-width:560px; margin-inline:auto; padding-bottom:30px`. bg #f4f4f4 (cart, payment, pay, success), **#fff on auth**, gradient on the landing (full-bleed on `body`) |
| Desktop page `.d-page` | `.container` + header §3.2 + content at y 209 (auth: §4.3). bg #f4f4f4; landing uses the gradient |

### 4.1 Landing `#/` (m00–m02, d00–d02)

**Mobile** (`.landing`):
- `display:flex; flex-direction:column; align-items:center; padding:60px 22px 68px; min-height:100dvh; background:var(--grad-landing-m)`
- Height sum at 735: 60 + 76 + 120 + 172 + 97 + 142 + 68 = 735.

| Element | y | Notes |
|---|---|---|
| Logo white 113×76 | 60–136 | |
| Stage (`position:relative`, 172 tall) | 256–428 | `margin-top:120px` |
| Title (2 lines, `<br>`) | line boxes 256–344, bl **292 / 336** | `position:absolute; top:0` |
| Ticker window | 355–428 (x 17) | stage top + 99 |
| Spacer | 428–525 | `flex:1 1 97px; min-height:24px` |
| Input | 525–585, x 22–406 | |
| Gap | 22 | |
| Button | 607–667 | spinner at (194, 617) when loading |
| Bottom padding | 68 | |

**Desktop** (≥ 900; one-line title in every state):
- `padding-top:60px; background:var(--grad-landing-d)`.

| Element | y | Notes |
|---|---|---|
| Logo 113×76 | 60–136 at x 663 | |
| Stage (100 tall) | 326–426 | `margin-top:190px` |
| Title, 1 line, `nowrap` | line box 326–370, bl **362** (ink centre 349) | |
| Ticker window | 353–426, x 522 | stage top + 27 |
| Form | | `margin-top:99px; width:min(1120px,100% - 80px)`; `align-items:center; gap:22px` |
| Input | **525–585** (x 160–1280) | |
| Button | 360×60 at **607** (x 540) | spinner at (700, 617) |
| Below | free space | top-anchored layout |

States:

| | Empty (m00/d00) | Filled (m01/d01) | Loading (m02/d02) |
|---|---|---|---|
| Title | shown | shown | fades out |
| Store slot | carousel | removed | removed |
| Input text | placeholder at left + 66 | value at left + 20, #505050 | readonly |
| Button | disabled look | solid, label #fff | solid + 40 spinner |
| Ticker | — | — | running |

Enter submits.
- **Invalid URL** (not http(s) with a host): show the on-dark error.
- **Valid URL:** loading state for about 2.5 s, then `#/cart` with the mock product. The store is "eBay" when the host contains "ebay", otherwise Amazon.

Pixel notes:
- d00 is matched in logo and title. Its input and button are 63 px lower than drawn: an accepted, deliberate hybrid.
- d01 differs only in the title (1 line vs 2).
- d02 matches fully.

### 4.2 Cart `#/cart` (m03–m07, d03–d07)

**Pricing** (per product; demo Nike: item 500, weight 100, customs 250, service 100):
- `payable = item + service + (weight unless deferred) + (customs unless deferred)`
- `monthly = Math.ceil(total/4)`
- Checkboxes are **checked by default** (= deferred).
- Product price, monthly and "სულ" update together:

  | Deferred | Total | Monthly |
  |---|---|---|
  | both | 600 | 150 |
  | weight only | 850 | 213 |
  | customs only | 700 | 175 |
  | none | 950 | **238** (not the drawn 235) |

**Mobile** (`.m-page` `padding:15px 14px 30px`):

| Element | Box / bl (m03) | Open (m07, our values) |
|---|---|---|
| Card (header + products) | 14,15 400×256. From the outer edge: left 20, right 19, bottom 36 (16 when a breakdown is open). CSS `padding:0 18px 35px 19px` | 15–409 |
| Add header | icon (37,47) 43², heading bl 77.4 | |
| Divider | y 136.5, x 34–395 | |
| Product row | thumb (34,170) 65²; title bl 190; price bl 230; toggle bl 226.1, caret box (303,209); ✕ box (371,196); badge centre (33.5,234.5) | breakdown box 98,243 297×150 |
| Summary card | 14,290 400×166 (§3.14a): "ᲯᲐᲛᲘ" bl 340.3, monthly bl 383/381.1, "სულ" bl 425.1 | 14,428 (gap 19; design 429) |
| Checkboxes | `.check--cart`, list `margin-top:34px; padding-left:10px`: boxes (24,490), (24,524); labels x 57, bl 505.1 / 539.1 | boxes 628 / 662 |
| Bottom bar | 645–705: "ᲗᲐᲕᲘᲓᲐᲜ ᲓᲐᲬᲧᲔᲑᲐ" (box 18.5–198.5) + "ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ" (218–398) | 720 (design 721); the page scrolls |

**Desktop:** grid at y 209, ≥ 1180: `minmax(0,1fr) 455px`, gap 20.

| Element | Box / bl (d04) |
|---|---|
| Back link | (160,22), bl 39 |
| Logo | (663,60) |
| Left column | `flex-direction:column; gap:20px`: add tile 160,209 645×97 (label bl 285.1, icon 461,218) → product card 160,326 645×108 |
| Product card | thumb (177,342) 73²; title bl 365; price bl 405; toggle bl 401.1, caret box (460,384); ✕ box (748,368.3); badge centre (177,414) |
| Product card, open (d07) | divider y 428; rows bl 460.1 … 564.1 (pitch 26); card bottom 585 |
| Summary card | 825,209 455×305 (§3.14b): header bl 259.3 / 253.1 / 256.0; "სულ" bl 298.1; divider 332; checkboxes 348 / 377 (labels x 893, bl 363.1 / 392.1); button 845,434 415×60 (label bl 470.1) |
| d03 (QA `addTile=below`) | product card at 209, light tile at 336.6 (card bottom + 20); every product-card child −117 |

Continue → `#/register` if not authenticated, else `#/payment`.

### 4.3 Auth (m08–m11, d08–d11)

**Mobile** (`.m-page`, bg **#fff**, `padding-inline:32px 35px` for the form):
- Heading `.t-h1` centred, line box 34–62 (bl **57**). First field at **106**.
- Bottom group:

  | Element | y |
  |---|---|
  | Checkbox row (if any) | box 597–615 |
  | Gap | 30 |
  | Bar | 645–705 |
  | Bottom | 30 |

  The spacer above the group has a 32 minimum.

| Screen | Fields and rows (box tops / baselines) | Bar button |
|---|---|---|
| Register m08 | name row `grid 1fr 1fr; gap:16px` at 106 (32–204.5 / 220.5–393); phone 172; note bl 250 (`.t-note` #ff9900 at x 32; `margin:15.3px 0 15.7px`); password + eye 269; email 335; prompt row right-aligned, bl **428** (email bottom + 43); checkbox `.check--auth` (32,597) terms label bl 610 | ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ |
| Login m09 | phone 106; password + eye 172; link "პაროლის აღდგენა" right-aligned bl 260 (+38); register prompt right-aligned bl 300 (+40); checkbox (32,597) "პაროლის დამახსოვრება" | ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ |
| Recover m10 | phone 106 (x 32 with the unified padding; drawn at 34) | ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ |
| Code m11 | code 106; resend link left-aligned bl 187 (+31); divider #bcbcbc y 206 (bl + 19); new password 227 (divider bottom + 20); confirm 293; no eyes | ᲐᲦᲓᲒᲔᲜᲐ |

**Desktop:** bg #f4f4f4.
- Back link and logo as §3.2.
- Heading `.t-h1` centred, line box 179–207 (bl **202**).
- Form `width:360px; margin-inline:auto` (x 540–900), first field at **251**.
- Field y = mobile y + 145, except the rows below. The name-row gap is **20** (170 + 20 + 170).
- The button is inline: 360×60, label bl = top + 36.

| Screen | Differences from mobile + 145 |
|---|---|
| Register d08 | prompt bl **553** (email bottom 530 + 23); checkbox (540, **620**) = prompt bl + 67; button **668** (checkbox bottom + 30) |
| Login d09 | recover link bl 405; register prompt bl 445; checkbox (540, **522**) = prompt bl + 77; button **555** (checkbox bottom + **15**, frame-exact) |
| Recover d10 | phone 251; button **331** (+30) |
| Code d11 | link bl 332; divider 351; inputs 372 / 438; button **518** (+30) |

Behaviour (brief):
- **Validation:** phone `5XX XXX XXX`; password ≥ 8; e-mail; required names; terms checked; passwords match; code = 4 digits.
- **Mock backend:** users in localStorage.
- **Recover:** "send code" shows the code toast and goes to `#/recover/code`. The resend link has a 30 s cooldown. "ᲐᲦᲓᲒᲔᲜᲐ" goes to `#/login` with a success toast.
- **Register / login success:** `#/payment`.

### 4.4 Payment `#/payment` (m12–m15, d12–d15)

**Mobile** (`.m-page`, bg #f4f4f4):

| Element | Closed (m12) | Open (m15) |
|---|---|---|
| Header (§3.14d) | "ᲯᲐᲛᲘ" / "600₾" bl 62; toggle bl 85 | same |
| Details box | — | 14,99 400×150 (pay-m), rows bl 127 / 153 / 179 / 205 / 231 |
| Method cards | 14,117 / 237 / 357, each 400×100, gap 20 (`margin-top:25px` after the toggle row) | 259 / 379 / 499 (box bottom + 10) |
| Notes | bl 490 / 514 (first line box `margin-top:15.6px` after card 3) | bl 632 / 656 |
| Bottom bar | 645–705: ᲣᲙᲐᲜ + ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ | 693–753 (scrolls) |

**Desktop** (grid at 209; ≥ 1180: `minmax(0,645fr) minmax(0,455fr)`, gap 20):

| Element | Closed (d12) | Open (d15) |
|---|---|---|
| Methods | `grid repeat(3,1fr); gap:21px`: cards 160 / 382 / 604 × 209, 201×278. Logo top 250.7; title bl 334.3 / 353.3; subtitle bl 386.3 / 404.3; radio 24-box 423.3 | unchanged (278) |
| Summary | 825,209 455×278 (§3.14c); header bl 259; toggle bl 288; divider 323; notes bl 347 / 371; button 407 | 455×440: box 320–470, divider 489, notes bl 513 / 537, button 569 |

Selection changes only the card fill, border and radio. Continue → `#/pay`.

QA: `#/payment?demo=1&method=bog|tbc|mere&details=0|1`.

### 4.5 Card form `#/pay` (m16, d16)

- **Mobile:**
  - Card §3.20 at top 55, x 29.5.
  - **Added:** bottom bar with only the left "ᲣᲙᲐᲜ" text button (at 645 at 735; spacer minimum 24 below the card). It is not drawn; the brief requires back navigation.
  - No logo.
- **Desktop:**
  - Logo; back link added (160, 22) → `#/payment`.
  - Card 540,209 360×365.
- **Submit:** validate, process (1.2 s), then `location.replace('#/success')`.

### 4.6 Success `#/success` (m17, d17)

**Mobile** (bg #f4f4f4, no logo, no back affordance):

| Element | Value |
|---|---|
| Receipt | full-bleed 0–428 from y 0, `padding:50px 34px 0`, valley at **411.68**, tips 420, mobile shadow |
| Header | `display:flex; gap:25px; align-items:flex-start`. Badge 70 at (34,50). Text column `padding-top:8px`: title `.t-h-caps` #5e34ec (box 58–78, bl 76); pill `margin-top:10px` (88–107, bl 102); order line `margin-top:5px` 14/14 (box 112–126, bl 125) |
| "ᲗᲥᲕᲔᲜᲘ ᲨᲔᲙᲕᲔᲗᲐ" | box 155 (header bottom 126 + 29), bl 173 |
| Item row | `display:flex; align-items:center; height:20px`, top 201 (h1 bottom + 26). Name `flex:0 1 244px` (bl 216); spacer `flex:1; min-width:31px`; "1x" 18/20 #9e9e9e (ink 308–327.5); gap 19.5; "600 ₾" 18/20 700 #505050 `.num-narrow-bold` (ink 347–393.1, bl 218) |
| Notes | 14/22 #9e9e9e, first bl = name bl + 29 → **245 / 267** |
| "ᲒᲐᲓᲐᲮᲓᲘᲡ ᲛᲔᲗᲝᲓᲘ" | bl 331 (last note bl + 64; with no notes, 45 below the item row box) |
| Method line | bl 362 (+31): prefix #9e9e9e + value #000 |
| Receipt bottom | method line box bottom 363 + 48.7 = valley 411.68 |
| "ᲨᲔᲯᲐᲛᲔᲑᲐ" | `.t-h-caps-reg` 24/24, x 34, box 450 (tips + 30), bl 472 |
| Rows | `display:grid; grid-template-columns:1fr auto 54px; column-gap:26px; padding:0 37px 0 34px`. Row 1 (16/20): "თვეში" #000 · "4x" #9e9e9e (ends 311) · "150₾" #353535 left-aligned at **337**; box 508, bl 524 |
| Divider | 1 px #c9c9c9, `margin:21px 20px 0` after the 20 px row-1 box (x 20–408, y 549) |
| Row 2 (20/20) | "სულ" #000 · "600₾" #353535 at 337; `margin-top:22px` → box 572–592, bl 590 |
| Button | `.btn` "ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ", `margin:43px 22px 40px` → 22,635 384×60 |

**Desktop** (column `width:550px; margin:0 auto`, x 445–995):

| Element | Value |
|---|---|
| Logo | (663,60) |
| Receipt | top **209**, `padding:29.5px 20px 0`, no shadow, valley **600.34**, tips 611 |
| Header | `align-items:center`. Badge 75 at (465,238.5). Title bl 255; pill (565,268) bl 282; order bl 311 (title → pill 11, pill → order 11) |
| h1 | bl 375 (box 357 = header bottom 313.5 + 43.5) |
| Item row | bl 418 (name) / 419 (qty, price). "1x" ink 869–888.5; price ink 908–954.1 (right inset 40.9 → row `padding-right:21px` inside the receipt's 20) |
| Notes | bl 453 / 474 (pitch 21) |
| h2 | bl 533 |
| Method line | bl 566 |
| Receipt bottom | method line box bottom + 33.3 = valley |
| "ᲨᲔᲯᲐᲛᲔᲑᲐ" | at **x 445** (flush with the column), box 648 (tips + 37), bl 670 |
| Rows | `grid-template-columns:1fr auto auto; column-gap:26px; padding:0 21px 0 20px`, values **right-aligned** (ink end 973.7). Row 1 bl 735 (heading bottom + 49) |
| Divider | full 550 at 760 |
| Row 2 | bl 801 |
| Button | 550×60 at (445,851) |

Content:
- **Date:** today as `D <თვე> YYYY` (იანვარი, თებერვალი, მარტი, აპრილი, მაისი, ივნისი, ივლისი, აგვისტო, სექტემბერი, ოქტომბერი, ნოემბერი, დეკემბერი).
- **Order ID:** `#` + 6 random digits.
- With **`demo=1`** the design's fixed values are used ("15 თებერვალი 2025", "#112233") so screenshots match.
- One item row per product; several products are 18 px apart.
- "ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ" resets the state and goes to `#/` (replace).

### 4.7 QA hooks → frames

| URL (`index.html` + …) | Frame |
|---|---|
| `#/` · `#/?url=https://www.amazon.com/Xbox-Core-` (m) / `…Xbox-Core-Wi` (d) · `…&loading=1&msg=0&anim=0` | m00/d00 · m01/d01 · m02/d02 |
| `#/cart?demo=1` · `&weight=1&customs=0` · `&weight=0&customs=1` · `&weight=0&customs=0` · `&details=1` · `&addTile=below` · `&add=1` | m03/d04, m04/d04*, m05/d05*, m06/d06*, m07/d07, d03, open-form state. *Desktop prices follow the logic, not the frozen drawn 600 |
| `#/register` · `#/login` · `#/recover` · `#/recover/code` · `&terms=1` · `&err=1` | m08–m11 / d08–d11, modal, validation errors |
| `#/payment?demo=1&method=bog\|tbc\|mere&details=0\|1` | m12–m15 / d12–d15 |
| `#/pay?demo=1` · `#/success?demo=1` | m16/d16 · m17/d17 |
| `anim=0` (any) · `toast=1` (any) | freeze motion · sample toast |

In the cart, `weight`/`customs` = 1 means deferred (checked). `demo=1` seeds the Nike product and a logged-in demo user. Screenshots must wait for `document.fonts.ready`.

---

## 5. Inconsistencies: resolved decisions

### Global and cross-spec

1. **Radius:** the JSON `r_est` (3.6/4.0) and the brief's "≈4" are wrong → **8 px** on every card, button, input, tile, thumbnail and box (checkbox 2, pill 4, card-form card 20).
2. **Payment card border [re-measured]:** [`spec_payment.md`](specs/spec_payment.md) described a 2 px centred ring (1 px outside, `box-shadow` recipe). Renders show 1 px **inside** on m12, d12 and m03 alike → `border:1px` inside for every card. Drop the box-shadow ring.
3. **Cart breakdown digits [re-measured]:** [`spec_cart.md`](specs/spec_cart.md) said "8.9 px Georgian-face digits raised 1.2 px". They are Noto Sans 14 px on the baseline (ink 10.4 px, bottom at bl) → no 12.5 px hack.
4. **Breakdown bold row weight [re-measured]:** advance fit gives NSG SC **700** (error 0.01 px vs 0.16 for 600) → total row 700.
5. **Button labels and fills #fdfdfd vs #fff** → **#fff** everywhere (2/255).
6. **Near-identical neutrals merged:**
   - #f1f1f1 → #f4f4f4
   - #e6e6e6, #eaeaea → #e7e7e7
   - #a3a3a3 → #a6a6a6
   - #848484 → #878787
   - #fdfdfd → #fff
7. **JSON `texts[].color` = #000** for the title, labels, loading text and subtitles is an extraction default. Use the glyph fills in §2.2.
8. **PNG renders are 1 level darker** (ICC) → tokens use vector values; QA tolerance ≥ 2.
9. **Logo position and asset:**
   - Landing spec uses `pdf/svg/logo_*.svg` (130×90 at 149/655, 52); the icon spec uses `assets/icons/logo-*.svg` (113×76 at 157/663, 60). Same ink → use the **assets/icons** files at (157|663, 60).
   - The icon spec's d00 logo at y 64 (and its amazon slot at 467) come from the wrong d00 origin. They are 60 and 463.
10. **d00 frame origin** is 3718 → subtract 4 from all d00 JSON/PNG values; compare against `land_d00_true_origin_3718.png`.
11. **Mtavruli:** `text-transform:uppercase` does not produce Mtavruli in Chromium → literal U+1C90 strings (§2.5) or JS `toUpperCase()`. The spec data stores them lowercase. The run-fit flags for "აღდგენა" and "გადახდა" (600/500, non-MT) are misfits: they are MT 400.
12. **Digit widths vary between frames** → per-location table §2.4 (default normal; narrow on success, desktop payment header, payment details, desktop cart "სულ" and title).
13. **Radio and checkbox colours** are M3 defaults (#65558f / #49454f), not brand purple → keep as designed.
14. **Bottom-bar left button box:** 18.5 (cart), 18 (payment), grid 1fr 180 (auth) → one recipe (§3.17) with the box at 18.5–198.5, label centre 108.5 (every frame's ink centre).
15. **Checkbox label offset differs by context [re-measured]:** cart gap 15 / bl + 15.1; auth gap 8 / bl + 13 → two variants `.check--cart`, `.check--auth`.
16. **Deferred-row style:**
    - [`spec_cart.md`](specs/spec_cart.md) proposed striking label + amount in #a6a6a6 at 1 px.
    - The designed treatment (m15/d15) strikes the **value only**, 0.7 px, label unstruck, total = payable.
    - → use the designed treatment in both breakdowns.
17. **Hover and active colours** varied per spec (#6a43f0, #5630d9, #5129df, #5129e0 …) → one set: hover #5129e0, active #4820cc, link hover #4820cc, text-button wash .08.
18. **Mobile max width:** 560 (cart, payment, landing) vs 428 (auth) → **560** for every mobile screen.
19. **Desktop container gutter:** 64 (cart), 80 (payment), clamp (landing) → `min(1120px, 100% - 80px)`.
20. **Typed-text colour:** landing #505050 (designed); auth, add form and card form #000 (card spec's #1a1a1a dropped).
21. **Placeholder colour on light surfaces:** #bcbcbc (auth design). It is also used for card-form focus placeholders and the add form (card spec's #ababab dropped). Landing keeps #ababab.
22. **Spinner size in non-landing buttons:** card spec suggested 20 px with a 2.5 px stroke → **24 px** scaled `spinner.svg` everywhere except the landing (40).
23. **Card-form label typography:** card spec Inter 500 14.3 #7b7b7b vs font spec Inter 600 14.5 #858585 → **Inter 600 14.5** (overlay-validated `.t-card-label`), colour **#7b7b7b** (darkest raster ink is 121, and it reuses the note token).
24. **Landing title box:** landing spec put the line-box top at 257 with the baseline 35 below. Font metrics give 35.97 → line box **256** (mobile) / **326** (desktop) to land bl 292 / 362.
25. **Ticker baseline:** "bl = window top + 23" is a window relation, not a CSS line box → stack offset −4.59 px inside the window (§3.21).
26. **Underline 0.7 px** is sub-pixel → `text-decoration-thickness:from-font` (`.t-link`); renders about 1 device px.
27. **Placeholders use the normal-width (wdth 100) Georgian face** while the UI is SemiCondensed → reproduce via `.t-input` / `--font-input`.
28. **URL slash from Noto Sans Math** (Figma fallback) → keep (`--font-input`). SemiCondensed spaces inside Latin product names → keep (fonts.css default).
29. **Fonts from CDN** (jsDelivr + Google Fonts) with fallbacks are acceptable per the brief; no self-hosting.

### Landing

30. **Desktop title** 1 line (d00) vs 2 lines (d01) → **1 line** (brief). Ink centre stays at y 349.
31. **Desktop input/button y:** 462/544 (d00) vs 525/607 (d01/d02) → **525/607 in all states** (no jump on the first keystroke; matches d01/d02 and mobile).
32. **m02 button** shrinks to 380 at x 24 → keep 384 at 22 (Figma slip); 60.34 → 60.
33. **Loading messages** are invisible in m02/d02 (opacity 0, default black) → white, in the 395×73 window at 355 / 353; `msg=0` reproduces the frame.
34. **Message 2's hard break** vs message 1's natural wrap → explicit `<br>` in both, on both breakpoints.
35. **Store icon:** the brief says "switch to eBay when the URL contains 'ebay'", but the design hides the icon once anything is typed → carousel (amazon ↔ eBay, starting on amazon) only while empty; removed when non-empty; "ebay" only sets the product's store.
36. **Filled URL strings differ** per breakpoint → QA seeds per-breakpoint strings; mobile `padding-right:6px`.
37. **Brief's "2 px border, 386×62"** → 1 px inside 384×60 (1120×60).
38. **Gradient angle** differs per breakpoint → 161.68° (< 900) / 172.19° (≥ 900), stops 1.95% / 99.8%.
39. **Disabled button** is fill 50% + label 50% separately, not group opacity.

### Cart

40. **d04–d06 show frozen 600/150** → computed: 850/213, 700/175, 950/238.
41. **m06 monthly 235** → **238** (`Math.ceil`; equals `Math.round` for every designed case).
42. **m07/d07 breakdown** lists all rows unstruck with ჯამი 950 while the card says 600 → deferred amounts struck (#16) and ჯამი = payable (600).
43. **Add-product element:** d03 light tile below; d04–d07 purple tile above; mobile header inside the card → **purple tile above** (desktop), header (mobile); d03 look = open-form palette; QA `addTile=below` reproduces d03.
44. **m07 card shifted 1 px right and card gap 20** → x 14, gap 19 everywhere.
45. **"დაახ." (mobile cart) vs "დაახლოებით" (desktop cart)** → keep per breakpoint. Payment uses "დაახ." on both, as drawn.
46. **Breakdown container:** mobile box vs desktop divider → per breakpoint.
47. **Breakdown orientation:** cart is amount-first, payment is label-first → **keep per screen** (frame-faithful; one component with an `--amount-first` modifier).
48. **Typed-hyphen leaders** give ragged ends and an extra space in row 1 → CSS dash leader; labels/values aligned (cart m 381.5, d 784; payment m 382, d 1246).
49. **Desktop details divider** 271–783 vs rows 269–784 → align the divider to the rows (≤ 2 px).
50. **Summary amount order and alignment** reversed between breakpoints → keep per breakpoint (§3.14a/b).
51. **Checkbox placement:** mobile on the page below the summary (pitch 34) vs desktop inside the summary (pitch 29) → per breakpoint.
52. **Thumb and badge:** 65/27 mobile, 72.6/29.7 desktop → 65/27 and **73/30**.
53. **Literal " ..." in the product title:** store the demo name literally. Ellipsis `max-width:244px` (the designed string's advance is 241.96 px, so 242 would risk clipping it).
54. **"4 თვეში" baseline offset:** mobile baseline-aligned, then −2 px; desktop centred row (ink centres ≈ 248).
55. **Mobile ✕** is 5.5 px below the thumb centre; desktop ✕ is centred on the closed card → per breakpoint.
56. **Hidden #000 rects** (m07 frame, under the d03/d04 card) → ignore; no shadows.

### Auth

57. **Mobile form x/width** varies (32/361, 34/361, 34/360) → `padding-inline:32px 35px` on all four (m10/m11 shift ≤ 2 px).
58. **Name widths 173/172** → `1fr 1fr` (desktop gap 20, 170 + 170).
59. **"გვარი" placeholder 2 px high; d09 placeholder x 557; eye inset 15.5–17.5** → uniform: placeholder bl = top + 31, text inset 16, eye box right = field right − 16.
60. **Desktop "პირადი ინფორმაცია" 1.8 px right of centre** → `text-align:center`.
61. **Login prompt double space, no "?"** → single space, no "?" (brief's copy).
62. **Register prompt spacing 43 (m) / 23 (d)** → frame-exact per breakpoint.
63. **d08 vs d09 desktop spacing** (prompt → checkbox 67/77, checkbox → button 30/15) → frame-exact per screen.
64. **Recover button** "კოდის გაგზავნა" (m) vs "კოდის გამოგზავნა" (d) → **ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ** everywhere (brief).
65. **Typo "პაროლის გამოერება"** → **პაროლის გამეორება** (brief).
66. **No eye on recover-code password fields** → as designed (no eye).
67. **Mobile auth bg white** vs #f4f4f4 elsewhere → follow the frames.
68. **Login heading reuses "პირადი ინფორმაცია"** → keep (frames m09/d09).
69. **Placeholder-only fields** → visually hidden `<label>`s.
70. **Auth input stroke** is centred on the Figma box edge (±0.5) → CSS 1 px inside the same box (desktop 1× shows one full-tone pixel instead of two half-tones).

### Payment

71. **Card title x** 170 (cards 1–2) vs 167 → **167**.
72. **Unselected fill #fdfdfd / #fff** → #fff.
73. **Mobile details box 401 wide** → 400.
74. **Header total tracking** (+0.8 px in m12–m14) → none.
75. **Header right edge:** mobile total 382 / toggle 391; desktop 1260 / 1262 → reproduce per breakpoint (mobile `padding-right:46px` + toggle −9; desktop toggle −2).
76. **Desktop open state** shifts notes +166 but the button +162 → button margin 36 closed / **32 open** (frame-exact; summary 440).
77. **m15 bottom bar +1 px x** → ignore (218).
78. **Strike line height** differs over digits vs ₾ → one CSS line-through, 0.7 px.
79. **Subtitle breaks not width-driven** → explicit `<br>`; desktop title `<br>` before "ᲒᲐᲓᲐᲮᲓᲐ".
80. **Bank logo sizes 80–81.4 × 48.7–49.6** → 81×50 `object-fit:contain`.
81. **Spacing around the details box** (m 14/10, d 32/19) → per breakpoint.
82. **Mobile payment header figures** normal (m12–m14) vs narrow (m15) → normal on mobile, narrow-bold on desktop.
83. **Nothing deferred** (not designed) → hide the notes (and the desktop divider); button 36 below the toggle row (desktop); mobile bar unchanged.
84. **900–1179 px** (not designed) → methods row full width, summary below (max 455, right-aligned).

### Card form and success

85. **Raster scaled ×1.1907** → crisp rebuild with the measured values (§3.20); 40.5 inputs, 14.5 labels, 28.5×19 badges.
86. **Card width and shadow** differ (369/28.6 vs 360/24.4) → per breakpoint (frame-faithful).
87. **English labels and "order ID:"** in a Georgian UI → keep as designed.
88. **Skeleton bars** instead of placeholders → bars while empty and unfocused; real placeholders on focus.
89. **No back affordance on m16/d16** → add the desktop back link and the mobile "ᲣᲙᲐᲜ" bottom-bar slot (brief requires back on inner screens). Success: none (terminal; arrive via `location.replace`).
90. **Success values** left-aligned at 337 (m) vs right-aligned (d) → per breakpoint.
91. **Item price right inset** 34.9 (m) / 40.9 (d) differs from the summary edge → keep as designed.
92. **Desktop "ᲨᲔᲯᲐᲛᲔᲑᲐ" flush at 445** while rows are at 465; mobile shares 34 → keep.
93. **Mobile insets** (divider 20, button 22, text 34, receipt full-bleed) → keep.
94. **Vertical rhythm drift** m17 vs d17 (note pitch 22/21, header gaps 10·5 vs 11·11, etc.) → per breakpoint tables (§4.6).
95. **Item-row baseline offset** (name 2/1 px above the numbers) → `align-items:center` with 20 px line boxes.
96. **Item name truncation ≈ 242 px** even on desktop → `max-width:244px` on both (see #53).
97. **₾ spacing** "600 ₾" vs "150₾" and two ₾ shapes → keep spacing per location; one font for both.
98. **Mobile item block x 35** vs 34 → 34.
99. **Date pill padding asymmetric** (4 / 6) → `padding:0 6px 0 4px`.
100. **Success badge strokes don't scale** → two SVGs (70 / 75).
101. **Zig-zag tooth size** differs → "32 teeth across" (`background-size:calc(100%/32) 100%`).
102. **Mobile receipt shadow straight-edged; desktop none** → as designed.
103. **Brand badges** exist only as a blurry raster (Amex shows a cropped pattern) → redrawn SVGs (`card-*.svg`, clean AMEX wordmark); position and size exact, artwork approximate.
104. **Plus-circle and unchecked checkbox** appear in the JSON as clipped centre strokes (49/6 px, 22/4 px) → visible 43 px ring with a 3 px inner stroke; 18 px box with a 2 px inside border.
105. **Success date and ID** are dynamic per the brief, but the frames show fixed values → dynamic normally; `demo=1` uses "15 თებერვალი 2025" / "#112233" for pixel QA.
106. **Narrow screens (320–380):**
     - the success title wraps (LH 24) and item names ellipsize;
     - the card-form 2-column row stays 2-up (inputs 95 px each at 320);
     - the bottom-bar left label may wrap.

---

## 6. Remaining product calls (defaults already chosen above; change only if the owner objects)

- Login heading copy (kept "პირადი ინფორმაცია") and the login prompt's missing "?" (kept, per the brief).
- Cart breakdown orientation: kept frame-faithful (amount-first in the cart, label-first in payment). Unify to label-first if the owner prefers consistency over m07/d07 parity.
- d09's 15 px checkbox → button gap and the 43/23 register prompt spacing: kept frame-exact; normalising them is a one-variable change.
- Error copy (§3.24), terms modal text and toast durations are new; they need sign-off from a Georgian copywriter.

# SlicePay — working HTML prototype: master brief

Goal: turn the Figma design "slice pay" (exported to one big PDF canvas) into a pixel-faithful, fully **working**
HTML/CSS/JS web app (no build step, no framework, must open by double-clicking `index.html` via file://).
UI language is Georgian. Two designed breakpoints: **mobile 428×735** and **desktop 1440×1024**.

## Key paths
- SCRATCH = the original build session's temporary scratchpad (no longer available; paths under SCRATCH/ are historical, except the ones that moved into this repo — see "Project structure" in the top-level README.md)
- PROJECT = the repository root (deliverable goes here)
- Source PDF: ../design/source/slice-pay.pdf  (ONE page, 10078×8994 pt canvas; Figma export; text glyphs are vector paths in Type3 fonts — font names are NOT recoverable from the PDF)
- Rendered frames: ../../tests/fixtures/frames/  — mobile `mNN_*.png` rendered at 2× (856×1470 px = 428×735 pt); desktop `dNN_*.png` at 1× (1440×1024)
- Per-frame machine spec: SCRATCH/pdf/spec/<name>.json  (index: spec/index.json). Each has:
  - `frame` [x,y,w,h] on the PDF canvas
  - `drawings`: every vector item intersecting the frame, coords RELATIVE to frame (pt == CSS px): x,y,w,h, fill / stroke colors, stroke_w, fill_opacity, `r_est` (rough corner radius), ops. Text glyph runs also appear here as filled paths with many ops (that is how text color is known).
  - `images`: raster placements (xref 8 = product photo, 74 = bank-logo sprite, 20/26/44/88 = card-form screenshot + shadow masks)
  - `texts`: decoded Georgian strings with x,y (top-left of the line box), size (font size in px), `color` (from matched glyph paths), `glyph_box` (the actual ink box)
- Helper scripts (python3 + PyMuPDF installed): SCRATCH/pdf/draw2svg.py `python3 draw2svg.py <name> x0 y0 x1 y1` (ABSOLUTE canvas coords) → SCRATCH/pdf/svg/<name>.svg (vector paths; no clip/mask/gradient support). To render any canvas region to PNG: `fitz.open(pdf)[0].get_pixmap(matrix=fitz.Matrix(s,s), clip=fitz.Rect(...)).save(...)`.
- Screenshot tool (Playwright, already installed): `node tests/visual/shot.js <url> <out.png> <width> <height> [scale] [fullPage 1/0]` (run from the project root after `npm install`; a `#/hash` URL is resolved against index.html). PIL is available for image diffs.
- Figma MCP is rate-limited/exhausted — do NOT call Figma tools.

## Frame map (name → what it shows)
Mobile (428×735):
- m00_landing_empty, m01_landing_filled, m02_landing_loading
- m03_cart_both_deferred (both checkboxes on → total 600 / 150 monthly), m04_cart_variant850, m05_cart_variant700, m06_cart_variant950 (price variants as checkboxes change), m07_cart_price_details_open (product "ფასი დეტალურად" expanded)
- m08_register, m09_login, m10_recover_phone, m11_recover_code
- m12_payment_bog, m13_payment_tbc, m14_payment_mere (selected method variants), m15_payment_details_open
- m16_card_form, m17_success
Desktop (1440×1024): d00..d02 landing (empty/filled/loading), d03..d07 cart (d07 = details open), d08..d11 auth, d12..d15 payment (d15 details open), d16 card form, d17 success.
Ignore: the dark "Your order" Glovo screenshot (x≈5727) — it is a reference image, not part of the product; the dashed component boxes at the top-left of the canvas (x<1010) contain the logo + amazon/ebay icons.

## Known design tokens (measured from the PDF)
- Primary purple `#5e34ec` (buttons, links, focus border on landing input, back arrow)
- Logo: icon + "Slice" `#5e34ec`, "Pay" `#8a50fc` (on light screens); all white on the landing gradient
- Page bg on inner screens `#f4f4f4`; cards white, card border `#d3d3d3` 1px, card radius ≈4px
- Light purple fill `#f3efff` (selected payment card bg, "add product" tile on d03)
- Checkbox checked fill `#65558f` with white check, 18×18, radius ≈1–2
- Text: primary `#000`, strong gray `#353535` (amounts), mid gray `#666666` ("ფასი დეტალურად", secondary), light gray `#878787` ("4 თვეში", close X), placeholder `#ababab`, caret `#79747e`, count badge circle `#767676` with white border
- Orange hint text (register phone note) ≈ `#ff9900`-ish — verify from spec JSON
- Landing gradient (sampled): top-left `#330eb0`, top-right `#2f0da1`, mid `#270b86`/`#220975`, bottom-left `#1a075b`, bottom-right `#15064a` → roughly `linear-gradient(~170deg, #330eb0, #15064a)`
- Landing input: white, 2px `#5e34ec` border (outer 386×62 incl. border), radius ≈4; disabled button = `#5e34ec` @50% opacity with white @50% text; enabled = solid `#5e34ec`
- Buttons: height 60, radius ≈4–8 (verify), label in **Mtavruli (Georgian capital letters)**; mobile bottom bar: text-button "თავიდან დაწყება"/"უკან" (purple Mtavruli) left + primary 180×60 button right
- Bank logos: PROJECT/assets/img/{bog-nawil-nawil,tbc-ganawileba,mere}.png (rounded, transparent corners); product photo PROJECT/assets/img/product-nike.jpg; store icons PROJECT/assets/img/{amazon,ebay}.png; logos as clean SVG in SCRATCH/pdf/svg/{logo_color,logo_white}.svg

## Typography (to be confirmed by the font agent)
- Latin + digits + ₾ look like **Noto Sans** (or Open Sans).
- Georgian body text: close to Noto Sans Georgian but NOT identical; headings ("ჯამი", "პირადი ინფორმაცია", landing title) use a distinct bold face; many labels/buttons are rendered in **Mtavruli** (ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ). FiraGO does not match. Candidates to test: BPG Arial / BPG Arial 2009, BPG Nino Mtavruli, BPG Glaho, BPG Mrgvlovani (+Caps), Noto Sans Georgian, DejaVu Sans, Helvetica Neue LT GEO …
- Mtavruli rendering in CSS: either the font's caps variant, or `text-transform: uppercase` on Georgian text with a font that has Mtavruli glyphs (U+1C90–U+1CBF), or literal Mtavruli code points.

## Product behaviour (the "working" part) — authoritative
Single-page app with hash routing; state persisted in sessionStorage; all data mocked locally (no network calls except fonts).
1. **Landing** `#/` — white logo, title "გამოიწერე ნაწილ-ნაწილ" (desktop: one line; mobile: two lines), URL input with store icon (amazon by default; switch to eBay icon when the URL contains "ebay"; icon hidden once text is typed, as in the filled frames), placeholder "ჩაწერეთ ლინკი...". Button "შემოწმება": disabled-look while empty/invalid; on submit with a valid http(s) URL → loading state: button shows a white spinner, and the title area cycles the messages "ვამოწმებთ პროდუქტის დეტალებს" → "ვამუშავებთ ინფორმაციას" (white, they replace the title, fade) for ~2.5 s → go to cart with the parsed product. Invalid URL → inline error (not designed; keep it subtle and on-brand). Enter key submits.
2. **Cart** `#/cart` — product list + "დაამატე სხვა პროდუქტი" (add product: opens an inline URL field inside the tile/card with the same validation + short loading, then appends a new mock product). Each product card: photo (73×73 radius) with count badge, title (ellipsis), displayed price, "ფასი დეტალურად" + caret toggles the breakdown (ნივთის ფასი / წონის დაახ. ფასი / განბაჟების დაახ. ფასი / მომსახურების ფასი / ჯამი, dotted leaders), X removes the product (if the cart becomes empty → back to landing). Summary card: "ჯამი", monthly amount + "4 თვეში", "სულ <total>". Checkboxes "წონის თანხას მოგვიანებით გადავიხდი" and "განბაჟების თანხას მოგვიანებით გადავიხდი" (both checked by default) — deferred parts are excluded from totals and shown struck-through in breakdowns. Pricing per product: item 500, weight 100, customs 250, service 100 for the Nike demo product → payable = item + service + (weight unless deferred) + (customs unless deferred). Monthly = payable / 4 rounded to integer (design shows 850→213). Continue → `#/register` if not authenticated, else `#/payment`. Mobile: "თავიდან დაწყება" resets everything and returns to landing.
3. **Auth**: `#/register` (სახელი, გვარი, ტელეფონის ნომერი + orange note, პაროლი with eye toggle, ელ.პოსტა, "გაქვს ანგარიში? გაიარე ავტორიზაცია" → login, terms checkbox "გავეცანი და ვეთანხმები წესებსა და პირობებს" where the underlined part opens a small terms modal, continue) ; `#/login` (ტელეფონის ნომერი, პაროლი + eye, "პაროლის აღდგენა" link → recover, "თუ არ გაქვს ანგარიში დარეგისტრირდი" → register, "პაროლის დამახსოვრება" checkbox, continue) ; `#/recover` (phone → "კოდის გამოგზავნა") ; `#/recover/code` (აქტივაციის კოდი, "კოდის ხელახლა გამოგზავნა" link with a 30 s cooldown, divider, ახალი პაროლი, password confirm, "აღდგენა" → back to login with a success toast). Validation: Georgian mobile `5XX XXX XXX` (9 digits starting with 5; auto-format with spaces; optional +995 prefix), password ≥ 8 chars, valid e-mail, required names, terms must be checked, passwords must match, code = 4 digits. Mock backend: users stored in localStorage; the "SMS code" is shown in a toast (e.g. "სატესტო კოდი: 4821"). Login fails with a clear message when the phone is not registered / password wrong. Design typo: "პაროლის გამოერება" → use the correct "პაროლის გამეორება". Mobile recover button text is "კოდის გაგზავნა", desktop "კოდის გამოგზავნა" — use "კოდის გამოგზავნა" everywhere.
4. **Payment method** `#/payment` — header "ჯამი" + total + "ფასი დეტალურად" toggle (aggregated breakdown in a gray box, deferred lines struck-through), three selectable method cards (radio): ნაწილ-ნაწილ გადახდა / საქართველოს ბანკის მომხმარებლებისთვის (bog, default), განაწილებით გადახდა / თიბისი ბანკის მომხმარებლებისთვის (tbc), მერე ბარათით გადახდა / მერე ბარათის მფლობელებისთვის (mere). Bullet notes for each deferred part. Continue → `#/pay`.
5. **Card form** `#/pay` — card "Pay with" + brand badges (Visa, Mastercard, Diners, Maestro, Discover, Amex), Card number (auto-group 4-4-4-4, Luhn check, highlight detected brand), Exp Date (MM/YY, not in the past), CVV2 (3–4 digits), button "გადახდა" → short processing spinner → `#/success`. Nothing is sent anywhere.
6. **Success** `#/success` — check badge, "შეკვეთა მიღებულია", date badge (today, Georgian month names e.g. "6 ოქტომბერი 2026"), "order ID: #<6 digits>", "თქვენი შეკვეთა" (each product: name, "1x", payable price; "წონის გარეშე"/"განბაჟების გარეშე" lines when deferred), "გადახდის მეთოდი" ("საქართველოს ბანკი: ნაწილ-ნაწილ" | "თიბისი ბანკი: განაწილება" | "მერე: ბარათით გადახდა"), receipt zig-zag bottom edge, "შეჯამება" (თვეში 4x <monthly>, სულ <total>), "მთავარი გვერდი" → reset → landing.
- Back navigation: desktop "← უკან დაბრუნება" link top-left on inner screens; mobile "უკან" text button in the bottom bar. Browser back/forward must work (hash routes). Route guards: cart/payment/pay/success without products → landing; payment/pay without auth → register.
- Responsive: designed widths 428 and 1440, but must look right everywhere from 320 to 1920+ (mobile layout below ~900px, desktop layout above; centered max-width container on desktop like the design's 160px side margins at 1440).
- QA hooks (required): every screen and visual state must be reachable directly by URL so it can be screenshotted, e.g. `index.html#/cart?demo=1&details=1&weight=0&customs=1`, `#/payment?demo=1&method=tbc&details=1`, `#/?url=https://www.amazon.com/Xbox-Core-&loading=1`, `#/success?demo=1`. `demo=1` seeds the Nike demo product + a logged-in demo user. Also expose `window.SlicePay` with `reset()` and `getState()`.

## Engineering constraints
- Plain HTML + CSS + vanilla JS (classic `<script>` tags, NO ES modules — must work over file://). No external JS libraries. Fonts may load from a CDN with good fallbacks.
- Files: PROJECT/index.html, PROJECT/css/*.css, PROJECT/js/*.js, PROJECT/assets/(img|icons)/*.
- Accessible: real `<button>`/`<input>`/`<label>`, focus-visible styles, aria-live for loading/errors, radio group semantics for payment methods, `lang="ka"`.
- Use CSS custom properties for all tokens.

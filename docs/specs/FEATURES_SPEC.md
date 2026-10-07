# SlicePay v2 — new features spec (authoritative)

The user asked to add 7 features to the existing, working prototype in
(this repository; read docs/ARCHITECTURE.md for the
current architecture). None of these screens exist in the Figma design, so they must be designed **in
the existing visual language** (DESIGN_SYSTEM.md tokens/components: #5e34ec primary, #f4f4f4 page,
white cards with 1px #d3d3d3 border radius 8, 50px inputs with #878787 border, Mtavruli button labels,
Noto Sans Georgian SemiCondensed, the same mobile bottom bar, the same desktop header with
"← უკან დაბრუნება" + centred colour logo, same checkbox / radio / toggle / breakdown / toast / modal).
Reuse existing components; add new shared components only where needed.

Hard rules:
- Existing designed screens must keep their look. New UI goes into empty areas where possible; anything
  that shifts a designed element must be deliberate and minimal. The 34 design-parity QA cases must not
  regress except in the regions where new UI was added (cart ETA line, payment term selector, success
  delivery section/buttons, landing account link).
- All copy below is final Georgian copy — use it verbatim (Mtavruli = Georgian capitals U+1C90.. for
  button labels as in the existing app).
- Still plain HTML/CSS/vanilla JS, classic scripts, file:// compatible, no network calls, no libraries.
- Privacy: never persist card data; personal ID number (პირადი ნომერი) is kept in session state only,
  and in persisted orders only MASKED (e.g. `********123`). Escape all user text before innerHTML.

## New flow
landing → cart → (register → **phone verify**) or login → **delivery** → payment (**term selection**) →
pay → success (**delivery + ETA**, link to **my orders**) ; **my orders** list/detail reachable from the
landing / desktop header / success; deferred weight/customs are paid later from the order detail.

Routes added: `#/register/verify`, `#/delivery`, `#/orders`, `#/orders/<id>`.
`#/pay` gains an order-payment mode: `#/pay?order=<id>` (pays the remaining deferred amounts of an order).
Guards: `/delivery` needs products + auth; `/payment` and `/pay` (checkout mode) need products + auth +
completed delivery (else → `/delivery`); `/orders*` need auth (else → `/login?next=/orders`);
`/register/verify` needs a pending registration (else → `/register`).
Login: after success go to `next` param if present, otherwise to `/delivery` when the cart has products,
otherwise `/orders`.

## 1. Phone verification (ტელეფონის ვერიფიკაცია) — `#/register/verify`
Register form "ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ" (valid) no longer creates the account immediately: it stores a pending
registration in session state, "sends" a 4-digit code (mock: toast `სატესტო კოდი: 1234` like recover) and
goes to `#/register/verify`. Screen (same layout as recover-code screen):
- heading `ტელეფონის დადასტურება`
- text (14px #666): `SMS კოდი გამოგზავნილია ნომერზე 555 123 456` (formatted phone, black/semibold)
- input placeholder `SMS კოდი` (numeric, maxlength 4, autocomplete one-time-code)
- links: `კოდის ხელახლა გამოგზავნა` with 30 s cooldown `(0:30)` (reuse recover logic) and `ნომრის შეცვლა`
  (back to `/register` keeping the entered values except password)
- button `ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ`; mobile bottom bar `ᲣᲙᲐᲜ` + `ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ`
- errors: `შეიყვანეთ 4-ნიშნა კოდი`, `კოდი არასწორია`, `კოდს ვადა გაუვიდა, მოითხოვეთ ახალი` (5 min expiry)
- on success: create the account (existing mock api), log in, toast `ნომერი დადასტურებულია`, go to
  `/delivery` (or `/orders` when the cart is empty).
QA: `#/register/verify?demo=1` seeds a pending registration for 555 123 456 with code `4821`, no cooldown.

## 2+3+6. Delivery step + personal ID + parcel ETA — `#/delivery`
Desktop: same header as auth; content column 360 wide like the auth forms is too narrow for method cards —
use a centred 645px column (the cart's left-column width) with white section cards, or the auth column
for fields and two method cards side by side — designer's choice, but consistent. Mobile: white page like
auth, bottom bar `ᲣᲙᲐᲜ` + `ᲒᲐᲒᲠᲫᲔᲚᲔᲑᲐ`.
- heading `მიწოდება`
- section label `მიმღები`: inputs `სახელი`, `გვარი` (prefilled from the pending registration of this
  session if any), `პირადი ნომერი` (numeric, exactly 11 digits) + orange note like the phone note:
  `*პირადი ნომერი საჭიროა ამანათის განბაჟებისთვის`
- section label `მიწოდების მეთოდი`: two radio cards (reuse payment radio-card language):
  - `ფილიალიდან გატანა` — sub `უფასო` — when selected shows a select `აირჩიეთ ფილიალი` with options:
    `ვაკის ფილიალი — ჭავჭავაძის გამზ. 37, თბილისი`, `საბურთალოს ფილიალი — პეკინის გამზ. 12, თბილისი`,
    `გლდანის ფილიალი — ხიზანიშვილის ქ. 5, თბილისი`, `ბათუმის ფილიალი — რუსთაველის ქ. 15, ბათუმი`,
    `ქუთაისის ფილიალი — წერეთლის ქ. 8, ქუთაისი` (mock data). Default method; default branch = ვაკე.
  - `კურიერით მიტანა` — sub `თბილისში 5₾ · რეგიონებში 10₾` — fields: select `ქალაქი` (თბილისი, ბათუმი,
    ქუთაისი, რუსთავი, გორი, ზუგდიდი, თელავი, ფოთი), input `მისამართი` (placeholder `ქუჩა, სახლის ნომერი`),
    input optional `ბინა, სართული, კომენტარი`.
- ETA box (light purple #f3efff, radius 8, calendar/truck icon in #5e34ec):
  `ამანათის სავარაუდო მიღება: 16–21 ოქტომბერი` + small #666 line
  `ვადა შეიძლება შეიცვალოს საბაჟო პროცედურების გამო`
- errors: `შეიყვანეთ სახელი`, `შეიყვანეთ გვარი`, `პირადი ნომერი უნდა შედგებოდეს 11 ციფრისგან`,
  `აირჩიეთ ფილიალი`, `აირჩიეთ ქალაქი`, `შეიყვანეთ მისამართი`
- continue → saves `state.delivery` (done=true) → `/payment`.
Delivery fee: pickup 0; courier 5₾ in თბილისი, 10₾ elsewhere. The fee is added to the payable total
(after delivery is chosen) and appears as a breakdown row `მიწოდების ფასი` (payment details, success,
order detail) only when > 0. Monthly = ceil(payable / term).
ETA (calendar days from the order/today): store base window amazon 9–14, ebay 12–20, other 12–20
(multi-store cart → widest window); +1 day courier Tbilisi, +2 days courier regions. Format with Georgian
month names: `16–21 ოქტომბერი`, across months `28 ოქტომბერი – 3 ნოემბერი`.
Show the ETA: delivery screen box; cart summary card (small #666 14px line `სავარაუდო მიღება: …` placed
so the designed elements don't move — e.g. below the checkboxes on mobile / under the divider on desktop);
payment summary; success; my orders.
QA: `#/delivery?demo=1` (pickup, ვაკე, empty ID), `&delivery=courier`, `&err=1`. `demo=1` on payment/pay/
success seeds a completed delivery (pickup, ვაკე, name `გიორგი ბერიძე`, ID `01001012345`) so the existing
payment/success design-parity cases stay at 600₾ / 150₾.

## 5. Explanation of the approximate amounts
Every breakdown row label `წონის დაახ. ფასი` / `წონის დაახლოებით ფასი` / `განბაჟების დაახ. ფასი` /
`განბაჟების დაახლოებით ფასი` gets a small info button (16px circled "i", #79747e, aria-label
`როგორ ითვლება?`) and the cart (under the two checkboxes) gets a text link `როგორ ითვლება დაახლოებითი თანხები?`.
Both open an explanation: desktop = existing modal style (dialog), mobile = bottom sheet (slides up,
radius 16 top corners, drag handle, closes on backdrop/Esc/button). Content:
- title `დაახლოებითი თანხები`
- `წონის საფასური` — `ითვლება ამანათის ფაქტობრივი ან მოცულობითი წონით (რომელიც მეტია) და ტრანსპორტირების
  ტარიფით.` + product-specific line when opened from a product: `დაახლოებითი წონა: 4 კგ × 25₾ = 100₾`
  (tariff mock 25₾/კგ; product.weightKg = weight/25 for mock products, 4 for the Nike demo)
- `განბაჟება` — `დამოკიდებულია ნივთის ღირებულებაზე, კატეგორიასა და მიწოდების ღირებულებაზე. საბოლოო
  თანხას ადგენს საბაჟო ამანათის ჩამოსვლისას.`
- `რა მოხდება, თუ თანხა განსხვავდება?` — bullet 1 `წინასწარ გადახდისას: თუ ფაქტობრივი თანხა ნაკლებია,
  სხვაობა დაგიბრუნდებათ; თუ მეტია — სხვაობას გადაიხდით „ჩემი შეკვეთების“ გვერდიდან.` bullet 2
  `მოგვიანებით გადახდისას: ზუსტ თანხას გადაიხდით ამანათის ჩამოსვლის შემდეგ, „ჩემი შეკვეთების“ გვერდიდან.`
- button `ᲒᲐᲡᲐᲒᲔᲑᲘᲐ`
QA: `info=weight|customs|all` opens it on cart/payment.

## 7. Term selection (ვადის არჩევა) — payment screen
Available terms per method (mock, 0%): bog `[3, 4, 6]`, tbc `[3, 4, 6, 9, 12]`, mere `[4, 6, 12]`;
default 4 (keeps the designed 150₾). Switching method keeps the term if available, else the nearest.
UI: label `განვადების ვადა` + a radiogroup of chips (segmented buttons, 1px #d3d3d3, radius 8, selected =
#f3efff bg + #5e34ec border/text), each chip: `4 თვე` (16px) and below `150₾ / თვე` (14px #666), plus a
small #666 note `0% საკომისიო · საბოლოო პირობებს ადგენს ბანკი`. Desktop: in the empty area under the
three method cards (left column, full 645 width). Mobile: after the method cards, before the bullet notes.
Arrow keys move selection. The cart summary keeps showing the chosen term (`N თვეში`), payment summary
shows monthly, success shows `თვეში Nx <monthly>`. QA: `term=6`.

## 4. My orders (ჩემი შეკვეთები) — `#/orders`, `#/orders/<id>`
Persistence: orders stored per user phone in localStorage `slicepay:v1:orders` (masked ID, no card data).
`SP.createOrder` (success) appends the order with: id, date, products snapshot, defer flags, method, term,
monthly, total (payable), deliveryFee, delivery {method, branch | city+address+note, recipient name,
pidMasked}, eta {from, to}, status, timeline, deferred {weight:{est, actual|null, paid}, customs:{…}}.
Demo seed (`demo=1`, and the demo user on first login): two past orders so the list isn't empty —
(a) `#548210`, 2 months ago, ჩაბარდა (delivered), all paid; (b) `#731954`, 9 days ago, status
`განბაჟება`, weight + customs deferred with actual amounts known: weight est 100 → actual 112, customs est
250 → actual 238 → `გადასახდელია: 350₾`. New orders start at `შეკვეთილია`.
Statuses (timeline order): `შეკვეთილია` → `გზაშია` → `საწყობშია` → `განბაჟება` →
(`მზადაა გასატანად` for pickup | `კურიერთანაა` for courier) → `ჩაბარდა`.
Status pill colours: in-progress #f3efff/#5e34ec, action needed (deferred due) #fff4e5/#b26a00
(`გადასახდელია`), delivered #e8f5ee/#1e7b4a.
List screen: heading `ჩემი შეკვეთები`, right side link `გასვლა` (logout → toast `თქვენ გამოხვედით
სისტემიდან` → landing). Order card (white card like cart cards): `#731954 · 27 სექტემბერი 2026`, status
pill, product names (ellipsis, `+1` if more), `სულ 600₾ · 150₾ × 4 თვე`, ETA line
`სავარაუდო მიღება: …` or `ჩაბარდა: 3 აგვისტო`, and an orange due badge `გადასახდელია: 350₾` when due.
Empty state: `ჯერ არ გაქვთ შეკვეთები` + button `ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ` (→ landing).
Detail screen: header `შეკვეთა #731954`, status timeline (vertical stepper with dates, current step
highlighted #5e34ec, done steps with check), sections: `პროდუქტები` (thumb, name, qty, price),
`მიწოდება` (method, branch / address, recipient `გიორგი ბერიძე`, `პირადი ნომერი: ********345`, ETA),
`გადახდა` (method label as on success, `ვადა: 4 თვე`, schedule list `1-ლი შენატანი · 27 ოქტომბერი 2026 ·
150₾`, `მე-2 შენატანი …`), `დარჩენილი გადასახდელი` when anything deferred: rows `წონის საფასური` with
`დაახ. 100₾` → `ფაქტობრივი 112₾` (or `განისაზღვრება ამანათის ჩამოსვლისას`), same for `განბაჟება`, total
due and button `ᲒᲐᲓᲐᲮᲓᲐ` → `#/pay?order=<id>`. After paying: rows show `გადახდილია`, pill becomes the next
status, toast `გადახდა წარმატებით შესრულდა`.
Desktop: centred 645px column under the standard header (back link → previous / landing), list cards
stacked with 20px gaps. Mobile: white page, bottom bar `ᲣᲙᲐᲜ` (+ `ᲐᲮᲐᲚᲘ ᲨᲔᲙᲕᲔᲗᲐ` on the list).
Card form in order mode (`#/pay?order=<id>`): same card form, plus a line above "Pay with":
`გადასახდელი: 350₾` (bold) and back goes to the order detail; on success → order detail (not success).
Entry points: landing top-right link (white, 16px, user icon) `ჩემი შეკვეთები` when logged in /
`შესვლა` when not (→ `/login?next=/orders`); desktop inner-screen header top-right link (purple like the
back link) `ჩემი შეკვეთები` when logged in; success screen secondary button `ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ` (outline
#5e34ec, white bg) above/next to `ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ`.
QA: `#/orders?demo=1`, `#/orders/731954?demo=1`, `#/orders?demo=1&empty=1`, `#/pay?demo=1&order=731954`.

## Success screen additions
Add a `მიწოდება` section in the receipt after `გადახდის მეთოდი` (same heading style): line 1 `ფილიალიდან
გატანა: ვაკის ფილიალი` or `კურიერით: თბილისი, <address>`, line 2 `სავარაუდო მიღება: 16–21 ოქტომბერი`.
Summary uses the chosen term (`თვეში 4x 150₾`). Add a `მიწოდების ფასი` summary row only if > 0.
Buttons: `ᲩᲔᲛᲘ ᲨᲔᲙᲕᲔᲗᲔᲑᲘ` (secondary) + `ᲛᲗᲐᲕᲐᲠᲘ ᲒᲕᲔᲠᲓᲘ` (primary).

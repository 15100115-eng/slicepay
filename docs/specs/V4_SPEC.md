# SlicePay v4 — profile editing + "მუშავდება" status (authoritative)

Builds on v2/v3 (see [ARCHITECTURE.md](../ARCHITECTURE.md), [INTEGRATION.md](../INTEGRATION.md) incl. "v3 changes", [FEATURES_SPEC.md](FEATURES_SPEC.md),
[DESIGN_SYSTEM.md](../design/DESIGN_SYSTEM.md)). Same rules: existing visual language, verbatim Georgian copy below, Mtavruli button
labels (U+1C90…), plain classic scripts, file:// compatible, no network, escape user text.

## A. New first order status "მუშავდება"
- New status key `processing`, label `მუშავდება`, inserted BEFORE `ordered` (`შეკვეთილია`).
  Timeline: მუშავდება → შეკვეთილია → გზაშია → საწყობშია → განბაჟება → (მზადაა გასატანად | კურიერთანაა) → ჩაბარდა.
- Meaning: SlicePay is processing the order (bank approval + placing the order with the store).
- New orders created at checkout start at `processing` (timeline `[{processing, date}]`); the list pill
  shows `მუშავდება` with the in-progress style (#f3efff / #5e34ec).
- Demo orders (#548210 delivered, #731954 customs) get a `processing` step dated on the order date before
  their `ordered` step (same date is fine); everything else unchanged.
- Any code that assumes `ordered` is the first step (step counts, "current step", ETA logic, pill kinds,
  deferred-payment status advance, QA seeds, tests) must be updated. Old orders already saved in
  localStorage without a `processing` step must still render (treat the missing step as done on the
  order date).

## B. Profile editing — `#/profile`
Data: the user record (localStorage users store, keyed by phone) now also persists `first`, `last`,
`email` (the user's own profile data; still never the personal ID, never card data). Registration stores
them (after OTP verification). Demo user profile: `გიორგი` / `ბერიძე` / `giorgi@example.com`.
Guard: needs auth (else `#/login?next=/profile`).

Screen (desktop: standard header with back link + centred logo; content in the same centred column as
the orders page; mobile: white page, bottom bar `ᲣᲙᲐᲜ` only). Heading `პროფილი`. Three white section
cards (cart-card style) + logout:

1. `პირადი ინფორმაცია` — inputs `სახელი`, `გვარი`, `ელ.პოსტა` (prefilled), button `ᲨᲔᲜᲐᲮᲕᲐ`
   (disabled-look until something changed). Validation as in register. Success toast
   `ცვლილებები შენახულია`.
2. `ტელეფონის ნომერი` — shows the current number (formatted `555 123 456`) + text-link `ნომრის შეცვლა`.
   Opening it shows: input `ახალი ტელეფონის ნომერი`, button `ᲙᲝᲓᲘᲡ ᲒᲐᲛᲝᲒᲖᲐᲕᲜᲐ` → then input
   `SMS კოდი` + `კოდის ხელახლა გამოგზავნა` (30 s cooldown) + button `ᲓᲐᲓᲐᲡᲢᲣᲠᲔᲑᲐ` + link `გაუქმება`.
   Mock code via the existing test-code toast. Errors: `შეიყვანეთ სწორი ნომერი` (reuse the existing phone
   message if one exists), `ახალი ნომერი ემთხვევა მიმდინარეს`, `ეს ნომერი უკვე დარეგისტრირებულია`,
   `კოდი არასწორია`, `კოდს ვადა გაუვიდა, მოითხოვეთ ახალი`. On success: the account is re-keyed to the new
   phone — users store, the user's orders, remember-me, current session — the old number is freed; toast
   `ტელეფონის ნომერი შეიცვალა`.
3. `პაროლის შეცვლა` — inputs `მიმდინარე პაროლი`, `ახალი პაროლი`, `პაროლის გამეორება` (eye toggles),
   button `ᲞᲐᲠᲝᲚᲘᲡ ᲨᲔᲪᲕᲚᲐ`. Errors: `მიმდინარე პაროლი არასწორია`, the existing ≥8 rule message,
   `პაროლები არ ემთხვევა` (reuse existing mismatch message), `ახალი პაროლი ემთხვევა მიმდინარეს`.
   Success: fields cleared, toast `პაროლი შეიცვალა`.
4. Logout: outline button `ᲒᲐᲡᲕᲚᲐ` at the bottom (same logout helper + toast as orders).

Entry points: desktop inner-screen header right side shows two links `პროფილი` · `ჩემი შეკვეთები`
when logged in; the orders list header link `გასვლა` is replaced by `პროფილი` (logout lives on the
profile page); the landing top-right logged-in link stays `ჩემი შეკვეთები`.
Delivery step: recipient `სახელი`/`გვარი` prefill from the profile (session values still win if the
user typed something in this session).
QA params: `#/profile?demo=1`, `&edit=phone` (phone form open), `&edit=phone&step=code` (code step,
code 4821, no cooldown), `&err=1` (validation errors visible).

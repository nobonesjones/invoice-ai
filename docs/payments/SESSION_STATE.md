# Payments work — state as of 2026-09-09

> **Closed 2026-09-09.** Harry called the payments work done. Backend agent confirmed
> §1–§4 and §8 of `PAID_EVENT_HANDOFF.md` live, with evidence (below). Not yet exercised:
> a real GoCardless sandbox payment from the browser, and a push on a rebuilt app.
> Treat the "Not done / deliberately left" list as the only open items.

## Confirmed live by the backend agent, 2026-09-09
- `trg_on_invoice_paid` exists and is enabled; `invoices` is in the `supabase_realtime` publication.
- The "Database Webhook" is **not** a dashboard webhook. It is a hand-rolled pair:
  trigger `invoice_paid_webhook` (AFTER UPDATE, `WHEN new.status = 'paid' AND is distinct from old`)
  → `invoice_paid_webhook_fn()` → `net.http_post` to `/functions/v1/invoice-paid` with the
  `x-invoice-paid-secret` header, 5000 ms timeout. Non-paid updates never make an HTTP call.
  The secret is embedded in the function body (sha256 matches `INVOICE_PAID_WEBHOOK_SECRET`),
  so rotating it means updating both the edge-function secret and the SQL function.
  Responses land in `net._http_response`; that is where to look when debugging.
- `invoice-paid` v1 ACTIVE, `verify_jwt: false`. `RESEND_API_KEY` and `INVOICE_PAID_WEBHOOK_SECRET`
  set; `SHARE_BASE_URL` unset (function default applies).
- Test flip on INV-003 (Harry's montgomerymediaco account): `paid` activity row written
  ("Invoice INV-003 paid in full — £100.00"), owner email sent via Resend, thank-you skipped
  because the client has no email, push 0 because no tokens exist yet (needs the EAS rebuild).
  `paid_notified_at` claimed 1 s after the flip. Invoice reverted to draft; trigger cleared
  `paid_notified_at`, so it is retestable. The test's `paid` activity row was left in place.
- GoCardless: `gocardless-webhook` v28 and `gocardless-check-payment` v22 ACTIVE. Both write
  `payment_date` + `paid_amount` (+ `payment_notes`, `gocardless_payment_id`); neither inserts
  into `invoice_activities` (the trigger owns that now).

## Proven working, end to end, in sandbox
- Stripe Connect onboarding from the app (hosted, returns to app, no "Off" flash, polls while verifying)
- Card payments on by default for new invoices once Stripe is active
- Payment link minted before every email/share send; email carries a working Pay button
- Paying with 4242 → Stripe webhook → invoice shows **Paid** in the app

## Built, pushed, NOT yet live (needs the backend steps in PAID_EVENT_HANDOFF.md)
- One "invoice paid" event: DB trigger writes the `paid` history row for every route into paid
- `invoice-paid` edge function: payer thank-you email (links to the shared invoice marked PAID),
  owner "you've been paid" email, push to owner's devices
- Realtime on `invoices` so viewer + list flip live
- Push token registration + tap-to-open (needs an EAS rebuild — `expo-notifications` plugin added)
- GoCardless onboarding hook mirroring Stripe (`hooks/useGoCardlessConnect.ts`)
- History now complete: email sends were never logged before; the Paid toggle no longer double-logs

## Known facts about the backend (from the web-repo agent)
- `gocardless-webhook` is deployed and verifies signatures, but wrote to `invoices.paid_at`, a
  column that does not exist, swallowed the error, returned 200. Fix handed over (§8 of handoff).
- `gocardless-payments-oauth` v15 is deployed and is what the app hook targets. Its exchange
  writes `gocardless_connected` but not `gocardless_verification_status`; the hook treats null
  as "not reported", not "unverified".
- Repo copies of several deployed functions are stale (`send-invoice` v29 etc.). A deploy from
  git would regress production. Listed in §7 of the handoff.
- `.gitignore` ignores `*.sql` and `docs/` repo-wide. Migrations and these docs were force-added.

## Immediate next steps
1. Backend agent works through PAID_EVENT_HANDOFF.md §1–§5, then strips the activity inserts
   from `gocardless-webhook` / `gocardless-check-payment`, proves the chain with a SQL status flip.
2. Harry runs one real GoCardless sandbox payment from a browser: `getsuperinvoice.com/pay/<id>`.
3. Confirm: history row, both emails, invoice flips live in the app.
4. EAS build for push; then confirm a push arrives on a real payment.

## Not done / deliberately left
- `estimates/create.tsx` still gates on the dead `stripe_enabled` flag
- `SendStatusOverlay` is only on the email send; share-link and PDF sends still use alerts
- Verifying-state copy on the Stripe sheet promises an email the backend doesn't send yet
- `shared-invoice` still gates on dead flags and reads bank columns that don't exist (§5)
- The trigger's currency-symbol map is a fixed list; unknown codes fall back to the code itself

## Invoice designs reworked (2026-09-10)
`supabase/functions/_shared/invoice-doc/render.ts` now has seven distinct layouts (band, wave,
letterhead, sidebar, minimal, swiss, ledger), full-bleed headers, and spacing that keeps a
normal invoice on one A4 page in every design. The picker thumbnails match the layouts.
**Backend agent: redeploy `shared-invoice` and `shared-estimate`** — they bundle this file, so
the hosted pages are on the old designs until then. Render harness for review lives outside
the repo (headless Chromium screenshots + per-block height measurement).

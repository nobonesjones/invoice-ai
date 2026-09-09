# Payments work — state as of 2026-09-09

Branch: `claude/stripe-app-integration` (20 commits on top of `wip/local-changes`).
Companion doc: `PAID_EVENT_HANDOFF.md` in this folder — the backend checklist.

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

# Invoice-paid event — backend handoff

Everything the app side needs is on branch `claude/stripe-app-integration`.
This is the list of what has to happen on Supabase for it to work, in order,
plus the questions only the backend can answer.

## 1. Apply the migration

`supabase/migrations/20260908090000_invoice_paid_event.sql`

It is idempotent (`IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP ... IF EXISTS`). It:

- adds `invoices.paid_notified_at timestamptz`
- creates `public.push_tokens` with RLS (users manage their own rows)
- creates `on_invoice_paid()` + `trg_on_invoice_paid`, a `BEFORE UPDATE OF status`
  trigger that inserts an `invoice_activities` row with `activity_type = 'paid'`
  whenever a row transitions **into** `paid`, and clears `paid_notified_at` on
  any transition in or out of `paid`.

Sanity check after applying:

```sql
UPDATE invoices SET status = 'paid', paid_amount = total_amount, payment_date = now()
WHERE id = '<a test invoice>';
SELECT activity_type, activity_description FROM invoice_activities
WHERE invoice_id = '<that id>' ORDER BY created_at DESC LIMIT 1;
-- expect: paid | Invoice INV-xxx paid in full — AED 930.74
```

## 2. Deploy `invoice-paid`

`supabase/functions/invoice-paid/index.ts`. Secrets it needs:

| Secret | Value |
|---|---|
| `RESEND_API_KEY` | already set for send-invoice |
| `INVOICE_PAID_WEBHOOK_SECRET` | generate one, e.g. `openssl rand -hex 32` |
| `SHARE_BASE_URL` | optional, defaults to `https://invoices.getsuperinvoice.com` |

It must be deployed with `--no-verify-jwt`: it is called by the database, not by
a user, and authenticates with the header below instead.

## 3. Configure the Database Webhook

Dashboard → Database → Webhooks → Create:

| Field | Value |
|---|---|
| Table | `public.invoices` |
| Events | **Update** only |
| Type | Supabase Edge Function → `invoice-paid` |
| HTTP header | `x-invoice-paid-secret: <the INVOICE_PAID_WEBHOOK_SECRET value>` |
| Timeout | 5000 ms is fine |

The function early-exits on every update that is not a transition into paid,
so the volume is harmless. It claims the invoice via `paid_notified_at` before
sending anything, so a retry or a double delivery cannot email the customer twice.

Test: mark a sandbox invoice paid (toggle in the app, or pay it with 4242).
Expect three things: the customer's thank-you email with a **View paid invoice**
button, the owner's "You've been paid" email, and a push (once the app is rebuilt,
see §6). The function's response body reports which of the three went out.

## 4. Enable realtime on `invoices`

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
```

The app subscribes with `filter: user_id=eq.<uid>` (list) and `id=eq.<id>` (viewer).
Without this nothing breaks; the screens just keep refreshing on focus as before.

## 5. Fix `shared-invoice` — the thank-you email points at it

`supabase/functions/shared-invoice/index.ts`:

- **line 375** gates the pay button on `paymentOptions?.stripe_enabled`, the dead
  flag. Gate on `invoice.stripe_payment_link_url` and render that URL, exactly as
  `send-invoice` v29 does.
- **line 387–396** reads `paymentOptions.bank_name`, `.account_number`, `.sort_code`.
  Those columns do not exist; the only column is `bank_details` (a newline-joined
  string). Render that.
- When `invoice.status === 'paid'`, show a PAID badge and hide every pay button.
  The thank-you email's link lands here, so this is the receipt.

## 6. App rebuild needed for push

`expo-notifications` was added to `app.json` plugins. The project has a checked-in
`ios/` folder, so this only takes effect on the next EAS build (dev + production).
Until then the app logs `[Push] registration skipped` and everything else works.

## 7. Repo drift — please commit the deployed sources

The repo copies of these are behind what is deployed. A deploy from git would
regress production. Please commit the deployed versions to this branch:

- `send-invoice` (deployed v29 has the Stripe pay-button block; repo has gocardless only)
- `stripe-create-payment-link`, `stripe-connect-start`, `stripe-connect-status`, `stripe-webhook`
- whichever of the GoCardless functions in §8 exist

Also: `.gitignore` line 44 is `*.sql`, which ignores every migration by default.
The 24 tracked ones were force-added. Worth changing to something narrower.

## 8. GoCardless — the webhook exists; it writes to a column that does not exist

Confirmed by the web-repo agent (2026-09-09). All of these are deployed and ACTIVE:
`gocardless-payments-oauth` v15, `gocardless-create-payment` v13,
`gocardless-check-payment` v9, `gocardless-webhook` v15, `gocardless-refund` v10.
The app's hook targets `gocardless-payments-oauth`, which is the right one.

**The bug.** `gocardless-webhook` verifies signatures correctly and handles
`payments.confirmed` / `payments.paid_out`, then runs:

```ts
.update({ status: 'paid', paid_at: new Date().toISOString(), gocardless_payment_id: paymentId, ... })
```

`invoices.paid_at` does not exist (the 20241216 migration that adds it was never
applied). PostgREST rejects the whole update, the error is `console.error`'d, and
the function returns 200 — so GoCardless records success and never retries.
Zero GoCardless payments have ever been marked paid. `gocardless-check-payment`
has the same bug.

**The fix** (web repo, both functions):

```ts
.update({
  status: 'paid',
  payment_date: new Date().toISOString(),   // was paid_at
  paid_amount: invoice.total_amount,        // was never written
  payment_notes: 'GoCardless instant bank payment',
  gocardless_payment_id: paymentId,
  updated_at: new Date().toISOString(),
})
```

Also **remove the webhook's own `invoice_activities` insert** in the success
branch: `trg_on_invoice_paid` (§1) now writes the `paid` row for every route into
paid, and `invoice-paid` (§2) sends the emails and push, so the webhook doing it
too would double up. The webhook's only job is the status flip.

And return non-200 when the update fails, so GoCardless retries instead of
recording a success that never happened.

**Smaller things, same area:**
- `gocardless-refund` writes `gocardless_refund_id`, `gocardless_refund_status`,
  `refunded_amount`, `refunded_at` — none exist. Same unapplied migration.
- `create-payment` stores the billing-request id in `invoices.request_id`, which
  carries a UNIQUE index meant for app-side idempotency. A second billing request
  for the same invoice (a retry) will violate it.
- The OAuth `state` parameter is generated and returned but never stored or
  verified on callback. CSRF protection is nominal. The app hook passes it
  through; the function should persist it on generate and check it on exchange.
- `payment_options.gocardless_*` columns are not in `types/database.types.ts`.
  Please regenerate (`supabase gen types`) and commit.

**After the fix**, a sandbox GoCardless payment should: flip the invoice to paid
→ trigger writes the history row → Database Webhook fires `invoice-paid` → payer
thank-you, owner email, push → realtime flips the app. Same as Stripe.

## What each method now does

| | Onboarding | Payer pays via | Marked paid by | Then (all methods) |
|---|---|---|---|---|
| Stripe | ✅ in-app, hosted | email/share pay link | Stripe webhook | trigger → history row · `invoice-paid` → thank-you email, owner email, push · realtime → screens flip live |
| GoCardless | ✅ in-app, hosted | getsuperinvoice.com/pay/{id} → billing request | GoCardless webhook, **once the paid_at bug is fixed (§8)** | same |
| PayPal | email address in settings | pays PayPal directly | owner toggles Paid | same |
| Bank transfer | details in settings | pays their bank directly | owner toggles Paid | same |

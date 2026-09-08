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

## 8. GoCardless — questions before the payer side can work

The app now has a complete onboarding flow (`hooks/useGoCardlessConnect.ts`),
calling `gocardless-payments-oauth` with `action: generate-oauth-url | exchange-code | disconnect`,
which is the contract the existing screen and callback route already used.
Please confirm:

1. Is `gocardless-payments-oauth` deployed? If not, the two repo functions
   (`gocardless-generate-oauth-url`, `gocardless-exchange-token`) cover the first
   two actions but with different names and `oauth_url` instead of `url` in the
   response — the hook reads either key. Tell me which to target.
2. Are `gocardless-create-payment` and `gocardless-check-payment` deployed? The
   shared page and `payment-complete` call them.
3. **There is no GoCardless webhook anywhere.** Nothing marks an invoice paid when
   a GoCardless payment settles. That needs a `gocardless-webhook` function that
   verifies the `Webhook-Signature` header, handles `payments.confirmed` /
   `payments.paid_out`, and does `UPDATE invoices SET status='paid', paid_amount, payment_date`.
   The trigger and `invoice-paid` then handle everything else — no emails or
   activity rows needed in the webhook itself.
4. The email's GoCardless button links to `https://getsuperinvoice.com/pay/{invoice.id}`.
   No such route exists. It should point at the shared invoice page, same as Stripe.
5. `payment_options.gocardless_*` columns are not in `types/database.types.ts` and
   have no migration. Please regenerate types (`supabase gen types`) and commit.

## What each method now does

| | Onboarding | Payer pays via | Marked paid by | Then (all methods) |
|---|---|---|---|---|
| Stripe | ✅ in-app, hosted | email/share pay link | Stripe webhook | trigger → history row · `invoice-paid` → thank-you email, owner email, push · realtime → screens flip live |
| GoCardless | ✅ in-app, hosted | shared page → billing request | **missing webhook (§8.3)** | same |
| PayPal | email address in settings | pays PayPal directly | owner toggles Paid | same |
| Bank transfer | details in settings | pays their bank directly | owner toggles Paid | same |

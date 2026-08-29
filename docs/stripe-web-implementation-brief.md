# Stripe Connect — implementation brief for the supainvoice website

Written from a working, deployed implementation in the mobile app repo
(`supainvoice`, Supabase project `wzpuzqzsjdizmpiobsuo`). Everything below was
verified against the Stripe SDK types and Stripe's own maintained agent skills,
not recalled from memory. Five things in here contradict what a reasonable
person would write from general Stripe knowledge — they're marked ⚠️.

---

## 0. RESOLVED — one database, and the schema is already migrated

An earlier draft of this brief claimed the app and website were on two different
Supabase projects and asked you to decide how to reconcile them. **That was
wrong.** It came from the app repo's `types/database.types.ts`, which is stale.

Verified by querying the live database directly with the anon key:

| Probe against `wzpuzqzsjdizmpiobsuo` | Result |
|---|---|
| `estimates` | 200 — exists |
| `payment_options.gocardless_creditor_id` | 200 — exists |
| `payment_options.stripe_account_id` | 200 — **already migrated** |
| `invoices.stripe_payment_link_url` | 200 — **already migrated** |
| `stripe_events` | 200 — **already migrated** |
| `profiles.subscription_tier` | 404 — relation does not exist |

**One project. Both surfaces share `payment_options`.** A user connects Stripe
once and both app and website see it. No decision to make, no double onboarding.

**Section 3 (Schema) is already done.** The migrations ran today against this
database. Do not write them again — verify with the probes above and move
straight to the edge functions and UI work.

Two follow-ups this surfaced:

- **`profiles` does not exist.** The website reads `profiles.subscription_tier`
  to gate the Stripe toggle. If that table is genuinely absent, the premium gate
  is reading a missing relation in production — check this before wiring Stripe
  behind it. It may be why the toggle appears unreachable.
- **Regenerate `database.types.ts`** in the app repo; it is missing at least
  `estimates` and the GoCardless columns, and misled this brief once already.

---

## 1. Connect configuration (verified)

Business model is **SaaS platform with payments** in Stripe's own taxonomy —
users run their own businesses and own their customer relationships.

| Dimension | Value |
|---|---|
| API | Accounts v2 — `POST /v2/core/accounts` |
| `dashboard` | `"full"` |
| `defaults.responsibilities.fees_collector` | `"stripe"` |
| `defaults.responsibilities.losses_collector` | `"stripe"` |
| Charge pattern | Direct charges (`Stripe-Account` header) |
| Platform fee | **None.** Never send `application_fee_amount` |
| Capability requested | `configuration.merchant.capabilities.card_payments` |

Consequence: the connected account is merchant of record, pays its own Stripe
fees at standard rates, and **Stripe** absorbs negative balances — not the
platform and not the user. There is no per-account Connect cost.

---

## 2. ⚠️ Five corrections that will otherwise cost you a day

**⚠️ 1. Never use `type: 'standard' | 'express' | 'custom'`.** These are
deprecated v1 patterns. Stripe's own guidance: *"NEVER use `type: 'express'`,
`type: 'custom'`, or `type: 'standard'` in account creation."* Use Accounts v2.

**⚠️ 2. `charges_enabled` is deprecated and misleading.** The real check is:

```
account.configuration.merchant.capabilities.card_payments.status === 'active'
```

An account can be fully "onboarded" with card payments still pending. Gate every
pay button on this, never on your own `stripe_enabled` boolean.

**⚠️ 3. v1 and v2 Account Links are different endpoints with different shapes.**
The v1 shape (top-level `refresh_url` / `return_url` / `type`) does not work on a
v2 account. v2 nests everything and requires a `configurations` array:

```js
await stripe.v2.core.accountLinks.create({
  account: accountId,
  use_case: {
    type: 'account_onboarding',
    account_onboarding: {
      configurations: ['merchant'],
      refresh_url: `${base}?status=refresh`,
      return_url:  `${base}?status=return`,
      collection_options: { fields: 'eventually_due' },
    },
  },
});
```

**⚠️ 4. Use Payment Links, not Checkout Sessions.** A Checkout Session expires
"anywhere from 30 minutes to 24 hours after creation" — an invoice emailed on
Friday and paid Monday hits a dead link. Payment Links don't expire, accept
inline `price_data`, and support single-use:

```js
restrictions: { completed_sessions: { limit: 1 } }
```

Without that restriction the same link can be paid repeatedly by anyone who
still has it.

**⚠️ 5. Never pass `payment_method_types`.** Omitting it enables dynamic payment
methods, which Stripe selects per payer for conversion. Hardcoding `['card']` is
a measurable conversion loss.

---

## 3. Schema — ALREADY APPLIED, do not re-run

These are live in `wzpuzqzsjdizmpiobsuo` as of today. Listed for reference only. On `payment_options`:

```sql
stripe_account_id              text
stripe_card_payments_status    text          -- mirrors the v2 capability status
stripe_onboarding_started_at   timestamptz
stripe_connected_at            timestamptz
```

On `invoices` (and `estimates`, if they're payable):

```sql
stripe_payment_link_id          text
stripe_payment_link_url         text
stripe_checkout_session_id      text
paid_at                         timestamptz
amount_paid                     numeric
```

Plus an idempotency table:

```sql
create table public.stripe_events (
  id text primary key,           -- Stripe's evt_… id
  type text not null,
  account_id text,
  received_at timestamptz not null default now()
);
```

**Column-level privilege, not just RLS.** These columns must be service-role
write only, or a user can PATCH their own row to `status = 'active'` and unlock a
pay button backed by nothing:

```sql
revoke update (stripe_account_id, stripe_card_payments_status,
               stripe_onboarding_started_at, stripe_connected_at)
  on public.payment_options from anon, authenticated;
```

---

## 4. Edge functions

Five, mirroring the app. Working, deployed source is in the app repo under
`supabase/functions/` — copy it rather than rewriting.

| Function | Purpose | Notes |
|---|---|---|
| `stripe-connect-start` | Create v2 account + onboarding link | Prefill KYC BEFORE the first account link — afterwards it is unwritable |
| `stripe-connect-return` | Redirect target after onboarding | On web this can be a normal route; the app needed it because a custom scheme can't be a `return_url` |
| `stripe-connect-status` | Read capability, write back | Call on return AND on settings page load. The return URL carries no state |
| `stripe-create-payment-link` | Single-use Payment Link, direct charge | Scope the invoice query by `user_id` too — service role bypasses RLS |
| `stripe-webhook` | Signature-verified, idempotent | See below |

Webhook specifics that matter:

- **`constructEventAsync`, not `constructEvent`.** Deno has WebCrypto only; the
  synchronous variant cannot verify a signature there.
- **Handle both `checkout.session.completed` and
  `checkout.session.async_payment_succeeded`**, and skip when
  `payment_status === 'unpaid'`. Delayed-notification methods fire `completed`
  before settling — fulfilling on it alone credits payments that later fail and
  never credits the ones that succeed.
- **Update only `where paid_at is null`** so a redelivery can't overwrite the
  first settlement.
- **Delete the idempotency row if the handler throws**, otherwise Stripe's retry
  is swallowed as "already processed" and the side effect never happens.

---

## 5. ⚠️ Webhook routing under Accounts v2

Accounts v2 splits event delivery across **two destinations**, and each has its
own signing secret:

| Destination scope | Delivers |
|---|---|
| **Connected accounts** | `checkout.session.*` from direct charges — the money |
| **Your account** | `v2.core.account.*` for accounts belonging to your platform |

Under v1, account events went to "Connected accounts". Under v2 they don't. If
you only create one destination you will silently miss half the events.

Accept a comma-separated `STRIPE_WEBHOOK_SECRET` and try each secret in turn —
that's how the app handles it.

---

## 6. Website-specific work (no app equivalent)

**`/pay/:id` is single-provider.** It gates the whole page on
`!invoice.gocardless_active`, has one Pay button, and hardcodes "powered by
GoCardless" in the footer. This needs a provider abstraction before Stripe can
coexist — not a second hardcoded branch.

**Email.** `send-invoice/index.ts` emits the Pay button only when
`gocardless_active`. Needs to fire for either provider.

**PDF templates ×10.** Replace the literal `"Stripe payment link available upon
request"` with a real link. Note: on web you can render a genuine clickable
anchor. (In the app, whether the PDF pipeline preserves clickable links is still
unverified — the mitigation there is printing the URL as visible text plus a QR
code. Consider doing the same on web for parity when the PDF is printed.)

**Premium gate.** `CreateInvoice.tsx` double-gates on `subscription_tier !==
'free'`, but the report says no billing system sets that field. Either wire up
billing or drop the gate — right now it's an unreachable feature.

**The circular dead end.** The current error toast says "configure your Stripe
account in Settings > Payment Options first", and Settings has no configuration
to do. Fixing the Settings flow resolves this automatically.

---

## 7. Security — raise before shipping

The report notes `/pay/:id` reads invoices with the **anonymous** Supabase client
using a raw UUID, and there are **no RLS migrations in the repo**.

Adding Stripe turns that from an information-disclosure question into a money
question. A public payment page keyed on a guessable-ish identifier, backed by
tables whose RLS posture is unknown, is worth fixing before it can mint payment
links. At minimum:

- Confirm RLS is actually enabled on `invoices`, `estimates`, `payment_options`
  in the live database (the absence of migrations does not prove it's off — check
  the database, not the repo).
- The payment page should read through an edge function that returns only the
  fields needed to render it, not the whole invoice row via the anon client.
- Never let a client-supplied value decide which connected account gets charged.

---

## 8. Verification sequence

1. Clear any "capabilities paused" tasks on the platform Stripe account first —
   Connect account creation fails while they're outstanding.
2. Connect a test account end to end. This is the real test.
3. Then, with a real `acct_…` in hand:
   `stripe trigger --stripe-account acct_xxx checkout.session.completed`
   A plain `stripe trigger` fires on the platform account and will never reach a
   Connected-accounts destination.

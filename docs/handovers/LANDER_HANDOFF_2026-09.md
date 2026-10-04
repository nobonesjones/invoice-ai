# Lander handoff — SuperInvoice 1.0.7 (September 2026)

For the web/lander agent. The app has had a large update on the
`claude/stripe-app-integration` branch (178 commits ahead of main, going to
TestFlight now). This is what changed, what it means for the website, the
hosted pay/share pages and the edge functions the web repo owns, and a
cheat sheet to work from.

Priority order:
1. Redeploy `shared-invoice` and `shared-estimate` (new renderer is bundled in).
2. Live Stripe: confirm the webhook handler only flips status, then one real payment.
3. Support chat backend (Telegram) — `docs/support/SUPPORT_CHAT_HANDOFF.md`.
4. Website: new sections for the AI assistant, seven designs, live payments, founder chat.

---

## 1. Payments are live

### What changed
- Stripe platform account is now **fivesixfourteen L.L.C-FZ**, live mode. Sandbox is gone.
- Supabase secrets already updated by Harry: `STRIPE_SECRET_KEY` (live),
  `STRIPE_WEBHOOK_SECRET` (snapshot endpoint `superinvoice_payments_live`),
  `STRIPE_WEBHOOK_SECRET_THIN` (thin endpoint `superinvoice_account_status_live`).
  Both endpoints are "Connected accounts" scope, URL
  `https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/stripe-webhook`.
- Events subscribed: snapshot `checkout.session.completed`, `payment_intent.succeeded`,
  `charge.refunded`; thin `v2.core.account[requirements].updated`,
  `v2.core.account[configuration.merchant].capability_status_updated`.
  **Check these against what `stripe-webhook` actually handles and add any missing.**
- Every connected account created during testing lives in the old sandbox. All users
  (Harry included) must reconnect Stripe in the app. Payment links minted before the
  switch are dead.

### The one "invoice paid" event (unchanged since 2026-09-09, now the rule)
Anything that sets `invoices.status = 'paid'` — Stripe webhook, GoCardless webhook,
`gocardless-check-payment`, the app's Paid toggle, a SQL update — triggers:
`trg_on_invoice_paid` (history row `invoice_activities.activity_type = 'paid'`) →
`invoice_paid_webhook` → edge function `invoice-paid` (payer thank-you email with a
link to the shared page showing PAID, owner "you've been paid" email, push to owner's
devices; idempotent via `invoices.paid_notified_at`).

So the web-owned payment functions must **only**:
- set `status = 'paid'`, `payment_date`, `paid_amount` (and `payment_notes`,
  provider payment id);
- never insert `invoice_activities`, never send email. If `stripe-webhook` still
  inserts an activity row or emails, remove it (see PAID_EVENT_HANDOFF.md §4).
- refunds: `charge.refunded` should set status back to `sent` (or `partial` when
  partially refunded) and clear `paid_amount`/`payment_date`. The trigger resets
  `paid_notified_at` on leaving paid, so a re-payment notifies again.

### Pay page / shared page
- Hosted pay page `getsuperinvoice.com/pay/<id>` (GoCardless) and the shared invoice page
  (`SHARE_BASE_URL`, default `https://invoices.getsuperinvoice.com/?token=`) must reflect
  PAID immediately: `shared-invoice` already renders the PAID badge from status with no
  caching, keep it that way.
- `SHARE_BASE_URL` is unset on the project; the function default applies. Set it
  explicitly if the shared page lives anywhere else.
- Return leg after Stripe Connect onboarding: `stripe-connect-return` 302s to
  `superinvoice://stripe-connect?status=…`. After a GoCardless payment: the app has a
  `payment-complete` screen; the pay page's success redirect should land there or stay
  on the web "Paid, thank you" page.

### GoCardless
- App now has full GoCardless onboarding (`hooks/useGoCardlessConnect.ts`) targeting
  `gocardless-payments-oauth`. `gocardless-webhook` v28 / `gocardless-check-payment` v22
  are the fixed versions (write `payment_date`, no `paid_at`, no activity inserts).
- The exchange writes `gocardless_connected` but not `gocardless_verification_status`;
  the app treats null as "not reported". Writing the real status would let the app show
  "verifying" properly.

### Test (real money, then refund)
1. Reconnect Stripe in the app with a real identity.
2. £1 invoice to yourself, send by email, pay with a real card.
3. Expect: invoice Paid in the app within seconds (realtime), `paid` history row,
   owner email, payer thank-you email, push if the device is registered.
4. Refund in Stripe → Connect → the account → Payments. Expect status to leave paid.
5. Same with GoCardless from `/pay/<id>` (sandbox first if still available).

---

## 2. Invoicing: new look, new pipeline

### Renderer
- One HTML renderer for app preview, PDF and hosted pages:
  `supabase/functions/_shared/invoice-doc/render.ts` (no imports; bundled by Metro in
  the app and by Deno in `shared-invoice` / `shared-estimate` / `send-invoice`).
- **Redeploy `shared-invoice` and `shared-estimate`.** Until then hosted pages show the
  old designs. Check `send-invoice` too if it bundles the renderer for the email preview.
- Seven designs, `invoices.invoice_design` / `estimates.estimate_template` values:

  | id | name | look |
  |---|---|---|
  | `clean` | Clean | full-width colour band, zebra rows |
  | `wave` | Wave | colour header with a wave edge |
  | `classic` | Classic | accent edge stripe, boxed table, serif |
  | `modern` | Modern | colour sidebar, airy table |
  | `simple` | Simple | light type, hairlines, no fills |
  | `swiss` | Swiss | big type, black rules, one red mark |
  | `ledger` | Ledger | serif page frame, ruled grid |

- `accent_color` (hex) on invoices/estimates; `business_settings.default_invoice_design`
  and `default_accent_color` are the defaults for new documents. Precedence:
  document row → business default → `#1E40AF`.
- Colour: the app samples the brand colour from the business logo and offers it first;
  six curated swatches per design; custom picker. Nothing for the web to do, but the
  shared page must render whatever hex is on the row (renderer derives tint and ink).
- Every design fits a normal invoice on one A4 page. PAID badge in web mode.

### Estimates
- Hosted estimate page with accept/decline (`shared-estimate`), `estimate-responded`
  function, trigger + webhook mirroring invoices (`20260910130000_estimate_response_event.sql`).
- Estimate share links and emails now point at the hosted estimate page.

### Known dead code on the shared page (from 2026-09-09, still open)
- `shared-invoice` gates on dead `*_enabled` flags and reads bank columns that don't
  exist. The live flags are `stripe_active`, `paypal_active`, `bank_account_active`,
  `gocardless_active` on the invoice row. Bank details come from `payment_options`.

---

## 3. AI assistant (never on the website)

The app has a full AI chat (screen `ai.tsx`, edge function `ai-chat-optimized`,
functions in `services/invoiceFunctions.ts`). It is a headline feature and the
website doesn't mention it.

What it does, in plain words, for copy:
- Create an invoice or estimate by talking: "invoice Ben Whitton £450 for the garden
  fence, due in 14 days".
- Add, edit and remove line items; change dates, PO number, notes, tax, discount.
- Find and manage clients: create, search, update, delete; outstanding balance per client.
- Look things up: recent invoices, by number, totals and summaries, what's overdue.
- Change design and colour by name ("make it Swiss, in red").
- Payment methods on an invoice: turn Stripe, PayPal, bank transfer on/off; set up
  PayPal and bank details.
- Convert estimate ↔ invoice, duplicate documents, switch quote/estimate wording,
  set currency and region, tax settings.
- Shows a live preview card of the document it just made, tap to open.
- Voice input.
- Usage limits on the free tier (`check_usage_limits`), unlimited on paid.

Full function list (for the feature grid, not for copy):
`create_invoice create_client search_clients update_client search_invoices
get_invoice_by_number get_recent_invoices get_invoice_summary
get_client_outstanding_amount get_business_settings update_business_settings
create_quote create_estimate search_estimates get_estimate_by_number
get_recent_estimates convert_estimate_to_invoice convert_invoice_to_estimate
edit_recent_invoice edit_recent_estimate update_invoice_line_items
get_invoice_details update_invoice_details update_invoice_payment_methods
setup_paypal_payments setup_bank_transfer_payments get_payment_options
delete_invoice delete_client duplicate_invoice duplicate_estimate duplicate_client
set_currency set_region get_currency_options update_tax_settings
get_design_options get_color_options update_invoice_design update_invoice_color
update_invoice_appearance check_usage_limits get_setup_progress`

Screenshots to get from Harry: the chat with a created-invoice card; the preview sheet
with the seven design tiles and swatches; an invoice in each design; the paid email.

---

## 4. Support chat (new)

- Settings → Help → "Chat with Harry": a message thread in the app, forwarded to a
  Telegram bot on Harry's phone; his Telegram reply lands back in the thread and pushes
  to the user. Tables `support_threads` / `support_messages`, functions `support-notify`
  and `telegram-webhook`.
- **Backend setup is in `docs/support/SUPPORT_CHAT_HANDOFF.md`** (bot token, four secrets,
  deploy, setWebhook, migration with the secret substituted). Nothing works until that's done.
- Website: worth a line. "Message the founder from inside the app. Real replies, not a bot."
- The old email support form still exists ("Help & Customer Support") and still hits
  `send-support-ticket`.

---

## 5. Other app changes that touch the web or backend

- **Push notifications**: `push_tokens` table, `expo-notifications` in the build (1.0.7).
  Payload types: `invoice_paid` (opens the invoice), `support_reply` (opens the chat).
  Any new server-side notification should use `supabase/functions/_shared/push.ts`.
- **Realtime**: `invoices`, `estimates`, `support_messages` must be in the
  `supabase_realtime` publication (invoices confirmed; estimates confirmed by the other
  session; support_messages is in the new migration).
- **History**: `invoice_activities.activity_type` gained `'paid'`; email sends are now
  logged as `sent` (they weren't before). Client activity feed shows created → sent → paid.
- **Expenses**: receipt scanner (`process-receipt`) now refuses non-receipts and gives a
  clear message on unreadable photos instead of a 500.
- **Version**: app 1.0.7, runtime 1.0.7. OTA updates for 1.0.6 users won't carry this JS;
  they need the store build.
- **Repo hygiene**: `.gitignore` ignores `*.sql` and `docs/`; migrations and docs were
  force-added. Repo copies of `send-invoice`, `stripe-*`, and GoCardless functions are
  stale relative to what's deployed from the web repo — **please commit the deployed
  sources to the app repo** so a deploy from git can't regress production.

---

## 6. Cheat sheet

**Project**: Supabase ref `wzpuzqzsjdizmpiobsuo`. Functions base
`https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/`.

**Public URLs**: marketing `getsuperinvoice.com`; pay page `getsuperinvoice.com/pay/<id>`;
shared invoice `invoices.getsuperinvoice.com/?token=<share_token>` (SHARE_BASE_URL);
app scheme `superinvoice://`.

**Edge functions and who owns the source**

| function | owner | notes |
|---|---|---|
| `stripe-webhook`, `stripe-create-payment-link`, `stripe-connect-start`, `stripe-connect-status`, `stripe-connect-return` | web repo | now on live keys |
| `gocardless-payments-oauth` v15, `gocardless-create-payment`, `gocardless-check-payment` v22, `gocardless-webhook` v28, `gocardless-refund` | web repo | |
| `send-invoice` v29 | web repo (deployed) / app repo (stale) | mints pay link, sends email |
| `invoice-paid` v1 | app repo | the paid event |
| `estimate-responded` | app repo | |
| `shared-invoice`, `shared-estimate` | app repo | **redeploy** |
| `support-notify`, `telegram-webhook` | app repo | **deploy** (new) |
| `ai-chat-optimized` | app repo | the assistant |
| `process-receipt`, `upload-receipt` | app repo | expenses |

**Secrets** (names, all on the project): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_WEBHOOK_SECRET_THIN`, `STRIPE_CONNECT_RETURN_URL`, `WEB_RETURN_URL`,
`APP_RETURN_SCHEME`, `GOCARDLESS_*_LIVE` / `_SANDBOX`, `GOCARDLESS_WEBHOOK_SECRET(_LIVE)`,
`RESEND_API_KEY`, `INVOICE_PAID_WEBHOOK_SECRET`, `ESTIMATE_RESPONDED_WEBHOOK_SECRET`,
`OPENAI_API_KEY`. To add: `SHARE_BASE_URL` (optional), `TELEGRAM_BOT_TOKEN`,
`TELEGRAM_WEBHOOK_SECRET`, `SUPPORT_NOTIFY_WEBHOOK_SECRET`, `OWNER_TELEGRAM_CHAT_ID`,
`SUPPORT_OWNER_NAME`.

**Tables / columns added this cycle**: `invoices.paid_notified_at`,
`estimates.responded_notified_at`, `estimate_shares.pdf_path`, `push_tokens`,
`support_threads`, `support_messages`. Column-name gotcha: `auth.users.uid`,
`profiles.id`, everything else `user_id`.

**Invoice statuses**: `draft`, `sent`, `partial`, `paid`, `overdue`. Activity types:
`created`, `edited`, `sent`, `paid` (+ payment-added etc.).

**Debugging the paid chain**: `net._http_response` holds the webhook call results;
`invoice-paid` logs in the function logs; `invoices.paid_notified_at` null means it
hasn't fired (or was released because nothing was delivered).

**Website content to update**
1. Hero/feature: AI assistant (section 3), with screenshots.
2. "Get paid" section: card payments via Stripe live, direct debit via GoCardless,
   PayPal and bank transfer; automatic Paid status, thank-you receipt to the client,
   instant notification to you.
3. Designs: seven, with the table above and images.
4. Founder chat line.
5. Pricing/limits page: AI usage on free vs paid (confirm numbers with Harry).
6. Screenshots everywhere are from the old invoice look; replace.

**Questions back to Harry/app agent if anything here doesn't match what's deployed**:
which Stripe events `stripe-webhook` actually handles; whether it still inserts
activities or emails; whether `send-invoice` bundles the renderer; the free-tier AI limits.

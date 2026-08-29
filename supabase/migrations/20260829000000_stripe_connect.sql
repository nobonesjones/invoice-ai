-- Stripe Connect: connected accounts + per-invoice payment links.
--
-- Configuration (Accounts v2, "SaaS platform with payments"):
--   dashboard: full, fees_collector: stripe, losses_collector: stripe, direct charges.
-- The connected account is merchant of record, pays its own Stripe fees, and
-- Stripe absorbs negative balances. The platform takes no application fee.

-- ---------------------------------------------------------------------------
-- payment_options: the user's connected account
-- ---------------------------------------------------------------------------

alter table public.payment_options
  add column if not exists stripe_account_id text,
  -- Mirrors configuration.merchant.capabilities.card_payments.status from the
  -- v2 Account. NOT the deprecated v1 charges_enabled boolean — only 'active'
  -- means the account can actually take money.
  add column if not exists stripe_card_payments_status text,
  add column if not exists stripe_onboarding_started_at timestamptz,
  add column if not exists stripe_connected_at timestamptz;

create unique index if not exists payment_options_stripe_account_id_key
  on public.payment_options (stripe_account_id)
  where stripe_account_id is not null;

-- These columns are written only by the edge functions using the service role,
-- from Stripe's own responses. Without this a user could PATCH their own row to
-- stripe_card_payments_status='active' and unlock a pay button backed by nothing.
revoke update (
  stripe_account_id,
  stripe_card_payments_status,
  stripe_onboarding_started_at,
  stripe_connected_at
) on public.payment_options from anon, authenticated;

-- ---------------------------------------------------------------------------
-- invoices: the payment link and settlement state
-- ---------------------------------------------------------------------------

alter table public.invoices
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_link_url text,
  add column if not exists stripe_payment_link_expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists amount_paid numeric;

create index if not exists invoices_stripe_checkout_session_id_idx
  on public.invoices (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

revoke update (
  stripe_checkout_session_id,
  stripe_payment_link_url,
  stripe_payment_link_expires_at,
  paid_at,
  amount_paid
) on public.invoices from anon, authenticated;

-- ---------------------------------------------------------------------------
-- stripe_events: webhook idempotency
-- ---------------------------------------------------------------------------

-- Stripe retries webhooks on any non-2xx and can deliver the same event twice
-- even on success. Without this table a retried checkout.session.completed
-- marks an invoice paid twice.
create table if not exists public.stripe_events (
  id text primary key,                 -- Stripe's evt_... id
  type text not null,
  account_id text,                     -- the connected account, for Connect events
  received_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
-- No policies: the service role bypasses RLS, every client is denied.

comment on table public.stripe_events is
  'Processed Stripe webhook event ids. Insert must happen in the same transaction as the side effect it guards.';

-- Closes a gap in 20260829000000_stripe_connect.sql.
--
-- That migration revoked UPDATE on the Stripe-controlled columns but not INSERT.
-- payment_options is written by the clients as an upsert, so a user with no row
-- yet could INSERT one with stripe_card_payments_status = 'active' and unlock a
-- pay button backed by no Stripe account at all. Revoking UPDATE alone only
-- protects users who already have a row.
--
-- NOTE FOR THE WEBSITE: after this, any client upsert whose payload *mentions*
-- these columns fails with 403 — including sending them back unchanged after a
-- read-modify-write. Strip them from the payload; they are service-role only.
-- Failing loudly is deliberate: the alternative is a silent security hole.

revoke insert (
  stripe_account_id,
  stripe_card_payments_status,
  stripe_onboarding_started_at,
  stripe_connected_at
) on public.payment_options from anon, authenticated;

revoke insert (
  stripe_checkout_session_id,
  stripe_payment_link_id,
  stripe_payment_link_url,
  stripe_payment_link_expires_at,
  paid_at,
  amount_paid
) on public.invoices from anon, authenticated;

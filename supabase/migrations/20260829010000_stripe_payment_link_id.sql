-- Payment Links rather than Checkout Sessions.
--
-- A Checkout Session expires between 30 minutes and 24 hours after creation.
-- An invoice sent over WhatsApp and paid four days later would hit a dead link,
-- so the durable Payment Link is the correct primitive. The session id is still
-- recorded when one is eventually paid, for reconciliation.

alter table public.invoices
  add column if not exists stripe_payment_link_id text;

create index if not exists invoices_stripe_payment_link_id_idx
  on public.invoices (stripe_payment_link_id)
  where stripe_payment_link_id is not null;

revoke update (stripe_payment_link_id) on public.invoices from anon, authenticated;

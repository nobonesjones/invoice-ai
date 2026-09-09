-- One "invoice paid" event, whichever way the money arrived.
--
-- Every path that marks an invoice paid (the Stripe webhook, a GoCardless
-- webhook, a finger on the Paid toggle) converges on the same UPDATE of
-- invoices.status. This migration hangs the shared behaviour off that update:
--
--   1. a 'paid' row in invoice_activities, written here in SQL so it can never
--      be forgotten by a caller, and so the invoice history sheet and the
--      client's activity feed light up for every method with no per-path code;
--   2. an idempotency marker (paid_notified_at) for the invoice-paid edge
--      function, which a Database Webhook on invoices UPDATE invokes to send
--      the payer's thank-you, the owner's "you've been paid" email, and a push;
--   3. the push_tokens table that push needs.
--
-- The Database Webhook itself is dashboard configuration (Database > Webhooks):
--   table invoices, event UPDATE, target the invoice-paid edge function, with
--   header  x-invoice-paid-secret: <INVOICE_PAID_WEBHOOK_SECRET>
-- The secret is deliberately not embedded here: a migration is committed to
-- git, and a webhook secret should not be.

-- ---------------------------------------------------------------------------
-- 1. idempotency marker
-- ---------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_notified_at timestamptz;

COMMENT ON COLUMN public.invoices.paid_notified_at IS
  'Set by the invoice-paid edge function once the paid notifications for this invoice have gone out. Cleared when the invoice leaves paid so a re-payment notifies again.';

-- ---------------------------------------------------------------------------
-- 2. push tokens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  platform    text,
  device_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  -- The same device re-registering must update its row, not add one; the
  -- token is what Expo keys a device by, so it is the natural key.
  CONSTRAINT push_tokens_token_key UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage their own push tokens" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. the paid event trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_invoice_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_symbol text;
BEGIN
  -- Only the transition into paid is the event. A paid invoice being edited
  -- (notes, a re-send) must not produce a second "paid" entry.
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    -- Currency symbol for the description. The invoice has no currency of its
    -- own; the app resolves it from business_settings, so do the same here.
    SELECT CASE split_part(COALESCE(bs.currency_code, 'USD'), ' ', 1)
             WHEN 'USD' THEN '$'  WHEN 'GBP' THEN '£'  WHEN 'EUR' THEN '€'
             WHEN 'AED' THEN 'AED ' WHEN 'AUD' THEN 'A$' WHEN 'CAD' THEN 'C$'
             WHEN 'INR' THEN '₹'  WHEN 'JPY' THEN '¥'  WHEN 'NZD' THEN 'NZ$'
             WHEN 'SGD' THEN 'S$' WHEN 'ZAR' THEN 'R'  WHEN 'CHF' THEN 'CHF '
             ELSE split_part(COALESCE(bs.currency_code, 'USD'), ' ', 1) || ' '
           END
      INTO v_symbol
      FROM business_settings bs
     WHERE bs.user_id = NEW.user_id
     LIMIT 1;

    INSERT INTO invoice_activities (
      invoice_id, user_id, activity_type, activity_description, activity_data
    ) VALUES (
      NEW.id,
      NEW.user_id,
      'paid',
      format('Invoice %s paid in full — %s%s',
             COALESCE(NEW.invoice_number, NEW.id::text),
             COALESCE(v_symbol, ''),
             to_char(COALESCE(NEW.paid_amount, NEW.total_amount, 0), 'FM999,999,990.00')),
      jsonb_build_object(
        'invoice_number', NEW.invoice_number,
        'payment_amount', COALESCE(NEW.paid_amount, NEW.total_amount),
        'currency_symbol', v_symbol,
        'payment_notes',  NEW.payment_notes,
        'payment_date',   NEW.payment_date
      )
    );

    -- Fresh transition, fresh notification cycle.
    NEW.paid_notified_at := NULL;

  ELSIF NEW.status IS DISTINCT FROM 'paid' AND OLD.status = 'paid' THEN
    -- Leaving paid (toggle flipped back, partial refund) resets the marker so
    -- a later re-payment is notified again rather than swallowed.
    NEW.paid_notified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_invoice_paid ON public.invoices;
CREATE TRIGGER trg_on_invoice_paid
  BEFORE UPDATE OF status ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.on_invoice_paid();

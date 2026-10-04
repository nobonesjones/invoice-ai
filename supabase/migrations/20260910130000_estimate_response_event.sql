-- Estimate response event: the client accepts or declines on the hosted page
-- (or the status changes any other way) and the owner hears about it once.
-- Mirrors 20260908090000_invoice_paid_event.sql.
--
-- The webhook function embeds the ESTIMATE_RESPONDED_WEBHOOK_SECRET value.
-- The committed copy carries a placeholder; the applied copy substitutes the
-- real secret (same one set on the estimate-responded edge function).

ALTER TABLE public.estimate_shares ADD COLUMN IF NOT EXISTS pdf_path text;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS responded_notified_at timestamptz;

-- Entering or leaving accepted/declined starts a fresh notification cycle,
-- mirroring invoices.paid_notified_at. Unlike on_invoice_paid this does NOT
-- write the history row: the shared-estimate page writes a richer one (ip,
-- user agent, share token) and in-app status changes log their own.
CREATE OR REPLACE FUNCTION public.on_estimate_responded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.status IN ('accepted', 'declined') AND OLD.status IS DISTINCT FROM NEW.status)
     OR (OLD.status IN ('accepted', 'declined') AND NEW.status NOT IN ('accepted', 'declined')) THEN
    NEW.responded_notified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_estimate_responded ON public.estimates;
CREATE TRIGGER trg_on_estimate_responded
  BEFORE UPDATE OF status ON public.estimates
  FOR EACH ROW EXECUTE FUNCTION public.on_estimate_responded();

-- Fire the estimate-responded edge function on every transition into
-- accepted or declined, whatever route caused it.
CREATE OR REPLACE FUNCTION public.estimate_responded_webhook_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/estimate-responded',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-estimate-responded-secret', '__ESTIMATE_RESPONDED_SECRET__'
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', to_jsonb(new),
      'old_record', to_jsonb(old)
    ),
    timeout_milliseconds := 5000
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS estimate_responded_webhook ON public.estimates;
CREATE TRIGGER estimate_responded_webhook
  AFTER UPDATE ON public.estimates
  FOR EACH ROW
  WHEN (new.status IN ('accepted', 'declined') AND new.status IS DISTINCT FROM old.status)
  EXECUTE FUNCTION public.estimate_responded_webhook_fn();

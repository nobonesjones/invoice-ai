-- Remove default payment terms that were automatically set for existing users
-- This prevents AI from automatically adding notes/terms to invoices unless specifically requested

-- Update existing payment_options rows that have the default payment terms message
UPDATE public.payment_options 
SET invoice_terms_notes = null 
WHERE invoice_terms_notes = 'Payment is due within 30 days of invoice date. Late payments may incur additional fees.';

-- Log how many rows were updated
DO $$
DECLARE
    updated_count integer;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % payment_options rows to remove default payment terms', updated_count;
END $$;
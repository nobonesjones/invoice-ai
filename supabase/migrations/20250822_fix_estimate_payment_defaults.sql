-- Fix estimate payment method defaults to match invoice behavior
-- Payment methods should default to false, not true

ALTER TABLE public.estimates 
ALTER COLUMN paypal_active SET DEFAULT false;

ALTER TABLE public.estimates 
ALTER COLUMN stripe_active SET DEFAULT false;

ALTER TABLE public.estimates 
ALTER COLUMN bank_account_active SET DEFAULT false;

-- Update existing estimates to respect global payment settings
-- This will set payment methods to false for existing estimates
-- Users can re-enable them if needed through the AI assistant

UPDATE public.estimates 
SET 
  paypal_active = false,
  stripe_active = false,
  bank_account_active = false
WHERE 
  paypal_active = true 
  OR stripe_active = true 
  OR bank_account_active = true;

-- Update existing estimates to match their user's global payment settings
-- Only if the user has configured payment options

UPDATE public.estimates 
SET 
  paypal_active = COALESCE(po.paypal_enabled, false),
  stripe_active = COALESCE(po.stripe_enabled, false),
  bank_account_active = COALESCE(po.bank_transfer_enabled, false)
FROM (
  SELECT 
    user_id,
    paypal_enabled,
    stripe_enabled,
    bank_transfer_enabled
  FROM public.payment_options
) po
WHERE estimates.user_id = po.user_id;
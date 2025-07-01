-- Add estimate terminology setting to business_settings table
ALTER TABLE public.business_settings 
ADD COLUMN estimate_terminology text DEFAULT 'estimate' CHECK (estimate_terminology IN ('estimate', 'quote'));

-- Update existing records to have the default value
UPDATE public.business_settings 
SET estimate_terminology = 'estimate' 
WHERE estimate_terminology IS NULL;

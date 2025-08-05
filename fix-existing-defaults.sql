-- Update all existing business_settings to use the new defaults
-- This will fix users who already have NULL values for these fields

UPDATE business_settings 
SET 
  default_invoice_design = 'clean',
  default_accent_color = '#1E40AF'
WHERE 
  default_invoice_design IS NULL 
  OR default_invoice_design = 'classic'
  OR default_accent_color IS NULL 
  OR default_accent_color = '#14B8A6';

-- Show the updated records
SELECT 
  user_id,
  default_invoice_design,
  default_accent_color,
  business_email
FROM business_settings
WHERE default_invoice_design = 'clean' AND default_accent_color = '#1E40AF';
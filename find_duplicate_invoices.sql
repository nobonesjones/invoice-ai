-- Find duplicate invoice numbers within the same user_id
-- This query identifies all duplicate combinations of (user_id, invoice_number)
-- and shows details to help decide which records to keep vs delete

WITH duplicate_combinations AS (
  -- Find user_id + invoice_number combinations that appear more than once
  SELECT 
    user_id,
    invoice_number,
    COUNT(*) as duplicate_count
  FROM invoices 
  GROUP BY user_id, invoice_number
  HAVING COUNT(*) > 1
),
duplicate_details AS (
  -- Get full details for all invoices that are part of duplicate combinations
  SELECT 
    i.user_id,
    i.invoice_number,
    i.id,
    i.created_at,
    i.updated_at,
    i.status,
    i.total_amount,
    i.client_id,
    dc.duplicate_count,
    -- Add row number to help identify which is oldest/newest
    ROW_NUMBER() OVER (
      PARTITION BY i.user_id, i.invoice_number 
      ORDER BY i.created_at ASC
    ) as creation_order,
    -- Add row number by update time to see most recently modified
    ROW_NUMBER() OVER (
      PARTITION BY i.user_id, i.invoice_number 
      ORDER BY i.updated_at DESC
    ) as update_order
  FROM invoices i
  INNER JOIN duplicate_combinations dc 
    ON i.user_id = dc.user_id 
    AND i.invoice_number = dc.invoice_number
)
-- Final result ordered for easy analysis
SELECT 
  user_id,
  invoice_number,
  id,
  created_at,
  updated_at,
  status,
  total_amount,
  client_id,
  duplicate_count,
  creation_order,
  update_order,
  -- Suggest which to keep (usually the first created, but flag if different)
  CASE 
    WHEN creation_order = 1 THEN 'KEEP (oldest)'
    WHEN update_order = 1 AND creation_order > 1 THEN 'CONSIDER (newest update)'
    ELSE 'DELETE'
  END as recommended_action
FROM duplicate_details
ORDER BY 
  user_id,
  invoice_number,
  created_at ASC;

-- Summary query to show the scope of the problem
-- Uncomment to run separately:
/*
SELECT 
  COUNT(DISTINCT CONCAT(user_id, '-', invoice_number)) as unique_combinations_with_duplicates,
  COUNT(*) as total_duplicate_records,
  COUNT(*) - COUNT(DISTINCT CONCAT(user_id, '-', invoice_number)) as records_to_delete
FROM invoices i
WHERE EXISTS (
  SELECT 1 
  FROM invoices i2 
  WHERE i2.user_id = i.user_id 
    AND i2.invoice_number = i.invoice_number 
    AND i2.id != i.id
);
*/
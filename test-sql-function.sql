-- Test if count_user_items function exists and create it if not
-- Run this in Supabase SQL Editor

-- First, check if function exists
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'count_user_items';

-- Create the function (will error if it already exists, which is fine)
CREATE OR REPLACE FUNCTION count_user_items(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER 
    FROM (
      SELECT id FROM invoices WHERE invoices.user_id = $1
      UNION ALL
      SELECT id FROM estimates WHERE estimates.user_id = $1
    ) AS items
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION count_user_items(UUID) TO authenticated;

-- Test the function with a dummy UUID
SELECT count_user_items('00000000-0000-0000-0000-000000000000'::UUID);
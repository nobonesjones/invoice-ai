-- Create RPC function to count user items (invoices + estimates)
-- This is used for enforcing free plan limits

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

-- Add helpful comment
COMMENT ON FUNCTION count_user_items(UUID) IS 'Counts total number of invoices and estimates for a user. Used for enforcing free plan limits.';
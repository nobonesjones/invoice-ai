
-- Manual upgrade for zell@gmail.com
-- Run this in Supabase SQL Editor

-- Insert premium profile for zell@gmail.com
INSERT INTO user_profiles (
  id, 
  subscription_tier, 
  free_limit, 
  subscription_expires_at,
  created_at, 
  updated_at
) VALUES (
  '32e70f05-64ab-4b6b-96c3-32772873b8a2',
  'premium',
  999999,
  NULL,
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  subscription_tier = 'premium',
  free_limit = 999999,
  subscription_expires_at = NULL,
  updated_at = NOW();

-- Verify the upgrade
SELECT id, subscription_tier, free_limit, created_at 
FROM user_profiles 
WHERE id = '32e70f05-64ab-4b6b-96c3-32772873b8a2';


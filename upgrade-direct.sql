-- Direct SQL to upgrade a user to premium
-- Replace USER_ID_HERE with the actual user UUID

-- Check current status
SELECT id, subscription_tier, free_limit, updated_at 
FROM user_profiles 
WHERE id = '534cfb6f-0355-4950-a838-b59b76b5fa7f';

-- If user exists, update them
UPDATE user_profiles 
SET 
    subscription_tier = 'premium',
    free_limit = 999999,
    subscription_expires_at = NULL,
    updated_at = NOW()
WHERE id = '534cfb6f-0355-4950-a838-b59b76b5fa7f';

-- If user doesn't exist, create them
INSERT INTO user_profiles (
    id, 
    subscription_tier, 
    free_limit, 
    subscription_expires_at,
    created_at, 
    updated_at
) VALUES (
    '534cfb6f-0355-4950-a838-b59b76b5fa7f',
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

-- Verify the change
SELECT id, subscription_tier, free_limit, updated_at 
FROM user_profiles 
WHERE id = '534cfb6f-0355-4950-a838-b59b76b5fa7f';
# Database Schema Issues & Solutions

## The Problem

The AI cannot find users like `zell@gmail.com` because of a critical database schema issue:

1. **User exists in `auth.users`** with ID: `32e70f05-64ab-4b6b-96c3-32772873b8a2`
2. **No corresponding record in `profiles` table**
3. **Most application queries join through the `profiles` table**

## Why This Happens

### Column Naming Convention
- **auth.users**: Primary key is `id` 
- **All other tables**: Foreign key is `user_id`
- **profiles table**: Primary key is `id` (matches auth.users.id)

### The Missing Link
When a user signs up through auth but doesn't complete onboarding or profile creation:
- They exist in `auth.users` ✅
- They have NO record in `profiles` ❌
- All their data (invoices, estimates, etc.) references a user_id that has no profile

## Database Relationships

```
auth.users
├── id (UUID) ←──────────┐
├── email                │
└── ...                  │
                         │ 1:1
profiles                 │
├── id (UUID) ───────────┘ (MUST match auth.users.id)
├── email
├── subscription_tier
└── ...

invoices, estimates, items, clients, companies
├── id (UUID - their own primary key)
├── user_id (UUID) ──────→ references profiles.id/auth.users.id
└── ...
```

## How to Find "Lost" Users

### 1. Find User in Auth
```sql
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'zell@gmail.com';
```

### 2. Check if Profile Exists
```sql
SELECT * FROM profiles 
WHERE id = '32e70f05-64ab-4b6b-96c3-32772873b8a2';
```

### 3. Find Their Data (Direct Queries)
```sql
-- Find invoices without joining profiles
SELECT * FROM invoices 
WHERE user_id = '32e70f05-64ab-4b6b-96c3-32772873b8a2';

-- Find estimates
SELECT * FROM estimates 
WHERE user_id = '32e70f05-64ab-4b6b-96c3-32772873b8a2';
```

## The Fix

### Immediate Solution
Create the missing profile record:

```sql
INSERT INTO profiles (id, email, subscription_tier, created_at, updated_at)
VALUES (
  '32e70f05-64ab-4b6b-96c3-32772873b8a2',
  'zell@gmail.com',
  'free',
  NOW(),
  NOW()
);
```

### Long-term Solutions

1. **Database Trigger**: Auto-create profile when user signs up
```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

2. **Application Code**: Ensure profile creation on signup
3. **Data Integrity Check**: Regular script to find users without profiles

## Helper Functions

### Find Users Without Profiles
```sql
CREATE OR REPLACE FUNCTION find_orphaned_users()
RETURNS TABLE (
  user_id uuid,
  email text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT au.id, au.email, au.created_at
  FROM auth.users au
  LEFT JOIN profiles p ON au.id = p.id
  WHERE p.id IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Count User Data Without Profile
```sql
CREATE OR REPLACE FUNCTION count_orphaned_data(user_uuid uuid)
RETURNS TABLE (
  invoices_count bigint,
  estimates_count bigint,
  items_count bigint,
  clients_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM invoices WHERE user_id = user_uuid),
    (SELECT COUNT(*) FROM estimates WHERE user_id = user_uuid),
    (SELECT COUNT(*) FROM items WHERE user_id = user_uuid),
    (SELECT COUNT(*) FROM clients WHERE user_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Key Takeaways

1. **Always check both `auth.users` AND `profiles`** when debugging user issues
2. **The profiles table is the critical link** for all user data
3. **Direct queries using user_id** can find "orphaned" data
4. **Implement safeguards** to prevent this issue in the future
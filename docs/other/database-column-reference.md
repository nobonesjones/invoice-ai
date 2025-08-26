# Database Column Reference - User ID Naming

## CRITICAL: Column Naming Inconsistency

**The core issue**: User identifiers use different column names across tables. This causes AI search failures when joining tables.

## User ID Column Names by Table

| Table | User ID Column | Notes |
|-------|----------------|--------|
| `auth.users` | `uid` | Primary authentication table |
| `profiles` | `id` | Should match auth.users.uid |
| `invoices` | `user_id` | Foreign key reference |
| `estimates` | `user_id` | Foreign key reference |
| `items` | `user_id` | Foreign key reference |
| `clients` | `user_id` | Foreign key reference |
| `companies` | `user_id` | Foreign key reference |
| `business_settings` | `user_id` | Foreign key reference |

## Correct Query Patterns

### ❌ WRONG - Don't assume column names
```sql
-- This will fail - using wrong column name
SELECT * FROM auth.users u
JOIN profiles p ON u.id = p.user_id
WHERE u.email = 'user@example.com';
```

### ✅ CORRECT - Use proper column names
```sql
-- Correct auth to profiles join
SELECT * FROM auth.users u
JOIN profiles p ON u.uid = p.id
WHERE u.email = 'user@example.com';

-- Find user's invoices
SELECT i.* FROM auth.users u
JOIN invoices i ON u.uid = i.user_id
WHERE u.email = 'user@example.com';
```

## AI Search Guidelines

When searching for users:

1. **Start with email in auth.users**:
   ```sql
   SELECT uid, email FROM auth.users WHERE email = 'target@email.com';
   ```

2. **Use the uid to find profile**:
   ```sql
   SELECT * FROM profiles WHERE id = '{uid_from_step_1}';
   ```

3. **Use the uid to find all related data**:
   ```sql
   SELECT * FROM invoices WHERE user_id = '{uid_from_step_1}';
   SELECT * FROM estimates WHERE user_id = '{uid_from_step_1}';
   SELECT * FROM items WHERE user_id = '{uid_from_step_1}';
   -- etc.
   ```

## Common Join Patterns

### User with Profile
```sql
SELECT u.email, p.*
FROM auth.users u
JOIN profiles p ON u.uid = p.id
WHERE u.email = 'user@example.com';
```

### User with Invoices
```sql
SELECT u.email, i.*
FROM auth.users u
JOIN invoices i ON u.uid = i.user_id
WHERE u.email = 'user@example.com';
```

### Complete User Data
```sql
SELECT 
  u.email,
  p.subscription_tier,
  COUNT(i.id) as invoice_count,
  COUNT(e.id) as estimate_count
FROM auth.users u
LEFT JOIN profiles p ON u.uid = p.id
LEFT JOIN invoices i ON u.uid = i.user_id
LEFT JOIN estimates e ON u.uid = e.user_id
WHERE u.email = 'user@example.com'
GROUP BY u.email, p.subscription_tier;
```

## Quick Reference Commands

### Find user by email
```bash
# Get their UID first
SELECT uid FROM auth.users WHERE email = 'user@example.com';

# Then use that UID for all other queries
SELECT * FROM profiles WHERE id = '{uid}';
SELECT * FROM invoices WHERE user_id = '{uid}';
```

## ⚠️ REMEMBER
- **auth.users**: Use `uid`
- **profiles**: Use `id` (matches auth.users.uid)
- **Everything else**: Use `user_id`

The app works fine because the relationships are correct - only AI searches fail when using wrong column names.
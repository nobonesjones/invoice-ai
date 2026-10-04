# Database Query Guidelines for Invoice AI

## CRITICAL: User ID Column Names

**Column names for user identifiers differ across tables. Verified 2026-09-12: `auth.users` uses `id`, not `uid`.**

| Table | User ID Column |
|-------|----------------|
| `auth.users` | `id` |
| `profiles` | `id` |
| All other tables | `user_id` |

## Finding Users - Correct Pattern

1. **Find by email in auth.users**:
   ```sql
   SELECT id FROM auth.users WHERE email = 'user@example.com';
   ```

2. **Use that UID for all other queries**:
   ```sql
   SELECT * FROM profiles WHERE id = '{uid}';
   SELECT * FROM invoices WHERE user_id = '{uid}';
   SELECT * FROM estimates WHERE user_id = '{uid}';
   ```

## Joins - Use Correct Column Names

```sql
-- Auth to Profile
SELECT * FROM auth.users u
JOIN profiles p ON u.id = p.id

-- Auth to Invoices  
SELECT * FROM auth.users u
JOIN invoices i ON u.id = i.user_id

-- Profile to Invoices
SELECT * FROM profiles p
JOIN invoices i ON p.id = i.user_id
```

## Common User Search Query

```sql
SELECT 
  u.id,
  u.email,
  p.subscription_tier,
  COUNT(i.id) as invoices,
  COUNT(e.id) as estimates
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id  
LEFT JOIN invoices i ON u.id = i.user_id
LEFT JOIN estimates e ON u.id = e.user_id
WHERE u.email = 'target@email.com'
GROUP BY u.id, u.email, p.subscription_tier;
```

**Remember**: The app works fine - only AI searches fail when using wrong column names!
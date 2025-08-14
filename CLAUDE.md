# Database Query Guidelines for Invoice AI

## CRITICAL: User ID Column Names

**The app uses inconsistent column names for user identifiers across tables. Always use the correct column name for each table:**

| Table | User ID Column |
|-------|----------------|
| `auth.users` | `uid` |
| `profiles` | `id` |
| All other tables | `user_id` |

## Finding Users - Correct Pattern

1. **Find by email in auth.users**:
   ```sql
   SELECT uid FROM auth.users WHERE email = 'user@example.com';
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
JOIN profiles p ON u.uid = p.id

-- Auth to Invoices  
SELECT * FROM auth.users u
JOIN invoices i ON u.uid = i.user_id

-- Profile to Invoices
SELECT * FROM profiles p
JOIN invoices i ON p.id = i.user_id
```

## Common User Search Query

```sql
SELECT 
  u.uid,
  u.email,
  p.subscription_tier,
  COUNT(i.id) as invoices,
  COUNT(e.id) as estimates
FROM auth.users u
LEFT JOIN profiles p ON u.uid = p.id  
LEFT JOIN invoices i ON u.uid = i.user_id
LEFT JOIN estimates e ON u.uid = e.user_id
WHERE u.email = 'target@email.com'
GROUP BY u.uid, u.email, p.subscription_tier;
```

**Remember**: The app works fine - only AI searches fail when using wrong column names!
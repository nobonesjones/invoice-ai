
-- Check actual invoice table structure and zell data
-- Run this in Supabase SQL Editor

-- First, check the invoices table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if zell's UUID exists in invoices
SELECT * FROM invoices 
WHERE user_id = '32e70f05-64ab-4b6b-96c3-32772873b8a2'
LIMIT 5;

-- Check all recent invoices to see the structure
SELECT user_id, id, created_at
FROM invoices 
ORDER BY created_at DESC 
LIMIT 10;


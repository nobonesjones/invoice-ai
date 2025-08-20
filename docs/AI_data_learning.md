# AI Chat Database Integration - Critical Learnings & Debugging Guide

## Overview
This document captures the key learnings, common pitfalls, and debugging strategies discovered while implementing AI chat functionality for invoice management. Use this as a cheat sheet when implementing similar features for estimates, payments, or other database operations.

## 🚨 Critical Database Schema Assumptions

### ❌ Common Mistake: Assuming JSON Storage
**Wrong Assumption**: Line items are stored as JSON arrays in a `line_items` column on the main table.

**Reality**: Line items are stored in separate relational tables:
- `invoices` table: Contains metadata and totals
- `invoice_line_items` table: Contains individual line items with FK relationships

### ✅ Always Verify Schema First
```sql
-- Check actual table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoices';

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'invoice_line_items';
```

## 🔍 Database Column Name Mismatches

### Common Column Name Errors
| Function Assumed | Actual Column Name | Fix Required |
|-----------------|-------------------|--------------|
| `subtotal` | `subtotal_amount` | ✅ Fixed |
| `total` | `total_amount` | ✅ Fixed |
| `discount_amount` | `discount_value` | ✅ Fixed |
| `tax_amount` | `tax_percentage` | ✅ Fixed |
| `line_items` | N/A (separate table) | ✅ Fixed |
| `enable_stripe_payments` | `stripe_active` | ✅ Fixed |
| `enable_paypal_payments` | `paypal_active` | ✅ Fixed |
| `enable_bank_transfer_payments` | `bank_account_active` | ✅ Fixed |
| `client_name` (in invoices) | N/A (clients table only) | ✅ Fixed |
| `client_email` (in invoices) | N/A (clients table only) | ✅ Fixed |

### ✅ Best Practice: Match Creation Schema
Always check how records are created to understand the exact column names:
```typescript
// Look for the .insert() statements in creation functions
const { data: invoice } = await supabase
  .from('invoices')
  .insert({
    subtotal_amount: subtotal,  // Not 'subtotal'
    total_amount: total,        // Not 'total'
    // ... etc
  })
```

## 🛠 Function Implementation Patterns

### 1. Variable Name Errors
**❌ Wrong**: Using `parameters` instead of `parsedArgs`
```typescript
const { invoice_identifier } = parameters  // ReferenceError
```

**✅ Correct**: 
```typescript
const { invoice_identifier } = parsedArgs
```

### 2. Missing Function Definitions
**❌ Wrong**: Calling undefined functions
```typescript
const result = await findInvoice(supabase, user_id, invoice_id)  // ReferenceError
```

**✅ Correct**: Implement the function or use inline logic
```typescript
async function findInvoice(supabase, user_id, invoice_identifier) {
  // Implementation here
}
```

### 3. Database Operation Patterns

#### ✅ Correct add_line_item Pattern:
```typescript
// 1. Find target invoice
const targetInvoice = await findInvoice(supabase, user_id, invoice_identifier)

// 2. Insert into separate line items table
const { data: newLineItem } = await supabase
  .from('invoice_line_items')
  .insert({
    invoice_id: targetInvoice.id,
    user_id: user_id,
    item_name,
    quantity: quantity || 1,
    unit_price,
    total_price: (quantity || 1) * unit_price
  })

// 3. Recalculate totals from ALL line items
const { data: allLineItems } = await supabase
  .from('invoice_line_items')
  .select('*')
  .eq('invoice_id', targetInvoice.id)

const subtotal = allLineItems.reduce((sum, item) => sum + item.total_price, 0)

// 4. Update main record totals
await supabase
  .from('invoices')
  .update({ 
    subtotal_amount: subtotal,
    total_amount: total 
  })
  .eq('id', targetInvoice.id)

// 5. Create attachment for chat
attachments.push({
  type: 'invoice',
  invoice_id: targetInvoice.id,
  invoice: updatedInvoice,
  line_items: allLineItems,
  client_id: targetInvoice.client_id,
  client: clientData
})
```

## 🎯 Context Awareness Issues

### ❌ Wrong: AI Creating New Records Instead of Updating
**Problem**: When user says "add item to THE invoice", AI creates new invoice instead of updating existing one.

**✅ Solution**: Explicit context awareness instructions
```typescript
CRITICAL CONTEXT AWARENESS:
When user says "add [item] to THE INVOICE" or "add [item] to THIS INVOICE":
• NEVER create a new invoice
• ALWAYS use add_line_item function with invoice_identifier: "latest"
• The user is referring to the most recently created invoice in the conversation
```

## 🔄 Invoice Attachments in Chat

### ❌ Wrong: Only Returning Text Messages
Functions that modify invoices were only returning text, not showing updated invoice previews.

### ✅ Correct: Always Create Attachments
Every function that modifies an invoice/estimate MUST create an attachment:

```typescript
// Get updated data
const { data: updatedInvoice } = await supabase
  .from('invoices')
  .select('*')
  .eq('id', targetInvoice.id)
  .single()

// Get client data
let clientData = null
if (targetInvoice.client_id) {
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', targetInvoice.client_id)
    .single()
  clientData = client
}

// Create attachment
attachments.push({
  type: 'invoice',
  invoice_id: targetInvoice.id,
  invoice: updatedInvoice,
  line_items: allLineItems, // Fresh from DB
  client_id: targetInvoice.client_id,
  client: clientData
})
```

## 🐛 Debugging Strategy

### 1. Add Comprehensive Logging
```typescript
console.log('[function_name] Starting with:', { param1, param2 })
console.log('[function_name] Found records:', records?.length || 0)
console.log('[function_name] Database error:', error)
console.log('[function_name] Success:', result)
```

### 2. Check Database Errors First
Look for PostgREST error codes:
- `PGRST204`: Column not found in schema
- `PGRST116`: No rows found
- `PGRST301`: Row level security violation

### 3. Verify Schema Assumptions
```typescript
// Log the actual data structure
console.log('[debug] Target invoice structure:', JSON.stringify(targetInvoice, null, 2))
```

## 📋 Implementation Checklist

When implementing new AI database functions:

### ✅ Before Writing Code:
- [ ] Check actual database schema in Supabase dashboard
- [ ] Verify column names by looking at creation functions
- [ ] Understand relationship structure (separate tables vs JSON columns)
- [ ] Check if line items are stored separately

### ✅ Function Implementation:
- [ ] Use `parsedArgs` not `parameters`
- [ ] Implement or define all helper functions (like `findInvoice`)
- [ ] Match exact column names from creation schema
- [ ] Handle both success and error cases with logging

### ✅ Database Operations:
- [ ] Use correct table names (`invoice_line_items` not `line_items` column)
- [ ] Use correct column names (`subtotal_amount` not `subtotal`)
- [ ] Update by ID when possible, not by other fields
- [ ] Recalculate totals from fresh database data

### ✅ Chat Integration:
- [ ] Create attachment for updated record
- [ ] Include all necessary data (invoice, line_items, client)
- [ ] Return meaningful success message
- [ ] Add comprehensive error handling

### ✅ Context Awareness:
- [ ] Add specific instructions for update vs create scenarios
- [ ] Use "latest" identifier for recent records
- [ ] Provide clear examples in AI instructions

## 🎯 Apply to Estimates

When implementing estimate functionality, expect similar patterns:
- `estimates` table with metadata
- `estimate_line_items` table with separate line items  
- Column names likely: `subtotal_amount`, `total_amount`
- Same attachment pattern needed
- Same context awareness issues

## 🚀 Quick Reference Commands

### Find Schema:
```sql
\d+ invoices
\d+ invoice_line_items
```

### Debug Edge Function:
```bash
supabase functions deploy function-name
# Watch logs in Supabase dashboard
```

### Test Database Access:
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .limit(1)
console.log('Schema check:', { data, error })
```

---

**Key Takeaway**: Always verify your database schema assumptions before implementing AI functions. The biggest time-wasters were incorrect assumptions about column names and table structure.
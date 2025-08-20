# AI Chat Database Integration - Critical Learnings & Debugging Guide

## Overview
This document captures the key learnings, common pitfalls, and debugging strategies discovered while implementing AI chat functionality for invoice management. Use this as a cheat sheet when implementing similar features for estimates, payments, or other database operations.

## 🚨 STEP 0: IDENTIFY CORRECT FUNCTION FILE (CRITICAL)

**⚠️ BEFORE TOUCHING ANY CODE - VERIFY WHICH FUNCTION IS ACTIVE:**

### ❌ COMMON MISTAKE: Editing Deprecated Functions
Many functions exist but only ONE is currently active. Editing the wrong file wastes hours of debugging.

### ✅ ACTIVE FUNCTION FILES:
```
📁 supabase/functions/
├── ai-chat-assistants-poc/     ✅ ACTIVE - Edit this one
├── ai-chat-optimized/          ❌ DEPRECATED - Do not edit  
├── ai-chat/                    ❌ DEPRECATED - Do not edit
└── other-functions/            ❓ Check before editing
```

### 🔍 How to Identify Active Function:
1. **Check deployment logs** in Supabase dashboard
2. **Look for recent error messages** - they'll show the active function name
3. **Ask the user** which function is currently deployed
4. **Test by adding console.log** in suspected active function

### 🚨 CRITICAL RULE:
**ALWAYS confirm you're editing the active function before making ANY changes.**

**Recent Examples:** 
- We spent time fixing `ai-chat-optimized` but the active function was `ai-chat-assistants-poc`, causing continued PGRST204 errors.
- Business settings updates were failing because `update_business_settings` function was targeting the `profiles` table instead of the `business_settings` table.

## 🚨 STEP 1: ALWAYS VERIFY SCHEMA FIRST (CRITICAL)

**⚠️ BEFORE WRITING ANY AI FUNCTION CODE - DO THIS FIRST:**

### 1. Check Exact Column Names
```sql
-- Run these queries in Supabase SQL Editor FIRST
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'clients'
ORDER BY column_name;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'invoices'
ORDER BY column_name;
```

### 2. Never Use table(*) Wildcards
❌ **NEVER use `clients(*)` or `table(*)` in SELECT statements**
✅ **ALWAYS use explicit column lists**

### 3. Test Parameter Mapping
```typescript
// Test the exact parameter names the AI function will receive
console.log('Function params:', params);
console.log('Mapped to database:', { 
  email: params.email,           // ✅ maps to clients.email  
  phone: params.phone,           // ✅ maps to clients.phone
  address: params.address        // ✅ maps to clients.address_client
});
```

**🔥 CRITICAL RULE: Schema verification prevents 90% of database function failures**

## 🚨 MOST COMMON ERROR: PGRST204 "Column not found"

**Symptoms:** "Could not find the 'address' column of 'clients' in the schema cache"

**Root Cause:** Using `clients(*)` wildcard instead of explicit column list

**Quick Fix:**
```typescript
// ❌ CAUSES PGRST204 ERROR:
.select(`*, clients(*)`)

// ✅ ALWAYS WORKS:
.select(`*, clients(id, name, email, phone, address_client, notes, tax_number, created_at, updated_at)`)
```

**Why it happens:** Supabase schema cache expects column names that don't exist when expanding wildcards.

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
| `clients(*)` in SELECT | Explicit column list | ✅ Fixed |
| `clients.address` | `clients.address_client` | ✅ Fixed |
| `profiles` table for business settings | `business_settings` table | ✅ Fixed |

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

**🚨 PGRST204: Column not found in schema**
- **Most common cause**: Using `table(*)` wildcards instead of explicit columns
- **Example error**: "Could not find the 'address' column of 'clients'"
- **Fix**: Replace `clients(*)` with `clients(id, name, email, phone, address_client, ...)`
- **Debug**: Run schema query to see exact column names

**Other codes:**
- `PGRST116`: No rows found
- `PGRST301`: Row level security violation

### 3. Verify Schema Assumptions
```typescript
// Log the actual data structure
console.log('[debug] Target invoice structure:', JSON.stringify(targetInvoice, null, 2))
```

## 📋 Implementation Checklist

When implementing new AI database functions:

### ✅ STEP 0: Function File Verification (MANDATORY):
- [ ] 🚨 **CONFIRM ACTIVE FUNCTION FILE** (see Step 0 above)  
- [ ] 🚨 **CHECK DEPLOYMENT LOGS** for function name in errors
- [ ] 🚨 **VERIFY WITH USER** which function is currently active
- [ ] 🚨 **TEST CHANGES** deploy to correct function only

### ✅ STEP 1: Schema Verification (MANDATORY):
- [ ] 🚨 **RUN SCHEMA QUERIES FIRST** (see Step 1 above)
- [ ] 🚨 **NEVER use table(*) wildcards** - always explicit columns
- [ ] 🚨 **Test parameter mapping** with console.log
- [ ] Verify column names match creation functions exactly
- [ ] Check actual database schema in Supabase dashboard
- [ ] Understand relationship structure (separate tables vs JSON columns)
- [ ] Confirm address fields: `address_client` NOT `address`

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

## 🚨 CRITICAL: clients(*) Schema Issue

### ❌ Problem: PGRST204 "Could not find the 'address' column of 'clients'"
When using `clients(*)` in Supabase SELECT statements, the query expansion can fail if the schema cache expects different column names.

### ✅ Solution: Use Explicit Column Lists
Instead of `clients(*)`, always specify exact column names:

**❌ Wrong:**
```typescript
.select(`
  *,
  invoice_line_items(*),
  clients(*)
`)
```

**✅ Correct:**
```typescript
.select(`
  *,
  invoice_line_items(*),
  clients(id, name, email, phone, address_client, notes, tax_number, created_at, updated_at)
`)
```

### 📋 Clients Table Column Reference
- `id, name, email, phone` - Basic info
- `address_client` - NOT `address`  
- `notes, tax_number` - Additional data
- `created_at, updated_at` - Timestamps

**Key Takeaway**: Always verify your database schema assumptions before implementing AI functions. The biggest time-wasters were incorrect assumptions about column names and table structure. Always use explicit column lists instead of `table(*)` to avoid schema cache issues.

---

## 🚨 BUSINESS SETTINGS TABLE ERRORS

### ❌ Critical Error: Wrong Table Target
**Problem**: `update_business_settings` function was targeting the `profiles` table instead of `business_settings` table.

**Symptoms**: Function appears to work but business settings don't persist or show in invoices.

**Root Cause**: Incorrect table name in function implementation:
```typescript
// ❌ WRONG TABLE:
.from('profiles')
.update(updateData)

// ✅ CORRECT TABLE:  
.from('business_settings')
.update(updateData)
```

### ✅ Business Settings Schema Mapping
Based on schema provided:

| Function Parameter | Database Column | Notes |
|-------------------|-----------------|-------|
| `business_name` | `business_name` | ✅ Direct match |
| `business_address` | `business_address` | ✅ Direct match |
| `business_phone` | `business_phone` | ✅ Direct match |
| `business_email` | `business_email` | ✅ Direct match |
| `business_website` | `business_website` | ✅ Direct match |
| `tax_number` | `tax_number` | ✅ Direct match |
| `tax_name` | `tax_name` | ✅ Direct match |
| `default_tax_rate` | `default_tax_rate` | ✅ Direct match |
| `auto_apply_tax` | `auto_apply_tax` | ✅ Direct match |
| N/A | `business_logo_url` | Available in schema |

### 🔧 Fixed Implementation
```typescript
// 🚨 CRITICAL FIX: Update business_settings table, not profiles table!
const { data: settings, error: settingsError } = await supabase
  .from('business_settings')  // ← Correct table
  .update(updateData)
  .eq('user_id', user_id)
  .select()
  .single()
```

### 🆕 Tax Control Features Added
The `update_business_settings` function now supports complete tax control:

**Tax Label Control:**
- `tax_name`: Set custom tax label (e.g., "VAT", "Sales Tax", "GST")
- Example: "Set my tax label to VAT"

**Tax Rate Control:**
- `default_tax_rate`: Set default tax percentage
- Example: "Set my tax rate to 20%"

**Auto-Apply Toggle:**
- `auto_apply_tax`: Enable/disable automatic tax application to new invoices
- Example: "Turn off auto tax" or "Enable automatic tax"

**Usage Examples:**
```
"Set my tax rate to 15% and call it Sales Tax"
"Disable automatic tax on new invoices"
"Change tax label to GST and set rate to 10%"
"Turn on auto tax application"
```

---

## 🚨 PAYMENT OPTIONS INTEGRATION FIXED

### ❌ Critical Errors Fixed
**Problem**: Payment options functions were using wrong table references and missing required workflow functions.

**Issues Fixed:**
1. `enable_payment_methods` was checking `profiles` table instead of `payment_options` table
2. Missing `get_payment_options` function to check current status
3. Missing `setup_paypal_payments` function for PayPal email collection
4. Missing `setup_bank_transfer` function for bank details collection
5. Function definitions included unused venmo/ach parameters

### ✅ Payment Options Workflow (Fixed)

**Correct Table Schema Mapping:**
- `payment_options` table: `paypal_enabled`, `stripe_enabled`, `bank_transfer_enabled`, `paypal_email`, `bank_details`
- `invoices` table: `paypal_active`, `stripe_active`, `bank_account_active`

**New Functions Added:**

**1. get_payment_options**
- Purpose: Check current payment method status
- Usage: "What payment methods do I have enabled?"

**2. setup_paypal_payments**  
- Purpose: Enable PayPal and set email address
- Parameters: `paypal_email` (required), `invoice_number` (optional)
- Updates: `payment_options` table + optional invoice activation
- Usage: "Enable PayPal with email user@paypal.com"

**3. setup_bank_transfer**
- Purpose: Enable bank transfer and set bank details  
- Parameters: `bank_details` (required), `invoice_number` (optional)
- Updates: `payment_options` table + optional invoice activation
- Usage: "Set up bank transfer with account details: [bank info]"

**4. enable_payment_methods (Fixed)**
- Now correctly checks `payment_options` table instead of `profiles`
- Removed venmo/ach parameters (not in schema)
- Purpose: Activate enabled payment methods on specific invoices

### 🎯 Payment Setup Rules Implemented

**For Stripe:**
- User must enable in Settings > Payment Options (manual)
- AI can then activate on invoices using `enable_payment_methods`

**For PayPal & Bank Transfer:**
- AI can collect details and enable using `setup_paypal_payments`/`setup_bank_transfer`
- AI can simultaneously activate on invoice if `invoice_number` provided
- Follows workflow: setup → enable → show updated invoice

**Workflow Example:**
```
User: "Add PayPal to this invoice"
AI: "I'll set up PayPal for you. What's your PayPal email address?"
User: "payments@business.com"  
AI: Calls setup_paypal_payments(paypal_email="payments@business.com", invoice_number="INV-123")
Result: PayPal enabled globally + activated on invoice + shows updated invoice
```

---

## 🚨 TEMPLATE LITERAL SCOPE ERROR FIXED

### ❌ Critical Error: contextString is not defined
**Problem**: ReferenceError at line 1369 - `contextString` variable used outside its scope.

**Root Cause**: Duplicate assistant instructions in create vs update blocks. The `contextString` variable was declared in the main function scope but referenced in the fallback assistant.create() block where it wasn't available.

**Code Structure Issue:**
```typescript
// ✅ CORRECT: contextString defined and used in update block
let contextString = '';
assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
  instructions: `...${contextString}...`  // ← Works fine
})

// ❌ ERROR: contextString used in create block but not in scope
} catch (error) {
  assistant = await openai.beta.assistants.create({
    instructions: `...${contextString}...`  // ← ReferenceError!
  })
}
```

**✅ Fixed**: Replaced undefined `${contextString}` with static text in create assistant block:
```typescript
**CONVERSATION MEMORY RULES:**
• Context will be dynamically loaded based on user conversation
```

**Lesson**: Always check variable scope when using template literals across different code blocks, especially in try/catch scenarios.

---

## 🧠 CONVERSATION MEMORY & CONTEXT SYSTEM

### ❌ Problem: AI Loses Context After Actions
**Issue**: User creates invoice, then asks to "add Oliver's address" → AI asks "create invoice first?"

**Root Cause**: No conversation memory between function calls.

### ✅ Solution: Perfect Context Tracking System

#### 1. Conversation Memory Class
```typescript
class ConversationMemory {
  static lastActions = new Map(); // userId -> { action: 'created_invoice', invoice_number: 'INV-123' }
  
  static setLastAction(userId: string, action: string, details: any = {}) {
    this.lastActions.set(userId, {
      action,
      ...details,
      timestamp: new Date()
    });
  }
  
  static getLastAction(userId: string) {
    const action = this.lastActions.get(userId);
    // Expire after 30 minutes
    if (action && (new Date().getTime() - action.timestamp.getTime()) > 30 * 60 * 1000) {
      this.lastActions.delete(userId);
      return null;
    }
    return action;
  }
}
```

#### 2. Context Detection Engine
```typescript
function detectConversationContext(message: string, userId: string): 'create' | 'update_latest' | 'update_specific' | 'general' {
  const lowerMessage = message.toLowerCase();
  const lastAction = ConversationMemory.getLastAction(userId);
  
  // Check update keywords + context references
  const updateKeywords = ['add', 'update', 'change', 'modify', 'edit', 'set', 'include'];
  const contextReferences = ['the invoice', 'this invoice', 'it', 'the client', 'address', 'his', 'her'];
  
  const hasUpdateKeyword = updateKeywords.some(keyword => lowerMessage.includes(keyword));
  const hasContextReference = contextReferences.some(ref => lowerMessage.includes(ref));
  
  // If user just did something and now wants to modify it
  if (hasUpdateKeyword && (hasContextReference || lastAction)) {
    return 'update_latest';
  }
  
  return 'general';
}
```

#### 3. Memory Tracking in Functions
```typescript
// In create_invoice function:
ConversationMemory.setLastAction(user_id, 'created_invoice', {
  invoice_number: invoice_number,
  client_name: client_name,
  invoice_id: invoice.id,
  client_id: clientId
});

// In update_client_info function:
ConversationMemory.setLastAction(user_id, 'updated_client_info', {
  invoice_number: targetInvoice.invoice_number,
  client_name: client_name,
  invoice_id: targetInvoice.id
});
```

#### 4. Dynamic Context Injection
```typescript
if (conversationContext === 'update_latest' && lastAction) {
  contextString = `\n\nACTIVE CONVERSATION CONTEXT:\n`;
  contextString += `• Last action: ${lastAction.action}\n`;
  contextString += `• Current invoice: ${lastAction.invoice_number}\n`;
  contextString += `• When user says "add", "update", "change" - they mean THIS invoice/client\n`;
  contextString += `• Use invoice_identifier: "latest"\n`;
}
```

#### 5. Aggressive AI Prompt Context Rules
```typescript
🚨🚨 CRITICAL CONTEXT AWARENESS - NEVER LOSE CONTEXT! 🚨🚨

**PERFECT CONTEXT DETECTION:**
When I just created an invoice/client and user says:
• "add [something]" → They mean add to THAT invoice (use "latest")
• "update [something]" → They mean update THAT invoice/client  
• "change [something]" → They mean change THAT invoice/client

**EXAMPLES WITH PERFECT CONTEXT:**
User: "Create invoice for Oliver" 
AI: Creates invoice INV-006 for Oliver
User: "Add his address: Ostern way road" 
AI: MUST use update_client_info(invoice_identifier: "latest", client_address: "Ostern way road")

**NEVER ASK FOR CLARIFICATION WHEN CONTEXT IS OBVIOUS:**
❌ WRONG: "I need to first create the invoice for Oliver"
✅ RIGHT: Immediately update the client info on the just-created invoice
```

### 🎯 Result: Perfect Context Awareness
- **Before**: "Create invoice for Oliver" → "Add his address" → "Need to create invoice first"
- **After**: "Create invoice for Oliver" → "Add his address" → Immediately updates Oliver's address on the just-created invoice

### 📋 Implementation Checklist
- [ ] Add ConversationMemory class
- [ ] Add detectConversationContext function  
- [ ] Track actions in all creation/update functions
- [ ] Inject context strings in AI prompt
- [ ] Add aggressive context rules to prompt
- [ ] Test with real conversation flows
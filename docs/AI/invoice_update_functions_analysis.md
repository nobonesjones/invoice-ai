# Invoice Update Functions Analysis

## Overview
Complete technical analysis of all invoice update functions in the AI edge function, documenting parameters, database operations, and implementation details.

## Function Inventory

### 🔄 Core Update Functions: 9 Functions Identified

1. **update_invoice** - General invoice updates
2. **add_line_item** - Add new line items
3. **remove_line_item** - Delete specific line items
4. **update_line_item** - Modify existing line items
5. **update_client_info** - Update client details
6. **update_payment_methods** - Update payment options per invoice
7. **enable_payment_methods** - Enable payment methods per invoice
8. **setup_paypal_payments** - Configure PayPal globally + per invoice
9. **setup_bank_transfer** - Configure bank transfers globally + per invoice

## Detailed Function Analysis

### 1. update_invoice
**Purpose:** Comprehensive invoice updates - client info, line items, amounts, design, payment methods

**Parameters (17 total):**
- `invoice_identifier` (required, string) - Invoice lookup
- `client_name` (optional, string) - Client name update
- `client_email` (optional, string) - Client email update
- `client_phone` (optional, string) - Client phone update
- `client_address` (optional, string) - Client address update
- `client_tax_number` (optional, string) - Client tax number update
- `invoice_date` (optional, string) - Invoice date (YYYY-MM-DD)
- `due_date` (optional, string) - Due date (YYYY-MM-DD)
- `payment_terms_days` (optional, number) - Payment terms in days
- `notes` (optional, string) - Invoice notes
- `status` (optional, string) - Invoice status (draft/sent/paid/overdue)
- `tax_rate` (optional, number) - Tax rate percentage
- `discount_type` (optional, string) - Discount type (percentage/fixed)
- `discount_value` (optional, number) - Discount amount
- `invoice_design` (optional, string) - Design template
- `accent_color` (optional, string) - Accent color hex code
- `enable_stripe` (optional, boolean) - Stripe payments
- `enable_paypal` (optional, boolean) - PayPal payments
- `enable_bank_transfer` (optional, boolean) - Bank transfer payments
- `line_items` (optional, array) - Complete line item replacement

**Database Operations:**
- Updates `clients` table for client information
- Deletes all existing records from `invoice_line_items` if line_items provided
- Recreates line items in `invoice_line_items` table
- Updates `invoices` table with all new values
- Recalculates subtotal_amount and total_amount

### 2. add_line_item
**Purpose:** Add single line item to existing invoice

**Parameters (5 total):**
- `invoice_identifier` (required, string) - Invoice lookup
- `item_name` (required, string) - Line item name
- `unit_price` (required, number) - Price per unit
- `quantity` (optional, number) - Item quantity (default: 1)
- `item_description` (optional, string) - Item description

**Database Operations:**
- Inserts new record into `invoice_line_items` table
- Recalculates and updates invoice totals in `invoices` table

### 3. remove_line_item
**Purpose:** Delete specific line item from invoice

**Parameters (2 total):**
- `invoice_identifier` (required, string) - Invoice lookup
- `item_identifier` (required, string) - Item name or index to remove

**Database Operations:**
- Deletes specific record from `invoice_line_items` table
- Recalculates and updates invoice totals in `invoices` table

### 4. update_line_item
**Purpose:** Modify existing line item properties

**Parameters (6 total):**
- `invoice_identifier` (required, string) - Invoice lookup
- `item_identifier` (required, string) - Item name or index to update
- `item_name` (optional, string) - New item name
- `quantity` (optional, number) - New quantity
- `unit_price` (optional, number) - New unit price
- `item_description` (optional, string) - New description (null to remove)

**Database Operations:**
- Updates specific record in `invoice_line_items` table
- Recalculates total_price for the line item
- Recalculates and updates invoice totals in `invoices` table

### 5. update_client_info
**Purpose:** Update client information for invoice and save to client profile

**Parameters (6 total):**
- `invoice_identifier` (required, string) - Invoice lookup
- `client_name` (optional, string) - Client name
- `client_email` (optional, string) - Client email
- `client_phone` (optional, string) - Client phone
- `client_address` (optional, string) - Client address
- `client_tax_number` (optional, string) - Client tax number

**Database Operations:**
- Updates `clients` table with new client information
- Maps client_address parameter to address_client column

### 6. update_payment_methods
**Purpose:** Update payment methods for specific invoice (validates against business settings)

**Parameters (4 total):**
- `invoice_identifier` (required, string) - Invoice lookup
- `enable_stripe` (optional, boolean) - Enable/disable Stripe
- `enable_paypal` (optional, boolean) - Enable/disable PayPal
- `enable_bank_transfer` (optional, boolean) - Enable/disable bank transfer

**Database Operations:**
- Checks `business_settings` table for enabled payment methods
- Updates `invoices` table payment flags (stripe_active, paypal_active, bank_account_active)

### 7. enable_payment_methods
**Purpose:** Enable payment methods on invoice (validates against payment options)

**Parameters (4 total):**
- `invoice_number` (required, string) - Invoice number
- `enable_stripe` (optional, boolean) - Enable Stripe
- `enable_paypal` (optional, boolean) - Enable PayPal
- `enable_bank_transfer` (optional, boolean) - Enable bank transfer

**Database Operations:**
- Checks `payment_options` table for enabled payment methods
- Updates `invoices` table payment flags

### 8. setup_paypal_payments
**Purpose:** Configure PayPal globally and optionally activate on specific invoice

**Parameters (2 total):**
- `paypal_email` (required, string) - PayPal email address
- `invoice_number` (optional, string) - Invoice to activate PayPal on

**Database Operations:**
- Upserts into `payment_options` table (paypal_enabled = true, paypal_email)
- If invoice_number provided, updates `invoices` table (paypal_active = true)

### 9. setup_bank_transfer
**Purpose:** Configure bank transfers globally and optionally activate on specific invoice

**Parameters (2 total):**
- `bank_details` (required, string) - Bank account details
- `invoice_number` (optional, string) - Invoice to activate bank transfer on

**Database Operations:**
- Upserts into `payment_options` table (bank_transfer_enabled = true, bank_details)
- If invoice_number provided, updates `invoices` table (bank_account_active = true)

## Implementation Patterns

### Parameter Destructuring Pattern
All functions follow consistent pattern:
```typescript
const { param1, param2, param3 } = parsedArgs;
```

### Invoice Lookup Pattern
All functions use `findInvoice` helper for invoice identification:
```typescript
const targetInvoice = await findInvoice(supabase, user_id, invoice_identifier);
```

### Error Handling Pattern
Comprehensive logging with function-specific prefixes:
```typescript
console.log('[function_name] Starting with:', { params });
console.error('[function_name] Error:', error);
```

### Total Recalculation Pattern
Functions that modify line items automatically recalculate totals:
```typescript
const subtotal = allLineItems.reduce((sum, item) => sum + item.total_price, 0);
const total = subtotal + tax - discount;
```

### Attachment Creation Pattern
All functions create invoice attachments for chat display:
```typescript
attachments.push({
  type: 'invoice',
  invoice_id: targetInvoice.id,
  invoice: updatedInvoice,
  line_items: allLineItems,
  client: clientData
});
```

## Key Technical Findings

### Parameter Naming Inconsistencies
1. **tax_rate** parameter → **tax_percentage** database column
2. **client_address** parameter → **address_client** database column
3. **enable_paypal** parameter → **paypal_active** database column

### Table Operation Scope
- **Invoices table**: Primary updates for invoice metadata
- **Invoice_line_items table**: All line item operations
- **Clients table**: Client information updates
- **Payment_options table**: Global payment method configuration
- **Business_settings table**: Payment method validation source

### User ID Column Handling
Functions correctly handle user ID inconsistencies:
- Uses `user_id` for invoices, clients, line_items tables
- Properly filters all operations by user for security

### Context Awareness
All functions support flexible invoice identification:
- Exact invoice number (e.g., "INV-004")
- Client name (finds latest invoice for that client)
- "latest" keyword (most recent invoice)

This comprehensive function set provides complete update capabilities for all aspects of invoice management while maintaining data integrity and security.
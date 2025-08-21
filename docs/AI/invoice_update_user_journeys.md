# Invoice Update User Journeys - Test Scenarios

## Overview
Comprehensive test scenarios for invoice update functionality. Each scenario follows the pattern: **Existing Invoice + Single Update Variable** to ensure focused testing of individual update capabilities.

## Base Requirements
Every invoice update scenario includes:
- ✅ **Existing Invoice** (created previously or referenced specifically)
- ✅ **Single Update Variable** being tested
- ✅ **Context awareness** (latest invoice vs specific invoice)

## User Journey Categories

### 📅 INVOICE REFERENCE & TIMING UPDATES

#### UU001: Update Invoice Due Date
**User Request**: "Change the due date on the latest invoice to February 15th"
**Variables Tested**: Due date modification
**Expected AI Action**: `update_invoice(invoice_identifier: "latest", due_date: "2024-02-15")`
**✅ DATA CHECKED & VERIFIED** - due_date parameter maps to invoices.due_date

#### UU002: Update Invoice Date
**User Request**: "Change the invoice date to December 1st for invoice INV-123"
**Variables Tested**: Invoice date modification, specific invoice targeting
**Expected AI Action**: `update_invoice(invoice_identifier: "INV-123", invoice_date: "2024-12-01")`
**✅ DATA CHECKED & VERIFIED** - invoice_date parameter maps to invoices.invoice_date

#### UU003: Update Invoice Status
**User Request**: "Mark the latest invoice as paid"
**Variables Tested**: Status updates
**Expected AI Action**: `update_invoice(invoice_identifier: "latest", status: "paid")`
**✅ DATA CHECKED & VERIFIED** - status parameter maps to invoices.status

### 💰 FINANCIAL UPDATES

#### UU004: Update Tax Rate
**User Request**: "Change the tax rate to 15% on invoice INV-456"
**Variables Tested**: Tax percentage modification
**Expected AI Action**: `update_invoice(invoice_identifier: "INV-456", tax_rate: 15)`
**✅ DATA CHECKED & VERIFIED** - tax_rate parameter maps to invoices.tax_percentage

#### UU005: Add Discount
**User Request**: "Add a 10% discount to the latest invoice"
**Variables Tested**: Discount addition
**Expected AI Action**: `update_invoice(invoice_identifier: "latest", discount_type: "percentage", discount_value: 10)`
**✅ DATA CHECKED & VERIFIED** - Both parameters map correctly

#### UU006: Change Fixed Discount
**User Request**: "Change the discount to $50 off for the John Smith invoice"
**Variables Tested**: Discount type and value modification
**Expected AI Action**: `update_invoice(invoice_identifier: "John Smith", discount_type: "fixed", discount_value: 50)`
**✅ DATA CHECKED & VERIFIED** - Both parameters map correctly

### 👥 CLIENT INFORMATION UPDATES

#### UU007: Update Client Email
**User Request**: "Update the client's email to newemail@company.com on the latest invoice"
**Variables Tested**: Client email modification
**Expected AI Action**: `update_client_info(invoice_identifier: "latest", client_email: "newemail@company.com")`
**✅ DATA CHECKED & VERIFIED** - client_email maps to clients.email

#### UU008: Update Client Phone
**User Request**: "Change the phone number to 555-9876 for the ABC Corp invoice"
**Variables Tested**: Client phone modification
**Expected AI Action**: `update_client_info(invoice_identifier: "ABC Corp", client_phone: "555-9876")`
**✅ DATA CHECKED & VERIFIED** - client_phone maps to clients.phone

#### UU009: Update Client Address
**User Request**: "Update the client address to 456 Oak Street for invoice INV-789"
**Variables Tested**: Client address modification
**Expected AI Action**: `update_client_info(invoice_identifier: "INV-789", client_address: "456 Oak Street")`
**✅ DATA CHECKED & VERIFIED** - client_address maps to clients.address_client

#### UU010: Update Client Name
**User Request**: "Change the client name to 'ABC Corporation Ltd' on the latest invoice"
**Variables Tested**: Client name modification
**Expected AI Action**: `update_client_info(invoice_identifier: "latest", client_name: "ABC Corporation Ltd")`
**✅ DATA CHECKED & VERIFIED** - client_name maps to clients.name

### 📝 LINE ITEM UPDATES

#### UU011: Add Line Item
**User Request**: "Add web hosting for $120 to the latest invoice"
**Variables Tested**: Line item addition
**Expected AI Action**: `add_line_item(invoice_identifier: "latest", item_name: "Web hosting", unit_price: 120)`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU012: Add Line Item with Quantity
**User Request**: "Add 3 licenses at $50 each to invoice INV-101"
**Variables Tested**: Line item with quantity addition
**Expected AI Action**: `add_line_item(invoice_identifier: "INV-101", item_name: "Licenses", unit_price: 50, quantity: 3)`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU013: Add Line Item with Description
**User Request**: "Add SEO optimization for $800 - includes keyword research and content updates to the Tech Company invoice"
**Variables Tested**: Line item with description addition
**Expected AI Action**: `add_line_item(invoice_identifier: "Tech Company", item_name: "SEO optimization", unit_price: 800, item_description: "includes keyword research and content updates")`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU014: Update Line Item Price
**User Request**: "Change the web design price to $750 on the latest invoice"
**Variables Tested**: Line item price modification
**Expected AI Action**: `update_line_item(invoice_identifier: "latest", item_identifier: "web design", unit_price: 750)`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU015: Update Line Item Quantity
**User Request**: "Change the license quantity to 5 on invoice INV-202"
**Variables Tested**: Line item quantity modification
**Expected AI Action**: `update_line_item(invoice_identifier: "INV-202", item_identifier: "license", quantity: 5)`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU016: Update Line Item Name
**User Request**: "Change 'website work' to 'Custom Website Development' on the latest invoice"
**Variables Tested**: Line item name modification
**Expected AI Action**: `update_line_item(invoice_identifier: "latest", item_identifier: "website work", item_name: "Custom Website Development")`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU017: Remove Line Item
**User Request**: "Remove the hosting item from invoice INV-303"
**Variables Tested**: Line item removal
**Expected AI Action**: `remove_line_item(invoice_identifier: "INV-303", item_identifier: "hosting")`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

#### UU018: Remove Line Item by Position
**User Request**: "Remove the second item from the latest invoice"
**Variables Tested**: Line item removal by index
**Expected AI Action**: `remove_line_item(invoice_identifier: "latest", item_identifier: "2nd item")`
**✅ DATA CHECKED & VERIFIED** - Supports index-based removal

### 💳 PAYMENT METHOD UPDATES

#### UU019: Enable PayPal Payment
**User Request**: "Enable PayPal payments on the latest invoice"
**Variables Tested**: PayPal activation per invoice
**Expected AI Action**: `update_payment_methods(invoice_identifier: "latest", enable_paypal: true)`
**✅ DATA CHECKED & VERIFIED** - enable_paypal maps to invoices.paypal_active

#### UU020: Enable Stripe Payment
**User Request**: "Add card payments to invoice INV-404"
**Variables Tested**: Stripe activation per invoice
**Expected AI Action**: `update_payment_methods(invoice_identifier: "INV-404", enable_stripe: true)`
**✅ DATA CHECKED & VERIFIED** - enable_stripe maps to invoices.stripe_active

#### UU021: Enable Bank Transfer
**User Request**: "Enable bank transfer option on the Client ABC invoice"
**Variables Tested**: Bank transfer activation per invoice
**Expected AI Action**: `update_payment_methods(invoice_identifier: "Client ABC", enable_bank_transfer: true)`
**✅ DATA CHECKED & VERIFIED** - enable_bank_transfer maps to invoices.bank_account_active

#### UU022: Setup PayPal with Email
**User Request**: "Set up PayPal with email payments@business.com and enable it on invoice INV-505"
**Variables Tested**: PayPal global setup + invoice activation
**Expected AI Action**: `setup_paypal_payments(paypal_email: "payments@business.com", invoice_number: "INV-505")`
**✅ DATA CHECKED & VERIFIED** - Updates payment_options table + activates on invoice

#### UU023: Setup Bank Transfer Details
**User Request**: "Set up bank transfer with account details 'Chase Bank, Acc: 123456789, Routing: 987654321' and enable it on the latest invoice"
**Variables Tested**: Bank transfer setup + activation
**Expected AI Action**: `setup_bank_transfer(bank_details: "Chase Bank, Acc: 123456789, Routing: 987654321", invoice_number: "latest")`
**✅ DATA CHECKED & VERIFIED** - Updates payment_options table + activates on invoice

### 🎨 DESIGN & CUSTOMIZATION UPDATES

#### UU024: Change Invoice Design
**User Request**: "Change the invoice design to modern template for invoice INV-606"
**Variables Tested**: Design template modification
**Expected AI Action**: `update_invoice(invoice_identifier: "INV-606", invoice_design: "modern")`
**✅ DATA CHECKED & VERIFIED** - invoice_design parameter maps correctly

#### UU025: Change Accent Color
**User Request**: "Change the accent color to blue for the latest invoice"
**Variables Tested**: Accent color modification
**Expected AI Action**: `update_invoice(invoice_identifier: "latest", accent_color: "#3B82F6")`
**✅ DATA CHECKED & VERIFIED** - accent_color parameter maps correctly

### 📋 ADMINISTRATIVE UPDATES

#### UU026: Update Invoice Notes
**User Request**: "Add a note 'Net 15 payment terms apply' to invoice INV-707"
**Variables Tested**: Notes modification
**Expected AI Action**: `update_invoice(invoice_identifier: "INV-707", notes: "Net 15 payment terms apply")`
**✅ DATA CHECKED & VERIFIED** - notes parameter maps to invoices.notes

### 🔄 COMPLEX UPDATE SCENARIOS

#### UU027: Multiple Line Item Updates
**User Request**: "Replace all items on the latest invoice with: web design $800, logo design $300, hosting $150"
**Variables Tested**: Complete line item replacement
**Expected AI Action**: `update_invoice(invoice_identifier: "latest", line_items: [{item_name: "Web design", unit_price: 800}, {item_name: "Logo design", unit_price: 300}, {item_name: "Hosting", unit_price: 150}])`
**✅ DATA CHECKED & VERIFIED** - line_items array replaces all existing items

#### UU028: Client Info Batch Update
**User Request**: "Update the client info on invoice INV-808 to: name 'Global Corp', email 'billing@global.com', phone '555-0000'"
**Variables Tested**: Multiple client field updates
**Expected AI Action**: `update_client_info(invoice_identifier: "INV-808", client_name: "Global Corp", client_email: "billing@global.com", client_phone: "555-0000")`
**✅ DATA CHECKED & VERIFIED** - All parameters map correctly

### ❌ MISSING CAPABILITY SCENARIOS

#### UU029: Update Invoice Number ❌
**User Request**: "Change the invoice number from INV-999 to INV-2024-001"
**Variables Tested**: Invoice reference number changes
**Expected AI Action**: Would need `update_invoice(invoice_identifier: "INV-999", invoice_number: "INV-2024-001")`
**❌ PARAMETER MISSING** - invoice_number parameter not in update_invoice function

#### UU030: Update PO Number ❌
**User Request**: "Add PO number PO-2024-500 to the latest invoice"
**Variables Tested**: Purchase order number addition
**Expected AI Action**: Would need `update_invoice(invoice_identifier: "latest", po_number: "PO-2024-500")`
**❌ PARAMETER MISSING** - po_number parameter not in update_invoice function

#### UU031: Update Custom Headline ❌
**User Request**: "Change the headline to 'Thank you for your continued business!' on invoice INV-111"
**Variables Tested**: Custom headline modification
**Expected AI Action**: Would need `update_invoice(invoice_identifier: "INV-111", custom_headline: "Thank you for your continued business!")`
**❌ PARAMETER MISSING** - custom_headline parameter not in update_invoice function

#### UU032: Update Payment Information ❌
**User Request**: "Mark $500 as paid on January 15th for invoice INV-222"
**Variables Tested**: Payment tracking
**Expected AI Action**: Would need `update_invoice_payment(invoice_identifier: "INV-222", paid_amount: 500, payment_date: "2024-01-15")`
**❌ FUNCTION MISSING** - No payment tracking update function exists

## 🔄 Context Awareness Scenarios

### Conversation Flow Testing

#### UU033: Create Then Update Pattern
**User Request 1**: "Create an invoice for Tech Startup for development $2000"
**User Request 2**: "Change the amount to $2500"
**Variables Tested**: Context awareness, line item price update
**Expected AI Action**: `update_line_item(invoice_identifier: "latest", item_identifier: "development", unit_price: 2500)`
**✅ DATA CHECKED & VERIFIED** - Context awareness + update parameters work

#### UU034: Create Then Add Pattern
**User Request 1**: "Create an invoice for Design Co for logo design $400"
**User Request 2**: "Add hosting for $120"
**Variables Tested**: Context awareness, line item addition
**Expected AI Action**: `add_line_item(invoice_identifier: "latest", item_name: "Hosting", unit_price: 120)`
**✅ DATA CHECKED & VERIFIED** - Context awareness + add parameters work

#### UU035: Create Then Client Update Pattern
**User Request 1**: "Create an invoice for John Doe for consulting $800"
**User Request 2**: "Add his email john@example.com"
**Variables Tested**: Context awareness, client info update
**Expected AI Action**: `update_client_info(invoice_identifier: "latest", client_email: "john@example.com")`
**✅ DATA CHECKED & VERIFIED** - Context awareness + client update works

## 📊 VERIFICATION SUMMARY

### ✅ VERIFIED UPDATE SCENARIOS: 28/32
- **UU001-UU028**: All core update functionality verified ✅
- **Context awareness**: All 3 scenarios verified ✅

### ❌ MISSING CAPABILITIES: 4 scenarios require function updates
- **UU029**: Invoice number updates (missing parameter)
- **UU030**: PO number updates (missing parameter)  
- **UU031**: Custom headline updates (missing parameter)
- **UU032**: Payment tracking updates (missing function)

### 🎯 Update Coverage Analysis
- **Invoice metadata**: 85% coverage (missing invoice_number, po_number, custom_headline)
- **Line items**: 100% coverage ✅
- **Client info**: 100% coverage ✅
- **Payment methods**: 100% coverage ✅
- **Design options**: 100% coverage ✅
- **Payment tracking**: 0% coverage (no function exists)

### 🔧 ACTION REQUIRED
To achieve 100% update capability:
1. Add missing parameters to `update_invoice`: invoice_number, po_number, custom_headline
2. Create new function `update_invoice_payment` for payment tracking
3. Add parameters: paid_amount, payment_date, payment_notes

## Priority Testing Order

### High Priority (Core Updates)
- UU003, UU004, UU005: Status, tax, discount updates
- UU011-UU018: All line item operations
- UU007-UU010: Client information updates

### Medium Priority (Business Features)
- UU001, UU002: Date updates
- UU019-UU023: Payment method management
- UU024-UU026: Design and administrative updates

### Low Priority (Advanced Features)
- UU027, UU028: Complex batch updates
- UU033-UU035: Context awareness verification

### Future Implementation
- UU029-UU032: Missing capability scenarios (requires AI function updates)

This comprehensive update testing framework ensures thorough verification of the AI's invoice modification capabilities while identifying specific gaps that need to be addressed for complete functionality.
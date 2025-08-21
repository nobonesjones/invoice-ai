# Invoice Creation User Journeys - Test Scenarios

## Overview
This document maps realistic user journeys for invoice creation testing. Each scenario follows the pattern: **Client + Line Item(s) + One Variable** to ensure focused testing of individual features.

## Base Requirements
Every invoice creation scenario includes:
- ✅ **Client** (name minimum, with optional contact details)
- ✅ **At least 1 line item** (name + price minimum)
- ✅ **One additional variable** being tested

## User Journey Categories

### 📅 DATE & TIMING SCENARIOS

#### UJ001: Invoice with Custom Due Date
**User Request**: "Create an invoice for John Smith for website design at $500, due January 30th"
**Variables Tested**: Custom due date parsing
**Expected AI Action**: `create_invoice(client_name: "John Smith", line_items: [{item_name: "Website design", unit_price: 500}], due_date: "2024-01-30")`
**✅ DATA CHECKED & VERIFIED** - All parameters match AI function definition

#### UJ002: Invoice with Due Date Option
**User Request**: "Create an invoice for Sarah Johnson for logo design $300, Net 30 payment terms"
**Variables Tested**: Standard due date options
**Expected AI Action**: `create_invoice(client_name: "Sarah Johnson", line_items: [{item_name: "Logo design", unit_price: 300}], due_date_option: "net_30")`
**✅ DATA CHECKED & VERIFIED** - All parameters correct

#### UJ003: Invoice with Custom Invoice Date
**User Request**: "Create an invoice for ABC Corp for consulting $1000, dated December 15th"
**Variables Tested**: Custom invoice date
**Expected AI Action**: `create_invoice(client_name: "ABC Corp", line_items: [{item_name: "Consulting", unit_price: 1000}], invoice_date: "2024-12-15")`
**✅ DATA CHECKED & VERIFIED** - All parameters match

### 💰 FINANCIAL SCENARIOS

#### UJ004: Invoice with Percentage Discount
**User Request**: "Create an invoice for Mike Brown for photography $800 with 10% discount"
**Variables Tested**: Percentage discount application
**Expected AI Action**: `create_invoice(client_name: "Mike Brown", line_items: [{item_name: "Photography", unit_price: 800}], discount_type: "percentage", discount_value: 10)`
**✅ DATA CHECKED & VERIFIED** - All parameters correct

#### UJ005: Invoice with Fixed Discount
**User Request**: "Create an invoice for Tech Solutions for development $2000 minus $200 discount"
**Variables Tested**: Fixed amount discount
**Expected AI Action**: `create_invoice(client_name: "Tech Solutions", line_items: [{item_name: "Development", unit_price: 2000}], discount_type: "fixed", discount_value: 200)`
**✅ DATA CHECKED & VERIFIED** - All parameters correct

#### UJ006: Invoice with Tax Rate
**User Request**: "Create an invoice for Local Business for maintenance $400 with 20% VAT"
**Variables Tested**: Tax percentage and label
**Expected AI Action**: `create_invoice(client_name: "Local Business", line_items: [{item_name: "Maintenance", unit_price: 400}], tax_percentage: 20)`
**⚠️ DATA CHECKED & CORRECTED** - Removed `invoice_tax_label` parameter (not available in create_invoice)

### 👥 CLIENT INFORMATION SCENARIOS

#### UJ007: Invoice with Client Email
**User Request**: "Create an invoice for Emma Davis (emma@email.com) for training $600"
**Variables Tested**: Client email capture
**Expected AI Action**: `create_invoice(client_name: "Emma Davis", client_email: "emma@email.com", line_items: [{item_name: "Training", unit_price: 600}])`
**✅ DATA CHECKED & VERIFIED** - All parameters correct

#### UJ008: Invoice with Client Phone
**User Request**: "Create an invoice for David Wilson (555-1234) for repair work $250"
**Variables Tested**: Client phone capture
**Expected AI Action**: `create_invoice(client_name: "David Wilson", client_phone: "555-1234", line_items: [{item_name: "Repair work", unit_price: 250}])`
**✅ DATA CHECKED & VERIFIED** - All parameters correct

#### UJ009: Invoice with Client Address
**User Request**: "Create an invoice for Green Corp at 123 Main St for delivery $75"
**Variables Tested**: Client address capture
**Expected AI Action**: `create_invoice(client_name: "Green Corp", client_address: "123 Main St", line_items: [{item_name: "Delivery", unit_price: 75}])`
**✅ DATA CHECKED & VERIFIED** - Fixed typo `create_invoke` → `create_invoice`, parameter maps to address_client column

#### UJ010: Invoice with Client Tax Number
**User Request**: "Create an invoice for Business Ltd (VAT: GB123456789) for supplies $350"
**Variables Tested**: Client tax number capture
**Expected AI Action**: `create_invoice(client_name: "Business Ltd", client_tax_number: "GB123456789", line_items: [{item_name: "Supplies", unit_price: 350}])`
**✅ DATA CHECKED & VERIFIED** - All parameters correct

### 📝 LINE ITEM SCENARIOS

#### UJ011: Invoice with Multiple Line Items
**User Request**: "Create an invoice for Rachel Green for web design $500 and logo design $200"
**Variables Tested**: Multiple line items parsing
**Expected AI Action**: `create_invoice(client_name: "Rachel Green", line_items: [{item_name: "Web design", unit_price: 500}, {item_name: "Logo design", unit_price: 200}])`
**✅ DATA CHECKED & VERIFIED** - Array structure correct

#### UJ012: Invoice with Item Description
**User Request**: "Create an invoice for Tom Baker for custom software development $1500 - includes user authentication and dashboard"
**Variables Tested**: Item description capture
**Expected AI Action**: `create_invoice(client_name: "Tom Baker", line_items: [{item_name: "Custom software development", unit_price: 1500, item_description: "includes user authentication and dashboard"}])`
**✅ DATA CHECKED & VERIFIED** - item_description parameter exists

#### UJ013: Invoice with Item Quantity
**User Request**: "Create an invoice for Office Supply Co for 5 licenses at $100 each"
**Variables Tested**: Quantity parsing
**Expected AI Action**: `create_invoice(client_name: "Office Supply Co", line_items: [{item_name: "Licenses", unit_price: 100, quantity: 5}])`
**✅ DATA CHECKED & VERIFIED** - quantity parameter exists

### 💳 PAYMENT METHOD SCENARIOS

#### UJ014: Invoice with PayPal Enabled
**User Request**: "Create an invoice for Jane Roberts for design work $450 with PayPal payment option"
**Variables Tested**: PayPal activation
**Expected AI Action**: `create_invoice(client_name: "Jane Roberts", line_items: [{item_name: "Design work", unit_price: 450}], enable_paypal: true)`
**✅ DATA CHECKED & VERIFIED** - enable_paypal parameter exists (requires paypal_email if true)

#### UJ015: Invoice with Stripe Enabled
**User Request**: "Create an invoice for StartUp Inc for consulting $800 with card payments"
**Variables Tested**: Stripe activation
**Expected AI Action**: `create_invoice(client_name: "StartUp Inc", line_items: [{item_name: "Consulting", unit_price: 800}], enable_stripe: true)`
**✅ DATA CHECKED & VERIFIED** - enable_stripe parameter exists

#### UJ016: Invoice with Bank Transfer
**User Request**: "Create an invoice for Enterprise Corp for project work $2500 with bank transfer option"
**Variables Tested**: Bank transfer activation
**Expected AI Action**: `create_invoice(client_name: "Enterprise Corp", line_items: [{item_name: "Project work", unit_price: 2500}], enable_bank_transfer: true)`
**✅ DATA CHECKED & VERIFIED** - enable_bank_transfer parameter exists

### 🎨 DESIGN & CUSTOMIZATION SCENARIOS

#### UJ017: Invoice with Design Template
**User Request**: "Create an invoice for Creative Agency for branding $900 using the modern template"
**Variables Tested**: Invoice design selection
**Expected AI Action**: `create_invoice(client_name: "Creative Agency", line_items: [{item_name: "Branding", unit_price: 900}], invoice_design: "modern")`
**✅ DATA CHECKED & VERIFIED** - invoice_design parameter exists with modern option

#### UJ018: Invoice with Accent Color
**User Request**: "Create an invoice for Blue Company for marketing $650 with blue theme"
**Variables Tested**: Accent color application
**Expected AI Action**: `create_invoice(client_name: "Blue Company", line_items: [{item_name: "Marketing", unit_price: 650}], accent_color: "#3B82F6")`
**✅ DATA CHECKED & VERIFIED** - accent_color parameter exists

### 📋 ADMINISTRATIVE SCENARIOS

#### UJ019: Invoice with PO Number
**User Request**: "Create an invoice for Government Office for services $1200, PO number PO-2024-001"
**Variables Tested**: PO number capture
**Expected AI Action**: `create_invoice(client_name: "Government Office", line_items: [{item_name: "Services", unit_price: 1200}], po_number: "PO-2024-001")`
**❌ PARAMETER MISSING** - po_number parameter not in create_invoice function (exists in DB, needs AI function update)

#### UJ020: Invoice with Custom Headline
**User Request**: "Create an invoice for Happy Client for project completion $750 with headline 'Thank you for your business!'"
**Variables Tested**: Custom headline/message
**Expected AI Action**: `create_invoice(client_name: "Happy Client", line_items: [{item_name: "Project completion", unit_price: 750}], custom_headline: "Thank you for your business!")`
**❌ PARAMETER MISSING** - custom_headline parameter not in create_invoice function (exists in DB, needs AI function update)

#### UJ021: Invoice with Notes
**User Request**: "Create an invoice for Regular Customer for monthly service $300, add note about Net 15 payment terms"
**Variables Tested**: Invoice notes
**Expected AI Action**: `create_invoice(client_name: "Regular Customer", line_items: [{item_name: "Monthly service", unit_price: 300}], notes: "Net 15 payment terms")`
**✅ DATA CHECKED & VERIFIED** - notes parameter exists

#### UJ022: Invoice with Payment Terms
**User Request**: "Create an invoice for New Client for setup fee $500, payment due on receipt"
**Variables Tested**: Payment terms specification
**Expected AI Action**: `create_invoice(client_name: "New Client", line_items: [{item_name: "Setup fee", unit_price: 500}], payment_terms: "Due on receipt")`
**✅ DATA CHECKED & VERIFIED** - payment_terms parameter exists

## Sequential User Journey Scenarios

### 🔄 MODIFICATION SCENARIOS (Testing Context Awareness)

#### UJ023: Create Then Add Line Item
**User Request 1**: "Create an invoice for Alex Smith for web design $500"
**User Request 2**: "Add logo design for $200"
**Variables Tested**: Context awareness, add_line_item function
**Expected AI Action**: `add_line_item(invoice_identifier: "latest", item_name: "Logo design", unit_price: 200)`
**✅ DATA CHECKED & VERIFIED** - All add_line_item parameters correct

#### UJ024: Create Then Update Client Info
**User Request 1**: "Create an invoice for Company ABC for consulting $800"
**User Request 2**: "Add their email contact@abc.com"
**Variables Tested**: Context awareness, client info updates
**Expected AI Action**: `update_client_info(invoice_identifier: "latest", client_email: "contact@abc.com")`
**✅ DATA CHECKED & VERIFIED** - All update_client_info parameters correct

#### UJ025: Create Then Enable Payment Method
**User Request 1**: "Create an invoice for Tech Startup for development $1500"
**User Request 2**: "Enable PayPal for this invoice"
**Variables Tested**: Context awareness, payment method activation
**Expected AI Action**: `enable_payment_methods(invoice_number: "INV-XXXXX", enable_paypal: true)`
**✅ DATA CHECKED & VERIFIED** - enable_payment_methods function exists with correct parameters

### 🔢 COMPLEX LINE ITEM SCENARIOS

#### UJ026: Invoice with Detailed Line Items
**User Request**: "Create an invoice for Construction Co for 2 hours labor at $75/hour and 50 sq ft flooring at $5 per sq ft"
**Variables Tested**: Complex quantity and pricing parsing
**Expected AI Action**: `create_invoice(client_name: "Construction Co", line_items: [{item_name: "Labor", unit_price: 75, quantity: 2}, {item_name: "Flooring", unit_price: 5, quantity: 50}])`
**✅ DATA CHECKED & VERIFIED** - Complex line item parsing supported

#### UJ027: Invoice with Service Package
**User Request**: "Create an invoice for Digital Agency for SEO package including keyword research, content optimization, and monthly reporting for $850"
**Variables Tested**: Service bundling with description
**Expected AI Action**: `create_invoice(client_name: "Digital Agency", line_items: [{item_name: "SEO package", unit_price: 850, item_description: "including keyword research, content optimization, and monthly reporting"}])`
**✅ DATA CHECKED & VERIFIED** - item_description parameter supported

## Error Handling Scenarios

### ❌ CONSTRAINT TESTING

#### UJ028: Payment Method Not Available
**User Request**: "Create an invoice for Client X for service $400 with PayPal"
**Variables Tested**: Payment method availability checking
**Expected AI Response**: Should inform user that PayPal must be configured first if not available

#### UJ029: Invalid Date Format
**User Request**: "Create an invoice for Client Y for work $300 due yesterday"
**Variables Tested**: Date validation and intelligent parsing
**Expected AI Action**: Should handle relative dates intelligently

## Test Execution Format

For each user journey:
1. **Input**: Exact user message to send to AI
2. **Expected Function Call**: AI function with exact parameters
3. **Expected Response**: User-friendly confirmation message
4. **Verification**: Check database for correct data storage
5. **UI Check**: Verify invoice appears correctly in app

## Priority Testing Order

### High Priority (Core Functionality)
- UJ001-UJ006: Date and financial scenarios
- UJ011-UJ013: Line item scenarios  
- UJ023-UJ025: Context awareness scenarios

### Medium Priority (Enhanced Features)
- UJ007-UJ010: Client information capture
- UJ014-UJ016: Payment method integration
- UJ019-UJ022: Administrative features

### Low Priority (Advanced Features)
- UJ017-UJ018: Design customization
- UJ026-UJ027: Complex parsing scenarios
- UJ028-UJ029: Error handling

## 📊 VERIFICATION SUMMARY

### ✅ VERIFIED SCENARIOS: 25/27
- **UJ001-UJ018**: All basic creation scenarios verified ✅
- **UJ021-UJ027**: All advanced scenarios verified ✅  
- **Context awareness**: All 3 scenarios verified ✅

### ❌ MISSING PARAMETERS: 2 scenarios require AI function updates
- **UJ019**: `po_number` parameter missing from create_invoice function
- **UJ020**: `custom_headline` parameter missing from create_invoice function

### ⚠️ CORRECTED: 1 scenario
- **UJ006**: Removed unsupported `invoice_tax_label` parameter

### 🔧 ACTION REQUIRED
To make all scenarios functional:
1. Add `po_number` parameter to create_invoice function
2. Add `custom_headline` parameter to create_invoice function

Both database columns exist - only AI function definition needs updating.

---

This comprehensive mapping ensures thorough testing of all invoice creation capabilities while maintaining realistic user behavior patterns.
# Invoice Update Verification Plan

## Overview
This plan systematically verifies that the AI has the technical ability to update all aspects of invoices by mapping update functions to database fields, ensuring data consistency and completeness.

## Phase 1: Analyze Current Update Functions

### Step 1.1: Extract All Update Functions
Identify all invoice update-related functions in `ai-chat-assistants-poc/index.ts`:

**Expected Update Functions:**
- `update_invoice` - General invoice updates
- `add_line_item` - Add new line items
- `update_line_item` - Modify existing line items  
- `remove_line_item` - Delete line items
- `update_client_info` - Update client details on invoice
- `enable_payment_methods` - Enable/disable payment options
- `setup_paypal_payments` - Configure PayPal
- `setup_bank_transfer` - Configure bank transfers
- `update_payment_methods` - Update payment settings
- Any other update-related functions

### Step 1.2: Document Function Parameters
For each function, extract:
- Complete parameter list
- Required vs optional parameters
- Parameter data types
- Parameter descriptions

### Step 1.3: Analyze Function Implementation
For each function, verify:
- How parameters are destructured
- Database operations performed
- Table updates (invoices, invoice_line_items, clients, etc.)
- Error handling
- Return values/attachments

## Phase 2: Database Field Mapping

### Step 2.1: Map Parameters to Database Columns
Create mapping matrix for each update function:

**Example Format:**
```
update_invoice function:
- AI Parameter: invoice_date → DB Column: invoices.invoice_date
- AI Parameter: due_date → DB Column: invoices.due_date
- AI Parameter: client_email → DB Column: clients.email
```

### Step 2.2: Identify Column Inconsistencies
Check for naming mismatches using `AI_data_learning.md` guidelines:
- Parameter vs column name differences
- Table targeting errors (profiles vs business_settings)
- Address field mapping (address vs address_client)
- Payment field mapping (enable_paypal vs paypal_active)

### Step 2.3: Verify Table Relationships
Ensure update functions correctly handle:
- Foreign key relationships (client_id, invoice_id)
- User ID column naming (uid vs id vs user_id)
- Cross-table updates (invoices + clients + line_items)

## Phase 3: Update Capability Assessment

### Step 3.1: Field Coverage Analysis
For each database table, verify AI can update:

**Invoices Table Fields:**
- [ ] invoice_number
- [ ] invoice_date  
- [ ] due_date
- [ ] due_date_option
- [ ] status
- [ ] po_number
- [ ] custom_headline
- [ ] tax_percentage
- [ ] invoice_tax_label
- [ ] discount_type
- [ ] discount_value
- [ ] notes
- [ ] payment_terms
- [ ] paypal_active
- [ ] stripe_active
- [ ] bank_account_active
- [ ] invoice_design
- [ ] accent_color

**Invoice Line Items Fields:**
- [ ] item_name
- [ ] item_description
- [ ] quantity
- [ ] unit_price
- [ ] line_item_discount_type
- [ ] line_item_discount_value
- [ ] item_image_url

**Client Fields (via invoice):**
- [ ] name
- [ ] email
- [ ] phone
- [ ] address_client
- [ ] tax_number
- [ ] notes

### Step 3.2: Update Scenario Mapping
Map realistic update scenarios to required functions:

**Reference Updates:**
- Change invoice number → update_invoice(invoice_number)
- Change due date → update_invoice(due_date)
- Add PO number → update_invoice(po_number)

**Line Item Updates:**  
- Add item → add_line_item(item_name, unit_price, quantity)
- Change item price → update_line_item(item_identifier, unit_price)
- Remove item → remove_line_item(item_identifier)

**Payment Updates:**
- Enable PayPal → enable_payment_methods(enable_paypal: true)
- Add PayPal email → setup_paypal_payments(paypal_email)
- Change bank details → setup_bank_transfer(bank_details)

## Phase 4: Create Update User Journeys

### Step 4.1: Design Update Test Scenarios
Create realistic update scenarios following pattern:
**Existing Invoice + Single Update Variable**

**Categories:**
1. **Reference Updates** (invoice number, dates, PO number)
2. **Financial Updates** (tax, discount, payment methods)
3. **Client Updates** (name, email, phone, address)
4. **Line Item Updates** (add, modify, remove items)
5. **Design Updates** (template, colors)
6. **Status Updates** (draft, sent, paid)

### Step 4.2: Context Awareness Testing
Verify AI can handle:
- "Update the invoice" (latest context)
- "Update invoice INV-123" (specific reference)
- "Change the client's email" (client context)
- "Add another item" (line item context)

## Phase 5: Gap Analysis & Documentation

### Step 5.1: Identify Missing Capabilities
Document what AI **cannot** currently update:
- Missing function parameters
- Unsupported database fields  
- Broken parameter mappings
- Missing update functions

### Step 5.2: Database vs AI Function Comparison
Create comprehensive comparison:
- Database fields that exist but no AI parameter
- AI parameters that don't map to database columns
- Functions that target wrong tables
- Parameter naming inconsistencies

### Step 5.3: Priority Gap Assessment
Classify gaps by importance:
- **Critical**: Core invoice updates (amounts, dates, items)
- **Important**: Business features (PO numbers, custom fields)
- **Nice-to-have**: Advanced features (complex discounts, metadata)

## Phase 6: Verification & Testing

### Step 6.1: Parameter Verification Matrix
Create detailed matrix showing:
- ✅ AI parameter exists + maps correctly
- ⚠️ AI parameter exists but mapping issue  
- ❌ AI parameter missing for database field
- 🔧 Requires function update

### Step 6.2: Update Test Scenarios
Design test cases for each verified capability:
- Input: User request
- Expected: AI function call with parameters
- Verification: Database update occurs correctly
- UI Check: Changes reflect in app

### Step 6.3: Context Awareness Verification
Test conversation memory for updates:
- Create invoice in conversation
- Update same invoice with contextual reference
- Verify AI uses correct invoice_identifier

## Deliverables

### Document 1: Update Functions Analysis
`/docs/AI/invoice_update_functions_analysis.md`
- All update functions with complete parameter lists
- Function implementations analysis
- Database operation mapping

### Document 2: Update Parameter Verification Matrix  
`/docs/AI/invoice_update_parameter_matrix.md`
- Parameter-to-database mapping for all functions
- Gap analysis and missing capabilities
- Required function updates

### Document 3: Update User Journey Scenarios
`/docs/AI/invoice_update_user_journeys.md`
- Realistic update scenarios with single variable testing
- Context awareness test cases
- Expected AI function calls with verification status

### Document 4: Update Testing Framework
`/docs/AI/invoice_update_testing_framework.md`
- Test execution procedures
- Verification checklist
- Automated testing templates

## Success Criteria

### Technical Completeness
- [ ] All database update fields mapped to AI functions
- [ ] No critical update capabilities missing
- [ ] Parameter naming consistent with database schema
- [ ] Context awareness working for updates

### Testing Readiness  
- [ ] Comprehensive update scenarios created
- [ ] All scenarios have verified AI function calls
- [ ] Database verification procedures documented
- [ ] Automated testing framework ready

### Documentation Quality
- [ ] Clear gap analysis with priority levels
- [ ] Actionable recommendations for missing features
- [ ] Complete parameter reference for developers
- [ ] User journey scenarios ready for testing

This plan ensures comprehensive verification of the AI's invoice update capabilities, identifying exactly what works, what's missing, and what needs to be fixed for complete update functionality.
# AI Business Workflows - Complete Operational Logic

## Overview
This document defines the complete business workflows the AI must follow when handling invoice operations. Each user action has specific operational steps that mirror the manual UI behavior.

## Payment Operation Workflows

### 1. "Mark Invoice as Paid" Workflow

**User Intent Examples:**
- "Mark the latest invoice as paid"
- "Set invoice INV-123 to paid status"
- "Mark John Smith's invoice as fully paid"

**Operational Steps:**
1. **Database Updates:**
   - `status` → `'paid'`
   - `paid_amount` → `invoice.total_amount` (full amount)
   - `payment_date` → current timestamp (ISO format)
   - `payment_notes` → `'Marked as paid via AI assistant'`

2. **Business Logic:**
   - Uses `handleTogglePaid(true)` logic
   - Sets payment to exactly 100% of invoice total
   - This is a binary operation - either fully paid or not paid

3. **Activity Logging:**
   - Log `payment_added` activity with full amount
   - Description: `"Payment of $XXX.XX recorded via AI assistant"`
   - Data: `{ payment_amount: total_amount, payment_method: "AI assistant - marked as paid" }`

4. **Response to User:**
   - Confirm the action: "I've marked invoice [number] as fully paid"
   - Show payment details: "$XXX.XX payment recorded on [date]"
   - Display current status: "Status is now 'Paid'"

**AI Function Call:**
```typescript
update_invoice(
  invoice_identifier: "latest",
  status: "paid",
  paid_amount: invoice.total_amount,
  payment_date: new Date().toISOString(),
  payment_notes: "Marked as paid via AI assistant"
)
```

---

### 2. "Record Payment" Workflow (Incremental)

**User Intent Examples:**
- "Record a $500 payment for invoice INV-123"
- "Add a credit card payment of $250"
- "Client paid $300 today"

**Operational Steps:**
1. **Calculate New Total:**
   - `newTotalPaid = (existing_paid_amount || 0) + payment_amount`

2. **Determine New Status:**
   - Use `calculatePaymentStatus(newTotalPaid, total_amount)`:
     - If `newTotalPaid <= 0` → `'sent'`
     - If `newTotalPaid >= total_amount` → `'paid'`
     - If `0 < newTotalPaid < total_amount` → `'partial'`

3. **Database Updates:**
   - `status` → calculated status
   - `paid_amount` → `newTotalPaid`
   - `payment_date` → current timestamp
   - `payment_notes` → `"AI assistant: $XXX.XX via [method]"`

4. **Activity Logging:**
   - Log `payment_added` with the incremental amount (not total)
   - Description: `"Payment of $XXX.XX recorded via AI assistant"`

5. **Response to User:**
   - Confirm incremental payment: "I've recorded a $XXX.XX payment"
   - Show running total: "Total paid: $XXX.XX of $XXX.XX"
   - Show remaining: "Remaining balance: $XXX.XX"
   - Display status: "Status is now '[status]'"

**AI Function Implementation:**
- Calculate incremental payment logic within `update_invoice`
- Add cumulative amount to existing `paid_amount`

---

### 3. "Set Payment Amount" Workflow (Absolute)

**User Intent Examples:**
- "Set the paid amount to $750"
- "Update payment total to $1,200"
- "Change paid amount to $0" (unpaid)

**Operational Steps:**
1. **Direct Amount Setting:**
   - `newPaidAmount = specified_amount`

2. **Determine New Status:**
   - Use `calculatePaymentStatus(newPaidAmount, total_amount)`

3. **Database Updates:**
   - `status` → calculated status
   - `paid_amount` → `newPaidAmount`
   - `payment_date` → current timestamp if amount > 0, null if 0
   - `payment_notes` → `"Payment amount set to $XXX.XX via AI assistant"`

4. **Activity Logging:**
   - Log `payment_added` if increasing amount
   - Description reflects absolute setting

**AI Function Call:**
```typescript
update_invoice(
  invoice_identifier: "INV-123",
  paid_amount: 750,
  payment_date: new Date().toISOString(),
  payment_notes: "Payment amount set to $750.00 via AI assistant"
)
```

---

## Status Change Workflows

### 4. "Mark as Unpaid" Workflow

**User Intent Examples:**
- "Mark invoice as unpaid"
- "Reset payment status"
- "Remove all payments"

**Operational Steps:**
1. **Database Updates:**
   - `status` → `'sent'`
   - `paid_amount` → `0`
   - `payment_date` → `null`
   - `payment_notes` → `null`

2. **Activity Logging:**
   - Log `status_changed` from current status to 'sent'
   - Log `payment_removed` if there was a previous payment

---

### 5. Invoice Number Update Workflow

**User Intent Examples:**
- "Change invoice number to INV-2024-001"
- "Update the reference number"

**Operational Steps:**
1. **Validation:**
   - Check if new invoice number is unique for the user
   - Ensure format is valid

2. **Database Updates:**
   - `invoice_number` → new number

3. **Activity Logging:**
   - Log `edited` activity with change details

---

## Payment Calculation Utilities

### Status Calculation Logic
```typescript
function calculatePaymentStatus(paidAmount: number, totalAmount: number): InvoiceStatus {
  if (paidAmount <= 0) {
    return 'sent'; // No payment = sent
  } else if (paidAmount >= totalAmount) {
    return 'paid'; // Full payment = paid
  } else {
    return 'partial'; // Partial payment = partial
  }
}
```

### Display Calculations
```typescript
// Payment percentage
const paymentPercentage = Math.min((paidAmount / totalAmount) * 100, 100);

// Remaining amount
const remainingAmount = Math.max(totalAmount - paidAmount, 0);

// Due amount (same as remaining)
const dueAmount = remainingAmount;

// Overpayment check
const isOverpaid = paidAmount > totalAmount;
const overpaymentAmount = Math.max(paidAmount - totalAmount, 0);
```

## AI Response Patterns

### For Payment Operations:
```
✅ Success Response Template:
"I've [action] for invoice [number]. 

Payment Details:
• Amount: $XXX.XX
• Date: [date]
• Total Paid: $XXX.XX of $XXX.XX
• Remaining: $XXX.XX
• Status: [status]

The invoice now shows [percentage]% paid."
```

### For Status Changes:
```
✅ Success Response Template:
"I've changed invoice [number] status from '[old_status]' to '[new_status]'.

[Additional context based on status change]"
```

## Critical Business Rules

1. **Payment Amount Validation:**
   - Allow overpayments (user choice)
   - Prevent negative payments
   - Round to 2 decimal places

2. **Status Transitions:**
   - Always use `calculatePaymentStatus` for payment-related status changes
   - Manual status changes override payment calculations
   - Activity log all status changes

3. **Activity Logging:**
   - Always log payment activities with exact amounts
   - Log the specific action taken, not just generic updates
   - Include payment method context when available

4. **User Experience:**
   - Always confirm the action taken
   - Show before/after states for clarity
   - Provide remaining balance information
   - Display percentage paid for context

## AI Function Updates Required

The current `update_invoice` function needs enhancement to handle these workflows:

1. **Add Payment Method Tracking:**
   - Include payment method in notes
   - Support for "AI assistant", "credit card", "bank transfer", etc.

2. **Add Incremental Payment Logic:**
   - Detect when to add vs set payment amounts
   - Handle cumulative payment calculations

3. **Enhanced Activity Logging:**
   - Call appropriate logging functions based on operation type
   - Ensure accurate descriptions and data

This complete workflow ensures the AI behaves exactly like the manual UI, following all business rules and providing consistent user experience.
# Classifier Comparison: Old vs New

## Current System (Complex)
- **18+ intents**: create_invoice, update_invoice, delete_operations, create_estimate, update_estimate, create_client, update_client, update_business, search_data, payment_setup, design_change, analytics, context_aware_update, tax_management, invoice_notes, line_item_updates, status_management, recurring_setup, discount_adjustments, template_customization, email_automation
- **Tool groups**: invoice_core, client_ops, business_ops, payment_ops, design_ops, search_ops, estimate_ops, utility_ops, tax_ops, content_ops, status_ops, template_ops, automation_ops, discount_ops
- **Model tiers**: budget, mid, premium
- **Complex context pack**: business state, payment methods, active invoices, recent intents, etc.

## New System (Simplified)
- **5 intents only**:
  1. `create_invoice`
  2. `manage_invoice` (view/edit/send/delete)
  3. `create_estimate`
  4. `manage_estimate` (view/edit/send/convert)
  5. `general_query` (settings/clients/analytics/help)

## Key Improvements
1. **Simpler classification** = Higher accuracy
2. **Context-aware routing**: "Add logo" routes to `manage_invoice` when in invoice context
3. **Unified model**: gpt-5-nano for everything
4. **Reduced context**: Last 3 message pairs only

## Example Classifications

### Example 1: "Add my company logo"
- **Old system**: Could be `design_change`, `template_customization`, or `update_business`
- **New system**: 
  - With invoice context → `manage_invoice`
  - Without context → `general_query`

### Example 2: "Change tax to 10%"
- **Old system**: `tax_management` (always)
- **New system**:
  - With invoice context → `manage_invoice`
  - Without context → `general_query`

### Example 3: "Add 5 more hours to that"
- **Old system**: `line_item_updates` + `context_aware_update`
- **New system**:
  - With estimate context → `manage_estimate`
  - With invoice context → `manage_invoice`

## Implementation Plan
1. Update `classifyIntent` function in `/supabase/functions/ai-chat-optimized/index.ts`
2. Simplify output schema (remove tool groups, model tiers)
3. Test with real user messages
4. Monitor classification accuracy
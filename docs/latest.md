basically makign the invoice form save and then show on the invoices page; 

Okay, here's a concise summary of where we are and what we'll be focusing on next:

Main Goal:

Successfully save complete invoice data, including all line items and correct payment option statuses, from the "Create Invoice" screen to your Supabase database.
What We've Done / What's Working:

The main invoice record (though with some field issues) is being created in the invoices table.
The invoice_line_items table is set up in Supabase with RLS policies.
The database column for Stripe payment was updated to stripe_active.
We've refined the tab bar visibility logic to reduce flickering during navigation.
Current Focus - Debugging Data Saving Issues in "Create Invoice":

Line Items Not Saving: It appears line items added in the form are not being included when the invoice is saved.
Payment Option Toggles Not Working Correctly:
Stripe (stripe_active) seems to default to true regardless of the switch.
Bank Account (bank_account_active) and PayPal (paypal_active) are saving as false even when toggled on.
Other Invoice Fields: We also need to verify and fix how invoice numbers and dates are saved.
Next Steps (for the morning):

Inspect Form Controls: We need to look at the code in app/(app)/(protected)/invoices/create.tsx for:
How the Switch components for Stripe, Bank Account, and PayPal are set up with react-hook-form.
The defaultValues used when initializing the form.
Line Item Form State: Figure out why the items array in the form data might be empty or not updating correctly when you add items.
Essentially, we're diving into how the form in create.tsx handles its data, especially for the toggles and the list of items, to make sure it accurately sends everything to Supabase.

Feedback submitted

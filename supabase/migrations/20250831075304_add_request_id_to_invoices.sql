-- Add request_id column to invoices table for idempotency
ALTER TABLE invoices ADD COLUMN request_id TEXT;

-- Create unique constraint to prevent duplicate requests
CREATE UNIQUE INDEX idx_invoices_request_id 
ON invoices(request_id) 
WHERE request_id IS NOT NULL;

-- Add unique constraint on invoice_number per user (defensive measure)
ALTER TABLE invoices 
ADD CONSTRAINT unique_user_invoice_number 
UNIQUE (user_id, invoice_number);
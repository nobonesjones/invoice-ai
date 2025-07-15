-- Add pdf_path column to invoice_shares table for storing PDF files
ALTER TABLE invoice_shares 
ADD COLUMN pdf_path TEXT;

-- Add comment for the new column
COMMENT ON COLUMN invoice_shares.pdf_path IS 'Path to the PDF file in Supabase Storage for direct PDF sharing'; 
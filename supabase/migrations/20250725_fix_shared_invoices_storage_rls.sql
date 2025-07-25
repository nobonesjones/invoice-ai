-- Fix storage RLS policies for shared-invoices bucket
-- Currently using auth.role() which causes policy mismatch with database tables
-- Database uses auth.uid() = user_id, storage should match this pattern

-- Drop existing policies that use auth.role()
DROP POLICY IF EXISTS "Authenticated users can upload shared invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update shared invoice PDFs" ON storage.objects;  
DROP POLICY IF EXISTS "Authenticated users can delete shared invoice PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Public can view shared invoice PDFs" ON storage.objects;

-- Create new policies that properly validate ownership via database lookup
-- This ensures consistency between storage and database RLS patterns

-- Policy for uploading PDFs - only allow users to upload for their own invoices
CREATE POLICY "Users can upload PDFs for their own invoices" ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'shared-invoices' 
        AND auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.invoices 
            WHERE user_id = auth.uid() 
            AND CONCAT('invoice-', id::text) = SUBSTRING(name FROM '^invoice-([^-]+)')
        )
    );

-- Policy for updating PDFs - only allow users to update their own invoice PDFs  
CREATE POLICY "Users can update PDFs for their own invoices" ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'shared-invoices'
        AND auth.uid() IS NOT NULL  
        AND EXISTS (
            SELECT 1 FROM public.invoices 
            WHERE user_id = auth.uid() 
            AND CONCAT('invoice-', id::text) = SUBSTRING(name FROM '^invoice-([^-]+)')
        )
    );

-- Policy for deleting PDFs - only allow users to delete their own invoice PDFs
CREATE POLICY "Users can delete PDFs for their own invoices" ON storage.objects  
    FOR DELETE
    USING (
        bucket_id = 'shared-invoices'
        AND auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.invoices 
            WHERE user_id = auth.uid() 
            AND CONCAT('invoice-', id::text) = SUBSTRING(name FROM '^invoice-([^-]+)')
        )
    );

-- Policy for public viewing - allow access to active, non-expired shared PDFs
-- This matches the database policy pattern for public access
CREATE POLICY "Public can view active shared invoice PDFs" ON storage.objects
    FOR SELECT  
    USING (
        bucket_id = 'shared-invoices'
        AND EXISTS (
            SELECT 1 FROM public.invoice_shares
            WHERE pdf_path = name
            AND is_active = true 
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- Add comments to document the policy changes
COMMENT ON POLICY "Users can upload PDFs for their own invoices" ON storage.objects 
    IS 'Fixed RLS: Uses auth.uid() and validates invoice ownership via database lookup';

COMMENT ON POLICY "Users can update PDFs for their own invoices" ON storage.objects
    IS 'Fixed RLS: Uses auth.uid() and validates invoice ownership via database lookup';  

COMMENT ON POLICY "Users can delete PDFs for their own invoices" ON storage.objects
    IS 'Fixed RLS: Uses auth.uid() and validates invoice ownership via database lookup';

COMMENT ON POLICY "Public can view active shared invoice PDFs" ON storage.objects
    IS 'Fixed RLS: Validates against database share table instead of using auth.role()';
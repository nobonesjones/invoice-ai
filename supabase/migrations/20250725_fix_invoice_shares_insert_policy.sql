-- Allow authenticated users to insert invoice_shares for their own invoices
CREATE POLICY "Users can create shares for their own invoices" ON public.invoice_shares
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.invoices 
            WHERE invoices.id = invoice_shares.invoice_id 
            AND invoices.user_id = auth.uid()
        )
    );
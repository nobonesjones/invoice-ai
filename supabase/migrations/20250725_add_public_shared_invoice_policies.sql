-- Add public access policies for shared invoice viewing
-- These policies allow anonymous users to view invoice data when accessed via valid shared links

-- Policy for public access to invoices via shared links
CREATE POLICY "Public can view shared invoices" ON public.invoices
    FOR SELECT  
    USING (
        EXISTS (
            SELECT 1 FROM public.invoice_shares
            WHERE invoice_shares.invoice_id = invoices.id
            AND invoice_shares.is_active = true 
            AND (invoice_shares.expires_at IS NULL OR invoice_shares.expires_at > NOW())
        )
    );

-- Policy for public access to clients of shared invoices
CREATE POLICY "Public can view clients of shared invoices" ON public.clients
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            JOIN public.invoice_shares ON invoice_shares.invoice_id = invoices.id
            WHERE invoices.client_id = clients.id
            AND invoice_shares.is_active = true 
            AND (invoice_shares.expires_at IS NULL OR invoice_shares.expires_at > NOW())
        )
    );

-- Policy for public access to invoice line items of shared invoices  
CREATE POLICY "Public can view line items of shared invoices" ON public.invoice_line_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoice_shares
            WHERE invoice_shares.invoice_id = invoice_line_items.invoice_id
            AND invoice_shares.is_active = true 
            AND (invoice_shares.expires_at IS NULL OR invoice_shares.expires_at > NOW())
        )
    );

-- Policy for public access to business settings of shared invoice users
CREATE POLICY "Public can view business settings of shared invoice users" ON public.business_settings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            JOIN public.invoice_shares ON invoice_shares.invoice_id = invoices.id
            WHERE invoices.user_id = business_settings.user_id
            AND invoice_shares.is_active = true 
            AND (invoice_shares.expires_at IS NULL OR invoice_shares.expires_at > NOW())
        )
    );

-- Policy for public access to payment options of shared invoice users
CREATE POLICY "Public can view payment options of shared invoice users" ON public.payment_options
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            JOIN public.invoice_shares ON invoice_shares.invoice_id = invoices.id
            WHERE invoices.user_id = payment_options.user_id
            AND invoice_shares.is_active = true 
            AND (invoice_shares.expires_at IS NULL OR invoice_shares.expires_at > NOW())
        )
    );

-- Policy for public access to user profiles of shared invoice users (minimal data needed)
CREATE POLICY "Public can view user profiles of shared invoice users" ON public.user_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.invoices
            JOIN public.invoice_shares ON invoice_shares.invoice_id = invoices.id
            WHERE invoices.user_id = user_profiles.id
            AND invoice_shares.is_active = true 
            AND (invoice_shares.expires_at IS NULL OR invoice_shares.expires_at > NOW())
        )
    );

-- Add comments to document the public access policies
COMMENT ON POLICY "Public can view shared invoices" ON public.invoices 
    IS 'Allows public access to invoice data when accessed via valid shared links';

COMMENT ON POLICY "Public can view clients of shared invoices" ON public.clients
    IS 'Allows public access to client data for shared invoices';  

COMMENT ON POLICY "Public can view line items of shared invoices" ON public.invoice_line_items
    IS 'Allows public access to line items for shared invoices';

COMMENT ON POLICY "Public can view business settings of shared invoice users" ON public.business_settings
    IS 'Allows public access to business settings for shared invoice display';

COMMENT ON POLICY "Public can view payment options of shared invoice users" ON public.payment_options
    IS 'Allows public access to payment options for shared invoice display';

COMMENT ON POLICY "Public can view user profiles of shared invoice users" ON public.user_profiles
    IS 'Allows public access to user profiles for shared invoice display';
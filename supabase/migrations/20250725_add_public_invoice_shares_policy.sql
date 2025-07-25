-- Allow anonymous users to read invoice_shares records by share_token
CREATE POLICY "Public can read invoice shares by token" ON public.invoice_shares
    FOR SELECT
    USING (
        is_active = true 
        AND (expires_at IS NULL OR expires_at > NOW())
    );
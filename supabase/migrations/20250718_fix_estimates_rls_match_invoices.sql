-- Fix estimates RLS to match invoices table exactly
-- Invoices has 4 separate policies (SELECT, INSERT, UPDATE, DELETE)
-- Estimates currently has only 1 combined policy (FOR ALL)

-- First, drop the existing combined policies
DROP POLICY IF EXISTS "Users can manage their own estimates" ON public.estimates;
DROP POLICY IF EXISTS "Users can manage their own estimate line items" ON public.estimate_line_items;

-- Create separate policies for estimates table (matching invoices)
CREATE POLICY "Users can view their own estimates" ON public.estimates
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own estimates" ON public.estimates
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimates" ON public.estimates
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own estimates" ON public.estimates
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create separate policies for estimate_line_items table (matching invoice_line_items)
CREATE POLICY "Users can view their own estimate line items" ON public.estimate_line_items
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own estimate line items" ON public.estimate_line_items
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimate line items" ON public.estimate_line_items
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own estimate line items" ON public.estimate_line_items
    FOR DELETE
    USING (auth.uid() = user_id);

-- Add comments to document the policies
COMMENT ON POLICY "Users can view their own estimates" ON public.estimates IS 'Matches invoice table RLS - SELECT only';
COMMENT ON POLICY "Users can insert their own estimates" ON public.estimates IS 'Matches invoice table RLS - INSERT only';
COMMENT ON POLICY "Users can update their own estimates" ON public.estimates IS 'Matches invoice table RLS - UPDATE only';
COMMENT ON POLICY "Users can delete their own estimates" ON public.estimates IS 'Matches invoice table RLS - DELETE only';

COMMENT ON POLICY "Users can view their own estimate line items" ON public.estimate_line_items IS 'Matches invoice_line_items table RLS - SELECT only';
COMMENT ON POLICY "Users can insert their own estimate line items" ON public.estimate_line_items IS 'Matches invoice_line_items table RLS - INSERT only';
COMMENT ON POLICY "Users can update their own estimate line items" ON public.estimate_line_items IS 'Matches invoice_line_items table RLS - UPDATE only';
COMMENT ON POLICY "Users can delete their own estimate line items" ON public.estimate_line_items IS 'Matches invoice_line_items table RLS - DELETE only';
-- Create estimates table (mirrors invoices structure)
CREATE TABLE public.estimates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    estimate_number text NOT NULL,
    estimate_date timestamp with time zone DEFAULT now(),
    valid_until_date timestamp with time zone NULL, -- Instead of due_date
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted', 'cancelled')),
    po_number text NULL,
    custom_headline text NULL,
    subtotal_amount numeric(10,2) DEFAULT 0,
    tax_percentage numeric(5,2) DEFAULT 0,
    discount_type text NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value numeric(10,2) DEFAULT 0,
    total_amount numeric(10,2) DEFAULT 0,
    notes text NULL,
    paypal_active boolean DEFAULT true,
    stripe_active boolean DEFAULT true,
    bank_account_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    -- Estimate-specific fields
    estimate_template text DEFAULT 'classic', -- Design template
    acceptance_terms text NULL, -- Terms for client acceptance
    converted_to_invoice_id uuid NULL REFERENCES public.invoices(id), -- Track conversion
    
    UNIQUE(user_id, estimate_number)
);

-- Create estimate_line_items table (mirrors invoice_line_items)
CREATE TABLE public.estimate_line_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_name text NOT NULL,
    item_description text NULL,
    quantity numeric(10,2) DEFAULT 1,
    unit_price numeric(10,2) DEFAULT 0,
    total_price numeric(10,2) DEFAULT 0,
    line_item_discount_type text NULL CHECK (line_item_discount_type IN ('percentage', 'fixed')),
    line_item_discount_value numeric(10,2) NULL,
    item_image_url text NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create estimate_shares table (mirrors invoice_shares)
CREATE TABLE public.estimate_shares (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    share_token text UNIQUE NOT NULL,
    expires_at timestamp with time zone NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create estimate_share_analytics table (mirrors invoice_share_analytics)
CREATE TABLE public.estimate_share_analytics (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    share_id uuid NOT NULL REFERENCES public.estimate_shares(id) ON DELETE CASCADE,
    event_type text NOT NULL, -- 'viewed', 'accepted', 'declined', 'downloaded'
    ip_address text NULL,
    user_agent text NULL,
    referrer text NULL,
    country text NULL,
    city text NULL,
    metadata jsonb NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_estimates_user_id ON public.estimates(user_id);
CREATE INDEX idx_estimates_client_id ON public.estimates(client_id);
CREATE INDEX idx_estimates_status ON public.estimates(status);
CREATE INDEX idx_estimates_estimate_date ON public.estimates(estimate_date);
CREATE INDEX idx_estimates_valid_until_date ON public.estimates(valid_until_date);

CREATE INDEX idx_estimate_line_items_estimate_id ON public.estimate_line_items(estimate_id);
CREATE INDEX idx_estimate_line_items_user_id ON public.estimate_line_items(user_id);

CREATE INDEX idx_estimate_shares_estimate_id ON public.estimate_shares(estimate_id);
CREATE INDEX idx_estimate_shares_token ON public.estimate_shares(share_token);

-- Enable RLS (Row Level Security)
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_share_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (users can only access their own data)
CREATE POLICY "Users can manage their own estimates" ON public.estimates
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own estimate line items" ON public.estimate_line_items
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own estimate shares" ON public.estimate_shares
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own estimate analytics" ON public.estimate_share_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.estimate_shares es
            WHERE es.id = estimate_share_analytics.share_id
            AND es.user_id = auth.uid()
        )
    );

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_estimates_updated_at BEFORE UPDATE ON public.estimates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estimate_line_items_updated_at BEFORE UPDATE ON public.estimate_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
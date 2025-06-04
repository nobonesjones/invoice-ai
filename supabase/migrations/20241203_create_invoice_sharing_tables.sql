-- Create invoice_shares table
CREATE TABLE public.invoice_shares (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on share_token for fast lookups
CREATE INDEX idx_invoice_shares_token ON public.invoice_shares(share_token);
CREATE INDEX idx_invoice_shares_invoice_id ON public.invoice_shares(invoice_id);
CREATE INDEX idx_invoice_shares_user_id ON public.invoice_shares(user_id);

-- Create invoice_share_analytics table
CREATE TABLE public.invoice_share_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    share_id UUID NOT NULL REFERENCES public.invoice_shares(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'download', 'print', 'copy_link')),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    country TEXT,
    city TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indices for analytics queries
CREATE INDEX idx_invoice_share_analytics_share_id ON public.invoice_share_analytics(share_id);
CREATE INDEX idx_invoice_share_analytics_event_type ON public.invoice_share_analytics(event_type);
CREATE INDEX idx_invoice_share_analytics_created_at ON public.invoice_share_analytics(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.invoice_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_share_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for invoice_shares
CREATE POLICY "Users can only access their own invoice shares" ON public.invoice_shares
    FOR ALL USING (auth.uid() = user_id);

-- Create RLS policies for invoice_share_analytics  
CREATE POLICY "Users can only access analytics for their own shares" ON public.invoice_share_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.invoice_shares 
            WHERE invoice_shares.id = invoice_share_analytics.share_id 
            AND invoice_shares.user_id = auth.uid()
        )
    );

-- Allow public access to shared invoices (for the public viewing functionality)
CREATE POLICY "Allow public access to active shares" ON public.invoice_shares
    FOR SELECT USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Allow public access to insert analytics (for tracking)
CREATE POLICY "Allow public analytics insertion" ON public.invoice_share_analytics
    FOR INSERT WITH CHECK (true);

-- Create updated_at trigger for invoice_shares
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_invoice_shares_updated_at 
    BEFORE UPDATE ON public.invoice_shares 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
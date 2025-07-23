-- Create customer_support_tickets table
CREATE TABLE IF NOT EXISTS public.customer_support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_user_id ON public.customer_support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_status ON public.customer_support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_customer_support_tickets_created_at ON public.customer_support_tickets(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.customer_support_tickets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own support tickets
CREATE POLICY "Users can view their own support tickets" ON public.customer_support_tickets
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own support tickets
CREATE POLICY "Users can create their own support tickets" ON public.customer_support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own support tickets
CREATE POLICY "Users can update their own support tickets" ON public.customer_support_tickets
    FOR UPDATE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customer_support_tickets_updated_at 
    BEFORE UPDATE ON public.customer_support_tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.customer_support_tickets TO authenticated;
GRANT ALL ON public.customer_support_tickets TO service_role;
-- Create estimate_activities table for tracking estimate history
CREATE TABLE IF NOT EXISTS public.estimate_activities (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_description TEXT NOT NULL,
    activity_data JSONB DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX idx_estimate_activities_estimate_id ON public.estimate_activities(estimate_id);
CREATE INDEX idx_estimate_activities_user_id ON public.estimate_activities(user_id);
CREATE INDEX idx_estimate_activities_activity_type ON public.estimate_activities(activity_type);
CREATE INDEX idx_estimate_activities_created_at ON public.estimate_activities(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.estimate_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own estimate activities" ON public.estimate_activities
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own estimate activities" ON public.estimate_activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own estimate activities" ON public.estimate_activities
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own estimate activities" ON public.estimate_activities
    FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_estimate_activities_updated_at 
    BEFORE UPDATE ON public.estimate_activities 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 
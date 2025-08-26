-- Create table for caching OpenAI assistants by deployment
CREATE TABLE assistant_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assistant_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  openai_assistant_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate assistants per user per deployment
  UNIQUE(assistant_key, user_id)
);

-- Create index for fast lookups
CREATE INDEX idx_assistant_cache_key_user ON assistant_cache(assistant_key, user_id);
CREATE INDEX idx_assistant_cache_user ON assistant_cache(user_id);

-- Enable RLS (Row Level Security)
ALTER TABLE assistant_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow users to access only their own cached assistants
CREATE POLICY "Users can manage their own assistant cache"
ON assistant_cache
FOR ALL
USING (user_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON assistant_cache TO authenticated;
GRANT ALL ON assistant_cache TO service_role;
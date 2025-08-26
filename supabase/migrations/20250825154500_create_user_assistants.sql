-- Simple table to store one assistant per user
CREATE TABLE user_assistants (
  user_id UUID PRIMARY KEY,
  assistant_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_assistants ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Users can access their own assistant"
ON user_assistants
FOR ALL
USING (user_id = auth.uid());

-- Permissions
GRANT ALL ON user_assistants TO authenticated;
GRANT ALL ON user_assistants TO service_role;
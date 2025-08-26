-- Create system_config table for storing system-wide configuration
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS but allow service role full access
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Only service role can manage system config
CREATE POLICY "Service role can manage system config"
ON system_config
FOR ALL
TO service_role
USING (true);

-- Grant permissions
GRANT SELECT ON system_config TO anon, authenticated;
GRANT ALL ON system_config TO service_role;

-- Insert default assistant ID (will be updated by script)
INSERT INTO system_config (key, value, description)
VALUES ('assistant_id', 'asst_placeholder', 'OpenAI Assistant ID for Invoice AI')
ON CONFLICT (key) DO NOTHING;
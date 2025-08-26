# Assistant Management System

This system allows you to update the OpenAI assistant without hardcoding the ID.

## Setup

1. **Create the system_config table** by running this SQL in Supabase dashboard:

```sql
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage system config"
ON system_config
FOR ALL
TO service_role
USING (true);

GRANT SELECT ON system_config TO anon, authenticated;
GRANT ALL ON system_config TO service_role;

INSERT INTO system_config (key, value, description)
VALUES ('assistant_id', 'asst_placeholder', 'OpenAI Assistant ID for Invoice AI')
ON CONFLICT (key) DO NOTHING;
```

2. **Set environment variables** in your `.env` file:
```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

To update the assistant (creates a new one with latest instructions):

```bash
node scripts/update-assistant.js
```

This will:
1. Create a new OpenAI assistant with the latest instructions
2. Store the assistant ID in the database
3. The edge function will automatically use the new assistant

## How it Works

1. **Update Script** (`scripts/update-assistant.js`):
   - Creates new assistant with your custom instructions
   - Stores the ID in `system_config` table

2. **Edge Function** (`ai-chat-assistants-poc`):
   - Reads assistant ID from database on startup
   - Caches it for performance
   - Uses this assistant for all requests

## Customizing the Assistant

Edit the `ASSISTANT_CONFIG` in `scripts/update-assistant.js`:

```javascript
const ASSISTANT_CONFIG = {
  name: "Invoice AI Assistant",
  instructions: `Your custom instructions here...`,
  model: "gpt-4o-mini",
  tools: [
    // Add your function tools here
  ]
};
```

Then run `node scripts/update-assistant.js` to apply changes.
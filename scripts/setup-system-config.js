#!/usr/bin/env node

/**
 * Setup System Config Table and Create First Assistant
 * 
 * This script creates the system_config table and runs the first assistant creation
 */

const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// Your Supabase credentials
const SUPABASE_URL = 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjYyMTc5MiwiZXhwIjoyMDYyMTk3NzkyfQ.j-tKK_AdebD1-4xgX1s1Z_ng34FTTHNP0_F44vjHqJ8';

// OpenAI API key - you'll need to add this
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ Please set OPENAI_API_KEY environment variable');
  console.log('export OPENAI_API_KEY=your_key_here');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Assistant configuration
const ASSISTANT_CONFIG = {
  name: "Invoice AI Assistant",
  instructions: `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.

RESPONSE STYLE:
• Keep responses brief and to the point
• Be warm but not verbose  
• Use 1-2 sentences when possible
• NEVER use emojis in responses
• Use **text** for emphasis instead of emojis

CAPABILITIES:
• Create and manage invoices, estimates, quotes
• Handle client information
• Manage business settings
• Track payments and line items
• Search and update existing records

Always be helpful and accurate with invoice/estimate management tasks.`,
  model: "gpt-4o-mini",
  tools: [
    { type: "code_interpreter" }
  ]
};

async function setupSystemConfig() {
  console.log('🚀 Setting up Invoice AI Assistant Management System\n');
  
  try {
    // Step 1: Create system_config table
    console.log('1️⃣ Creating system_config table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Service role can manage system config" ON system_config;
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
    `;
    
    const { error: tableError } = await supabase.rpc('exec', { sql: createTableSQL });
    
    if (tableError) {
      console.log('⚠️ Could not create table via RPC, trying direct insert...');
      // Try alternative approach
      const { error: insertError } = await supabase
        .from('system_config')
        .upsert([
          {
            key: 'assistant_id',
            value: 'asst_placeholder',
            description: 'OpenAI Assistant ID for Invoice AI'
          }
        ]);
      
      if (insertError) {
        throw new Error(`Table setup failed: ${insertError.message}. Please create table manually in Supabase dashboard.`);
      }
    }
    
    console.log('✅ System config table ready');
    
    // Step 2: Create OpenAI Assistant
    console.log('\n2️⃣ Creating OpenAI Assistant...');
    
    const assistant = await openai.beta.assistants.create(ASSISTANT_CONFIG);
    
    console.log('✅ Assistant created:', assistant.id);
    
    // Step 3: Store assistant ID in database
    console.log('\n3️⃣ Storing assistant ID in database...');
    
    const { error: updateError } = await supabase
      .from('system_config')
      .upsert({
        key: 'assistant_id',
        value: assistant.id,
        description: `OpenAI Assistant for Invoice AI - Created ${new Date().toISOString()}`,
        updated_at: new Date().toISOString()
      });
    
    if (updateError) {
      throw new Error(`Failed to store assistant ID: ${updateError.message}`);
    }
    
    console.log('✅ Assistant ID stored successfully');
    
    // Step 4: Verify setup
    console.log('\n4️⃣ Verifying setup...');
    
    const { data: configData } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'assistant_id')
      .single();
    
    console.log('✅ Verification complete!');
    console.log('\n🎉 Setup Complete! Summary:');
    console.log('━'.repeat(50));
    console.log(`Assistant ID: ${assistant.id}`);
    console.log(`Assistant Name: ${assistant.name}`);
    console.log(`Database Status: ${configData ? 'Stored' : 'Not stored'}`);
    console.log('━'.repeat(50));
    console.log('\n📝 Next Steps:');
    console.log('1. Your edge function will now automatically use this assistant');
    console.log('2. To update the assistant, run: node scripts/update-assistant.js');
    console.log('3. To check status, run: node scripts/check-system-config.js');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    
    if (error.message.includes('Table setup failed')) {
      console.log('\n📝 Manual Setup Required:');
      console.log('Please run this SQL in your Supabase dashboard:');
      console.log('\n' + '='.repeat(60));
      console.log(`
CREATE TABLE system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage system config" ON system_config FOR ALL TO service_role USING (true);
GRANT SELECT ON system_config TO anon, authenticated;
GRANT ALL ON system_config TO service_role;

INSERT INTO system_config (key, value, description)
VALUES ('assistant_id', 'asst_placeholder', 'OpenAI Assistant ID for Invoice AI');
      `);
      console.log('='.repeat(60));
      console.log('\nThen run this script again.');
    }
    
    process.exit(1);
  }
}

setupSystemConfig();
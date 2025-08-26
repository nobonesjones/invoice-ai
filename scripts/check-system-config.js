#!/usr/bin/env node

/**
 * Check System Config Table
 * 
 * This script checks if the system_config table exists and shows current values
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSystemConfig() {
  console.log('🔍 Checking system_config table...\n');
  
  try {
    // Try to fetch from system_config
    const { data, error } = await supabase
      .from('system_config')
      .select('*')
      .order('key');
    
    if (error) {
      if (error.message.includes('relation "public.system_config" does not exist')) {
        console.error('❌ Table "system_config" does not exist!');
        console.log('\n📝 Please create it by running this SQL in Supabase dashboard:\n');
        console.log('='*60);
        console.log(`
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
        `);
        console.log('='*60);
      } else {
        console.error('❌ Error accessing system_config:', error.message);
      }
      return;
    }
    
    console.log('✅ Table exists!\n');
    
    if (!data || data.length === 0) {
      console.log('⚠️  Table is empty. Run the INSERT statement above.');
    } else {
      console.log('📊 Current configuration:');
      console.log('─'.repeat(80));
      data.forEach(row => {
        console.log(`Key: ${row.key}`);
        console.log(`Value: ${row.value}`);
        console.log(`Description: ${row.description || 'N/A'}`);
        console.log(`Updated: ${row.updated_at}`);
        console.log('─'.repeat(80));
      });
      
      // Check assistant_id specifically
      const assistantConfig = data.find(row => row.key === 'assistant_id');
      if (assistantConfig) {
        if (assistantConfig.value === 'asst_placeholder') {
          console.log('\n⚠️  Assistant ID is still placeholder!');
          console.log('   Run: node scripts/update-assistant.js');
        } else {
          console.log('\n✅ Assistant ID is configured:', assistantConfig.value);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

checkSystemConfig();
#!/usr/bin/env node

/**
 * Check Assistant Functions
 * 
 * Retrieves and displays information about an OpenAI assistant,
 * including all its functions.
 * 
 * Usage:
 * node scripts/check-assistant.js [assistant_id]
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAssistant(assistantId) {
  try {
    let targetAssistantId = assistantId;
    
    // If no assistant ID provided, get from database
    if (!targetAssistantId) {
      console.log('📦 Fetching current assistant ID from database...');
      const { data, error } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'assistant_id')
        .single();
      
      if (error || !data) {
        throw new Error('Failed to fetch assistant ID from database');
      }
      
      targetAssistantId = data.value;
      console.log('✅ Current assistant ID:', targetAssistantId);
    }
    
    // Get assistant details
    console.log('\n🔍 Retrieving assistant details...');
    const assistant = await openai.beta.assistants.retrieve(targetAssistantId);
    
    console.log('✅ Assistant found!');
    console.log('   ID:', assistant.id);
    console.log('   Name:', assistant.name);
    console.log('   Model:', assistant.model);
    console.log('   Created:', new Date(assistant.created_at * 1000).toISOString());
    
    // Check tools
    console.log('\n🛠️  Tools:');
    if (assistant.tools && assistant.tools.length > 0) {
      console.log(`   Total tools: ${assistant.tools.length}`);
      
      const functions = assistant.tools.filter(tool => tool.type === 'function');
      const others = assistant.tools.filter(tool => tool.type !== 'function');
      
      if (functions.length > 0) {
        console.log(`\n📋 Functions (${functions.length}):`);
        functions.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.function.name} - ${tool.function.description.substring(0, 80)}...`);
        });
      }
      
      if (others.length > 0) {
        console.log(`\n🔧 Other tools (${others.length}):`);
        others.forEach((tool, index) => {
          console.log(`   ${index + 1}. ${tool.type}`);
        });
      }
      
      // Check for the specific functions the user mentioned
      const expectedFunctions = [
        'create_invoice',
        'add_line_items', 
        'update_business_settings',
        'create_client',
        'get_design_options',
        'get_color_options',
        'update_invoice_design',
        'update_invoice_color',
        'update_invoice_appearance',
        'create_estimate',
        'update_estimate',
        'add_estimate_line_item',
        'convert_estimate_to_invoice',
        'search_estimates',
        'update_estimate_payment_methods',
        'correct_mistake'
      ];
      
      const actualFunctionNames = functions.map(f => f.function.name);
      const missing = expectedFunctions.filter(name => !actualFunctionNames.includes(name));
      const extra = actualFunctionNames.filter(name => !expectedFunctions.includes(name));
      
      console.log(`\n✅ Function Status:`);
      console.log(`   Expected: ${expectedFunctions.length}`);
      console.log(`   Found: ${functions.length}`);
      
      if (missing.length > 0) {
        console.log(`   ❌ Missing: ${missing.join(', ')}`);
      }
      
      if (extra.length > 0) {
        console.log(`   ➕ Extra: ${extra.join(', ')}`);
      }
      
      if (missing.length === 0 && extra.length === 0) {
        console.log(`   🎉 Perfect! All expected functions are present.`);
      }
      
    } else {
      console.log('   ❌ No tools found');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
}

// Parse command line arguments
const assistantId = process.argv[2];

console.log('🤖 Assistant Function Checker\n');
checkAssistant(assistantId);
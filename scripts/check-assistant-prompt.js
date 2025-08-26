#!/usr/bin/env node

/**
 * Check Assistant Prompt
 * 
 * Shows the assistant's instructions to verify it has the correct prompt.
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkPrompt() {
  try {
    // Get current assistant ID from database
    const { data, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'assistant_id')
      .single();
    
    if (error || !data) {
      throw new Error('Failed to fetch assistant ID from database');
    }
    
    const assistantId = data.value;
    console.log('🔍 Checking prompt for assistant:', assistantId);
    
    // Get assistant details
    const assistant = await openai.beta.assistants.retrieve(assistantId);
    
    console.log('\n📝 Assistant Instructions:');
    console.log('=' .repeat(80));
    console.log(assistant.instructions);
    console.log('=' .repeat(80));
    
    // Check for key prompt sections
    const instructions = assistant.instructions;
    const keyPhrases = [
      'ACT-FIRST DELIVERY MODE',
      '🚨 INVOICE/ESTIMATE CREATION WITH ITEMS - CRITICAL',
      '🚨 CRITICAL CONTEXT AWARENESS - NEVER LOSE CONTEXT!',
      'ESTIMATE/QUOTE TERMINOLOGY',
      'MISTAKE CORRECTION - CRITICAL'
    ];
    
    console.log('\n✅ Key Sections Check:');
    keyPhrases.forEach(phrase => {
      const found = instructions.includes(phrase);
      console.log(`   ${found ? '✅' : '❌'} ${phrase}`);
    });
    
    const hasFullPrompt = keyPhrases.every(phrase => instructions.includes(phrase));
    console.log(`\n${hasFullPrompt ? '🎉 SUCCESS' : '❌ INCOMPLETE'}: Assistant has ${hasFullPrompt ? 'comprehensive' : 'basic'} prompt`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('📋 Assistant Prompt Checker\n');
checkPrompt();
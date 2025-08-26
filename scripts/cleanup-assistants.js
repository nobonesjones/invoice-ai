#!/usr/bin/env node

/**
 * Clean Up Duplicate Assistants
 * 
 * This script helps identify and optionally delete duplicate OpenAI assistants
 * that were created accidentally by the app.
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

async function cleanupAssistants() {
  try {
    // Get the current assistant ID from database
    console.log('📦 Fetching current assistant ID from database...');
    const { data: config, error } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'assistant_id')
      .single();
    
    if (error || !config) {
      throw new Error('Failed to fetch assistant ID from database');
    }
    
    const currentAssistantId = config.value;
    console.log('✅ Current assistant ID:', currentAssistantId);
    
    // List all assistants
    console.log('\n📋 Listing all assistants...');
    const assistants = await openai.beta.assistants.list({ limit: 100 });
    
    // Group by name
    const assistantGroups = {};
    assistants.data.forEach(assistant => {
      const name = assistant.name || 'Unnamed';
      if (!assistantGroups[name]) {
        assistantGroups[name] = [];
      }
      assistantGroups[name].push(assistant);
    });
    
    // Find duplicates
    console.log('\n🔍 Analyzing assistants...\n');
    let totalDuplicates = 0;
    let duplicateIds = [];
    
    Object.entries(assistantGroups).forEach(([name, assistants]) => {
      if (name === 'Invoice AI Assistant') {
        console.log(`📌 ${name}: ${assistants.length} instances`);
        assistants.forEach(a => {
          const created = new Date(a.created_at * 1000).toISOString();
          const isCurrent = a.id === currentAssistantId;
          const status = isCurrent ? '✅ CURRENT' : '❌ DUPLICATE';
          console.log(`   ${a.id} - Created: ${created} ${status}`);
          
          if (!isCurrent) {
            totalDuplicates++;
            duplicateIds.push(a.id);
          }
        });
        console.log('');
      }
    });
    
    if (totalDuplicates === 0) {
      console.log('✨ No duplicate assistants found! Your system is clean.');
      return;
    }
    
    console.log(`\n⚠️  Found ${totalDuplicates} duplicate assistant(s)`);
    console.log('\nTo delete these duplicates, run:');
    console.log('node scripts/cleanup-assistants.js --delete\n');
    
    // If --delete flag is passed, offer to delete
    if (process.argv.includes('--delete')) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question(`\n🗑️  Delete ${totalDuplicates} duplicate assistant(s)? (yes/no): `, async (answer) => {
        if (answer.toLowerCase() === 'yes') {
          console.log('\n🧹 Deleting duplicates...');
          
          for (const id of duplicateIds) {
            try {
              await openai.beta.assistants.del(id);
              console.log(`   ✅ Deleted: ${id}`);
            } catch (err) {
              console.log(`   ❌ Failed to delete ${id}: ${err.message}`);
            }
          }
          
          console.log('\n✨ Cleanup complete!');
        } else {
          console.log('\n❌ Cleanup cancelled.');
        }
        
        readline.close();
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

console.log('🧹 OpenAI Assistant Cleanup Tool\n');
cleanupAssistants();
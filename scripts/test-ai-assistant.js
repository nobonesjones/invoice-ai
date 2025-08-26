#!/usr/bin/env node

/**
 * Test AI Assistant Edge Function
 * 
 * This script tests the ai-chat-assistants-poc edge function
 * to verify it's working correctly with the configured assistant.
 */

require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_API_URL');
  if (!SUPABASE_ANON_KEY) console.error('   - EXPO_PUBLIC_ANON_KEY');
  process.exit(1);
}

async function testAssistant() {
  try {
    console.log('🧪 Testing AI Assistant Edge Function\n');
    console.log('📍 Endpoint:', `${SUPABASE_URL}/functions/v1/ai-chat-assistants-poc`);
    
    const testPayload = {
      message: "Hello! Can you help me create an invoice?",
      userId: "test-user-123",  // Test user ID
      user_id: "test-user-123"  // Support both formats
    };
    
    console.log('📤 Sending test message:', testPayload.message);
    console.log('👤 Test User ID:', testPayload.userId);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-assistants-poc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log('\n📥 Response Status:', response.status, response.statusText);
    
    const responseData = await response.json();
    
    if (response.ok) {
      console.log('✅ Success! Assistant responded:');
      console.log('   Response:', responseData.response);
      console.log('   Thread ID:', responseData.threadId);
      
      // Test a follow-up message in the same thread
      if (responseData.threadId) {
        console.log('\n🔄 Testing follow-up message...');
        const followUpPayload = {
          message: "Yes, I want to create an invoice for John Smith for $500",
          userId: "test-user-123",
          threadId: responseData.threadId
        };
        
        const followUpResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-assistants-poc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify(followUpPayload)
        });
        
        const followUpData = await followUpResponse.json();
        
        if (followUpResponse.ok) {
          console.log('✅ Follow-up Success!');
          console.log('   Response:', followUpData.response);
        } else {
          console.log('❌ Follow-up Failed:', followUpData.error);
        }
      }
      
    } else {
      console.log('❌ Error:', responseData.error || 'Unknown error');
      if (responseData.details) {
        console.log('   Details:', responseData.details);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

// Run the test
testAssistant();
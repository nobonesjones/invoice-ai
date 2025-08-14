const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Quick test runner for debugging
async function testSingle(message) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
  const apiKey = process.env.EXPO_PUBLIC_ANON_KEY;
  const userJwt = process.env.SUPABASE_TEST_JWT; // Optional: pass a real user JWT for auth.uid()
  
  console.log('Testing:', message);
  console.log('API URL:', apiUrl);
  
  const startTime = Date.now();
  
  const response = await fetch(`${apiUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userJwt || apiKey}`,
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'chat_completion',
      messages: [
        {
          role: 'user',
          content: message
        }
      ],
      // Let Edge Function pick the correct functions schema
      userName: 'Test User',
      userContext: {
        currency: 'USD',
        symbol: '$',
        isFirstInvoice: false,
        hasLogo: false
      }
    })
  });

  const duration = Date.now() - startTime;
  const result = await response.json();
  
  console.log('\nResponse:', JSON.stringify(result, null, 2));
  console.log(`\nDuration: ${duration}ms`);
  
  if (result.usage) {
    console.log(`Tokens: ${result.usage.prompt_tokens} in / ${result.usage.completion_tokens} out`);
    const cost = (result.usage.prompt_tokens * 0.01 + result.usage.completion_tokens * 0.03) / 1000;
    console.log(`Estimated cost: $${cost.toFixed(4)}`);
  }
}

// Get message from command line or use default
const message = process.argv.slice(2).join(' ') || 'Create invoice for Test Company for $100';
testSingle(message).catch(console.error);

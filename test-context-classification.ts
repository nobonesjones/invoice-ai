// Test context-aware classification for manage_estimate
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const testCase = {
  name: "Context-aware manage_estimate classification",
  history: [
    { role: 'user', content: 'Make me an estimate for Steve for a new book 50' },
    { role: 'assistant', content: 'CE - PATH VERIFICATION: CREATE ESTIMATE ROUTE CONFIRMED. This message proves the system correctly classified your request as create_estimate intent and routed it to the CE path. Today\'s color suggestion: Ocean Blue! No estimates were created - this is just path testing.' }
  ],
  message: "Can you make these 10 new books actually?",
  expectedIntent: "manage_estimate",
  expectedPrefix: "ME -"
};

async function testContextClassification() {
  try {
    console.log("🧪 Testing Context-Aware Classification");
    console.log("======================================");
    console.log(`Previous conversation:`);
    console.log(`User: ${testCase.history[0].content}`);
    console.log(`Assistant: ${testCase.history[1].content.substring(0, 100)}...`);
    console.log(`\nNew message: "${testCase.message}"`);
    console.log(`Expected intent: ${testCase.expectedIntent}`);
    console.log(`Expected prefix: ${testCase.expectedPrefix}`);
    console.log("\n" + "=".repeat(50));

    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-optimized`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: testCase.message,
        userId: 'test-user-123',
        history: testCase.history
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    // Extract the response content
    const messages = result.messages || [];
    const assistantMessage = messages.find((m: any) => m.role === 'assistant');
    const content = assistantMessage?.content || result.content || '';
    
    // Check if it correctly routes to manage_estimate (ME -)
    const hasCorrectPrefix = content.startsWith(testCase.expectedPrefix);
    const actualIntent = content.includes('MANAGE ESTIMATE') ? 'manage_estimate' : 
                        content.includes('CREATE ESTIMATE') ? 'create_estimate' : 
                        'unknown';
    
    console.log(`\n✨ RESULT:`);
    console.log(`Response: "${content.substring(0, 100)}..."`);
    console.log(`Actual intent: ${actualIntent}`);
    console.log(`Correct routing: ${hasCorrectPrefix ? '✅ YES' : '❌ NO'}`);
    
    if (hasCorrectPrefix) {
      console.log(`\n🎉 SUCCESS! The system now correctly identifies context:`);
      console.log(`   - Previous conversation about "book estimate"`);
      console.log(`   - "these 10 new books" refers to existing estimate`);
      console.log(`   - Correctly routed to ME (manage_estimate) path`);
    } else {
      console.log(`\n❌ FAILED - Still routing to wrong intent`);
      console.log(`Expected: ${testCase.expectedIntent} (${testCase.expectedPrefix})`);
      console.log(`Got: ${actualIntent}`);
    }

    console.log(`\n📊 CLASSIFICATION IMPROVEMENT:`);
    console.log(`Before: "Can you make these 10 new books" → create_estimate (wrong)`);
    console.log(`After:  "Can you make these 10 new books" → ${actualIntent} (${hasCorrectPrefix ? 'correct' : 'still wrong'})`);

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testContextClassification().catch(console.error);
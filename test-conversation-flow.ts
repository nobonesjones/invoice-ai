// Test conversation flow for context-aware invoice handling
// Run with: npx tsx test-conversation-flow.ts

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

interface ConversationStep {
  message: string;
  expectedBehavior: string;
  shouldHaveContext?: boolean;
}

const conversationFlow: ConversationStep[] = [
  {
    message: 'Make me an invoice for Peter Sill for a new pen $2.50',
    expectedBehavior: 'Creates invoice for Peter Sill',
    shouldHaveContext: false
  },
  {
    message: 'Update my business address to Harry Ltd',
    expectedBehavior: 'Updates business name AND shows updated invoice with new business name',
    shouldHaveContext: true
  }
];

async function testConversationStep(step: ConversationStep, stepNumber: number) {
  console.log(`\n🔄 Step ${stepNumber}: Conversation Flow Test`);
  console.log(`📝 Message: "${step.message}"`);
  console.log(`🎯 Expected: ${step.expectedBehavior}`);
  
  if (!SUPABASE_ANON_KEY) {
    console.log('❌ Missing EXPO_PUBLIC_ANON_KEY environment variable');
    return;
  }
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-chat-optimized`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message: step.message,
        userId: 'test-conversation-flow',
        testMode: false, // Production mode to test actual execution
        userContext: {
          currency: 'USD',
          symbol: '$',
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Classification:', result.optimization.classification.intents);
      console.log(`📊 Optimization: ${result.optimization.promptReduction} prompt, ${result.optimization.toolReduction} tools`);
      console.log(`🤖 Model: ${result.optimization.model}`);
      console.log(`🛠️ Tools: ${result.optimization.optimizedTools}`);
      
      // Check if context awareness was detected
      const hasContextIntent = result.optimization.classification.intents.includes('context_aware_update');
      
      if (step.shouldHaveContext && hasContextIntent) {
        console.log('🎯 ✅ Context awareness correctly detected!');
      } else if (step.shouldHaveContext && !hasContextIntent) {
        console.log('🎯 ❌ Context awareness NOT detected (should have been)');
      } else if (!step.shouldHaveContext && !hasContextIntent) {
        console.log('🎯 ✅ No context needed (correctly identified)');
      } else {
        console.log('🎯 ⚠️ Context detected when not expected');
      }
      
      console.log(`💬 AI would respond with: ${result.message}`);
    } else {
      console.log('❌ Error:', result.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function runConversationTest() {
  console.log('🎭 Testing Context-Aware Conversation Flow');
  console.log('==========================================');
  console.log('Simulating: Create invoice → Update business info');
  console.log('Expected: Second step should update the invoice with new info\n');
  
  for (let i = 0; i < conversationFlow.length; i++) {
    await testConversationStep(conversationFlow[i], i + 1);
    
    // Add delay between steps to simulate real conversation
    if (i < conversationFlow.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n🎯 Context-Aware Behavior Analysis:');
  console.log('===================================');
  console.log('✅ Step 1 should create the invoice (establishes context)');
  console.log('✅ Step 2 should detect context and include "context_aware_update"');
  console.log('📋 Step 2 should update business info AND regenerate the invoice');
  console.log('💡 This ensures user sees their updated invoice immediately!');
  
  console.log('\n✨ Conversation flow test complete!');
}

// Run if called directly
if (require.main === module) {
  runConversationTest();
}

export { testConversationStep };
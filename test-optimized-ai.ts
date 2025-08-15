// Test script for the optimized AI chat function
// Run with: npx ts-node test-optimized-ai.ts

const SUPABASE_URL = 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
// Load environment variables
require('dotenv').config();

const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

interface TestCase {
  name: string;
  message: string;
  expectedIntents: string[];
}

const testCases: TestCase[] = [
  {
    name: 'Simple Invoice Creation',
    message: 'Create an invoice for John Smith for website design $1500',
    expectedIntents: ['create_invoice']
  },
  {
    name: 'Multi-Request',
    message: 'Create invoice for Sarah $500 and enable PayPal payments',
    expectedIntents: ['create_invoice', 'payment_setup']
  },
  {
    name: 'Context-Aware Business Update',
    message: 'Update my business address to 123 Main Street',
    expectedIntents: ['update_business', 'context_aware_update']
  },
  {
    name: 'Context-Aware Name Change',
    message: 'Change my business name to Harry Ltd',
    expectedIntents: ['update_business', 'context_aware_update']
  },
  {
    name: 'Complex Chain',
    message: 'Change my business name to TechCorp, create invoice for Mike $800, make it purple with modern design',
    expectedIntents: ['update_business', 'create_invoice', 'design_change']
  },
  {
    name: 'Context-Aware Design Change',
    message: 'Make it purple',
    expectedIntents: ['design_change', 'context_aware_update']
  },
  {
    name: 'Analytics',
    message: 'How much does John Smith owe me?',
    expectedIntents: ['analytics']
  },
];

async function testOptimizedFunction(testCase: TestCase) {
  console.log(`\n🧪 Testing: ${testCase.name}`);
  console.log(`📝 Message: "${testCase.message}"`);
  
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
        message: testCase.message,
        userId: 'test-user-123',
        testMode: false, // Production mode to test execution engine
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
      console.log(`📊 Prompt reduction: ${result.optimization.promptReduction}`);
      console.log(`🔧 Tool reduction: ${result.optimization.toolReduction}`);
      console.log(`🤖 Model selected: ${result.optimization.model}`);
      console.log(`📏 Optimized prompt size: ${result.optimization.optimizedPromptSize} chars`);
      console.log(`🛠️ Tools selected: ${result.optimization.optimizedTools}`);
      
      if (result.message) {
        console.log(`💬 Response: ${result.message}`);
      }
    } else {
      console.log('❌ Error:', result.error);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
}

async function runTests() {
  console.log('🚀 Testing AI Chat Optimization\n');
  console.log('Original system: 43,000 chars, 46 tools');
  console.log('Testing optimized edge function...\n');
  
  for (const testCase of testCases) {
    await testOptimizedFunction(testCase);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  console.log('\n✨ Testing complete!');
}

// Run if called directly
if (require.main === module) {
  runTests();
}

export { testOptimizedFunction };
// Test the optimized AI integration
// Run with: npx tsx test-optimized-integration.ts

import { AssistantService } from './services/assistantService';

// Test messages
const testMessages = [
  'Create an invoice for John Smith for website design $1500',
  'Update my business address to 123 Main Street',
  'Create invoice for Sarah $500 and enable PayPal payments',
  'How much does John Smith owe me?',
];

async function testOptimizedAI() {
  console.log('🧪 Testing Optimized AI Integration\n');
  
  for (const message of testMessages) {
    console.log(`\n📝 Testing: "${message}"`);
    console.log('─'.repeat(60));
    
    try {
      // Note: This is a simplified test. In production, you'd need proper auth
      const result = await AssistantService.sendMessage(
        'test-user-123',
        message,
        { currency: 'USD', symbol: '$', isFirstInvoice: false, hasLogo: true }
      );
      
      console.log('✅ Response received');
      
      if (result.optimization) {
        console.log('\n📊 Optimization Stats:');
        console.log(`   Prompt: ${result.optimization.originalPromptSize} → ${result.optimization.optimizedPromptSize} chars`);
        console.log(`   Reduction: ${result.optimization.promptReduction}`);
        console.log(`   Tools: ${result.optimization.originalTools} → ${result.optimization.optimizedTools}`);
        console.log(`   Model: ${result.optimization.model}`);
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  console.log('\n\n✨ Testing complete!');
}

// Run the test
if (require.main === module) {
  testOptimizedAI().catch(console.error);
}

export { testOptimizedAI };
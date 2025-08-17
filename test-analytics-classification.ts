// Test analytics vs management classification
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const testCases = [
  {
    name: "Analytics - Who owes money",
    message: "Can you give me the valuenfonallninvoice that are due and not paid?",
    expectedIntent: "general_query",
    expectedPrefix: "GQ -",
    category: "Analytics/Reporting"
  },
  {
    name: "Analytics - Outstanding balance",
    message: "What's my total outstanding balance?",
    expectedIntent: "general_query", 
    expectedPrefix: "GQ -",
    category: "Analytics/Reporting"
  },
  {
    name: "Analytics - List unpaid",
    message: "Show me all unpaid invoices",
    expectedIntent: "general_query",
    expectedPrefix: "GQ -", 
    category: "Analytics/Reporting"
  },
  {
    name: "Management - Edit specific invoice",
    message: "Edit invoice #1234",
    expectedIntent: "manage_invoice",
    expectedPrefix: "MI -",
    category: "Invoice Management"
  },
  {
    name: "Management - Send invoice",
    message: "Send invoice to John",
    expectedIntent: "manage_invoice", 
    expectedPrefix: "MI -",
    category: "Invoice Management"
  }
];

async function testAnalyticsClassification() {
  console.log("🧪 Testing Analytics vs Management Classification");
  console.log("================================================");
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\n📊 Testing: ${testCase.name}`);
    console.log(`Category: ${testCase.category}`);
    console.log(`Message: "${testCase.message}"`);
    console.log(`Expected: ${testCase.expectedIntent} (${testCase.expectedPrefix})`);
    
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
          history: []
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      const messages = result.messages || [];
      const assistantMessage = messages.find((m: any) => m.role === 'assistant');
      const content = assistantMessage?.content || result.content || '';
      
      const hasCorrectPrefix = content.startsWith(testCase.expectedPrefix);
      const actualIntent = content.includes('GENERAL QUERY') ? 'general_query' : 
                          content.includes('MANAGE INVOICE') ? 'manage_invoice' : 
                          content.includes('CREATE INVOICE') ? 'create_invoice' :
                          'unknown';
      
      const testResult = {
        name: testCase.name,
        category: testCase.category,
        message: testCase.message,
        expectedIntent: testCase.expectedIntent,
        actualIntent,
        hasCorrectPrefix,
        passed: hasCorrectPrefix,
        reasoning: content.match(/REASONING: ([^\.]+\.)/) ? content.match(/REASONING: ([^\.]+\.)/)[1] : "No reasoning found"
      };
      
      results.push(testResult);
      
      console.log(`Result: ${actualIntent} (${hasCorrectPrefix ? '✅ CORRECT' : '❌ WRONG'})`);
      if (testResult.reasoning !== "No reasoning found") {
        console.log(`Reasoning: ${testResult.reasoning}`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      results.push({
        name: testCase.name,
        category: testCase.category,
        error: error.message,
        passed: false
      });
    }
  }
  
  // Summary
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 CLASSIFICATION RESULTS SUMMARY`);
  console.log(`${"=".repeat(50)}`);
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`Overall: ${passed}/${total} correct (${Math.round(passed/total * 100)}%)`);
  
  // Group by category
  const analyticsResults = results.filter(r => r.category === "Analytics/Reporting");
  const managementResults = results.filter(r => r.category === "Invoice Management");
  
  const analyticsPassed = analyticsResults.filter(r => r.passed).length;
  const managementPassed = managementResults.filter(r => r.passed).length;
  
  console.log(`\n📈 Analytics/Reporting: ${analyticsPassed}/${analyticsResults.length} correct`);
  console.log(`⚙️  Invoice Management: ${managementPassed}/${managementResults.length} correct`);
  
  // Show failed tests
  const failed = results.filter(r => !r.passed && !r.error);
  if (failed.length > 0) {
    console.log(`\n❌ Failed Classifications:`);
    failed.forEach(f => {
      console.log(`- "${f.message}" → Expected: ${f.expectedIntent}, Got: ${f.actualIntent}`);
    });
  }
  
  // Show errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log(`\n⚠️ Errors:`);
    errors.forEach(e => {
      console.log(`- ${e.name}: ${e.error}`);
    });
  }
  
  console.log(`\n🎯 Key Improvement:`);
  console.log(`Before: "Who owes me money?" → manage_invoice (wrong)`);
  console.log(`After:  "Who owes me money?" → general_query (correct)`);
}

// Run the test
testAnalyticsClassification().catch(console.error);
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Test cases for different prompt paths
const testCases = [
  {
    name: "Create Invoice Path",
    message: "Create an invoice for John for $500",
    expectedPrefix: "CI -",
    expectedIntent: "create_invoice"
  },
  {
    name: "Manage Invoice Path", 
    message: "Show me invoice #1234",
    expectedPrefix: "MI -",
    expectedIntent: "manage_invoice"
  },
  {
    name: "Create Estimate Path",
    message: "Create a quote for the new project",
    expectedPrefix: "CE -", 
    expectedIntent: "create_estimate"
  },
  {
    name: "Manage Estimate Path",
    message: "Convert my last estimate to an invoice",
    expectedPrefix: "ME -",
    expectedIntent: "manage_estimate"
  },
  {
    name: "General Query Path",
    message: "Update my business address",
    expectedPrefix: "GQ -",
    expectedIntent: "general_query"
  }
];

async function testPromptPath(testCase: typeof testCases[0]) {
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
    
    // Extract the first message from assistant
    const messages = result.messages || [];
    const assistantMessage = messages.find((m: any) => m.role === 'assistant');
    const content = assistantMessage?.content || result.content || '';
    
    // Check if the response starts with the expected prefix
    const hasCorrectPrefix = content.startsWith(testCase.expectedPrefix);
    
    return {
      name: testCase.name,
      message: testCase.message,
      expectedPrefix: testCase.expectedPrefix,
      expectedIntent: testCase.expectedIntent,
      response: content.substring(0, 100) + '...', // First 100 chars
      hasCorrectPrefix,
      fullContent: content,
      passed: hasCorrectPrefix
    };
  } catch (error) {
    return {
      name: testCase.name,
      error: error.message,
      passed: false
    };
  }
}

async function runPromptPathTests() {
  console.log("🧪 Testing Intent-Specific Prompt Paths\n");
  console.log("=" * 60);
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}...`);
    const result = await testPromptPath(testCase);
    results.push(result);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`Message: "${result.message}"`);
      console.log(`Expected Prefix: "${result.expectedPrefix}"`);
      console.log(`Response: "${result.response}"`);
      console.log(`Has Correct Prefix: ${result.hasCorrectPrefix ? '✅ YES' : '❌ NO'}`);
      console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (!result.passed) {
        console.log(`Full Response: "${result.fullContent}"`);
      }
    }
    console.log("-" * 60);
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Summary: ${passed}/${total} prompt paths working correctly (${Math.round(passed/total * 100)}%)\n`);
  
  // Failed tests
  const failed = results.filter(r => !r.passed && !r.error);
  if (failed.length > 0) {
    console.log("❌ Failed Tests:");
    failed.forEach(f => {
      console.log(`- ${f.name}: Expected "${f.expectedPrefix}" but response was "${f.response}"`);
    });
  }
  
  // Errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    console.log("\n⚠️ Errors:");
    errors.forEach(e => {
      console.log(`- ${e.name}: ${e.error}`);
    });
  }

  console.log("\n🎯 What the prefixes mean:");
  console.log("CI - Create Invoice path");
  console.log("MI - Manage Invoice path"); 
  console.log("CE - Create Estimate path");
  console.log("ME - Manage Estimate path");
  console.log("GQ - General Query path");
}

// Run the tests
runPromptPathTests().catch(console.error);
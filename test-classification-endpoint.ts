import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_API_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

// Test cases for classification
const testCases = [
  // Create Invoice
  { 
    name: "Simple invoice creation", 
    message: "Create an invoice for John for $500",
    history: [],
    expected: "create_invoice"
  },
  { 
    name: "Complex invoice creation", 
    message: "I need to bill my client for 10 hours at $150/hr plus expenses",
    history: [],
    expected: "create_invoice"
  },
  
  // Manage Invoice
  { 
    name: "View invoice", 
    message: "Show me invoice #1234",
    history: [],
    expected: "manage_invoice"
  },
  { 
    name: "Add logo with context", 
    message: "Add my company logo",
    history: [
      { role: "user", content: "Show me invoice #1234" },
      { role: "assistant", content: "Here's invoice #1234..." }
    ],
    expected: "manage_invoice"
  },
  
  // Create Estimate
  { 
    name: "Create estimate", 
    message: "Create a quote for the new project",
    history: [],
    expected: "create_estimate"
  },
  
  // Manage Estimate
  { 
    name: "Convert estimate", 
    message: "Convert my last estimate to an invoice",
    history: [],
    expected: "manage_estimate"
  },
  { 
    name: "Add to estimate", 
    message: "Add 5 more hours to that estimate",
    history: [
      { role: "user", content: "Show me the estimate for Sarah" },
      { role: "assistant", content: "Here's the estimate..." }
    ],
    expected: "manage_estimate"
  },
  
  // General Query
  { 
    name: "Business settings", 
    message: "Update my business address",
    history: [],
    expected: "general_query"
  },
  { 
    name: "Tax without context", 
    message: "Change my default tax rate to 10%",
    history: [],
    expected: "general_query"
  },
  { 
    name: "Tax with invoice context", 
    message: "Change the tax to 10%",
    history: [
      { role: "user", content: "Update invoice #5678" },
      { role: "assistant", content: "I've found invoice #5678..." }
    ],
    expected: "manage_invoice"
  }
];

async function testClassification(testCase: typeof testCases[0]) {
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
        history: testCase.history,
        testClassification: true // Enable test mode
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const classifiedIntent = result.classification?.intents?.[0] || 'unknown';
    
    return {
      name: testCase.name,
      message: testCase.message,
      expected: testCase.expected,
      classified: classifiedIntent,
      confidence: result.classification?.confidence,
      passed: classifiedIntent === testCase.expected,
      rationale: result.classification?.rationale,
      hasContext: testCase.history.length > 0
    };
  } catch (error) {
    return {
      name: testCase.name,
      error: error.message,
      passed: false
    };
  }
}

async function runTests() {
  console.log("🧪 Testing New Classification via Edge Function\n");
  console.log("=" * 60);
  
  const results = [];
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}...`);
    const result = await testClassification(testCase);
    results.push(result);
    
    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
    } else {
      console.log(`Message: "${result.message}"`);
      console.log(`Context: ${result.hasContext ? 'Yes' : 'No'}`);
      console.log(`Expected: ${result.expected}`);
      console.log(`Got: ${result.classified} (confidence: ${result.confidence})`);
      console.log(`Rationale: ${result.rationale}`);
      console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    }
    console.log("-" * 60);
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Summary: ${passed}/${total} tests passed (${Math.round(passed/total * 100)}%)\n`);
  
  // Failed tests
  const failed = results.filter(r => !r.passed && !r.error);
  if (failed.length > 0) {
    console.log("❌ Failed Tests:");
    failed.forEach(f => {
      console.log(`- ${f.name}: Expected ${f.expected}, got ${f.classified}`);
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
}

// Run the tests
runTests().catch(console.error);
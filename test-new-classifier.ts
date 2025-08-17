import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// New simplified classifier prompt
const SIMPLIFIED_CLASSIFIER_PROMPT = `You are a classification system for an invoice management app. Analyze the user's message along with recent conversation context to determine their intent.

AVAILABLE INTENTS:
1. create_invoice - User wants to create a new invoice
   Examples:
   - "Make an invoice for John for $500"
   - "I need to bill my client for last week's work"
   - "Create an invoice with 3 hours consulting at $150/hr, domain registration $15, and hosting $25/month"

2. manage_invoice - User wants to view, edit, send, delete, or modify existing invoices (including updates that affect invoices like logo/tax changes)
   Examples:
   - "Show me invoice #1234"
   - "Add my company logo to the invoice"
   - "Change the invoice to have 5 design hours, 2 revision rounds, and stock photos for $200"

3. create_estimate - User wants to create a new estimate/quote
   Examples:
   - "Create a quote for the new project"
   - "I need to send Sarah an estimate for $2000"
   - "Make an estimate with website design $3000, SEO setup $500, and monthly maintenance $150"

4. manage_estimate - User wants to view, edit, send, or convert existing estimates
   Examples:
   - "Convert my last estimate to an invoice"
   - "Update the estimate I sent yesterday"
   - "Add development hours to that estimate"

5. general_query - Business settings, client management, analytics, help, or other queries without invoice/estimate context
   Examples:
   - "Update my business address"
   - "What's my total revenue this month?"
   - "Add a new client named Tech Corp"

CLASSIFICATION RULES:
- Focus on the user's goal, not the technical implementation
- If discussing an invoice/estimate and user mentions logo, tax, or business details → classify as manage_invoice/manage_estimate
- If no invoice/estimate context exists → classify as general_query
- When ambiguous, consider the conversation context

RECENT CONVERSATION (last 3 message pairs):
<conversation_history>
{CONVERSATION_HISTORY}
</conversation_history>

CURRENT USER MESSAGE: {USER_MESSAGE}

Respond with ONLY a JSON object:
{
  "intent": "create_invoice|manage_invoice|create_estimate|manage_estimate|general_query",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

// Test cases
const testCases = [
  {
    name: "Create invoice simple",
    message: "Make an invoice for John for $500",
    history: [],
    expectedIntent: "create_invoice"
  },
  {
    name: "Create invoice complex",
    message: "I need to create an invoice with 10 hours of consulting at $150/hr and add travel expenses of $200",
    history: [],
    expectedIntent: "create_invoice"
  },
  {
    name: "Manage invoice - view",
    message: "Show me invoice #1234",
    history: [],
    expectedIntent: "manage_invoice"
  },
  {
    name: "Manage invoice - logo in context",
    message: "Add my company logo",
    history: [
      { role: "user", content: "Show me invoice #1234" },
      { role: "assistant", content: "Here's invoice #1234 for John Smith..." }
    ],
    expectedIntent: "manage_invoice"
  },
  {
    name: "Create estimate",
    message: "Create a quote for the new website project",
    history: [],
    expectedIntent: "create_estimate"
  },
  {
    name: "Manage estimate - add items",
    message: "Add 5 more design hours to that estimate",
    history: [
      { role: "user", content: "Show me the estimate for Sarah" },
      { role: "assistant", content: "Here's the estimate for Sarah's project..." }
    ],
    expectedIntent: "manage_estimate"
  },
  {
    name: "General query - settings",
    message: "Update my business address to 123 Main St",
    history: [],
    expectedIntent: "general_query"
  },
  {
    name: "General query - analytics",
    message: "What's my total revenue this month?",
    history: [],
    expectedIntent: "general_query"
  },
  {
    name: "Context-dependent tax update",
    message: "Change the tax to 10%",
    history: [
      { role: "user", content: "I need to update invoice #5678" },
      { role: "assistant", content: "I've found invoice #5678. What would you like to update?" }
    ],
    expectedIntent: "manage_invoice"
  },
  {
    name: "No context tax update",
    message: "Change my default tax rate to 10%",
    history: [],
    expectedIntent: "general_query"
  }
];

// Function to test classification
async function testClassification(testCase: typeof testCases[0]) {
  try {
    // Format conversation history
    const historyText = testCase.history.length > 0 
      ? testCase.history.map(msg => `${msg.role}: ${msg.content}`).join('\n')
      : "No previous messages";

    const prompt = SIMPLIFIED_CLASSIFIER_PROMPT
      .replace('{CONVERSATION_HISTORY}', historyText)
      .replace('{USER_MESSAGE}', testCase.message);

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Using gpt-4 as proxy for gpt-5-nano
      messages: [{ role: "system", content: prompt }],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    
    return {
      testCase: testCase.name,
      userMessage: testCase.message,
      expectedIntent: testCase.expectedIntent,
      classifiedIntent: result.intent,
      confidence: result.confidence,
      reasoning: result.reasoning,
      passed: result.intent === testCase.expectedIntent,
      hasContext: testCase.history.length > 0
    };
  } catch (error) {
    console.error(`Error testing "${testCase.name}":`, error);
    return {
      testCase: testCase.name,
      error: error.message,
      passed: false
    };
  }
}

// Run all tests
async function runTests() {
  console.log("🧪 Testing New Simplified Classifier\n");
  console.log("=" * 60);
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testClassification(testCase);
    results.push(result);
    
    console.log(`\nTest: ${result.testCase}`);
    console.log(`Message: "${result.userMessage}"`);
    console.log(`Context: ${result.hasContext ? 'Yes' : 'No'}`);
    console.log(`Expected: ${result.expectedIntent}`);
    console.log(`Got: ${result.classifiedIntent} (confidence: ${result.confidence})`);
    console.log(`Reasoning: ${result.reasoning}`);
    console.log(`Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log("-" * 60);
  }
  
  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  console.log(`\n📊 Summary: ${passed}/${total} tests passed (${Math.round(passed/total * 100)}%)\n`);
  
  // Failed tests details
  const failed = results.filter(r => !r.passed);
  if (failed.length > 0) {
    console.log("❌ Failed Tests:");
    failed.forEach(f => {
      console.log(`- ${f.testCase}: Expected ${f.expectedIntent}, got ${f.classifiedIntent}`);
    });
  }
}

// Compare with current classifier (optional)
async function compareClassifiers() {
  console.log("\n🔄 Comparing Old vs New Classifier\n");
  
  // This would call the existing classifier endpoint
  // For now, we'll just show the structure
  console.log("To implement: Call existing classifier and compare results");
}

// Main
async function main() {
  await runTests();
  // await compareClassifiers();
}

main().catch(console.error);
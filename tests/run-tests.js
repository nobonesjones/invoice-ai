const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Token pricing (as of Aug 2024)
const TOKEN_COSTS = {
  'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 }
};

// Load test cases
function loadTestCases() {
  const testDir = path.join(__dirname, 'test-cases');
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.json'));
  
  return files.map(file => {
    const content = fs.readFileSync(path.join(testDir, file), 'utf8');
    return JSON.parse(content);
  });
}

// Call AI Chat endpoint
async function callAI(input) {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
  const apiKey = process.env.EXPO_PUBLIC_ANON_KEY;
  const userJwt = process.env.SUPABASE_TEST_JWT; // Optional: real user JWT for auth.uid()
  
  if (!apiKey) {
    throw new Error('EXPO_PUBLIC_ANON_KEY not found in environment');
  }

  const startTime = Date.now();
  
  const response = await fetch(`${apiUrl}/functions/v1/ai-chat`, {
    method: 'POST',
    headers: {
      // Use a real user session if provided to satisfy RLS/auth.uid()
      'Authorization': `Bearer ${userJwt || apiKey}`,
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'chat_completion',
      messages: [
        {
          role: 'user',
          content: input
        }
      ],
      // Do not override functions here; let the Edge Function use the app's current function schema
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
  
  return {
    ...result,
    duration,
    status: response.status
  };
}

// Extract fields from AI response
function extractFields(response) {
  const extracted = {};
  
  // Extract function call
  if (response.functionCall) {
    extracted.function_called = response.functionCall.name;
    const args = JSON.parse(response.functionCall.arguments || '{}');
    
    // Extract common fields
    extracted.client_name = args.clientName || args.client_name;
    extracted.amount = args.amount || args.total_amount || args.total;
    extracted.total = args.total_amount || args.total; // for tests that expect total
    extracted.service = args.service || args.description || args.item_name;
    extracted.currency = args.currency || args.currency_code || args.business_currency || args.invoice_currency;
    // Payment terms mapping (e.g., payment_terms_days: 30 -> Net 30)
    if (args.payment_terms_days && !extracted.payment_terms) {
      extracted.payment_terms = `Net ${args.payment_terms_days}`;
    }
    extracted.email = args.email;
    extracted.tax_percent = args.taxPercent || args.tax_percent;
    extracted.payment_terms = args.paymentTerms || args.payment_terms;
    
    // Extract line items if present
    if (args.lineItems || args.line_items) {
      extracted.line_items = (args.lineItems || args.line_items).map(item => ({
        description: item.description || item.item_name,
        amount: item.amount || item.total_price || (item.quantity && item.unit_price ? item.quantity * item.unit_price : undefined)
      }));
    }
  }
  
  // Check if asking for clarification
  if (response.content || response.choices?.[0]?.message?.content) {
    const content = response.content || response.choices[0].message.content;
    if (content && (
      content.toLowerCase().includes('please provide') ||
      content.toLowerCase().includes('could you please') ||
      content.toLowerCase().includes('need more information') ||
      content.toLowerCase().includes('what is the') ||
      content.toLowerCase().includes('specify the')
    )) {
      extracted.asks_for_clarification = true;
    }
  }
  
  return extracted;
}

// Compare expected vs actual
function compareResults(expected, actual) {
  const issues = [];
  
  for (const [key, expectedValue] of Object.entries(expected)) {
    const actualValue = actual[key];
    
    if (key === 'line_items' && Array.isArray(expectedValue)) {
      // Special handling for line items
      if (!Array.isArray(actualValue) || actualValue.length !== expectedValue.length) {
        issues.push(`Line items count mismatch`);
      }
    } else if (typeof expectedValue === 'number') {
      // Allow small differences for numbers
      if (Math.abs(actualValue - expectedValue) > 0.01) {
        issues.push(`${key}: expected ${expectedValue}, got ${actualValue}`);
      }
    } else if (key === 'function_called') {
      // Normalize function name (camelCase vs snake_case)
      const norm = (v) => (v || '').toString().toLowerCase().replace(/[^a-z]/g, '');
      if (norm(actualValue) !== norm(expectedValue)) {
        issues.push(`${key}: expected ${expectedValue}, got ${actualValue}`);
      }
    } else if (actualValue !== expectedValue) {
      issues.push(`${key}: expected ${expectedValue}, got ${actualValue}`);
    }
  }
  
  return issues;
}

// Calculate token costs
function calculateCost(tokens, model = 'gpt-4-turbo') {
  const pricing = TOKEN_COSTS[model] || TOKEN_COSTS['gpt-4-turbo'];
  const inputCost = (tokens.input || 0) / 1000 * pricing.input;
  const outputCost = (tokens.output || 0) / 1000 * pricing.output;
  return {
    input: inputCost,
    output: outputCost,
    total: inputCost + outputCost
  };
}

// Main test runner
async function runTests() {
  console.log(`${colors.blue}Loading test cases...${colors.reset}\n`);
  const testCases = loadTestCases();
  
  const results = {
    passed: 0,
    failed: 0,
    totalDuration: 0,
    totalTokens: { input: 0, output: 0 },
    totalCost: 0,
    details: []
  };
  
  for (const test of testCases) {
    console.log(`Running: ${test.name}`);
    console.log(`Input: "${test.input}"`);
    
    try {
      const response = await callAI(test.input);
      const extracted = extractFields(response);
      const issues = compareResults(test.expected, extracted);
      
      const passed = issues.length === 0;
      const tokens = response.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const cost = calculateCost({
        input: tokens.prompt_tokens,
        output: tokens.completion_tokens
      });
      
      results.totalDuration += response.duration;
      results.totalTokens.input += tokens.prompt_tokens || 0;
      results.totalTokens.output += tokens.completion_tokens || 0;
      results.totalCost += cost.total;
      
      if (passed) {
        results.passed++;
        console.log(`${colors.green}✅ PASSED${colors.reset} (${response.duration}ms, $${cost.total.toFixed(4)})`);
      } else {
        results.failed++;
        console.log(`${colors.red}❌ FAILED${colors.reset} (${response.duration}ms, $${cost.total.toFixed(4)})`);
        issues.forEach(issue => console.log(`   ${colors.red}- ${issue}${colors.reset}`));
      }
      
      console.log(`   Tokens: ${tokens.prompt_tokens} in / ${tokens.completion_tokens} out`);
      
      results.details.push({
        test: test.name,
        passed,
        duration: response.duration,
        tokens,
        cost,
        issues,
        response: response.content,
        functionCall: response.functionCall
      });
      
    } catch (error) {
      results.failed++;
      console.log(`${colors.red}❌ ERROR: ${error.message}${colors.reset}`);
      results.details.push({
        test: test.name,
        passed: false,
        error: error.message
      });
    }
    
    console.log(''); // Empty line between tests
  }
  
  // Summary
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.blue}TEST SUMMARY${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}`);
  console.log(`Total tests: ${testCases.length}`);
  console.log(`${colors.green}Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${results.failed}${colors.reset}`);
  console.log(`\nPerformance:`);
  console.log(`  Total duration: ${results.totalDuration}ms`);
  console.log(`  Average: ${Math.round(results.totalDuration / testCases.length)}ms per test`);
  console.log(`\nToken Usage:`);
  console.log(`  Input tokens: ${results.totalTokens.input}`);
  console.log(`  Output tokens: ${results.totalTokens.output}`);
  console.log(`  Total tokens: ${results.totalTokens.input + results.totalTokens.output}`);
  console.log(`\n${colors.yellow}Estimated Cost: $${results.totalCost.toFixed(4)}${colors.reset}`);
  console.log(`  Per test: $${(results.totalCost / testCases.length).toFixed(4)}`);
  
  // Save detailed results
  const reportPath = path.join(__dirname, 'test-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
  process.exit(1);
});

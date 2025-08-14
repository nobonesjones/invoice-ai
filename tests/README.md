# Invoice AI Test Suite

Quick and simple test suite to validate AI invoice assistant functionality with token cost tracking.

## Setup

```bash
cd tests
npm install
```

## Run All Tests

```bash
npm test
```

This will:
- Run all test cases in `test-cases/` folder
- Show pass/fail for each test
- Track response times
- Calculate token usage and costs
- Save detailed results to `test-results.json`

## Run Single Test

```bash
node run-single-test.js "Create invoice for ABC Corp for $500"
```

## Test Output

Each test shows:
- ✅ PASSED or ❌ FAILED
- Response time in milliseconds
- Token usage (input/output)
- Estimated cost

Summary includes:
- Total tests run
- Pass/fail count
- Average response time
- Total token usage
- **Total estimated cost**

## Adding New Tests

Create a new JSON file in `test-cases/`:

```json
{
  "id": "unique-id",
  "name": "Test description",
  "input": "Natural language input",
  "expected": {
    "client_name": "Expected Client",
    "amount": 100,
    "function_called": "createInvoice"
  }
}
```

## Cost Estimates

Based on GPT-4 Turbo pricing:
- Input: $0.01 per 1K tokens
- Output: $0.03 per 1K tokens

Typical test costs ~$0.002-0.005 per test.
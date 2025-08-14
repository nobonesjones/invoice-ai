# Invoice AI Testing Plan

## Overview
A phased approach to testing our AI invoice assistant, focusing on rapid delivery with token cost tracking.

## Phase 1: MVP Test Suite (TODAY - 4 hours)

### What We're Building
- Simple Node.js test runner
- 10 critical test cases  
- Token usage & cost tracking
- Pass/fail console output

### Test Coverage
1. **Basic invoice creation** - "Create invoice for John Smith for $500 web design"
2. **Invoice with tax** - "Invoice ABC Company $1000 consulting with 10% tax"
3. **Multiple line items** - "Invoice with logo $500, website $2000, cards $300"
4. **Payment terms** - "Invoice Tech Corp $2500 due in 30 days"
5. **Hourly billing** - "Bill 10 hours at $150/hour for consulting"
6. **Estimate creation** - "Create estimate for $15000 kitchen renovation"
7. **Client creation** - "Create client Sarah Johnson sarah@example.com"
8. **Currency handling** - "Invoice £1500 for IT support"
9. **Error handling** - "Create an invoice" (missing info)
10. **Typo tolerance** - "Crate invioce for Jon Smith $100"

### Deliverables
- `/tests/test-cases/*.json` - Test definitions
- `/tests/run-tests.js` - Test runner with token tracking
- `/tests/test-results.json` - Output with costs
- Console report with pass/fail + costs

### Success Metrics
- Response time < 3s per test
- Cost < $0.01 per test
- 80%+ pass rate on critical tests

## Phase 2: Extended Coverage (Week 1)

### Additional Test Cases (20 more)
- Payment recording & status updates
- Partial payments & balance calculations
- Discount applications (% and fixed)
- Recurring invoices
- Duplicate detection
- Search functionality
- Date parsing edge cases
- Multi-currency support

### Enhanced Runner
- Parallel test execution
- Retry logic for flaky tests
- Performance benchmarking
- Cost optimization analysis

## Phase 3: Automated Validation (Week 2)

### Simple Judge System
- Basic field extraction validation
- Math verification (totals, tax, discounts)
- Required field checking
- Response format validation

### CI Integration
- GitHub Actions workflow
- Run on PR creation
- Block merge on failures
- Daily scheduled runs

## Phase 4: Production Monitoring (Week 3)

### Real Usage Tracking
- Log production API calls
- Track token usage by user
- Monitor error patterns
- Cost analysis dashboard

### A/B Testing Framework
- Compare model performance
- Test prompt variations
- Measure accuracy improvements
- ROI analysis

## Implementation Details

### Test Case Format
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

### Token Cost Tracking
- Input tokens: $0.01/1K (GPT-4 Turbo)
- Output tokens: $0.03/1K
- Track per test & total costs
- Estimate monthly production costs

### Quick Commands
```bash
# Run all tests
npm test

# Run single test
node run-single-test.js "Create invoice for $100"

# View results
cat test-results.json
```

## Why This Approach?

1. **Ship Today** - Get testing in place immediately
2. **Cost Visibility** - Know exactly what AI costs
3. **Simple to Extend** - Add tests as JSON files
4. **Production Ready** - Same API calls as real app
5. **Data Driven** - Make decisions based on metrics

## Next Steps

1. ✅ Phase 1: Build MVP suite (TODAY)
2. ⏳ Phase 2: Extend coverage (Week 1)
3. ⏳ Phase 3: Add automation (Week 2)
4. ⏳ Phase 4: Production monitoring (Week 3)

Each phase builds on the previous, ensuring we always have working tests while gradually improving coverage and automation.
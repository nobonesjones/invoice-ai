# Invoice AI Testing Framework

## Overview
This document provides a comprehensive testing framework for the Invoice AI system, focusing on realistic user scenarios that test individual variables while maintaining the core requirement: **Client + Line Item + Variable**.

## Testing Philosophy

### Core Requirements
Every test scenario must include:
1. **Client** (minimum: name)
2. **At least 1 line item** (minimum: name + price)
3. **One specific variable** being tested

### Testing Principles
- ✅ **Realistic scenarios** - Based on actual user behavior
- ✅ **Single variable focus** - Test one feature at a time
- ✅ **Progressive complexity** - Start simple, build complexity
- ❌ **Avoid unrealistic combinations** - No "kitchen sink" scenarios
- ❌ **No overwhelming changes** - Focus on practical usage

## Test Categories Overview

| Category | Scenarios | Purpose |
|----------|-----------|---------|
| 📅 **Date & Timing** | UJ001-UJ003 | Test date parsing and due date options |
| 💰 **Financial** | UJ004-UJ006 | Test discounts, taxes, and calculations |
| 👥 **Client Info** | UJ007-UJ010 | Test client data capture variations |
| 📝 **Line Items** | UJ011-UJ013 | Test item parsing and quantities |
| 💳 **Payments** | UJ014-UJ016 | Test payment method integration |
| 🎨 **Design** | UJ017-UJ018 | Test visual customization |
| 📋 **Administrative** | UJ019-UJ022 | Test business process features |
| 🔄 **Context** | UJ023-UJ025 | Test conversation memory |
| 🔢 **Complex** | UJ026-UJ027 | Test advanced parsing |
| ❌ **Error Handling** | UJ028-UJ029 | Test constraint validation |

## Quick Test Reference

### Essential Tests (Must Pass)
```
UJ001: "Create an invoice for John Smith for website design at $500, due January 30th"
UJ004: "Create an invoice for Mike Brown for photography $800 with 10% discount"
UJ011: "Create an invoice for Rachel Green for web design $500 and logo design $200"
UJ023: Create invoice → "Add logo design for $200"
```

### Payment Integration Tests
```
UJ014: PayPal - "Create an invoice for Jane Roberts for design work $450 with PayPal payment option"
UJ015: Stripe - "Create an invoice for StartUp Inc for consulting $800 with card payments"
UJ016: Bank - "Create an invoice for Enterprise Corp for project work $2500 with bank transfer option"
```

### Advanced Feature Tests
```
UJ017: Design - "Create an invoice for Creative Agency for branding $900 using the modern template"
UJ020: Custom message - "Create an invoice for Happy Client for project completion $750 with headline 'Thank you for your business!'"
UJ026: Complex items - "Create an invoice for Construction Co for 2 hours labor at $75/hour and 50 sq ft flooring at $5 per sq ft"
```

## Test Execution Process

### 1. Pre-Test Setup
- Ensure clean database state
- Verify payment methods are configured if testing payment features
- Confirm business settings are properly set

### 2. Test Execution Steps
For each scenario:
1. **Send user message** to AI chat
2. **Capture AI response** and function calls
3. **Verify function parameters** match expected values
4. **Check database records** for correct data storage
5. **Validate UI display** shows correct information
6. **Test invoice preview** renders properly

### 3. Verification Checklist
- [ ] Correct function called with right parameters
- [ ] Invoice created in database with accurate data
- [ ] All calculated fields (totals, taxes) are correct
- [ ] Invoice displays properly in mobile app
- [ ] PDF generation works (if applicable)
- [ ] Share functionality works (if applicable)

### 4. Error Documentation
For failed tests:
- Record exact user input
- Note AI response vs expected response
- Document database state vs expected state
- Screenshot UI issues
- Log any error messages

## Automated Testing Script Template

```typescript
interface TestScenario {
  id: string;
  category: string;
  userInput: string;
  expectedFunction: string;
  expectedParameters: Record<string, any>;
  expectedResponse: string;
  priority: 'high' | 'medium' | 'low';
}

const testScenarios: TestScenario[] = [
  {
    id: 'UJ001',
    category: 'Date & Timing',
    userInput: 'Create an invoice for John Smith for website design at $500, due January 30th',
    expectedFunction: 'create_invoice',
    expectedParameters: {
      client_name: 'John Smith',
      line_items: [{ item_name: 'Website design', unit_price: 500 }],
      due_date: '2024-01-30'
    },
    expectedResponse: 'Invoice created for John Smith',
    priority: 'high'
  },
  // ... more scenarios
];

async function runTest(scenario: TestScenario) {
  const result = await sendToAI(scenario.userInput);
  
  // Verify function call
  assert(result.functionCall === scenario.expectedFunction);
  assert(deepEqual(result.parameters, scenario.expectedParameters));
  
  // Verify database
  const invoice = await getLatestInvoice();
  assert(invoice.client_name === scenario.expectedParameters.client_name);
  
  // Verify UI
  const uiData = await getInvoiceUI(invoice.id);
  assert(uiData.displays_correctly);
}
```

## Performance Benchmarks

### Response Time Targets
- **Simple creation** (UJ001-UJ010): < 3 seconds
- **Complex parsing** (UJ026-UJ027): < 5 seconds
- **Context awareness** (UJ023-UJ025): < 2 seconds

### Accuracy Targets
- **Function call accuracy**: 100%
- **Parameter extraction**: 98%
- **Date parsing**: 95%
- **Price parsing**: 100%
- **Context retention**: 90%

## Test Data Management

### Sample Clients
```
Standard: John Smith, Jane Roberts, Mike Brown
Business: ABC Corp, Tech Solutions, Enterprise Corp
Government: Government Office (for PO number testing)
Email: Emma Davis (emma@email.com)
Phone: David Wilson (555-1234)
Address: Green Corp (123 Main St)
```

### Sample Services
```
Common: web design, logo design, consulting, photography
Technical: software development, SEO package, maintenance
Physical: repair work, delivery, supplies, labor
Packages: training, project completion, setup fee
```

### Sample Prices
```
Low: $75, $200, $250, $300
Medium: $400, $500, $600, $650
High: $800, $900, $1000, $1200
Enterprise: $1500, $2000, $2500
```

## Regression Testing

### After AI Prompt Changes
- Run all high-priority scenarios (UJ001-UJ006, UJ011-UJ013, UJ023-UJ025)
- Verify context awareness still works
- Check payment integration functionality

### After Database Schema Changes
- Run full test suite
- Verify field mappings are correct
- Check calculated fields work properly

### After UI Changes
- Run UI verification tests
- Check invoice preview rendering
- Verify share/export functionality

## Reporting

### Daily Test Reports
- Pass/fail rates by category
- Response time metrics
- Failed test details with screenshots

### Weekly Analysis
- Trend analysis of test results
- New failure patterns
- Performance degradation alerts

### Test Coverage Metrics
- Scenarios tested vs total scenarios
- Function coverage percentage
- Parameter combination coverage

This framework ensures comprehensive testing while maintaining focus on realistic user behavior and single-variable testing principles.
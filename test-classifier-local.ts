// Simple local test for classifier logic
const testCases = [
  { message: "Create an invoice for John for $500", expected: "create_invoice" },
  { message: "Show me invoice #1234", expected: "manage_invoice" },
  { message: "Create a quote for the project", expected: "create_estimate" },
  { message: "Convert my last estimate to an invoice", expected: "manage_estimate" },
  { message: "Update my business address", expected: "general_query" },
  { message: "Add my logo to the invoice", expected: "manage_invoice", needsContext: true },
  { message: "Change tax to 10%", expected: "general_query", altExpected: "manage_invoice" }
];

console.log("🧪 Classifier Test Cases\n");
console.log("These test cases show expected classifications:");
console.log("=" * 50 + "\n");

testCases.forEach((test, i) => {
  console.log(`${i + 1}. "${test.message}"`);
  console.log(`   Expected: ${test.expected}`);
  if (test.altExpected) {
    console.log(`   Alt Expected: ${test.altExpected} (with invoice context)`);
  }
  if (test.needsContext) {
    console.log(`   Note: Needs invoice context for this classification`);
  }
  console.log("");
});

console.log("\nTo run full tests with actual API:");
console.log("1. Deploy: ./deploy-optimized-function.sh");
console.log("2. Test: npx tsx test-classification-endpoint.ts");
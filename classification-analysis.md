# Classification Analysis: "Add labour to it"

## The Message
"Ok great please add labour too it is 450 / day 2 days"

## Likely Classification Reasoning

Based on the classification prompt and rules, here's what likely happened:

### 1. **Context Provided to Classifier**
The classifier would have received:
```
RECENT CONVERSATION (last 3 message pairs):
user: Create an invoice for Frazer Jones for new website
assistant: I have created invoice #INV-0001 for Frazer Jones totaling $2500.00...
user: Ok great please add labour too it is 450 / day 2 days
```

### 2. **Why It Might Have Been Misclassified**

The classifier likely focused on:
- The word "labour" (not explicitly mentioned as a line item in examples)
- The misspelling "too" instead of "to"
- The client name "Frazer Jones" being prominent in the conversation
- No explicit invoice number reference in the user's message

### 3. **Possible Misinterpretation**

The AI might have interpreted this as:
- "Add labour" = Add a labor/service attribute to something
- "too it" = Unclear reference (due to misspelling)
- Context has "Frazer Jones" = Maybe update the client?

### 4. **What Should Have Happened**

With proper classification:
- "add [item] to it" pattern = manage_invoice
- "it" refers to the recently created invoice
- "labour" is a line item to add

### 5. **The Fix Applied**

Added explicit examples and rules:
- "Add labour to it for $450/day for 2 days" as an example
- Rule: "Add [item] to it/that" ALWAYS means manage_invoice
- Rule: NEVER classify as client management

## Conclusion

The misclassification happened because:
1. No explicit examples for "add labour to it" pattern
2. The misspelling "too" may have confused the parser
3. The prominence of "Frazer Jones" in context may have biased toward client operations
4. The informal language wasn't well covered in examples

The updated classification prompt should now correctly identify this as `manage_invoice`.
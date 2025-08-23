#!/bin/bash

echo "🧪 Testing Invoice Gate - 'Last Invoice Wins' Pattern"
echo "==================================================="

echo ""
echo "🎯 This test will simulate multiple AI function calls that would previously"
echo "   return multiple invoices. Now it should return only 1 invoice."
echo ""

# Test with a message that would trigger multiple invoice-related functions
echo "📝 Test message: 'Create invoice for John Smith for consulting $500 then add PayPal payments'"
echo "   Expected: AI will call create_invoice AND setup_paypal_payments"
echo "   Expected: Only 1 invoice returned (not 2)"
echo ""

echo "🚀 Sending test request..."
echo ""

response=$(curl -s -X POST 'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/ai-chat-assistants-poc' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI2MTQ2NDIsImV4cCI6MjAwODE5MDY0Mn0.UOmhjRp06KSbmjqsn_ym8fNM1ZfV-zlVsEUeIWrlR3c' \
  -H 'Content-Type: application/json' \
  -d '{"message": "Create invoice for John Smith for consulting $500 then add PayPal payments"}')

# Check if response contains error
if [[ "$response" == *"error"* ]]; then
  echo "❌ Request failed:"
  echo "$response" | head -c 500
  exit 1
fi

# Parse the response to check attachments count
attachment_count=$(echo "$response" | python3 -c "
import json
import sys
try:
    data = json.load(sys.stdin)
    if 'attachments' in data:
        print(len(data['attachments']))
    else:
        print('0')
except:
    print('parse_error')
")

echo "📊 Results:"
echo "  Attachments returned: $attachment_count"

if [ "$attachment_count" == "1" ]; then
  echo "  ✅ SUCCESS: Only 1 invoice returned (Invoice Gate working!)"
elif [ "$attachment_count" == "0" ]; then
  echo "  ⚠️ NO INVOICES: Function may not have created/returned an invoice"
elif [ "$attachment_count" -gt 1 ]; then
  echo "  ❌ FAILED: Multiple attachments returned ($attachment_count) - Gate not working"
else
  echo "  ❌ PARSE ERROR: Could not determine attachment count"
fi

echo ""
echo "🔍 Check logs for Invoice Gate messages:"
echo "supabase functions logs ai-chat-assistants-poc --project-ref wzpuzqzsjdizmpiobsuo | grep 'Invoice Gate'"
echo ""
echo "Expected log messages:"
echo "  [Invoice Gate] Setting latest invoice: INV-XXXX"  
echo "  [Attachment Gate] Returning single invoice: INV-XXXX"
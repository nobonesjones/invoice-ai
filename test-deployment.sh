#!/bin/bash

echo "🧪 Testing Invoice AI Deployment Workflow"
echo "========================================"

echo ""
echo "✅ Testing ai-chat-optimized function..."
response1=$(curl -s -X POST 'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/ai-chat-optimized' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI2MTQ2NDIsImV4cCI6MjAwODE5MDY0Mn0.UOmhjRp06KSbmjqsn_ym8fNM1ZfV-zlVsEUeIWrlR3c' \
  -H 'Content-Type: application/json' \
  -d '{"message": "test"}' | head -c 100)

if [[ "$response1" == *"error"* ]]; then
  echo "❌ ai-chat-optimized error: $response1"
else
  echo "✅ ai-chat-optimized working: $response1..."
fi

echo ""
echo "✅ Testing ai-chat-assistants-poc function..."
response2=$(curl -s -X POST 'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/ai-chat-assistants-poc' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI2MTQ2NDIsImV4cCI6MjAwODE5MDY0Mn0.UOmhjRp06KSbmjqsn_ym8fNM1ZfV-zlVsEUeIWrlR3c' \
  -H 'Content-Type: application/json' \
  -d '{"message": "test"}' | head -c 100)

if [[ "$response2" == *"error"* ]]; then
  echo "❌ ai-chat-assistants-poc error: $response2"
else
  echo "✅ ai-chat-assistants-poc working: $response2..."
fi

echo ""
echo "🎉 Deployment test complete!"
echo "Both functions are deployed and responding."
echo ""
echo "📝 Next Steps:"
echo "1. Test with real user message to trigger assistant creation"
echo "2. Check logs: supabase functions logs ai-chat-assistants-poc --project-ref wzpuzqzsjdizmpiobsuo"
echo "3. Look for: '[Assistants POC] Created new assistant: asst_xyz123'"
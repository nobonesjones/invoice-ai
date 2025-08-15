#!/bin/bash

echo "🚀 Deploying AI Chat Optimized Function"
echo "======================================="

# Create a temporary clean .env file
echo "Creating temporary clean environment..."
cp .env .env.backup
grep -v '`' .env > .env.clean || true
mv .env.clean .env

# Deploy the function
echo "Deploying function to Supabase..."
supabase functions deploy ai-chat-optimized --project-ref wzpuzqzsjdizmpiobsuo

# Restore original .env
mv .env.backup .env

echo "✅ Deployment complete!"
echo ""
echo "Your optimized function is now available at:"
echo "https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/ai-chat-optimized"
echo ""
echo "Original function (fallback) remains at:"
echo "https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/ai-chat"
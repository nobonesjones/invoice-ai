#!/bin/bash

# Deploy the support email function to Supabase
# Make sure you're logged in to Supabase CLI first: supabase login

echo "Deploying send-support-email function..."

supabase functions deploy send-support-email --project-ref wzpuzqzsjdizmpiobsuo

if [ $? -eq 0 ]; then
    echo "✅ Function deployed successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Apply the migration: supabase db push --linked"
    echo "2. Test the support form in your app"
    echo "3. Check harry@getsuperinvoice.com for test emails"
else
    echo "❌ Deployment failed. Make sure you're logged in:"
    echo "   supabase login"
    echo ""
    echo "Then try running this script again."
fi

#!/usr/bin/env node

/**
 * Debug script to test subscription checking for harryhello@gmail.com
 * This replicates the exact same logic the AI functions use
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MjE3OTIsImV4cCI6MjA2MjE5Nzc5Mn0._XypJP5hEZT06UfA1uuHY5-TvsKzj5JnwjGa3LMKnyI';

const supabase = createClient(supabaseUrl, supabaseKey);

const TEST_USER_ID = '79a88e2d-7f69-4eb1-a30c-0c4750835959'; // harryhello@gmail.com

async function testSubscriptionCheck() {
  console.log('🔍 Testing subscription check for harryhello@gmail.com');
  console.log('User ID:', TEST_USER_ID);
  console.log('Time:', new Date().toISOString());
  console.log('---');

  try {
    // Test 1: Direct database query (same as AI functions)
    console.log('📊 Test 1: Direct subscription_tier check');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('subscription_tier, free_limit, subscription_expires_at')
      .eq('id', TEST_USER_ID)
      .single();
    
    console.log('Profile query result:', { profile, error: profileError });
    
    if (profile) {
      const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
      console.log('Subscription tier:', profile.subscription_tier);
      console.log('Is subscribed?', isSubscribed);
      console.log('Free limit:', profile.free_limit);
      console.log('Expires at:', profile.subscription_expires_at);
    }
    
    console.log('---');

    // Test 2: User auth check
    console.log('🔐 Test 2: Auth user check');
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log('Auth check result:', { user: user?.id, email: user?.email, error: authError });
    } catch (e) {
      console.log('Auth check not available (expected in Node.js)');
    }
    
    console.log('---');

    // Test 3: Usage tracking check
    console.log('📈 Test 3: Usage stats check');
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('id')
      .eq('user_id', TEST_USER_ID);
    
    const { data: estimates, error: estimateError } = await supabase
      .from('estimates')
      .select('id')
      .eq('user_id', TEST_USER_ID);
      
    console.log('Invoice count:', invoices?.length || 0, 'Error:', invoiceError);
    console.log('Estimate count:', estimates?.length || 0, 'Error:', estimateError);
    console.log('Total items:', (invoices?.length || 0) + (estimates?.length || 0));
    
    console.log('---');
    console.log('✅ Subscription check complete');

  } catch (error) {
    console.error('❌ Error during subscription check:', error);
  }
}

// Run the test
testSubscriptionCheck().then(() => {
  console.log('🏁 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});
#!/usr/bin/env node

// Debug script to check user subscription status
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_API_URL;
const supabaseKey = process.env.EXPO_PUBLIC_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugUserSubscription(userId) {
  console.log('=== DEBUG USER SUBSCRIPTION STATUS ===');
  console.log('User ID:', userId);
  
  try {
    // Check user_profiles table
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log('\n1. USER PROFILE QUERY:');
    console.log('Error:', profileError);
    console.log('Profile:', profile);
    
    if (profile) {
      console.log('\n2. SUBSCRIPTION ANALYSIS:');
      console.log('subscription_tier:', profile.subscription_tier);
      console.log('Is premium/grandfathered?', ['premium', 'grandfathered'].includes(profile.subscription_tier));
      
      // Count invoices
      const { count: invoicesCount, error: invoicesError } = await supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      // Count estimates  
      const { count: estimatesCount, error: estimatesError } = await supabase
        .from('estimates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      console.log('\n3. USAGE COUNTS:');
      console.log('Invoices count:', invoicesCount, 'Error:', invoicesError);
      console.log('Estimates count:', estimatesCount, 'Error:', estimatesError);
      console.log('Total items:', (invoicesCount || 0) + (estimatesCount || 0));
      
      // Simulate the checkUsageLimits logic
      const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
      const totalItems = (invoicesCount || 0) + (estimatesCount || 0);
      const remaining = Math.max(0, 3 - totalItems);
      const canCreate = isSubscribed || totalItems < 3;
      
      console.log('\n4. SIMULATED checkUsageLimits RESULT:');
      console.log('isSubscribed:', isSubscribed);
      console.log('totalItems:', totalItems);
      console.log('remaining:', remaining);
      console.log('canCreate:', canCreate);
      
      // The exact response format
      if (isSubscribed) {
        console.log('\n5. AI WOULD RECEIVE (Premium User):');
        console.log({
          success: true,
          data: {
            canCreate: true,
            isSubscribed: true,
            subscription_tier: profile.subscription_tier,
            message: "You have unlimited access to create invoices and estimates with your premium subscription."
          },
          message: "✅ You can create unlimited invoices and estimates with your premium subscription!"
        });
      } else if (totalItems >= 3) {
        console.log('\n5. AI WOULD RECEIVE (Limit Reached):');
        console.log({
          success: true,
          data: {
            canCreate: false,
            isSubscribed: false,
            totalItems: totalItems,
            limit: 3,
            remaining: 0
          },
          message: "❌ You've reached your free plan limit of 3 items. To continue creating invoices and estimates, you can upgrade to premium by going to the Settings tab and clicking the Upgrade button at the top. Once subscribed, you'll have unlimited access and can cancel anytime!"
        });
      } else {
        console.log('\n5. AI WOULD RECEIVE (Can Still Create):');
        console.log({
          success: true,
          data: {
            canCreate: true,
            isSubscribed: false,
            totalItems: totalItems,
            limit: 3,
            remaining: remaining
          },
          message: `✅ You can create items! You have ${remaining} out of 3 free items remaining.`
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

const userId = process.argv[2] || '716845bd-0294-4a24-84ef-a9a03998bff8';
debugUserSubscription(userId);
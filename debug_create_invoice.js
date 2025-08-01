#!/usr/bin/env node

// Debug script to test invoice creation for specific user
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_API_URL;
const supabaseKey = process.env.EXPO_PUBLIC_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugCreateInvoice(userId) {
  console.log('=== DEBUG INVOICE CREATION PROCESS ===');
  console.log('User ID:', userId);
  
  try {
    // 1. Check if user profile exists - this is what breaks checkUsageLimits
    console.log('\n1. CHECKING USER PROFILE:');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log('Profile exists:', !!profile);
    console.log('Profile error:', profileError);
    
    if (profileError && profileError.code === 'PGRST116') {
      console.log('❌ FOUND THE PROBLEM: User has no profile record!');
      console.log('This is why checkUsageLimits fails and returns an error.');
      
      // Create the missing profile
      console.log('\n2. CREATING MISSING USER PROFILE:');
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          onboarding_completed: false,
          invoice_count: 0,
          subscription_tier: 'premium', // Set as premium since they should be
          free_limit: 3,
          sent_invoice_count: 0
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create profile:', createError);
      } else {
        console.log('✅ Created user profile:', newProfile);
        
        // Now test the checkUsageLimits logic
        console.log('\n3. TESTING checkUsageLimits LOGIC:');
        const isSubscribed = newProfile?.subscription_tier && ['premium', 'grandfathered'].includes(newProfile.subscription_tier);
        console.log('Would be marked as subscribed:', isSubscribed);
        
        if (isSubscribed) {
          console.log('✅ User would now get unlimited access!');
          console.log('AI would receive:');
          console.log({
            success: true,
            data: {
              canCreate: true,
              isSubscribed: true,
              subscription_tier: newProfile.subscription_tier,
              message: "You have unlimited access to create invoices and estimates with your premium subscription."
            },
            message: "✅ You can create unlimited invoices and estimates with your premium subscription!"
          });
        }
      }
    }
    
    // Also check if they have any existing invoices/estimates
    console.log('\n4. CHECKING EXISTING ITEMS:');
    const { count: invoicesCount } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    const { count: estimatesCount } = await supabase
      .from('estimates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    console.log('Existing invoices:', invoicesCount);
    console.log('Existing estimates:', estimatesCount);
    console.log('Total items:', (invoicesCount || 0) + (estimatesCount || 0));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

const userId = process.argv[2] || '716845bd-0294-4a24-84ef-a9a03998bff8';
debugCreateInvoice(userId);
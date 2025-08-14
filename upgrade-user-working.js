const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function upgradeUser(userId) {
  try {
    console.log(`🚀 Upgrading user: ${userId}`);
    
    // First check current status
    const { data: current, error: currentError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    console.log('📋 Before upgrade:', {
      exists: !!current,
      subscription_tier: current?.subscription_tier || 'none',
      free_limit: current?.free_limit || 'none'
    });
    
    if (current) {
      // Update existing profile
      console.log('🔄 Updating existing profile...');
      const { data: updated, error: updateError } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'premium',
          subscription_expires_at: null,
          free_limit: 999999, // Set high limit for premium
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select('*');
        
      if (updateError) {
        console.error('❌ Update error:', updateError);
        return false;
      }
      
      console.log('✅ Successfully updated!');
      console.log('📋 After upgrade:', {
        subscription_tier: updated[0]?.subscription_tier,
        free_limit: updated[0]?.free_limit,
        updated_at: updated[0]?.updated_at
      });
      
    } else {
      // Create new profile
      console.log('➕ Creating new premium profile...');
      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          subscription_tier: 'premium',
          subscription_expires_at: null,
          free_limit: 999999,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();
        
      if (createError) {
        console.error('❌ Create error:', createError);
        return false;
      }
      
      console.log('✅ Successfully created!');
      console.log('📋 New profile:', {
        subscription_tier: created[0]?.subscription_tier,
        free_limit: created[0]?.free_limit,
        created_at: created[0]?.created_at
      });
    }
    
    // Verify the change
    const { data: verified, error: verifyError } = await supabase
      .from('user_profiles')
      .select('subscription_tier, free_limit')
      .eq('id', userId)
      .single();
      
    if (verifyError) {
      console.error('❌ Verification error:', verifyError);
      return false;
    }
    
    console.log('✅ Verification successful:');
    console.log(`   Tier: ${verified.subscription_tier}`);
    console.log(`   Limit: ${verified.free_limit}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.log('❌ Please provide a user ID');
  console.log('Usage: node upgrade-user-working.js USER_ID');
  console.log('\nExample user IDs from your system:');
  console.log('- 534cfb6f-0355-4950-a838-b59b76b5fa7f (mrb@gmail.com)');
  console.log('- 35e7974d-afb6-4b5a-b87d-8218b840f6de (frazer@gmail.com)');
  process.exit(1);
}

console.log('🚀 Starting upgrade process...');
upgradeUser(userId).then((success) => {
  if (success) {
    console.log('🎉 Upgrade completed successfully!');
  } else {
    console.log('💥 Upgrade failed!');
  }
  process.exit(success ? 0 : 1);
});
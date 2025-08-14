const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function upgradeUserById(userId) {
  try {
    console.log(`🚀 Upgrading user: ${userId}`);
    console.log('📧 This should be zell@gmail.com if you got the right UUID from Supabase dashboard\n');
    
    // Check if profile exists
    const { data: existing, error: existingError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (existingError) {
      console.error('❌ Error checking existing profile:', existingError);
      return false;
    }
    
    if (existing) {
      console.log('📋 Found existing profile:');
      console.log(`   Tier: ${existing.subscription_tier || 'free'}`);
      console.log(`   Limit: ${existing.free_limit || 'default'}`);
      console.log('🔄 Updating to premium...');
      
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'premium',
          free_limit: 999999,
          subscription_expires_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
        
      if (updateError) {
        console.error('❌ Update failed:', updateError);
        return false;
      }
      
      console.log('✅ Update successful!');
      
    } else {
      console.log('📝 No existing profile found. Creating premium profile...');
      
      const { error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          subscription_tier: 'premium',
          free_limit: 999999,
          subscription_expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (insertError) {
        console.error('❌ Create failed:', insertError);
        return false;
      }
      
      console.log('✅ Premium profile created!');
    }
    
    // Verify the result
    const { data: result, error: verifyError } = await supabase
      .from('user_profiles')
      .select('subscription_tier, free_limit, updated_at')
      .eq('id', userId)
      .maybeSingle();
      
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
      return false;
    }
    
    console.log('\n🎉 UPGRADE SUCCESSFUL!');
    console.log('📋 Final status:');
    console.log(`   User ID: ${userId}`);
    console.log(`   Tier: ${result?.subscription_tier || 'unknown'}`);
    console.log(`   Limit: ${result?.free_limit || 'unknown'}`);
    console.log(`   Updated: ${result?.updated_at || 'unknown'}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Instructions for finding the user
console.log('🔍 TO FIND ZELL@GMAIL.COM USER ID:');
console.log('1. Go to your Supabase Dashboard');
console.log('2. Click "Authentication" → "Users"');
console.log('3. Search for "zell@gmail.com" in the table');
console.log('4. Copy their UUID (the long ID like: 12345678-abcd-1234-abcd-123456789012)');
console.log('5. Run: node upgrade-by-manual-id.js THEIR_UUID_HERE\n');

const userId = process.argv[2];

if (!userId) {
  console.log('❌ Please provide the user UUID from Supabase dashboard');
  console.log('Usage: node upgrade-by-manual-id.js USER_UUID_HERE');
  process.exit(1);
}

if (userId.length !== 36 || !userId.includes('-')) {
  console.log('❌ That doesn\'t look like a valid UUID');
  console.log('Expected format: 12345678-abcd-1234-abcd-123456789012');
  process.exit(1);
}

console.log('🚀 Starting upgrade for zell@gmail.com...');
upgradeUserById(userId).then(success => {
  if (success) {
    console.log('\n✅ zell@gmail.com is now PREMIUM! 🎉');
  } else {
    console.log('\n❌ Upgrade failed');
  }
  process.exit(success ? 0 : 1);
});
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function upgradeUser(email) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // First, find the user by email in auth.users
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      return;
    }
    
    const user = authUsers.users.find(u => u.email === email);
    
    if (!user) {
      console.error(`❌ User with email ${email} not found in auth system`);
      return;
    }
    
    console.log(`✅ Found user: ${user.id} (${user.email})`);
    
    // Check if user profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profileError) {
      console.error('❌ Error checking user profile:', profileError);
      return;
    }
    
    if (existingProfile) {
      console.log('📋 Current profile:', {
        subscription_tier: existingProfile.subscription_tier,
        subscription_expires_at: existingProfile.subscription_expires_at
      });
      
      // Update existing profile
      const { data: updated, error: updateError } = await supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'premium',
          subscription_expires_at: null, // No expiration for manual upgrades
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();
        
      if (updateError) {
        console.error('❌ Error updating user profile:', updateError);
        return;
      }
      
      console.log('✅ Successfully upgraded user to premium!');
      console.log('📋 Updated profile:', updated[0]);
      
    } else {
      console.log('📝 No profile found, creating new premium profile...');
      
      // Create new profile
      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          subscription_tier: 'premium',
          subscription_expires_at: null,
          free_limit: 100, // Higher limit for premium
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
        
      if (createError) {
        console.error('❌ Error creating user profile:', createError);
        return;
      }
      
      console.log('✅ Successfully created premium profile!');
      console.log('📋 New profile:', created[0]);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get email from command line arguments
const email = process.argv[2] || 'zell@gmail.com';

console.log('🚀 Starting user upgrade process...');
upgradeUser(email).then(() => {
  console.log('🎉 Upgrade process completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Upgrade process failed:', error);
  process.exit(1);
});
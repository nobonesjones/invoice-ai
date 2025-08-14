const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function upgradeUserByEmail(email) {
  try {
    console.log(`🔍 Looking for user with email: ${email}`);
    
    // Try to find user by searching for existing profiles or business settings
    console.log('🔎 Searching in business_settings table for user...');
    
    const { data: businessSettings, error: businessError } = await supabase
      .from('business_settings')
      .select('user_id, business_email')
      .ilike('business_email', `%${email}%`);
      
    if (businessError) {
      console.error('❌ Error searching business settings:', businessError);
    } else if (businessSettings && businessSettings.length > 0) {
      console.log('✅ Found user in business settings:', businessSettings[0]);
      
      const userId = businessSettings[0].user_id;
      await upgradeUserById(userId);
      return;
    }
    
    // Try searching in user profiles (if email is stored there)
    console.log('🔎 Let me try a different approach...');
    console.log('📝 To upgrade a user, I need their Supabase user ID (UUID)');
    console.log('💡 You can:');
    console.log('   1. Check the Supabase dashboard Auth > Users');
    console.log('   2. Or have the user log in and check their profile');
    console.log('   3. Or run: node upgrade-user-simple.js USER_UUID_HERE');
    
    // Check if the input might be a UUID
    if (email.length === 36 && email.includes('-')) {
      console.log('🤔 This looks like a UUID, trying as user ID...');
      await upgradeUserById(email);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

async function upgradeUserById(userId) {
  try {
    console.log(`🚀 Upgrading user: ${userId}`);
    
    // Check if user profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError) {
      console.error('❌ Error checking user profile:', profileError);
      return;
    }
    
    if (existingProfile) {
      console.log('📋 Current profile:', {
        id: existingProfile.id,
        subscription_tier: existingProfile.subscription_tier || 'free',
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
        .eq('id', userId)
        .select();
        
      if (updateError) {
        console.error('❌ Error updating user profile:', updateError);
        return;
      }
      
      console.log('✅ Successfully upgraded user to premium!');
      console.log('📋 Updated profile:', {
        id: updated[0].id,
        subscription_tier: updated[0].subscription_tier,
        free_limit: updated[0].free_limit
      });
      
    } else {
      console.log('📝 No profile found, creating new premium profile...');
      
      // Create new profile
      const { data: created, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
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
      console.log('📋 New profile:', {
        id: created[0].id,
        subscription_tier: created[0].subscription_tier,
        free_limit: created[0].free_limit
      });
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get input from command line arguments
const input = process.argv[2] || 'zell@gmail.com';

console.log('🚀 Starting user upgrade process...');
upgradeUserByEmail(input).then(() => {
  console.log('🎉 Process completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Process failed:', error);
  process.exit(1);
});
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function findUsers() {
  try {
    console.log('🔍 Searching for users in the system...\n');
    
    // Check business_settings for users with email addresses
    console.log('📊 Users found in business_settings:');
    const { data: businessUsers, error: businessError } = await supabase
      .from('business_settings')
      .select('user_id, business_email, business_name')
      .not('business_email', 'is', null);
      
    if (businessError) {
      console.error('❌ Error fetching business settings:', businessError);
    } else if (businessUsers && businessUsers.length > 0) {
      businessUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.business_email} (${user.business_name || 'No name'}) - ID: ${user.user_id}`);
      });
      
      // Check if any match zell@gmail.com
      const zellUser = businessUsers.find(u => u.business_email?.toLowerCase().includes('zell'));
      if (zellUser) {
        console.log(`\n🎯 Found potential match for zell: ${zellUser.user_id}`);
        console.log(`   Email: ${zellUser.business_email}`);
        console.log(`   Name: ${zellUser.business_name || 'N/A'}`);
        
        // Check their current subscription status
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier, free_limit')
          .eq('id', zellUser.user_id)
          .maybeSingle();
          
        console.log(`   Current tier: ${profile?.subscription_tier || 'free'}`);
        console.log(`   Free limit: ${profile?.free_limit || 'default'}`);
      }
    } else {
      console.log('   No users found with email addresses');
    }
    
    console.log('\n📋 Current user profiles:');
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, subscription_tier, free_limit, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
    } else if (profiles && profiles.length > 0) {
      profiles.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.id} - ${profile.subscription_tier || 'free'} (limit: ${profile.free_limit || 'default'})`);
      });
    } else {
      console.log('   No user profiles found');
    }
    
    console.log('\n💡 To upgrade a specific user, run:');
    console.log('   node upgrade-user-simple.js USER_UUID_HERE');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

console.log('🚀 Searching for users in the system...');
findUsers().then(() => {
  console.log('\n🎉 Search completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Search failed:', error);
  process.exit(1);
});
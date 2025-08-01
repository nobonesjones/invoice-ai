const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUserSubscription(userId) {
  console.log('🔍 Checking subscription for user:', userId);
  
  try {
    // Check if user exists in auth.users
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);
    console.log('📧 Auth user:', authUser?.user?.email || 'Not found');
    if (authError) console.log('❌ Auth error:', authError);
    
    // Check user_profiles table
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    console.log('📊 User profile data:');
    if (profile) {
      console.log('  - ID:', profile.id);
      console.log('  - Subscription Tier:', profile.subscription_tier);
      console.log('  - Invoice Count:', profile.invoice_count);
      console.log('  - Sent Invoice Count:', profile.sent_invoice_count);
      console.log('  - Free Limit:', profile.free_limit);
      console.log('  - Created At:', profile.created_at);
      console.log('  - Updated At:', profile.updated_at);
    } else {
      console.log('❌ No profile found');
    }
    
    if (profileError) {
      console.log('❌ Profile error:', profileError);
    }
    
    // Test the subscription logic
    const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
    console.log('✅ Is subscribed?', isSubscribed);
    
    // Count actual invoices
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, status, created_at')
      .eq('user_id', userId);
    
    console.log('📄 Invoice count:', invoices?.length || 0);
    if (invoiceError) console.log('❌ Invoice error:', invoiceError);
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// Check the user ID from the logs
const userId = '716845bd-0294-4a24-84ef-a9a03998bff8';
checkUserSubscription(userId);
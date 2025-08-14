const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function checkZellStatus() {
  const zellUserId = '32e70f05-64ab-4b6b-96c3-32772873b8a2';
  
  try {
    console.log('🔍 Checking zell@gmail.com upgrade status...');
    console.log(`User ID: ${zellUserId}\n`);
    
    // Check if profile exists and what tier they are
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', zellUserId)
      .maybeSingle();
      
    if (profileError) {
      console.error('❌ Error checking profile:', profileError);
      return;
    }
    
    if (profile) {
      console.log('✅ zell@gmail.com PROFILE EXISTS:');
      console.log(`   📧 User ID: ${profile.id}`);
      console.log(`   🎖️  Tier: ${profile.subscription_tier}`);
      console.log(`   📊 Limit: ${profile.free_limit}`);
      console.log(`   📅 Created: ${profile.created_at}`);
      console.log(`   🔄 Updated: ${profile.updated_at}`);
      
      if (profile.subscription_tier === 'premium') {
        console.log('\n🎉 SUCCESS! zell@gmail.com is PREMIUM! 🎉');
      } else {
        console.log(`\n⚠️  zell@gmail.com is still ${profile.subscription_tier.toUpperCase()}`);
        console.log('💡 Need to upgrade them to premium');
      }
      
    } else {
      console.log('❌ zell@gmail.com HAS NO PROFILE');
      console.log('\n🔧 TO UPGRADE THEM:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Run this SQL:');
      console.log('\n```sql');
      console.log('INSERT INTO user_profiles (');
      console.log('  id, subscription_tier, free_limit,');
      console.log('  subscription_expires_at, created_at, updated_at');
      console.log(') VALUES (');
      console.log(`  '${zellUserId}',`);
      console.log("  'premium', 999999, NULL, NOW(), NOW()");
      console.log(');');
      console.log('```');
    }
    
    // Also check if they have any business data
    const { data: business, error: businessError } = await supabase
      .from('business_settings')
      .select('business_email, business_name')
      .eq('user_id', zellUserId)
      .maybeSingle();
      
    if (business) {
      console.log('\n📋 Business Data:');
      console.log(`   Email: ${business.business_email || 'none'}`);
      console.log(`   Name: ${business.business_name || 'none'}`);
    } else {
      console.log('\n📋 No business settings found');
    }
    
    // Check for invoices
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, status, created_at')
      .eq('user_id', zellUserId)
      .limit(5);
      
    if (invoices && invoices.length > 0) {
      console.log(`\n📄 Found ${invoices.length} invoices:`);
      invoices.forEach(inv => {
        console.log(`   ${inv.id}: ${inv.status} (${inv.created_at})`);
      });
    } else {
      console.log('\n📄 No invoices found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

console.log('🚀 Checking zell@gmail.com status...');
checkZellStatus().then(() => {
  console.log('\n🎉 Status check complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Check failed:', error);
  process.exit(1);
});
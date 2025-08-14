const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function fixMissingProfiles() {
  try {
    console.log('🔍 Finding users with invoices but no profiles...\n');
    
    // Get all unique user_ids from invoices
    const { data: invoiceUsers, error: invoiceError } = await supabase
      .from('invoices')
      .select('user_id')
      .not('user_id', 'is', null);
      
    if (invoiceError) {
      console.error('❌ Error fetching invoice users:', invoiceError);
      return;
    }
    
    if (!invoiceUsers || invoiceUsers.length === 0) {
      console.log('❌ No invoices found');
      return;
    }
    
    // Get unique user IDs
    const uniqueUserIds = [...new Set(invoiceUsers.map(inv => inv.user_id))];
    console.log(`📊 Found ${uniqueUserIds.length} unique users with invoices`);
    
    // Check which users have profiles
    const { data: existingProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .in('id', uniqueUserIds);
      
    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
      return;
    }
    
    const existingProfileIds = new Set(existingProfiles?.map(p => p.id) || []);
    const missingProfileIds = uniqueUserIds.filter(id => !existingProfileIds.has(id));
    
    console.log(`✅ ${existingProfileIds.size} users have profiles`);
    console.log(`❌ ${missingProfileIds.length} users are missing profiles\n`);
    
    if (missingProfileIds.length === 0) {
      console.log('🎉 All users have profiles! No fixes needed.');
      return;
    }
    
    console.log('🔧 Users missing profiles:');
    for (const userId of missingProfileIds) {
      // Get invoice count for this user
      const { data: userInvoices } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('user_id', userId);
        
      const invoiceCount = userInvoices?.length || 0;
      const sentCount = userInvoices?.filter(inv => inv.status === 'sent').length || 0;
      
      console.log(`   ${userId}: ${invoiceCount} invoices (${sentCount} sent)`);
      
      // Special handling for zell
      if (userId === '32e70f05-64ab-4b6b-96c3-32772873b8a2') {
        console.log('   🎯 This is zell@gmail.com!');
      }
    }
    
    console.log('\n💡 To fix these users, run this SQL in Supabase Dashboard:');
    console.log('```sql');
    
    for (const userId of missingProfileIds) {
      const { data: userInvoices } = await supabase
        .from('invoices')
        .select('id, status')
        .eq('user_id', userId);
        
      const invoiceCount = userInvoices?.length || 0;
      const sentCount = userInvoices?.filter(inv => inv.status === 'sent').length || 0;
      
      // Give zell premium, others get free
      const tier = (userId === '32e70f05-64ab-4b6b-96c3-32772873b8a2') ? 'premium' : 'free';
      const limit = (tier === 'premium') ? 999999 : 3;
      
      console.log(`-- ${userId}${userId === '32e70f05-64ab-4b6b-96c3-32772873b8a2' ? ' (zell@gmail.com - PREMIUM)' : ''}`);
      console.log(`INSERT INTO user_profiles (id, subscription_tier, free_limit, invoice_count, sent_invoice_count, created_at, updated_at)`);
      console.log(`VALUES ('${userId}', '${tier}', ${limit}, ${invoiceCount}, ${sentCount}, NOW(), NOW());`);
      console.log('');
    }
    
    console.log('```');
    
    console.log(`\n🎯 Summary:`);
    console.log(`- ${missingProfileIds.length} users need profile creation`);
    console.log(`- zell@gmail.com will get PREMIUM access`);
    console.log(`- Others will get standard free accounts`);
    console.log(`- All will have accurate invoice/sent counts`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

console.log('🚀 Fixing missing user profiles...');
fixMissingProfiles().then(() => {
  console.log('\n🎉 Analysis complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Failed:', error);
  process.exit(1);
});
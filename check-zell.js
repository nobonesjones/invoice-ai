const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function checkZellData() {
  const userId = '32e70f05-64ab-4b6b-96c3-32772873b8a2';
  
  try {
    console.log('🔍 Checking zell@gmail.com data...');
    console.log(`User ID: ${userId}\n`);
    
    // Check user_profiles
    console.log('📋 Checking user_profiles...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
      
    if (profileError) {
      console.log('❌ Profile error:', profileError);
    } else if (profile) {
      console.log('✅ Profile exists:', profile);
    } else {
      console.log('📝 No profile found');
    }
    
    // Check business_settings
    console.log('\n🏢 Checking business_settings...');
    const { data: business, error: businessError } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (businessError) {
      console.log('❌ Business error:', businessError);
    } else if (business) {
      console.log('✅ Business settings exist:');
      console.log(`   Email: ${business.business_email}`);
      console.log(`   Name: ${business.business_name}`);
      console.log(`   Phone: ${business.business_phone}`);
    } else {
      console.log('📝 No business settings found');
    }
    
    // Check invoices
    console.log('\n📄 Checking invoices...');
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, total, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (invoiceError) {
      console.log('❌ Invoice error:', invoiceError);
    } else if (invoices && invoices.length > 0) {
      console.log(`✅ Found ${invoices.length} invoices:`);
      invoices.forEach(inv => {
        console.log(`   ${inv.invoice_number}: ${inv.client_name} - $${inv.total} (${inv.status})`);
      });
    } else {
      console.log('📝 No invoices found');
    }
    
    // Check clients
    console.log('\n👥 Checking clients...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (clientError) {
      console.log('❌ Client error:', clientError);
    } else if (clients && clients.length > 0) {
      console.log(`✅ Found ${clients.length} clients:`);
      clients.forEach(client => {
        console.log(`   ${client.name}: ${client.email || 'no email'}`);
      });
    } else {
      console.log('📝 No clients found');
    }
    
    console.log('\n💡 Why my search missed them:');
    console.log('1. They might not be in user_profiles table yet');
    console.log('2. RLS policies might be blocking access');
    console.log('3. My search logic had a bug');
    
    console.log('\n🎯 To upgrade manually:');
    console.log('Go to Supabase Dashboard → Table Editor → user_profiles');
    console.log('And manually insert/update:');
    console.log(`{`);
    console.log(`  "id": "${userId}",`);
    console.log(`  "subscription_tier": "premium",`);
    console.log(`  "free_limit": 999999,`);
    console.log(`  "subscription_expires_at": null`);
    console.log(`}`);
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

console.log('🚀 Checking zell@gmail.com data...');
checkZellData().then(() => {
  console.log('\n🎉 Check completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Check failed:', error);
  process.exit(1);
});
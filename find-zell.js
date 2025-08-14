const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function searchForZell() {
  try {
    console.log('🔍 Searching EVERYWHERE for zell@gmail.com...\n');
    
    // Search in ALL tables that might contain emails or user references
    
    console.log('📊 Checking business_settings...');
    const { data: business, error: businessError } = await supabase
      .from('business_settings')
      .select('user_id, business_email, business_name, created_at')
      .or('business_email.ilike.%zell%,business_name.ilike.%zell%');
      
    if (business && business.length > 0) {
      console.log('✅ Found in business_settings:', business);
    } else {
      console.log('❌ Not found in business_settings');
    }
    
    console.log('\n📋 Checking user_profiles...');
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .limit(20);
      
    if (profiles) {
      console.log(`Found ${profiles.length} user profiles total:`);
      profiles.forEach(profile => {
        console.log(`- ${profile.id} (${profile.subscription_tier || 'free'})`);
      });
    }
    
    console.log('\n📧 Checking clients table for zell email...');
    const { data: clients, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .or('email.ilike.%zell%,name.ilike.%zell%');
      
    if (clients && clients.length > 0) {
      console.log('✅ Found in clients:', clients);
      // If we find zell as a client, their user_id might be in the record
      clients.forEach(client => {
        if (client.user_id) {
          console.log(`🎯 Potential user_id: ${client.user_id}`);
        }
      });
    } else {
      console.log('❌ Not found in clients');
    }
    
    console.log('\n📄 Checking invoices table...');
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('user_id, client_name, created_at')
      .ilike('client_name', '%zell%')
      .limit(5);
      
    if (invoices && invoices.length > 0) {
      console.log('✅ Found invoices with zell:', invoices);
    } else {
      console.log('❌ Not found in invoices');
    }
    
    console.log('\n📝 Checking estimates table...');
    const { data: estimates, error: estimateError } = await supabase
      .from('estimates')
      .select('user_id, client_name, created_at')
      .ilike('client_name', '%zell%')
      .limit(5);
      
    if (estimates && estimates.length > 0) {
      console.log('✅ Found estimates with zell:', estimates);
    } else {
      console.log('❌ Not found in estimates');
    }
    
    console.log('\n🔍 Searching for any recent activity...');
    // Check all user_ids from recent activity
    const { data: recentInvoices, error: recentError } = await supabase
      .from('invoices')
      .select('user_id, client_name, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
      
    if (recentInvoices) {
      console.log('\n📊 Recent invoice activity (looking for clues):');
      const userIds = [...new Set(recentInvoices.map(inv => inv.user_id))];
      console.log(`Found ${userIds.length} unique user IDs with recent activity:`);
      userIds.forEach(id => {
        console.log(`- ${id}`);
      });
      
      // Check if any of these user IDs have business settings we haven't seen
      for (const userId of userIds) {
        const { data: userBusiness } = await supabase
          .from('business_settings')
          .select('business_email, business_name')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (userBusiness && userBusiness.business_email) {
          console.log(`  └─ ${userId}: ${userBusiness.business_email} (${userBusiness.business_name || 'No name'})`);
          
          if (userBusiness.business_email.toLowerCase().includes('zell')) {
            console.log(`  🎯 FOUND ZELL! User ID: ${userId}`);
          }
        }
      }
    }
    
    console.log('\n💡 If zell@gmail.com exists in auth but not showing here:');
    console.log('1. They might not have completed onboarding');
    console.log('2. They might have signed up but never created business settings');
    console.log('3. Check Supabase Dashboard > Authentication > Users');
    console.log('4. Search for "zell" in the email column');
    
  } catch (error) {
    console.error('❌ Search error:', error);
  }
}

console.log('🚀 Deep search for zell@gmail.com starting...');
searchForZell().then(() => {
  console.log('\n🎉 Search completed!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Search failed:', error);
  process.exit(1);
});
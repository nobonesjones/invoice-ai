const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function comprehensiveSearch() {
  try {
    console.log('🔍 COMPREHENSIVE SEARCH for zell@gmail.com...\n');
    
    // Get ALL user_profiles and their associated data
    console.log('📋 Getting ALL user profiles and checking associated data...');
    const { data: allProfiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (allProfiles) {
      console.log(`Found ${allProfiles.length} total user profiles\n`);
      
      // For each user profile, check ALL associated tables
      for (let i = 0; i < allProfiles.length; i++) {
        const profile = allProfiles[i];
        console.log(`\n👤 User ${i + 1}: ${profile.id}`);
        console.log(`   Tier: ${profile.subscription_tier || 'free'}`);
        console.log(`   Created: ${profile.created_at}`);
        
        // Check business_settings
        const { data: business } = await supabase
          .from('business_settings')
          .select('business_email, business_name, business_phone')
          .eq('user_id', profile.id)
          .maybeSingle();
          
        if (business) {
          console.log(`   📧 Business Email: ${business.business_email || 'none'}`);
          console.log(`   🏢 Business Name: ${business.business_name || 'none'}`);
          console.log(`   📱 Business Phone: ${business.business_phone || 'none'}`);
          
          // CHECK FOR ZELL
          if (business.business_email?.toLowerCase().includes('zell') ||
              business.business_name?.toLowerCase().includes('zell') ||
              business.business_phone?.toLowerCase().includes('zell')) {
            console.log('🎯🎯🎯 FOUND ZELL HERE! 🎯🎯🎯');
          }
        }
        
        // Check recent invoices for this user
        const { data: invoices } = await supabase
          .from('invoices')
          .select('client_name, client_email, invoice_number, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (invoices && invoices.length > 0) {
          console.log(`   📄 Recent Invoices:`);
          invoices.forEach(inv => {
            console.log(`      - ${inv.client_name} (${inv.client_email || 'no email'}) - ${inv.invoice_number}`);
            
            // CHECK FOR ZELL
            if (inv.client_name?.toLowerCase().includes('zell') ||
                inv.client_email?.toLowerCase().includes('zell')) {
              console.log('      🎯🎯🎯 FOUND ZELL IN INVOICES! 🎯🎯🎯');
            }
          });
        }
        
        // Check clients table
        const { data: clients } = await supabase
          .from('clients')
          .select('name, email, phone, created_at')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })
          .limit(3);
          
        if (clients && clients.length > 0) {
          console.log(`   👥 Clients:`);
          clients.forEach(client => {
            console.log(`      - ${client.name} (${client.email || 'no email'})`);
            
            // CHECK FOR ZELL
            if (client.name?.toLowerCase().includes('zell') ||
                client.email?.toLowerCase().includes('zell') ||
                client.phone?.toLowerCase().includes('zell')) {
              console.log('      🎯🎯🎯 FOUND ZELL IN CLIENTS! 🎯🎯🎯');
            }
          });
        }
        
        console.log('   ─────────────────────────');
      }
    }
    
    console.log('\n\n🔍 DIRECT TABLE SEARCHES FOR "zell"...\n');
    
    // Search ALL tables directly for zell
    console.log('📊 Searching invoices table...');
    const { data: invoiceSearch } = await supabase
      .from('invoices')
      .select('user_id, client_name, client_email, invoice_number, created_at')
      .or('client_name.ilike.%zell%,client_email.ilike.%zell%,invoice_number.ilike.%zell%')
      .limit(10);
      
    if (invoiceSearch && invoiceSearch.length > 0) {
      console.log('🎯 FOUND ZELL IN INVOICES:');
      invoiceSearch.forEach(inv => {
        console.log(`   User: ${inv.user_id}`);
        console.log(`   Client: ${inv.client_name} (${inv.client_email})`);
        console.log(`   Invoice: ${inv.invoice_number}`);
        console.log(`   Date: ${inv.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in invoices');
    }
    
    console.log('📝 Searching estimates table...');
    const { data: estimateSearch } = await supabase
      .from('estimates')
      .select('user_id, client_name, client_email, estimate_number, created_at')
      .or('client_name.ilike.%zell%,client_email.ilike.%zell%,estimate_number.ilike.%zell%')
      .limit(10);
      
    if (estimateSearch && estimateSearch.length > 0) {
      console.log('🎯 FOUND ZELL IN ESTIMATES:');
      estimateSearch.forEach(est => {
        console.log(`   User: ${est.user_id}`);
        console.log(`   Client: ${est.client_name} (${est.client_email})`);
        console.log(`   Estimate: ${est.estimate_number}`);
        console.log(`   Date: ${est.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in estimates');
    }
    
    console.log('👥 Searching clients table...');
    const { data: clientSearch } = await supabase
      .from('clients')
      .select('user_id, name, email, phone, created_at')
      .or('name.ilike.%zell%,email.ilike.%zell%,phone.ilike.%zell%')
      .limit(10);
      
    if (clientSearch && clientSearch.length > 0) {
      console.log('🎯 FOUND ZELL IN CLIENTS:');
      clientSearch.forEach(client => {
        console.log(`   User: ${client.user_id}`);
        console.log(`   Name: ${client.name}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Phone: ${client.phone}`);
        console.log(`   Date: ${client.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in clients');
    }
    
    console.log('🏢 Searching business_settings table...');
    const { data: businessSearch } = await supabase
      .from('business_settings')
      .select('user_id, business_name, business_email, business_phone, created_at')
      .or('business_name.ilike.%zell%,business_email.ilike.%zell%,business_phone.ilike.%zell%')
      .limit(10);
      
    if (businessSearch && businessSearch.length > 0) {
      console.log('🎯 FOUND ZELL IN BUSINESS SETTINGS:');
      businessSearch.forEach(biz => {
        console.log(`   User: ${biz.user_id}`);
        console.log(`   Name: ${biz.business_name}`);
        console.log(`   Email: ${biz.business_email}`);
        console.log(`   Phone: ${biz.business_phone}`);
        console.log(`   Date: ${biz.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in business settings');
    }
    
    // Check payments table
    console.log('💳 Searching payments table...');
    const { data: paymentSearch } = await supabase
      .from('payments')
      .select('user_id, invoice_id, amount, payment_method, created_at')
      .limit(20)
      .order('created_at', { ascending: false });
      
    if (paymentSearch && paymentSearch.length > 0) {
      console.log('💳 Recent payments (checking associated invoices for zell):');
      for (const payment of paymentSearch.slice(0, 5)) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('client_name, client_email')
          .eq('id', payment.invoice_id)
          .maybeSingle();
          
        if (invoice && (invoice.client_name?.toLowerCase().includes('zell') || 
                       invoice.client_email?.toLowerCase().includes('zell'))) {
          console.log(`🎯 FOUND ZELL IN PAYMENT-LINKED INVOICE:`);
          console.log(`   User: ${payment.user_id}`);
          console.log(`   Client: ${invoice.client_name} (${invoice.client_email})`);
          console.log(`   Amount: ${payment.amount}`);
          console.log(`   Date: ${payment.created_at}\n`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Search error:', error);
  }
}

console.log('🚀 Starting COMPREHENSIVE search for zell@gmail.com...');
console.log('This will check EVERY user and EVERY table...\n');

comprehensiveSearch().then(() => {
  console.log('\n🎉 Comprehensive search completed!');
  console.log('If zell was found above, use their user_id to upgrade them!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Search failed:', error);
  process.exit(1);
});
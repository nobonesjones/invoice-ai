const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_ANON_KEY
);

async function findRealZell() {
  try {
    console.log('🔍 COMPREHENSIVE SEARCH for the REAL zell@gmail.com...\n');
    
    // Method 1: Search all business_settings for zell variations
    console.log('📧 Method 1: Searching business emails...');
    const { data: businessEmails, error: businessError } = await supabase
      .from('business_settings')
      .select('user_id, business_email, business_name, created_at')
      .or('business_email.ilike.%zell%,business_email.ilike.%cell%,business_name.ilike.%zell%,business_name.ilike.%cell%');
      
    if (businessEmails && businessEmails.length > 0) {
      console.log('🎯 FOUND ZELL IN BUSINESS SETTINGS:');
      businessEmails.forEach(biz => {
        console.log(`   User: ${biz.user_id}`);
        console.log(`   Email: ${biz.business_email}`);
        console.log(`   Name: ${biz.business_name}`);
        console.log(`   Date: ${biz.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in business_settings');
    }
    
    // Method 2: Search all invoice data for zell
    console.log('\n📄 Method 2: Searching invoice client data...');
    
    // First, let's see what columns exist in invoices table
    const { data: sampleInvoice } = await supabase
      .from('invoices')
      .select('*')
      .limit(1)
      .maybeSingle();
      
    if (sampleInvoice) {
      console.log('📋 Invoice table columns available:', Object.keys(sampleInvoice));
      
      // Search in different possible client fields
      const possibleClientFields = ['client_name', 'client_email', 'to_name', 'to_email', 'customer_name', 'customer_email'];
      
      for (const field of possibleClientFields) {
        if (field in sampleInvoice) {
          console.log(`\n🔍 Searching ${field} for zell...`);
          const { data: invoiceMatches } = await supabase
            .from('invoices')
            .select(`user_id, ${field}, created_at`)
            .ilike(field, '%zell%')
            .limit(5);
            
          if (invoiceMatches && invoiceMatches.length > 0) {
            console.log(`🎯 FOUND ZELL IN ${field.toUpperCase()}:`);
            invoiceMatches.forEach(inv => {
              console.log(`   User: ${inv.user_id}`);
              console.log(`   ${field}: ${inv[field]}`);
              console.log(`   Date: ${inv.created_at}\n`);
            });
          }
        }
      }
    }
    
    // Method 3: Search clients table
    console.log('\n👥 Method 3: Searching clients table...');
    const { data: clientMatches } = await supabase
      .from('clients')
      .select('user_id, name, email, phone, created_at')
      .or('name.ilike.%zell%,email.ilike.%zell%,phone.ilike.%zell%');
      
    if (clientMatches && clientMatches.length > 0) {
      console.log('🎯 FOUND ZELL IN CLIENTS:');
      clientMatches.forEach(client => {
        console.log(`   User: ${client.user_id}`);
        console.log(`   Name: ${client.name}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Phone: ${client.phone}`);
        console.log(`   Date: ${client.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in clients');
    }
    
    // Method 4: Check estimates table
    console.log('\n📝 Method 4: Searching estimates table...');
    const { data: estimateMatches } = await supabase
      .from('estimates')
      .select('user_id, client_name, client_email, created_at')
      .or('client_name.ilike.%zell%,client_email.ilike.%zell%')
      .limit(5);
      
    if (estimateMatches && estimateMatches.length > 0) {
      console.log('🎯 FOUND ZELL IN ESTIMATES:');
      estimateMatches.forEach(est => {
        console.log(`   User: ${est.user_id}`);
        console.log(`   Client: ${est.client_name || 'N/A'}`);
        console.log(`   Email: ${est.client_email || 'N/A'}`);
        console.log(`   Date: ${est.created_at}\n`);
      });
    } else {
      console.log('❌ No zell found in estimates');
    }
    
    // Method 5: Search broader patterns
    console.log('\n🔍 Method 5: Searching variations (zelle, cell, etc.)...');
    const variations = ['zelle', 'zell', 'cell', 'sel'];
    
    for (const variation of variations) {
      const { data: matches } = await supabase
        .from('business_settings')
        .select('user_id, business_email, business_name')
        .or(`business_email.ilike.%${variation}%,business_name.ilike.%${variation}%`)
        .limit(3);
        
      if (matches && matches.length > 0) {
        console.log(`🎯 Found matches for "${variation}":`);
        matches.forEach(match => {
          console.log(`   ${match.user_id}: ${match.business_email} (${match.business_name})`);
        });
      }
    }
    
    // Method 6: Show recent activity to cross-reference
    console.log('\n📊 Method 6: Recent user activity (for cross-reference)...');
    const { data: recentActivity } = await supabase
      .from('invoices')
      .select('user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (recentActivity && recentActivity.length > 0) {
      console.log('Recent invoice activity:');
      const userCounts = {};
      recentActivity.forEach(activity => {
        userCounts[activity.user_id] = (userCounts[activity.user_id] || 0) + 1;
      });
      
      Object.entries(userCounts).forEach(([userId, count]) => {
        console.log(`   ${userId}: ${count} recent invoices`);
      });
    }
    
    console.log('\n💡 NEXT STEPS:');
    console.log('1. Check above results for any zell matches');
    console.log('2. If found, use that user_id to upgrade');
    console.log('3. If not found, zell@gmail.com might not be active in your app');
    console.log('4. Double-check the email spelling in Supabase Auth dashboard');
    
  } catch (error) {
    console.error('❌ Search error:', error);
  }
}

console.log('🚀 Starting comprehensive search for REAL zell@gmail.com...');
findRealZell().then(() => {
  console.log('\n🎉 Search complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Search failed:', error);
  process.exit(1);
});
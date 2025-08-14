const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

const zellUserId = '32e70f05-64ab-4b6b-96c3-32772873b8a2';

async function diagnoseDatabaseIssue() {
  try {
    console.log('🚨 CRITICAL DATABASE DIAGNOSIS 🚨');
    console.log('====================================');
    console.log(`Investigating why zell@gmail.com (${zellUserId}) data is not readable\n`);
    
    // Test 1: Direct query with exact UUID
    console.log('📊 TEST 1: Direct invoice query with exact UUID...');
    const { data: directInvoices, error: directError } = await supabase
      .from('invoices')
      .select('id, user_id, invoice_number, created_at')
      .eq('user_id', zellUserId);
      
    if (directError) {
      console.log('❌ Direct query error:', directError);
    } else {
      console.log(`Found ${directInvoices?.length || 0} invoices with direct query`);
      if (directInvoices && directInvoices.length > 0) {
        console.log('🎯 INVOICES FOUND:');
        directInvoices.slice(0, 3).forEach(inv => {
          console.log(`   ${inv.invoice_number} - ${inv.created_at}`);
        });
      }
    }
    
    // Test 2: Test RLS policies
    console.log('\n🔐 TEST 2: Testing Row Level Security (RLS)...');
    
    // Try to get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.log('❌ Auth error:', authError);
      console.log('⚠️  No authenticated user - this might be the issue!');
    } else if (user) {
      console.log(`✅ Authenticated as: ${user.email} (${user.id})`);
    } else {
      console.log('⚠️  No user session - using anon access');
    }
    
    // Test 3: Check if we're hitting RLS policies
    console.log('\n🔍 TEST 3: Checking all invoices (no filter)...');
    const { data: allInvoices, error: allError } = await supabase
      .from('invoices')
      .select('user_id')
      .limit(20);
      
    if (allError) {
      console.log('❌ Cannot read invoices table:', allError);
    } else {
      console.log(`Can see ${allInvoices?.length || 0} invoices total`);
      if (allInvoices && allInvoices.length > 0) {
        // Check if zell's UUID is in there
        const hasZell = allInvoices.some(inv => inv.user_id === zellUserId);
        if (hasZell) {
          console.log('🎯 ZELL\'S UUID FOUND IN INVOICES!');
          console.log('⚠️  This means RLS is blocking specific queries!');
        } else {
          console.log('❌ Zell\'s UUID not in visible invoices');
        }
      }
    }
    
    // Test 4: Try different query methods
    console.log('\n🔬 TEST 4: Testing different query methods...');
    
    // Method A: Using filter
    const { data: filterData, error: filterError } = await supabase
      .from('invoices')
      .select('user_id, invoice_number')
      .filter('user_id', 'eq', zellUserId);
      
    console.log(`Filter method: ${filterData?.length || 0} results`);
    
    // Method B: Using raw PostgreSQL function (if available)
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_invoices_for_user', { user_id: zellUserId })
      .catch(err => ({ data: null, error: 'RPC function not available' }));
      
    if (rpcError) {
      console.log('RPC method: Not available or errored');
    } else {
      console.log(`RPC method: ${rpcData?.length || 0} results`);
    }
    
    // Test 5: Check estimates table
    console.log('\n📝 TEST 5: Checking estimates table...');
    const { data: estimates, error: estimateError } = await supabase
      .from('estimates')
      .select('id, user_id, estimate_number, created_at')
      .eq('user_id', zellUserId);
      
    if (estimateError) {
      console.log('❌ Estimate query error:', estimateError);
    } else {
      console.log(`Found ${estimates?.length || 0} estimates`);
      if (estimates && estimates.length > 0) {
        console.log('🎯 ESTIMATES FOUND:');
        estimates.slice(0, 3).forEach(est => {
          console.log(`   ${est.estimate_number} - ${est.created_at}`);
        });
      }
    }
    
    // Test 6: Check user_profiles
    console.log('\n👤 TEST 6: Checking user_profiles...');
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', zellUserId)
      .maybeSingle();
      
    if (profileError) {
      console.log('❌ Profile query error:', profileError);
    } else if (profile) {
      console.log('✅ Profile exists:', profile);
    } else {
      console.log('❌ No profile found');
    }
    
    // Test 7: Check business_settings
    console.log('\n🏢 TEST 7: Checking business_settings...');
    const { data: business, error: businessError } = await supabase
      .from('business_settings')
      .select('user_id, business_email, business_name')
      .eq('user_id', zellUserId)
      .maybeSingle();
      
    if (businessError) {
      console.log('❌ Business query error:', businessError);
    } else if (business) {
      console.log('✅ Business settings exist:', business);
    } else {
      console.log('❌ No business settings found');
    }
    
    // DIAGNOSIS SUMMARY
    console.log('\n\n🔍 DIAGNOSIS SUMMARY:');
    console.log('====================');
    
    const canSeeInvoices = (directInvoices && directInvoices.length > 0) || false;
    const canSeeEstimates = (estimates && estimates.length > 0) || false;
    const hasProfile = !!profile;
    const hasBusinessSettings = !!business;
    
    if (canSeeInvoices || canSeeEstimates) {
      console.log('✅ DATA EXISTS AND IS READABLE!');
      console.log(`   - Invoices: ${canSeeInvoices ? 'YES' : 'NO'}`);
      console.log(`   - Estimates: ${canSeeEstimates ? 'YES' : 'NO'}`);
      console.log(`   - Profile: ${hasProfile ? 'YES' : 'NO'}`);
      console.log(`   - Business: ${hasBusinessSettings ? 'YES' : 'NO'}`);
      
      if (!hasProfile) {
        console.log('\n⚠️  ISSUE: User has data but NO PROFILE!');
        console.log('   This explains why they appear as free user');
      }
    } else {
      console.log('❌ CANNOT SEE ANY DATA FOR THIS USER!');
      console.log('\nPossible causes:');
      console.log('1. RLS policies are blocking access');
      console.log('2. Using wrong authentication method');
      console.log('3. Data exists in different schema/table');
      console.log('4. UUID mismatch (but you confirmed it\'s correct)');
    }
    
    console.log('\n💡 RECOMMENDED ACTIONS:');
    console.log('1. Check Supabase Dashboard → Database → Tables → Invoices');
    console.log(`2. Filter by user_id = '${zellUserId}'`);
    console.log('3. If you see data there but not here, it\'s an RLS issue');
    console.log('4. Check Authentication → Policies for the invoices table');
    
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

console.log('🚀 Starting critical database diagnosis...\n');
diagnoseDatabaseIssue().then(() => {
  console.log('\n🎉 Diagnosis complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Diagnosis failed:', error);
  process.exit(1);
});
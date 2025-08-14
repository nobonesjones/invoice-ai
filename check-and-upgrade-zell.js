const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_API_URL,
  process.env.EXPO_PUBLIC_ANON_KEY
);

async function checkAndUpgradeZell() {
  console.log('\n🔍 Checking Zell\'s status using CORRECT column names...\n');
  
  try {
    // 1. Find Zell in auth.users using correct column name (uid)
    const { data: authData } = await supabase
      .rpc('execute_sql', {
        sql_query: `SELECT uid, email FROM auth.users WHERE email = 'zell@gmail.com'`
      });
    
    if (!authData || authData.length === 0) {
      console.log('❌ zell@gmail.com not found in auth.users');
      return;
    }
    
    const zellUid = authData[0].uid;
    console.log(`✅ Found Zell in auth.users with UID: ${zellUid}`);
    
    // 2. Check if profile exists using correct join (auth.uid = profiles.id)
    const { data: profileData } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT p.id, p.email, p.subscription_tier 
          FROM profiles p 
          WHERE p.id = '${zellUid}'::uuid
        `
      });
    
    if (!profileData || profileData.length === 0) {
      console.log('❌ No profile found - creating one...');
      
      // Create profile
      const { error: createError } = await supabase
        .rpc('execute_sql', {
          sql_query: `
            INSERT INTO profiles (id, email, subscription_tier, created_at, updated_at)
            VALUES ('${zellUid}'::uuid, 'zell@gmail.com', 'premium', NOW(), NOW())
          `
        });
      
      if (createError) {
        console.error('❌ Failed to create profile:', createError);
        return;
      }
      
      console.log('✅ Profile created with premium subscription');
    } else {
      console.log(`✅ Profile exists with tier: ${profileData[0].subscription_tier}`);
      
      // Upgrade to premium if not already
      if (profileData[0].subscription_tier !== 'premium') {
        const { error: upgradeError } = await supabase
          .rpc('execute_sql', {
            sql_query: `
              UPDATE profiles 
              SET subscription_tier = 'premium', updated_at = NOW()
              WHERE id = '${zellUid}'::uuid
            `
          });
        
        if (upgradeError) {
          console.error('❌ Failed to upgrade:', upgradeError);
          return;
        }
        
        console.log('✅ Upgraded to premium');
      } else {
        console.log('✅ Already premium');
      }
    }
    
    // 3. Verify final status
    const { data: finalCheck } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT 
            u.uid,
            u.email,
            p.subscription_tier,
            p.updated_at
          FROM auth.users u
          JOIN profiles p ON u.uid = p.id
          WHERE u.email = 'zell@gmail.com'
        `
      });
    
    console.log('\n📊 FINAL STATUS:');
    console.log('═════════════════');
    if (finalCheck && finalCheck[0]) {
      console.log(`Email: ${finalCheck[0].email}`);
      console.log(`UID: ${finalCheck[0].uid}`);
      console.log(`Tier: ${finalCheck[0].subscription_tier}`);
      console.log(`Updated: ${finalCheck[0].updated_at}`);
    }
    
    // 4. Check their data is now accessible
    console.log('\n🔍 Checking data accessibility...');
    const { data: invoiceCheck } = await supabase
      .rpc('execute_sql', {
        sql_query: `
          SELECT COUNT(*) as count 
          FROM invoices 
          WHERE user_id = '${zellUid}'::uuid
        `
      });
    
    console.log(`📄 Invoices found: ${invoiceCheck?.[0]?.count || 0}`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

(async () => {
  await checkAndUpgradeZell();
  process.exit(0);
})();
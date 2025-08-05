const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read the service key from a file (it should be in your local config)
const supabaseUrl = 'https://wzpuzqzsjdizmpiobsuo.supabase.co';

async function checkDatabaseTrigger() {
  const supabase = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy');
  
  try {
    // Check if the trigger function exists and what it contains
    const { data, error } = await supabase.rpc('sql', {
      query: `
        SELECT routine_definition 
        FROM information_schema.routines 
        WHERE routine_name = 'create_user_defaults_direct' 
        AND routine_schema = 'public';
      `
    });
    
    if (error) {
      console.log('Error querying trigger function:', error);
      
      // Try a different approach - check recent business_settings records
      console.log('\nChecking recent business_settings records instead...');
      const { data: recentSettings, error: settingsError } = await supabase
        .from('business_settings')
        .select('user_id, default_invoice_design, default_accent_color, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
        
      if (settingsError) {
        console.log('Error getting business settings:', settingsError);
      } else {
        console.log('Recent business_settings records:');
        console.log(JSON.stringify(recentSettings, null, 2));
      }
      
      return;
    }
    
    console.log('Trigger function definition:', data);
    
  } catch (error) {
    console.log('Error:', error.message);
    console.log('\nTrying to check recent user business settings...');
    
    // Alternative: just check what actual records look like
    try {
      const { data: settings } = await supabase
        .from('business_settings')
        .select('user_id, default_invoice_design, default_accent_color, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
        
      console.log('Recent business_settings (last 5):');
      console.log(JSON.stringify(settings, null, 2));
    } catch (err) {
      console.log('Also failed to get business settings:', err.message);
    }
  }
}

checkDatabaseTrigger();
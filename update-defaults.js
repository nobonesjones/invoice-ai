const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wzpuzqzsjdizmpiobsuo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcxNjEzNTA4MiwiZXhwIjoyMDMxNzExMDgyfQ.kORlI2PcN9Dp19F-M3RwkSxqGR-8yB4RFcF6mEafOdw'
);

async function updateDefaults() {
  console.log('Updating existing user defaults...');
  
  // Update all existing business_settings to use the new defaults
  const { data, error } = await supabase
    .from('business_settings')
    .update({
      default_invoice_design: 'clean',
      default_accent_color: '#1E40AF'
    })
    .or('default_invoice_design.is.null,default_invoice_design.eq.classic,default_accent_color.is.null,default_accent_color.eq.#14B8A6')
    .select('user_id, default_invoice_design, default_accent_color, business_email');

  if (error) {
    console.error('Error updating defaults:', error);
    return;
  }

  console.log(`Updated ${data.length} users with new defaults:`);
  data.forEach(user => {
    console.log(`- User ${user.user_id} (${user.business_email}): ${user.default_invoice_design}, ${user.default_accent_color}`);
  });
}

updateDefaults();
const { createClient } = require('@supabase/supabase-js');

// Use the same URL and anon key from the .env file
const supabaseUrl = 'https://wzpuzqzsjdizmpiobsuo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6cHV6cXpzamRpem1waW9ic3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY2MjE3OTIsImV4cCI6MjA2MjE5Nzc5Mn0._XypJP5hEZT06UfA1uuHY5-TvsKzj5JnwjGa3LMKnyI';

async function checkClientsTableColumns() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    console.log('Checking columns in the clients table...\n');
    
    // Query to get column information for the clients table
    const { data, error } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_schema', 'public')
      .eq('table_name', 'clients')
      .order('column_name');
    
    if (error) {
      console.log('Error querying table schema:', error);
      console.log('\nTrying alternative approach with RPC...');
      
      // Try using RPC with raw SQL
      const { data: rpcData, error: rpcError } = await supabase.rpc('sql', {
        query: `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = 'clients'
          ORDER BY column_name;
        `
      });
      
      if (rpcError) {
        console.log('RPC query also failed:', rpcError);
        
        // Final fallback - try to get sample data from clients table
        console.log('\nTrying to get sample client record to infer columns...');
        const { data: clientSample, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .limit(1);
          
        if (clientError) {
          console.log('Cannot access clients table:', clientError);
        } else if (clientSample && clientSample.length > 0) {
          console.log('Sample client record columns:');
          console.log(Object.keys(clientSample[0]));
        } else {
          console.log('Clients table exists but is empty');
        }
        return;
      }
      
      console.log('Column information from RPC:');
      console.log(JSON.stringify(rpcData, null, 2));
      return;
    }
    
    console.log('Column information:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if 'address' column exists
    const hasAddress = data.some(col => col.column_name === 'address');
    console.log(`\nDoes 'address' column exist? ${hasAddress}`);
    
    // List all column names for quick reference
    console.log('\nAll column names:');
    data.forEach(col => console.log(`- ${col.column_name} (${col.data_type})`));
    
  } catch (error) {
    console.log('Error:', error.message);
  }
}

checkClientsTableColumns();
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Delete account function called')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase environment variables')
    }
    
    const supabaseClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Verify the user's JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authorization')
    }

    // Get request body
    const { userId, confirmation } = await req.json()

    // Verify that the user is deleting their own account
    if (user.id !== userId) {
      throw new Error('You can only delete your own account')
    }

    // Verify confirmation
    if (confirmation !== 'DELETE') {
      throw new Error('Invalid confirmation')
    }

    // Delete user data from core tables that we know exist
    const coreTables = [
      { name: 'invoices', column: 'user_id' },
      { name: 'estimates', column: 'user_id' },
      { name: 'clients', column: 'user_id' },
      { name: 'profiles', column: 'id' }
    ]

    let deletedTables = []
    
    for (const table of coreTables) {
      try {
        const { error } = await supabaseClient
          .from(table.name)
          .delete()
          .eq(table.column, userId)
        
        if (error) {
          console.error(`Error deleting from ${table.name}:`, error)
        } else {
          deletedTables.push(table.name)
        }
      } catch (tableError) {
        console.error(`Table ${table.name} might not exist:`, tableError)
        // Continue with other tables
      }
    }

    console.log('Successfully deleted data from tables:', deletedTables)

    // Finally, delete the auth user
    const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('Error deleting auth user:', deleteError)
      throw new Error('Failed to delete account. Please contact support.')
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error) {
    console.error('Delete account error:', error)
    
    const errorMessage = error.message || 'Unknown error occurred'
    const statusCode = error.message?.includes('authorization') ? 401 : 500
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.toString(),
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode 
      }
    )
  }
})
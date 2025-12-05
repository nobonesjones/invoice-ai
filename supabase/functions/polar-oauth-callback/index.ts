import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const POLAR_CLIENT_ID = Deno.env.get('POLAR_CLIENT_ID') || 'polar_ci_cCmoDRhfHruYcLNa9fQJ8PErsOYJRgreSX3hv4VjL4K'
const POLAR_CLIENT_SECRET = Deno.env.get('POLAR_CLIENT_SECRET') // Optional for public clients
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://wzpuzqzsjdizmpiobsuo.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state') // We'll pass userId in state
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error from Polar:', error)
      // Redirect to app with error
      return Response.redirect('superinvoice://polar-callback?error=' + encodeURIComponent(error))
    }

    if (!code) {
      return new Response(
        JSON.stringify({ error: 'No authorization code provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse state to get userId and codeVerifier (for PKCE)
    let userId: string | null = null
    let codeVerifier: string | null = null
    if (state) {
      try {
        const stateData = JSON.parse(atob(state))
        userId = stateData.userId
        codeVerifier = stateData.codeVerifier
      } catch (e) {
        console.error('Failed to parse state:', e)
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'No user ID in state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!codeVerifier) {
      return new Response(
        JSON.stringify({ error: 'No code verifier in state (PKCE required)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Exchange authorization code for access token using PKCE
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: POLAR_CLIENT_ID,
      code: code,
      redirect_uri: `${SUPABASE_URL}/functions/v1/polar-oauth-callback`,
      code_verifier: codeVerifier
    }

    // Add client_secret if configured (for confidential clients)
    if (POLAR_CLIENT_SECRET) {
      tokenParams.client_secret = POLAR_CLIENT_SECRET
    }

    const tokenResponse = await fetch('https://api.polar.sh/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams).toString()
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return Response.redirect('superinvoice://polar-callback?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokenData

    console.log('Token exchange successful')

    // Get user's organization info from Polar
    const userResponse = await fetch('https://api.polar.sh/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    })

    let organizationId: string | null = null

    if (userResponse.ok) {
      const userData = await userResponse.json()
      console.log('Polar user data:', userData)

      // Get organizations
      const orgsResponse = await fetch('https://api.polar.sh/v1/organizations', {
        headers: {
          'Authorization': `Bearer ${access_token}`
        }
      })

      if (orgsResponse.ok) {
        const orgsData = await orgsResponse.json()
        console.log('Polar orgs:', orgsData)
        // Use first organization or the user's personal org
        if (orgsData.items && orgsData.items.length > 0) {
          organizationId = orgsData.items[0].id
        }
      }
    }

    // Store tokens in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const expiresAt = new Date(Date.now() + (expires_in * 1000)).toISOString()

    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        polar_connected: true,
        polar_organization_id: organizationId,
        polar_access_token: access_token,
        polar_refresh_token: refresh_token,
        polar_token_expires_at: expiresAt
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Failed to update user profile:', updateError)
      return Response.redirect('superinvoice://polar-callback?error=database_error')
    }

    console.log('Polar connected successfully for user:', userId)

    // Redirect back to the app with success
    return Response.redirect('superinvoice://polar-callback?success=true')

  } catch (error) {
    console.error('Unexpected error:', error)
    return Response.redirect('superinvoice://polar-callback?error=unexpected_error')
  }
})

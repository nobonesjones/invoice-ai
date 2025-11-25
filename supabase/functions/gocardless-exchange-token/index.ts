import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExchangeTokenRequest {
  code: string;
  state: string;
  environment: 'sandbox' | 'live';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code, state, environment = 'sandbox' } = await req.json() as ExchangeTokenRequest;

    console.log('[GoCardless] Exchanging authorization code for access token', {
      environment,
      hasCode: !!code,
      hasState: !!state
    });

    // Validate inputs
    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Get environment-specific credentials
    const clientId = environment === 'sandbox'
      ? Deno.env.get("GOCARDLESS_CLIENT_ID_SANDBOX")
      : Deno.env.get("GOCARDLESS_CLIENT_ID_LIVE");

    const clientSecret = environment === 'sandbox'
      ? Deno.env.get("GOCARDLESS_CLIENT_SECRET_SANDBOX")
      : Deno.env.get("GOCARDLESS_CLIENT_SECRET_LIVE");

    const redirectUri = Deno.env.get("GOCARDLESS_REDIRECT_URI");

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('GoCardless credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenUrl = environment === 'sandbox'
      ? 'https://connect-sandbox.gocardless.com/oauth/access_token'
      : 'https://connect.gocardless.com/oauth/access_token';

    console.log('[GoCardless] Requesting access token from:', tokenUrl);

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('[GoCardless] Token exchange failed:', errorData);
      throw new Error(`Failed to exchange token: ${tokenResponse.status} ${errorData}`);
    }

    const tokenData = await tokenResponse.json();

    console.log('[GoCardless] Successfully obtained access token', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in
    });

    // Calculate token expiration time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));

    // Get the authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // Fetch creditor information using the access token
    const apiUrl = environment === 'sandbox'
      ? 'https://api-sandbox.gocardless.com/creditors'
      : 'https://api.gocardless.com/creditors';

    console.log('[GoCardless] Fetching creditor information');

    const creditorsResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'GoCardless-Version': '2015-07-06',
        'Content-Type': 'application/json',
      },
    });

    if (!creditorsResponse.ok) {
      const errorData = await creditorsResponse.text();
      console.error('[GoCardless] Failed to fetch creditors:', errorData);
      throw new Error(`Failed to fetch creditor info: ${creditorsResponse.status}`);
    }

    const creditorsData = await creditorsResponse.json();
    const creditor = creditorsData.creditors[0]; // User will have one creditor

    if (!creditor) {
      throw new Error('No creditor found for this account');
    }

    console.log('[GoCardless] Creditor info retrieved', {
      creditorId: creditor.id,
      verificationStatus: creditor.verification_status
    });

    // Store or update the tokens in payment_options table
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: existingOptions, error: fetchError } = await supabaseAdmin
      .from('payment_options')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error(`Database error: ${fetchError.message}`);
    }

    const updateData = {
      user_id: user.id,
      gocardless_connected: true,
      gocardless_access_token: tokenData.access_token,
      gocardless_refresh_token: tokenData.refresh_token,
      gocardless_token_expires_at: expiresAt.toISOString(),
      gocardless_creditor_id: creditor.id,
      gocardless_verification_status: creditor.verification_status,
      gocardless_environment: environment,
    };

    let upsertData: any = updateData;
    if (existingOptions?.id) {
      upsertData.id = existingOptions.id;
    }

    const { error: upsertError } = await supabaseAdmin
      .from('payment_options')
      .upsert(upsertData, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('[GoCardless] Failed to save tokens:', upsertError);
      throw new Error(`Failed to save tokens: ${upsertError.message}`);
    }

    console.log('[GoCardless] Successfully stored credentials for user:', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        creditor: {
          id: creditor.id,
          name: creditor.name,
          verification_status: creditor.verification_status,
        },
        message: 'GoCardless account connected successfully',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[GoCardless] Exchange token error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

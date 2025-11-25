import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateOAuthUrlRequest {
  environment?: 'sandbox' | 'live';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { environment = 'sandbox' } = await req.json() as GenerateOAuthUrlRequest;

    console.log('[GoCardless] Generating OAuth URL', { environment });

    // Get environment-specific credentials
    const clientId = environment === 'sandbox'
      ? Deno.env.get("GOCARDLESS_CLIENT_ID_SANDBOX")
      : Deno.env.get("GOCARDLESS_CLIENT_ID_LIVE");

    const redirectUri = Deno.env.get("GOCARDLESS_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      throw new Error('GoCardless OAuth credentials not configured');
    }

    // Generate a random state parameter for CSRF protection
    const state = crypto.randomUUID();

    // Build OAuth URL
    const baseUrl = environment === 'sandbox'
      ? 'https://connect-sandbox.gocardless.com/oauth/authorize'
      : 'https://connect.gocardless.com/oauth/authorize';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read_write',
      state: state,
      // Optional: pre-fill email if you want
      // initial_view: 'login', // or 'signup'
    });

    const oauthUrl = `${baseUrl}?${params.toString()}`;

    console.log('[GoCardless] OAuth URL generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        oauth_url: oauthUrl,
        state: state, // Return state so app can verify it in callback
        environment: environment,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[GoCardless] Generate OAuth URL error:', error);
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

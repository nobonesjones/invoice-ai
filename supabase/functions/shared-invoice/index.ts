import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SharedInvoiceRequest {
  shareToken: string
  eventType?: 'view' | 'download' | 'print' | 'copy_link'
  userAgent?: string
  ipAddress?: string
  referrer?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const url = new URL(req.url)
  const shareToken = url.pathname.split('/').pop()

  if (!shareToken) {
    return new Response(
      JSON.stringify({ error: 'Share token is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Handle GET request - get invoice data
    if (req.method === 'GET') {
      // Get share record and invoice data
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select(`
          id,
          invoice_id,
          expires_at,
          is_active,
          invoices!inner (
            *,
            clients (*),
            invoice_line_items (*),
            users!inner (
              business_settings (*),
              payment_options (*)
            )
          )
        `)
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single()

      if (shareError || !share) {
        return new Response(
          JSON.stringify({ error: 'Share link not found or expired' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if expired
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Share link has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Track view event automatically
      const userAgent = req.headers.get('User-Agent')
      const ipAddress = req.headers.get('CF-Connecting-IP') || 
                       req.headers.get('X-Forwarded-For') || 
                       req.headers.get('X-Real-IP')
      const referrer = req.headers.get('Referer')

      // Insert analytics event for view
      await supabase
        .from('invoice_share_analytics')
        .insert({
          share_id: share.id,
          event_type: 'view',
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer,
          metadata: {
            timestamp: new Date().toISOString(),
            method: 'GET'
          }
        })

      // Return invoice data
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            share: {
              id: share.id,
              expires_at: share.expires_at
            },
            invoice: share.invoices,
            businessSettings: share.invoices.users.business_settings?.[0],
            paymentOptions: share.invoices.users.payment_options?.[0]
          }
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle POST request - track events
    if (req.method === 'POST') {
      const body: SharedInvoiceRequest = await req.json()

      if (!body.eventType) {
        return new Response(
          JSON.stringify({ error: 'Event type is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get share record to validate token
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select('id, is_active, expires_at')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single()

      if (shareError || !share) {
        return new Response(
          JSON.stringify({ error: 'Share link not found or expired' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Check if expired
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Share link has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get client IP and user agent
      const userAgent = body.userAgent || req.headers.get('User-Agent')
      const ipAddress = body.ipAddress || 
                       req.headers.get('CF-Connecting-IP') || 
                       req.headers.get('X-Forwarded-For') || 
                       req.headers.get('X-Real-IP')
      const referrer = body.referrer || req.headers.get('Referer')

      // Insert analytics event
      const { error: analyticsError } = await supabase
        .from('invoice_share_analytics')
        .insert({
          share_id: share.id,
          event_type: body.eventType,
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer,
          metadata: {
            timestamp: new Date().toISOString(),
            method: 'POST'
          }
        })

      if (analyticsError) {
        console.error('Error tracking analytics:', analyticsError)
        return new Response(
          JSON.stringify({ error: 'Failed to track event' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Event tracked successfully' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in shared-invoice function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 
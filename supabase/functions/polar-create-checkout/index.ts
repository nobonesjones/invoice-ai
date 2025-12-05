import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface CreateCheckoutRequest {
  invoiceId: string
  userId: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invoiceId, userId }: CreateCheckoutRequest = await req.json()

    if (!invoiceId || !userId) {
      return new Response(
        JSON.stringify({ error: 'invoiceId and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get user's Polar credentials
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('polar_connected, polar_access_token, polar_refresh_token, polar_token_expires_at, polar_organization_id')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!profile.polar_connected || !profile.polar_access_token) {
      return new Response(
        JSON.stringify({ error: 'Polar not connected. Please connect your Polar account first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if token needs refresh
    let accessToken = profile.polar_access_token
    const tokenExpiry = new Date(profile.polar_token_expires_at)

    if (tokenExpiry < new Date()) {
      // Token expired, need to refresh
      console.log('Token expired, refreshing...')

      const refreshResponse = await fetch('https://api.polar.sh/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: Deno.env.get('POLAR_CLIENT_ID')!,
          client_secret: Deno.env.get('POLAR_CLIENT_SECRET')!,
          refresh_token: profile.polar_refresh_token
        }).toString()
      })

      if (!refreshResponse.ok) {
        // Refresh failed, user needs to reconnect
        await supabase
          .from('user_profiles')
          .update({ polar_connected: false })
          .eq('id', userId)

        return new Response(
          JSON.stringify({ error: 'Polar session expired. Please reconnect your Polar account.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const refreshData = await refreshResponse.json()
      accessToken = refreshData.access_token

      // Update tokens in database
      await supabase
        .from('user_profiles')
        .update({
          polar_access_token: refreshData.access_token,
          polar_refresh_token: refreshData.refresh_token,
          polar_token_expires_at: new Date(Date.now() + (refreshData.expires_in * 1000)).toISOString()
        })
        .eq('id', userId)
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients(*)')
      .eq('id', invoiceId)
      .eq('user_id', userId)
      .single()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if invoice already has a payment link
    if (invoice.polar_payment_link && invoice.polar_payment_status === 'pending') {
      return new Response(
        JSON.stringify({
          success: true,
          paymentLink: invoice.polar_payment_link,
          checkoutId: invoice.polar_checkout_id,
          message: 'Existing payment link returned'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Polar checkout session
    // Note: Polar uses custom checkout for arbitrary amounts
    const amountInCents = Math.round((invoice.total_amount - (invoice.paid_amount || 0)) * 100)

    if (amountInCents <= 0) {
      return new Response(
        JSON.stringify({ error: 'Invoice is already fully paid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Map currency codes to Polar-supported currencies
    const currencyMap: Record<string, string> = {
      'USD': 'usd',
      'EUR': 'eur',
      'GBP': 'gbp',
      '$': 'usd',
      '€': 'eur',
      '£': 'gbp',
    }

    const currency = currencyMap[invoice.currency_code?.toUpperCase()] ||
                     currencyMap[invoice.currency_symbol] ||
                     'usd'

    const checkoutPayload = {
      payment_processor: 'stripe',
      amount: amountInCents,
      currency: currency,
      customer_email: invoice.clients?.email || undefined,
      customer_name: invoice.clients?.name || undefined,
      success_url: `https://getsuperinvoice.com/payment/success?invoice_id=${invoiceId}`,
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        user_id: userId,
        source: 'superinvoice'
      }
    }

    console.log('Creating Polar checkout with payload:', checkoutPayload)

    const checkoutResponse = await fetch('https://api.polar.sh/v1/checkouts/custom/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(checkoutPayload)
    })

    if (!checkoutResponse.ok) {
      const errorText = await checkoutResponse.text()
      console.error('Polar checkout creation failed:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to create payment link', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const checkoutData = await checkoutResponse.json()
    console.log('Polar checkout created:', checkoutData)

    // Save checkout info to invoice
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        polar_checkout_id: checkoutData.id,
        polar_payment_link: checkoutData.url,
        polar_payment_status: 'pending'
      })
      .eq('id', invoiceId)

    if (updateError) {
      console.error('Failed to update invoice:', updateError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        paymentLink: checkoutData.url,
        checkoutId: checkoutData.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

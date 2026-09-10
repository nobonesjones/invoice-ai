import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { renderInvoiceHtml } from '../_shared/invoice-doc/render.ts'
import { buildInvoiceDocument } from '../_shared/invoice-doc/buildInvoiceDocument.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SharedInvoiceRequest {
  shareToken: string
  eventType?: 'view' | 'download' | 'print' | 'copy_link'
  userAgent?: string
  ipAddress?: string
  referrer?: string
  country?: string
  city?: string
}

// Simple IP geolocation function
async function getLocationFromIP(ip: string) {
  try {
    const response = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await response.json();
    return {
      country: data.country_name || null,
      city: data.city || null
    };
  } catch (error) {
    console.warn('Failed to get location from IP:', error);
    return { country: null, city: null };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Create Supabase client with service role key for bypassing RLS
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
    // Handle GET request - get invoice data and track view
    if (req.method === 'GET') {
      // Get share record and invoice data
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select(`
          id,
          invoice_id,
          expires_at,
          is_active,
          pdf_path,
          invoices!inner (
            *,
            clients (*)
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

      // supabase-js types a joined to-one relation as an array; at runtime it is
      // an object. Normalise once so the rest of the handler is typed.
      const invoiceRow: Record<string, any> = Array.isArray(share.invoices) ? share.invoices[0] : share.invoices

      // Live status for the hosted page: a tiny payload the viewer polls to keep
      // the pay button and PAID state current. No tracking — a poll is not a view.
      if (url.searchParams.get('live') === '1') {
        const { data: liveBiz } = await supabase
          .from('business_settings')
          .select('currency_code')
          .eq('user_id', invoiceRow.user_id)
          .single()
        const stripeLink = invoiceRow.stripe_active && invoiceRow.stripe_payment_link_url
          ? invoiceRow.stripe_payment_link_url : null
        const gocardlessLink = invoiceRow.gocardless_active && invoiceRow.id
          ? `https://getsuperinvoice.com/pay/${invoiceRow.id}` : null
        return new Response(
          JSON.stringify({
            status: invoiceRow.status,
            total_amount: invoiceRow.total_amount,
            paid_amount: invoiceRow.paid_amount,
            payment_date: invoiceRow.payment_date,
            currency: liveBiz?.currency_code || invoiceRow.currency || 'USD',
            payments: { stripe: stripeLink, gocardless: gocardlessLink }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
        )
      }

      // Get business settings and payment options separately
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', invoiceRow.user_id)
        .single()

      const { data: paymentOptions } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', invoiceRow.user_id)
        .single()

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', share.invoice_id)

      // Get client information for tracking
      const userAgent = req.headers.get('User-Agent') || ''

      // The viewer refetches the document when the live status flips; that is
      // the same person on the same open page, not a new view.
      const noTrack = url.searchParams.get('notrack') === '1'
      if (!noTrack) {
        const ipAddress = req.headers.get('CF-Connecting-IP') ||
                         req.headers.get('X-Forwarded-For') ||
                         req.headers.get('X-Real-IP') ||
                         'unknown'
        const referrer = req.headers.get('Referer')

        // Get location from IP
        const { country, city } = await getLocationFromIP(ipAddress)

        // Insert analytics event for view
        await supabase
          .from('invoice_share_analytics')
          .insert({
            share_id: share.id,
            event_type: 'view',
            ip_address: ipAddress,
            user_agent: userAgent,
            referrer: referrer,
            country: country,
            city: city,
            metadata: {
              timestamp: new Date().toISOString(),
              method: 'GET'
            }
          })

        // Also log to invoice activities
        await supabase
          .from('invoice_activities')
          .insert({
            invoice_id: share.invoice_id,
            user_id: invoiceRow.user_id,
            activity_type: 'opened',
            activity_description: `Invoice opened via shared link from ${country || 'Unknown location'}`,
            activity_data: {
              share_token: shareToken,
              ip_address: ipAddress,
              user_agent: userAgent,
              country: country,
              city: city,
              referrer: referrer
            },
            ip_address: ipAddress,
            user_agent: userAgent
          })
      }

      // Prepare invoice data
      const invoiceData = {
        share: {
          id: share.id,
          expires_at: share.expires_at
        },
        invoice: {
          ...invoiceRow,
          invoice_line_items: lineItems || []
        },
        businessSettings: businessSettings,
        paymentOptions: paymentOptions
      };

      const acceptHeader = req.headers.get('Accept') || ''
      const formatParam = url.searchParams.get('format')
      const isBrowserRequest = userAgent.includes('Mozilla') || acceptHeader.includes('text/html')
      const wantsPdf = formatParam === 'pdf' || acceptHeader.includes('application/pdf')

      // The hosted page: the same document the app previews and the PDF contains,
      // rendered by the shared template in web mode (pay buttons, A4 @page rule).
      const renderWebPage = () => {
        const doc = buildInvoiceDocument({
          type: 'invoice',
          row: { ...invoiceRow, invoice_line_items: lineItems || [] },
          client: invoiceRow.clients ?? null,
          lineItems: lineItems || [],
          business: { ...(businessSettings ?? {}), ...(paymentOptions ?? {}) },
          paymentOptions: paymentOptions ?? null,
        })
        // A paid invoice is the receipt the thank-you email links to: the template
        // shows the PAID badge from the status; the pay buttons go here.
        if ((doc.document.status || '').toLowerCase() === 'paid') {
          doc.payments = { stripeLinkUrl: null, gocardlessPayUrl: null, gocardless: false, paypalEmail: null, bankDetailLines: [] }
        }
        // No caching: the page must flip to PAID the moment the invoice does.
        return new Response(renderInvoiceHtml(doc, { mode: 'web' }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        })
      }

      // Download PDF: the app stores the printed A4 document on every send.
      if (wantsPdf && share.pdf_path) {
        try {
          const { data: pdfData, error: pdfError } = await supabase.storage
            .from('shared-invoices')
            .download(share.pdf_path)

          if (!pdfError && pdfData) {
            return new Response(pdfData, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="invoice-${invoiceRow.invoice_number}.pdf"`,
                'Cache-Control': 'public, max-age=3600'
              }
            })
          }
          console.error('PDF download failed:', pdfError)
        } catch (error) {
          console.error('PDF serving failed:', error)
        }
        // No stored PDF: the web page prints to A4 via its own @page rule.
        return renderWebPage()
      }

      if (isBrowserRequest) {
        return renderWebPage()
      }

      // Return JSON for API requests
      return new Response(
        JSON.stringify({
          success: true,
          data: invoiceData
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=300'
          }
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
        .select('id, invoice_id, is_active, expires_at')
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
                       req.headers.get('X-Real-IP') ||
                       'unknown'
      const referrer = body.referrer || req.headers.get('Referer')

      // Get location if not provided
      let country = body.country
      let city = body.city
      if (!country || !city) {
        const location = await getLocationFromIP(ipAddress)
        country = country || location.country
        city = city || location.city
      }

      // Insert analytics event
      const { error: analyticsError } = await supabase
        .from('invoice_share_analytics')
        .insert({
          share_id: share.id,
          event_type: body.eventType,
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer,
          country: country,
          city: city,
          metadata: {
            timestamp: new Date().toISOString(),
            method: 'POST'
          }
        })

      if (analyticsError) {
        console.error('Analytics error:', analyticsError)
      }

      // Log activity for important events
      if (['download', 'print'].includes(body.eventType)) {
        // Get user_id from invoice
        const { data: invoice } = await supabase
          .from('invoices')
          .select('user_id')
          .eq('id', share.invoice_id)
          .single()

        if (invoice) {
          await supabase
            .from('invoice_activities')
            .insert({
              invoice_id: share.invoice_id,
              user_id: invoice.user_id,
              activity_type: body.eventType === 'download' ? 'downloaded' : 'printed',
              activity_description: `Invoice ${body.eventType}ed via shared link from ${country || 'Unknown location'}`,
              activity_data: {
                share_token: shareToken,
                ip_address: ipAddress,
                user_agent: userAgent,
                country: country,
                city: city
              },
              ip_address: ipAddress,
              user_agent: userAgent
            })
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Event tracked successfully' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Shared invoice error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

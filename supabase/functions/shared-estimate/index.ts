// shared-estimate — the hosted estimate page. Mirrors shared-invoice:
// GET renders the shared invoice-doc in web mode (type 'estimate'), ?live=1
// is the tiny status payload the viewer polls, ?format=pdf serves the stored
// PDF, ?notrack=1 skips analytics on the viewer's status-flip refetch.
// POST tracks events and carries the client's Accept/Decline, which sets
// estimates.status — the estimate_responded_webhook trigger then emails the
// owner via the estimate-responded function.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { renderInvoiceHtml } from '../_shared/invoice-doc/render.ts'
import { buildInvoiceDocument } from '../_shared/invoice-doc/buildInvoiceDocument.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SharedEstimateRequest {
  eventType?: 'view' | 'download' | 'print' | 'copy_link'
  action?: 'accept' | 'decline'
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
    // Shared by GET and POST: resolve the share or fail like shared-invoice does
    const { data: share, error: shareError } = await supabase
      .from('estimate_shares')
      .select(`
        id,
        estimate_id,
        expires_at,
        is_active,
        pdf_path,
        estimates!inner (
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

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Share link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // supabase-js types a joined to-one relation as an array; at runtime it is
    // an object. Normalise once so the rest of the handler is typed.
    const estimateRow: Record<string, any> = Array.isArray(share.estimates) ? share.estimates[0] : share.estimates

    if (req.method === 'GET') {
      // Live status for the hosted page: what the viewer polls to keep the
      // Accept/Decline bar current. No tracking — a poll is not a view.
      if (url.searchParams.get('live') === '1') {
        const { data: liveBiz } = await supabase
          .from('business_settings')
          .select('currency_code, estimate_terminology')
          .eq('user_id', estimateRow.user_id)
          .single()
        const status = estimateRow.is_accepted && estimateRow.status !== 'declined'
          ? 'accepted'
          : String(estimateRow.status ?? 'draft')
        return new Response(
          JSON.stringify({
            status,
            total_amount: estimateRow.total_amount,
            valid_until_date: estimateRow.valid_until_date,
            currency: liveBiz?.currency_code || 'USD',
            terminology: liveBiz?.estimate_terminology === 'quote' ? 'quote' : 'estimate',
            // canClientRespond in the app: only a sent estimate can be answered
            can_respond: estimateRow.status === 'sent'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
        )
      }

      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', estimateRow.user_id)
        .single()

      const { data: paymentOptions } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', estimateRow.user_id)
        .single()

      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('*')
        .eq('estimate_id', share.estimate_id)

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
        const { country, city } = await getLocationFromIP(ipAddress)

        await supabase
          .from('estimate_share_analytics')
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

        await supabase
          .from('estimate_activities')
          .insert({
            estimate_id: share.estimate_id,
            user_id: estimateRow.user_id,
            activity_type: 'opened',
            activity_description: `Estimate opened via shared link from ${country || 'Unknown location'}`,
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

      const estimateData = {
        share: {
          id: share.id,
          expires_at: share.expires_at
        },
        estimate: {
          ...estimateRow,
          estimate_line_items: lineItems || []
        },
        businessSettings: businessSettings,
        paymentOptions: paymentOptions
      };

      const acceptHeader = req.headers.get('Accept') || ''
      const formatParam = url.searchParams.get('format')
      const isBrowserRequest = userAgent.includes('Mozilla') || acceptHeader.includes('text/html')
      const wantsPdf = formatParam === 'pdf' || acceptHeader.includes('application/pdf')

      const renderWebPage = () => {
        const doc = buildInvoiceDocument({
          type: 'estimate',
          row: { ...estimateRow, estimate_line_items: lineItems || [] },
          client: estimateRow.clients ?? null,
          lineItems: lineItems || [],
          business: { ...(businessSettings ?? {}), ...(paymentOptions ?? {}) },
          paymentOptions: paymentOptions ?? null,
          terminology: businessSettings?.estimate_terminology === 'quote' ? 'quote' : 'estimate',
        })
        // No caching: the page must flip to ACCEPTED the moment the client answers.
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
            .from('shared-estimates')
            .download(share.pdf_path)

          if (!pdfError && pdfData) {
            return new Response(pdfData, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="estimate-${estimateRow.estimate_number}.pdf"`,
                'Cache-Control': 'public, max-age=3600'
              }
            })
          }
          console.error('PDF download failed:', pdfError)
        } catch (error) {
          console.error('PDF serving failed:', error)
        }
        return renderWebPage()
      }

      if (isBrowserRequest) {
        return renderWebPage()
      }

      return new Response(
        JSON.stringify({ success: true, data: estimateData }),
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

    if (req.method === 'POST') {
      const body: SharedEstimateRequest = await req.json()

      const userAgent = body.userAgent || req.headers.get('User-Agent') || ''
      const ipAddress = body.ipAddress ||
                       req.headers.get('CF-Connecting-IP') ||
                       req.headers.get('X-Forwarded-For') ||
                       req.headers.get('X-Real-IP') ||
                       'unknown'
      const referrer = body.referrer || req.headers.get('Referer')

      // The client's answer. Setting status fires estimate_responded_webhook,
      // which emails and pushes to the owner — nothing else to do here.
      if (body.action === 'accept' || body.action === 'decline') {
        const target = body.action === 'accept' ? 'accepted' : 'declined'
        if (estimateRow.status === target) {
          return new Response(
            JSON.stringify({ ok: true, status: target, already: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        // Only a sent estimate can be answered (canClientRespond in the app).
        // The .eq('status','sent') guard makes two racing responses settle on
        // whichever landed first.
        const { data: updated } = await supabase
          .from('estimates')
          .update({
            status: target,
            is_accepted: body.action === 'accept',
            updated_at: new Date().toISOString()
          })
          .eq('id', share.estimate_id)
          .eq('status', 'sent')
          .select('id')

        if (!updated || updated.length === 0) {
          const { data: current } = await supabase
            .from('estimates').select('status').eq('id', share.estimate_id).single()
          return new Response(
            JSON.stringify({ error: 'This estimate can no longer be responded to', status: current?.status ?? estimateRow.status }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { country, city } = await getLocationFromIP(ipAddress)
        await supabase
          .from('estimate_activities')
          .insert({
            estimate_id: share.estimate_id,
            user_id: estimateRow.user_id,
            activity_type: target,
            activity_description: `Estimate ${estimateRow.estimate_number || share.estimate_id} ${target} via shared link from ${country || 'Unknown location'}`,
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
        await supabase
          .from('estimate_share_analytics')
          .insert({
            share_id: share.id,
            event_type: target,
            ip_address: ipAddress,
            user_agent: userAgent,
            referrer: referrer,
            country: country,
            city: city,
            metadata: { timestamp: new Date().toISOString(), method: 'POST' }
          })

        return new Response(
          JSON.stringify({ ok: true, status: target }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Event tracking, same as shared-invoice
      if (!body.eventType) {
        return new Response(
          JSON.stringify({ error: 'Event type or action is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let country = body.country
      let city = body.city
      if (!country || !city) {
        const location = await getLocationFromIP(ipAddress)
        country = country || location.country
        city = city || location.city
      }

      const { error: analyticsError } = await supabase
        .from('estimate_share_analytics')
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

      if (['download', 'print'].includes(body.eventType)) {
        await supabase
          .from('estimate_activities')
          .insert({
            estimate_id: share.estimate_id,
            user_id: estimateRow.user_id,
            activity_type: body.eventType === 'download' ? 'downloaded' : 'printed',
            activity_description: `Estimate ${body.eventType}ed via shared link from ${country || 'Unknown location'}`,
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

      return new Response(
        JSON.stringify({ success: true, message: 'Event tracked successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Shared estimate error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

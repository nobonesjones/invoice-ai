// Send an estimate (or quote) to the client by email, with the PDF attached.
//
// Mirrors send-invoice: the app renders the PDF from the shared invoice document
// and posts it as pdf_base64; this function only writes the email. The "View"
// button points at the uploaded PDF (estimate_shares.pdf_path) until the hosted
// estimate page exists, at which point share_url should point there instead.
//
// Status and history are the app's job (EstimateSenderService), so this function
// does not write to estimates or estimate_activities.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const estimateId: string | undefined = body.estimate_id ?? body.estimateId
    const pdfBase64: string | undefined = body.pdf_base64
    const shareUrlFromApp: string | null = body.share_url ?? null
    const customMessage: string | null = body.customMessage ?? null

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')
    if (!RESEND_API_KEY) throw new Error('Missing RESEND_API_KEY')
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase configuration')
    if (!estimateId) throw new Error('Missing estimate_id')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } })

    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select('*, client:clients(*)')
      .eq('id', estimateId)
      .single()
    if (estimateError || !estimate) throw new Error('Estimate not found')

    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('business_name, business_email, currency_code, estimate_terminology')
      .eq('user_id', estimate.user_id)
      .single()

    const clientEmail: string | undefined = estimate.client?.email
    if (!clientEmail) throw new Error('Client has no email address')

    const terminology = businessSettings?.estimate_terminology === 'quote' ? 'quote' : 'estimate'
    const label = terminology === 'quote' ? 'Quote' : 'Estimate'
    const clientName = estimate.client?.name || 'Valued Client'
    const businessName = businessSettings?.business_name || 'SuperInvoice User'
    const currency = businessSettings?.currency_code || 'GBP'
    let total = ''
    try {
      total = new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(Number(estimate.total_amount || 0))
    } catch {
      total = `${currency} ${Number(estimate.total_amount || 0).toFixed(2)}`
    }
    const validUntil = estimate.valid_until_date
      ? new Date(estimate.valid_until_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : null

    // Link: what the app sent, else the latest uploaded PDF for this estimate.
    let viewUrl: string | null = shareUrlFromApp
    if (!viewUrl) {
      const { data: share } = await supabase
        .from('estimate_shares')
        .select('pdf_path')
        .eq('estimate_id', estimateId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (share?.pdf_path) viewUrl = `${SUPABASE_URL}/storage/v1/object/public/shared-estimates/${share.pdf_path}`
    }

    const message = customMessage
      ? esc(customMessage).replace(/\n/g, '<br>')
      : `Please find your ${terminology} <strong>${esc(estimate.estimate_number)}</strong> for <strong>${esc(total)}</strong> attached${validUntil ? `. It is valid until ${esc(validUntil)}` : ''}.`

    const html = `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:12px;padding:32px;">
        <tr><td style="font-size:20px;font-weight:700;padding-bottom:8px;">${esc(label)} ${esc(estimate.estimate_number)}</td></tr>
        <tr><td style="font-size:14px;color:#6b7280;padding-bottom:20px;">from ${esc(businessName)}</td></tr>
        <tr><td style="font-size:15px;line-height:1.55;padding-bottom:8px;">Hello ${esc(clientName)},</td></tr>
        <tr><td style="font-size:15px;line-height:1.55;padding-bottom:24px;">${message}</td></tr>
        ${viewUrl ? `<tr><td style="padding-bottom:24px;"><a href="${esc(viewUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;font-size:15px;">View ${esc(label)}</a></td></tr>` : ''}
        <tr><td style="font-size:13px;color:#6b7280;line-height:1.5;">Reply to this email if you have any questions.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

    const payload: Record<string, unknown> = {
      from: `${businessName} <invoices@getsuperinvoice.com>`,
      to: [clientEmail],
      subject: `${label} ${estimate.estimate_number} from ${businessName}`,
      html,
    }
    if (pdfBase64) payload.attachments = [{ filename: `${label}-${estimate.estimate_number}.pdf`, content: pdfBase64 }]
    if (businessSettings?.business_email) payload.reply_to = businessSettings.business_email

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!resendResponse.ok) {
      const text = await resendResponse.text()
      throw new Error(`Resend error ${resendResponse.status}: ${text}`)
    }
    const sent = await resendResponse.json()

    return new Response(JSON.stringify({ success: true, id: sent.id, recipient: clientEmail, attached: !!pdfBase64, view_url: viewUrl }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('send-estimate-email:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

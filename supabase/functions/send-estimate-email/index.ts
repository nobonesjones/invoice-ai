import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EmailRequest {
  estimateId: string
  recipientEmail?: string
  recipientName?: string
  senderName?: string
  customMessage?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { estimateId, recipientEmail, recipientName, senderName, customMessage }: EmailRequest = await req.json()

    if (!estimateId) {
      return new Response(
        JSON.stringify({ error: 'Estimate ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch estimate data with related information
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .select(`
        *,
        clients (name, email),
        business_settings!inner (
          business_name,
          business_email,
          business_address,
          business_phone,
          business_website,
          tax_name,
          tax_number,
          auto_apply_tax,
          estimate_terminology
        )
      `)
      .eq('id', estimateId)
      .single()

    if (estimateError || !estimate) {
      return new Response(
        JSON.stringify({ error: 'Estimate not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine recipient details
    const toEmail = recipientEmail || estimate.clients?.email
    const toName = recipientName || estimate.clients?.name || 'Valued Customer'
    const fromName = senderName || estimate.business_settings?.business_name || 'Estimate Sender'
    const fromEmail = estimate.business_settings?.business_email || 'noreply@yourdomain.com'

    // Determine document terminology (estimate vs quote)
    const terminology = estimate.business_settings?.estimate_terminology || 'estimate'
    const documentLabel = terminology === 'quote' ? 'Quote' : 'Estimate'

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: 'No recipient email address found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get existing share record for this estimate
    const { data: shareRecord } = await supabase
      .from('estimate_shares')
      .select('pdf_path')
      .eq('estimate_id', estimateId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Generate shareable estimate URL from PDF path
    const shareUrl = shareRecord?.pdf_path
      ? `https://wzpuzqzsjdizmpiobsuo.supabase.co/storage/v1/object/public/shared-estimates/${shareRecord.pdf_path}`
      : `https://invoices.getsuperinvoice.com/shared/estimate/unavailable`

    // Generate email content
    const subject = `${documentLabel} ${estimate.estimate_number} from ${fromName}`

    const defaultMessage = customMessage || `
Hello ${toName},

Please find attached your ${terminology} ${estimate.estimate_number} for ${estimate.currency_symbol}${estimate.total_amount?.toFixed(2)}.

You can also view this ${terminology} online by clicking the link below:
[View ${documentLabel} Online]

If you have any questions about this ${terminology}, please don't hesitate to contact us.

Best regards,
${fromName}
`

    // Create the email HTML content
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${documentLabel} ${estimate.estimate_number}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
        .estimate-info {
            background: #fff;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .amount {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
        }
        .button {
            display: inline-block;
            background: #007bff;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            font-size: 14px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>${documentLabel} from ${fromName}</h1>
    </div>

    <div class="estimate-info">
        <h2>${documentLabel} Details</h2>
        <p><strong>${documentLabel} Number:</strong> ${estimate.estimate_number}</p>
        <p><strong>Amount:</strong> <span class="amount">${estimate.currency_symbol}${estimate.total_amount?.toFixed(2)}</span></p>
        <p><strong>Status:</strong> ${estimate.status}</p>
    </div>

    <div style="white-space: pre-line;">${defaultMessage}</div>

    <div style="text-align: center;">
        <a href="${shareUrl}" class="button">View ${documentLabel} Online</a>
    </div>

    <div class="footer">
        <p>This email was sent from ${fromName}</p>
        ${estimate.business_settings?.business_email ? `<p>Contact: ${estimate.business_settings.business_email}</p>` : ''}
    </div>
</body>
</html>
`

    // Use Supabase Auth to send email
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(toEmail, {
      data: {
        estimate_id: estimateId,
        estimate_number: estimate.estimate_number,
        custom_invite: true
      },
      redirectTo: `${req.headers.get('origin')}/estimate/${estimateId}`
    })

    if (emailError) {
      console.error('Email sending error:', emailError)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update estimate status to sent
    const { error: updateError } = await supabase
      .from('estimates')
      .update({ status: 'sent' })
      .eq('id', estimateId)

    if (updateError) {
      console.warn('Failed to update estimate status:', updateError)
    }

    // Log the email activity
    const { error: activityError } = await supabase
      .from('estimate_activities')
      .insert({
        estimate_id: estimateId,
        activity_type: 'sent',
        description: `${documentLabel} sent via email to ${toEmail}`,
        activity_data: {
          email: toEmail,
          method: 'email'
        }
      })

    if (activityError) {
      console.warn('Failed to log email activity:', activityError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${documentLabel} email sent successfully`,
        recipient: toEmail
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in send-estimate-email function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface EmailRequest {
  invoiceId: string
  recipientEmail?: string
  recipientName?: string
  senderName?: string
  customMessage?: string
}

interface InvoiceData {
  id: string
  invoice_number: string
  client_id: string
  total_amount: number
  currency_symbol: string
  status: string
  clients: {
    name: string
    email: string
  }
  business_settings: {
    business_name: string
    business_email: string
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Parse request body
    const { invoiceId, recipientEmail, recipientName, senderName, customMessage }: EmailRequest = await req.json()

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: 'Invoice ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch invoice data with related information
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
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
          auto_apply_tax
        )
      `)
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Determine recipient details
    const toEmail = recipientEmail || invoice.clients?.email
    const toName = recipientName || invoice.clients?.name || 'Valued Customer'
    const fromName = senderName || invoice.business_settings?.business_name || 'Invoice Sender'
    const fromEmail = invoice.business_settings?.business_email || 'noreply@yourdomain.com'

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: 'No recipient email address found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email content
    const subject = `Invoice ${invoice.invoice_number} from ${fromName}`
    
    const defaultMessage = customMessage || `
Hello ${toName},

Please find attached your invoice ${invoice.invoice_number} for ${invoice.currency_symbol}${invoice.total_amount?.toFixed(2)}.

You can also view and pay this invoice online by clicking the link below:
[View Invoice Online]

If you have any questions about this invoice, please don't hesitate to contact us.

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
    <title>Invoice ${invoice.invoice_number}</title>
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
        .invoice-info {
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
        <h1>Invoice from ${fromName}</h1>
    </div>
    
    <div class="invoice-info">
        <h2>Invoice Details</h2>
        <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
        <p><strong>Amount:</strong> <span class="amount">${invoice.currency_symbol}${invoice.total_amount?.toFixed(2)}</span></p>
        <p><strong>Status:</strong> ${invoice.status}</p>
    </div>
    
    <div style="white-space: pre-line;">${defaultMessage}</div>
    
    <div style="text-align: center;">
        <a href="#" class="button">View Invoice Online</a>
    </div>
    
    <div class="footer">
        <p>This email was sent from ${fromName}</p>
        ${invoice.business_settings?.business_email ? `<p>Contact: ${invoice.business_settings.business_email}</p>` : ''}
    </div>
</body>
</html>
`

    // Use Supabase Auth to send email
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(toEmail, {
      data: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        custom_invite: true
      },
      redirectTo: `${req.headers.get('origin')}/invoice/${invoiceId}`
    })

    if (emailError) {
      console.error('Email sending error:', emailError)
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update invoice status to sent
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoiceId)

    if (updateError) {
      console.warn('Failed to update invoice status:', updateError)
    }

    // Log the email activity
    const { error: activityError } = await supabase
      .from('invoice_activities')
      .insert({
        invoice_id: invoiceId,
        activity_type: 'sent',
        description: `Invoice sent via email to ${toEmail}`,
        metadata: {
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
        message: 'Invoice email sent successfully',
        recipient: toEmail
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in send-invoice-email function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 
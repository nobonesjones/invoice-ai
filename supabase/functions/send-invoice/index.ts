import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invoice_id, pdf_base64 } = await req.json()
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')

    if (!RESEND_API_KEY) {
      throw new Error('Missing RESEND_API_KEY')
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase configuration')
    }

    if (!invoice_id) {
      throw new Error('Missing invoice_id')
    }

    if (!pdf_base64) {
      throw new Error('Missing pdf_base64')
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client with user's auth token
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Fetch invoice with client data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        client:clients(*)
      `)
      .eq('id', invoice_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError)
      throw new Error('Invoice not found')
    }

    // Fetch line items
    const { data: lineItems, error: lineItemsError } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice_id)
      .order('created_at')

    if (lineItemsError) {
      console.error('Error fetching line items:', lineItemsError)
      throw new Error('Failed to fetch invoice line items')
    }

    // Fetch business settings
    const { data: businessSettings, error: businessError } = await supabase
      .from('business_settings')
      .select('*')
      .eq('user_id', invoice.user_id)
      .single()

    if (businessError) {
      console.error('Error fetching business settings:', businessError)
    }

    // Fetch user's email from auth.users
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Error fetching user:', userError)
    }

    // Validate client email
    if (!invoice.client?.email && !invoice.client?.client_email) {
      throw new Error('Client email not found')
    }

    const clientEmail = invoice.client.email || invoice.client.client_email
    const clientName = invoice.client.name || invoice.client.client_name || 'Valued Client'
    const businessName = businessSettings?.business_name || 'SuperInvoice User'
    // Use business_email if available, otherwise fall back to user's auth email
    const businessEmail = businessSettings?.business_email || user?.email || null

    // Generate email content
    const emailHtml = generateInvoiceEmail(invoice, lineItems, clientName, businessName)

    // Prepare "from" field
    const fromField = `${businessName} <invoices@getsuperinvoice.com>`

    // Prepare email payload with PDF attachment
    const emailPayload: any = {
      from: fromField,
      to: [clientEmail],
      subject: `Invoice ${invoice.invoice_number} from ${businessName}`,
      html: emailHtml,
      attachments: [
        {
          filename: `Invoice-${invoice.invoice_number}.pdf`,
          content: pdf_base64,
        }
      ]
    }

    // Add reply-to if business email exists
    if (businessEmail) {
      emailPayload.reply_to = businessEmail
    }

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })

    if (!resendResponse.ok) {
      const errorData = await resendResponse.text()
      console.error('Resend API error:', errorData)
      throw new Error(`Failed to send email: ${errorData}`)
    }

    const resendData = await resendResponse.json()
    console.log('Email sent successfully:', resendData)

    // Update invoice status to 'sent'
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', invoice_id)

    if (updateError) {
      console.error('Error updating invoice status:', updateError)
      // Don't throw - email was sent successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_id: resendData.id,
        message: 'Invoice sent successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error in send-invoice:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})

// Generate invoice email HTML
function generateInvoiceEmail(invoice: any, lineItems: any[], clientName: string, businessName: string): string {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: invoice.currency || 'USD',
    }).format(amount)
  }

  const lineItemsHtml = lineItems.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
        <div style="font-weight: 500; color: #1f2937;">${item.item_name}</div>
        ${item.item_description ? `<div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${item.item_description}</div>` : ''}
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #1f2937;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #1f2937;">${formatCurrency(item.unit_price)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500; color: #1f2937;">${formatCurrency(item.total_price)}</td>
    </tr>
  `).join('')

  const discountAmount = invoice.discount_type && invoice.discount_value > 0
    ? invoice.discount_type === 'percentage'
      ? invoice.subtotal_amount * (invoice.discount_value / 100)
      : invoice.discount_value
    : 0

  const taxAmount = (invoice.subtotal_amount - discountAmount) * ((invoice.tax_percentage || 0) / 100)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 40px; border-bottom: 2px solid #10b981;">
              <h1 style="margin: 0; font-size: 24px; color: #1f2937;">Invoice ${invoice.invoice_number}</h1>
              <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">From ${businessName}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 40px 24px;">
              <p style="margin: 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Hi ${clientName},
              </p>
              <p style="margin: 16px 0 0; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Thank you for your business! Here's your invoice for the services provided.
              </p>
            </td>
          </tr>

          <!-- Invoice Details -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding-bottom: 8px;">
                    <span style="color: #6b7280; font-size: 14px;">Invoice Date:</span>
                    <span style="color: #1f2937; font-weight: 500; margin-left: 8px;">${new Date(invoice.invoice_date).toLocaleDateString()}</span>
                  </td>
                  <td style="padding-bottom: 8px; text-align: right;">
                    <span style="color: #6b7280; font-size: 14px;">Due Date:</span>
                    <span style="color: #1f2937; font-weight: 500; margin-left: 8px;">${new Date(invoice.due_date).toLocaleDateString()}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Line Items -->
          <tr>
            <td style="padding: 0 40px 24px;">
              <table style="width: 100%; border-collapse: collapse; background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151; font-size: 14px;">Item</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #374151; font-size: 14px;">Qty</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 14px;">Rate</th>
                    <th style="padding: 12px; text-align: right; font-weight: 600; color: #374151; font-size: 14px;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table style="width: 100%; max-width: 300px; margin-left: auto;">
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Subtotal</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500;">${formatCurrency(invoice.subtotal_amount)}</td>
                </tr>
                ${discountAmount > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Discount</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500;">-${formatCurrency(discountAmount)}</td>
                </tr>
                ` : ''}
                ${invoice.tax_percentage > 0 ? `
                <tr>
                  <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">${invoice.invoice_tax_label || 'Tax'} (${invoice.tax_percentage}%)</td>
                  <td style="padding: 8px 0; text-align: right; color: #1f2937; font-weight: 500;">${formatCurrency(taxAmount)}</td>
                </tr>
                ` : ''}
                <tr style="border-top: 2px solid #e5e7eb;">
                  <td style="padding: 12px 0 0; color: #1f2937; font-size: 18px; font-weight: 600;">Total</td>
                  <td style="padding: 12px 0 0; text-align: right; color: #10b981; font-size: 20px; font-weight: 700;">${formatCurrency(invoice.total_amount)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${invoice.gocardless_active ? `
          <!-- Pay Now Button -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="https://getsuperinvoice.com/pay/${invoice.id}"
                       style="display: inline-block; background-color: #10b981; color: #ffffff; font-size: 16px; font-weight: 600; padding: 16px 48px; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                      Pay Now
                    </a>
                    <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px;">
                      Secure instant bank payment powered by GoCardless
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          ${invoice.notes ? `
          <!-- Notes -->
          <tr>
            <td style="padding: 0 40px 32px;">
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; border-left: 4px solid #10b981;">
                <p style="margin: 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Notes</p>
                <p style="margin: 8px 0 0; color: #1f2937; font-size: 14px; line-height: 1.6;">${invoice.notes}</p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #6b7280; font-size: 14px;">
                Thank you for your business!
              </p>
              <p style="margin: 8px 0 0; color: #9ca3af; font-size: 12px;">
                Sent via SuperInvoice - Professional Invoicing Made Simple
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

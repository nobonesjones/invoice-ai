import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface SupportRequest {
  name: string
  email: string
  subject?: string
  message: string
  userId?: string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request body
    const { name, email, subject, message, userId }: SupportRequest = await req.json()

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Save to database (customer_support_tickets table)
    const ticketData = {
      user_id: userId,
      name: name.trim(),
      email: email.trim(),
      subject: subject?.trim() || null,
      message: message.trim(),
      status: 'open',
      priority: 'medium'
    }

    const { data: ticket, error: dbError } = await supabase
      .from('customer_support_tickets')
      .insert([ticketData])
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      // Continue even if DB fails - we still want to send the email
    }

    // Create email HTML content
    const emailSubject = subject ? `Support: ${subject}` : 'New Support Request'

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Support Request</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: #4F46E5;
            color: white;
            padding: 20px;
            border-radius: 8px 8px 0 0;
            margin: -30px -30px 20px -30px;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .field {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #e5e7eb;
        }
        .field:last-child {
            border-bottom: none;
        }
        .label {
            font-weight: 600;
            color: #6b7280;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
        }
        .value {
            font-size: 16px;
            color: #111827;
        }
        .message-box {
            background: #f9fafb;
            border-left: 4px solid #4F46E5;
            padding: 15px;
            border-radius: 4px;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e5e7eb;
            font-size: 14px;
            color: #6b7280;
            text-align: center;
        }
        .reply-button {
            display: inline-block;
            background: #4F46E5;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin-top: 20px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎫 New Support Request</h1>
        </div>

        <div class="field">
            <div class="label">From</div>
            <div class="value"><strong>${name}</strong></div>
        </div>

        <div class="field">
            <div class="label">Email</div>
            <div class="value">
                <a href="mailto:${email}" style="color: #4F46E5;">${email}</a>
            </div>
        </div>

        ${subject ? `
        <div class="field">
            <div class="label">Subject</div>
            <div class="value">${subject}</div>
        </div>
        ` : ''}

        <div class="field">
            <div class="label">Message</div>
            <div class="message-box">${message}</div>
        </div>

        ${ticket ? `
        <div class="field">
            <div class="label">Ticket ID</div>
            <div class="value" style="font-family: monospace; color: #6b7280;">${ticket.id}</div>
        </div>
        ` : ''}

        <div style="text-align: center;">
            <a href="mailto:${email}" class="reply-button">Reply to Customer</a>
        </div>

        <div class="footer">
            <p>SuperInvoice Support System</p>
            <p style="font-size: 12px;">Reply directly to this email to respond to the customer</p>
        </div>
    </div>
</body>
</html>
`

    // Send email using Supabase Auth admin
    // This sends to the admin email configured in Supabase
    const { error: emailError } = await supabase.auth.admin.inviteUserByEmail(
      'harry@getsuperinvoice.com',
      {
        data: {
          support_request: true,
          customer_name: name,
          customer_email: email,
          subject: subject || 'No subject',
          message: message,
          ticket_id: ticket?.id
        },
        redirectTo: `${req.headers.get('origin') || 'https://getsuperinvoice.com'}`
      }
    )

    if (emailError) {
      console.error('Email sending error:', emailError)

      // Even if email fails, if we saved to DB, consider it a success
      if (ticket) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Support request saved but email notification failed',
            ticketId: ticket.id
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Support request submitted successfully',
        ticketId: ticket?.id
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

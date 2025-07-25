import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Simplified approach: Return HTML that can be printed as PDF by the browser
async function generateInvoicePDF(invoiceData: any): Promise<string> {
  // For now, return the HTML content that browsers can print as PDF
  // This avoids the complexity of server-side PDF generation in edge functions
  return generateSkiaMatchingHTML(invoiceData)
}

// Generate HTML that exactly matches the Skia canvas design
function generateSkiaMatchingHTML(invoiceData: any): string {
  const { invoice, businessSettings, paymentOptions } = invoiceData
  const client = invoice.clients
  
  // Use the same design logic as the mobile app's Skia canvas
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.invoice_number}</title>
      <style>
        @page {
          size: A4;
          margin: 0.5in;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.4;
          color: #1f2937;
          background: white;
          font-size: 12px;
        }
        
        .invoice-container {
          width: 100%;
          max-width: 794px;
          margin: 0 auto;
          background: white;
          padding: 20px;
        }
        
        /* Header Section - matching Skia layout exactly */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 40px;
        }
        
        .business-section {
          flex: 1;
          max-width: 300px;
        }
        
        .business-logo {
          width: 65px;
          height: 65px;
          object-fit: contain;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        
        .business-logo-placeholder {
          width: 65px;
          height: 65px;
          background: #FF6B35;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          color: white;
          margin-bottom: 12px;
        }
        
        .business-name {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 6px;
        }
        
        .business-address {
          font-size: 10px;
          color: #6b7280;
          line-height: 1.4;
        }
        
        .invoice-title-section {
          text-align: right;
          flex: 1;
          max-width: 300px;
        }
        
        .invoice-title {
          font-size: 24px;
          font-weight: 800;
          color: #14B8A6;
          margin-bottom: 12px;
          letter-spacing: 1px;
        }
        
        .invoice-meta {
          font-size: 10px;
          color: #374151;
          line-height: 1.5;
        }
        
        /* Business and Client Info Section */
        .info-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
          gap: 40px;
        }
        
        .business-info, .client-info {
          flex: 1;
        }
        
        .section-label {
          font-size: 9px;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        
        .info-content {
          font-size: 10px;
          color: #1f2937;
          line-height: 1.4;
        }
        
        .client-info {
          text-align: right;
        }
        
        /* Line Items Table */
        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .line-items-table th {
          background-color: #14B8A6;
          color: white;
          padding: 8px 12px;
          font-size: 9px;
          font-weight: bold;
          text-transform: uppercase;
          text-align: left;
        }
        
        .line-items-table th:last-child,
        .line-items-table td:last-child {
          text-align: right;
        }
        
        .line-items-table td {
          padding: 8px 12px;
          border-bottom: 1px solid #f3f4f6;
          font-size: 10px;
          color: #1f2937;
          vertical-align: top;
        }
        
        .item-description {
          font-size: 9px;
          color: #6b7280;
          margin-top: 2px;
        }
        
        /* Totals Section */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        
        .totals-table {
          width: 300px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          font-size: 10px;
        }
        
        .total-row.grand-total {
          background-color: #14B8A6;
          color: white;
          padding: 8px 12px;
          margin-top: 8px;
          font-weight: bold;
        }
        
        /* Footer Section */
        .footer-section {
          display: flex;
          justify-content: space-between;
          gap: 40px;
        }
        
        .notes-section, .payment-methods-section {
          flex: 1;
        }
        
        .footer-title {
          font-size: 9px;
          font-weight: 600;
          color: #1f2937;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        
        .notes-content {
          font-size: 10px;
          color: #374151;
          line-height: 1.4;
        }
        
        .payment-method {
          margin-bottom: 12px;
        }
        
        .payment-method-name {
          font-size: 10px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 4px;
        }
        
        .payment-method-details {
          font-size: 9px;
          color: #6b7280;
          line-height: 1.3;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <!-- Header Section -->
        <div class="invoice-header">
          <div class="business-section">
            ${businessSettings?.business_logo_url ? 
              `<img src="${businessSettings.business_logo_url}" class="business-logo" alt="Logo">` :
              `<div class="business-logo-placeholder">${(businessSettings?.business_name || 'B').charAt(0)}</div>`
            }
            <div class="business-name">${businessSettings?.business_name || 'Your Business'}</div>
            <div class="business-address">
              ${businessSettings?.business_address || ''}<br>
              ${businessSettings?.business_city || ''} ${businessSettings?.business_postal_code || ''}<br>
              ${businessSettings?.business_country || ''}
            </div>
          </div>
          
          <div class="invoice-title-section">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-meta">
              <div><strong>Invoice #:</strong> ${invoice.invoice_number}</div>
              <div><strong>Date:</strong> ${new Date(invoice.created_at).toLocaleDateString('en-GB')}</div>
              <div><strong>Due:</strong> ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString('en-GB') : 'Upon receipt'}</div>
              ${invoice.po_number ? `<div><strong>PO #:</strong> ${invoice.po_number}</div>` : ''}
            </div>
          </div>
        </div>
        
        <!-- Business and Client Info -->
        <div class="info-section">
          <div class="business-info">
            <div class="section-label">From</div>
            <div class="info-content">
              <strong>${businessSettings?.business_name || 'Your Business'}</strong><br>
              ${businessSettings?.business_address || ''}<br>
              ${businessSettings?.business_city || ''} ${businessSettings?.business_postal_code || ''}<br>
              ${businessSettings?.business_country || ''}<br>
              ${businessSettings?.business_tax_number ? `Tax ID: ${businessSettings.business_tax_number}` : ''}
            </div>
          </div>
          
          <div class="client-info">
            <div class="section-label">Bill To</div>
            <div class="info-content">
              <strong>${client?.client_name || 'Client'}</strong><br>
              ${client?.client_address || ''}<br>
              ${client?.client_city || ''} ${client?.client_postal_code || ''}<br>
              ${client?.client_country || ''}<br>
              ${client?.client_tax_number ? `Tax ID: ${client.client_tax_number}` : ''}
            </div>
          </div>
        </div>
        
        <!-- Line Items -->
        <table class="line-items-table">
          <thead>
            <tr>
              <th style="width: 10%;">QTY</th>
              <th style="width: 50%;">DESCRIPTION</th>
              <th style="width: 20%;">PRICE</th>
              <th style="width: 20%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${(invoice.invoice_line_items || []).map((item: any) => `
              <tr>
                <td>${item.quantity}</td>
                <td>
                  <div>${item.item_name}</div>
                  ${item.item_description ? `<div class="item-description">${item.item_description}</div>` : ''}
                </td>
                <td style="text-align: right;">£${item.unit_price.toFixed(2)}</td>
                <td style="text-align: right;">£${item.total_price.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals-section">
          <div class="totals-table">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>£${(invoice.subtotal_amount || 0).toFixed(2)}</span>
            </div>
            ${invoice.discount_amount > 0 ? `
              <div class="total-row">
                <span>Discount:</span>
                <span>-£${invoice.discount_amount.toFixed(2)}</span>
              </div>
            ` : ''}
            ${invoice.tax_percentage > 0 ? `
              <div class="total-row">
                <span>VAT (${invoice.tax_percentage}%):</span>
                <span>£${(((invoice.subtotal_amount || 0) - (invoice.discount_amount || 0)) * (invoice.tax_percentage / 100)).toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>£${(invoice.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer-section">
          <div class="notes-section">
            ${invoice.notes ? `
              <div class="footer-title">Terms, Instructions & Notes</div>
              <div class="notes-content">${invoice.notes.replace(/\n/g, '<br>')}</div>
            ` : ''}
          </div>
          
          <div class="payment-methods-section">
            <div class="footer-title">Payment Methods</div>
            ${paymentOptions?.stripe_enabled ? `
              <div class="payment-method">
                <div class="payment-method-name">Card Payments</div>
                <div class="payment-method-details">Visa, Mastercard, American Express</div>
              </div>
            ` : ''}
            ${paymentOptions?.paypal_enabled ? `
              <div class="payment-method">
                <div class="payment-method-name">PayPal</div>
                <div class="payment-method-details">Pay securely with PayPal</div>
              </div>
            ` : ''}
            ${paymentOptions?.bank_transfer_enabled ? `
              <div class="payment-method">
                <div class="payment-method-name">Bank Transfer</div>
                <div class="payment-method-details">
                  ${paymentOptions.bank_name || ''}<br>
                  Account: ${paymentOptions.account_number || ''}<br>
                  Sort Code: ${paymentOptions.sort_code || ''}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

interface SharedInvoiceRequest {
  shareToken: string
  eventType?: 'view' | 'download' | 'print' | 'copy_link'
  userAgent?: string
  ipAddress?: string
  referrer?: string
  country?: string
  city?: string
}

// HTML generation temporarily removed to fix boot errors

// HTML rendering removed temporarily to fix boot errors

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

      // Get business settings and payment options separately
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', share.invoices.user_id)
        .single()

      const { data: paymentOptions } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', share.invoices.user_id)
        .single()

      const { data: lineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', share.invoice_id)

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

      // Get client information for tracking
      const userAgent = req.headers.get('User-Agent')
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

      // Also log to invoice activities (get user_id from invoice)
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
          ...share.invoices,
          invoice_line_items: lineItems || []
        },
        businessSettings: businessSettings,
        paymentOptions: paymentOptions
      };

      // Check if request is from browser (serve PDF directly)
      const userAgent = req.headers.get('User-Agent') || ''
      const acceptHeader = req.headers.get('Accept') || ''
      const formatParam = url.searchParams.get('format')
      
      // If request is from browser or wants PDF, serve the actual PDF
      const isBrowserRequest = userAgent.includes('Mozilla') || 
                               acceptHeader.includes('text/html') || 
                               acceptHeader.includes('application/pdf') ||
                               formatParam === 'pdf'

      if (isBrowserRequest && share.pdf_path) {
        try {
          // Get the PDF from storage and serve it directly
          const { data: pdfData, error: pdfError } = await supabase.storage
            .from('shared-invoices')
            .download(share.pdf_path)

          if (pdfError || !pdfData) {
            console.error('PDF download failed:', pdfError)
            // Fallback to HTML if PDF not available
            const htmlContent = await generateInvoicePDF(invoiceData)
            
            return new Response(htmlContent, {
              status: 200,
              headers: {
                ...corsHeaders,
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=3600'
              }
            })
          }

          // Serve the actual PDF
          return new Response(pdfData, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/pdf',
              'Content-Disposition': `inline; filename="invoice-${share.invoices.invoice_number}.pdf"`,
              'Cache-Control': 'public, max-age=3600'
            }
          })

        } catch (error) {
          console.error('PDF serving failed:', error)
          // Fallback to HTML
        }
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
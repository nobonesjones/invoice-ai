import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const POLAR_WEBHOOK_SECRET = Deno.env.get('POLAR_WEBHOOK_SECRET')

serve(async (req) => {
  try {
    // Verify webhook signature if secret is set
    if (POLAR_WEBHOOK_SECRET) {
      const signature = req.headers.get('polar-signature')
      // TODO: Implement proper signature verification
      // For now, we'll just log a warning if no signature
      if (!signature) {
        console.warn('No webhook signature provided')
      }
    }

    const event = await req.json()
    console.log('Polar webhook received:', event.type, event)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    switch (event.type) {
      case 'checkout.created':
        console.log('Checkout created:', event.data.id)
        break

      case 'checkout.updated':
        console.log('Checkout updated:', event.data.id, 'status:', event.data.status)

        if (event.data.status === 'succeeded') {
          // Payment successful!
          const invoiceId = event.data.metadata?.invoice_id

          if (invoiceId) {
            // Get the invoice to calculate payment
            const { data: invoice } = await supabase
              .from('invoices')
              .select('total_amount, paid_amount')
              .eq('id', invoiceId)
              .single()

            const paidAmount = (event.data.amount || 0) / 100 // Convert from cents

            // Update invoice status
            const { error: updateError } = await supabase
              .from('invoices')
              .update({
                polar_payment_status: 'succeeded',
                paid_amount: (invoice?.paid_amount || 0) + paidAmount,
                status: ((invoice?.paid_amount || 0) + paidAmount) >= (invoice?.total_amount || 0) ? 'paid' : 'partial'
              })
              .eq('id', invoiceId)

            if (updateError) {
              console.error('Failed to update invoice:', updateError)
            } else {
              console.log('Invoice updated successfully:', invoiceId)
            }

            // Log activity
            await supabase
              .from('invoice_activities')
              .insert({
                invoice_id: invoiceId,
                activity_type: 'payment_received',
                description: `Payment of ${paidAmount} received via Polar`,
                metadata: {
                  checkout_id: event.data.id,
                  amount: paidAmount,
                  payment_method: 'polar'
                }
              })
          }
        }
        break

      case 'checkout.confirmed':
        console.log('Checkout confirmed:', event.data.id)
        break

      case 'order.created':
        console.log('Order created:', event.data.id)

        // Update invoice based on order metadata
        const orderInvoiceId = event.data.metadata?.invoice_id
        if (orderInvoiceId) {
          await supabase
            .from('invoices')
            .update({
              polar_payment_status: 'succeeded'
            })
            .eq('id', orderInvoiceId)
        }
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

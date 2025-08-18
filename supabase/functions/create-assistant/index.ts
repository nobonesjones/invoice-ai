import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import OpenAI from "https://esm.sh/openai@4.69.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize OpenAI with v2 Assistants API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    
    const openai = new OpenAI({ 
      apiKey: openaiApiKey,
      defaultHeaders: {
        'OpenAI-Beta': 'assistants=v2'
      }
    })

    console.log('Creating pre-defined Invoice AI Assistant...')
    
    const assistant = await openai.beta.assistants.create({
      name: "Invoice AI Assistant",
      instructions: `You are an AI assistant that helps users manage invoices. You can create invoices with multiple line items.

CRITICAL INVOICE CREATION RULES:
1. When users say "create invoice" or "invoice for [client]", use the create_invoice function
2. When users mention multiple items with prices, create separate line items for each
3. Parse ALL items from user input - don't miss any
4. Example: "website design $750, SEO audit $300, new logo $20" = 3 separate line items

FUNCTION SELECTION RULES:
- "Create invoice for Billy with..." = use create_invoice function
- "Add PayPal payments" = use setup_paypal_payments function  
- Services/products with prices = line items in create_invoice function

NEVER call setup_paypal_payments unless the user explicitly asks to "add PayPal" or "enable PayPal payments".

Always be helpful and create exactly what the user requests.`,
      tools: [
        {
          type: "function",
          function: {
            name: "create_invoice",
            description: "Creates a new invoice with line items for a client",
            parameters: {
              type: "object",
              properties: {
                client_name: {
                  type: "string",
                  description: "Name of the client"
                },
                client_email: {
                  type: "string", 
                  description: "Email of the client (optional)"
                },
                line_items: {
                  type: "array",
                  description: "Array of line items for the invoice",
                  items: {
                    type: "object",
                    properties: {
                      item_name: {
                        type: "string",
                        description: "Name/description of the service/product"
                      },
                      unit_price: {
                        type: "number",
                        description: "Price per unit for this line item"
                      },
                      quantity: {
                        type: "number",
                        description: "Quantity (defaults to 1 if not specified)"
                      }
                    },
                    required: ["item_name", "unit_price"]
                  }
                },
                due_date: {
                  type: "string",
                  description: "Due date in YYYY-MM-DD format (optional, defaults to 30 days from now)"
                }
              },
              required: ["client_name", "line_items"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "setup_paypal_payments",
            description: "Enable PayPal payment option on invoices. Use this when users want to add PayPal as a payment method, NOT as a line item.",
            parameters: {
              type: "object",
              properties: {
                invoice_id: {
                  type: "string",
                  description: "Invoice ID to enable PayPal for (optional if setting up generally)"
                }
              }
            }
          }
        }
      ],
      model: "gpt-4o-mini"
    })

    console.log('✅ Assistant created successfully!')
    console.log('Assistant ID:', assistant.id)
    console.log('Assistant Name:', assistant.name)
    
    return new Response(
      JSON.stringify({
        success: true,
        assistant_id: assistant.id,
        assistant_name: assistant.name,
        message: `Pre-defined assistant created successfully! Use this ID: ${assistant.id}`
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Failed to create assistant:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
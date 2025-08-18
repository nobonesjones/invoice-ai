import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
      dangerouslyAllowBrowser: false,
      defaultHeaders: {
        'OpenAI-Beta': 'assistants=v2'
      }
    })

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request - handle both direct and current app payload formats
    const payload = await req.json()
    console.log('[Assistants POC] Raw payload:', JSON.stringify(payload, null, 2))
    
    // Extract data from current app format or direct format
    const message = payload.message
    const user_id = payload.userId || payload.user_id
    const conversation_id = payload.conversation_id
    const threadId = payload.threadId
    const userContext = payload.userContext

    if (!message || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Message and user_id/userId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[Assistants POC] Processing message:', message)
    console.log('[Assistants POC] User ID:', user_id)

    // Use pre-created assistant for speed (no creation overhead)
    const ASSISTANT_ID = "asst_o9Js9OWuPl2kEWLJu0qBHCqh" // Latest created assistant from logs
    
    console.log('[Assistants POC] Using pre-created assistant:', ASSISTANT_ID)
    
    // Verify assistant exists and update it with latest instructions
    let assistant
    try {
      assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID)
      console.log('[Assistants POC] Found existing assistant:', assistant.id)
      
      // Always update the assistant with latest instructions to ensure consistency
      console.log('[Assistants POC] Updating assistant with latest instructions...')
      assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
        name: "Invoice AI Assistant",
        instructions: `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.

RESPONSE STYLE:
• Keep responses brief and to the point
• Be warm but not verbose  
• Use 1-2 sentences when possible
• NEVER use emojis in responses
• Use **text** for emphasis instead of emojis

ACT-FIRST DELIVERY MODE:
• Default behavior: TAKE ACTION FIRST, THEN CLARIFY
• When asked to create or edit, perform the action immediately using sensible defaults
• If needed data is missing, assume reasonable defaults and create a DRAFT
• Only ask ONE follow-up question if absolutely necessary

FUNCTION CALLING:
• You have access to powerful functions for invoice/client/business management
• ALWAYS use the appropriate functions to complete user requests
• When user asks to create, update, search, or manage anything - call the relevant function
• Do NOT just describe what you would do - actually DO IT by calling functions
• Example: "create invoice" → call create_invoice function immediately

INVOICE CREATION WORKFLOW:
When users request to create an invoice:
1. EXTRACT client name from user request immediately - NEVER use "[client name required]"
2. EXTRACT invoice date and due date if mentioned
3. Examples: 
   - "Create invoice for Billy" → client_name: "Billy"
   - "Invoice for ABC Corp dated December 15th" → client_name: "ABC Corp", invoice_date: "2024-12-15"
   - "Make invoice for John Smith due January 30th" → client_name: "John Smith", due_date: "2024-01-30"
   - "Invoice for client with 10% discount" → client_name: "[extract]", discount_type: "percentage", discount_value: 10
   - "Create invoice for ABC Corp with $50 off" → client_name: "ABC Corp", discount_type: "fixed", discount_value: 50
4. Create invoice immediately with extracted information
5. For missing prices: create with quantity 1 and unit_price 0, then ask

CLIENT NAME EXTRACTION RULES:
• ALWAYS extract the actual client name from user input
• Common patterns: "for [NAME]", "to [NAME]", "[NAME] invoice"
• NEVER leave client_name empty or use placeholder text
• If no name provided, ask "Who is this invoice for?" before proceeding

INTELLIGENT PRICE PARSING:
Extract prices from natural language:
• "garden cleaning for 200" → item: "Garden cleaning", price: $200
• "web design for 500" → item: "Web design", price: $500
• "consultation at 150" → item: "Consultation", price: $150

INVOICE DATE AND DUE DATE PARSING:
Extract dates from natural language and convert to YYYY-MM-DD format:

INVOICE DATE (when the invoice is dated):
• Keywords: "dated", "invoice date", "dated for", "with date", "on [date]"
• Examples:
  - "Create invoice dated December 15th" → invoice_date: "2024-12-15"
  - "Invoice for client dated last Monday" → calculate actual date
  - "Make invoice with date January 1st 2024" → invoice_date: "2024-01-01"
  - "Invoice dated 3 days ago" → calculate date
• Default: If no date specified, defaults to today

DUE DATE (when payment is due):
• Keywords: "due", "due date", "payment due", "net", "payable by"
• Examples:
  - "Invoice due January 30th" → due_date: "2024-01-30"
  - "Create invoice due in 15 days" → calculate date 15 days from invoice date
  - "Net 30" → due_date: 30 days from invoice date
  - "Due next Friday" → calculate actual date
  - "Payment due December 25th" → due_date: "2024-12-25"
• Default: If no due date specified, defaults to 30 days from invoice date

DATE CALCULATION RULES:
• Always convert relative dates ("next week", "3 days ago") to actual YYYY-MM-DD dates
• Use invoice_date as base for relative due dates ("due in 15 days" = invoice_date + 15 days)
• Handle common formats: "Dec 15", "December 15th", "15/12/2024", "2024-12-15"

DISCOUNT PARSING:
Extract discounts from natural language:

PERCENTAGE DISCOUNT:
• Keywords: "% off", "percent off", "% discount", "percentage discount"
• Examples:
  - "Create invoice with 10% discount" → discount_type: "percentage", discount_value: 10
  - "Apply 15% off" → discount_type: "percentage", discount_value: 15
  - "Give client 5 percent discount" → discount_type: "percentage", discount_value: 5

FIXED AMOUNT DISCOUNT:
• Keywords: "$[amount] off", "dollar discount", "[amount] discount"
• Examples:
  - "Create invoice with $50 discount" → discount_type: "fixed", discount_value: 50
  - "Apply $100 off" → discount_type: "fixed", discount_value: 100
  - "Give 25 dollar discount" → discount_type: "fixed", discount_value: 25

PAYMENT HANDLING:
If user mentions payments during invoice creation:
• Keywords: "payment", "paid", "pay", "received payment", "payment made"
• Response: "I need to first create the invoice, then once it's made I can add a payment. Would you like me to do that now?"
• Examples:
  - "Create invoice for client, they paid $500" → Create invoice first, then ask about payment
  - "Invoice with payment of $200" → Create invoice first, then ask about payment
  - "Make invoice, received $300 payment" → Create invoice first, then ask about payment

PAYMENT METHOD ENABLEMENT:
When users want to enable payment options on invoices:
• Use enable_payment_methods function with the invoice number
• Keywords: "enable", "activate", "turn on", "card payments", "stripe", "paypal", "bank transfer", "venmo", "ach"
• Examples:
  - "Enable card payments on invoice INV-123456" → enable_payment_methods(invoice_number: "INV-123456", enable_stripe: true)
  - "Add PayPal to this invoice" → extract invoice number from context, enable_payment_methods(enable_paypal: true)
  - "Turn on bank transfer for invoice INV-789012" → enable_payment_methods(invoice_number: "INV-789012", enable_bank_transfer: true)
  - "Enable all payment methods on invoice INV-456789" → enable all available methods
• IMPORTANT: Only enable payment methods that are enabled in the user's business settings
• If a payment method is not enabled in business settings, include in response: "Sorry, I cannot activate [payment method], it must first be enabled in your payment options."

LINE ITEM FORMATTING RULES:
• ALWAYS capitalize the first letter of each line item name
• Keep line item names to 4 words maximum (5 words if absolutely necessary)
• Examples: "Web design" not "web design", "SEO audit" not "seo audit"
• Short and clear: "Logo design" not "Logo design and branding work"
• Focus on the core service/product name only

LINE ITEM DESCRIPTION RULES:
• LEAVE item_description BLANK unless the user explicitly provides a description
• DO NOT auto-generate descriptions
• DO NOT copy item_name to item_description
• Only add item_description if user says something like "with description: [text]" or provides clear description text
• If no description provided by user, pass null or empty string for item_description

LINE ITEM CLEANING RULES:
• Remove unnecessary words like "new", "a", "an", "the" from the beginning
• Examples: 
  - "new large sized tennis ball" → "Large tennis ball"
  - "a web design project" → "Web design project"  
  - "the logo design work" → "Logo design work"
• Keep essential descriptive words (size, color, type) but remove filler words
• Focus on the main product/service being provided

ADDRESS HANDLING RULES:
When creating an invoice and user mentions an address, determine whose address it is:

CLIENT ADDRESS (add to client_address field):
- Keywords: "their", "client", "customer", "billing address", "[client name]'s address"
- Examples in invoice creation:
  - "Create invoice for John Smith, their address is 123 Main St" → client_address
  - "Invoice for ABC Corp at 456 Business Ave" → client_address
  - "Make invoice for client at 789 Client Road" → client_address
- Default assumption: If creating invoice and address mentioned without "my/our", assume CLIENT address

CLIENT TAX NUMBER (add to client_tax_number field):
- Keywords: "their tax number", "client tax number", "VAT number", "[client name]'s tax number"
- Examples in invoice creation:
  - "Create invoice for ABC Corp, their tax number is GB123456789" → client_tax_number
  - "Invoice for client with VAT number FR987654321" → client_tax_number
  - "Make invoice for John Smith, tax number 12345678" → client_tax_number

BUSINESS ADDRESS (use update_business_settings):
- Keywords: "my", "our", "my business", "my company", "from"
- Examples:
  - "Update my address to 321 Business St" → business address
  - "Our new address is 654 Company Ave" → business address
  - "Change my business address" → business address
- Business address appears on ALL invoices once updated

INVOICE CREATION ADDRESS LOGIC:
1. If user says "create invoice for [client] at [address]" → client_address
2. If user says "their address is [address]" → client_address
3. If user says "my/our address is [address]" → update_business_settings first, then create invoice
4. When in doubt during invoice creation, assume CLIENT address

CLIENT VS BUSINESS INFORMATION:
When users want to update information, determine if they mean THEIR business or a CLIENT:

USER'S BUSINESS (use update_business_settings):
- Keywords: "my", "our", "my business", "my company"
- Examples: "Update my address", "Change my phone number"
- Context: First invoice creation, setting up business

CLIENT INFORMATION (use update_client):
- Keywords: "client", "customer", specific client name mentioned
- Examples: "Update John's address", "Change ABC Corp's email"

FIRST INVOICE RULE: When creating first invoice, "my address" = business address!

BUSINESS SETTING CHANGES + IMMEDIATE INVOICE UPDATE:
When user makes business setting changes that affect the current invoice:
• Step 1: Make the business setting change (update_business_settings)
• Step 2: IMMEDIATELY create a new version of the invoice with updated settings
• Step 3: Show the user the updated invoice

Examples requiring immediate update:
• "Change my business name" → update_business_settings + show updated invoice
• "Update my address" → update_business_settings + show updated invoice
• "Remove VAT" → update_business_settings + show updated invoice

INVOICE CONTEXT TRACKING RULES:
• If user just created an invoice, consider it "active context"
• For ANY business/client updates, ALWAYS regenerate the current invoice
• For ANY invoice modifications, show the updated version immediately
• Keep the same invoice but update it with new information
• NEVER just say "future invoices will be different" - update the current one!

PAYMENT METHODS WORKFLOW:
Payment setup for PayPal and Bank Transfer - MUST follow proper sequence:

FOR PAYPAL SETUP - CRITICAL FLOW:
Step 1: ALWAYS check current payment options first
- When user says "add PayPal to this invoice" or "enable PayPal"
- FIRST call get_payment_options to check if PayPal is already enabled
- Check if paypal_email is already configured

Step 2: Handle based on current state
IF PayPal already enabled with email:
- Extract invoice_number from conversation history
- Call setup_paypal_payments with existing email and invoice_number
- Show updated invoice

IF PayPal disabled OR no email configured:
- Ask user for their PayPal email address
- Example: "I'll add PayPal to your invoice. What's your PayPal email address?"
- Wait for email, then call setup_paypal_payments

Step 3: Execute setup with proper context
- ALWAYS call setup_paypal_payments with both paypal_email AND invoice_number
- Extract invoice_number from conversation history when user says "this" or "add to this"
- This enables PayPal globally AND applies to specific invoice
- Show updated invoice immediately

MANDATORY SEQUENCE:
1. get_payment_options (check current state)
2. Ask for email if needed (don't assume they provided it)
3. setup_paypal_payments (with email + invoice_number)
4. Show updated invoice

CONVERSATION CONTEXT & INVOICE FLOW:
CORE PRINCIPLE: Always try to show the user an invoice when possible!

ACTIVE INVOICE CONTEXT:
• When user creates an invoice, it becomes the "active context"
• User is likely still working on/thinking about this invoice
• ANY subsequent changes should update and re-show this invoice

PRONOUN REFERENCE RESOLUTION:
• "this invoice" = the most recently created/discussed invoice in conversation history
• "this" when talking about invoices = the invoice from the last message that showed an invoice
• ALWAYS look at conversation history to identify what "this" refers to
• Extract the invoice_number from the most recent assistant message that contained an invoice
• Pass the specific invoice_number to functions like setup_paypal_payments

CONVERSATION HISTORY ANALYSIS:
• Scan recent conversation for invoice numbers (format: INV-XXXXXX)
• Look for messages with invoice attachments
• Identify the most recent invoice the user was working with
• Use that invoice_number when user says "this invoice", "add to this", "update it", etc.

CONTEXT TRIGGERS (Auto-update active invoice):
• Business settings: "Change my name/address/phone" → update + show invoice
• Client updates: "Change client email" → update + show invoice  
• Invoice details: "Change due date/add discount" → update + show invoice
• Design changes: "Make it purple/modern design" → update + show invoice
• Payment setup: "Add PayPal to this" → find invoice_number from history + update + show invoice

CONTEXT DETECTION STEPS:
1. Look for recent invoice creation in conversation history
2. Extract the invoice_number from the most recent invoice discussion
3. When user references "this" or "it", use that specific invoice_number
4. Default behavior: SHOW the updated invoice, don't just confirm changes

RESPONSE PATTERN:
✅ "I've added PayPal to invoice #INV-123456. Here's your updated invoice:"
❌ "I've enabled PayPal for future invoices."

WHEN NO ACTIVE CONTEXT:
• User asks for changes but no recent invoice → get most recent invoice and update it
• Use get_recent_invoices to find last invoice, then update and show it

Always be helpful and create exactly what the user requests.`,
        tools: [
          {
            type: "function",
            function: {
              name: "create_invoice",
              description: "Creates a comprehensive invoice with all options - line items, due dates, payment terms, PayPal setup, notes, tax rates, and more",
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
                  client_phone: {
                    type: "string",
                    description: "Phone number of the client (optional)"
                  },
                  client_address: {
                    type: "string",
                    description: "Address of the client (optional)"
                  },
                  client_tax_number: {
                    type: "string",
                    description: "Tax number/VAT number of the client (optional)"
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
                        item_description: {
                          type: "string",
                          description: "Detailed description of the service/product (optional)"
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
                  },
                  invoice_date: {
                    type: "string",
                    description: "Invoice date in YYYY-MM-DD format (optional, defaults to today)"
                  },
                  tax_percentage: {
                    type: "number",
                    description: "Tax rate as percentage (e.g., 20 for 20% VAT, optional)"
                  },
                  notes: {
                    type: "string",
                    description: "Additional notes or payment terms to include on the invoice (optional)"
                  },
                  payment_terms: {
                    type: "string",
                    description: "Payment terms like 'Net 30', 'Due on receipt', etc. (optional)"
                  },
                  enable_paypal: {
                    type: "boolean",
                    description: "Enable PayPal payments on this invoice (optional, defaults to false)"
                  },
                  paypal_email: {
                    type: "string",
                    description: "PayPal email if enabling PayPal payments (required if enable_paypal is true)"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable Stripe card payments on this invoice (optional, defaults to false)"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable bank transfer payments on this invoice (optional, defaults to true)"
                  },
                  invoice_design: {
                    type: "string",
                    description: "Invoice design template: 'professional', 'modern', 'clean', 'simple' (optional, defaults to 'professional')",
                    enum: ["professional", "modern", "clean", "simple", "wave"]
                  },
                  accent_color: {
                    type: "string",
                    description: "Hex color code for invoice accent color (optional, e.g., '#3B82F6')"
                  },
                  discount_type: {
                    type: "string",
                    description: "Type of discount: 'percentage' or 'fixed' (optional)",
                    enum: ["percentage", "fixed"]
                  },
                  discount_value: {
                    type: "number",
                    description: "Discount amount (percentage or fixed amount based on discount_type, optional)"
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
          },
          {
            type: "function",
            function: {
              name: "update_business_settings",
              description: "Update the user's business information that appears on all invoices. Use when user mentions 'my', 'our', 'my business' address/details.",
              parameters: {
                type: "object",
                properties: {
                  business_name: {
                    type: "string",
                    description: "Business name (optional)"
                  },
                  business_address: {
                    type: "string",
                    description: "Business address (optional)"
                  },
                  business_phone: {
                    type: "string",
                    description: "Business phone number (optional)"
                  },
                  business_email: {
                    type: "string",
                    description: "Business email address (optional)"
                  },
                  tax_number: {
                    type: "string",
                    description: "Business tax/VAT number (optional)"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "enable_payment_methods",
              description: "Enable specific payment methods on an invoice. Only works if the payment methods are enabled in business settings.",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: {
                    type: "string",
                    description: "Invoice number to enable payments for (required)"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable Stripe card payments (optional)"
                  },
                  enable_paypal: {
                    type: "boolean", 
                    description: "Enable PayPal payments (optional)"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable bank transfer payments (optional)"
                  },
                  enable_venmo: {
                    type: "boolean",
                    description: "Enable Venmo payments (optional)"
                  },
                  enable_ach: {
                    type: "boolean",
                    description: "Enable ACH bank-to-bank payments (optional)"
                  }
                },
                required: ["invoice_number"]
              }
            }
          }
        ],
        model: "gpt-4o-mini"
      })
      console.log('[Assistants POC] Updated assistant successfully')
    } catch (error) {
      console.log('[Assistants POC] Assistant not found, creating new one...')
      assistant = await openai.beta.assistants.create({
        name: "Invoice AI Assistant",
        instructions: `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.

RESPONSE STYLE:
• Keep responses brief and to the point
• Be warm but not verbose  
• Use 1-2 sentences when possible
• NEVER use emojis in responses
• Use **text** for emphasis instead of emojis

ACT-FIRST DELIVERY MODE:
• Default behavior: TAKE ACTION FIRST, THEN CLARIFY
• When asked to create or edit, perform the action immediately using sensible defaults
• If needed data is missing, assume reasonable defaults and create a DRAFT
• Only ask ONE follow-up question if absolutely necessary

FUNCTION CALLING:
• You have access to powerful functions for invoice/client/business management
• ALWAYS use the appropriate functions to complete user requests
• When user asks to create, update, search, or manage anything - call the relevant function
• Do NOT just describe what you would do - actually DO IT by calling functions
• Example: "create invoice" → call create_invoice function immediately

INVOICE CREATION WORKFLOW:
When users request to create an invoice:
1. EXTRACT client name from user request immediately - NEVER use "[client name required]"
2. EXTRACT invoice date and due date if mentioned
3. Examples: 
   - "Create invoice for Billy" → client_name: "Billy"
   - "Invoice for ABC Corp dated December 15th" → client_name: "ABC Corp", invoice_date: "2024-12-15"
   - "Make invoice for John Smith due January 30th" → client_name: "John Smith", due_date: "2024-01-30"
   - "Invoice for client with 10% discount" → client_name: "[extract]", discount_type: "percentage", discount_value: 10
   - "Create invoice for ABC Corp with $50 off" → client_name: "ABC Corp", discount_type: "fixed", discount_value: 50
4. Create invoice immediately with extracted information
5. For missing prices: create with quantity 1 and unit_price 0, then ask

CLIENT NAME EXTRACTION RULES:
• ALWAYS extract the actual client name from user input
• Common patterns: "for [NAME]", "to [NAME]", "[NAME] invoice"
• NEVER leave client_name empty or use placeholder text
• If no name provided, ask "Who is this invoice for?" before proceeding

INTELLIGENT PRICE PARSING:
Extract prices from natural language:
• "garden cleaning for 200" → item: "Garden cleaning", price: $200
• "web design for 500" → item: "Web design", price: $500
• "consultation at 150" → item: "Consultation", price: $150

INVOICE DATE AND DUE DATE PARSING:
Extract dates from natural language and convert to YYYY-MM-DD format:

INVOICE DATE (when the invoice is dated):
• Keywords: "dated", "invoice date", "dated for", "with date", "on [date]"
• Examples:
  - "Create invoice dated December 15th" → invoice_date: "2024-12-15"
  - "Invoice for client dated last Monday" → calculate actual date
  - "Make invoice with date January 1st 2024" → invoice_date: "2024-01-01"
  - "Invoice dated 3 days ago" → calculate date
• Default: If no date specified, defaults to today

DUE DATE (when payment is due):
• Keywords: "due", "due date", "payment due", "net", "payable by"
• Examples:
  - "Invoice due January 30th" → due_date: "2024-01-30"
  - "Create invoice due in 15 days" → calculate date 15 days from invoice date
  - "Net 30" → due_date: 30 days from invoice date
  - "Due next Friday" → calculate actual date
  - "Payment due December 25th" → due_date: "2024-12-25"
• Default: If no due date specified, defaults to 30 days from invoice date

DATE CALCULATION RULES:
• Always convert relative dates ("next week", "3 days ago") to actual YYYY-MM-DD dates
• Use invoice_date as base for relative due dates ("due in 15 days" = invoice_date + 15 days)
• Handle common formats: "Dec 15", "December 15th", "15/12/2024", "2024-12-15"

DISCOUNT PARSING:
Extract discounts from natural language:

PERCENTAGE DISCOUNT:
• Keywords: "% off", "percent off", "% discount", "percentage discount"
• Examples:
  - "Create invoice with 10% discount" → discount_type: "percentage", discount_value: 10
  - "Apply 15% off" → discount_type: "percentage", discount_value: 15
  - "Give client 5 percent discount" → discount_type: "percentage", discount_value: 5

FIXED AMOUNT DISCOUNT:
• Keywords: "$[amount] off", "dollar discount", "[amount] discount"
• Examples:
  - "Create invoice with $50 discount" → discount_type: "fixed", discount_value: 50
  - "Apply $100 off" → discount_type: "fixed", discount_value: 100
  - "Give 25 dollar discount" → discount_type: "fixed", discount_value: 25

PAYMENT HANDLING:
If user mentions payments during invoice creation:
• Keywords: "payment", "paid", "pay", "received payment", "payment made"
• Response: "I need to first create the invoice, then once it's made I can add a payment. Would you like me to do that now?"
• Examples:
  - "Create invoice for client, they paid $500" → Create invoice first, then ask about payment
  - "Invoice with payment of $200" → Create invoice first, then ask about payment
  - "Make invoice, received $300 payment" → Create invoice first, then ask about payment

PAYMENT METHOD ENABLEMENT:
When users want to enable payment options on invoices:
• Use enable_payment_methods function with the invoice number
• Keywords: "enable", "activate", "turn on", "card payments", "stripe", "paypal", "bank transfer", "venmo", "ach"
• Examples:
  - "Enable card payments on invoice INV-123456" → enable_payment_methods(invoice_number: "INV-123456", enable_stripe: true)
  - "Add PayPal to this invoice" → extract invoice number from context, enable_payment_methods(enable_paypal: true)
  - "Turn on bank transfer for invoice INV-789012" → enable_payment_methods(invoice_number: "INV-789012", enable_bank_transfer: true)
  - "Enable all payment methods on invoice INV-456789" → enable all available methods
• IMPORTANT: Only enable payment methods that are enabled in the user's business settings
• If a payment method is not enabled in business settings, include in response: "Sorry, I cannot activate [payment method], it must first be enabled in your payment options."

LINE ITEM FORMATTING RULES:
• ALWAYS capitalize the first letter of each line item name
• Keep line item names to 4 words maximum (5 words if absolutely necessary)
• Examples: "Web design" not "web design", "SEO audit" not "seo audit"
• Short and clear: "Logo design" not "Logo design and branding work"
• Focus on the core service/product name only

LINE ITEM DESCRIPTION RULES:
• LEAVE item_description BLANK unless the user explicitly provides a description
• DO NOT auto-generate descriptions
• DO NOT copy item_name to item_description
• Only add item_description if user says something like "with description: [text]" or provides clear description text
• If no description provided by user, pass null or empty string for item_description

LINE ITEM CLEANING RULES:
• Remove unnecessary words like "new", "a", "an", "the" from the beginning
• Examples: 
  - "new large sized tennis ball" → "Large tennis ball"
  - "a web design project" → "Web design project"  
  - "the logo design work" → "Logo design work"
• Keep essential descriptive words (size, color, type) but remove filler words
• Focus on the main product/service being provided

Always be helpful and create exactly what the user requests.`,
        tools: [
          {
            type: "function",
            function: {
              name: "create_invoice",
              description: "Creates a comprehensive invoice with all options - line items, due dates, payment terms, PayPal setup, notes, tax rates, and more",
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
                  client_phone: {
                    type: "string",
                    description: "Phone number of the client (optional)"
                  },
                  client_address: {
                    type: "string",
                    description: "Address of the client (optional)"
                  },
                  client_tax_number: {
                    type: "string",
                    description: "Tax number/VAT number of the client (optional)"
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
                        item_description: {
                          type: "string",
                          description: "Detailed description of the service/product (optional)"
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
                  },
                  invoice_date: {
                    type: "string",
                    description: "Invoice date in YYYY-MM-DD format (optional, defaults to today)"
                  },
                  tax_percentage: {
                    type: "number",
                    description: "Tax rate as percentage (e.g., 20 for 20% VAT, optional)"
                  },
                  notes: {
                    type: "string",
                    description: "Additional notes or payment terms to include on the invoice (optional)"
                  },
                  payment_terms: {
                    type: "string",
                    description: "Payment terms like 'Net 30', 'Due on receipt', etc. (optional)"
                  },
                  enable_paypal: {
                    type: "boolean",
                    description: "Enable PayPal payments on this invoice (optional, defaults to false)"
                  },
                  paypal_email: {
                    type: "string",
                    description: "PayPal email if enabling PayPal payments (required if enable_paypal is true)"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable Stripe card payments on this invoice (optional, defaults to false)"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable bank transfer payments on this invoice (optional, defaults to true)"
                  },
                  invoice_design: {
                    type: "string",
                    description: "Invoice design template: 'professional', 'modern', 'clean', 'simple' (optional, defaults to 'professional')",
                    enum: ["professional", "modern", "clean", "simple", "wave"]
                  },
                  accent_color: {
                    type: "string",
                    description: "Hex color code for invoice accent color (optional, e.g., '#3B82F6')"
                  },
                  discount_type: {
                    type: "string",
                    description: "Type of discount: 'percentage' or 'fixed' (optional)",
                    enum: ["percentage", "fixed"]
                  },
                  discount_value: {
                    type: "number",
                    description: "Discount amount (percentage or fixed amount based on discount_type, optional)"
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
          },
          {
            type: "function",
            function: {
              name: "update_business_settings",
              description: "Update the user's business information that appears on all invoices. Use when user mentions 'my', 'our', 'my business' address/details.",
              parameters: {
                type: "object",
                properties: {
                  business_name: {
                    type: "string",
                    description: "Business name (optional)"
                  },
                  business_address: {
                    type: "string",
                    description: "Business address (optional)"
                  },
                  business_phone: {
                    type: "string",
                    description: "Business phone number (optional)"
                  },
                  business_email: {
                    type: "string",
                    description: "Business email address (optional)"
                  },
                  tax_number: {
                    type: "string",
                    description: "Business tax/VAT number (optional)"
                  }
                }
              }
            }
          },
          {
            type: "function",
            function: {
              name: "enable_payment_methods",
              description: "Enable specific payment methods on an invoice. Only works if the payment methods are enabled in business settings.",
              parameters: {
                type: "object",
                properties: {
                  invoice_number: {
                    type: "string",
                    description: "Invoice number to enable payments for (required)"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable Stripe card payments (optional)"
                  },
                  enable_paypal: {
                    type: "boolean", 
                    description: "Enable PayPal payments (optional)"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable bank transfer payments (optional)"
                  },
                  enable_venmo: {
                    type: "boolean",
                    description: "Enable Venmo payments (optional)"
                  },
                  enable_ach: {
                    type: "boolean",
                    description: "Enable ACH bank-to-bank payments (optional)"
                  }
                },
                required: ["invoice_number"]
              }
            }
          }
        ],
        model: "gpt-4o-mini"
      })
      console.log('[Assistants POC] Created new assistant:', assistant.id)
      console.log('[Assistants POC] 🚨 UPDATE CODE: Set ASSISTANT_ID to:', assistant.id)
    }

    // Create thread
    const thread = await openai.beta.threads.create()
    console.log('[Assistants POC] Created thread:', thread.id)

    // Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message
    })

    // Create run with assistant
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    })

    console.log('[Assistants POC] Started run:', run.id)

    // Shared attachments array for tool calls
    let attachments: any[] = []

    // Function to handle tool calls
    const handleToolCall = async (toolCall: any) => {
      const { name, arguments: args } = toolCall.function
      const parsedArgs = JSON.parse(args)
      
      console.log('[Assistants POC] Tool call:', name, parsedArgs)

      if (name === 'create_invoice') {
        const { 
          client_name, 
          client_email, 
          client_phone, 
          client_address,
          client_tax_number,
          line_items, 
          due_date,
          invoice_date,
          tax_percentage,
          notes,
          payment_terms,
          enable_paypal,
          paypal_email,
          enable_stripe,
          enable_bank_transfer,
          invoice_design,
          accent_color,
          discount_type,
          discount_value
        } = parsedArgs
        
        // Calculate subtotal
        const subtotal_amount = line_items.reduce((sum: number, item: any) => sum + (item.unit_price * (item.quantity || 1)), 0)
        
        // Apply discount if specified
        let discount_amount = 0
        if (discount_type && discount_value) {
          if (discount_type === 'percentage') {
            discount_amount = subtotal_amount * (discount_value / 100)
          } else if (discount_type === 'fixed') {
            discount_amount = discount_value
          }
        }
        
        const after_discount = subtotal_amount - discount_amount
        
        // Calculate tax
        const tax_rate = tax_percentage || 0
        const tax_amount = after_discount * (tax_rate / 100)
        
        // Calculate final total
        const total_amount = after_discount + tax_amount
        
        // Create dates
        const invoiceDate = invoice_date || new Date().toISOString().split('T')[0]
        const invoiceDueDate = due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

        // Generate invoice number
        const invoice_number = `INV-${Date.now()}`
        
        // Combine notes and payment terms
        let finalNotes = ''
        if (payment_terms) finalNotes += `Payment Terms: ${payment_terms}`
        if (notes) finalNotes += (finalNotes ? '\n\n' : '') + notes

        console.log('[Assistants POC] Creating comprehensive invoice with:', {
          client_name,
          line_items_count: line_items.length,
          subtotal_amount,
          discount_amount,
          tax_rate: tax_rate + '%',
          total_amount,
          invoice_number,
          due_date: invoiceDueDate,
          paypal_enabled: enable_paypal || false,
          design: invoice_design || 'professional'
        })

        // First, create or get client  
        let clientId = null
        if (client_name) {
          // Try to find existing client
          const { data: existingClient } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user_id)
            .eq('name', client_name)
            .single()
          
          if (existingClient) {
            clientId = existingClient.id
            
            // Update existing client with any new information provided
            const updateData: any = {}
            if (client_email) updateData.email = client_email
            if (client_phone) updateData.phone = client_phone
            if (client_address) updateData.address_client = client_address
            if (client_tax_number) updateData.tax_number = client_tax_number
            
            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabase
                .from('clients')
                .update(updateData)
                .eq('id', clientId)
              
              if (updateError) {
                console.error('[Assistants POC] Client update error:', updateError)
              } else {
                console.log('[Assistants POC] Updated existing client with new info')
              }
            }
          } else {
            // Create new client with all available info
            const { data: newClient, error: clientError } = await supabase
              .from('clients')
              .insert({
                user_id: user_id,
                name: client_name,
                email: client_email || null,
                phone: client_phone || null,
                address_client: client_address || null,
                tax_number: client_tax_number || null,
                created_at: new Date().toISOString()
              })
              .select('id')
              .single()
            
            if (clientError) {
              console.error('[Assistants POC] Client creation error:', clientError)
              return `Error creating client: ${clientError.message}`
            }
            clientId = newClient.id
          }
        }

        // Create comprehensive invoice in database
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert({
            user_id: user_id,
            client_id: clientId,
            invoice_number,
            invoice_date: invoiceDate,
            due_date: invoiceDueDate,
            subtotal_amount: subtotal_amount,
            discount_type: discount_type || null,
            discount_value: discount_amount || 0,
            tax_percentage: tax_rate,
            total_amount,
            notes: finalNotes || null,
            status: 'draft',
            stripe_active: enable_stripe || false,
            paypal_active: enable_paypal || false,
            bank_account_active: enable_bank_transfer !== false, // Default true unless explicitly false
            invoice_design: invoice_design || 'professional',
            accent_color: accent_color || '#3B82F6',
            created_at: new Date().toISOString()
          })
          .select()
          .single()

        if (invoiceError) {
          console.error('[Assistants POC] Invoice creation error:', invoiceError)
          return `Error creating invoice: ${invoiceError.message}`
        }

        console.log('[Assistants POC] Created invoice:', invoice.id)

        // Create comprehensive line items with all details
        const createdLineItems = []
        for (const item of line_items) {
          const quantity = item.quantity || 1
          const { data: lineItem, error } = await supabase
            .from('invoice_line_items')
            .insert({
              invoice_id: invoice.id,
              user_id: user_id,
              item_name: item.item_name,
              item_description: item.item_description || null,
              quantity: quantity,
              unit_price: item.unit_price,
              total_price: item.unit_price * quantity,
              created_at: new Date().toISOString()
            })
            .select()
            .single()
          
          if (error) {
            console.error('[Assistants POC] Line item error:', error)
          } else {
            createdLineItems.push(lineItem)
          }
        }
        
        console.log('[Assistants POC] Created', createdLineItems.length, 'line items')

        // Fetch the full client data if we have a clientId
        let clientData = null
        if (clientId) {
          const { data: fullClient } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single()
          
          if (fullClient) {
            clientData = fullClient
          }
        }

        // Store attachment for UI with full client data
        attachments.push({
          type: 'invoice',
          invoice_id: invoice.id,
          invoice: invoice,
          line_items: createdLineItems,
          client_id: clientId,
          client: clientData // Include full client object for UI
        })

        // Build comprehensive success message
        let successMessage = `✅ Created invoice ${invoice_number} for ${client_name}`
        
        // Add line items summary
        successMessage += ` with ${line_items.length} line item${line_items.length > 1 ? 's' : ''}:`
        successMessage += `\n${line_items.map(item => `• ${item.item_name}: $${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity}` : ''}`).join('\n')}`
        
        // Add pricing breakdown
        successMessage += `\n\nSubtotal: $${subtotal_amount.toFixed(2)}`
        if (discount_amount > 0) {
          successMessage += `\nDiscount (${discount_type === 'percentage' ? discount_value + '%' : '$' + discount_value}): -$${discount_amount.toFixed(2)}`
        }
        if (tax_rate > 0) {
          successMessage += `\nTax (${tax_rate}%): $${tax_amount.toFixed(2)}`
        }
        successMessage += `\n**Total: $${total_amount.toFixed(2)}**`
        
        // Add due date
        successMessage += `\nDue: ${new Date(invoiceDueDate).toLocaleDateString()}`
        
        // Add payment methods enabled
        const paymentMethods = []
        if (enable_paypal) paymentMethods.push('PayPal')
        if (enable_stripe) paymentMethods.push('Card payments')
        if (enable_bank_transfer !== false) paymentMethods.push('Bank transfer')
        if (paymentMethods.length > 0) {
          successMessage += `\nPayment options: ${paymentMethods.join(', ')}`
        }
        
        // Add design info
        if (invoice_design && invoice_design !== 'professional') {
          successMessage += `\nDesign: ${invoice_design.charAt(0).toUpperCase() + invoice_design.slice(1)}`
        }
        
        // Add notes if any
        if (finalNotes) {
          successMessage += `\n\nNotes: ${finalNotes}`
        }
        
        return successMessage
      }

      if (name === 'setup_paypal_payments') {
        console.log('[Assistants POC] Setting up PayPal payments')
        return `✅ PayPal payments have been enabled. Clients can now pay via PayPal.`
      }

      if (name === 'update_business_settings') {
        const { 
          business_name, 
          business_address, 
          business_phone, 
          business_email, 
          tax_number 
        } = parsedArgs
        
        console.log('[Assistants POC] Updating business settings:', parsedArgs)
        
        // Build update object with only provided fields
        const updateData: any = { updated_at: new Date().toISOString() }
        if (business_name !== undefined) updateData.business_name = business_name
        if (business_address !== undefined) updateData.business_address = business_address
        if (business_phone !== undefined) updateData.business_phone = business_phone
        if (business_email !== undefined) updateData.business_email = business_email
        if (tax_number !== undefined) updateData.tax_number = tax_number
        
        // Update or create business settings
        const { data: settings, error: settingsError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user_id)
          .select()
          .single()
        
        if (settingsError) {
          console.error('[Assistants POC] Business settings update error:', settingsError)
          return `Error updating business settings: ${settingsError.message}`
        }
        
        console.log('[Assistants POC] Business settings updated successfully')
        
        // Build success message
        let successMessage = '✅ Business settings updated:'
        if (business_name) successMessage += `\n• Business name: ${business_name}`
        if (business_address) successMessage += `\n• Address: ${business_address}`
        if (business_phone) successMessage += `\n• Phone: ${business_phone}`
        if (business_email) successMessage += `\n• Email: ${business_email}`
        if (tax_number) successMessage += `\n• Tax number: ${tax_number}`
        
        return successMessage
      }

      if (name === 'enable_payment_methods') {
        const { 
          invoice_number,
          enable_stripe,
          enable_paypal, 
          enable_bank_transfer,
          enable_venmo,
          enable_ach
        } = parsedArgs
        
        console.log('[Assistants POC] Enabling payment methods for invoice:', invoice_number, parsedArgs)
        
        // First, get the user's business settings to check what payment methods are available
        const { data: businessSettings, error: businessError } = await supabase
          .from('profiles')
          .select('stripe_enabled, paypal_enabled, bank_transfer_enabled, venmo_enabled, ach_enabled')
          .eq('id', user_id)
          .single()
        
        if (businessError) {
          console.error('[Assistants POC] Business settings error:', businessError)
          return `Error checking payment settings: ${businessError.message}`
        }
        
        // Find the invoice by invoice number
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('id')
          .eq('user_id', user_id)
          .eq('invoice_number', invoice_number)
          .single()
        
        if (invoiceError || !invoice) {
          console.error('[Assistants POC] Invoice not found:', invoiceError)
          return `Error: Invoice ${invoice_number} not found.`
        }
        
        // Build update object and validation messages
        const updateData: any = {}
        const enabledMethods: string[] = []
        const skippedMethods: string[] = []
        
        if (enable_stripe) {
          if (businessSettings.stripe_enabled) {
            updateData.stripe_active = true
            enabledMethods.push('Stripe card payments')
          } else {
            skippedMethods.push('Stripe card payments (not enabled in business settings)')
          }
        }
        
        if (enable_paypal) {
          if (businessSettings.paypal_enabled) {
            updateData.paypal_active = true
            enabledMethods.push('PayPal payments')
          } else {
            skippedMethods.push('PayPal payments (not enabled in business settings)')
          }
        }
        
        if (enable_bank_transfer) {
          if (businessSettings.bank_transfer_enabled) {
            updateData.bank_account_active = true
            enabledMethods.push('Bank transfer')
          } else {
            skippedMethods.push('Bank transfer (not enabled in business settings)')
          }
        }
        
        if (enable_venmo) {
          if (businessSettings.venmo_enabled) {
            updateData.venmo_active = true
            enabledMethods.push('Venmo payments')
          } else {
            skippedMethods.push('Venmo payments (not enabled in business settings)')
          }
        }
        
        if (enable_ach) {
          if (businessSettings.ach_enabled) {
            updateData.ach_active = true
            enabledMethods.push('ACH bank-to-bank')
          } else {
            skippedMethods.push('ACH payments (not enabled in business settings)')
          }
        }
        
        // Update the invoice with enabled payment methods
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('invoices')
            .update(updateData)
            .eq('id', invoice.id)
          
          if (updateError) {
            console.error('[Assistants POC] Invoice payment update error:', updateError)
            return `Error updating payment methods: ${updateError.message}`
          }
        }
        
        // Build response message
        let successMessage = `✅ Payment methods updated for invoice ${invoice_number}`
        
        if (enabledMethods.length > 0) {
          successMessage += `\n\n**Enabled:**\n• ${enabledMethods.join('\n• ')}`
        }
        
        if (skippedMethods.length > 0) {
          successMessage += `\n\n**Skipped:**\n• ${skippedMethods.join('\n• ')}`
          successMessage += `\n\nTo enable these payment methods, please first enable them in your business payment settings.`
        }
        
        console.log('[Assistants POC] Payment methods updated successfully')
        return successMessage
      }

      return `Unknown function: ${name}`
    }

    // Use streaming response to prevent timeouts
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let runStatus = run
          let attempts = 0
          
          while (true) {
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id)
            
            console.log('[Assistants POC] Run status:', runStatus.status)

            if (runStatus.status === 'completed') {
              // Get final messages
              const messages = await openai.beta.threads.messages.list(thread.id)
              const assistantMessage = messages.data
                .filter(msg => msg.role === 'assistant')
                .map(msg => {
                  const textContent = msg.content.find(c => c.type === 'text')
                  return textContent ? textContent.text.value : ''
                })[0] || 'No response generated'

              // Return JSON response compatible with current app
              const response = JSON.stringify({
                success: true,
                content: assistantMessage,
                attachments: attachments,
                messages: [
                  { id: `user-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString() },
                  { id: `assistant-${Date.now()}`, role: 'assistant', content: assistantMessage, attachments: attachments, created_at: new Date().toISOString() }
                ],
                thread: { id: thread.id, user_id: user_id }
              })
              
              controller.enqueue(new TextEncoder().encode(response))
              controller.close()
              break
            }

            if (runStatus.status === 'requires_action') {
              console.log('[Assistants POC] Requires action - handling tool calls')
              
              const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || []
              const toolOutputs = []

              for (const toolCall of toolCalls) {
                const output = await handleToolCall(toolCall)
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: output
                })
              }

              console.log('[Assistants POC] Submitting tool outputs:', toolOutputs.length)

              await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                tool_outputs: toolOutputs
              })

              continue
            }

            if (runStatus.status === 'failed') {
              throw new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`)
            }

            if (runStatus.status === 'cancelled') {
              throw new Error('Run was cancelled')
            }

            // Optimized polling with exponential backoff
            const delays = [100, 200, 500, 1000, 1000] // Start fast, then slow
            const attempt = Math.min(attempts, delays.length - 1)
            await new Promise(resolve => setTimeout(resolve, delays[attempt] || 1000))
            attempts++
          }
        } catch (error) {
          console.error('[Assistants POC] Stream error:', error)
          controller.error(error)
        }
      }
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('[Assistants POC] Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
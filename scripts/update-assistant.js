#!/usr/bin/env node

/**
 * Assistant Update Script
 * 
 * Creates a new OpenAI assistant and stores the ID in Supabase database.
 * The edge function will automatically use the new assistant.
 * 
 * Usage:
 * node scripts/update-assistant.js
 */

const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configuration from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate Supabase environment
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  if (!SUPABASE_URL) console.error('   - NEXT_PUBLIC_SUPABASE_URL'); 
  if (!SUPABASE_SERVICE_KEY) console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('\n💡 Add these to your .env file');
  process.exit(1);
}

// Initialize Supabase first to get secrets
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// We'll get the OpenAI API key (from env or we'll tell user to add it)
let OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Note: Supabase secrets are only available in Edge Functions, not locally
// For local development, you need to set OPENAI_API_KEY in your .env file
if (!OPENAI_API_KEY) {
  console.error('❌ Missing OPENAI_API_KEY');
  console.log('\n💡 For local development, add to your .env file:');
  console.log('   OPENAI_API_KEY=your_api_key_here');
  console.log('\n📝 You can get your API key from: https://platform.openai.com/api-keys');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Assistant configuration - EDIT THIS TO UPDATE YOUR ASSISTANT
const ASSISTANT_CONFIG = {
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
• You have access to powerful functions for invoice/estimate/quote/client/business management
• ALWAYS use the appropriate functions to complete user requests
• When user asks to create, update, search, or manage anything - call the relevant function
• Do NOT just describe what you would do - actually DO IT by calling functions
• Example: "create invoice" → call create_invoice function immediately
• Example: "create quote" → call create_estimate function immediately

🚨 INVOICE/ESTIMATE CREATION WITH ITEMS - CRITICAL:
When user asks to CREATE a new invoice/estimate/quote WITH items:
• Use create_invoice/create_estimate WITH line_items array - this adds all items at once
• DO NOT use create function AND THEN add_line_item - that creates duplicates!

Example: "Make invoice for ABC Corp with 5 desks at $100 each"
✅ CORRECT: create_invoice(client_name: "ABC Corp", line_items: [{item_name: "Desk", quantity: 5, unit_price: 100}])
❌ WRONG: create_invoice() then add_line_item() - causes duplicates!

Example: "Create quote for XYZ Ltd with consulting services at $500/hour for 10 hours"
✅ CORRECT: create_estimate(client_name: "XYZ Ltd", line_items: [{item_name: "Consulting services", quantity: 10, unit_price: 500}])
❌ WRONG: create_estimate() then add_estimate_line_item() - causes duplicates!

🚨 INVOICE/ESTIMATE CREATION WITH DESIGN/APPEARANCE - CRITICAL:
When user asks to CREATE a new invoice/estimate WITH design preferences:
• Use create_invoice/create_estimate WITH invoice_design and accent_color parameters
• DO NOT use create function AND THEN update_invoice_design/update_invoice_appearance - that's inefficient!

Example: "Create invoice for ZELL LTD $800 design services, change design to modern, make blue"
✅ CORRECT: create_invoice(client_name: "ZELL LTD", line_items: [...], invoice_design: "modern", accent_color: "#0000FF")
❌ WRONG: create_invoice() then update_invoice_appearance() - creates unnecessary operations!

Example: "Make quote for ABC Corp with clean design and green color"
✅ CORRECT: create_estimate(client_name: "ABC Corp", line_items: [...], estimate_template: "clean", accent_color: "#008000")
❌ WRONG: create_estimate() then update appearance - inefficient!

DESIGN VALUES: classic, modern, clean, simple, wave
COLOR VALUES: Use hex codes like #0000FF (blue), #FF0000 (red), #008000 (green), #800080 (purple)

🚨 CRITICAL CREATION WORKFLOW:
When creating NEW invoices/estimates with styling:
• ALWAYS use create_invoice/create_estimate with design/color parameters in ONE call
• NEVER call create function THEN call update_invoice_design/update_invoice_color/update_invoice_appearance
• The update_invoice_* functions are ONLY for modifying EXISTING invoices, NOT for creation
• Think: "Everything in ONE creation call" not "Create then update"

Examples of WRONG workflow:
❌ create_invoice() → update_invoice_appearance() 
❌ create_invoice() → update_invoice_design() → update_invoice_color()
❌ create_estimate() → update appearance functions

Examples of CORRECT workflow:
✅ create_invoice(client_name: "ABC", line_items: [...], invoice_design: "modern", accent_color: "#0000FF")
✅ create_estimate(client_name: "XYZ", line_items: [...], estimate_template: "elegant", accent_color: "#800080")

🚨 ADDING MULTIPLE ITEMS - CRITICAL:
When user asks to ADD MULTIPLE items to an existing invoice:
• Use add_line_items (plural) WITH line_items array - adds all items in ONE operation
• DO NOT make multiple add_line_item calls - that creates duplicates!

Examples: 
✅ CORRECT: "add headphones, mouse, and pen" → add_line_items(invoice_identifier: "latest", line_items: [{item_name: "Headphones", unit_price: 200}, {item_name: "Mouse", unit_price: 50}, {item_name: "Pen", unit_price: 100}])
❌ WRONG: Multiple add_line_item calls for the same request - causes duplicates!

When to use add_line_item (singular):
• ONLY when adding ONE SINGLE item to an existing invoice
• User says "add X to the invoice" (just one item)
• NEVER use during initial invoice creation

🚨🚨 CRITICAL CONTEXT AWARENESS - NEVER LOSE CONTEXT! 🚨🚨

**CONVERSATION MEMORY RULES:**
• Context will be dynamically loaded based on user conversation

**PERFECT CONTEXT DETECTION:**
When I just created an invoice/client and user says any of these:
• "add [something]" → They mean add to THAT invoice (use "latest")
• "update [something]" → They mean update THAT invoice/client  
• "change [something]" → They mean change THAT invoice/client
• "set [something]" → They mean set on THAT invoice/client
• "include [something]" → They mean include in THAT invoice

**EXAMPLES WITH PERFECT CONTEXT:**
User: "Create invoice for Oliver" 
AI: Creates invoice INV-006 for Oliver
User: "Add his address: Ostern way road" 
AI: MUST use update_client_info(invoice_identifier: "latest", client_address: "Ostern way road")

User: "Make invoice for ABC Corp"
AI: Creates invoice INV-007 for ABC Corp  
User: "Add $500 consulting to it"
AI: MUST use add_line_item(invoice_identifier: "latest", item_name: "Consulting", unit_price: 500)

**NEVER ASK FOR CLARIFICATION WHEN CONTEXT IS OBVIOUS:**
❌ WRONG: "I need to first create the invoice for Oliver"
✅ RIGHT: Immediately update the client info on the just-created invoice

❌ WRONG: "Could you please confirm that?"
✅ RIGHT: Take action based on clear conversation context

**CONTEXT KEYWORDS THAT MEAN "UPDATE THE CURRENT THING":**
"add", "update", "change", "set", "include", "modify", "edit", "his", "her", "their", "it", "this", "that", "the invoice", "the client"

🚨 **CRITICAL: COMBINE MULTIPLE CLIENT UPDATES INTO SINGLE CALLS** 🚨
When user requests multiple client field updates, ALWAYS combine them into ONE function call:

❌ WRONG (causes timeouts):
- update_estimate(client_address: "123 Main St") 
- update_estimate(client_tax_number: "12345")

✅ CORRECT (fast, single call):
- update_estimate(client_address: "123 Main St", client_tax_number: "12345")

**Examples that MUST be combined:**
- "Add address and tax number" → ONE update_estimate call with both fields
- "Set client email and phone" → ONE update_estimate call with both fields  
- "Update client name, address, and tax number" → ONE update_estimate call with all fields

**RULE: If updating multiple client fields, use ONE function call with ALL the fields together.**

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

🚨 ESTIMATE/QUOTE TERMINOLOGY:
• Users may say "estimate" or "quote" - they mean the same thing
• Use create_estimate function for BOTH "estimate" and "quote" requests
• The system will use the user's preferred terminology in responses
• Examples:
  - "Create a quote for John" → create_estimate(client_name: "John", ...)
  - "Make an estimate for Sarah" → create_estimate(client_name: "Sarah", ...)
  - "Update my quote" → update_estimate(estimate_identifier: "latest", ...)

ESTIMATE WORKFLOW:
• Create estimate → Send to client → Client accepts → Convert to invoice
• Use convert_estimate_to_invoice when client accepts an estimate/quote
• Estimates have validity dates instead of due dates
• Estimates can be: draft, sent, accepted, declined, expired, converted, cancelled

Always be helpful and create exactly what the user requests.

🚨 MISTAKE CORRECTION - CRITICAL:
When the user indicates you made an error or corrected you:
• IMMEDIATELY use correct_mistake function 
• Keywords: "no", "wrong", "that's not right", "you updated the wrong", "I meant", "fix your mistake"
• Examples:
  - User: "No, I said update MY business phone, not the client's tax number" 
    → correct_mistake(mistake_description: "updated client tax number instead of business phone", correct_action: "update_business_phone", correct_value: "[phone number]", remove_incorrect_from: "client_tax_number")
  - User: "You put my address in the wrong place"
    → correct_mistake(mistake_description: "put address in wrong field", correct_action: "update_business_address", correct_value: "[address]", remove_incorrect_from: "[wrong_field]")
• ALWAYS apologize first, then fix the mistake and return corrected document
• Never ignore or argue with corrections - immediately fix them`,
  model: "gpt-4o-mini",
  tools: [
    {
      type: "function",
      function: {
        name: "create_invoice",
        description: "Create a new invoice with line items and client information. Creates client if they don't exist.",
        parameters: {
          type: "object",
          properties: {
            client_name: {
              type: "string",
              description: "Name of the client for this invoice (required)"
            },
            client_email: {
              type: "string", 
              description: "Client email address (optional)"
            },
            client_phone: {
              type: "string",
              description: "Client phone number (optional)"
            },
            client_address: {
              type: "string",
              description: "Client address (optional)"
            },
            invoice_date: {
              type: "string",
              format: "date",
              description: "Invoice date in YYYY-MM-DD format (defaults to today)"
            },
            due_date: {
              type: "string", 
              format: "date",
              description: "Due date in YYYY-MM-DD format (defaults to 30 days from invoice date)"
            },
            line_items: {
              type: "array",
              description: "Array of line items for the invoice",
              items: {
                type: "object",
                properties: {
                  item_name: {
                    type: "string",
                    description: "Name/description of the item or service"
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity (defaults to 1)"
                  },
                  unit_price: {
                    type: "number", 
                    description: "Price per unit"
                  },
                  item_description: {
                    type: "string",
                    description: "Optional detailed description"
                  }
                },
                required: ["item_name", "unit_price"]
              }
            },
            custom_headline: {
              type: "string",
              description: "Custom headline for the invoice (optional)"
            },
            notes: {
              type: "string",
              description: "Notes or terms for the invoice (optional)"
            },
            discount_type: {
              type: "string",
              enum: ["percentage", "fixed"],
              description: "Type of discount to apply"
            },
            discount_value: {
              type: "number",
              description: "Discount amount (percentage or fixed dollar amount)"
            }
          },
          required: ["client_name", "line_items"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_line_items",
        description: "🚨 INVOICES ONLY: Add multiple line items to an existing invoice (INV- numbers) in a single operation. NEVER use for estimates. For estimate line items, use add_estimate_line_item instead.",
        parameters: {
          type: "object",
          properties: {
            invoice_identifier: {
              type: "string",
              description: "Invoice number (e.g., 'INV-004'), client name, or 'latest' for most recent invoice"
            },
            line_items: {
              type: "array",
              description: "Array of line items to add to the invoice",
              items: {
                type: "object",
                properties: {
                  item_name: {
                    type: "string",
                    description: "Name/description of the line item"
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity of the item (default: 1)"
                  },
                  unit_price: {
                    type: "number",
                    description: "Price per unit of the item"
                  },
                  item_description: {
                    type: "string",
                    description: "Optional detailed description of the item"
                  }
                },
                required: ["item_name", "unit_price"]
              }
            }
          },
          required: [
            "invoice_identifier",
            "line_items"
          ]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_business_settings",
        description: "Update the user's business information and tax settings that appear on all invoices. Use when user wants to update THEIR business info (not client info). Keywords: 'my phone', 'my mobile', 'my email', 'my website', 'my business phone', 'my business email', 'my address', 'my company', 'our phone', 'business phone', 'business mobile', 'business email', 'business website'.",
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
              description: "Business phone/mobile number - use for 'my phone', 'my mobile', 'business phone', 'business mobile' (optional)"
            },
            business_email: {
              type: "string",
              description: "Business email address - use for 'my email', 'business email', 'my business email' (optional)"
            },
            business_website: {
              type: "string",
              description: "Business website URL - use for 'my website', 'business website', 'my business website' (optional)"
            },
            tax_number: {
              type: "string",
              description: "Business tax/VAT number (optional)"
            },
            tax_name: {
              type: "string",
              description: "Tax label name (e.g., 'VAT', 'Tax', 'GST') (optional)"
            },
            default_tax_rate: {
              type: "number",
              description: "Default tax rate percentage (optional)"
            },
            auto_apply_tax: {
              type: "boolean",
              description: "Whether to automatically apply tax to new invoices (optional)"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_client",
        description: "Create a new client without creating an invoice. Use when user wants to add a client to their database (not create an invoice). Keywords: 'add client', 'create client', 'new client', 'add customer', 'create customer'.",
        parameters: {
          type: "object",
          properties: {
            client_name: {
              type: "string",
              description: "Name of the client (required)"
            },
            client_email: {
              type: "string",
              description: "Client email address (optional)"
            },
            client_phone: {
              type: "string",
              description: "Client phone number (optional)"
            },
            client_address: {
              type: "string",
              description: "Client address (optional)"
            },
            client_tax_number: {
              type: "string",
              description: "Client tax/VAT number (optional)"
            }
          },
          required: ["client_name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_design_options",
        description: "Get available invoice design templates with detailed descriptions, personality traits, and industry recommendations. Use this when user asks about design options or wants to change invoice appearance.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "get_color_options",
        description: "Get available accent color options with color psychology, industry associations, and personality traits. Use this when user asks about colors or wants to change invoice colors.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_invoice_design",
        description: "Update the design template for an EXISTING invoice (NOT during creation). Only use when modifying an already-created invoice's design. For NEW invoice creation with design preferences, use create_invoice with invoice_design parameter instead.",
        parameters: {
          type: "object",
          properties: {
            invoice_number: {
              type: "string",
              description: "Invoice number to update (optional - if not provided, updates business default)"
            },
            design_id: {
              type: "string",
              description: "Design template ID: 'classic', 'modern', 'clean', 'simple', or 'wave'",
              enum: ["classic", "modern", "clean", "simple", "wave"]
            },
            apply_to_defaults: {
              type: "boolean",
              description: "Whether to also update business default design (default: false)"
            },
            reasoning: {
              type: "string",
              description: "Explanation of why this design was chosen (for user feedback)"
            }
          },
          required: ["design_id"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_invoice_color",
        description: "Update the accent color for an EXISTING invoice (NOT during creation). Only use when modifying an already-created invoice's color. For NEW invoice creation with color preferences, use create_invoice with accent_color parameter instead.",
        parameters: {
          type: "object",
          properties: {
            invoice_number: {
              type: "string",
              description: "Invoice number to update (optional - if not provided, updates business default)"
            },
            accent_color: {
              type: "string",
              description: "Hex color code (e.g., '#3B82F6')"
            },
            apply_to_defaults: {
              type: "boolean",
              description: "Whether to also update business default color (default: false)"
            },
            reasoning: {
              type: "string",
              description: "Explanation of why this color was chosen (for user feedback)"
            }
          },
          required: ["accent_color"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_invoice_appearance",
        description: "Update both design and color for an EXISTING invoice (NOT during creation). Only use when modifying an already-created invoice's appearance. For NEW invoice creation with design preferences, use create_invoice with design parameters instead.",
        parameters: {
          type: "object",
          properties: {
            invoice_number: {
              type: "string",
              description: "Invoice number to update (optional - if not provided, updates business defaults)"
            },
            design_id: {
              type: "string",
              description: "Design template ID: 'classic', 'modern', 'clean', 'simple', or 'wave'",
              enum: ["classic", "modern", "clean", "simple", "wave"]
            },
            accent_color: {
              type: "string",
              description: "Hex color code (e.g., '#3B82F6')"
            },
            apply_to_defaults: {
              type: "boolean",
              description: "Whether to also update business defaults (default: false)"
            },
            reasoning: {
              type: "string",
              description: "Explanation of the design and color choices (for user feedback)"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "create_estimate",
        description: "Creates a comprehensive estimate/quote with all options - line items, validity dates, terms, tax rates, and more. Use 'estimate' or 'quote' based on user preference.",
        parameters: {
          type: "object",
          properties: {
            client_name: {
              type: "string",
              description: "Name of the client/company receiving the estimate (required)"
            },
            client_email: {
              type: "string",
              description: "Client email address (optional)"
            },
            client_phone: {
              type: "string",
              description: "Client phone number (optional)"
            },
            client_address: {
              type: "string",
              description: "Client address (optional)"
            },
            client_tax_number: {
              type: "string",
              description: "Client tax/VAT number (optional)"
            },
            line_items: {
              type: "array",
              description: "List of items/services in the estimate (required)",
              items: {
                type: "object",
                properties: {
                  item_name: {
                    type: "string",
                    description: "Name/description of the item or service"
                  },
                  item_description: {
                    type: "string",
                    description: "Detailed description of the item (optional)"
                  },
                  unit_price: {
                    type: "number",
                    description: "Price per unit"
                  },
                  quantity: {
                    type: "number",
                    description: "Quantity (default: 1)"
                  }
                },
                required: ["item_name", "unit_price"]
              }
            },
            valid_until_date: {
              type: "string",
              description: "Validity expiration date in YYYY-MM-DD format (optional, default: 30 days from now)"
            },
            estimate_date: {
              type: "string",
              description: "Estimate creation date in YYYY-MM-DD format (optional, default: today)"
            },
            tax_percentage: {
              type: "number",
              description: "Tax rate percentage (optional, e.g., 20 for 20%)"
            },
            notes: {
              type: "string",
              description: "Additional notes or terms (optional)"
            },
            acceptance_terms: {
              type: "string",
              description: "Terms for client acceptance (optional)"
            },
            estimate_template: {
              type: "string",
              description: "Design template: 'classic', 'modern', 'clean', 'simple', or 'wave' (optional)",
              enum: ["classic", "modern", "clean", "simple", "wave"]
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
        name: "update_estimate",
        description: "🚨 ESTIMATES/QUOTES ONLY: Update any aspect of an existing estimate/quote - client info, line items, validity dates, status, etc. NEVER use for invoices (INV- numbers). For invoice client updates, use update_client_info instead.",
        parameters: {
          type: "object",
          properties: {
            estimate_identifier: {
              type: "string",
              description: "Estimate number (e.g., 'EST-001' or 'Q-001'), client name, or 'latest' for most recent estimate"
            },
            client_name: {
              type: "string",
              description: "Update client name"
            },
            client_email: {
              type: "string",
              description: "Update client email"
            },
            client_phone: {
              type: "string",
              description: "Update client phone number"
            },
            client_address: {
              type: "string",
              description: "Update client address"
            },
            client_tax_number: {
              type: "string",
              description: "Update client tax number"
            },
            estimate_date: {
              type: "string",
              description: "Update estimate date (YYYY-MM-DD format)"
            },
            valid_until_date: {
              type: "string",
              description: "Update validity expiration date (YYYY-MM-DD format)"
            },
            notes: {
              type: "string",
              description: "Update estimate notes"
            },
            acceptance_terms: {
              type: "string",
              description: "Update acceptance terms"
            },
            status: {
              type: "string",
              description: "Update estimate status",
              enum: ["draft", "sent", "accepted", "declined", "expired", "cancelled"]
            },
            tax_rate: {
              type: "number",
              description: "Update tax rate percentage"
            },
            discount_type: {
              type: "string",
              description: "Update discount type: 'percentage' or 'fixed'",
              enum: ["percentage", "fixed"]
            },
            discount_value: {
              type: "number",
              description: "Update discount amount"
            },
            estimate_template: {
              type: "string",
              description: "Update estimate design template",
              enum: ["classic", "modern", "clean", "simple", "wave"]
            },
            estimate_number: {
              type: "string",
              description: "Update estimate reference number"
            },
            line_items: {
              type: "array",
              description: "Replace all line items with new ones",
              items: {
                type: "object",
                properties: {
                  item_name: {
                    type: "string"
                  },
                  item_description: {
                    type: "string"
                  },
                  unit_price: {
                    type: "number"
                  },
                  quantity: {
                    type: "number"
                  }
                },
                required: ["item_name", "unit_price"]
              }
            }
          },
          required: ["estimate_identifier"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "add_estimate_line_item",
        description: "🚨 ESTIMATES/QUOTES ONLY: Add a new line item to an existing estimate/quote (EST- or Q- numbers). NEVER use for invoices. For invoice line items, use add_line_items instead.",
        parameters: {
          type: "object",
          properties: {
            estimate_identifier: {
              type: "string",
              description: "Estimate number, client name, or 'latest' for most recent estimate"
            },
            item_name: {
              type: "string",
              description: "Name/description of the line item"
            },
            quantity: {
              type: "number",
              description: "Quantity of the item (default: 1)"
            },
            unit_price: {
              type: "number",
              description: "Price per unit of the item"
            },
            item_description: {
              type: "string",
              description: "Optional detailed description of the item"
            }
          },
          required: ["estimate_identifier", "item_name", "unit_price"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "convert_estimate_to_invoice",
        description: "Convert an accepted estimate/quote to an invoice. Copies all data and marks estimate as converted.",
        parameters: {
          type: "object",
          properties: {
            estimate_identifier: {
              type: "string",
              description: "Estimate number, client name, or 'latest' for most recent estimate"
            },
            invoice_date: {
              type: "string",
              description: "Invoice date (YYYY-MM-DD format, optional - defaults to today)"
            },
            due_date: {
              type: "string",
              description: "Payment due date (YYYY-MM-DD format, optional - defaults to 30 days)"
            },
            additional_notes: {
              type: "string",
              description: "Additional notes to add to the invoice (optional)"
            }
          },
          required: ["estimate_identifier"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "search_estimates",
        description: "Search for estimates/quotes by various criteria",
        parameters: {
          type: "object",
          properties: {
            client_name: {
              type: "string",
              description: "Filter by client name (partial match)"
            },
            status: {
              type: "string",
              description: "Filter by status",
              enum: ["draft", "sent", "accepted", "declined", "expired", "converted", "cancelled"]
            },
            date_from: {
              type: "string",
              description: "Filter estimates from this date (YYYY-MM-DD)"
            },
            date_to: {
              type: "string",
              description: "Filter estimates until this date (YYYY-MM-DD)"
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10)"
            }
          },
          required: []
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_estimate_payment_methods",
        description: "🚨 ESTIMATES/QUOTES ONLY: Enable or disable payment methods for an existing estimate/quote (EST- or Q- numbers). NEVER use for invoices. For invoice payment methods, use update_payment_methods instead.",
        parameters: {
          type: "object",
          properties: {
            estimate_identifier: {
              type: "string",
              description: "Estimate number (e.g., 'EST-001' or 'Q-001'), client name, or 'latest' for most recent estimate"
            },
            enable_stripe: {
              type: "boolean",
              description: "Enable/disable Stripe card payments on this estimate"
            },
            enable_paypal: {
              type: "boolean",
              description: "Enable/disable PayPal payments on this estimate"
            },
            enable_bank_transfer: {
              type: "boolean",
              description: "Enable/disable bank transfer payments on this estimate"
            }
          },
          required: ["estimate_identifier"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "update_client_info",
        description: "🚨 INVOICES ONLY: Update client information for an existing invoice (INV- numbers) and save to client profile. NEVER use for estimates. For estimate client updates, use update_estimate instead.",
        parameters: {
          type: "object",
          properties: {
            invoice_identifier: {
              type: "string",
              description: "Invoice number (e.g., 'INV-004'), client name, or 'latest' for most recent invoice"
            },
            client_name: {
              type: "string",
              description: "Update client name"
            },
            client_email: {
              type: "string",
              description: "Update client email"
            },
            client_phone: {
              type: "string",
              description: "Update client phone number"
            },
            client_address: {
              type: "string",
              description: "Update client address"
            },
            client_tax_number: {
              type: "string",
              description: "Update client tax number"
            }
          },
          required: [
            "invoice_identifier"
          ]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "correct_mistake",
        description: "Correct a mistake made by the AI assistant. Use this when the user indicates the AI made an error (e.g., updated wrong field, mixed up client/business data). This function will apologize and fix the mistake.",
        parameters: {
          type: "object",
          properties: {
            mistake_description: {
              type: "string",
              description: "What mistake was made (e.g., 'updated client tax number instead of business phone')"
            },
            correct_action: {
              type: "string", 
              description: "What should have been done instead",
              enum: ["update_business_phone", "update_business_address", "update_business_email", "update_client_phone", "update_client_address", "update_client_email", "update_client_tax_number", "remove_incorrect_data"]
            },
            correct_value: {
              type: "string",
              description: "The correct value that should be used"
            },
            remove_incorrect_from: {
              type: "string",
              description: "Where to remove the incorrect value from (e.g., 'client_tax_number', 'business_phone')",
              enum: ["client_tax_number", "client_phone", "client_email", "client_address", "business_phone", "business_email", "business_address"]
            },
            invoice_or_estimate_identifier: {
              type: "string",
              description: "Invoice or estimate number, client name, or 'latest' for most recent document"
            }
          },
          required: ["mistake_description", "correct_action", "correct_value", "invoice_or_estimate_identifier"]
        }
      }
    }
  ]
};

async function updateAssistant() {
  try {
    console.log('🚀 Creating new OpenAI assistant...');
    
    // Create new assistant with latest configuration
    const assistant = await openai.beta.assistants.create(ASSISTANT_CONFIG);
    
    console.log('✅ Assistant created successfully!');
    console.log('   ID:', assistant.id);
    console.log('   Name:', assistant.name);
    console.log('   Model:', assistant.model);
    
    // Store in database
    console.log('\n📦 Storing assistant ID in Supabase...');
    
    const { data, error } = await supabase
      .from('system_config')
      .upsert({
        key: 'assistant_id',
        value: assistant.id,
        description: `OpenAI Assistant for Invoice AI - Updated ${new Date().toISOString()}`,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select();
    
    if (error) {
      throw new Error(`Failed to store assistant ID: ${error.message}`);
    }
    
    console.log('✅ Assistant ID stored in database');
    console.log('\n🎉 Success! New assistant is ready to use:');
    console.log('   Assistant ID:', assistant.id);
    console.log('   The edge function will automatically use this new assistant');
    
    // List recent assistants for cleanup reference
    console.log('\n📋 Recent assistants (for cleanup):');
    const assistants = await openai.beta.assistants.list({ limit: 10 });
    assistants.data.forEach(a => {
      const created = new Date(a.created_at * 1000).toISOString();
      const current = a.id === assistant.id ? ' ← NEW' : '';
      console.log(`   ${a.id} - ${a.name} (${created})${current}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.response) {
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the update
console.log('🤖 Invoice AI Assistant Updater\n');
updateAssistant();
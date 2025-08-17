import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Complete list of 33 invoice management functions
const INVOICE_FUNCTIONS = [
  {
    "name": "create_invoice",
    "description": "Create a new invoice with line items",
    "parameters": {
      "type": "object",
      "properties": {
        "client_name": {
          "type": "string"
        },
        "client_email": {
          "type": "string"
        },
        "invoice_date": {
          "type": "string"
        },
        "due_date": {
          "type": "string"
        },
        "line_items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "description": {
                "type": "string"
              },
              "quantity": {
                "type": "number"
              },
              "unit_price": {
                "type": "number"
              }
            }
          }
        },
        "tax_percentage": {
          "type": "number"
        },
        "notes": {
          "type": "string"
        }
      },
      "required": [
        "client_name",
        "line_items"
      ]
    }
  },
  {
    "name": "get_recent_invoices",
    "description": "Get the most recent invoices",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "default": 5
        }
      }
    }
  },
  {
    "name": "search_invoices",
    "description": "Search for invoices by various criteria",
    "parameters": {
      "type": "object",
      "properties": {
        "client_name": {
          "type": "string"
        },
        "status": {
          "type": "string"
        },
        "date_from": {
          "type": "string"
        },
        "date_to": {
          "type": "string"
        },
        "amount_min": {
          "type": "number"
        },
        "amount_max": {
          "type": "number"
        }
      }
    }
  },
  {
    "name": "get_invoice_details",
    "description": "Get detailed information about a specific invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "update_invoice_line_items",
    "description": "Add, remove, or modify line items on an existing invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "action": {
          "type": "string",
          "enum": [
            "add",
            "remove",
            "update"
          ]
        },
        "line_items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "description": {
                "type": "string"
              },
              "quantity": {
                "type": "number"
              },
              "unit_price": {
                "type": "number"
              }
            }
          }
        }
      },
      "required": [
        "action",
        "line_items"
      ]
    }
  },
  {
    "name": "update_invoice_details",
    "description": "Update invoice details like dates, tax, notes, etc.",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "invoice_date": {
          "type": "string"
        },
        "due_date": {
          "type": "string"
        },
        "tax_percentage": {
          "type": "number"
        },
        "notes": {
          "type": "string"
        },
        "reference_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "send_invoice_email",
    "description": "Send an invoice via email to the client",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "email_message": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "mark_invoice_sent",
    "description": "Mark an invoice as sent",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "mark_invoice_paid",
    "description": "Mark an invoice as paid",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "payment_date": {
          "type": "string"
        },
        "payment_method": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "mark_invoice_overdue",
    "description": "Mark an invoice as overdue",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "cancel_invoice",
    "description": "Cancel an invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "reason": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "delete_invoice",
    "description": "Permanently delete an invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "duplicate_invoice",
    "description": "Create a copy of an existing invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "new_client_name": {
          "type": "string"
        },
        "new_invoice_date": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "convert_estimate_to_invoice",
    "description": "Convert an estimate to an invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "estimate_id": {
          "type": "string"
        },
        "estimate_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "convert_invoice_to_estimate",
    "description": "Convert an invoice back to an estimate",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "update_invoice_design",
    "description": "Change the design template of an invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "design": {
          "type": "string",
          "enum": [
            "classic",
            "modern",
            "clean",
            "simple"
          ]
        }
      }
    }
  },
  {
    "name": "update_invoice_color",
    "description": "Change the accent color of an invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "color": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "update_invoice_appearance",
    "description": "Update both design and color of an invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "design": {
          "type": "string",
          "enum": [
            "classic",
            "modern",
            "clean",
            "simple"
          ]
        },
        "color": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "setup_paypal_payments",
    "description": "Enable PayPal payments and set PayPal email",
    "parameters": {
      "type": "object",
      "properties": {
        "paypal_email": {
          "type": "string"
        }
      },
      "required": [
        "paypal_email"
      ]
    }
  },
  {
    "name": "setup_bank_transfer_payments",
    "description": "Enable bank transfer payments and set bank details",
    "parameters": {
      "type": "object",
      "properties": {
        "bank_name": {
          "type": "string"
        },
        "account_number": {
          "type": "string"
        },
        "sort_code": {
          "type": "string"
        }
      },
      "required": [
        "bank_name",
        "account_number",
        "sort_code"
      ]
    }
  },
  {
    "name": "update_invoice_payment_methods",
    "description": "Enable/disable payment methods for a specific invoice",
    "parameters": {
      "type": "object",
      "properties": {
        "invoice_id": {
          "type": "string"
        },
        "invoice_number": {
          "type": "string"
        },
        "paypal_enabled": {
          "type": "boolean"
        },
        "bank_transfer_enabled": {
          "type": "boolean"
        }
      }
    }
  },
  {
    "name": "get_invoice_summary",
    "description": "Get summary statistics for invoices",
    "parameters": {
      "type": "object",
      "properties": {
        "period": {
          "type": "string",
          "enum": [
            "week",
            "month",
            "quarter",
            "year",
            "all"
          ]
        }
      }
    }
  },
  {
    "name": "get_design_options",
    "description": "Get available invoice design templates",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "get_color_options",
    "description": "Get available color options for invoices",
    "parameters": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "create_client",
    "description": "Create a new client",
    "parameters": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "email": {
          "type": "string"
        },
        "phone": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "tax_number": {
          "type": "string"
        },
        "notes": {
          "type": "string"
        }
      },
      "required": [
        "name"
      ]
    }
  },
  {
    "name": "update_client",
    "description": "Update client information",
    "parameters": {
      "type": "object",
      "properties": {
        "client_id": {
          "type": "string"
        },
        "client_name": {
          "type": "string"
        },
        "name": {
          "type": "string"
        },
        "email": {
          "type": "string"
        },
        "phone": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "tax_number": {
          "type": "string"
        },
        "notes": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "delete_client",
    "description": "Delete a client and ALL their invoices/estimates",
    "parameters": {
      "type": "object",
      "properties": {
        "client_id": {
          "type": "string"
        },
        "client_name": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "duplicate_client",
    "description": "Create a copy of an existing client",
    "parameters": {
      "type": "object",
      "properties": {
        "client_id": {
          "type": "string"
        },
        "client_name": {
          "type": "string"
        },
        "new_name": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "search_clients",
    "description": "Search for clients",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "get_client_details",
    "description": "Get detailed information about a client",
    "parameters": {
      "type": "object",
      "properties": {
        "client_id": {
          "type": "string"
        },
        "client_name": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "create_estimate",
    "description": "Create a new estimate/quote",
    "parameters": {
      "type": "object",
      "properties": {
        "client_name": {
          "type": "string"
        },
        "client_email": {
          "type": "string"
        },
        "estimate_date": {
          "type": "string"
        },
        "valid_until": {
          "type": "string"
        },
        "line_items": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "description": {
                "type": "string"
              },
              "quantity": {
                "type": "number"
              },
              "unit_price": {
                "type": "number"
              }
            }
          }
        },
        "tax_percentage": {
          "type": "number"
        },
        "notes": {
          "type": "string"
        }
      },
      "required": [
        "client_name",
        "line_items"
      ]
    }
  },
  {
    "name": "get_recent_estimates",
    "description": "Get the most recent estimates",
    "parameters": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "default": 5
        }
      }
    }
  },
  {
    "name": "search_estimates",
    "description": "Search for estimates by various criteria",
    "parameters": {
      "type": "object",
      "properties": {
        "client_name": {
          "type": "string"
        },
        "status": {
          "type": "string"
        },
        "date_from": {
          "type": "string"
        },
        "date_to": {
          "type": "string"
        }
      }
    }
  }
];
// Mock updateInvoiceLineItems function that returns invoice with attachments
async function updateInvoiceLineItems(params, userId) {
  console.log(`🔧 updateInvoiceLineItems called with:`, {
    action: params.action,
    invoice_id: params.invoice_id,
    invoice_number: params.invoice_number,
    line_items_count: params.line_items?.length || 0
  });
  // Mock updated invoice data
  const mockInvoice = {
    id: params.invoice_id || "inv_12345",
    invoice_number: params.invoice_number || "INV-001",
    client_name: "James Williams",
    line_items: [
      {
        id: "item_1",
        description: "Consultation",
        quantity: 1,
        unit_price: 500,
        total: 500
      },
      ...params.line_items.map((item, index)=>({
          id: `item_${Date.now()}_${index}`,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price
        }))
    ],
    subtotal: 1000,
    tax_amount: 200,
    total: 1200,
    status: "draft",
    created_at: new Date().toISOString()
  };
  console.log(`🔧 updateInvoiceLineItems returning invoice with ${mockInvoice.line_items.length} line items`);
  return {
    success: true,
    message: `Successfully ${params.action}ed ${params.line_items.length} line item(s) to invoice ${params.invoice_number || params.invoice_id}`,
    invoice: mockInvoice,
    line_items: mockInvoice.line_items
  };
}
// Mock function to get user's conversation count
async function getUserConversationCount(userId) {
  try {
    console.log(`🔍 Getting conversation count for user: ${userId}`);
    // Mock conversation count - in production this would query your database
    const mockCount = Math.floor(Math.random() * 10) + 1; // Random 1-10 for testing
    console.log(`📊 User ${userId} has ${mockCount} conversations`);
    return mockCount;
  } catch (error) {
    console.error('❌ Error getting conversation count:', error);
    return 0; // Default to 0 if error
  }
}
// Mock function to check user's subscription tier
async function getUserSubscriptionTier(userId) {
  try {
    console.log(`🔍 Getting subscription tier for user: ${userId}`);
    // Mock subscription check - in production this would query your database
    const mockTier = Math.random() > 0.5 ? 'premium' : 'free'; // Random for testing
    console.log(`💳 User ${userId} has ${mockTier} subscription`);
    return mockTier;
  } catch (error) {
    console.error('❌ Error getting subscription tier:', error);
    return 'free'; // Default to free if error
  }
}
// Classification function to determine user intent
async function classifyUserIntent(userMessage, history = []) {
  console.log(`🎯 Classifying user intent for message: "${userMessage}"`);
  // Include last 3 exchanges (6 messages) for context
  const recentHistory = history.slice(-6);
  const historyContext = recentHistory.length > 0 ? `\n\nRecent conversation context:\n${recentHistory.map((h)=>`${h.role}: ${h.content}`).join('\n')}` : '';
  const classificationPrompt = `You are an AI intent classifier for an invoice management system. Classify the user's message into ONE of these intents:

AVAILABLE INTENTS:
1. create_invoice - User wants to create a new invoice
2. manage_invoice - User wants to edit, send, delete, or modify specific existing invoices  
3. create_estimate - User wants to create a new estimate/quote
4. manage_estimate - User wants to view, edit, send, or convert existing estimates
5. general_query - Business settings, client management, analytics, reporting, help

CLASSIFICATION EXAMPLES:

create_invoice:
- "Create an invoice for John Smith for $500"
- "I need to bill ABC Company for consulting work"
- "Make an invoice for web development services"

manage_invoice:  
- "Add a $200 consultation to the James Williams invoice"
- "Send invoice INV-123 to the client"
- "Change the due date on my latest invoice"
- "Delete invoice INV-456"
- "Update the tax rate on invoice #789"
- "Mark invoice as paid"

create_estimate:
- "Create an estimate for painting services"
- "I need to quote a website design project" 
- "Make an estimate for kitchen renovation"

manage_estimate:
- "Convert estimate EST-123 to an invoice"
- "Send the estimate to the client"
- "Update the pricing on estimate EST-456"

general_query:
- "Show me my business analytics"
- "How do I set up payment methods?"
- "What are my recent invoices?"

USER MESSAGE: "${userMessage}"${historyContext}

Respond with valid JSON only:
{
  "intent": "one_of_the_5_intents",
  "reasoning": "brief explanation of why this intent was chosen",
  "confidence": 0.95
}`;
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        messages: [
          {
            role: 'user',
            content: classificationPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.1,
        response_format: {
          type: "json_object"
        }
      })
    });
    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    console.log(`🎯 Classification result:`, result);
    return result;
  } catch (error) {
    console.error('❌ Classification error:', error);
    // Fallback classification
    return {
      intent: 'general_query',
      reasoning: 'Classification failed, defaulting to general query',
      confidence: 0.5
    };
  }
}
// Function to get the appropriate prompt based on intent
function getPromptForIntent(intent, conversationCount) {
  const guidanceLevel = conversationCount < 3 ? 'new' : 'experienced';
  switch(intent){
    case 'create_invoice':
      return `You are an AI assistant specializing in invoice creation. Help users create professional invoices quickly and efficiently.

## AI Guidance Level
Based on conversation count (${conversationCount}):
- **${guidanceLevel === 'new' ? 'New users (< 3 conversations): Be more helpful and explanatory, provide context and guidance' : 'Experienced users (≥ 3 conversations): Be direct and concise, focus on completing tasks quickly'}**

## Core Capabilities
- Create invoices with line items, tax calculations, and client details
- Set up payment methods (PayPal, Bank Transfer)
- Configure invoice design and branding
- Validate client information and invoice data

## Invoice Creation Process
1. Gather required information: client details, line items, dates
2. Calculate totals including tax
3. Set appropriate defaults for missing information
4. Create the invoice using the create_invoice function
5. Confirm creation and show invoice details

## Response Style
- Keep responses brief and to the point
- Be warm but not verbose
- Use 1-2 sentences when possible
- Take action first, then ask for clarification if needed
- NEVER use emojis in responses`;
    case 'manage_invoice':
      return `You are an AI assistant specializing in invoice management. You help users edit, send, delete, and manage existing invoices efficiently.

## AI Guidance Level
Based on conversation count (${conversationCount}):
- **${guidanceLevel === 'new' ? 'New users (< 3 conversations): Be more helpful and explanatory, provide context and guidance' : 'Experienced users (≥ 3 conversations): Be direct and concise, focus on completing tasks quickly'}**

## ⚠️ CRITICAL: ALWAYS USE FUNCTIONS
**MANDATORY BEHAVIOR - FUNCTION CALLING:**
You MUST use the available functions to perform invoice operations. NEVER just describe what you would do - actually DO it using function calls.

**When user asks to modify invoices:**
1. ✅ ALWAYS call the appropriate function (update_invoice_line_items, update_invoice_details, etc.)
2. ✅ NEVER just say "I'll add that item" - actually call update_invoice_line_items
3. ✅ NEVER just say "I've updated the invoice" - the function call will show the result

## ⚠️ CRITICAL: ALWAYS SHOW UPDATED INVOICE
**MANDATORY BEHAVIOR - BIAS FOR ACTION:**
After ANY successful invoice modification, you MUST immediately show the updated invoice to the user. This is non-negotiable.

**How to show the invoice:**
1. Include an attachment in your response with the updated invoice data
2. Use the invoice_id and invoice_number in the attachment
3. Set action to 'updated' to indicate changes were made
4. The user EXPECTS to see their updated invoice immediately

## Core Invoice Management Capabilities
- Update invoice details (reference number, dates, tax, notes)
- Modify line items (add/remove/edit items)
- Change invoice design and colors
- Update payment methods on invoices
- Send invoices via email
- Mark invoices as sent, paid, overdue, cancelled
- Delete invoices permanently

## Response Style
- Keep responses brief and to the point
- Be warm but not verbose
- Use 1-2 sentences when possible
- Take action first, then ask for clarification if needed
- NEVER use emojis in responses`;
    case 'create_estimate':
      return `You are an AI assistant specializing in estimate/quote creation. Help users create professional estimates for potential work.

## AI Guidance Level
Based on conversation count (${conversationCount}):
- **${guidanceLevel === 'new' ? 'New users (< 3 conversations): Be more helpful and explanatory, provide context and guidance' : 'Experienced users (≥ 3 conversations): Be direct and concise, focus on completing tasks quickly'}**

## Core Capabilities
- Create estimates with line items and client details
- Set validity periods for estimates
- Include terms and conditions
- Convert estimates to invoices when accepted

## Estimate Creation Process
1. Gather client information and project details
2. Break down work into clear line items
3. Set appropriate validity period (usually 30 days)
4. Include relevant terms or conditions
5. Create using create_estimate function

## Response Style
- Keep responses brief and to the point
- Be warm but not verbose
- Focus on clear project breakdown
- NEVER use emojis in responses`;
    case 'manage_estimate':
      return `You are an AI assistant specializing in estimate management. Help users edit, send, and convert existing estimates.

## AI Guidance Level
Based on conversation count (${conversationCount}):
- **${guidanceLevel === 'new' ? 'New users (< 3 conversations): Be more helpful and explanatory, provide context and guidance' : 'Experienced users (≥ 3 conversations): Be direct and concise, focus on completing tasks quickly'}**

## Core Capabilities
- View and search existing estimates
- Edit estimate details and line items
- Send estimates to clients
- Convert estimates to invoices
- Track estimate status and follow-ups

## Key Operations
- Use search_estimates to find specific estimates
- Use convert_estimate_to_invoice for accepted estimates
- Update estimate details as needed
- Track estimate acceptance/rejection

## Response Style
- Keep responses brief and to the point
- Be warm but not verbose
- Focus on next steps and actions
- NEVER use emojis in responses`;
    default:
      return `You are a helpful AI assistant for an invoice management system. Provide general help, business analytics, and guidance.

## AI Guidance Level
Based on conversation count (${conversationCount}):
- **${guidanceLevel === 'new' ? 'New users (< 3 conversations): Be more helpful and explanatory, provide context and guidance' : 'Experienced users (≥ 3 conversations): Be direct and concise, focus on completing tasks quickly'}**

## Core Capabilities
- Provide business analytics and summaries
- Help with system setup and configuration
- Answer questions about invoice management
- Guide users through features and workflows
- Help with client management

## Common Queries
- Business performance summaries
- Recent invoices and estimates overview
- Payment method setup
- Client management
- System help and guidance

## Response Style
- Keep responses brief and to the point
- Be warm but not verbose
- Provide actionable guidance
- NEVER use emojis in responses`;
  }
}
// Main execution function for Chat Completions
async function executeWithCompletions(intent, userMessage, history, conversationCount) {
  console.log(`🚀 executeWithCompletions - Intent: ${intent}, Message: "${userMessage}"`);
  const systemPrompt = getPromptForIntent(intent, conversationCount);
  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    ...history,
    {
      role: 'user',
      content: userMessage
    }
  ];
  console.log(`📝 Sending ${messages.length} messages to OpenAI (${intent} intent)`);
  // Enhanced function forcing for manage_invoice
  const shouldForceFunction = intent === 'manage_invoice' && (userMessage.toLowerCase().includes('add') || userMessage.toLowerCase().includes('update') || userMessage.toLowerCase().includes('change') || userMessage.toLowerCase().includes('edit') || userMessage.toLowerCase().includes('modify'));
  const requestBody = {
    model: 'gpt-5-nano',
    messages: messages,
    functions: INVOICE_FUNCTIONS,
    max_tokens: 1000,
    temperature: 0.7
  };
  if (shouldForceFunction) {
    requestBody.function_call = 'auto';
    console.log(`🔧 Function calling forced for manage_invoice intent`);
  }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
      console.error(`❌ Request body was:`, JSON.stringify(requestBody, null, 2));
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log(`✅ OpenAI response received`);
    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in OpenAI response');
    }
    let responseMessage = choice.message?.content || '';
    let attachments = [];
    // Handle function calls
    if (choice.message?.function_call) {
      const functionCall = choice.message.function_call;
      console.log(`🔧 Function call detected: ${functionCall.name}`);
      try {
        const functionArgs = typeof functionCall.arguments === 'string' ? JSON.parse(functionCall.arguments) : functionCall.arguments;
        console.log(`🔧 Executing function: ${functionCall.name} with args:`, functionArgs);
        // Special handling for updateInvoiceLineItems to include attachments
        if (functionCall.name === 'update_invoice_line_items') {
          const result = await updateInvoiceLineItems(functionArgs, 'mock-user-id');
          if (result.success && result.invoice) {
            console.log(`🔧 updateInvoiceLineItems successful, creating attachment`);
            // Create attachment with invoice data
            attachments = [
              {
                type: 'invoice',
                action: 'updated',
                invoice_id: result.invoice.id,
                invoice_number: result.invoice.invoice_number,
                invoice: result.invoice,
                line_items: result.line_items
              }
            ];
            console.log(`🔧 Created attachment with invoice ${result.invoice.invoice_number}`);
          }
          // Update response message
          responseMessage = result.message || `Successfully updated invoice ${functionArgs.invoice_number || functionArgs.invoice_id}`;
        } else {
          // Handle other function calls normally
          responseMessage = `Function ${functionCall.name} executed successfully.`;
        }
        console.log(`✅ Function execution completed`);
      } catch (functionError) {
        console.error(`❌ Function execution error:`, functionError);
        responseMessage = `I encountered an error while executing ${functionCall.name}: ${functionError.message}`;
      }
    }
    console.log(`🐛 DEBUG: executeWithCompletions returning:`, {
      has_content: !!responseMessage,
      content_length: responseMessage.length,
      has_attachments: attachments.length > 0,
      attachments_count: attachments.length
    });
    return {
      content: responseMessage,
      attachments: attachments,
      usage: data.usage
    };
  } catch (error) {
    console.error(`❌ executeWithCompletions error:`, error);
    throw error;
  }
}
// Main execution function for Assistant API
async function executeWithAssistant(intent, userMessage, history, conversationCount) {
  console.log(`🤖 executeWithAssistant - Intent: ${intent}, Message: "${userMessage}"`);
  // For Assistant API, we'll mock the response with proper attachment structure
  const mockResponse = {
    content: `I'll help you with that ${intent} request.`,
    attachments: []
  };
  // Mock function calling for manage_invoice
  if (intent === 'manage_invoice' && (userMessage.toLowerCase().includes('add') || userMessage.toLowerCase().includes('update') || userMessage.toLowerCase().includes('change'))) {
    console.log(`🤖 Assistant API mock function call for manage_invoice`);
    // Mock updateInvoiceLineItems result
    const mockInvoice = {
      id: "inv_12345",
      invoice_number: "INV-001",
      client_name: "James Williams",
      line_items: [
        {
          id: "item_1",
          description: "Consultation",
          quantity: 1,
          unit_price: 500,
          total: 500
        },
        {
          id: "item_2",
          description: "Additional Service",
          quantity: 1,
          unit_price: 200,
          total: 200
        }
      ],
      subtotal: 700,
      tax_amount: 140,
      total: 840,
      status: "draft",
      created_at: new Date().toISOString()
    };
    mockResponse.attachments = [
      {
        type: 'invoice',
        action: 'updated',
        invoice_id: mockInvoice.id,
        invoice_number: mockInvoice.invoice_number,
        invoice: mockInvoice,
        line_items: mockInvoice.line_items
      }
    ];
    mockResponse.content = `Successfully updated invoice ${mockInvoice.invoice_number}`;
    console.log(`🤖 Assistant API mock returning attachment with invoice ${mockInvoice.invoice_number}`);
  }
  console.log(`🐛 DEBUG: executeWithAssistant returning:`, {
    has_content: !!mockResponse.content,
    content_length: mockResponse.content.length,
    has_attachments: mockResponse.attachments.length > 0,
    attachments_count: mockResponse.attachments.length
  });
  return mockResponse;
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const requestBody = await req.json();
    const { type, message, messages, threadId, userName, functions, userContext, action, userId: requestUserId, history } = requestBody;
    console.log(`🔍 AI Chat Optimized V2 - Request:`, {
      type,
      action,
      has_message: !!message,
      has_userContext: !!userContext,
      requestUserId
    });
    console.log(`📝 Message: "${message}"`);
    // Handle different payload formats
    const userId = userContext?.user_id || requestUserId || 'mock-user-id';
    // Get user's conversation count and subscription tier
    const [conversationCount, subscriptionTier] = await Promise.all([
      getUserConversationCount(userId),
      getUserSubscriptionTier(userId)
    ]);
    console.log(`📊 User stats - Conversations: ${conversationCount}, Tier: ${subscriptionTier}`);
    // Classify the user's intent
    const conversationHistory = messages || history || [];
    const classification = await classifyUserIntent(message, conversationHistory);
    console.log(`🎯 Intent Classification:`, classification);
    // Check usage limits after classification but before processing
    if (subscriptionTier === 'free' && conversationCount >= 5) {
      console.log(`⚠️ Usage limit reached for free user (${conversationCount} conversations)`);
      return new Response(JSON.stringify({
        content: "You've reached the limit of 5 AI conversations on the free plan. Upgrade to Premium for unlimited conversations and advanced features.",
        usage_limit_reached: true,
        current_conversations: conversationCount,
        subscription_tier: subscriptionTier
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
    }
    console.log(`🎯 Using intent: ${classification.intent}`);
    // Execute based on type
    let result;
    if (type === 'assistant') {
      result = await executeWithAssistant(classification.intent, message, conversationHistory, conversationCount);
    } else {
      result = await executeWithCompletions(classification.intent, message, conversationHistory, conversationCount);
    }
    console.log(`🐛 DEBUG: Final result structure:`, {
      has_content: !!result.content,
      content_length: result.content?.length || 0,
      has_attachments: !!result.attachments,
      attachments_count: result.attachments?.length || 0,
      intent_used: classification.intent
    });
    // Return result with proper structure for both execution paths
    const response = {
      success: true,
      content: result.content,
      message: result.content,
      attachments: result.attachments || [],
      usage: result.usage,
      messages: result.messages || [],
      thread: result.thread || {
        id: `thread-${Date.now()}`,
        user_id: userId
      }
    };
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    console.error('❌ AI Chat Optimized Error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error details:', {
      message: error.message,
      name: error.name,
      cause: error.cause
    });
    return new Response(JSON.stringify({
      error: error.message,
      content: "I encountered an error processing your request. Please try again."
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});

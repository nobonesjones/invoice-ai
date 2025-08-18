#!/usr/bin/env node

// Script to create a pre-defined OpenAI Assistant for invoice management
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function createInvoiceAssistant() {
  try {
    console.log('Creating pre-defined Invoice AI Assistant...');
    
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
    });

    console.log('✅ Assistant created successfully!');
    console.log('Assistant ID:', assistant.id);
    console.log('Assistant Name:', assistant.name);
    
    // Save the ID to a file for easy reference
    require('fs').writeFileSync('./assistant-id.txt', assistant.id);
    console.log('💾 Assistant ID saved to assistant-id.txt');
    
    return assistant.id;
  } catch (error) {
    console.error('❌ Failed to create assistant:', error);
    throw error;
  }
}

if (require.main === module) {
  createInvoiceAssistant()
    .then(id => {
      console.log(`\n🎉 SUCCESS! Use this Assistant ID in your code: ${id}`);
    })
    .catch(error => {
      console.error('\n💥 FAILED:', error.message);
      process.exit(1);
    });
}

module.exports = { createInvoiceAssistant };
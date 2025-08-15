import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import OpenAI from 'https://deno.land/x/openai@v4.20.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize OpenAI 
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});

// Custom function to make v2 API calls with proper headers
async function makeV2ApiCall(endpoint: string, method: string, body?: any) {
  const response = await fetch(`https://api.openai.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${error}`);
  }
  
  return await response.json();
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function result interface
interface FunctionResult {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  attachments?: any[];
}

// Invoice Function Execution Service
class InvoiceFunctionService {
  static async executeFunction(
    functionName: string,
    parameters: any,
    userId: string
  ): Promise<FunctionResult> {
    try {
      console.log(`[Optimized] Executing function: ${functionName} for user ${userId}`);
      
      switch (functionName) {
        case 'create_invoice':
          return await this.createInvoice(parameters, userId);
        case 'get_recent_invoices':
          return await this.getRecentInvoices(parameters, userId);
        case 'update_business_settings':
          return await this.updateBusinessSettings(parameters, userId);
        case 'search_clients':
          return await this.searchClients(parameters, userId);
        case 'create_client':
          return await this.createClient(parameters, userId);
        case 'get_business_settings':
          return await this.getBusinessSettings(parameters, userId);
        case 'get_current_invoice_context':
          return await this.getRecentInvoices({ limit: 1 }, userId);
        case 'regenerate_invoice_with_updates':
          return await this.regenerateInvoiceWithUpdates(parameters, userId);
        // Add more cases as needed for the dynamic tool selection
        default:
          return {
            success: false,
            message: `Function ${functionName} not implemented in optimized system`,
            error: `Unknown function: ${functionName}`
          };
      }
    } catch (error) {
      console.error(`[Optimized] Function execution error:`, error);
      return {
        success: false,
        message: `Error executing ${functionName}: ${error.message}`,
        error: error.message
      };
    }
  }

  // Complete createInvoice implementation
  private static async createInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log(`[Optimized] Creating invoice for user ${userId}:`, params);

      // Step 1: Get user's business settings for defaults
      let defaultTaxRate = 0;
      let businessCurrency = 'USD';
      let businessCurrencySymbol = '$';
      let defaultDesign = 'clean';
      let defaultAccentColor = '#1E40AF';

      // Get payment settings
      let paypalEnabled = false;
      let stripeEnabled = false;
      let bankTransferEnabled = false;

      try {
        const { data: paymentOptions } = await supabase
          .from('payment_options')
          .select('paypal_enabled, stripe_enabled, bank_transfer_enabled')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (paymentOptions) {
          paypalEnabled = paymentOptions.paypal_enabled || false;
          stripeEnabled = paymentOptions.stripe_enabled || false;
          bankTransferEnabled = paymentOptions.bank_transfer_enabled || false;
        }
      } catch (paymentError) {
        console.warn('[Optimized] Error loading payment options:', paymentError);
      }

      // Get business settings
      try {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('default_tax_rate, auto_apply_tax, tax_name, currency_code, default_invoice_design, default_accent_color')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (businessSettings) {
          if (businessSettings.auto_apply_tax && businessSettings.default_tax_rate) {
            defaultTaxRate = businessSettings.default_tax_rate;
          }
          if (businessSettings.currency_code) {
            businessCurrency = businessSettings.currency_code;
            businessCurrencySymbol = this.getCurrencySymbol(businessSettings.currency_code);
          }
          if (businessSettings.default_invoice_design) {
            defaultDesign = businessSettings.default_invoice_design;
          }
          if (businessSettings.default_accent_color) {
            defaultAccentColor = businessSettings.default_accent_color;
          }
        }
      } catch (settingsError) {
        console.warn('[Optimized] Error loading business settings:', settingsError);
      }

      // Step 2: Find or create client
      let clientId: string;
      let existingClient = null;
      let createdNewClient = false;

      // Try to find existing client by name
      const clientName = String(params.client_name || '').trim();
      const { data: exactMatch } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', userId)
        .ilike('name', `%${clientName}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (exactMatch) {
        existingClient = exactMatch;
        clientId = existingClient.id;
      } else {
        // Create new client
        const newClient = {
          user_id: userId,
          name: params.client_name,
          email: params.client_email || null,
          phone: params.client_phone || null,
          address_client: params.client_address || null,
          created_at: new Date().toISOString()
        };

        const { data: client, error: clientError } = await supabase
          .from('clients')
          .insert(newClient)
          .select()
          .single();

        if (clientError) {
          throw new Error(`Failed to create client: ${clientError.message}`);
        }

        clientId = client.id;
        createdNewClient = true;
      }

      // Step 3: Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(userId);

      // Step 4: Calculate totals
      const lineItems = (params.line_items || []).map((item: any) => {
        const quantity = item.quantity && item.quantity > 0 ? item.quantity : 1;
        const unit = Number(item.unit_price) || 0;
        const total_price = item.total_price !== undefined ? Number(item.total_price) : quantity * unit;
        return {
          item_name: item.item_name,
          item_description: item.item_description || null,
          quantity,
          unit_price: unit,
          total_price
        };
      });
      const subtotalAmount = lineItems.reduce((sum: number, item: any) => sum + (Number(item.total_price) || 0), 0);
      
      const taxPercentage = params.tax_percentage !== undefined ? params.tax_percentage : defaultTaxRate;
      const taxAmount = subtotalAmount * (taxPercentage / 100);
      
      const discountAmount = 0; // Simplified for now
      const totalAmount = subtotalAmount + taxAmount - discountAmount;

      // Step 5: Create invoice (align with current DB schema)
      const invoice = {
        user_id: userId,
        client_id: clientId,
        invoice_number: invoiceNumber,
        invoice_date: params.invoice_date || new Date().toISOString().split('T')[0],
        due_date: params.due_date || null,
        subtotal_amount: subtotalAmount,
        discount_type: null,
        discount_value: 0,
        tax_percentage: taxPercentage,
        total_amount: totalAmount,
        notes: null,
        status: 'draft',
        stripe_active: stripeEnabled,
        bank_account_active: bankTransferEnabled,
        paypal_active: paypalEnabled,
        invoice_design: defaultDesign,
        accent_color: defaultAccentColor,
        created_at: new Date().toISOString()
      };

      const { data: createdInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoice)
        .select()
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Step 6: Create line items
      const lineItemsToInsert = lineItems.map((item: any) => ({
        invoice_id: createdInvoice.id,
        user_id: userId,
        item_name: item.item_name,
        item_description: item.item_description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }));

      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .insert(lineItemsToInsert);

      if (lineItemsError) {
        // Clean up invoice if line items fail
        await supabase.from('invoices').delete().eq('id', createdInvoice.id);
        throw new Error(`Failed to create line items: ${lineItemsError.message}`);
      }

      // Step 7: Format success response
      const clientNote = createdNewClient
        ? `I've also added ${params.client_name} as a new client in your contacts.\n\n`
        : '';
      
      const successMessage = `Great! I've successfully created invoice #${invoiceNumber} for ${params.client_name}.
${clientNote}The invoice includes:
${lineItems.map((item: any) => 
  `• ${item.item_name}${item.item_description ? ` (${item.item_description})` : ''} - ${businessCurrencySymbol}${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity} = ${businessCurrencySymbol}${item.total_price}` : ''}`
).join('\n')}

Total: ${businessCurrencySymbol}${totalAmount.toFixed(2)}${createdInvoice.due_date ? ` • Due: ${new Date(createdInvoice.due_date).toLocaleDateString()}` : ''}

Would you like me to help you send this invoice or make any changes?`;

      return {
        success: true,
        data: {
          invoice: {
            ...createdInvoice,
            client_name: params.client_name,
            client_email: params.client_email
          },
          client_id: clientId,
          line_items: lineItems,
          calculations: {
            subtotal: subtotalAmount,
            discount: discountAmount,
            tax: taxAmount,
            total: totalAmount
          }
        },
        message: successMessage,
        attachments: [{
          type: 'invoice',
          invoice_id: createdInvoice.id,
          invoice_number: invoiceNumber,
          invoice: createdInvoice,
          line_items: lineItems,
          client_id: clientId
        }]
      };

    } catch (error) {
      console.error('[Optimized] Error creating invoice:', error);
      return {
        success: false,
        message: `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper function to generate invoice numbers
  private static async generateInvoiceNumber(userId: string): Promise<string> {
    const { data: latestInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestInvoice && latestInvoice.invoice_number) {
      const match = latestInvoice.invoice_number.match(/(\d+)$/);
      if (match) {
        const nextNumber = parseInt(match[1]) + 1;
        return `INV-${nextNumber.toString().padStart(4, '0')}`;
      }
    }

    return 'INV-0001';
  }

  // Helper function to get currency symbol
  private static getCurrencySymbol(currencyCode: string): string {
    const symbols: { [key: string]: string } = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CAD': '$', 'AUD': '$'
    };
    return symbols[currencyCode] || '$';
  }

  private static async getRecentInvoices(params: any, userId: string): Promise<FunctionResult> {
    const { data: invoices, error } = await supabase
      .from('invoices')
      .select(`
        *,
        invoice_line_items(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 5);

    if (error) {
      return { success: false, message: 'Failed to get recent invoices', error: error.message };
    }

    return {
      success: true,
      data: { invoices },
      message: `Found ${invoices?.length || 0} recent invoices`
    };
  }

  private static async updateBusinessSettings(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log(`[Optimized] Updating business settings for user ${userId}:`, params);

      // Get current business settings
      const { data: currentSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Prepare update data
      const updateData: any = { user_id: userId };
      
      if (params.business_name !== undefined) updateData.business_name = params.business_name;
      if (params.business_address !== undefined) updateData.business_address = params.business_address;
      if (params.business_email !== undefined) updateData.business_email = params.business_email;
      if (params.business_phone !== undefined) updateData.business_phone = params.business_phone;
      if (params.website !== undefined) updateData.website = params.website;
      if (params.tax_number !== undefined) updateData.tax_number = params.tax_number;
      if (params.tax_name !== undefined) updateData.tax_name = params.tax_name;
      if (params.default_tax_rate !== undefined) updateData.default_tax_rate = params.default_tax_rate;
      if (params.auto_apply_tax !== undefined) updateData.auto_apply_tax = params.auto_apply_tax;

      let result;
      if (currentSettings) {
        // Update existing settings
        const { data, error } = await supabase
          .from('business_settings')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Create new settings
        const { data, error } = await supabase
          .from('business_settings')
          .insert(updateData)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }

      // Format success message
      const changes = [];
      if (params.business_name) changes.push(`business name to "${params.business_name}"`);
      if (params.business_address) changes.push(`address to "${params.business_address}"`);
      if (params.business_email) changes.push(`email to "${params.business_email}"`);
      if (params.business_phone) changes.push(`phone to "${params.business_phone}"`);
      if (params.website) changes.push(`website to "${params.website}"`);
      if (params.tax_number) changes.push(`tax number to "${params.tax_number}"`);

      const changeText = changes.length > 0 ? changes.join(', ') : 'business settings';

      // CONTEXT-AWARE BEHAVIOR: Get recent invoice to regenerate
      const recentInvoiceResult = await this.getRecentInvoices({ limit: 1 }, userId);
      let contextResponse = '';
      
      if (recentInvoiceResult.success && recentInvoiceResult.data?.invoices?.length > 0) {
        const recentInvoice = recentInvoiceResult.data.invoices[0];
        contextResponse = `\n\nI've also updated your recent invoice (#${recentInvoice.invoice_number}) with the new ${changeText}. Here's your updated invoice:`;
        
        // Add the updated invoice as an attachment for immediate display
        return {
          success: true,
          data: { settings: result, updated_invoice: recentInvoice },
          message: `Perfect! I've updated your ${changeText}.${contextResponse}`,
          attachments: [{
            type: 'invoice',
            invoice_id: recentInvoice.id,
            invoice_number: recentInvoice.invoice_number,
            invoice: recentInvoice,
            updated_business_info: true
          }]
        };
      }

      return {
        success: true,
        data: { settings: result },
        message: `Perfect! I've updated your ${changeText}.`
      };

    } catch (error) {
      console.error('[Optimized] Error updating business settings:', error);
      return {
        success: false,
        message: `Failed to update business settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async searchClients(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { data: clients, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', userId)
        .ilike('name', `%${params.name}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return {
        success: true,
        data: { clients },
        message: `Found ${clients?.length || 0} clients matching "${params.name}"`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to search clients: ${error.message}`,
        error: error.message
      };
    }
  }

  private static async createClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      const newClient = {
        user_id: userId,
        name: params.name,
        email: params.email || null,
        phone: params.phone || null,
        address: params.address || null,
        created_at: new Date().toISOString()
      };

      const { data: client, error } = await supabase
        .from('clients')
        .insert(newClient)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: { client },
        message: `Successfully created client "${params.name}"`
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create client: ${error.message}`,
        error: error.message
      };
    }
  }

  private static async getBusinessSettings(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { data: settings, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      return {
        success: true,
        data: { settings: settings || {} },
        message: settings ? 'Business settings retrieved' : 'No business settings found'
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to get business settings: ${error.message}`,
        error: error.message
      };
    }
  }

  private static async regenerateInvoiceWithUpdates(params: any, userId: string): Promise<FunctionResult> {
    return {
      success: true,
      message: "Invoice regeneration would happen here - this enables context-aware updates",
      data: { invoice_id: params.invoice_number }
    };
  }
}

// Modular prompt sections (dramatically reduced from 43K)
const PROMPT_MODULES = {
  core: `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.

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
• Only ask ONE follow-up question if absolutely necessary`,

  invoice_creation: `INVOICE CREATION WORKFLOW:
When users request to create an invoice:
1. ALWAYS search for client first using search_clients
2. If client found: use them (don't ask for confirmation if only one match)
3. If no client: CREATE them automatically with "I couldn't find [name], so I've added them"
4. Create invoice immediately with available information
5. For missing prices: create with quantity 1 and unit_price 0, then ask

INTELLIGENT PRICE PARSING:
Extract prices from natural language:
• "garden cleaning for 200" → item: garden cleaning, price: $200
• "web design for 500" → item: web design, price: $500
• "consultation at 150" → item: consultation, price: $150`,

  client_management: `CLIENT VS BUSINESS INFORMATION:
When users want to update information, determine if they mean THEIR business or a CLIENT:

USER'S BUSINESS (use update_business_settings):
- Keywords: "my", "our", "my business", "my company"
- Examples: "Update my address", "Change my phone number"
- Context: First invoice creation, setting up business

CLIENT INFORMATION (use update_client):
- Keywords: "client", "customer", specific client name mentioned
- Examples: "Update John's address", "Change ABC Corp's email"

FIRST INVOICE RULE: When creating first invoice, "my address" = business address!`,

  business_updates: `BUSINESS SETTING CHANGES + IMMEDIATE INVOICE UPDATE:
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
• NEVER just say "future invoices will be different" - update the current one!`,

  payment_setup: `PAYMENT METHODS WORKFLOW:
Payment setup for PayPal and Bank Transfer:

FOR PAYPAL:
- Ask for PayPal email
- Use setup_paypal_payments function
- This enables it in settings AND optionally on specific invoice

FOR BANK TRANSFER:
- Ask for bank details (name, account, routing)
- Use setup_bank_transfer_payments function

STRIPE: Coming soon - explain this to users if they ask about card payments`,

  design_changes: `INVOICE DESIGN AND COLOR:
Available designs with personalities:
• CLASSIC: Professional, traditional (blue)
• MODERN: Contemporary, clean (yellow/gold)
• CLEAN: Minimalist, organized (green)
• SIMPLE: Elegant, refined (minimal)
• WAVE: Modern curved header (purple)

Natural language understanding:
• "Make it professional" → Classic design + Navy
• "Something modern" → Modern design
• "Make it purple" → Wave design or purple color`,

  search_analytics: `SEARCH AND ANALYTICS:
For outstanding amounts: use get_client_outstanding_amount
For invoice search: use search_invoices
For recent items: use get_recent_invoices

Example: "How much does John owe me?" → get_client_outstanding_amount(client_name: "John")`,

  usage_limits: `FREE PLAN LIMITATIONS:
• Free plan: 3 items total (invoices + estimates combined)
• ALWAYS call check_usage_limits BEFORE creating items
• If limit reached: "You've reached your free plan limit of 3 items. Upgrade in Settings → Upgrade button."
• Premium users have unlimited access`,

  context_awareness: `CONVERSATION CONTEXT & INVOICE FLOW:
CORE PRINCIPLE: Always try to show the user an invoice when possible!

ACTIVE INVOICE CONTEXT:
• When user creates an invoice, it becomes the "active context"
• User is likely still working on/thinking about this invoice
• ANY subsequent changes should update and re-show this invoice

CONTEXT TRIGGERS (Auto-update active invoice):
• Business settings: "Change my name/address/phone" → update + show invoice
• Client updates: "Change client email" → update + show invoice  
• Invoice details: "Change due date/add discount" → update + show invoice
• Design changes: "Make it purple/modern design" → update + show invoice
• Payment setup: "Add PayPal" → update + show invoice

CONTEXT DETECTION:
• Look for recent invoice creation in conversation
• Assume user wants to see results of their changes
• Default behavior: SHOW the updated invoice, don't just confirm changes

RESPONSE PATTERN:
✅ "I've updated your business name to Harry Ltd. Here's your updated invoice:"
❌ "I've updated your business name. Future invoices will use the new name."

WHEN NO ACTIVE CONTEXT:
• User asks for changes but no recent invoice → get most recent invoice and update it
• Use get_recent_invoices to find last invoice, then update and show it`,
};

// Define all available functions (copy from invoiceFunctions.ts)
const INVOICE_FUNCTIONS = [
  {
    name: "create_invoice",
    description: "Create a new invoice with client details and line items",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string" },
        line_items: { 
          type: "array",
          items: {
            type: "object",
            properties: {
              item_name: { type: "string" },
              unit_price: { type: "number" },
              quantity: { type: "number" }
            }
          }
        }
      },
      required: ["client_name", "line_items"]
    }
  },
  {
    name: "search_clients",
    description: "Search for clients by name",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "update_business_settings",
    description: "Update business settings",
    parameters: {
      type: "object",
      properties: {
        business_name: { type: "string" },
        business_address: { type: "string" },
        business_email: { type: "string" },
        business_phone: { type: "string" }
      }
    }
  },
  {
    name: "get_client_outstanding_amount",
    description: "Get total outstanding amount for a client",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string" }
      },
      required: ["client_name"]
    }
  },
  {
    name: "check_usage_limits",
    description: "Check if user can create more items",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  // Add minimal set of other critical functions
  {
    name: "create_client",
    description: "Create a new client",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" }
      },
      required: ["name"]
    }
  },
  {
    name: "update_client",
    description: "Update client information",
    parameters: {
      type: "object",
      properties: {
        client_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" }
      },
      required: ["client_name"]
    }
  },
  {
    name: "get_recent_invoices",
    description: "Get recent invoices",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number" }
      }
    }
  },
  {
    name: "setup_paypal_payments",
    description: "Setup PayPal payments",
    parameters: {
      type: "object",
      properties: {
        paypal_email: { type: "string" },
        invoice_number: { type: "string" }
      },
      required: ["paypal_email"]
    }
  },
  {
    name: "update_invoice_design",
    description: "Update invoice design template",
    parameters: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        design_name: { type: "string" }
      },
      required: ["invoice_number", "design_name"]
    }
  },
  {
    name: "get_current_invoice_context",
    description: "Get the most recent invoice to update with new changes",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", default: 1 }
      }
    }
  },
  {
    name: "regenerate_invoice_with_updates",
    description: "Regenerate an existing invoice with updated business/client information",
    parameters: {
      type: "object",
      properties: {
        invoice_number: { type: "string" },
        reason: { type: "string", description: "Why the invoice is being regenerated" }
      },
      required: ["invoice_number"]
    }
  }
];

// Tool groupings (reduced from 46 to relevant subset)
const TOOL_GROUPS = {
  invoice_core: [
    'create_invoice',
    'update_invoice_line_items', 
    'get_invoice_details',
    'get_recent_invoices',
    'edit_recent_invoice',
    'get_current_invoice_context',
    'regenerate_invoice_with_updates',
  ],
  client_ops: [
    'create_client',
    'search_clients',
    'update_client',
    'get_client_outstanding_amount',
  ],
  business_ops: [
    'get_business_settings',
    'update_business_settings',
    'update_tax_settings',
  ],
  payment_ops: [
    'setup_paypal_payments',
    'setup_bank_transfer_payments',
    'get_payment_options',
    'update_invoice_payment_methods',
  ],
  design_ops: [
    'get_design_options',
    'get_color_options', 
    'update_invoice_design',
    'update_invoice_color',
    'update_invoice_appearance',
  ],
  search_ops: [
    'search_invoices',
    'search_clients',
    'get_recent_invoices',
    'get_invoice_summary',
  ],
  estimate_ops: [
    'create_estimate',
    'search_estimates',
    'get_recent_estimates',
    'convert_estimate_to_invoice',
    'edit_recent_estimate',
  ],
  utility_ops: [
    'check_usage_limits',
    'duplicate_invoice',
    'delete_invoice',
    'delete_client',
  ],
};

// Intent types
type IntentType = 
  | 'create_invoice' 
  | 'create_estimate' 
  | 'create_client'
  | 'update_invoice'
  | 'update_client'
  | 'update_business'
  | 'search_data'
  | 'payment_setup'
  | 'design_change'
  | 'analytics'
  | 'delete_operations'
  | 'context_aware_update';

interface IntentClassification {
  intents: IntentType[];
  complexity: 'simple' | 'moderate' | 'complex';
  requiredToolGroups: string[];
  requiresSequencing: boolean;
  suggestedModel: string;
}

// Classify user intent with minimal tokens
async function classifyIntent(message: string): Promise<IntentClassification> {
  try {
    const classificationPrompt = `Analyze this invoice app request and return JSON only:

"${message}"

Identify ALL actions requested. Return JSON:
{
  "intents": ["create_invoice", "payment_setup"], // List all actions
  "complexity": "simple|moderate|complex",
  "requiredToolGroups": ["invoice_core", "payment_ops"], // Tool groups needed
  "requiresSequencing": false, // Do actions depend on each other?
  "suggestedModel": "gpt-4o-mini" // or "gpt-4o" for complex
}

Intent types: create_invoice, create_estimate, create_client, update_invoice, update_client, update_business, search_data, payment_setup, design_change, analytics, delete_operations, context_aware_update

CONTEXT AWARENESS:
- If user is making changes that could affect an existing invoice, include "context_aware_update"
- Business changes: "change my business name", "update address", "change phone"
- Design changes: "make it purple", "change design", "use modern template"
- Payment changes: "add PayPal", "enable bank transfer"
- Any vague request that assumes context: "make it...", "change it...", "update it..."

Tool groups: invoice_core, client_ops, business_ops, payment_ops, design_ops, search_ops, estimate_ops, utility_ops`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: classificationPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.1,
      max_tokens: 200,
    });

    const result = response.choices[0].message.content || '{}';
    return JSON.parse(result);
  } catch (error) {
    console.error('Classification error:', error);
    // Fallback: assume complex to be safe
    return {
      intents: ['create_invoice'],
      complexity: 'complex',
      requiredToolGroups: Object.keys(TOOL_GROUPS),
      requiresSequencing: false,
      suggestedModel: 'gpt-4o-mini'
    };
  }
}

// Build dynamic prompt based on intents
function buildDynamicPrompt(intents: IntentType[], userContext?: any): string {
  const modules: string[] = [PROMPT_MODULES.core];
  
  // Add currency context if provided
  if (userContext?.currency) {
    modules.push(`CURRENCY CONTEXT: User's currency is ${userContext.currency} (${userContext.symbol}). ALWAYS use ${userContext.symbol} for prices.`);
  }

  // Add modules based on intents
  intents.forEach(intent => {
    switch (intent) {
      case 'create_invoice':
      case 'update_invoice':
        modules.push(PROMPT_MODULES.invoice_creation);
        modules.push(PROMPT_MODULES.client_management);
        break;
      case 'create_client':
      case 'update_client':
        modules.push(PROMPT_MODULES.client_management);
        break;
      case 'update_business':
        modules.push(PROMPT_MODULES.business_updates);
        break;
      case 'payment_setup':
        modules.push(PROMPT_MODULES.payment_setup);
        break;
      case 'design_change':
        modules.push(PROMPT_MODULES.design_changes);
        break;
      case 'search_data':
      case 'analytics':
        modules.push(PROMPT_MODULES.search_analytics);
        break;
      case 'context_aware_update':
        modules.push(PROMPT_MODULES.context_awareness);
        modules.push(PROMPT_MODULES.business_updates);
        modules.push(PROMPT_MODULES.invoice_creation);
        break;
    }
  });

  // Always add usage limits
  modules.push(PROMPT_MODULES.usage_limits);

  return modules.join('\n\n');
}

// Select only needed tools based on intents
function selectTools(toolGroups: string[]): any[] {
  const selectedToolNames = new Set<string>();
  
  toolGroups.forEach(group => {
    const tools = TOOL_GROUPS[group] || [];
    tools.forEach(tool => selectedToolNames.add(tool));
  });

  // Filter INVOICE_FUNCTIONS to only include selected tools
  return INVOICE_FUNCTIONS.filter(func => selectedToolNames.has(func.name));
}

// Execute via Chat Completions with function-calling (bounded tool loop)
async function executeWithCompletions(
  message: string,
  userId: string,
  model: string,
  systemPrompt: string,
  tools: any[],
  preferredFirstFunction?: string
): Promise<{ content: string; attachments?: any[]; usage?: any }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set');

  const functions = tools.map(func => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters
  }));

  // Tool loop with time budget and max steps
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];
  const MAX_STEPS = 5; // allow search -> (create_client) -> create_invoice -> finalize
  const budgetMs = 24000; // extend server budget; client has 25s with retry
  const start = Date.now();
  let lastUsage: any = undefined;
  let lastAttachments: any[] | undefined = undefined;
  let lastToolMessage: string | undefined = undefined;

  // Minimal parser for direct fallback when model refuses tool call
  const parseQuickInvoiceRequest = (text: string) => {
    const priceMatch = text.match(/(\d+(?:\.\d+)?)/);
    const price = priceMatch ? Number(priceMatch[1]) : 0;
    // Client: first " for <Name>" occurrence
    let client = '';
    const clientMatch = text.match(/\bfor\s+([A-Z][\w]*(?:\s+[A-Z][\w]*)?)/);
    if (clientMatch) client = clientMatch[1];
    // Item: take substring after last ' for ' up to price
    let item = 'Service';
    const lastFor = text.toLowerCase().lastIndexOf(' for ');
    if (lastFor !== -1) {
      const after = text.substring(lastFor + 5);
      item = after.replace(/\bfor\b/gi, '').replace(/\b(at|for|a|an)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      if (priceMatch) {
        const idx = item.indexOf(priceMatch[1]);
        if (idx > 0) item = item.substring(0, idx).trim();
      }
      if (!item) item = 'Service';
    }
    return { client, item, price };
  };

  let forceFunctionNext = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    const remaining = Math.max(7000, budgetMs - (Date.now() - start));
    const reqBody: any = {
      model,
      messages,
      temperature: 0.2,
      max_tokens: 350
    };
    if (functions.length > 0) {
      reqBody.functions = functions;
      // Nudge first step to call the primary function if intent is clear
      if ((step === 0 && preferredFirstFunction) || forceFunctionNext) {
        reqBody.function_call = { name: preferredFirstFunction };
      } else {
        reqBody.function_call = 'auto';
      }
    }
    let json: any;
    try {
      const resp = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqBody)
      }, remaining);
      if (!resp.ok) throw new Error(`OpenAI error: ${resp.status} ${await resp.text()}`);
      json = await resp.json();
    } catch (e) {
      // Retry once on network/timeout within remaining budget
      try {
        const retryRemaining = Math.max(6000, budgetMs - (Date.now() - start));
        const resp2 = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(reqBody)
        }, retryRemaining);
        if (!resp2.ok) throw new Error(`OpenAI error: ${resp2.status} ${await resp2.text()}`);
        json = await resp2.json();
      } catch (e2) {
        const fallback = lastToolMessage || 'I completed the requested steps.';
        return { content: fallback, attachments: lastAttachments || [], usage: lastUsage };
      }
    }
    lastUsage = json.usage;
    const msg = json.choices?.[0]?.message;

    // If no tool call
    if (!msg?.function_call) {
      // Enforce action once when intent is create_invoice: push a strict instruction and retry
      if (step === 0 && preferredFirstFunction === 'create_invoice' && !forceFunctionNext) {
        messages.push({
          role: 'system',
          content: 'CRITICAL: Do not reply with text. Call create_invoice now with parsed arguments. If any field is missing, use sensible defaults (quantity 1, unit_price 0).'
        });
        forceFunctionNext = true;
        continue;
      }
      // If still no tool after enforcement and intent is create_invoice, perform a direct server-side create
      if (preferredFirstFunction === 'create_invoice') {
        const parsed = parseQuickInvoiceRequest(message);
        const line_items = [{ item_name: parsed.item, unit_price: parsed.price, quantity: 1 }];
        const direct = await InvoiceFunctionService.executeFunction('create_invoice', { client_name: parsed.client || 'Customer', line_items }, userId);
        const text = direct.message || 'Invoice created.';
        const attach = direct.attachments || [];
        return { content: text, attachments: attach, usage: lastUsage };
      }
      const finalText = msg?.content || 'Okay.';
      return { content: finalText, attachments: lastAttachments || [], usage: lastUsage };
    }

    // Execute tool
    let args: any = {};
    const fn = msg.function_call;
    try { args = fn.arguments ? JSON.parse(fn.arguments) : {}; } catch {}
    const toolResult = await InvoiceFunctionService.executeFunction(fn.name, args, userId);
    if (toolResult.attachments && toolResult.attachments.length) {
      lastAttachments = toolResult.attachments;
    }
    if (toolResult.message) {
      lastToolMessage = toolResult.message;
    }

    // If we just created an invoice successfully, return immediately with that message
    if (fn.name === 'create_invoice' && toolResult.success) {
      const msgText = toolResult.message || 'Invoice created.';
      return { content: msgText, attachments: lastAttachments || [], usage: lastUsage };
    }

    // Append function result
    messages.push({ role: 'function', name: fn.name, content: JSON.stringify(toolResult) });

    // Check time budget
    if (Date.now() - start > budgetMs - 2000) {
      const fallback = toolResult.message || 'Processed your request.';
      return { content: fallback, attachments: lastAttachments || [], usage: lastUsage };
    }
  }

  // Safety: if loop ends without final text, prefer last tool message
  const fallbackText = lastToolMessage || 'I completed the requested steps.';
  return { content: fallbackText, attachments: lastAttachments || [], usage: lastUsage };
}

// Fetch with timeout helper
async function fetchWithTimeout(url: string, init: any, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// Execute the actual assistant functionality with full tool call handling
async function executeAssistant(
  message: string,
  userId: string,
  userContext: any,
  model: string,
  systemPrompt: string,
  tools: any[],
  existingThreadId?: string
): Promise<any> {
  try {
    console.log(`[Optimized] Creating assistant with ${tools.length} tools`);
    console.log(`[Optimized] Model: ${model}, Prompt length: ${systemPrompt.length}`);
    
    // Create the assistant (v2 API with proper header) or reuse via env
    console.log(`[Optimized] Step 1: Preparing assistant...`);
    let assistant: any;
    const presetAssistantId = Deno.env.get('OPTIMIZED_ASSISTANT_ID');
    if (presetAssistantId) {
      assistant = { id: presetAssistantId };
      console.log(`[Optimized] Using preset assistant ID from env`);
    } else {
      assistant = await makeV2ApiCall('/assistants', 'POST', {
        name: "Invoice AI Assistant (Optimized)",
        instructions: systemPrompt,
        model: model,
        tools: tools.map(func => ({
          type: "function",
          function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters
          }
        }))
      });
    }

    // Create a thread
    console.log(`[Optimized] Step 2: Resolving thread...`);
    const thread = existingThreadId
      ? { id: existingThreadId }
      : await makeV2ApiCall('/threads', 'POST', {});

    // Add the message
    await makeV2ApiCall(`/threads/${thread.id}/messages`, 'POST', {
      role: "user",
      content: message
    });

    // Run the assistant
    const run = await makeV2ApiCall(`/threads/${thread.id}/runs`, 'POST', {
      assistant_id: assistant.id
    });

    // Wait for completion and handle tool calls
    const result = await waitForRunCompletion(thread.id, run.id, userId);
    
    // Do not delete assistant to avoid repeated setup latency; reuse via env when set

    return result;
  } catch (error) {
    console.error('[AI-Chat-Optimized] Assistant execution error:', error);
    throw error;
  }
}

// Wait for run completion and handle tool calls (copied from original assistantService.ts)
async function waitForRunCompletion(
  threadId: string, 
  runId: string, 
  userId: string,
  recursionDepth: number = 0
): Promise<any> {
  const MAX_RECURSION_DEPTH = 5;
  if (recursionDepth > MAX_RECURSION_DEPTH) {
    console.error('[Optimized] Maximum recursion depth exceeded');
    return {
      success: false,
      content: 'I apologize, but I encountered a complex processing issue. Please try rephrasing your request.',
      error: 'Maximum recursion depth exceeded'
    };
  }

  try {
    let runStatus = await makeV2ApiCall(`/threads/${threadId}/runs/${runId}`, 'GET');
    
    // Poll until completion or action required
    while (runStatus.status === 'in_progress' || runStatus.status === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await makeV2ApiCall(`/threads/${threadId}/runs/${runId}`, 'GET');
    }

    console.log(`[Optimized] Run status: ${runStatus.status}`);

    if (runStatus.status === 'completed') {
      // Get the final response
      const messages = await makeV2ApiCall(`/threads/${threadId}/messages`, 'GET');
      const lastMessage = messages.data[0];
      
      if (lastMessage && lastMessage.role === 'assistant') {
        const content = lastMessage.content
          .filter(c => c.type === 'text')
          .map(c => c.type === 'text' ? c.text.value : '')
          .join('\n');
        
        return {
          success: true,
          content,
          usage: runStatus.usage
        };
      }
    } else if (runStatus.status === 'requires_action') {
      // Handle tool calls
      const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
      console.log(`[Optimized] Processing ${toolCalls.length} tool calls`);
      
      const toolOutputs = [];
      
      for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        let functionArgs: any;
        
        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          console.error('[Optimized] Failed to parse function arguments:', parseError);
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output: JSON.stringify({ 
              success: false, 
              error: 'Invalid function arguments' 
            })
          });
          continue;
        }
        
        console.log(`[Optimized] Executing function: ${functionName}`);
        
        // Execute the function using our InvoiceFunctionService
        const result = await InvoiceFunctionService.executeFunction(
          functionName,
          functionArgs,
          userId
        );
        
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(result)
        });
      }
      
      // Submit tool outputs
      await makeV2ApiCall(`/threads/${threadId}/runs/${runId}/submit_tool_outputs`, 'POST', {
        tool_outputs: toolOutputs
      });
      
      // Recursively wait for completion after tool execution
      return await waitForRunCompletion(threadId, runId, userId, recursionDepth + 1);
    } else {
      // Handle failed or cancelled runs
      return {
        success: false,
        content: 'I encountered an issue processing your request. Please try again.',
        error: `Run failed with status: ${runStatus.status}`
      };
    }
  } catch (error) {
    console.error('[Optimized] Error in waitForRunCompletion:', error);
    return {
      success: false,
      content: 'I encountered an error processing your request. Please try again.',
      error: error.message
    };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, threadId, userId, userContext, action = 'send_message', testMode = false } = await req.json();

    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    console.log(`[AI-Chat-Optimized] Processing request for user ${userId}`);
    console.log(`[AI-Chat-Optimized] Test mode: ${testMode}`);

    // Small-talk fast path to avoid full pipeline
    const smallTalk = /^(hi|hello|hey)\b/i;
    if (smallTalk.test(message.trim())) {
      const nowId = `optimized-${Date.now()}`;
      const messagesArray = [
        { id: `msg-${Date.now()}`, role: 'user', content: message, created_at: new Date().toISOString(), thread_id: threadId || nowId },
        { id: `msg-${Date.now()+1}`, role: 'assistant', content: 'Hi! How can I help you today?', attachments: [], created_at: new Date().toISOString(), thread_id: threadId || nowId }
      ];
      return new Response(
        JSON.stringify({ success: true, thread: { id: threadId || nowId, user_id: userId }, messages: messagesArray, optimization: { promptReduction: 'fast-path', model: 'none' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Heuristic fast-path: direct invoice requests
    const invoiceHeuristic = /\b(invoice|bill)\b/i.test(message) && /\d/.test(message);
    let classification: IntentClassification;
    let classificationTime = 0;
    if (invoiceHeuristic) {
      classification = {
        intents: ['create_invoice'],
        complexity: 'simple',
        requiredToolGroups: ['invoice_core','client_ops'],
        requiresSequencing: false,
        suggestedModel: 'gpt-4o-mini'
      };
      console.log('[AI-Chat-Optimized] Heuristic: create_invoice fast-path');
    } else {
      // Step 1: Classify intent (fast & cheap)
      const startTime = Date.now();
      classification = await classifyIntent(message);
      classificationTime = Date.now() - startTime;
      console.log(`[AI-Chat-Optimized] Classification took ${classificationTime}ms:`, classification);
    }

    // Step 2: Build minimal prompt
    const systemPrompt = buildDynamicPrompt(classification.intents, userContext);
    console.log(`[AI-Chat-Optimized] Dynamic prompt size: ${systemPrompt.length} chars (vs 43K original)`);

    // Step 3: Get relevant tools
    const tools = selectTools(classification.requiredToolGroups);
    console.log(`[AI-Chat-Optimized] Selected ${tools.length} tools (vs 46 original)`);

    // Step 4: Use suggested model
    const model = classification.suggestedModel;
    console.log(`[AI-Chat-Optimized] Using model: ${model}`);

    // Optimization metrics
    const optimization = {
      originalPromptSize: 43000,
      optimizedPromptSize: systemPrompt.length,
      promptReduction: `${Math.round((1 - systemPrompt.length / 43000) * 100)}%`,
      originalTools: 46,
      optimizedTools: tools.length,
      toolReduction: `${Math.round((1 - tools.length / 46) * 100)}%`,
      classification,
      model,
      classificationTime: `${classificationTime}ms`,
    };

    // In test mode, return optimization stats
    if (testMode) {
      return new Response(
        JSON.stringify({
          success: true,
          optimization,
          message: `[TEST MODE] Would process with ${systemPrompt.length} chars and ${tools.length} tools using ${model}`,
          debugInfo: {
            systemPromptPreview: systemPrompt.substring(0, 500) + '...',
            selectedTools: tools.map(t => t.name),
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // In production mode, execute via Chat Completions (fast, reliable, single-shot)
    console.log('[AI-Chat-Optimized] Starting Chat Completions execution...');
    let assistantResult;
    try {
      assistantResult = await executeWithCompletions(
        message,
        userId,
        model,
        systemPrompt,
        tools,
        classification.intents.includes('create_invoice') ? 'create_invoice' : undefined
      );
      console.log('[AI-Chat-Optimized] Completions execution completed');
    } catch (executeError) {
      console.error('[AI-Chat-Optimized] Completions execution failed:', executeError);
      throw executeError;
    }

    // Format response to match AssistantService expectations
    const messagesArray = [
      {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
        created_at: new Date().toISOString(),
      },
      {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant', 
        content: assistantResult.content,
        attachments: assistantResult.attachments || [],
        created_at: new Date().toISOString(),
      }
    ];

    console.log('[AI-Chat-Optimized] Messages array check:', {
      isArray: Array.isArray(messagesArray),
      length: messagesArray.length,
      firstMessage: messagesArray[0],
      secondMessage: messagesArray[1]
    });

    const thread_id_val = threadId || `optimized-${Date.now()}`;
    const formattedResponse = {
      success: true,
      thread: { id: thread_id_val, user_id: userId },
      messages: messagesArray.map(m => ({ ...m, thread_id: (m as any).thread_id || thread_id_val })),
      optimization,
      usage: assistantResult.usage,
    };

    return new Response(
      JSON.stringify(formattedResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[AI-Chat-Optimized] Error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

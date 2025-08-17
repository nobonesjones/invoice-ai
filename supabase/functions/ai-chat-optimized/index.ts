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

// Simple validator class to fix missing function error
class ContextAwareValidator {
  static validateUserId(userId: string): { isValid: boolean; error?: string } {
    if (!userId || typeof userId !== 'string') {
      return { isValid: false, error: 'User ID is required and must be a string' };
    }
    return { isValid: true };
  }
}

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
        case 'setup_paypal_payments':
          return await this.setupPaypalPayments(parameters, userId);
        case 'get_payment_options':
          return await this.getPaymentOptions(parameters, userId);
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
        address_client: params.address || null,
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

  private static async getPaymentOptions(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log(`[Optimized] Getting payment options for user ${userId}`);

      const { data: paymentOptions, error } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('[Optimized] Error fetching payment options:', error);
        return {
          success: false,
          message: `Failed to get payment options: ${error.message}`,
          error: error.message
        };
      }

      // If no payment options exist, return defaults
      if (!paymentOptions) {
        return {
          success: true,
          data: {
            paypal_enabled: false,
            stripe_enabled: false,
            bank_transfer_enabled: false,
            paypal_email: null
          },
          message: "No payment options configured yet."
        };
      }

      return {
        success: true,
        data: paymentOptions,
        message: `Payment options retrieved: PayPal ${paymentOptions.paypal_enabled ? 'enabled' : 'disabled'}, Stripe ${paymentOptions.stripe_enabled ? 'enabled' : 'disabled'}, Bank Transfer ${paymentOptions.bank_transfer_enabled ? 'enabled' : 'disabled'}`
      };

    } catch (error) {
      console.error('[Optimized] Error getting payment options:', error);
      return {
        success: false,
        message: `Failed to get payment options: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setupPaypalPayments(params: any, userId: string): Promise<FunctionResult> {
    try {
      console.log(`[Optimized] Setting up PayPal for user ${userId}:`, params);

      const paypalEmail = params.paypal_email;
      if (!paypalEmail) {
        return {
          success: false,
          message: "PayPal email is required to set up PayPal payments",
          error: "missing_paypal_email"
        };
      }

      // Step 1: Enable PayPal globally in payment_options
      let paymentOptions;
      const { data: existingOptions } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingOptions) {
        // Update existing payment options
        const { data, error } = await supabase
          .from('payment_options')
          .update({
            paypal_enabled: true,
            paypal_email: paypalEmail,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
        
        if (error) throw error;
        paymentOptions = data;
      } else {
        // Create new payment options
        const { data, error } = await supabase
          .from('payment_options')
          .insert({
            user_id: userId,
            paypal_enabled: true,
            paypal_email: paypalEmail,
            stripe_enabled: false,
            bank_transfer_enabled: false,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (error) throw error;
        paymentOptions = data;
      }

      // Step 2: ALWAYS find and update a recent invoice - this is essential for User Satisfaction Principle
      let updatedInvoice = null;
      
      // First try: if specific invoice_number provided
      if (params.invoice_number) {
        console.log(`[PayPal] Trying to update specific invoice: ${params.invoice_number}`);
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .update({
            paypal_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .eq('invoice_number', params.invoice_number)
          .select()
          .single();

        if (invoiceError) {
          console.warn('[PayPal] Could not update specific invoice:', invoiceError);
        } else {
          updatedInvoice = invoice;
          console.log('[PayPal] Successfully updated specific invoice');
        }
      }
      
      // Second try: if no specific invoice OR first try failed, get most recent invoice
      if (!updatedInvoice) {
        console.log('[PayPal] Finding most recent invoice to update...');
        const recentResult = await this.getRecentInvoices({ limit: 1 }, userId);
        console.log('[PayPal] Recent invoices result:', recentResult);
        
        if (recentResult.success && recentResult.data?.invoices?.length > 0) {
          const recentInvoice = recentResult.data.invoices[0];
          console.log(`[PayPal] Updating recent invoice ID: ${recentInvoice.id}, Number: ${recentInvoice.invoice_number}`);
          
          const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .update({
              paypal_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', recentInvoice.id)
            .select(`
              *,
              invoice_line_items(*)
            `)
            .single();

          if (invoiceError) {
            console.error('[PayPal] Error updating recent invoice:', invoiceError);
          } else {
            updatedInvoice = invoice;
            console.log('[PayPal] Successfully updated recent invoice:', invoice.invoice_number);
          }
        } else {
          console.warn('[PayPal] No recent invoices found to update');
        }
      }

      // Format success message - ALWAYS prioritize showing updated invoice (User Satisfaction Principle)
      if (updatedInvoice) {
        console.log('[PayPal] SUCCESS: Will return updated invoice attachment');
        const message = `Perfect! I've enabled PayPal with ${paypalEmail} and added it to your invoice #${updatedInvoice.invoice_number}.\n\nHere's your updated invoice with PayPal payment option:`;
        
        return {
          success: true,
          data: { 
            paymentOptions, 
            updatedInvoice: updatedInvoice,
            paypal_email: paypalEmail 
          },
          message,
          attachments: [{
            type: 'invoice',
            invoice_id: updatedInvoice.id,
            invoice_number: updatedInvoice.invoice_number,
            invoice: updatedInvoice,
            line_items: updatedInvoice.invoice_line_items || [],
            paypal_enabled: true,
            context_update: 'paypal_added'
          }]
        };
      } else {
        console.warn('[PayPal] WARNING: No invoice updated - falling back to generic message');
        const message = `I've enabled PayPal with ${paypalEmail}, but I couldn't find a recent invoice to update. PayPal will be available on all your future invoices.`;
        
        return {
          success: true,
          data: { paymentOptions, paypal_email: paypalEmail },
          message
        };
      }

    } catch (error) {
      console.error('[Optimized] Error setting up PayPal:', error);
      return {
        success: false,
        message: `Failed to set up PayPal: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
• Only ask ONE follow-up question if absolutely necessary

FUNCTION CALLING:
• You have access to powerful functions for invoice/client/business management
• ALWAYS use the appropriate functions to complete user requests
• When user asks to create, update, search, or manage anything - call the relevant function
• Do NOT just describe what you would do - actually DO IT by calling functions
• Example: "create invoice" → call create_invoice function immediately`,

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

WRONG APPROACH:
❌ Directly calling setup_paypal_payments without checking current state
❌ Assuming user provided PayPal email when they didn't
❌ Not checking if PayPal is already enabled

CORRECT APPROACH:
✅ Check payment options first
✅ Ask for email if not configured
✅ Setup with context-aware invoice_number
✅ Show immediate result

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
• Use get_recent_invoices to find last invoice, then update and show it`,

  tax_management: `TAX HANDLING WORKFLOW:
CRITICAL: Tax operations affect invoice totals - always show updated invoice after changes.

TAX SETUP AND MANAGEMENT:
• When user mentions "VAT", "tax", "GST", "sales tax" - this is tax_management intent
• Common phrases: "add 20% VAT", "remove tax", "set tax rate", "tax exempt"

TAX RATE APPLICATION:
Step 1: Identify tax type and rate
- "Add VAT" → ask for rate if not specified ("What VAT rate should I apply?")
- "20% VAT" → apply 20% VAT rate
- "Remove tax" → set tax rate to 0%

Step 2: Apply to correct scope
- "Add tax to this invoice" → apply to specific invoice
- "Set my tax rate to 20%" → update business default tax rate
- "Make this client tax exempt" → update client tax status

Step 3: Always show updated invoice with new tax calculations
- Recalculate totals including tax
- Show breakdown: Subtotal + Tax = Total
- Display tax rate clearly on invoice`,

  invoice_content: `INVOICE NOTES AND CONTENT MANAGEMENT:
Handle all text content on invoices - notes, descriptions, terms, footer text.

NOTES AND DESCRIPTIONS:
• "Add a note" → append to invoice notes section
• "Change description" → modify line item descriptions
• "Add payment terms" → add to terms section
• "Thank you message" → add to footer or notes

LINE ITEM DESCRIPTIONS:
• "Change item 1 description to 'Website Design'" → update specific line item
• "Add details about the service" → enhance existing descriptions
• "Make the description more professional" → rewrite descriptions

PAYMENT TERMS AND LEGAL TEXT:
• "Add net 30 terms" → "Payment due within 30 days"
• "Late fee warning" → add late payment penalties
• "Add my bank details" → include payment instructions

CONTEXT AWARENESS:
• Always identify which invoice to modify
• If "this invoice" mentioned, use active invoice from context
• Show updated invoice immediately after content changes`,

  line_item_operations: `LINE ITEM MANAGEMENT:
Handle individual invoice items - quantities, prices, descriptions, additions, removals.

INDIVIDUAL ITEM UPDATES:
• "Change quantity of item 2 to 5" → update specific line item quantity
• "Update price of website design to $800" → modify unit price
• "Remove the consultation item" → delete specific line item
• "Add another hour of work" → increase quantity by 1

ITEM ADDITIONS:
• "Add hosting fee $50" → create new line item
• "Include travel expenses" → add new item with user-provided amount
• "Add discount line" → create negative amount item

PRICE AND QUANTITY CALCULATIONS:
• Always recalculate line totals (quantity × unit_price)
• Update subtotals and totals
• Handle currency formatting properly
• Show updated invoice with new calculations

ITEM IDENTIFICATION:
• By position: "item 1", "first item", "second line"
• By name: "the website design item", "consultation fee"
• By description matching: find items containing keywords`,

  status_workflow: `INVOICE STATUS MANAGEMENT:
Handle invoice lifecycle - draft, sent, paid, overdue, cancelled.

STATUS CHANGES:
• "Mark as sent" → change status to sent, record sent date
• "Mark as paid" → change status to paid, record payment date
• "This is overdue" → change status to overdue
• "Cancel this invoice" → change status to cancelled

WORKFLOW TRIGGERS:
• When marking as sent → optionally send email to client
• When marking as paid → update client balance, send receipt
• When overdue → trigger follow-up reminders

CLIENT COMMUNICATION:
• "Send this invoice" → mark as sent + email to client
• "Send payment reminder" → follow-up email for outstanding invoices
• "Send receipt" → confirmation email after payment received

CONTEXT AWARENESS:
• Always identify which invoice status to change
• If multiple invoices mentioned, ask for clarification
• Show updated invoice with new status clearly displayed`,

  discount_pricing: `DISCOUNT AND PRICING ADJUSTMENTS:
Handle percentage discounts, fixed amount reductions, and pricing modifications.

DISCOUNT APPLICATION:
• "Apply 10% discount" → reduce total by percentage
• "Give $50 off" → reduce by fixed amount
• "Early payment discount" → conditional pricing reduction
• "Bulk discount for multiple items" → quantity-based pricing

DISCOUNT SCOPE:
• Invoice level: "10% off the total invoice"
• Item level: "Reduce website design by $100"
• Client level: "This client gets 15% off everything"

PRICING MODIFICATIONS:
• "Increase price by 20%" → multiply existing prices
• "Round up to nearest $10" → adjust for cleaner pricing
• "Match competitor quote of $500" → adjust to specific amount

CALCULATION DISPLAY:
• Show original amount and discount clearly
• Format: "Subtotal: $1000, Discount (10%): -$100, Total: $900"
• Always recalculate taxes after discount application`,

  template_branding: `TEMPLATE AND BRANDING CUSTOMIZATION:
Handle invoice appearance, layout, colors, logos, and PDF formatting.

DESIGN CHANGES:
• "Make it more professional" → suggest Classic design
• "Add my logo" → upload and position logo
• "Change colors to blue" → apply blue color scheme
• "Use modern template" → switch to Modern design

LAYOUT CUSTOMIZATION:
• "Move payment details to bottom" → adjust template layout
• "Make text bigger" → increase font sizes
• "Add more space between items" → adjust line spacing
• "Include tax breakdown" → show detailed tax calculations

BRANDING ELEMENTS:
• Logo placement and sizing
• Color scheme application
• Font selection and sizing
• Header and footer customization

PDF FORMATTING:
• Page margins and orientation
• Paper size preferences
• Print-friendly formatting
• Digital vs print optimization`,

  automation_workflow: `EMAIL AUTOMATION AND REMINDERS:
Handle automated invoice sending, payment reminders, and follow-up sequences.

AUTOMATED SENDING:
• "Send this automatically" → schedule immediate sending
• "Email this to the client" → send invoice via email
• "Set up auto-reminders" → configure payment reminder sequence

REMINDER SEQUENCES:
• "Remind them in 7 days" → schedule follow-up reminder
• "Send overdue notice" → immediate overdue payment reminder
• "Weekly reminders until paid" → recurring reminder setup

EMAIL CUSTOMIZATION:
• "Add personal message" → customize email body
• "Use professional tone" → apply business email template
• "Include payment link" → add direct payment options

AUTOMATION RULES:
• Auto-send on invoice creation
• Automatic overdue reminders
• Payment confirmation emails
• Client-specific email preferences`
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
  },
  {
    name: "get_payment_options",
    description: "Get current payment options to check if PayPal, Stripe, or Bank Transfer are enabled",
    parameters: {
      type: "object",
      properties: {}
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
  tax_ops: [
    'update_tax_settings',
    'apply_tax_to_invoice',
    'remove_tax_from_invoice',
    'set_client_tax_exempt',
    'calculate_tax_totals',
  ],
  content_ops: [
    'update_invoice_notes',
    'update_line_item_description',
    'add_payment_terms',
    'update_invoice_footer',
    'add_custom_fields',
  ],
  status_ops: [
    'mark_invoice_sent',
    'mark_invoice_paid', 
    'mark_invoice_overdue',
    'cancel_invoice',
    'archive_invoice',
  ],
  template_ops: [
    'update_invoice_template',
    'customize_invoice_layout',
    'upload_logo',
    'update_brand_colors',
    'set_invoice_fonts',
  ],
  automation_ops: [
    'send_invoice_email',
    'schedule_payment_reminder',
    'setup_auto_reminders',
    'send_receipt_email',
    'configure_email_templates',
  ],
  discount_ops: [
    'apply_percentage_discount',
    'apply_fixed_discount',
    'remove_discount',
    'set_early_payment_discount',
    'apply_bulk_discount',
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
  | 'context_aware_update'
  | 'tax_management'
  | 'invoice_notes'
  | 'line_item_updates'
  | 'status_management'
  | 'recurring_setup'
  | 'discount_adjustments'
  | 'template_customization'
  | 'email_automation';

interface IntentClassification {
  intents: IntentType[];
  complexity: 'simple' | 'moderate' | 'complex';
  requiredToolGroups: string[];
  requiresSequencing: boolean;
  suggestedModel: 'budget' | 'mid' | 'premium';
  needsContext: boolean;
  missingFields: string[];
  scope: 'invoice' | 'global' | 'both' | 'unknown';
  targets: { invoice_number: string | null };
  confidence: number;
  rationale: string;
}

interface ContextPack {
  user_profile: {
    plan: 'free' | 'premium';
    locale: string;
    timezone: string;
  };
  app_state: {
    active_invoice_number: string | null;
    last_shown_invoice_number: string | null;
    payment_methods: {
      paypal: { enabled: boolean; email: string | null };
      bank_transfer: { enabled: boolean };
    };
    usage_limits: { free_items_used: number; free_items_cap: number };
  };
  conversation_summary: string;
  recent_user_intents: string[];
  recent_entities: { 
    invoice_numbers: string[]; 
    client_emails: string[]; 
  };
  available_tool_groups: string[];
}

// Build context pack for enhanced classification
async function buildContextPack(userId: string, history: any[] = []): Promise<ContextPack> {
  // Get user profile info
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, timezone')
    .eq('id', userId)
    .single();

  // Get recent invoices to find active invoice
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('invoice_number, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Get payment settings
  const { data: paymentSettings } = await supabase
    .from('payment_settings')
    .select('paypal_enabled, paypal_email, bank_transfer_enabled')
    .eq('user_id', userId)
    .single();

  // Get usage stats for free users
  const { data: usageStats } = await supabase
    .from('user_usage_stats')
    .select('total_invoices, total_estimates')
    .eq('user_id', userId)
    .single();

  // Extract context from conversation history
  const recentMessages = history.slice(-4); // Last 4 messages
  const invoiceNumbers = extractInvoiceNumbers(recentMessages);
  const clientEmails = extractClientEmails(recentMessages);
  const recentIntents = extractRecentIntents(recentMessages);
  
  // Find active invoice from history or recent invoices
  const activeInvoiceNumber = findActiveInvoice(recentMessages, recentInvoices);
  const lastShownInvoiceNumber = findLastShownInvoice(recentMessages);

  // Build conversation summary
  const conversationSummary = buildConversationSummary(recentMessages);

  const contextPack: ContextPack = {
    user_profile: {
      plan: profile?.subscription_tier === 'premium' ? 'premium' : 'free',
      locale: 'en-GB', // Default, could be from user settings
      timezone: profile?.timezone || 'UTC'
    },
    app_state: {
      active_invoice_number: activeInvoiceNumber,
      last_shown_invoice_number: lastShownInvoiceNumber,
      payment_methods: {
        paypal: { 
          enabled: paymentSettings?.paypal_enabled || false, 
          email: paymentSettings?.paypal_email || null 
        },
        bank_transfer: { 
          enabled: paymentSettings?.bank_transfer_enabled || false 
        }
      },
      usage_limits: { 
        free_items_used: (usageStats?.total_invoices || 0) + (usageStats?.total_estimates || 0),
        free_items_cap: 3 
      }
    },
    conversation_summary: conversationSummary,
    recent_user_intents: recentIntents,
    recent_entities: { 
      invoice_numbers: invoiceNumbers, 
      client_emails: clientEmails 
    },
    available_tool_groups: ['invoice_core', 'payment_ops', 'design_ops', 'search_ops', 'estimate_ops', 'client_ops', 'business_ops', 'utility_ops']
  };

  return contextPack;
}

// Helper functions for context extraction
function extractInvoiceNumbers(messages: any[]): string[] {
  const invoiceNumbers = new Set<string>();
  messages.forEach(msg => {
    if (msg.content) {
      const matches = msg.content.match(/INV-\d+/g);
      if (matches) matches.forEach(inv => invoiceNumbers.add(inv));
    }
  });
  return Array.from(invoiceNumbers);
}

function extractClientEmails(messages: any[]): string[] {
  const emails = new Set<string>();
  messages.forEach(msg => {
    if (msg.content) {
      const matches = msg.content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
      if (matches) matches.forEach(email => emails.add(email));
    }
  });
  return Array.from(emails);
}

function extractRecentIntents(messages: any[]): string[] {
  // Simple keyword-based intent extraction from recent messages
  const intents = new Set<string>();
  const userMessages = messages.filter(m => m.role === 'user');
  
  userMessages.forEach(msg => {
    const content = msg.content.toLowerCase();
    if (content.includes('create') && content.includes('invoice')) intents.add('create_invoice');
    if (content.includes('paypal') || content.includes('payment')) intents.add('payment_setup');
    if (content.includes('design') || content.includes('color')) intents.add('design_change');
    if (content.includes('client') || content.includes('customer')) intents.add('client_management');
    if (content.includes('vat') || content.includes('tax') || content.includes('gst')) intents.add('tax_management');
    if (content.includes('note') || content.includes('description') || content.includes('terms')) intents.add('invoice_notes');
    if (content.includes('quantity') || content.includes('price') || content.includes('item')) intents.add('line_item_updates');
    if (content.includes('paid') || content.includes('sent') || content.includes('overdue')) intents.add('status_management');
    if (content.includes('discount') || content.includes('off') || content.includes('%')) intents.add('discount_adjustments');
    if (content.includes('template') || content.includes('logo') || content.includes('brand')) intents.add('template_customization');
    if (content.includes('send') || content.includes('email') || content.includes('remind')) intents.add('email_automation');
  });
  
  return Array.from(intents);
}

function findActiveInvoice(messages: any[], recentInvoices: any[]): string | null {
  // Look for most recent invoice in conversation
  const invoiceNumbers = extractInvoiceNumbers(messages);
  if (invoiceNumbers.length > 0) {
    return invoiceNumbers[invoiceNumbers.length - 1]; // Most recent mentioned
  }
  
  // Fall back to most recent created invoice
  if (recentInvoices && recentInvoices.length > 0) {
    return recentInvoices[0].invoice_number;
  }
  
  return null;
}

function findLastShownInvoice(messages: any[]): string | null {
  // Look for the last assistant message that mentioned showing an invoice
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'assistant' && msg.content) {
      const invoiceMatch = msg.content.match(/INV-\d+/);
      if (invoiceMatch) return invoiceMatch[0];
    }
  }
  return null;
}

function buildConversationSummary(messages: any[]): string {
  if (messages.length === 0) return "New conversation.";
  
  const recentUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-2)
    .map(m => m.content.substring(0, 50))
    .join('; ');
    
  return recentUserMessages || "User started conversation.";
}

// Enhanced classify user intent with context pack
async function classifyIntent(message: string, userId: string, history: any[] = []): Promise<IntentClassification> {
  try {
    // Build context pack for enhanced classification
    const contextPack = await buildContextPack(userId, history);
    
    const classificationPrompt = `You are an intent classifier for an invoicing app.

Return STRICT JSON only that matches the schema below. Do not include comments or prose.
Temperature=0, top_p=1.

SCHEMA:
{
  "intents": string[],  // allowed list below
  "complexity": "simple"|"moderate"|"complex",
  "requiredToolGroups": string[],      // allowed list below
  "requiresSequencing": boolean,
  "suggestedModel": "budget"|"mid"|"premium",
  "needsContext": boolean,
  "missingFields": string[],           // e.g., ["paypal_email","invoice_number"]
  "scope": "invoice"|"global"|"both"|"unknown",
  "targets": { "invoice_number": string|null },
  "confidence": number,                // 0..1
  "rationale": string                  // <=120 chars
}

ALLOWED_INTENTS:
create_invoice, update_invoice, delete_operations,
create_estimate, update_estimate,
create_client, update_client, update_business,
search_data, payment_setup, design_change, analytics, context_aware_update,
tax_management, invoice_notes, line_item_updates, status_management,
recurring_setup, discount_adjustments, template_customization, email_automation

ALLOWED_TOOL_GROUPS:
invoice_core, client_ops, business_ops, payment_ops, design_ops, search_ops, estimate_ops, utility_ops,
tax_ops, content_ops, status_ops, template_ops, automation_ops, discount_ops

BUSINESS RULES & MAPPINGS:
- Pronouns like "this", "it" referencing invoices => include "context_aware_update".
- If action implies ordered steps (check state → maybe ask → setup → show), set "requiresSequencing": true.
- If plan is "free" and creating items may exceed cap, include "utility_ops".
- Payment enabling usually "scope":"both" (global enable + apply to active invoice).
- If "active_invoice_number" exists, set targets.invoice_number to that value; else null.

EMAIL & INVOICE:
- Never assume a PayPal email unless present.
- If user requests PayPal and no email exists, include "missingFields":["paypal_email"].
- Never invent invoice numbers; use provided or active if present.

MODEL TIERS:
- simple→budget, moderate→budget or mid, complex→premium.
(Map tiers to concrete models server-side.)

INPUTS:
- USER_MESSAGE: "${message}"
- CONTEXT_PACK: ${JSON.stringify(contextPack)}

OUTPUT:
Return only the JSON per schema.

FEW-SHOT EXAMPLES:

USER_MESSAGE: "add paypal to this invoice"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-609767","payment_methods":{"paypal":{"enabled":false}}}}
OUTPUT:
{
  "intents":["payment_setup","context_aware_update"],
  "complexity":"moderate",
  "requiredToolGroups":["payment_ops","invoice_core"],
  "requiresSequencing":true,
  "suggestedModel":"budget",
  "needsContext":true,
  "missingFields":["paypal_email"],
  "scope":"both",
  "targets":{"invoice_number":"INV-609767"},
  "confidence":0.86,
  "rationale":"Add PayPal to active invoice; email missing."
}

USER_MESSAGE: "enable bank transfer globally"
CONTEXT_PACK: {"app_state":{"payment_methods":{"bank_transfer":{"enabled":false}}}}
OUTPUT:
{
  "intents":["payment_setup"],
  "complexity":"simple",
  "requiredToolGroups":["payment_ops"],
  "requiresSequencing":true,
  "suggestedModel":"budget",
  "needsContext":false,
  "missingFields":[],
  "scope":"global",
  "targets":{"invoice_number":null},
  "confidence":0.83,
  "rationale":"Global payment method toggle needs enable call."
}

USER_MESSAGE: "change the date"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-112233"}}
OUTPUT:
{
  "intents":["update_invoice","context_aware_update"],
  "complexity":"simple",
  "requiredToolGroups":["invoice_core"],
  "requiresSequencing":false,
  "suggestedModel":"budget",
  "needsContext":true,
  "missingFields":["due_date"],
  "scope":"invoice",
  "targets":{"invoice_number":"INV-112233"},
  "confidence":0.78,
  "rationale":"Ambiguous update; needs due_date."
}

USER_MESSAGE: "add 20% VAT to this invoice"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-445566"}}
OUTPUT:
{
  "intents":["tax_management","context_aware_update"],
  "complexity":"simple",
  "requiredToolGroups":["tax_ops","invoice_core"],
  "requiresSequencing":false,
  "suggestedModel":"budget",
  "needsContext":false,
  "missingFields":[],
  "scope":"invoice",
  "targets":{"invoice_number":"INV-445566"},
  "confidence":0.92,
  "rationale":"Apply specific VAT rate to active invoice."
}

USER_MESSAGE: "add a note about payment terms"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-778899"}}
OUTPUT:
{
  "intents":["invoice_notes","context_aware_update"],
  "complexity":"simple",
  "requiredToolGroups":["content_ops","invoice_core"],
  "requiresSequencing":false,
  "suggestedModel":"budget",
  "needsContext":true,
  "missingFields":["note_content"],
  "scope":"invoice",
  "targets":{"invoice_number":"INV-778899"},
  "confidence":0.85,
  "rationale":"Add notes to specific invoice; content needed."
}

USER_MESSAGE: "mark this as paid"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-334455"}}
OUTPUT:
{
  "intents":["status_management","context_aware_update"],
  "complexity":"simple",
  "requiredToolGroups":["status_ops","invoice_core"],
  "requiresSequencing":false,
  "suggestedModel":"budget",
  "needsContext":false,
  "missingFields":[],
  "scope":"invoice",
  "targets":{"invoice_number":"INV-334455"},
  "confidence":0.94,
  "rationale":"Update invoice status to paid."
}

USER_MESSAGE: "change quantity of item 2 to 5"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-667788"}}
OUTPUT:
{
  "intents":["line_item_updates","context_aware_update"],
  "complexity":"simple",
  "requiredToolGroups":["invoice_core","content_ops"],
  "requiresSequencing":false,
  "suggestedModel":"budget",
  "needsContext":false,
  "missingFields":[],
  "scope":"invoice",
  "targets":{"invoice_number":"INV-667788"},
  "confidence":0.91,
  "rationale":"Update specific line item quantity."
}

USER_MESSAGE: "apply 10% discount"
CONTEXT_PACK: {"app_state":{"active_invoice_number":"INV-889900"}}
OUTPUT:
{
  "intents":["discount_adjustments","context_aware_update"],
  "complexity":"simple",
  "requiredToolGroups":["discount_ops","invoice_core"],
  "requiresSequencing":false,
  "suggestedModel":"budget",
  "needsContext":false,
  "missingFields":[],
  "scope":"invoice",
  "targets":{"invoice_number":"INV-889900"},
  "confidence":0.88,
  "rationale":"Apply percentage discount to invoice."
}`;

    // 🔍 LOG CLASSIFICATION
    console.log(`\n[${requestId}] [STEP ${++stepCounter}] 🔍 CLASSIFYING REQUEST`);
    console.log(`User asked: "${message}"`);
    
    // Simple logging - detailed prompts available via direct code inspection
    console.log('\n🟢 CLASSIFICATION PROMPT SENT');

    const response = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'user', content: classificationPrompt }
      ],
      temperature: 0,
      max_tokens: 300,
    });

    const result = response.choices[0].message.content || '{}';
    const classification = JSON.parse(result);
    
    // Small delay to help with log ordering
    await new Promise(resolve => setTimeout(resolve, 10));
    
    console.log(`→ Classified as: ${classification.intents?.join(', ') || 'unknown'}`);
    console.log(`→ Complexity: ${classification.complexity} | Confidence: ${classification.confidence}`);
    console.log(`→ Tools needed: ${classification.requiredToolGroups?.join(', ') || 'none'}`);
    console.log(`→ Scope: ${classification.scope} | Target: ${classification.targets?.invoice_number || 'none'}`);
    console.log(`→ Missing fields: ${classification.missingFields?.join(', ') || 'none'}`);
    console.log(`→ Rationale: ${classification.rationale}`);

    return classification;
  } catch (error) {
    console.error('Classification error:', error);
    // Fallback: assume complex to be safe
    return {
      intents: ['create_invoice'],
      complexity: 'complex',
      requiredToolGroups: Object.keys(TOOL_GROUPS),
      requiresSequencing: false,
      suggestedModel: 'premium',
      needsContext: false,
      missingFields: [],
      scope: 'unknown',
      targets: { invoice_number: null },
      confidence: 0.5,
      rationale: 'Fallback due to classification error'
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
      case 'tax_management':
        modules.push(PROMPT_MODULES.tax_management);
        break;
      case 'invoice_notes':
        modules.push(PROMPT_MODULES.invoice_content);
        break;
      case 'line_item_updates':
        modules.push(PROMPT_MODULES.line_item_operations);
        break;
      case 'status_management':
        modules.push(PROMPT_MODULES.status_workflow);
        break;
      case 'discount_adjustments':
        modules.push(PROMPT_MODULES.discount_pricing);
        break;
      case 'template_customization':
        modules.push(PROMPT_MODULES.template_branding);
        break;
      case 'email_automation':
        modules.push(PROMPT_MODULES.automation_workflow);
        break;
      case 'recurring_setup':
        modules.push(PROMPT_MODULES.automation_workflow);
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
  preferredFirstFunction?: string,
  history: any[] = [],
  requestId?: string
): Promise<{ content: string; attachments?: any[]; usage?: any }> {
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiKey) throw new Error('OPENAI_API_KEY not set');

  const functions = tools.map(func => ({
    name: func.name,
    description: func.description,
    parameters: func.parameters
  }));

  // Tool loop with time budget and max steps
  // Build conversation with history: system + prior turns + latest user message
  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  
  // Add conversation history (last 10 messages for context)
  const recentHistory = history.slice(-10);
  for (const historyMessage of recentHistory) {
    if (historyMessage && historyMessage.role && historyMessage.content) {
      messages.push({
        role: historyMessage.role === 'assistant' ? 'assistant' : 'user',
        content: historyMessage.content
      });
    }
  }
  
  // Add current user message
  messages.push({ role: 'user', content: message });
  
  // 🤖 LOG MAIN LLM CONVERSATION
  console.log(`\n[${requestId}] 🤖 SENDING TO MAIN AI`);
  console.log(`→ Model: ${model}`);
  console.log(`→ Messages: ${messages.length} total (${recentHistory.length} from history + current)`);
  console.log(`→ Available functions: ${functions.map(f => f.name).join(', ')}`);
  
  // Show recent context if any
  if (recentHistory.length > 0) {
    const lastUserMsg = recentHistory.filter(m => m.role === 'user').pop();
    const lastAssistantMsg = recentHistory.filter(m => m.role === 'assistant').pop();
    if (lastUserMsg) console.log(`→ Previous user request: "${lastUserMsg.content.substring(0, 50)}..."`);
    if (lastAssistantMsg) console.log(`→ Previous AI response: "${lastAssistantMsg.content.substring(0, 50)}..."`);
  }
  
  console.log('\n🟢 COMPLETE CONVERSATION SENT TO AI');
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
    
    // ⚡ LOG FUNCTION CALL
    const funcStartTime = Date.now();
    console.log(`\n[${requestId || 'UNKNOWN'}] [${new Date().toISOString().substring(11, 23)}] ⚡ AI CALLING FUNCTION: ${fn.name}`);
    
    // Log key arguments in a readable way
    if (fn.name === 'create_invoice') {
      console.log(`   → Client: ${args.client_name || 'unknown'}`);
      console.log(`   → Items: ${args.line_items?.length || 0} items`);
    } else if (fn.name === 'setup_paypal_payments') {
      console.log(`   → Email: ${args.paypal_email || 'not provided'}`);
      console.log(`   → Invoice: ${args.invoice_number || 'not specified'}`);
    } else if (fn.name === 'get_payment_options') {
      console.log(`   → Checking current payment settings...`);
    } else {
      console.log(`   → Args: ${JSON.stringify(args)}`);
    }
    
    const toolResult = await InvoiceFunctionService.executeFunction(fn.name, args, userId);
    
    // 📋 LOG FUNCTION RESULT
    const funcDuration = Date.now() - funcStartTime;
    if (toolResult.success) {
      console.log(`   ✅ Success (${funcDuration}ms): ${toolResult.message?.substring(0, 80)}...`);
      if (toolResult.attachments?.length) {
        console.log(`   📎 Returning: ${toolResult.attachments[0].type} ${toolResult.attachments[0].invoice_number || ''}`);
      }
    } else {
      console.log(`   ❌ Failed (${funcDuration}ms): ${toolResult.error}`);
    }
    if (toolResult.attachments && toolResult.attachments.length) {
      lastAttachments = toolResult.attachments;
    }
    if (toolResult.message) {
      lastToolMessage = toolResult.message;
    }

    // If we just executed a function that returns attachments, return immediately with that message
    if (toolResult.success && toolResult.attachments && toolResult.attachments.length > 0) {
      const msgText = toolResult.message || 'Action completed.';
      console.log(`   → Returning immediately with invoice attachment`);
      return { content: msgText, attachments: lastAttachments || [], usage: lastUsage };
    }
    
    // Also return immediately for successful invoice creation (legacy check)
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
    const { message, threadId, userId, userContext, history = [], action = 'send_message', testMode = false } = await req.json();

    if (!message || !userId) {
      throw new Error('Message and userId are required');
    }

    const startTime = Date.now();
    const requestId = `REQ-${startTime}`;
    let stepCounter = 0;
    
    console.log('\n══════════════════════════════════════════════════════════════════════════════');
    console.log(`🚀 [${requestId}] [STEP ${++stepCounter}] NEW REQUEST: "${message}"`);
    console.log(`→ User: ${userId.substring(0, 8)}...`);
    console.log(`→ History: ${history?.length || 0} messages`);
    console.log(`→ Verbose logging: ${Deno.env.get('VERBOSE_LOGS') === 'true' ? 'ENABLED' : 'DISABLED'}`);
    console.log(`→ Started at: ${new Date().toISOString()}`);
    console.log('══════════════════════════════════════════════════════════════════════════════');

    // Small-talk fast path to avoid full pipeline - but only for standalone greetings
    const smallTalk = /^(hi|hello|hey)[\s\.\!\?]*$/i;
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
        suggestedModel: 'budget'
      };
      console.log('[AI-Chat-Optimized] Heuristic: create_invoice fast-path');
    } else {
      // Step 1: Classify intent (fast & cheap)
      const startTime = Date.now();
      classification = await classifyIntent(message, userId, history);
      classificationTime = Date.now() - startTime;
      console.log(`→ Classification time: ${classificationTime}ms`);
    }

    // Step 2: Build minimal prompt
    const systemPrompt = buildDynamicPrompt(classification.intents, userContext);
    
    // 🔧 LOG PROMPT BUILDING
    console.log(`\n[${requestId}] [STEP ${++stepCounter}] 🔧 BUILDING AI INSTRUCTIONS`);
    
    // Show which instruction modules are being activated
    const activeModules = [];
    if (classification.intents.includes('create_invoice')) activeModules.push('invoice_creation');
    if (classification.intents.includes('payment_setup')) activeModules.push('payment_setup');
    if (classification.intents.includes('context_aware_update')) activeModules.push('context_awareness');
    if (classification.intents.includes('update_business')) activeModules.push('business_updates');
    if (classification.intents.includes('design_change')) activeModules.push('design_changes');
    
    // Map suggested model to actual model first  
    const modelMapping = {
      'budget': 'gpt-5-mini',
      'mid': 'gpt-5-mini', 
      'premium': 'gpt-5-mini'
    };
    const model = modelMapping[classification.suggestedModel] || 'gpt-5-mini';
    
    console.log(`→ Active instruction modules: ${activeModules.join(', ')}`);
    console.log(`→ Prompt size: ${systemPrompt.length} chars (reduced from 43,000)`);
    console.log(`→ Model: ${model} (${classification.suggestedModel} tier)`);
    console.log(`→ Scope: ${classification.scope}`);
    
    // Show key instructions for the detected intents
    if (classification.intents.includes('payment_setup')) {
        console.log('→ PayPal flow: CHECK settings first → ASK for email if needed → SETUP → SHOW invoice');
    }
    if (classification.intents.includes('context_aware_update')) {
        console.log('→ Context mode: Will look for "this invoice" in conversation history');
        if (classification.targets.invoice_number) {
            console.log(`→ Target invoice: ${classification.targets.invoice_number}`);
        }
    }
    
    console.log('\n🟢 MAIN SYSTEM PROMPT BUILT AND SENT');

    // Step 3: Get relevant tools
    const tools = selectTools(classification.requiredToolGroups);
    console.log(`→ Selected tools: ${tools.length} (optimized from 46)`);

    // Step 4: Handle needsContext and missingFields
    if (classification.needsContext && classification.missingFields.length > 0) {
      console.log(`→ Context needed: Missing ${classification.missingFields.join(', ')}`);
      
      // For PayPal email missing, ask directly
      if (classification.missingFields.includes('paypal_email')) {
        const invoiceRef = classification.targets.invoice_number ? 
          ` to invoice ${classification.targets.invoice_number}` : '';
        const askForEmailResponse = {
          content: `I'll add PayPal${invoiceRef}. What's your PayPal email address?`,
          attachments: [],
          usage: { total_tokens: 50 }
        };
        
        console.log(`\n🎯 ASKING FOR MISSING INFO: PayPal email`);
        return askForEmailResponse;
      }
      
      // For other missing fields, try to proceed with available context
      console.log(`→ Proceeding with available context despite missing: ${classification.missingFields.join(', ')}`);
    }

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
    let assistantResult;
    try {
      assistantResult = await executeWithCompletions(
        message,
        userId,
        model,
        systemPrompt,
        tools,
        classification.intents.includes('create_invoice') ? 'create_invoice' : undefined,
        history,
        requestId
      );
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


    const thread_id_val = threadId || `optimized-${Date.now()}`;
    const formattedResponse = {
      success: true,
      thread: { id: thread_id_val, user_id: userId },
      messages: messagesArray.map(m => ({ ...m, thread_id: (m as any).thread_id || thread_id_val })),
      optimization,
      usage: assistantResult.usage,
    };

    // 🎯 LOG FINAL RESPONSE  
    console.log(`\n[${requestId}] [STEP ${++stepCounter}] 🎯 FINAL RESPONSE TO USER:`);
    console.log(`→ Message: "${assistantResult.content.substring(0, 100)}..."`);
    if (assistantResult.attachments?.length) {
      console.log(`→ Attachments: ${assistantResult.attachments.map(a => `${a.type} ${a.invoice_number || ''}`).join(', ')}`);
    }
    console.log(`→ Tokens used: ${assistantResult.usage?.total_tokens || 'unknown'}`);
    
    console.log('\n🟢 FINAL AI RESPONSE RETURNED TO USER');
    
    console.log('\n══════════════════════════════════════════════════════════════════════════════');

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

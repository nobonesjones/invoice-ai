import { supabase } from '@/config/supabase';
import { OpenAIFunction } from '@/services/openaiService';
import { UsageService } from '@/services/usageService';

// Function definitions for OpenAI
export const INVOICE_FUNCTIONS: OpenAIFunction[] = [
  {
    name: "create_invoice",
    description: "Create a new invoice with client details and line items. If client doesn't exist, they will be created automatically.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Name of the client for this invoice"
        },
        client_email: {
          type: "string",
          description: "Email address of the client (optional)"
        },
        client_phone: {
          type: "string",
          description: "Phone number of the client (optional)"
        },
        client_address: {
          type: "string",
          description: "Address of the client (optional)"
        },
        invoice_date: {
          type: "string",
          format: "date",
          description: "Invoice date (YYYY-MM-DD). If not provided, uses today's date"
        },
        due_date: {
          type: "string",
          format: "date",
          description: "Due date for payment (YYYY-MM-DD). If not provided, calculates based on payment terms"
        },
        payment_terms_days: {
          type: "number",
          default: 30,
          description: "Number of days from invoice date until payment is due (used if due_date not provided)"
        },
        line_items: {
          type: "array",
          description: "Array of items/services being invoiced",
          items: {
            type: "object",
            properties: {
              item_name: {
                type: "string",
                description: "Name of the item/service"
              },
              item_description: {
                type: "string",
                description: "Description of the item/service (optional)"
              },
              quantity: {
                type: "number",
                default: 1,
                description: "Quantity of the item"
              },
              unit_price: {
                type: "number",
                description: "Price per unit"
              }
            },
            required: ["item_name", "unit_price"]
          },
          minItems: 1
        },
        tax_percentage: {
          type: "number",
          default: 0,
          description: "Tax percentage to apply (e.g., 8.5 for 8.5%)"
        },
        discount_type: {
          type: "string",
          enum: ["percentage", "fixed"],
          description: "Type of discount to apply"
        },
        discount_value: {
          type: "number",
          default: 0,
          description: "Discount value (percentage or fixed amount)"
        },
        notes: {
          type: "string",
          description: "Additional notes for the invoice (optional)"
        },
        custom_headline: {
          type: "string",
          description: "Custom headline/title for the invoice (optional)"
        }
      },
      required: ["client_name", "line_items"]
    }
  },
  {
    name: "create_client",
    description: "Create a new client/customer/contact record without creating an invoice. Use this when the user wants to add a new client, customer, contact, or business partner to their database.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the client, customer, or company"
        },
        email: {
          type: "string",
          format: "email",
          description: "Email address of the client/customer (optional)"
        },
        phone: {
          type: "string",
          description: "Phone number of the client/customer (optional)"
        },
        address: {
          type: "string",
          description: "Address of the client/customer (optional)"
        },
        notes: {
          type: "string",
          description: "Additional notes about the client/customer (optional)"
        }
      },
      required: ["name"]
    }
  },
  {
    name: "search_clients",
    description: "Search for existing clients/customers by name or email. Use this before creating invoices to find existing clients.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Client/customer name to search for (partial matches supported)"
        },
        email: {
          type: "string",
          description: "Client email to search for"
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum number of results to return"
        }
      }
    }
  },
  {
    name: "update_client",
    description: "Update an existing client's details like email, phone, address, or notes. Use this when user wants to edit or update client information.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Current name of the client to update (used to find the client)"
        },
        client_id: {
          type: "string",
          description: "Client ID if known (alternative to client_name)"
        },
        new_name: {
          type: "string",
          description: "New name for the client (optional)"
        },
        email: {
          type: "string",
          format: "email",
          description: "New email address (optional)"
        },
        phone: {
          type: "string",
          description: "New phone number (optional)"
        },
        address: {
          type: "string",
          description: "New address (optional)"
        },
        notes: {
          type: "string",
          description: "New notes about the client (optional)"
        }
      }
    }
  },
  {
    name: "search_invoices",
    description: "Search for invoices by various criteria like client name, status, date range, or amount",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Search by client name (partial match)"
        },
        status: {
          type: "string",
          enum: ["draft", "sent", "paid", "overdue"],
          description: "Filter by invoice status"
        },
        date_from: {
          type: "string",
          format: "date",
          description: "Start date for date range filter (YYYY-MM-DD)"
        },
        date_to: {
          type: "string",
          format: "date",
          description: "End date for date range filter (YYYY-MM-DD)"
        },
        min_amount: {
          type: "number",
          description: "Minimum invoice amount"
        },
        max_amount: {
          type: "number",
          description: "Maximum invoice amount"
        },
        limit: {
          type: "number",
          default: 10,
          description: "Maximum number of results to return"
        }
      }
    }
  },
  {
    name: "get_invoice_by_number",
    description: "Get a specific invoice by its invoice number",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to search for"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "get_recent_invoices",
    description: "Get the most recent invoices for the user",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          default: 5,
          description: "Number of recent invoices to return"
        },
        status_filter: {
          type: "string",
          enum: ["all", "unpaid", "paid", "overdue"],
          default: "all",
          description: "Filter by payment status"
        }
      }
    }
  },
  {
    name: "get_invoice_summary",
    description: "Get a summary of all invoices including totals and counts",
    parameters: {
      type: "object",
      properties: {
        period: {
          type: "string",
          enum: ["this_month", "this_year", "all_time"],
          default: "this_month",
          description: "Time period for the summary"
        }
      }
    }
  },
  {
    name: "get_client_outstanding_amount",
    description: "Get the total outstanding amount for a specific client (unpaid invoices). Use when user asks 'how much does X owe me' or 'what's X's balance'.",
    parameters: {
      type: "object",
      properties: {
        client_name: {
          type: "string",
          description: "Name of the client to check outstanding balance for"
        }
      },
      required: ["client_name"]
    }
  },
  {
    name: "get_business_settings",
    description: "Get the current business settings and profile information for the user",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "update_business_settings",
    description: "Update business profile settings including company name, address, tax rates, and contact information",
    parameters: {
      type: "object",
      properties: {
        business_name: {
          type: "string",
          description: "Name of the business/company"
        },
        business_address: {
          type: "string",
          description: "Business address for invoices"
        },
        business_email: {
          type: "string",
          description: "Business email address"
        },
        business_phone: {
          type: "string",
          description: "Business phone number"
        },
        business_website: {
          type: "string",
          description: "Business website URL"
        },
        currency_code: {
          type: "string",
          description: "Currency code (e.g., USD, EUR, GBP)"
        },
        default_tax_rate: {
          type: "number",
          description: "Default tax rate percentage (e.g., 8.5 for 8.5%)"
        },
        tax_name: {
          type: "string",
          description: "Name for tax on invoices (e.g., 'VAT', 'Sales Tax', 'GST')"
        },
        auto_apply_tax: {
          type: "boolean",
          description: "Whether to automatically apply tax to new invoices"
        },
        region: {
          type: "string",
          description: "Business region/location"
        }
      }
    }
  },
  {
    name: "get_setup_progress",
    description: "Check what parts of the business profile are set up and what still needs configuration",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "set_currency",
    description: "Set the default currency for invoices. Provides suggestions for common currencies.",
    parameters: {
      type: "object",
      properties: {
        currency_code: {
          type: "string",
          description: "Three-letter currency code (e.g., USD, EUR, GBP, CAD, AUD, JPY)"
        }
      },
      required: ["currency_code"]
    }
  },
  {
    name: "set_region",
    description: "Set the business region/location. This helps with tax and legal compliance suggestions.",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "Business region or country (e.g., United States, Canada, United Kingdom, Australia, etc.)"
        }
      },
      required: ["region"]
    }
  },
  {
    name: "get_currency_options",
    description: "Get a list of common currency options with their codes and names",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "update_invoice_line_items",
    description: "Add, update, or remove line items from an existing invoice. Use this when user wants to add items to an invoice, modify existing items, or remove items.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to update (e.g., INV-001)"
        },
        action: {
          type: "string",
          enum: ["add", "update", "remove"],
          description: "Whether to add new items, update existing items, or remove items"
        },
        line_items: {
          type: "array",
          description: "Array of line items to add, update, or remove",
          items: {
            type: "object",
            properties: {
              item_id: {
                type: "string",
                description: "ID of existing line item (required for update/remove actions)"
              },
              item_name: {
                type: "string",
                description: "Name of the item/service"
              },
              item_description: {
                type: "string",
                description: "Description of the item/service (optional)"
              },
              quantity: {
                type: "number",
                default: 1,
                description: "Quantity of the item"
              },
              unit_price: {
                type: "number",
                description: "Price per unit"
              }
            },
            required: ["item_name", "unit_price"]
          }
        }
      },
      required: ["invoice_number", "action", "line_items"]
    }
  },
  {
    name: "get_invoice_details",
    description: "Get detailed information about a specific invoice including all line items. Use this to check current invoice contents before making updates.",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The invoice number to get details for (e.g., INV-001)"
        }
      },
      required: ["invoice_number"]
    }
  },
  {
    name: "update_invoice_details",
    description: "Update basic invoice information like invoice number, client details, dates, tax rates, notes, etc. (not for line items - use update_invoice_line_items for that)",
    parameters: {
      type: "object",
      properties: {
        invoice_number: {
          type: "string",
          description: "The current invoice number to update"
        },
        new_invoice_number: {
          type: "string",
          description: "New invoice number/reference to set"
        },
        client_name: {
          type: "string",
          description: "Update client name"
        },
        client_email: {
          type: "string",
          description: "Update client email"
        },
        invoice_date: {
          type: "string",
          format: "date",
          description: "Update invoice date (YYYY-MM-DD)"
        },
        due_date: {
          type: "string",
          format: "date",
          description: "Update due date (YYYY-MM-DD)"
        },
        tax_percentage: {
          type: "number",
          description: "Update tax percentage"
        },
        discount_type: {
          type: "string",
          enum: ["percentage", "fixed"],
          description: "Update discount type"
        },
        discount_value: {
          type: "number",
          description: "Update discount value"
        },
        notes: {
          type: "string",
          description: "Update invoice notes"
        },
        custom_headline: {
          type: "string",
          description: "Update custom headline"
        }
      },
      required: ["invoice_number"]
    }
  }
];

export interface InvoiceSearchParams {
  client_name?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  limit?: number;
}

export interface FunctionResult {
  success: boolean;
  data?: any;
  message: string;
  error?: string;
}

export class InvoiceFunctionService {
  static async executeFunction(
    functionName: string,
    parameters: any,
    userId: string
  ): Promise<FunctionResult> {
    try {
      switch (functionName) {
        case 'search_invoices':
          return await this.searchInvoices(parameters, userId);
        case 'get_invoice_by_number':
          return await this.getInvoiceByNumber(parameters, userId);
        case 'get_recent_invoices':
          return await this.getRecentInvoices(parameters, userId);
        case 'get_invoice_summary':
          return await this.getInvoiceSummary(parameters, userId);
        case 'create_invoice':
          return await this.createInvoice(parameters, userId);
        case 'create_client':
          return await this.createClient(parameters, userId);
        case 'search_clients':
          return await this.searchClients(parameters, userId);
        case 'get_business_settings':
          return await this.getBusinessSettings(parameters, userId);
        case 'update_business_settings':
          return await this.updateBusinessSettings(parameters, userId);
        case 'get_setup_progress':
          return await this.getSetupProgress(parameters, userId);
        case 'set_currency':
          return await this.setCurrency(parameters, userId);
        case 'set_region':
          return await this.setRegion(parameters, userId);
        case 'get_currency_options':
          return await this.getCurrencyOptions(parameters, userId);
        case 'update_invoice_line_items':
          return await this.updateInvoiceLineItems(parameters, userId);
        case 'get_invoice_details':
          return await this.getInvoiceDetails(parameters, userId);
        case 'update_invoice_details':
          return await this.updateInvoiceDetails(parameters, userId);
        case 'update_client':
          return await this.updateClient(parameters, userId);
        case 'get_client_outstanding_amount':
          return await this.getClientOutstandingAmount(parameters, userId);
        default:
          return {
            success: false,
            message: `Unknown function: ${functionName}`,
            error: 'Function not found'
          };
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return {
        success: false,
        message: 'An error occurred while executing the function',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async searchInvoices(params: InvoiceSearchParams, userId: string): Promise<FunctionResult> {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        clients!inner(name, email),
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId);

    // Apply filters
    if (params.client_name) {
      // Use proper join to search client names
      query = query.ilike('clients.name', `%${params.client_name}%`);
    }
    
    if (params.status) {
      // Handle "unpaid" status by filtering for sent and overdue
      if (params.status === 'unpaid') {
        query = query.in('status', ['sent', 'overdue']);
      } else {
        query = query.eq('status', params.status);
      }
    }
    
    if (params.date_from) {
      query = query.gte('created_at', params.date_from);
    }
    
    if (params.date_to) {
      query = query.lte('created_at', params.date_to);
    }
    
    if (params.min_amount) {
      query = query.gte('total_amount', params.min_amount);
    }
    
    if (params.max_amount) {
      query = query.lte('total_amount', params.max_amount);
    }

    const { data: invoices, error } = await query
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (error) {
      throw new Error(`Failed to search invoices: ${error.message}`);
    }

    const resultMessage = invoices?.length 
      ? `Found ${invoices.length} invoice${invoices.length === 1 ? '' : 's'} matching your criteria.`
      : 'No invoices found matching your criteria.';

    return {
      success: true,
      data: invoices || [],
      message: resultMessage
    };
  }

  private static async getInvoiceByNumber(params: { invoice_number: string }, userId: string): Promise<FunctionResult> {
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select(`
        *,
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId)
      .eq('invoice_number', params.invoice_number)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          message: `Invoice #${params.invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }
      throw new Error(`Failed to get invoice: ${error.message}`);
    }

    return {
      success: true,
      data: invoice,
      message: `Found invoice #${params.invoice_number} for ${invoice.client_name}.`
    };
  }

  private static async getRecentInvoices(params: { limit?: number; status_filter?: string }, userId: string): Promise<FunctionResult> {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId);

    // Apply status filter
    if (params.status_filter && params.status_filter !== 'all') {
      if (params.status_filter === 'unpaid') {
        query = query.in('status', ['draft', 'sent']);
      } else if (params.status_filter === 'overdue') {
        query = query.eq('status', 'overdue');
      } else {
        query = query.eq('status', params.status_filter);
      }
    }

    const { data: invoices, error } = await query
      .order('created_at', { ascending: false })
      .limit(params.limit || 5);

    if (error) {
      throw new Error(`Failed to get recent invoices: ${error.message}`);
    }

    const statusText = params.status_filter === 'all' ? '' : ` ${params.status_filter}`;
    const resultMessage = invoices?.length 
      ? `Here are your ${invoices.length} most recent${statusText} invoices.`
      : `No${statusText} invoices found.`;

    return {
      success: true,
      data: invoices || [],
      message: resultMessage
    };
  }

  private static async getInvoiceSummary(params: { period?: string }, userId: string): Promise<FunctionResult> {
    let dateFilter = '';
    const period = params.period || 'this_month';

    // Calculate date filter based on period
    const now = new Date();
    switch (period) {
      case 'this_month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = startOfMonth.toISOString();
        break;
      case 'this_year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        dateFilter = startOfYear.toISOString();
        break;
      case 'all_time':
      default:
        dateFilter = '';
        break;
    }

    let query = supabase
      .from('invoices')
      .select('status, total_amount')
      .eq('user_id', userId);

    if (dateFilter) {
      query = query.gte('created_at', dateFilter);
    }

    const { data: invoices, error } = await query;

    if (error) {
      throw new Error(`Failed to get invoice summary: ${error.message}`);
    }

    // Calculate summary statistics
    const summary = {
      total_invoices: invoices?.length || 0,
      total_amount: 0,
      paid_amount: 0,
      outstanding_amount: 0,
      draft_count: 0,
      sent_count: 0,
      paid_count: 0,
      overdue_count: 0,
      period: period
    };

    invoices?.forEach(invoice => {
      summary.total_amount += invoice.total_amount || 0;
      
      switch (invoice.status) {
        case 'draft':
          summary.draft_count++;
          break;
        case 'sent':
          summary.sent_count++;
          summary.outstanding_amount += invoice.total_amount || 0;
          break;
        case 'paid':
          summary.paid_count++;
          summary.paid_amount += invoice.total_amount || 0;
          break;
        case 'overdue':
          summary.overdue_count++;
          summary.outstanding_amount += invoice.total_amount || 0;
          break;
      }
    });

    const periodText = period === 'all_time' ? 'all time' : period.replace('_', ' ');
    let message = `Invoice summary for ${periodText}:\n`;
    message += `• Total: ${summary.total_invoices} invoices worth $${summary.total_amount.toFixed(2)}\n`;
    message += `• Paid: ${summary.paid_count} invoices ($${summary.paid_amount.toFixed(2)})\n`;
    message += `• Outstanding: ${summary.sent_count + summary.overdue_count} invoices ($${summary.outstanding_amount.toFixed(2)})`;
    
    if (summary.overdue_count > 0) {
      message += `\n• Overdue: ${summary.overdue_count} invoices need attention`;
    }

    return {
      success: true,
      data: summary,
      message: message
    };
  }

  private static async createInvoice(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Note: No usage limit check for creation - users can create unlimited invoices
      // The limit is now on sending, not creating
      console.log('[AI Invoice Create] Creating invoice (unlimited creation in freemium model)');

      // Step 0: Get user's business settings for default tax rate
      let defaultTaxRate = 0;
      let businessCurrency = 'USD';
      let businessCurrencySymbol = '$';
      
      try {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('default_tax_rate, auto_apply_tax, currency_code')
          .eq('user_id', userId)
          .single();
          
        if (businessSettings) {
          console.log('[AI Invoice Create] Loaded business settings:', businessSettings);
          if (businessSettings.auto_apply_tax && businessSettings.default_tax_rate) {
            defaultTaxRate = businessSettings.default_tax_rate;
            console.log('[AI Invoice Create] Applying default tax rate:', defaultTaxRate, '%');
          }
          if (businessSettings.currency_code) {
            businessCurrency = businessSettings.currency_code;
            businessCurrencySymbol = this.getCurrencySymbol(businessSettings.currency_code);
            console.log('[AI Invoice Create] Using business currency:', businessCurrency, businessCurrencySymbol);
          }
        }
      } catch (settingsError) {
        console.log('[AI Invoice Create] No business settings found, using defaults');
      }

      // Use default tax rate if no tax percentage specified
      const taxPercentage = params.tax_percentage !== undefined ? params.tax_percentage : defaultTaxRate;

      // Step 1: Find or create client with improved search
      let clientId: string;
      let existingClient = null;

      // First, try to find by email if provided
      if (params.client_email) {
        const { data: emailClient } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .eq('email', params.client_email)
          .single();
        existingClient = emailClient;
      }
      
      // If not found by email, try multiple name matching strategies
      if (!existingClient) {
        const clientName = params.client_name.toLowerCase().trim();
        
        // Strategy 1: Exact match (case insensitive)
        const { data: exactMatch } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .ilike('name', clientName)
          .single();
        
        if (exactMatch) {
          existingClient = exactMatch;
        } else {
          // Strategy 2: Partial match - check if client name contains the search term or vice versa
          const { data: partialMatches } = await supabase
            .from('clients')
            .select('id, name, email')
            .eq('user_id', userId);
          
          if (partialMatches) {
            // Find the best match
            const bestMatch = partialMatches.find(client => {
              const dbName = client.name.toLowerCase();
              const searchName = clientName;
              
              // Check if either name contains the other (ignoring common suffixes/prefixes)
              return dbName.includes(searchName) || 
                     searchName.includes(dbName) ||
                     this.normalizeClientName(dbName) === this.normalizeClientName(searchName);
            });
            
            if (bestMatch) {
              existingClient = bestMatch;
              console.log(`[Invoice Create] Found partial match: "${params.client_name}" matched with "${bestMatch.name}"`);
            }
          }
        }
      }

      if (existingClient) {
        clientId = existingClient.id;
        console.log(`[Invoice Create] Using existing client: ${existingClient.name} (${existingClient.email})`);
      } else {
        // Create new client
        const { data: newClient, error: clientError } = await supabase
          .from('clients')
          .insert({
            user_id: userId,
            name: params.client_name,
            email: params.client_email || null,
            phone: params.client_phone || null,
            address_client: params.client_address || null
          })
          .select('id, name, email')
          .single();

        if (clientError) {
          throw new Error(`Failed to create client: ${clientError.message}`);
        }

        clientId = newClient.id;
        console.log(`[Invoice Create] Created new client: ${newClient.name} (${newClient.email})`);
      }

      // Step 2: Generate unique invoice number
      const invoiceNumber = await this.generateInvoiceNumber(userId);

      // Step 3: Calculate dates
      const invoiceDate = params.invoice_date || new Date().toISOString().split('T')[0];
      let dueDate = params.due_date;
      
      if (!dueDate && params.payment_terms_days) {
        const invoiceDateObj = new Date(invoiceDate);
        invoiceDateObj.setDate(invoiceDateObj.getDate() + (params.payment_terms_days || 30));
        dueDate = invoiceDateObj.toISOString().split('T')[0];
      }

      // Step 4: Calculate line item totals
      const lineItems = params.line_items.map((item: any) => ({
        ...item,
        quantity: item.quantity || 1,
        total_price: (item.quantity || 1) * item.unit_price
      }));

      const subtotalAmount = lineItems.reduce((sum: number, item: any) => sum + item.total_price, 0);

      // Step 5: Calculate discounts and taxes
      let discountAmount = 0;
      if (params.discount_value > 0) {
        if (params.discount_type === 'percentage') {
          discountAmount = subtotalAmount * (params.discount_value / 100);
        } else {
          discountAmount = params.discount_value;
        }
      }

      const discountedAmount = subtotalAmount - discountAmount;
      const taxAmount = discountedAmount * ((taxPercentage || 0) / 100);
      const totalAmount = discountedAmount + taxAmount;

      // Step 6: Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: userId,
          client_id: clientId,
          invoice_number: invoiceNumber,
          status: 'draft',
          invoice_date: invoiceDate,
          due_date: dueDate,
          custom_headline: params.custom_headline || null,
          subtotal_amount: subtotalAmount,
          discount_type: params.discount_type || null,
          discount_value: params.discount_value || 0,
          tax_percentage: taxPercentage || 0,
          total_amount: totalAmount,
          notes: params.notes || null
        })
        .select('*')
        .single();

      if (invoiceError) {
        throw new Error(`Failed to create invoice: ${invoiceError.message}`);
      }

      // Step 7: Create line items
      const lineItemsToInsert = lineItems.map((item: any) => ({
        invoice_id: invoice.id,
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
        // If line items fail, clean up the invoice
        await supabase.from('invoices').delete().eq('id', invoice.id);
        throw new Error(`Failed to create line items: ${lineItemsError.message}`);
      }

      // Step 8: Return success with invoice details
      const successMessage = `Great! I've successfully created invoice #${invoiceNumber} for ${params.client_name}.

The invoice includes:
${lineItems.map((item: any, index: number) => 
  `• ${item.item_name}${item.item_description ? ` (${item.item_description})` : ''} - $${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity} = $${item.total_price}` : ''}`
).join('\n')}

Total: $${totalAmount.toFixed(2)}${invoice.due_date ? ` • Due: ${new Date(invoice.due_date).toLocaleDateString()}` : ''}

Would you like me to help you send this invoice or make any changes?`;

      return {
        success: true,
        data: {
          invoice: {
            ...invoice,
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
        message: successMessage
      };

    } catch (error) {
      console.error('[Invoice Create] Error:', error);
      return {
        success: false,
        message: `Failed to create invoice: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async generateInvoiceNumber(userId: string): Promise<string> {
    // Get the latest invoice number for this user
    const { data: latestInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let nextNumber = 1;
    
    if (latestInvoice?.invoice_number) {
      // Extract number from invoice number (assumes format like "INV-001", "INV-002", etc.)
      const match = latestInvoice.invoice_number.match(/(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Format with leading zeros (e.g., "INV-001", "INV-002")
    return `INV-${nextNumber.toString().padStart(3, '0')}`;
  }

  private static normalizeClientName(name: string): string {
    // Remove common business suffixes and normalize for better matching
    return name
      .toLowerCase()
      .trim()
      .replace(/\s+(corp|corporation|inc|incorporated|llc|ltd|limited|co|company|sales|group|enterprises|solutions|services|consulting)\.?$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Currency symbol mapping function
  private static getCurrencySymbol(code: string): string {
    const mapping: Record<string, string> = {
      GBP: '£',
      USD: '$',
      EUR: '€',
      AUD: 'A$',
      CAD: 'C$',
      JPY: '¥',
      INR: '₹',
      CHF: 'Fr',
      CNY: '¥',
      NZD: 'NZ$',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      SGD: 'S$',
      HKD: 'HK$'
    };
    if (!code) return '$';
    const normalized = code.split(' ')[0]; // Handle "GBP - British Pound" format
    return mapping[normalized] || '$';
  }

  private static async createClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Validate required parameters
      if (!params.name) {
        return {
          success: false,
          message: 'Client name is required.',
          error: 'Missing required parameter: name'
        };
      }

      // Check if client already exists by name (and email if provided)
      let existingClientQuery = supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', userId)
        .ilike('name', params.name);

      if (params.email) {
        existingClientQuery = existingClientQuery.eq('email', params.email);
      }

      const { data: existingClient } = await existingClientQuery.single();

      if (existingClient) {
        return {
          success: false,
          message: `A client named "${params.name}"${params.email ? ` with email ${params.email}` : ''} already exists.`,
          error: 'Client already exists'
        };
      }

      // Create new client
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          user_id: userId,
          name: params.name,
          email: params.email || null,
          phone: params.phone || null,
          address_client: params.address || null,
          notes: params.notes || null
        })
        .select('id, name, email, phone, address_client, notes')
        .single();

      if (clientError) {
        throw new Error(`Failed to create client: ${clientError.message}`);
      }

      // Build success message based on new workflow
      const baseMessage = `Great! I added ${params.name} as a new client.`;
      
      // Determine what details are missing and could be added
      const missingDetails = [];
      if (!params.email) missingDetails.push("Email");
      if (!params.phone) missingDetails.push("Phone number");  
      if (!params.address) missingDetails.push("Address");
      
      let successMessage = baseMessage;
      if (missingDetails.length > 0) {
        successMessage += `\n\nWould you like to add any more details?\n${missingDetails.map(detail => `• ${detail}?`).join('\n')}`;
      }

      return {
        success: true,
        data: {
          client: newClient,
          type: 'client'
        },
        message: successMessage
      };

    } catch (error) {
      console.error('Error creating client:', error);
      return {
        success: false,
        message: 'Failed to create client. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async searchClients(params: { name?: string; email?: string; limit?: number }, userId: string): Promise<FunctionResult> {
    let query = supabase
      .from('clients')
      .select('id, name, email, phone, address_client, notes, created_at, updated_at')
      .eq('user_id', userId);

    if (params.name) {
      query = query.ilike('name', `%${params.name}%`);
    }
    
    if (params.email) {
      query = query.eq('email', params.email);
    }

    const { data: clients, error } = await query
      .order('name', { ascending: true })
      .limit(params.limit || 10);

    if (error) {
      throw new Error(`Failed to search clients: ${error.message}`);
    }

    let resultMessage = '';
    let resultData = null;

    if (clients && clients.length > 0) {
      if (clients.length === 1) {
        resultMessage = `Found ${clients[0].name}${clients[0].email ? ` (${clients[0].email})` : ''}.`;
        resultData = {
          client: clients[0],
          type: 'client'
        };
      } else {
        resultMessage = `Found ${clients.length} clients matching your criteria:
${clients.map(client => `• ${client.name}${client.email ? ` (${client.email})` : ''}`).join('\n')}`;
        resultData = {
          clients: clients,
          type: 'client_list'
        };
      }
    } else {
      resultMessage = 'No clients found matching your criteria.';
      resultData = null;
    }

    return {
      success: true,
      data: resultData,
      message: resultMessage
    };
  }

  private static async getBusinessSettings(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const { data: businessSettings, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new Error(`Failed to get business settings: ${error.message}`);
      }

      if (!businessSettings) {
        return {
          success: true,
          data: null,
          message: `I'd love to help you get your business profile set up! 😊 

I can help you configure things like your business name, address, tax settings, and more. This will make creating invoices much smoother.

What would you like to start with? I could help you set up:
• Your business information
• Tax settings 
• Currency preferences

Just let me know what sounds good to you!`
        };
      }

      const setupStatus = this.analyzeSetupStatus(businessSettings);
      
      let message = `Here are your current business settings:

• Business Name: ${businessSettings.business_name || 'Not set'}
• Address: ${businessSettings.business_address || 'Not set'}
• Email: ${businessSettings.business_email || 'Not set'}
• Phone: ${businessSettings.business_phone || 'Not set'}
• Website: ${businessSettings.business_website || 'Not set'}
• Currency: ${businessSettings.currency_code || 'Not set'}
• Tax Rate: ${businessSettings.default_tax_rate || 'Not set'}%
• Tax Name: ${businessSettings.tax_name || 'Not set'}
• Auto Apply Tax: ${businessSettings.auto_apply_tax ? 'Yes' : 'No'}
• Region: ${businessSettings.region || 'Not set'}`;

      if (setupStatus.incomplete.length > 0) {
        message += `\n\nIncomplete settings: ${setupStatus.incomplete.join(', ')}`;
        message += `\n\nWould you like me to help you complete these settings?`;
      }

      return {
        success: true,
        data: businessSettings,
        message: message
      };

    } catch (error) {
      console.error('Error getting business settings:', error);
      return {
        success: false,
        message: 'Failed to retrieve business settings. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static analyzeSetupStatus(settings: any): { complete: string[]; incomplete: string[] } {
    const complete: string[] = [];
    const incomplete: string[] = [];

    if (settings.business_name) complete.push('Business name');
    else incomplete.push('Business name');

    if (settings.business_address) complete.push('Business address');
    else incomplete.push('Business address');

    if (settings.business_email) complete.push('Business email');
    else incomplete.push('Business email');

    if (settings.currency_code) complete.push('Currency');
    else incomplete.push('Currency');

    if (settings.default_tax_rate) complete.push('Default tax rate');
    else incomplete.push('Default tax rate');

    if (settings.tax_name) complete.push('Tax name');
    else incomplete.push('Tax name');

    if (settings.region) complete.push('Region');
    else incomplete.push('Region');

    return { complete: complete, incomplete: incomplete };
  }

  private static async updateBusinessSettings(params: any, userId: string): Promise<FunctionResult> {
    try {
      // Check if business settings already exist
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      // Only update fields that are provided
      if (params.business_name !== undefined) updateData.business_name = params.business_name;
      if (params.business_address !== undefined) updateData.business_address = params.business_address;
      if (params.business_email !== undefined) updateData.business_email = params.business_email;
      if (params.business_phone !== undefined) updateData.business_phone = params.business_phone;
      if (params.business_website !== undefined) updateData.business_website = params.business_website;
      if (params.currency_code !== undefined) updateData.currency_code = params.currency_code;
      if (params.default_tax_rate !== undefined) updateData.default_tax_rate = params.default_tax_rate;
      if (params.tax_name !== undefined) updateData.tax_name = params.tax_name;
      if (params.auto_apply_tax !== undefined) updateData.auto_apply_tax = params.auto_apply_tax;
      if (params.region !== undefined) updateData.region = params.region;

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update(updateData)
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        updateData.created_at = new Date().toISOString();
        result = await supabase
          .from('business_settings')
          .insert(updateData)
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update business settings: ${result.error.message}`);
      }

      // Build success message showing what was updated
      const updatedFields = Object.keys(params).map(key => {
        switch (key) {
          case 'business_name': return 'Business name';
          case 'business_address': return 'Business address';
          case 'business_email': return 'Business email';
          case 'business_phone': return 'Business phone';
          case 'business_website': return 'Business website';
          case 'currency_code': return 'Currency';
          case 'default_tax_rate': return 'Default tax rate';
          case 'tax_name': return 'Tax label';
          case 'auto_apply_tax': return 'Auto apply tax';
          case 'region': return 'Region';
          default: return key;
        }
      });

      const message = `Great! I've updated your business settings:

${updatedFields.map(field => `✓ ${field}`).join('\n')}

Your invoice settings are now configured and will be applied to all new invoices. Is there anything else you'd like me to help you set up?`;

      return {
        success: true,
        data: result.data,
        message: message
      };

    } catch (error) {
      console.error('Error updating business settings:', error);
      return {
        success: false,
        message: 'Failed to update business settings. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getSetupProgress(params: {}, userId: string): Promise<FunctionResult> {
    try {
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      const setupChecklist = {
        business_info: {
          name: 'Business Information',
          items: [
            { key: 'business_name', label: 'Business Name', completed: !!businessSettings?.business_name },
            { key: 'business_address', label: 'Business Address', completed: !!businessSettings?.business_address },
            { key: 'business_email', label: 'Business Email', completed: !!businessSettings?.business_email },
            { key: 'business_phone', label: 'Business Phone', completed: !!businessSettings?.business_phone },
            { key: 'business_website', label: 'Business Website', completed: !!businessSettings?.business_website }
          ]
        },
        financial_settings: {
          name: 'Financial Settings',
          items: [
            { key: 'currency_code', label: 'Currency', completed: !!businessSettings?.currency_code },
            { key: 'default_tax_rate', label: 'Tax Rate', completed: !!businessSettings?.default_tax_rate },
            { key: 'tax_name', label: 'Tax Name (VAT/Sales Tax)', completed: !!businessSettings?.tax_name },
            { key: 'auto_apply_tax', label: 'Auto Apply Tax', completed: businessSettings?.auto_apply_tax !== undefined },
            { key: 'region', label: 'Business Region', completed: !!businessSettings?.region }
          ]
        }
      };

      // Calculate completion percentages
      let totalItems = 0;
      let completedItems = 0;
      let message = 'Here\'s your business setup progress:\n\n';

      Object.values(setupChecklist).forEach(category => {
        const categoryCompleted = category.items.filter(item => item.completed).length;
        const categoryTotal = category.items.length;
        totalItems += categoryTotal;
        completedItems += categoryCompleted;

        message += `**${category.name}** (${categoryCompleted}/${categoryTotal})\n`;
        category.items.forEach(item => {
          message += `${item.completed ? '✅' : '❌'} ${item.label}\n`;
        });
        message += '\n';
      });

      const overallPercentage = Math.round((completedItems / totalItems) * 100);
      message = `Overall Progress: ${overallPercentage}% Complete (${completedItems}/${totalItems})\n\n` + message;

      // Provide next steps
      const incompleteItems = Object.values(setupChecklist)
        .flatMap(category => category.items)
        .filter(item => !item.completed);

      if (incompleteItems.length > 0) {
        message += `**Next Steps:**\n`;
        message += `To complete your setup, I can help you configure:\n`;
        incompleteItems.slice(0, 3).forEach(item => {
          message += `• ${item.label}\n`;
        });
        
        if (incompleteItems.length > 3) {
          message += `• ...and ${incompleteItems.length - 3} more\n`;
        }
        
        message += `\nJust ask me to "set up my business name" or "configure tax settings" and I'll guide you through it!`;
      } else {
        message += `🎉 **Congratulations!** Your business profile is fully configured and ready for invoicing!`;
      }

      return {
        success: true,
        data: {
          checklist: setupChecklist,
          overall_percentage: overallPercentage,
          completed_items: completedItems,
          total_items: totalItems,
          incomplete_items: incompleteItems
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting setup progress:', error);
      return {
        success: false,
        message: 'Failed to retrieve setup progress. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setCurrency(params: { currency_code: string }, userId: string): Promise<FunctionResult> {
    try {
      // Validate currency code
      const currencyCode = params.currency_code.toUpperCase();
      if (!currencyCode || currencyCode.length !== 3) {
        return {
          success: false,
          message: 'Invalid currency code. Please provide a three-letter currency code like USD, EUR, or GBP.',
          error: 'Invalid currency code'
        };
      }

      // Check if business settings exist, create if not
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update({ 
            currency_code: currencyCode,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('business_settings')
          .insert({
            user_id: userId,
            currency_code: currencyCode,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update currency: ${result.error.message}`);
      }

      const successMessage = `Perfect! I've set your default currency to ${currencyCode}. 💰

All your new invoices will now use this currency. Is there anything else you'd like me to help you set up?`;

      return {
        success: true,
        data: result.data,
        message: successMessage
      };

    } catch (error) {
      console.error('Error setting currency:', error);
      return {
        success: false,
        message: 'Failed to set currency. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async setRegion(params: { region: string }, userId: string): Promise<FunctionResult> {
    try {
      // Validate region
      if (!params.region || params.region.trim() === '') {
        return {
          success: false,
          message: 'Region is required. Please provide your business location (like "United States" or "Canada").',
          error: 'Missing required parameter: region'
        };
      }

      const region = params.region.trim();

      // Check if business settings exist, create if not
      const { data: existingSettings } = await supabase
        .from('business_settings')
        .select('id')
        .eq('user_id', userId)
        .single();

      let result;
      if (existingSettings) {
        // Update existing settings
        result = await supabase
          .from('business_settings')
          .update({ 
            region: region,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select()
          .single();
      } else {
        // Create new settings
        result = await supabase
          .from('business_settings')
          .insert({
            user_id: userId,
            region: region,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
      }

      if (result.error) {
        throw new Error(`Failed to update region: ${result.error.message}`);
      }

      const successMessage = `Great! I've set your business region to ${region}. 🌍

This will help with tax and compliance suggestions for your invoices. Is there anything else you'd like me to help you configure?`;

      return {
        success: true,
        data: result.data,
        message: successMessage
      };

    } catch (error) {
      console.error('Error setting region:', error);
      return {
        success: false,
        message: 'Failed to set region. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getCurrencyOptions(params: {}, userId: string): Promise<FunctionResult> {
    try {
      // Provide a hardcoded list of common currencies
      const currencyOptions = [
        { currency_code: 'USD', currency_name: 'US Dollar', symbol: '$' },
        { currency_code: 'EUR', currency_name: 'Euro', symbol: '€' },
        { currency_code: 'GBP', currency_name: 'British Pound', symbol: '£' },
        { currency_code: 'CAD', currency_name: 'Canadian Dollar', symbol: 'C$' },
        { currency_code: 'AUD', currency_name: 'Australian Dollar', symbol: 'A$' },
        { currency_code: 'JPY', currency_name: 'Japanese Yen', symbol: '¥' },
        { currency_code: 'CHF', currency_name: 'Swiss Franc', symbol: 'Fr' },
        { currency_code: 'CNY', currency_name: 'Chinese Yuan', symbol: '¥' },
        { currency_code: 'INR', currency_name: 'Indian Rupee', symbol: '₹' },
        { currency_code: 'NZD', currency_name: 'New Zealand Dollar', symbol: 'NZ$' },
        { currency_code: 'SEK', currency_name: 'Swedish Krona', symbol: 'kr' },
        { currency_code: 'NOK', currency_name: 'Norwegian Krone', symbol: 'kr' },
        { currency_code: 'DKK', currency_name: 'Danish Krone', symbol: 'kr' },
        { currency_code: 'SGD', currency_name: 'Singapore Dollar', symbol: 'S$' },
        { currency_code: 'HKD', currency_name: 'Hong Kong Dollar', symbol: 'HK$' }
      ];

      const successMessage = `Here are some common currency options:

${currencyOptions.map((option: any) => `• ${option.currency_code} (${option.symbol}) - ${option.currency_name}`).join('\n')}

Just tell me which currency you'd like to use (like "set my currency to USD" or "use EUR") and I'll set it up for you!`;

      return {
        success: true,
        data: currencyOptions,
        message: successMessage
      };

    } catch (error) {
      console.error('Error getting currency options:', error);
      return {
        success: false,
        message: 'Failed to retrieve currency options. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceLineItems(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, action, line_items } = params;

      if (!invoice_number || !action || !line_items) {
        return {
          success: false,
          message: 'Invoice number, action, and line_items are required.',
          error: 'Missing required parameters'
        };
      }

      // Get the invoice first
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (invoiceError || !invoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      let updatedLineItems = [...(invoice.line_items || [])];
      let actionDescription = '';

      switch (action) {
        case 'add':
          // Add new line items
          for (const newItem of line_items) {
            const { data: addedItem, error: addError } = await supabase
              .from('invoice_line_items')
              .insert({
                invoice_id: invoice.id,
                user_id: userId,
                item_name: newItem.item_name,
                item_description: newItem.item_description || null,
                quantity: newItem.quantity || 1,
                unit_price: newItem.unit_price,
                total_price: (newItem.quantity || 1) * newItem.unit_price
              })
              .select()
              .single();

            if (addError) {
              console.error('Error adding line item:', addError);
              continue;
            }
            updatedLineItems.push(addedItem);
          }
          actionDescription = `Added ${line_items.length} item(s)`;
          break;

        case 'update':
          // Update existing line items
          for (const updateItem of line_items) {
            if (!updateItem.item_id) continue;

            const { error: updateError } = await supabase
              .from('invoice_line_items')
              .update({
                item_name: updateItem.item_name,
                item_description: updateItem.item_description || null,
                quantity: updateItem.quantity || 1,
                unit_price: updateItem.unit_price,
                total_price: (updateItem.quantity || 1) * updateItem.unit_price
              })
              .eq('id', updateItem.item_id)
              .eq('user_id', userId);

            if (updateError) {
              console.error('Error updating line item:', updateError);
            }
          }
          actionDescription = `Updated ${line_items.length} item(s)`;
          break;

        case 'remove':
          // Remove line items
          for (const removeItem of line_items) {
            if (!removeItem.item_id) continue;

            const { error: removeError } = await supabase
              .from('invoice_line_items')
              .delete()
              .eq('id', removeItem.item_id)
              .eq('user_id', userId);

            if (removeError) {
              console.error('Error removing line item:', removeError);
            }
          }
          actionDescription = `Removed ${line_items.length} item(s)`;
          break;
      }

      // Recalculate totals
      const { data: currentLineItems } = await supabase
        .from('invoice_line_items')
        .select('*')
        .eq('invoice_id', invoice.id);

      const subtotalAmount = currentLineItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
      
      // Apply existing discounts and taxes
      let discountAmount = 0;
      if (invoice.discount_value > 0) {
        if (invoice.discount_type === 'percentage') {
          discountAmount = subtotalAmount * (invoice.discount_value / 100);
        } else {
          discountAmount = invoice.discount_value;
        }
      }

      const discountedAmount = subtotalAmount - discountAmount;
      const taxAmount = discountedAmount * ((invoice.tax_percentage || 0) / 100);
      const totalAmount = discountedAmount + taxAmount;

      // Update invoice totals
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          subtotal_amount: subtotalAmount,
          total_amount: totalAmount
        })
        .eq('id', invoice.id)
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice totals: ${updateError.message}`);
      }

      const successMessage = `Successfully ${actionDescription.toLowerCase()} to invoice ${invoice_number}.

Updated totals:
• Subtotal: $${subtotalAmount.toFixed(2)}
• Total: $${totalAmount.toFixed(2)}

Would you like to view the updated invoice or make more changes?`;

      return {
        success: true,
        data: {
          invoice: {
            ...updatedInvoice,
            client_name: invoice.client_name,
            client_email: invoice.client_email
          },
          line_items: currentLineItems,
          action_performed: actionDescription
        },
        message: successMessage
      };

    } catch (error) {
      console.error('Error updating invoice line items:', error);
      return {
        success: false,
        message: 'Failed to update invoice line items. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getInvoiceDetails(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      const { data: invoice, error } = await supabase
        .from('invoices')
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (error || !invoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      const lineItemsList = invoice.line_items?.map((item: any, index: number) => 
        `${index + 1}. ${item.item_name}${item.item_description ? ` (${item.item_description})` : ''} - $${item.unit_price}${item.quantity > 1 ? ` x ${item.quantity} = $${item.total_price}` : ''}`
      ).join('\n') || 'No line items';

      const message = `Invoice ${invoice_number} details:

**Client:** ${invoice.client_name}${invoice.client_email ? ` (${invoice.client_email})` : ''}
**Status:** ${invoice.status}
**Date:** ${new Date(invoice.invoice_date).toLocaleDateString()}
**Due Date:** ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Not set'}

**Line Items:**
${lineItemsList}

**Totals:**
• Subtotal: $${invoice.subtotal_amount?.toFixed(2) || '0.00'}
• Tax (${invoice.tax_percentage || 0}%): $${((invoice.subtotal_amount || 0) * ((invoice.tax_percentage || 0) / 100)).toFixed(2)}
• Total: $${invoice.total_amount?.toFixed(2) || '0.00'}

${invoice.notes ? `**Notes:** ${invoice.notes}` : ''}`;

      return {
        success: true,
        data: {
          invoice: invoice,
          line_items: invoice.line_items
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting invoice details:', error);
      return {
        success: false,
        message: 'Failed to get invoice details. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateInvoiceDetails(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { invoice_number, new_invoice_number, client_name, client_email, invoice_date, due_date, tax_percentage, discount_type, discount_value, notes, custom_headline } = params;

      if (!invoice_number) {
        return {
          success: false,
          message: 'Invoice number is required.',
          error: 'Missing required parameter: invoice_number'
        };
      }

      // Get the current invoice
      const { data: currentInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .single();

      if (fetchError || !currentInvoice) {
        return {
          success: false,
          message: `Invoice ${invoice_number} not found.`,
          error: 'Invoice not found'
        };
      }

      // Build update object with only provided fields
      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      if (new_invoice_number) {
        updateData.invoice_number = new_invoice_number;
      }
      if (client_name) {
        updateData.client_name = client_name;
      }
      if (client_email) {
        updateData.client_email = client_email;
      }
      if (invoice_date) {
        updateData.invoice_date = invoice_date;
      }
      if (due_date) {
        updateData.due_date = due_date;
      }
      if (tax_percentage !== undefined) {
        updateData.tax_percentage = tax_percentage;
      }
      if (discount_type) {
        updateData.discount_type = discount_type;
      }
      if (discount_value !== undefined) {
        updateData.discount_value = discount_value;
      }
      if (notes) {
        updateData.notes = notes;
      }
      if (custom_headline) {
        updateData.custom_headline = custom_headline;
      }

      if (Object.keys(updateData).length === 0) {
        return {
          success: false,
          message: 'No valid fields provided for update.',
          error: 'No update fields'
        };
      }

      // If tax or discount changed, recalculate totals
      if (updateData.tax_percentage !== undefined || updateData.discount_type || updateData.discount_value !== undefined) {
        const { data: lineItems } = await supabase
          .from('invoice_line_items')
          .select('total_price')
          .eq('invoice_id', currentInvoice.id);

        const subtotalAmount = lineItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;
        
        let discountAmount = 0;
        const discountValue = updateData.discount_value !== undefined ? updateData.discount_value : currentInvoice.discount_value;
        const discountType = updateData.discount_type || currentInvoice.discount_type;

        if (discountValue > 0) {
          if (discountType === 'percentage') {
            discountAmount = subtotalAmount * (discountValue / 100);
          } else {
            discountAmount = discountValue;
          }
        }

        const discountedAmount = subtotalAmount - discountAmount;
        const taxPercentage = updateData.tax_percentage !== undefined ? updateData.tax_percentage : currentInvoice.tax_percentage;
        const taxAmount = discountedAmount * ((taxPercentage || 0) / 100);
        const totalAmount = discountedAmount + taxAmount;

        updateData.total_amount = totalAmount;
      }

      // Update the invoice
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('user_id', userId)
        .eq('invoice_number', invoice_number)
        .select(`
          *,
          line_items:invoice_line_items(*)
        `)
        .single();

      if (updateError) {
        throw new Error(`Failed to update invoice: ${updateError.message}`);
      }

      const message = `Successfully updated invoice ${invoice_number}.

${updatedInvoice.total_amount ? `New total: $${updatedInvoice.total_amount.toFixed(2)}` : ''}

Would you like to view the updated invoice or make more changes?`;

      return {
        success: true,
        data: {
          invoice: updatedInvoice,
          line_items: updatedInvoice.line_items,
          updated_fields: Object.keys(params).filter(key => key !== 'invoice_number')
        },
        message: message
      };

    } catch (error) {
      console.error('Error updating invoice details:', error);
      return {
        success: false,
        message: 'Failed to update invoice details. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async updateClient(params: any, userId: string): Promise<FunctionResult> {
    try {
      const { client_name, client_id, new_name, email, phone, address, notes } = params;

      if (!client_name && !client_id) {
        return {
          success: false,
          message: 'Client name or client_id is required.',
          error: 'Missing required parameter: client_name or client_id'
        };
      }

      console.log('[Update Client] Starting search for client:', { client_name, client_id, userId });

      let existingClient = null;

      if (client_id) {
        // Search by ID (more reliable)
        const { data: clientById, error: idError } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', userId)
          .eq('id', client_id)
          .single();

        if (idError) {
          return {
            success: false,
            message: `Client with ID ${client_id} not found.`,
            error: 'Client not found'
          };
        }
        existingClient = clientById;
      } else if (client_name) {
        // Search by name with very aggressive matching
        console.log('[Update Client] Searching for client by name:', client_name);
        
        // Get ALL clients for this user to debug
        const { data: allUserClients } = await supabase
          .from('clients')
          .select('id, name, email, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);

        console.log('[Update Client] All user clients:', allUserClients?.map(c => ({ name: c.name, id: c.id, created: c.created_at })));

        if (allUserClients && allUserClients.length > 0) {
          const searchName = client_name.toLowerCase().trim();
          
          // Try multiple matching strategies
          const exactMatch = allUserClients.find(c => c.name.toLowerCase().trim() === searchName);
          const startsWithMatch = allUserClients.find(c => c.name.toLowerCase().trim().startsWith(searchName));
          const containsMatch = allUserClients.find(c => c.name.toLowerCase().trim().includes(searchName));
          const wordsMatch = allUserClients.find(c => {
            const clientWords = c.name.toLowerCase().split(/\s+/);
            const searchWords = searchName.split(/\s+/);
            return searchWords.every(word => clientWords.some(cWord => cWord.includes(word)));
          });

          // Use the best match we can find
          existingClient = exactMatch || startsWithMatch || containsMatch || wordsMatch;
          
          if (exactMatch) {
            console.log('[Update Client] Found exact match:', existingClient.name);
          } else if (startsWithMatch) {
            console.log('[Update Client] Found starts-with match:', existingClient.name);
          } else if (containsMatch) {
            console.log('[Update Client] Found contains match:', existingClient.name);
          } else if (wordsMatch) {
            console.log('[Update Client] Found words match:', existingClient.name);
          }

          // If we still don't have a match, try the most recently created client
          if (!existingClient && allUserClients.length > 0) {
            const recentClient = allUserClients[0]; // Most recent due to ordering
            const recentClientAge = (Date.now() - new Date(recentClient.created_at).getTime()) / 1000; // seconds
            
            if (recentClientAge < 300) { // Created within last 5 minutes
              console.log('[Update Client] Using recently created client (age:', recentClientAge, 'seconds):', recentClient.name);
              existingClient = recentClient;
            }
          }
        }

        if (!existingClient) {
          // Provide helpful error with context
          const recentClients = allUserClients?.slice(0, 5) || [];
          return {
            success: false,
            message: `I couldn't find a client named "${client_name}". Your recent clients are:
${recentClients.map((c, i) => `${i + 1}. ${c.name} (${c.email || 'no email'})`).join('\n')}

If you just created an invoice for this client, please try again in a moment, or provide the exact client name as it appears above.`,
            error: 'Client not found'
          };
        }
      }

      if (!existingClient) {
        return {
          success: false,
          message: `Client "${client_name || client_id}" not found. You can create a new client with that name if needed.`,
          error: 'Client not found'
        };
      }

      console.log('[Update Client] Found client to update:', existingClient.name, existingClient.id);

      // Check if there are multiple clients with the same name that might be causing issues
      const { data: duplicateCheck } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('user_id', userId)
        .eq('name', existingClient.name);
      
      if (duplicateCheck && duplicateCheck.length > 1) {
        console.warn('[Update Client] Found', duplicateCheck.length, 'clients with name:', existingClient.name);
        console.warn('[Update Client] Duplicate clients:', duplicateCheck);
      }

      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      };

      if (new_name) {
        updateData.name = new_name;
      }
      if (email) {
        updateData.email = email;
      }
      if (phone) {
        updateData.phone = phone;
      }
      if (address) {
        updateData.address_client = address;
      }
      if (notes) {
        updateData.notes = notes;
      }

      const { data: updatedClient, error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('user_id', userId)
        .eq('id', existingClient.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[Update Client] Update error details:', updateError);
        
        // If it's a multiple rows error, try a more specific update
        if (updateError.message.includes('multiple') || updateError.message.includes('no rows')) {
          console.log('[Update Client] Attempting more specific update...');
          
          // Try updating by exact ID match only
          const { data: specificUpdate, error: specificError } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', existingClient.id)
            .select('*');

          if (specificError) {
            throw new Error(`Failed to update client (specific): ${specificError.message}`);
          }

          if (specificUpdate && specificUpdate.length > 0) {
            console.log('[Update Client] Successfully updated client with specific query');
            const updatedClientData = specificUpdate[0];
            
            let message = `Successfully updated ${existingClient.name}'s ${updatedFields.join(', ')}.`;
            
            if (address) {
              message += `\n\nThis address will now appear on all invoices for ${existingClient.name}.`;
            }

            return {
              success: true,
              data: {
                client: updatedClientData,
                type: 'client'
              },
              message: message
            };
          }
        }
        
        throw new Error(`Failed to update client: ${updateError.message}`);
      }

      console.log('[Update Client] Successfully updated client:', updatedClient.name);

      // Build a better success message
      const updatedFields = [];
      if (new_name) updatedFields.push(`name to "${new_name}"`);
      if (email) updatedFields.push(`email to "${email}"`);
      if (phone) updatedFields.push(`phone to "${phone}"`);
      if (address) updatedFields.push(`address to "${address}"`);
      if (notes) updatedFields.push(`notes`);

      let message = `Successfully updated ${existingClient.name}'s ${updatedFields.join(', ')}.`;
      
      // Add context for address updates
      if (address) {
        message += `\n\nThis address will now appear on all invoices for ${existingClient.name}.`;
      }

      return {
        success: true,
        data: {
          client: updatedClient,
          type: 'client'
        },
        message: message
      };

    } catch (error) {
      console.error('Error updating client:', error);
      return {
        success: false,
        message: 'Failed to update client. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private static async getClientOutstandingAmount(params: { client_name: string }, userId: string): Promise<FunctionResult> {
    try {
      const { client_name } = params;

      if (!client_name) {
        return {
          success: false,
          message: 'Client name is required.',
          error: 'Missing required parameter: client_name'
        };
      }

      console.log('[Get Outstanding] Searching for invoices for client:', client_name);

      // Use ilike for case-insensitive partial matching
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          invoice_number, 
          status, 
          total_amount, 
          due_date, 
          created_at,
          clients!inner(name, email)
        `)
        .eq('user_id', userId)
        .ilike('clients.name', `%${client_name}%`);

      if (error) {
        throw new Error(`Failed to get invoices: ${error.message}`);
      }

      if (!invoices || invoices.length === 0) {
        return {
          success: false,
          message: `No invoices found for "${client_name}". Double-check the client name or try searching for recent invoices.`,
          error: 'No invoices found'
        };
      }

      console.log('[Get Outstanding] Found', invoices.length, 'invoices for', client_name);

      // Filter for unpaid invoices (sent or overdue)
      const unpaidInvoices = invoices.filter(invoice => 
        invoice.status === 'sent' || invoice.status === 'overdue'
      );

      const totalOutstanding = unpaidInvoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);
      const totalAll = invoices.reduce((sum, invoice) => sum + (invoice.total_amount || 0), 0);

      let message = `${client_name} invoice summary:\n\n`;
      
      if (unpaidInvoices.length > 0) {
        message += `💰 **Outstanding Amount: $${totalOutstanding.toFixed(2)}**\n`;
        message += `📄 Unpaid invoices: ${unpaidInvoices.length}\n\n`;
        
        message += `Unpaid invoices:\n`;
        unpaidInvoices.forEach(invoice => {
          message += `• ${invoice.invoice_number}: $${invoice.total_amount?.toFixed(2)} (${invoice.status})\n`;
        });
      } else {
        message += `✅ **All invoices are paid!**\n`;
        message += `💰 Total paid: $${totalAll.toFixed(2)}\n`;
      }

      message += `\n📊 Total invoices: ${invoices.length}`;

      return {
        success: true,
        data: {
          client_name: client_name,
          total_outstanding: totalOutstanding,
          total_amount: totalAll,
          unpaid_invoices: unpaidInvoices,
          all_invoices: invoices
        },
        message: message
      };

    } catch (error) {
      console.error('Error getting client outstanding amount:', error);
      return {
        success: false,
        message: 'Failed to get client outstanding amount. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
} 
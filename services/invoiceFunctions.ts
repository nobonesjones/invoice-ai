import { supabase } from '@/config/supabase';
import { OpenAIFunction } from '@/services/openaiService';

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
        line_items:invoice_line_items(*)
      `)
      .eq('user_id', userId);

    // Apply filters
    if (params.client_name) {
      query = query.ilike('client_name', `%${params.client_name}%`);
    }
    
    if (params.status) {
      query = query.eq('status', params.status);
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
      // Step 1: Find or create client
      let clientId: string;
      
      // Check if client exists by email (preferred) or name
      let existingClient = null;
      if (params.client_email) {
        const { data: emailClient } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .eq('email', params.client_email)
          .single();
        existingClient = emailClient;
      }
      
      if (!existingClient) {
        // Try to find by name if email search failed
        const { data: nameClient } = await supabase
          .from('clients')
          .select('id, name, email')
          .eq('user_id', userId)
          .ilike('name', params.client_name)
          .single();
        existingClient = nameClient;
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
      const taxAmount = discountedAmount * ((params.tax_percentage || 0) / 100);
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
          tax_percentage: params.tax_percentage || 0,
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
} 
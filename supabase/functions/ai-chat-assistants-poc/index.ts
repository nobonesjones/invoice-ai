import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from "https://esm.sh/openai@4.69.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Function to find invoice by identifier
async function findInvoice(supabase, user_id, invoice_identifier) {
  try {
    let targetInvoice = null;
    if (invoice_identifier === 'latest') {
      // Get most recent invoice
      console.log('[findInvoice] Searching for latest invoice for user:', user_id);
      const { data: invoices, error } = await supabase.from('invoices').select('*').eq('user_id', user_id).order('created_at', {
        ascending: false
      }).limit(1);
      if (error) {
        console.error('[findInvoice] Database error for latest:', error);
        return `Database error finding latest invoice: ${error.message}`;
      }
      console.log('[findInvoice] Found latest invoices:', invoices?.length || 0, invoices?.map((i)=>({
          id: i.id,
          number: i.invoice_number
        })));
      targetInvoice = invoices?.[0];
    } else if (invoice_identifier.startsWith('INV-')) {
      // Search by invoice number
      console.log('[findInvoice] Searching for invoice:', invoice_identifier, 'for user:', user_id);
      const { data: invoices, error } = await supabase.from('invoices').select('*').eq('user_id', user_id).eq('invoice_number', invoice_identifier);
      if (error) {
        console.error('[findInvoice] Database error:', error);
        return `Database error finding invoice: ${error.message}`;
      }
      console.log('[findInvoice] Found invoices:', invoices?.length || 0, invoices?.map((i)=>({
          id: i.id,
          number: i.invoice_number
        })));
      targetInvoice = invoices?.[0];
    } else {
      // Search by client name
      const { data: clients } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('name', `%${invoice_identifier}%`);
      if (clients && clients.length > 0) {
        const { data: invoices } = await supabase.from('invoices').select('*').eq('user_id', user_id).in('client_id', clients.map((c)=>c.id)).order('created_at', {
          ascending: false
        }).limit(1);
        targetInvoice = invoices?.[0];
      }
    }
    if (!targetInvoice) {
      console.log('[findInvoice] No invoice found for identifier:', invoice_identifier, 'user:', user_id);
      return `No invoice found for identifier: ${invoice_identifier}. Please provide a valid invoice number (like INV-123) or client name.`;
    }
    console.log('[findInvoice] Successfully found invoice:', targetInvoice.invoice_number, 'id:', targetInvoice.id);
    return targetInvoice;
  } catch (error) {
    return `Error finding invoice: ${error.message}`;
  }
}
// CONVERSATION MEMORY SYSTEM - Tracks what just happened for perfect context
class ConversationMemory {
  static lastActions = new Map();
  static setLastAction(userId, action, details = {}) {
    this.lastActions.set(userId, {
      action,
      ...details,
      timestamp: new Date()
    });
    console.log(`[ConversationMemory] Set action for ${userId}:`, {
      action,
      ...details
    });
  }
  static getLastAction(userId) {
    const action = this.lastActions.get(userId);
    // Actions expire after 30 minutes to prevent stale context
    if (action && new Date().getTime() - action.timestamp.getTime() > 30 * 60 * 1000) {
      this.lastActions.delete(userId);
      return null;
    }
    return action;
  }
  static clearAction(userId) {
    this.lastActions.delete(userId);
    console.log(`[ConversationMemory] Cleared action for ${userId}`);
  }
}
// Enhanced context detection with conversation memory
function detectConversationContext(message, userId) {
  const lowerMessage = message.toLowerCase();
  const lastAction = ConversationMemory.getLastAction(userId);
  // Check for explicit creation intent
  const createKeywords = [
    'create invoice',
    'make invoice',
    'new invoice',
    'invoice for',
    'create estimate',
    'make estimate',
    'new estimate',
    'estimate for',
    'generate invoice',
    'build invoice',
    'start invoice'
  ];
  if (createKeywords.some((keyword)=>lowerMessage.includes(keyword))) {
    return 'create';
  }
  // Check for update/modification intent with context
  const updateKeywords = [
    'add',
    'update',
    'change',
    'modify',
    'edit',
    'set',
    'include'
  ];
  const contextReferences = [
    'the invoice',
    'this invoice',
    'it',
    'the client',
    'address',
    'that invoice'
  ];
  const hasUpdateKeyword = updateKeywords.some((keyword)=>lowerMessage.includes(keyword));
  const hasContextReference = contextReferences.some((ref)=>lowerMessage.includes(ref));
  // If user just created/updated something and now wants to modify it
  if (hasUpdateKeyword && (hasContextReference || lastAction)) {
    // Check if referring to specific invoice number
    const invoiceMatch = lowerMessage.match(/inv-\d+/i);
    if (invoiceMatch) {
      return 'update_specific';
    }
    return 'update_latest';
  }
  return 'general';
}
// Function to detect if user wants to create invoice/estimate  
function detectInvoiceCreationIntent(message, userId = '') {
  return detectConversationContext(message, userId) === 'create';
}
// Optimized function to get user context for invoice/estimate creation
async function getInvoiceCreationContext(supabase, userId) {
  try {
    console.log('[InvoiceContext] Fetching optimized context for user:', userId);
    // Single optimized query to get business settings + latest invoice patterns
    const { data: contextData } = await supabase.from('business_settings').select(`
        default_tax_rate,
        tax_label,
        currency,
        payment_terms_days,
        stripe_enabled,
        paypal_enabled,
        bank_transfer_enabled,
        venmo_enabled,
        cash_app_enabled,
        zelle_enabled,
        invoice_reference_format,
        default_invoice_design
      `).eq('user_id', userId).single();
    // Get latest invoice to understand user's recent preferences
    const { data: latestInvoice } = await supabase.from('invoices').select('payment_methods_enabled, tax_rate, invoice_design, payment_terms_days').eq('user_id', userId).order('created_at', {
      ascending: false
    }).limit(1).single();
    // Build lightweight context
    const bs = contextData;
    const recent = latestInvoice;
    // Payment methods available vs typically used
    const availablePayments = [];
    if (bs?.stripe_enabled) availablePayments.push('stripe');
    if (bs?.paypal_enabled) availablePayments.push('paypal');
    if (bs?.bank_transfer_enabled) availablePayments.push('bank_transfer');
    if (bs?.venmo_enabled) availablePayments.push('venmo');
    if (bs?.cash_app_enabled) availablePayments.push('cash_app');
    if (bs?.zelle_enabled) availablePayments.push('zelle');
    let typicallyUsed = [];
    if (recent?.payment_methods_enabled) {
      typicallyUsed = Object.entries(recent.payment_methods_enabled).filter(([key, value])=>value === true).map(([key])=>key);
    }
    // Compact context format
    let context = '\n\nINVOICE CREATION CONTEXT:\n';
    context += `TAX: ${recent?.tax_rate || bs?.default_tax_rate || 0}% (${bs?.tax_label || 'Tax'}) | `;
    context += `PAYMENTS_AVAILABLE: ${availablePayments.join(',') || 'none'} | `;
    context += `USER_TYPICALLY_ENABLES: ${typicallyUsed.join(',') || 'none'} | `;
    context += `DESIGN: ${recent?.invoice_design || bs?.default_invoice_design || 'clean'} | `;
    context += `TERMS: ${recent?.payment_terms_days || bs?.payment_terms_days || 30}days | `;
    context += `FORMAT: ${bs?.invoice_reference_format || 'INV-001'}\n`;
    context += '\nCRITICAL PAYMENT METHOD RULES:\n';
    context += '⚠️  NEVER enable payment methods that are NOT in PAYMENTS_AVAILABLE list above\n';
    context += '⚠️  If PAYMENTS_AVAILABLE shows "none" - DO NOT enable any payment methods\n';
    context += '⚠️  You can ONLY enable: ' + (availablePayments.join(', ') || 'NONE - no payment methods available') + '\n';
    context += '⚠️  Example: If stripe is NOT in available list, you cannot enable stripe on invoice\n';
    context += '\nINVOICE CREATION INSTRUCTIONS:\n';
    context += '• Use the tax rate and label shown above as defaults\n';
    context += '• If user typically enables certain payments AND they are available, default to those\n';
    context += '• If user doesn\'t specify payments, use typical pattern ONLY if methods are available\n';
    context += '• If no payments available, create invoice without any payment methods enabled\n';
    context += '• Apply the user\'s preferred design and payment terms\n';
    console.log('[InvoiceContext] Generated optimized context:', context);
    return context;
  } catch (error) {
    console.error('[InvoiceContext] Error fetching context:', error);
    return '\n\nINVOICE CREATION CONTEXT: Unable to load business settings, using system defaults.\n';
  }
}
// Inline ReferenceNumberService for sequential invoice numbering
class ReferenceNumberService {
  static async generateNextReference(supabase, userId, type = 'invoice') {
    try {
      console.log('[ReferenceNumberService] Generating reference for user:', userId, 'type:', type);
      // Get user's invoice reference format from settings
      const { data: businessSettings, error: settingsError } = await supabase.from('business_settings').select('invoice_reference_format').eq('user_id', userId).single();
      if (settingsError && settingsError.code !== 'PGRST116') {
        // PGRST116 is "no rows found" which is expected for new users
        console.error('[ReferenceNumberService] Error fetching business settings:', settingsError);
      }
      const referenceFormat = businessSettings?.invoice_reference_format || 'INV-001';
      console.log('[ReferenceNumberService] Using reference format:', referenceFormat);
      // Parse the format to understand structure
      const formatConfig = this.parseReferenceFormat(referenceFormat);
      // Get the latest number from the combined sequence
      const latestNumber = await this.getLatestReferenceNumber(supabase, userId);
      // Generate the next number using the format
      const nextNumber = latestNumber + 1;
      console.log('[ReferenceNumberService] Next number will be:', nextNumber);
      // Apply the format structure
      const newReference = this.formatReferenceNumber(formatConfig, nextNumber, type);
      console.log('[ReferenceNumberService] Generated reference:', newReference);
      return newReference;
    } catch (error) {
      console.error('[ReferenceNumberService] Error generating reference number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6);
      const fallbackRef = type === 'estimate' ? `EST-${timestamp}` : `INV-${timestamp}`;
      console.log('[ReferenceNumberService] Using fallback reference:', fallbackRef);
      return fallbackRef;
    }
  }
  static parseReferenceFormat(format) {
    // Extract prefix (everything before the first dash or number)
    const prefixMatch = format.match(/^([A-Za-z]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : 'INV';
    // Check for year pattern
    const includeYear = format.includes('YYYY') || /\d{4}/.test(format);
    // Check for month pattern
    const includeMonth = format.includes('MM') || includeYear && /\d{2}/.test(format.replace(/\d{4}/, ''));
    // Extract number length from the trailing number
    const numberMatch = format.match(/(\d+)$/);
    const numberLength = numberMatch ? numberMatch[1].length : 6; // Changed default from 3 to 6
    console.log('[ReferenceNumberService] Parsed format:', {
      prefix,
      includeYear,
      includeMonth,
      numberLength,
      format
    });
    return {
      prefix,
      includeYear,
      includeMonth,
      numberLength,
      customFormat: format
    };
  }
  static async getLatestReferenceNumber(supabase, userId) {
    try {
      // Get latest from invoices - use maybeSingle() to avoid errors when no records exist
      const { data: invoices } = await supabase.from('invoices').select('invoice_number').eq('user_id', userId).order('created_at', {
        ascending: false
      }).limit(1);
      // Get latest from estimates  
      const { data: estimates } = await supabase.from('estimates').select('estimate_number').eq('user_id', userId).order('created_at', {
        ascending: false
      }).limit(1);
      let maxNumber = 0;
      // Extract number from invoice
      const latestInvoice = invoices?.[0];
      if (latestInvoice?.invoice_number) {
        console.log('[ReferenceNumberService] Latest invoice number:', latestInvoice.invoice_number);
        const invoiceMatch = latestInvoice.invoice_number.match(/(\d+)$/);
        if (invoiceMatch) {
          const invoiceNum = parseInt(invoiceMatch[1]);
          console.log('[ReferenceNumberService] Extracted invoice number:', invoiceNum);
          // SAFETY CHECK: Ignore timestamp-based numbers (likely AI-generated fallbacks)
          // Normal invoice numbers should be under 1,000,000
          if (invoiceNum > 1000000) {
            console.log('[ReferenceNumberService] Ignoring timestamp-based invoice number:', invoiceNum);
          } else {
            maxNumber = Math.max(maxNumber, invoiceNum);
          }
        }
      }
      // Extract number from estimate  
      const latestEstimate = estimates?.[0];
      if (latestEstimate?.estimate_number) {
        console.log('[ReferenceNumberService] Latest estimate number:', latestEstimate.estimate_number);
        const estimateMatch = latestEstimate.estimate_number.match(/(\d+)$/);
        if (estimateMatch) {
          const estimateNum = parseInt(estimateMatch[1]);
          console.log('[ReferenceNumberService] Extracted estimate number:', estimateNum);
          // SAFETY CHECK: Ignore timestamp-based numbers (likely AI-generated fallbacks)
          // Normal estimate numbers should be under 1,000,000
          if (estimateNum > 1000000) {
            console.log('[ReferenceNumberService] Ignoring timestamp-based estimate number:', estimateNum);
          } else {
            maxNumber = Math.max(maxNumber, estimateNum);
          }
        }
      }
      console.log('[ReferenceNumberService] Found max number:', maxNumber, 'for user:', userId);
      return maxNumber;
    } catch (error) {
      console.error('[ReferenceNumberService] Error getting latest reference number:', error);
      return 0;
    }
  }
  static formatReferenceNumber(config, number, type) {
    let reference = config.prefix || 'INV';
    if (config.includeYear) {
      reference += `-${new Date().getFullYear()}`;
    }
    if (config.includeMonth) {
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      reference += `-${month}`;
    }
    const paddedNumber = number.toString().padStart(config.numberLength || 3, '0');
    reference += `-${paddedNumber}`;
    return reference;
  }
}
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    // Initialize OpenAI with v2 Assistants API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    const openai = new OpenAI({
      apiKey: openaiApiKey,
      dangerouslyAllowBrowser: false,
      defaultHeaders: {
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    // Parse request - handle both direct and current app payload formats
    const payload = await req.json();
    console.log('[Assistants POC] Raw payload:', JSON.stringify(payload, null, 2));
    // Extract data from current app format or direct format
    const message = payload.message;
    const user_id = payload.userId || payload.user_id;
    const conversation_id = payload.conversation_id;
    const threadId = payload.threadId;
    const userContext = payload.userContext;
    if (!message || !user_id) {
      return new Response(JSON.stringify({
        error: 'Message and user_id/userId required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('[Assistants POC] Processing message:', message);
    console.log('[Assistants POC] User ID:', user_id);
    console.log('[Assistants POC] Received threadId:', threadId || 'NONE - will create new');
    // Use pre-created assistant for speed (no creation overhead)
    const ASSISTANT_ID = "asst_o9Js9OWuPl2kEWLJu0qBHCqh" // Latest created assistant from logs
    ;
    console.log('[Assistants POC] Using pre-created assistant:', ASSISTANT_ID);
    // Verify assistant exists and update it with latest instructions
    let assistant;
    try {
      assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
      console.log('[Assistants POC] Found existing assistant:', assistant.id);
      // ENHANCED CONVERSATION CONTEXT DETECTION
      const conversationContext = detectConversationContext(message, user_id);
      const lastAction = ConversationMemory.getLastAction(user_id);
      console.log(`[Assistants POC] Conversation context: ${conversationContext}`);
      console.log(`[Assistants POC] Last action:`, lastAction);
      let contextString = '';
      if (conversationContext === 'create') {
        console.log('[Assistants POC] Invoice creation detected - fetching business context...');
        contextString = await getInvoiceCreationContext(supabase, user_id);
      } else if (conversationContext === 'update_latest' && lastAction) {
        console.log('[Assistants POC] Update context detected with recent action');
        contextString = `\n\nACTIVE CONVERSATION CONTEXT:\n`;
        contextString += `• Last action: ${lastAction.action}\n`;
        if (lastAction.invoice_number) {
          contextString += `• Current invoice: ${lastAction.invoice_number}\n`;
        }
        if (lastAction.client_name) {
          contextString += `• Current client: ${lastAction.client_name}\n`;
        }
        contextString += `• When user says "add", "update", "change" - they mean THIS invoice/client\n`;
        contextString += `• Use invoice_identifier: "latest" or "${lastAction.invoice_number || 'latest'}"\n`;
      } else {
        console.log('[Assistants POC] General conversation - minimal context');
      }
      // Always update the assistant with latest instructions 
      console.log('[Assistants POC] Updating assistant with latest instructions...');
      assistant = await openai.beta.assistants.update(ASSISTANT_ID, {
        name: "Invoice AI Assistant",
        instructions: `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.${contextString}

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

🚨🚨 CRITICAL CONTEXT AWARENESS - NEVER LOSE CONTEXT! 🚨🚨

**CONVERSATION MEMORY RULES:**
${contextString}

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
• Use update_payment_methods function (returns updated invoice attachment)
• Keywords: "enable", "activate", "turn on", "add", "card payments", "stripe", "paypal", "bank transfer"
• Examples:
  - "Enable card payments on invoice INV-123456" → update_payment_methods(invoice_identifier: "INV-123456", enable_stripe: true)
  - "Add PayPal to this invoice" → update_payment_methods(invoice_identifier: "latest", enable_paypal: true)
  - "Turn on bank transfer for invoice INV-789012" → update_payment_methods(invoice_identifier: "INV-789012", enable_bank_transfer: true)
• IMPORTANT: Only enable payment methods that are enabled in business settings
• Function automatically shows updated invoice with payment options enabled

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
- Check if paypal_enabled is true AND paypal_email exists

Step 2: Handle based on current state
IF PayPal already enabled with email (paypal_enabled=true AND paypal_email exists):
- ✅ CORRECT: Use update_payment_methods(invoice_identifier: "INV-XXX", enable_paypal: true)
- ❌ WRONG: Do NOT call setup_paypal_payments - that's for global setup only
- Show updated invoice with PayPal enabled

IF PayPal disabled (paypal_enabled=false) OR no email configured:
- Ask user for their PayPal email address
- Example: "I'll add PayPal to your invoice. What's your PayPal email address?"
- Wait for email, then call setup_paypal_payments(paypal_email: "[email]", invoice_number: "INV-XXX")
- This sets up PayPal globally AND enables it on the specific invoice

🚨 CRITICAL DISTINCTION:
- update_payment_methods = Enable payment method on invoice (when already configured globally)
- setup_paypal_payments = Configure PayPal globally + enable on invoice (when not configured)

MANDATORY SEQUENCE:
1. get_payment_options (check current state)
2A. IF already configured: update_payment_methods(enable_paypal: true) 
2B. IF not configured: Ask for email → setup_paypal_payments
3. Always show updated invoice

CONVERSATION CONTEXT & INVOICE FLOW:
CORE PRINCIPLE: Always try to show the user an invoice when possible!

ACTIVE INVOICE CONTEXT:
• When user creates an invoice, it becomes the "active context"
• User is likely still working on/thinking about this invoice
• ANY subsequent changes should update and re-show this invoice

PRONOUN REFERENCE RESOLUTION:
• "this invoice" = the most recently created/discussed invoice in conversation history
• "this" when talking about invoices = the invoice from the last message that showed an invoice
• "it" when talking about invoices = the invoice just created or discussed
• "update it" = update the most recent invoice in conversation
• ALWAYS look at conversation history to identify what "this"/"it" refers to
• Extract the invoice_number from the most recent assistant message that contained an invoice
• Pass the specific invoice_number to functions like add_line_item, update_invoice, etc.

CRITICAL: NEVER ask "Who is this invoice for?" when user says "update it" after creating an invoice!

MOST IMPORTANT: When user says "update it" - look at the conversation history and find the most recent invoice number (INV-XXXXXX) from assistant messages, then use that directly!

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
• Line item additions: "Please update it too have 10 Blackwall's also - 10000 each" → use add_line_item with most recent invoice number

SPECIFIC EXAMPLES FROM LOGS:
• Assistant says: "I've created invoice **INV-009** for Jensen that totals **$25,000.00**"
• User says: "Please update it too have 10 Blackwall's also - 10000 each"
• AI should IMMEDIATELY:
  1. Scan conversation history for "INV-009" (most recent invoice number)
  2. Call add_line_item(invoice_identifier="INV-009", item_name="Blackwall's", quantity=10, unit_price=10000)
  3. Return updated invoice preview
• AI should NEVER call find_invoice or ask "Who is this invoice for?"

WRONG BEHAVIOR (from logs):
❌ Calling find_invoice { get_latest: true }
❌ Getting database errors
❌ Asking "Who is this invoice for?"

CORRECT BEHAVIOR:
✅ Extract "INV-009" from conversation history directly
✅ Call add_line_item with extracted invoice number
✅ Return updated invoice

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

🚨 CRITICAL PAYMENT WORKFLOWS - FOLLOW EXACTLY! 🚨

**MARK INVOICE AS PAID WORKFLOW:**
When user says "mark [invoice] as paid" or "set [invoice] to paid":
1. MUST call update_invoice with ALL payment parameters:
   - status: "paid" 
   - paid_amount: [FULL invoice total_amount - get from context]
   - payment_date: [current date in YYYY-MM-DD format]
   - payment_notes: "Marked as paid via AI assistant"
2. NEVER just set status alone - ALWAYS include all payment tracking
3. Example call: update_invoice(invoice_identifier="latest", status="paid", paid_amount=1500.00, payment_date="2024-12-21", payment_notes="Marked as paid via AI assistant")

**RECORD PAYMENT WORKFLOW (Partial/Incremental):**
When user says "record $X payment" or "client paid $X":
1. MUST call update_invoice with payment parameters:
   - paid_amount: [specified amount - let function auto-calculate status]  
   - payment_date: [current date]
   - payment_notes: "Payment recorded via AI assistant: $X.XX"
2. Do NOT set status manually - let function auto-calculate
3. Example: update_invoice(invoice_identifier="INV-123", paid_amount=500.00, payment_date="2024-12-21", payment_notes="Payment recorded via AI assistant: $500.00")

**MARK INVOICE AS UNPAID WORKFLOW:**
When user says "mark as unpaid" or "reset payment":
1. MUST call update_invoice with:
   - status: "sent"
   - paid_amount: 0
   - payment_date: null
   - payment_notes: null
2. This completely resets payment tracking

**PAYMENT AMOUNT LOGIC:**
- For "mark as paid": paid_amount = FULL invoice total
- For "record $X payment": paid_amount = specified amount (incremental)
- For "set payment to $X": paid_amount = exact specified amount
- Status will auto-calculate: 0=sent, partial=partial, full=paid

**CRITICAL RULE:** NEVER update payment status without updating payment amounts!

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
                      required: [
                        "item_name",
                        "unit_price"
                      ]
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
                    description: "Enable PayPal payments on this invoice - ONLY if available in business settings (optional, defaults to false)"
                  },
                  paypal_email: {
                    type: "string",
                    description: "PayPal email if enabling PayPal payments (required if enable_paypal is true)"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable Stripe card payments on this invoice - ONLY if available in business settings (optional, defaults to false)"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable bank transfer payments on this invoice - ONLY if available in business settings (optional, defaults to false)"
                  },
                  invoice_design: {
                    type: "string",
                    description: "Invoice design template: 'professional', 'modern', 'clean', 'simple' (optional, defaults to 'clean')",
                    enum: [
                      "professional",
                      "modern",
                      "clean",
                      "simple",
                      "wave"
                    ]
                  },
                  accent_color: {
                    type: "string",
                    description: "Hex color code for invoice accent color (optional, e.g., '#3B82F6')"
                  },
                  discount_type: {
                    type: "string",
                    description: "Type of discount: 'percentage' or 'fixed' (optional)",
                    enum: [
                      "percentage",
                      "fixed"
                    ]
                  },
                  discount_value: {
                    type: "number",
                    description: "Discount amount (percentage or fixed amount based on discount_type, optional)"
                  }
                },
                required: [
                  "client_name",
                  "line_items"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_business_settings",
              description: "Update the user's business information and tax settings that appear on all invoices. Use when user mentions 'my', 'our', 'my business' address/details or wants to adjust tax settings.",
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
                  business_website: {
                    type: "string",
                    description: "Business website URL (optional)"
                  },
                  tax_number: {
                    type: "string",
                    description: "Business tax/VAT number (optional)"
                  },
                  tax_name: {
                    type: "string",
                    description: "Tax label/name (e.g., 'VAT', 'Sales Tax', 'GST') (optional)"
                  },
                  default_tax_rate: {
                    type: "number",
                    description: "Default tax rate as percentage (e.g., 20 for 20%) (optional)"
                  },
                  auto_apply_tax: {
                    type: "boolean",
                    description: "Whether to automatically apply tax to new invoices (optional)"
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
                  }
                },
                required: [
                  "invoice_number"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "get_payment_options",
              description: "Check what payment methods are currently enabled and configured",
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
              name: "setup_paypal_payments",
              description: "Enable PayPal payments by providing PayPal email address. Can also activate PayPal on a specific invoice.",
              parameters: {
                type: "object",
                properties: {
                  paypal_email: {
                    type: "string",
                    description: "PayPal email address for receiving payments (required)"
                  },
                  invoice_number: {
                    type: "string",
                    description: "Optional invoice number to also activate PayPal on"
                  }
                },
                required: [
                  "paypal_email"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "setup_bank_transfer",
              description: "Enable bank transfer payments by providing bank details. Can also activate bank transfer on a specific invoice.",
              parameters: {
                type: "object",
                properties: {
                  bank_details: {
                    type: "string",
                    description: "Bank account details for receiving transfers (e.g., account name, number, sort code, IBAN) (required)"
                  },
                  invoice_number: {
                    type: "string",
                    description: "Optional invoice number to also activate bank transfer on"
                  }
                },
                required: [
                  "bank_details"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_invoice",
              description: "Update any aspect of an existing invoice - client info, line items, amounts, design, payment methods, etc. PAYMENT WORKFLOWS: For 'mark as paid' set paid_amount=total_amount + status='paid'. For partial payments use cumulative amounts. For 'mark as unpaid' set paid_amount=0 + status='sent'.",
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
                  },
                  invoice_date: {
                    type: "string",
                    description: "Update invoice date (YYYY-MM-DD format)"
                  },
                  due_date: {
                    type: "string",
                    description: "Update due date (YYYY-MM-DD format)"
                  },
                  payment_terms_days: {
                    type: "number",
                    description: "Update payment terms in days"
                  },
                  notes: {
                    type: "string",
                    description: "Update invoice notes"
                  },
                  status: {
                    type: "string",
                    description: "Update invoice status. BUSINESS LOGIC: Use 'paid' for full payments, 'partial' for partial payments, 'sent' for unpaid/sent invoices, 'draft' for work-in-progress. Status should match payment amount: 0=sent, 0<partial<total=partial, full=paid.",
                    enum: [
                      "draft",
                      "sent",
                      "partial",
                      "paid",
                      "overdue"
                    ]
                  },
                  tax_rate: {
                    type: "number",
                    description: "Update tax rate percentage"
                  },
                  discount_type: {
                    type: "string",
                    description: "Update discount type: 'percentage' or 'fixed'",
                    enum: [
                      "percentage",
                      "fixed"
                    ]
                  },
                  discount_value: {
                    type: "number",
                    description: "Update discount amount"
                  },
                  invoice_design: {
                    type: "string",
                    description: "Update invoice design: 'professional', 'modern', 'clean', 'simple', 'wave'",
                    enum: [
                      "professional",
                      "modern",
                      "clean",
                      "simple",
                      "wave"
                    ]
                  },
                  accent_color: {
                    type: "string",
                    description: "Update accent color (hex code, e.g., '#FF6B35')"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable/disable Stripe payments"
                  },
                  enable_paypal: {
                    type: "boolean",
                    description: "Enable/disable PayPal payments"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable/disable bank transfer payments"
                  },
                  invoice_number: {
                    type: "string",
                    description: "Update invoice reference number (e.g., change from INV-123 to INV-2024-001)"
                  },
                  paid_amount: {
                    type: "number",
                    description: "PAYMENT WORKFLOW: Set exact paid amount. For 'mark as paid' use total_amount. For partial payments use cumulative amount. Status auto-calculated: 0=sent, partial=partial, full=paid."
                  },
                  payment_date: {
                    type: "string",
                    description: "Date payment was received (YYYY-MM-DD format). Use current date for new payments, null for unpaid invoices."
                  },
                  payment_notes: {
                    type: "string",
                    description: "Payment method and context. Use 'Marked as paid via AI assistant' for full payments, 'Payment recorded via AI assistant: $XXX.XX' for partials."
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
                      required: [
                        "item_name",
                        "unit_price"
                      ]
                    }
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
              name: "add_line_item",
              description: "Add a new line item to an existing invoice",
              parameters: {
                type: "object",
                properties: {
                  invoice_identifier: {
                    type: "string",
                    description: "Invoice number (e.g., 'INV-004'), client name, or 'latest' for most recent invoice"
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
                required: [
                  "invoice_identifier",
                  "item_name",
                  "unit_price"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "remove_line_item",
              description: "Remove a specific line item from an existing invoice",
              parameters: {
                type: "object",
                properties: {
                  invoice_identifier: {
                    type: "string",
                    description: "Invoice number (e.g., 'INV-004'), client name, or 'latest' for most recent invoice"
                  },
                  item_identifier: {
                    type: "string",
                    description: "Name of the line item to remove, or item index (1st item, 2nd item, etc.)"
                  }
                },
                required: [
                  "invoice_identifier",
                  "item_identifier"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_line_item",
              description: "Update a specific line item in an existing invoice",
              parameters: {
                type: "object",
                properties: {
                  invoice_identifier: {
                    type: "string",
                    description: "Invoice number (e.g., 'INV-004'), client name, or 'latest' for most recent invoice"
                  },
                  item_identifier: {
                    type: "string",
                    description: "Name of the line item to update, or item index (1st item, 2nd item, etc.)"
                  },
                  item_name: {
                    type: "string",
                    description: "Update item name/description"
                  },
                  quantity: {
                    type: "number",
                    description: "Update item quantity"
                  },
                  unit_price: {
                    type: "number",
                    description: "Update item unit price"
                  },
                  item_description: {
                    type: "string",
                    description: "Update item detailed description (use null to remove)"
                  }
                },
                required: [
                  "invoice_identifier",
                  "item_identifier"
                ]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_client_info",
              description: "Update client information for an existing invoice and save to client profile",
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
              name: "update_payment_methods",
              description: "Update payment methods for an existing invoice. Only enables methods if they are enabled in business settings.",
              parameters: {
                type: "object",
                properties: {
                  invoice_identifier: {
                    type: "string",
                    description: "Invoice number (e.g., 'INV-004'), client name, or 'latest' for most recent invoice"
                  },
                  enable_stripe: {
                    type: "boolean",
                    description: "Enable/disable Stripe card payments"
                  },
                  enable_paypal: {
                    type: "boolean",
                    description: "Enable/disable PayPal payments"
                  },
                  enable_bank_transfer: {
                    type: "boolean",
                    description: "Enable/disable bank transfer payments"
                  }
                },
                required: [
                  "invoice_identifier"
                ]
              }
            }
          }
        ],
        model: "gpt-4o-mini"
      });
      console.log('[Assistants POC] Updated assistant successfully');
    } catch (error) {
      console.log('[Assistants POC] Assistant not found, creating new one...');
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
• Use update_payment_methods function (returns updated invoice attachment)
• Keywords: "enable", "activate", "turn on", "add", "card payments", "stripe", "paypal", "bank transfer"
• Examples:
  - "Enable card payments on invoice INV-123456" → update_payment_methods(invoice_identifier: "INV-123456", enable_stripe: true)
  - "Add PayPal to this invoice" → update_payment_methods(invoice_identifier: "latest", enable_paypal: true)
  - "Turn on bank transfer for invoice INV-789012" → update_payment_methods(invoice_identifier: "INV-789012", enable_bank_transfer: true)
• IMPORTANT: Only enable payment methods that are enabled in business settings
• Function automatically shows updated invoice with payment options enabled

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
        model: "gpt-4o-mini"
      });
      console.log('[Assistants POC] Created new assistant:', assistant.id);
      console.log('[Assistants POC] 🚨 UPDATE CODE: Set ASSISTANT_ID to:', assistant.id);
    }
    // 🚨 CRITICAL FIX: Use existing thread or create new one with error handling
    let thread;
    let threadReused = false;
    if (threadId) {
      console.log('[Assistants POC] 🔄 Attempting to reuse existing thread:', threadId);
      try {
        // Test if thread exists by trying to add message
        await openai.beta.threads.messages.create(threadId, {
          role: "user",
          content: message
        });
        thread = {
          id: threadId
        };
        threadReused = true;
        console.log('[Assistants POC] ✅ Successfully reused thread:', threadId);
      } catch (error) {
        console.log('[Assistants POC] ❌ Thread reuse failed:', error.message);
        // Check if it's an "active run" error and try to handle it
        if (error.message.includes('while a run') && error.message.includes('is active')) {
          console.log('[Assistants POC] 🛑 Active run detected - will create new thread');
        }
        console.log('[Assistants POC] 🆕 Creating new thread due to error...');
        thread = await openai.beta.threads.create();
        await openai.beta.threads.messages.create(thread.id, {
          role: "user",
          content: message
        });
        console.log('[Assistants POC] ✅ Created NEW thread:', thread.id);
      }
    } else {
      // Create new thread only if none exists
      thread = await openai.beta.threads.create();
      await openai.beta.threads.messages.create(thread.id, {
        role: "user",
        content: message
      });
      console.log('[Assistants POC] ✅ Created NEW thread (no threadId provided):', thread.id);
    }
    // Create run with assistant  
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });
    console.log('[Assistants POC] Started run:', run.id, threadReused ? '(reused thread)' : '(new thread)');
    // Shared attachments array for tool calls
    let attachments = [];
    // Function to handle tool calls
    const handleToolCall = async (toolCall)=>{
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);
      console.log('[Assistants POC] Tool call:', name, parsedArgs);
      if (name === 'create_invoice') {
        const { client_name, client_email, client_phone, client_address, client_tax_number, line_items, due_date, invoice_date, tax_percentage, notes, payment_terms, enable_paypal, paypal_email, enable_stripe, enable_bank_transfer, invoice_design, accent_color, discount_type, discount_value } = parsedArgs;
        // Calculate subtotal
        const subtotal_amount = line_items.reduce((sum, item)=>sum + item.unit_price * (item.quantity || 1), 0);
        // Apply discount if specified
        let discount_amount = 0;
        if (discount_type && discount_value) {
          if (discount_type === 'percentage') {
            discount_amount = subtotal_amount * (discount_value / 100);
          } else if (discount_type === 'fixed') {
            discount_amount = discount_value;
          }
        }
        const after_discount = subtotal_amount - discount_amount;
        // Calculate tax
        const tax_rate = tax_percentage || 0;
        const tax_amount = after_discount * (tax_rate / 100);
        // Calculate final total
        const total_amount = after_discount + tax_amount;
        // Create dates
        const invoiceDate = invoice_date || new Date().toISOString().split('T')[0];
        const invoiceDueDate = due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Generate invoice number using sequential numbering
        const invoice_number = await ReferenceNumberService.generateNextReference(supabase, user_id, 'invoice');
        // Get user's business settings for default design and color
        const { data: businessSettings } = await supabase.from('business_settings').select('default_invoice_design, default_accent_color').eq('user_id', user_id).single();
        // Use user's defaults instead of hardcoded values
        const defaultDesign = businessSettings?.default_invoice_design || 'clean';
        const defaultColor = businessSettings?.default_accent_color || '#3B82F6';
        // Combine notes and payment terms
        let finalNotes = '';
        if (payment_terms) finalNotes += `Payment Terms: ${payment_terms}`;
        if (notes) finalNotes += (finalNotes ? '\n\n' : '') + notes;
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
          design: invoice_design || 'clean'
        });
        // First, create or get client  
        let clientId = null;
        if (client_name) {
          // Try to find existing client (use case-insensitive search to avoid duplicates from spacing/case issues)
          const { data: existingClient, error: searchError } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('name', client_name.trim()).maybeSingle();
          
          if (searchError) {
            console.error('[create_invoice] Error searching for existing client:', searchError);
            return `Error searching for client: ${searchError.message}`;
          }
          
          console.log('[create_invoice] Client search result for "' + client_name + '":', existingClient ? 'FOUND existing client' : 'NOT FOUND - will create new');
          
          if (existingClient) {
            clientId = existingClient.id;
            // Update existing client with any new information provided
            const updateData = {};
            if (client_email) updateData.email = client_email;
            if (client_phone) updateData.phone = client_phone;
            if (client_address) updateData.address_client = client_address;
            if (client_tax_number) updateData.tax_number = client_tax_number;
            if (Object.keys(updateData).length > 0) {
              const { error: updateError } = await supabase.from('clients').update(updateData).eq('id', clientId);
              if (updateError) {
                console.error('[Assistants POC] Client update error:', updateError);
              } else {
                console.log('[Assistants POC] Updated existing client with new info');
              }
            }
          } else {
            // Create new client with all available info
            console.log('[create_invoice] Creating NEW client:', client_name);
            const { data: newClient, error: clientError } = await supabase.from('clients').insert({
              user_id: user_id,
              name: client_name,
              email: client_email || null,
              phone: client_phone || null,
              address_client: client_address || null,
              tax_number: client_tax_number || null,
              created_at: new Date().toISOString()
            }).select('id').single();
            if (clientError) {
              console.error('[create_invoice] Client creation error:', clientError);
              return `Error creating client: ${clientError.message}`;
            }
            console.log('[create_invoice] Successfully created new client with ID:', newClient.id);
            clientId = newClient.id;
          }
        }
        // Create comprehensive invoice in database
        const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
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
          bank_account_active: enable_bank_transfer === true,
          invoice_design: invoice_design || defaultDesign,
          accent_color: accent_color || defaultColor,
          created_at: new Date().toISOString()
        }).select().single();
        if (invoiceError) {
          console.error('[Assistants POC] Invoice creation error:', invoiceError);
          return `Error creating invoice: ${invoiceError.message}`;
        }
        console.log('[Assistants POC] Created invoice:', invoice.id);
        // Create comprehensive line items with all details
        const createdLineItems = [];
        for (const item of line_items){
          const quantity = item.quantity || 1;
          const { data: lineItem, error } = await supabase.from('invoice_line_items').insert({
            invoice_id: invoice.id,
            user_id: user_id,
            item_name: item.item_name,
            item_description: item.item_description || null,
            quantity: quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * quantity,
            created_at: new Date().toISOString()
          }).select().single();
          if (error) {
            console.error('[Assistants POC] Line item error:', error);
          } else {
            createdLineItems.push(lineItem);
          }
        }
        console.log('[Assistants POC] Created', createdLineItems.length, 'line items');
        // Fetch the full client data if we have a clientId
        let clientData = null;
        if (clientId) {
          const { data: fullClient } = await supabase.from('clients').select('*').eq('id', clientId).single();
          if (fullClient) {
            clientData = fullClient;
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
        });
        // 🚨 CONVERSATION MEMORY - Track that we just created this invoice
        ConversationMemory.setLastAction(user_id, 'created_invoice', {
          invoice_number: invoice_number,
          client_name: client_name,
          invoice_id: invoice.id,
          client_id: clientId
        });
        // Build concise success message as requested
        const successMessage = `I've created invoice ${invoice_number} for ${client_name} that totals $${total_amount.toFixed(2)}.


Let me know if you'd like any changes?`;
        return successMessage;
      }
      if (name === 'setup_paypal_payments') {
        console.log('[Assistants POC] Setting up PayPal payments');
        return `✅ PayPal payments have been enabled. Clients can now pay via PayPal.`;
      }
      if (name === 'update_business_settings') {
        const { business_name, business_address, business_phone, business_email, business_website, tax_number, tax_name, default_tax_rate, auto_apply_tax } = parsedArgs;
        console.log('[Assistants POC] Updating business settings:', parsedArgs);
        // Build update object with only provided fields - using correct column names from business_settings table
        const updateData = {
          updated_at: new Date().toISOString()
        };
        if (business_name !== undefined) updateData.business_name = business_name;
        if (business_address !== undefined) updateData.business_address = business_address;
        if (business_phone !== undefined) updateData.business_phone = business_phone;
        if (business_email !== undefined) updateData.business_email = business_email;
        if (business_website !== undefined) updateData.business_website = business_website;
        if (tax_number !== undefined) updateData.tax_number = tax_number;
        if (tax_name !== undefined) updateData.tax_name = tax_name;
        if (default_tax_rate !== undefined) updateData.default_tax_rate = default_tax_rate;
        if (auto_apply_tax !== undefined) updateData.auto_apply_tax = auto_apply_tax;
        // 🚨 CRITICAL FIX: Update business_settings table, not profiles table!
        const { data: settings, error: settingsError } = await supabase.from('business_settings').update(updateData).eq('user_id', user_id).select().single();
        if (settingsError) {
          console.error('[Assistants POC] Business settings update error:', settingsError);
          return `Error updating business settings: ${settingsError.message}`;
        }
        console.log('[Assistants POC] Business settings updated successfully');
        // Build success message
        let successMessage = '✅ Business settings updated:';
        if (business_name) successMessage += `\n• Business name: ${business_name}`;
        if (business_address) successMessage += `\n• Address: ${business_address}`;
        if (business_phone) successMessage += `\n• Phone: ${business_phone}`;
        if (business_email) successMessage += `\n• Email: ${business_email}`;
        if (business_website) successMessage += `\n• Website: ${business_website}`;
        if (tax_number) successMessage += `\n• Tax number: ${tax_number}`;
        if (tax_name) successMessage += `\n• Tax label: ${tax_name}`;
        if (default_tax_rate !== undefined) successMessage += `\n• Default tax rate: ${default_tax_rate}%`;
        if (auto_apply_tax !== undefined) successMessage += `\n• Auto-apply tax: ${auto_apply_tax ? 'Enabled' : 'Disabled'}`;
        return successMessage;
      }
      if (name === 'enable_payment_methods') {
        const { invoice_number, enable_stripe, enable_paypal, enable_bank_transfer } = parsedArgs;
        console.log('[Assistants POC] Enabling payment methods for invoice:', invoice_number, parsedArgs);
        // 🚨 CRITICAL FIX: Check payment_options table, not profiles table
        const { data: paymentOptions, error: paymentError } = await supabase.from('payment_options').select('stripe_enabled, paypal_enabled, bank_transfer_enabled, paypal_email, bank_details').eq('user_id', user_id).single();
        if (paymentError) {
          console.error('[Assistants POC] Payment options error:', paymentError);
          return `Error checking payment settings: ${paymentError.message}`;
        }
        // Find the invoice by invoice number
        const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('id').eq('user_id', user_id).eq('invoice_number', invoice_number).single();
        if (invoiceError || !invoice) {
          console.error('[Assistants POC] Invoice not found:', invoiceError);
          return `Error: Invoice ${invoice_number} not found.`;
        }
        // Build update object and validation messages
        const updateData = {};
        const enabledMethods = [];
        const skippedMethods = [];
        if (enable_stripe) {
          if (paymentOptions.stripe_enabled) {
            updateData.stripe_active = true;
            enabledMethods.push('Stripe card payments');
          } else {
            skippedMethods.push('Stripe card payments (not enabled in business settings)');
          }
        }
        if (enable_paypal) {
          if (paymentOptions.paypal_enabled) {
            updateData.paypal_active = true;
            enabledMethods.push('PayPal payments');
          } else {
            skippedMethods.push('PayPal payments (not enabled in business settings)');
          }
        }
        if (enable_bank_transfer) {
          if (paymentOptions.bank_transfer_enabled) {
            updateData.bank_account_active = true;
            enabledMethods.push('Bank transfer');
          } else {
            skippedMethods.push('Bank transfer (not enabled in business settings)');
          }
        }
        // Note: Venmo and ACH not implemented in payment_options schema yet
        // Update the invoice with enabled payment methods
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase.from('invoices').update(updateData).eq('id', invoice.id);
          if (updateError) {
            console.error('[Assistants POC] Invoice payment update error:', updateError);
            return `Error updating payment methods: ${updateError.message}`;
          }
        }
        // Build response message
        let successMessage = `✅ Payment methods updated for invoice ${invoice_number}`;
        if (enabledMethods.length > 0) {
          successMessage += `\n\n**Enabled:**\n• ${enabledMethods.join('\n• ')}`;
        }
        if (skippedMethods.length > 0) {
          successMessage += `\n\n**Skipped:**\n• ${skippedMethods.join('\n• ')}`;
          successMessage += `\n\nTo enable these payment methods, please first enable them in your business payment settings.`;
        }
        console.log('[Assistants POC] Payment methods updated successfully');
        return successMessage;
      }
      if (name === 'get_payment_options') {
        console.log('[Assistants POC] Getting payment options for user:', user_id);
        const { data: paymentOptions, error } = await supabase.from('payment_options').select('*').eq('user_id', user_id).single();
        if (error && error.code !== 'PGRST116') {
          console.error('[Assistants POC] Error fetching payment options:', error);
          return `Error fetching payment options: ${error.message}`;
        }
        if (!paymentOptions) {
          return `⚙️ **Payment Options Status:**
• Stripe: Not configured (enable in Settings > Payment Options)
• PayPal: Not configured
• Bank Transfer: Not configured

To accept payments, configure at least one payment method.`;
        }
        let status = `⚙️ **Payment Options Status:**\n`;
        status += `• Stripe: ${paymentOptions.stripe_enabled ? '✅ Enabled' : '❌ Disabled (enable in Settings > Payment Options)'}\n`;
        status += `• PayPal: ${paymentOptions.paypal_enabled ? `✅ Enabled (${paymentOptions.paypal_email})` : '❌ Disabled'}\n`;
        status += `• Bank Transfer: ${paymentOptions.bank_transfer_enabled ? '✅ Enabled' : '❌ Disabled'}`;
        if (paymentOptions.bank_transfer_enabled && paymentOptions.bank_details) {
          status += `\n\n**Bank Details:**\n${paymentOptions.bank_details}`;
        }
        return status;
      }
      if (name === 'setup_paypal_payments') {
        const { paypal_email, invoice_number } = parsedArgs;
        console.log('[Assistants POC] Setting up PayPal payments:', {
          paypal_email,
          invoice_number
        });
        // Update payment_options table
        const { error: paymentError } = await supabase.from('payment_options').upsert({
          user_id: user_id,
          paypal_enabled: true,
          paypal_email: paypal_email,
          updated_at: new Date().toISOString()
        });
        if (paymentError) {
          console.error('[Assistants POC] PayPal setup error:', paymentError);
          return `Error setting up PayPal: ${paymentError.message}`;
        }
        let response = `✅ PayPal payments enabled with email: ${paypal_email}`;
        // If invoice_number provided, also enable PayPal on that specific invoice
        if (invoice_number) {
          const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('id').eq('user_id', user_id).eq('invoice_number', invoice_number).single();
          if (!invoiceError && invoice) {
            const { error: updateError } = await supabase.from('invoices').update({
              paypal_active: true
            }).eq('id', invoice.id);
            if (!updateError) {
              response += `\n• PayPal activated on invoice ${invoice_number}`;
              // Return updated invoice
              const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', invoice.id).single();
              if (updatedInvoice) {
                attachments.push({
                  type: 'invoice',
                  invoice_id: invoice.id,
                  invoice: updatedInvoice
                });
              }
            }
          }
        }
        return response;
      }
      if (name === 'setup_bank_transfer') {
        const { bank_details, invoice_number } = parsedArgs;
        console.log('[Assistants POC] Setting up bank transfer:', {
          bank_details,
          invoice_number
        });
        // Update payment_options table  
        const { error: paymentError } = await supabase.from('payment_options').upsert({
          user_id: user_id,
          bank_transfer_enabled: true,
          bank_details: bank_details,
          updated_at: new Date().toISOString()
        });
        if (paymentError) {
          console.error('[Assistants POC] Bank transfer setup error:', paymentError);
          return `Error setting up bank transfer: ${paymentError.message}`;
        }
        let response = `✅ Bank transfer payments enabled\n\n**Bank Details:**\n${bank_details}`;
        // If invoice_number provided, also enable bank transfer on that specific invoice
        if (invoice_number) {
          const { data: invoice, error: invoiceError } = await supabase.from('invoices').select('id').eq('user_id', user_id).eq('invoice_number', invoice_number).single();
          if (!invoiceError && invoice) {
            const { error: updateError } = await supabase.from('invoices').update({
              bank_account_active: true
            }).eq('id', invoice.id);
            if (!updateError) {
              response += `\n• Bank transfer activated on invoice ${invoice_number}`;
              // Return updated invoice
              const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', invoice.id).single();
              if (updatedInvoice) {
                attachments.push({
                  type: 'invoice',
                  invoice_id: invoice.id,
                  invoice: updatedInvoice
                });
              }
            }
          }
        }
        return response;
      }
      if (name === 'find_invoice') {
        const { invoice_number, client_name, search_term, get_latest, limit = 5 } = parsedArgs;
        console.log('[Assistants POC] Finding invoice with:', {
          invoice_number,
          client_name,
          search_term,
          get_latest,
          limit
        });
        try {
          let query = supabase.from('invoices').select(`
              id,
              invoice_number,
              client_id,
              status,
              total_amount,
              invoice_date,
              due_date,
              created_at,
              clients!invoices_client_id_fkey(name, email, phone)
            `).eq('user_id', user_id);
          // Search by exact invoice number
          if (invoice_number) {
            query = query.eq('invoice_number', invoice_number);
          } else if (client_name) {
            // First try to find client by name, then get their invoices
            const { data: clients } = await supabase.from('clients').select('id, name').eq('user_id', user_id).ilike('name', `%${client_name}%`);
            if (clients && clients.length > 0) {
              const clientIds = clients.map((c)=>c.id);
              query = query.in('client_id', clientIds);
            } else {
              return `No clients found matching "${client_name}"`;
            }
          } else if (search_term) {
            // This is a simplified search - in production you might want to search line_items table
            query = query.or(`notes.ilike.%${search_term}%`);
          } else if (get_latest) {
          // Will be ordered by created_at desc below
          } else {
            return "Please specify invoice_number, client_name, search_term, or set get_latest to true";
          }
          // Always order by most recent first and limit results
          const { data: invoices, error } = await query.order('created_at', {
            ascending: false
          }).limit(limit);
          if (error) {
            console.error('[Assistants POC] Find invoice error:', error);
            return `Error searching invoices: ${error.message}`;
          }
          if (!invoices || invoices.length === 0) {
            return "No invoices found matching your criteria";
          }
          // Format results
          let response = `Found ${invoices.length} invoice${invoices.length > 1 ? 's' : ''}:\n\n`;
          invoices.forEach((invoice)=>{
            const clientName = invoice.clients?.name || 'Unknown Client';
            const status = invoice.status?.charAt(0).toUpperCase() + invoice.status?.slice(1) || 'Draft';
            const total = invoice.total_amount ? `$${invoice.total_amount.toFixed(2)}` : '$0.00';
            const date = new Date(invoice.invoice_date || invoice.created_at).toLocaleDateString();
            response += `• **${invoice.invoice_number}** - ${clientName}\n`;
            response += `  Status: ${status} | Total: ${total} | Date: ${date}\n\n`;
          });
          return response.trim();
        } catch (error) {
          console.error('[Assistants POC] Find invoice error:', error);
          return `Error finding invoice: ${error.message}`;
        }
      }
      if (name === 'update_invoice') {
        const { invoice_identifier, client_name, client_email, client_phone, client_address, client_tax_number, invoice_date, due_date, payment_terms_days, notes, status, tax_rate, discount_type, discount_value, invoice_design, accent_color, enable_stripe, enable_paypal, enable_bank_transfer, invoice_number, paid_amount, payment_date, payment_notes, line_items } = parsedArgs;
        console.log('[update_invoice] Starting with:', {
          invoice_identifier,
          ...parsedArgs
        });
        try {
          // Use the findInvoice helper instead of duplicating search logic
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          console.log('[update_invoice] Found invoice:', targetInvoice.id, targetInvoice.invoice_number);
          // Prepare update data for invoice - use correct column names
          const invoiceUpdates = {};
          if (invoice_date !== undefined) invoiceUpdates.invoice_date = invoice_date;
          if (due_date !== undefined) invoiceUpdates.due_date = due_date;
          if (payment_terms_days !== undefined) invoiceUpdates.payment_terms_days = payment_terms_days;
          if (notes !== undefined) invoiceUpdates.notes = notes;
          if (status !== undefined) invoiceUpdates.status = status;
          if (tax_rate !== undefined) {
            // Only use tax_percentage - tax_rate column doesn't exist
            invoiceUpdates.tax_percentage = tax_rate;
          }
          if (discount_type !== undefined) invoiceUpdates.discount_type = discount_type;
          if (discount_value !== undefined) invoiceUpdates.discount_value = discount_value;
          if (invoice_design !== undefined) invoiceUpdates.invoice_design = invoice_design;
          if (accent_color !== undefined) invoiceUpdates.accent_color = accent_color;
          // Use correct payment method column names from schema
          if (enable_stripe !== undefined) invoiceUpdates.stripe_active = enable_stripe;
          if (enable_paypal !== undefined) invoiceUpdates.paypal_active = enable_paypal;
          if (enable_bank_transfer !== undefined) invoiceUpdates.bank_account_active = enable_bank_transfer;
          
          // Add new parameters for payment tracking and invoice number updates
          if (invoice_number !== undefined) invoiceUpdates.invoice_number = invoice_number;
          if (paid_amount !== undefined) invoiceUpdates.paid_amount = paid_amount;
          if (payment_date !== undefined) invoiceUpdates.payment_date = payment_date;
          if (payment_notes !== undefined) invoiceUpdates.payment_notes = payment_notes;
          
          // BUSINESS LOGIC: Auto-calculate status based on payment amount if payment is being updated
          if (paid_amount !== undefined && status === undefined) {
            const totalAmount = targetInvoice.total_amount || 0;
            if (paid_amount <= 0) {
              invoiceUpdates.status = 'sent'; // No payment = sent
            } else if (paid_amount >= totalAmount) {
              invoiceUpdates.status = 'paid'; // Full payment = paid
            } else {
              invoiceUpdates.status = 'partial'; // Partial payment = partial
            }
            console.log('[update_invoice] Auto-calculated status:', invoiceUpdates.status, 'for payment:', paid_amount, 'of total:', totalAmount);
          }
          // Update client information if provided - invoice table does NOT have client fields
          let clientUpdates = {};
          if (client_name !== undefined) clientUpdates.name = client_name;
          if (client_email !== undefined) clientUpdates.email = client_email;
          if (client_phone !== undefined) clientUpdates.phone = client_phone;
          if (client_address !== undefined) clientUpdates.address = client_address;
          if (client_tax_number !== undefined) clientUpdates.tax_number = client_tax_number;
          // Update client if there are changes
          if (Object.keys(clientUpdates).length > 0 && targetInvoice.client_id) {
            console.log('[update_invoice] Updating client:', targetInvoice.client_id);
            const { error: clientError } = await supabase.from('clients').update(clientUpdates).eq('id', targetInvoice.client_id);
            if (clientError) {
              console.error('[update_invoice] Client update error:', clientError);
            }
          }
          // Handle line items replacement - use correct table name
          if (line_items && line_items.length > 0) {
            console.log('[update_invoice] Replacing line items:', line_items.length);
            // Delete existing line items from correct table
            const { error: deleteError } = await supabase.from('invoice_line_items') // Use correct table name
            .delete().eq('invoice_id', targetInvoice.id).eq('user_id', user_id) // Add user_id for security
            ;
            if (deleteError) {
              console.error('[update_invoice] Delete line items error:', deleteError);
            }
            // Calculate totals
            let subtotal = 0;
            const lineItemsToCreate = line_items.map((item)=>{
              const itemTotal = (item.unit_price || 0) * (item.quantity || 1);
              subtotal += itemTotal;
              return {
                invoice_id: targetInvoice.id,
                user_id: user_id,
                item_name: item.item_name,
                item_description: item.item_description || null,
                unit_price: item.unit_price || 0,
                quantity: item.quantity || 1,
                total_price: itemTotal
              };
            });
            // Create new line items in correct table
            const { error: lineItemsError } = await supabase.from('invoice_line_items') // Use correct table name
            .insert(lineItemsToCreate);
            if (lineItemsError) {
              console.error('[update_invoice] Line items update error:', lineItemsError);
              return `Error updating line items: ${lineItemsError.message}`;
            }
            // Recalculate totals using correct column names
            const discountAmount = discount_value || targetInvoice.discount_value || 0;
            const discountType = discount_type || targetInvoice.discount_type;
            let afterDiscount = subtotal;
            if (discountType === 'percentage') {
              afterDiscount = subtotal * (1 - discountAmount / 100);
            } else if (discountType === 'fixed') {
              afterDiscount = subtotal - discountAmount;
            }
            // Use correct column name for tax calculation
            const taxRate = tax_rate !== undefined ? tax_rate : targetInvoice.tax_percentage || 0;
            const taxAmount = afterDiscount * (taxRate / 100);
            const totalAmount = afterDiscount + taxAmount;
            // Update totals with correct column names (don't set non-existent columns)
            invoiceUpdates.subtotal_amount = subtotal;
            invoiceUpdates.total_amount = totalAmount;
            console.log('[update_invoice] Calculated totals:', {
              subtotal,
              totalAmount,
              taxRate
            });
          }
          console.log('[update_invoice] Updating invoice with:', invoiceUpdates);
          // Update invoice if there are changes
          if (Object.keys(invoiceUpdates).length > 0) {
            const { error: invoiceError } = await supabase.from('invoices').update(invoiceUpdates).eq('id', targetInvoice.id);
            if (invoiceError) {
              console.error('[update_invoice] Invoice update error:', invoiceError);
              return `Error updating invoice: ${invoiceError.message}`;
            }
          }
          // Get updated invoice for attachment
          const { data: updatedInvoice, error: invoiceFetchError } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          if (invoiceFetchError) {
            console.error('[update_invoice] Updated invoice fetch error:', invoiceFetchError);
          }
          // Get line items from correct table
          const { data: allLineItems, error: lineItemsError } = await supabase.from('invoice_line_items') // Use correct table name
          .select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
            ascending: true
          });
          if (lineItemsError) {
            console.error('[update_invoice] Line items fetch error:', lineItemsError);
          }
          // Get client data for attachment
          let clientData = null;
          if (targetInvoice.client_id) {
            const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
            if (!clientError) {
              clientData = client;
            }
          }
          // Create attachment for updated invoice
          attachments.push({
            type: 'invoice',
            invoice_id: targetInvoice.id,
            invoice: updatedInvoice || targetInvoice,
            line_items: allLineItems || [],
            client_id: targetInvoice.client_id,
            client: clientData
          });
          console.log('[update_invoice] Success - created attachment');
          
          // Enhanced response with payment details if payment was updated
          let response = `I've updated invoice ${targetInvoice.invoice_number}.`;
          
          if (paid_amount !== undefined) {
            const finalInvoice = updatedInvoice || targetInvoice;
            const totalAmount = finalInvoice.total_amount || 0;
            const remainingAmount = Math.max(totalAmount - paid_amount, 0);
            const paymentPercentage = totalAmount > 0 ? Math.min((paid_amount / totalAmount) * 100, 100) : 0;
            
            response += `\n\n💰 Payment Details:`;
            response += `\n• Amount Paid: $${paid_amount.toFixed(2)}`;
            response += `\n• Total Invoice: $${totalAmount.toFixed(2)}`;
            response += `\n• Remaining: $${remainingAmount.toFixed(2)}`;
            response += `\n• Status: ${finalInvoice.status || 'updated'}`;
            response += `\n• Paid: ${paymentPercentage.toFixed(1)}%`;
            
            if (payment_date) {
              response += `\n• Payment Date: ${payment_date}`;
            }
            if (payment_notes) {
              response += `\n• Notes: ${payment_notes}`;
            }
          }
          
          response += `\n\nLet me know if you'd like any other changes!`;
          return response;
        } catch (error) {
          console.error('[update_invoice] Error:', error);
          return `Error updating invoice: ${error.message}`;
        }
      }
      if (name === 'add_line_item') {
        const { invoice_identifier, item_name, quantity = 1, unit_price, item_description } = parsedArgs;
        try {
          // First find the invoice
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          // Insert new line item into invoice_line_items table
          console.log('[add_line_item] Adding line item to invoice:', targetInvoice.invoice_number);
          const { data: newLineItem, error: lineItemError } = await supabase.from('invoice_line_items').insert({
            invoice_id: targetInvoice.id,
            user_id: user_id,
            item_name,
            item_description: item_description || null,
            quantity: quantity || 1,
            unit_price,
            total_price: (quantity || 1) * unit_price,
            created_at: new Date().toISOString()
          }).select().single();
          if (lineItemError) {
            console.error('[add_line_item] Line item insert error:', lineItemError);
            return `Error adding line item: ${lineItemError.message}`;
          }
          console.log('[add_line_item] Successfully inserted line item:', newLineItem.id);
          // Get all line items for this invoice to recalculate totals
          const { data: allLineItems, error: fetchError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id);
          if (fetchError) {
            console.error('[add_line_item] Error fetching line items:', fetchError);
            return `Error recalculating totals: ${fetchError.message}`;
          }
          // Recalculate totals from all line items
          const subtotal = allLineItems.reduce((sum, item)=>sum + (item.total_price || 0), 0);
          const taxAmount = subtotal * (targetInvoice.tax_percentage || 0) / 100;
          const discountAmount = targetInvoice.discount_type === 'percentage' ? subtotal * (targetInvoice.discount_value || 0) / 100 : targetInvoice.discount_value || 0;
          const total = subtotal + taxAmount - discountAmount;
          // Update invoice totals
          console.log('[add_line_item] Updating invoice totals:', {
            subtotal,
            total
          });
          const { error: updateError } = await supabase.from('invoices').update({
            subtotal_amount: subtotal,
            total_amount: total
          }).eq('user_id', user_id).eq('id', targetInvoice.id);
          if (updateError) {
            console.error('[add_line_item] Update error:', updateError);
            return `Error updating invoice totals: ${updateError.message}`;
          }
          console.log('[add_line_item] Successfully updated invoice:', targetInvoice.invoice_number);
          // Get updated invoice data with client info for attachment
          const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          // Get client data if exists
          let clientData = null;
          if (targetInvoice.client_id) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
            clientData = client;
          }
          // Create attachment for updated invoice
          attachments.push({
            type: 'invoice',
            invoice_id: targetInvoice.id,
            invoice: updatedInvoice || targetInvoice,
            line_items: allLineItems,
            client_id: targetInvoice.client_id,
            client: clientData
          });
          // 🚨 CONVERSATION MEMORY - Track that we just updated this invoice
          ConversationMemory.setLastAction(user_id, 'added_line_item', {
            invoice_number: targetInvoice.invoice_number,
            invoice_id: targetInvoice.id,
            client_id: targetInvoice.client_id,
            item_added: item_name
          });
          return `Added line item "${item_name}" (${quantity || 1}x $${unit_price}) to invoice ${targetInvoice.invoice_number}.

Total updated to $${total.toFixed(2)}.

Let me know if you'd like any other changes?`;
        } catch (error) {
          console.error('[Assistants POC] Add line item error:', error);
          return `Error adding line item: ${error.message}`;
        }
      }
      if (name === 'remove_line_item') {
        const { invoice_identifier, item_identifier } = parsedArgs;
        try {
          // First find the invoice
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          // Get all line items for this invoice from database
          console.log('[remove_line_item] Getting line items for invoice:', targetInvoice.invoice_number);
          const { data: currentItems, error: fetchError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
            ascending: true
          });
          if (fetchError) {
            console.error('[remove_line_item] Error fetching line items:', fetchError);
            return `Error fetching line items: ${fetchError.message}`;
          }
          if (!currentItems || currentItems.length === 0) {
            return 'Error: No line items found in invoice';
          }
          // Find item to remove
          let itemToRemove = null;
          // Check if it's a numeric index (1st, 2nd, etc.)
          const indexMatch = item_identifier.match(/(\d+)(st|nd|rd|th)/i);
          if (indexMatch) {
            const index = parseInt(indexMatch[1]) - 1;
            if (index >= 0 && index < currentItems.length) {
              itemToRemove = currentItems[index];
            }
          } else {
            // Search by item name
            itemToRemove = currentItems.find((item)=>item.item_name.toLowerCase().includes(item_identifier.toLowerCase()));
          }
          if (!itemToRemove) {
            return `Error: Could not find line item "${item_identifier}". Available items: ${currentItems.map((item)=>item.item_name).join(', ')}`;
          }
          // Delete the line item from database
          console.log('[remove_line_item] Deleting line item:', itemToRemove.id);
          const { error: deleteError } = await supabase.from('invoice_line_items').delete().eq('id', itemToRemove.id);
          if (deleteError) {
            console.error('[remove_line_item] Delete error:', deleteError);
            return `Error deleting line item: ${deleteError.message}`;
          }
          // Get remaining line items
          const remainingItems = currentItems.filter((item)=>item.id !== itemToRemove.id);
          // Recalculate totals from remaining items
          const subtotal = remainingItems.reduce((sum, item)=>sum + (item.total_price || 0), 0);
          const taxAmount = subtotal * (targetInvoice.tax_percentage || 0) / 100;
          const discountAmount = targetInvoice.discount_type === 'percentage' ? subtotal * (targetInvoice.discount_value || 0) / 100 : targetInvoice.discount_value || 0;
          const total = subtotal + taxAmount - discountAmount;
          // Update invoice totals
          console.log('[remove_line_item] Updating invoice totals:', {
            subtotal,
            total
          });
          const { error: updateError } = await supabase.from('invoices').update({
            subtotal_amount: subtotal,
            total_amount: total
          }).eq('user_id', user_id).eq('id', targetInvoice.id);
          if (updateError) {
            console.error('[remove_line_item] Update error:', updateError);
            return `Error updating invoice totals: ${updateError.message}`;
          }
          console.log('[remove_line_item] Successfully removed line item:', itemToRemove.item_name);
          // Get updated invoice data for attachment
          const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          // Get client data if exists
          let clientData = null;
          if (targetInvoice.client_id) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
            clientData = client;
          }
          // Create attachment for updated invoice
          attachments.push({
            type: 'invoice',
            invoice_id: targetInvoice.id,
            invoice: updatedInvoice || targetInvoice,
            line_items: remainingItems,
            client_id: targetInvoice.client_id,
            client: clientData
          });
          return `Removed line item "${itemToRemove.item_name}" from invoice ${targetInvoice.invoice_number}.

Total updated to $${total.toFixed(2)}.

Let me know if you'd like any other changes?`;
        } catch (error) {
          console.error('[Assistants POC] Remove line item error:', error);
          return `Error removing line item: ${error.message}`;
        }
      }
      if (name === 'update_line_item') {
        const { invoice_identifier, item_identifier, item_name, quantity, unit_price, item_description } = parsedArgs;
        console.log('[update_line_item] Starting with:', {
          invoice_identifier,
          item_identifier,
          item_name,
          quantity,
          unit_price,
          item_description
        });
        try {
          // First find the invoice
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          console.log('[update_line_item] Found invoice:', targetInvoice.id, targetInvoice.invoice_number);
          // Get current line items from the database (separate table)
          const { data: currentItems, error: lineItemsError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
            ascending: true
          });
          if (lineItemsError) {
            console.error('[update_line_item] Line items fetch error:', lineItemsError);
            return `Error fetching line items: ${lineItemsError.message}`;
          }
          if (!currentItems || currentItems.length === 0) {
            return 'Error: No line items found in invoice';
          }
          console.log('[update_line_item] Found line items:', currentItems.length);
          // Find item to update
          let targetLineItem = null;
          // Check if it's a numeric index (1st, 2nd, etc.)
          const indexMatch = item_identifier.match(/(\d+)(st|nd|rd|th)/i);
          if (indexMatch) {
            const itemIndex = parseInt(indexMatch[1]) - 1;
            targetLineItem = currentItems[itemIndex];
          } else {
            // Search by item name
            targetLineItem = currentItems.find((item)=>item.item_name.toLowerCase().includes(item_identifier.toLowerCase()));
          }
          if (!targetLineItem) {
            return `Error: Could not find line item "${item_identifier}". Available items: ${currentItems.map((item)=>item.item_name).join(', ')}`;
          }
          console.log('[update_line_item] Found target line item:', targetLineItem.id, targetLineItem.item_name);
          // Build update object with only changed fields
          const updateFields = {};
          if (item_name !== undefined) updateFields.item_name = item_name;
          if (quantity !== undefined) updateFields.quantity = quantity;
          if (unit_price !== undefined) updateFields.unit_price = unit_price;
          if (item_description !== undefined) updateFields.item_description = item_description === null ? null : item_description;
          // Recalculate total_price if quantity or unit_price changed
          const finalQuantity = quantity !== undefined ? quantity : targetLineItem.quantity;
          const finalUnitPrice = unit_price !== undefined ? unit_price : targetLineItem.unit_price;
          updateFields.total_price = finalQuantity * finalUnitPrice;
          console.log('[update_line_item] Updating with fields:', updateFields);
          // Update the specific line item
          const { error: updateLineItemError } = await supabase.from('invoice_line_items').update(updateFields).eq('id', targetLineItem.id);
          if (updateLineItemError) {
            console.error('[update_line_item] Line item update error:', updateLineItemError);
            return `Error updating line item: ${updateLineItemError.message}`;
          }
          // Get all updated line items to recalculate totals
          const { data: allLineItems, error: allItemsError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id);
          if (allItemsError) {
            console.error('[update_line_item] All items fetch error:', allItemsError);
            return `Error fetching updated line items: ${allItemsError.message}`;
          }
          console.log('[update_line_item] Recalculating totals from', allLineItems.length, 'items');
          // Recalculate totals using correct column names
          const subtotal = allLineItems.reduce((sum, item)=>sum + item.total_price, 0);
          const taxAmount = subtotal * (targetInvoice.tax_percentage || 0) / 100;
          const discountAmount = targetInvoice.discount_type === 'percentage' ? subtotal * (targetInvoice.discount_value || 0) / 100 : targetInvoice.discount_value || 0;
          const total = subtotal + taxAmount - discountAmount;
          console.log('[update_line_item] New totals:', {
            subtotal,
            taxAmount,
            discountAmount,
            total
          });
          // Update invoice totals with correct column names
          const { error: updateInvoiceError } = await supabase.from('invoices').update({
            subtotal_amount: subtotal,
            total_amount: total
          }).eq('id', targetInvoice.id);
          if (updateInvoiceError) {
            console.error('[update_line_item] Invoice update error:', updateInvoiceError);
            return `Error updating invoice totals: ${updateInvoiceError.message}`;
          }
          // Get updated invoice for attachment
          const { data: updatedInvoice, error: invoiceFetchError } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          if (invoiceFetchError) {
            console.error('[update_line_item] Updated invoice fetch error:', invoiceFetchError);
          }
          // Get client data for attachment
          let clientData = null;
          if (targetInvoice.client_id) {
            const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
            if (!clientError) {
              clientData = client;
            }
          }
          // Create attachment for updated invoice
          attachments.push({
            type: 'invoice',
            invoice_id: targetInvoice.id,
            invoice: updatedInvoice || targetInvoice,
            line_items: allLineItems,
            client_id: targetInvoice.client_id,
            client: clientData
          });
          console.log('[update_line_item] Success - created attachment');
          const updatedItemName = item_name !== undefined ? item_name : targetLineItem.item_name;
          return `Updated line item "${updatedItemName}" in invoice ${targetInvoice.invoice_number}.

Total updated to $${total.toFixed(2)}.

Let me know if you'd like any other changes!`;
        } catch (error) {
          console.error('[update_line_item] Error:', error);
          return `Error updating line item: ${error.message}`;
        }
      }
      if (name === 'update_client_info') {
        const { invoice_identifier, client_name, client_email, client_phone, client_address, client_tax_number } = parsedArgs;
        console.log('[update_client_info] Starting with:', {
          invoice_identifier,
          client_name,
          client_email,
          client_phone,
          client_address,
          client_tax_number
        });
        try {
          // First find the invoice
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          console.log('[update_client_info] Found invoice:', targetInvoice.id, targetInvoice.invoice_number);
          let clientData = {};
          let message = `Updated client information for invoice ${targetInvoice.invoice_number}:`;
          if (client_name) {
            clientData.client_name = client_name;
            message += `\n- Name: ${client_name}`;
          }
          if (client_email) {
            clientData.client_email = client_email;
            message += `\n- Email: ${client_email}`;
          }
          if (client_phone) {
            clientData.client_phone = client_phone;
            message += `\n- Phone: ${client_phone}`;
          }
          if (client_address) {
            clientData.client_address = client_address;
            message += `\n- Address: ${client_address}`;
          }
          if (client_tax_number) {
            clientData.client_tax_number = client_tax_number;
            message += `\n- Tax Number: ${client_tax_number}`;
          }
          console.log('[update_client_info] Updating client data:', clientData);
          // ✅ REMOVED: Don't try to update invoices table with client data - it doesn't have those columns
          // Client data should only be updated in the clients table below
          // Update the client record (this is where client data actually goes)
          if (targetInvoice.client_id) {
            console.log('[update_client_info] Updating client record:', targetInvoice.client_id);
            const { error: clientUpdateError } = await supabase.from('clients').update({
              // ✅ FIXED: Don't spread clientData - map each field explicitly to correct columns
              ...client_name && {
                name: client_name
              },
              ...client_email && {
                email: client_email
              },
              ...client_phone && {
                phone: client_phone
              },
              ...client_address && {
                address_client: client_address
              },
              ...client_tax_number && {
                tax_number: client_tax_number
              }
            }).eq('id', targetInvoice.client_id).eq('user_id', user_id);
            if (clientUpdateError) {
              console.error('[update_client_info] Client update error:', clientUpdateError);
              return `Error updating client information: ${clientUpdateError.message}`;
            }
          } else {
            console.log('[update_client_info] Warning: Invoice has no client_id, cannot update client data');
            return `Warning: This invoice has no associated client to update`;
          }
          // Get updated invoice for attachment
          const { data: updatedInvoice, error: invoiceFetchError } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          if (invoiceFetchError) {
            console.error('[update_client_info] Updated invoice fetch error:', invoiceFetchError);
          }
          // Get line items from separate table
          const { data: lineItems, error: lineItemsError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
            ascending: true
          });
          if (lineItemsError) {
            console.error('[update_client_info] Line items fetch error:', lineItemsError);
          }
          // Get updated client data for attachment
          let updatedClientData = null;
          if (targetInvoice.client_id) {
            const { data: client, error: clientError } = await supabase.from('clients').select('id, name, email, phone, address_client, notes, tax_number, created_at, updated_at').eq('id', targetInvoice.client_id).single();
            if (!clientError) {
              updatedClientData = client;
            }
          }
          // Create attachment for updated invoice
          const attachmentData = {
            type: 'invoice',
            invoice_id: targetInvoice.id,
            invoice: updatedInvoice || targetInvoice,
            line_items: lineItems || [],
            client_id: targetInvoice.client_id,
            client: updatedClientData
          };
          attachments.push(attachmentData);
          console.log('[update_client_info] Success - created attachment:', {
            type: attachmentData.type,
            invoice_id: attachmentData.invoice_id,
            has_invoice: !!attachmentData.invoice,
            has_line_items: !!attachmentData.line_items,
            line_items_count: attachmentData.line_items?.length || 0,
            client_id: attachmentData.client_id,
            has_client: !!attachmentData.client
          });
          console.log('[update_client_info] Total attachments:', attachments.length);
          // 🚨 CONVERSATION MEMORY - Track that we just updated this invoice's client
          ConversationMemory.setLastAction(user_id, 'updated_client_info', {
            invoice_number: targetInvoice.invoice_number,
            client_name: client_name || updatedClientData?.name || 'Unknown',
            invoice_id: targetInvoice.id,
            client_id: targetInvoice.client_id
          });
          message += `\n\nLet me know if you'd like any other changes!`;
          return message;
        } catch (error) {
          console.error('[update_client_info] Error:', error);
          return `Error updating client info: ${error.message}`;
        }
      }
      if (name === 'update_payment_methods') {
        const { invoice_identifier, enable_stripe, enable_paypal, enable_bank_transfer } = parsedArgs;
        console.log('[update_payment_methods] Starting with:', {
          invoice_identifier,
          enable_stripe,
          enable_paypal,
          enable_bank_transfer
        });
        try {
          // First find the invoice
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          console.log('[update_payment_methods] Found invoice:', targetInvoice.id, targetInvoice.invoice_number);
          // Get payment options to check what's actually enabled (NOT business_settings)
          const { data: paymentOptions, error: paymentOptionsError } = await supabase.from('payment_options').select('stripe_enabled, paypal_enabled, bank_transfer_enabled').eq('user_id', user_id).single();
          if (paymentOptionsError) {
            console.error('[update_payment_methods] Payment options fetch error:', paymentOptionsError);
            return 'Error: Could not fetch payment options to validate payment methods';
          }
          console.log('[update_payment_methods] Payment options:', paymentOptions);
          let paymentUpdates = {};
          let message = `Updated payment methods for invoice ${targetInvoice.invoice_number}:`;
          let skippedMethods = [];
          // Check each payment method - use correct column names from payment_options
          if (enable_stripe !== undefined) {
            if (enable_stripe && paymentOptions.stripe_enabled) {
              paymentUpdates.stripe_active = true;
              message += `\n- ✅ Stripe payments enabled`;
            } else if (enable_stripe && !paymentOptions.stripe_enabled) {
              skippedMethods.push('Stripe (not configured in payment options)');
            } else {
              paymentUpdates.stripe_active = false;
              message += `\n- ❌ Stripe payments disabled`;
            }
          }
          if (enable_paypal !== undefined) {
            if (enable_paypal && paymentOptions.paypal_enabled) {
              paymentUpdates.paypal_active = true;
              message += `\n- ✅ PayPal payments enabled`;
            } else if (enable_paypal && !paymentOptions.paypal_enabled) {
              skippedMethods.push('PayPal (not configured in payment options)');
            } else {
              paymentUpdates.paypal_active = false;
              message += `\n- ❌ PayPal payments disabled`;
            }
          }
          if (enable_bank_transfer !== undefined) {
            if (enable_bank_transfer && paymentOptions.bank_transfer_enabled) {
              paymentUpdates.bank_account_active = true;
              message += `\n- ✅ Bank transfer enabled`;
            } else if (enable_bank_transfer && !paymentOptions.bank_transfer_enabled) {
              skippedMethods.push('Bank transfer (not configured in payment options)');
            } else {
              paymentUpdates.bank_account_active = false;
              message += `\n- ❌ Bank transfer disabled`;
            }
          }
          if (skippedMethods.length > 0) {
            message += `\n\n⚠️ Skipped enabling: ${skippedMethods.join(', ')}`;
            message += `\nPlease configure these in your payment options first.`;
          }
          console.log('[update_payment_methods] Updating with:', paymentUpdates);
          // Update invoice
          const { error: updateError } = await supabase.from('invoices').update(paymentUpdates).eq('user_id', user_id).eq('invoice_number', targetInvoice.invoice_number);
          if (updateError) {
            console.error('[update_payment_methods] Invoice update error:', updateError);
            return `Error updating payment methods: ${updateError.message}`;
          }
          // Get updated invoice for attachment
          const { data: updatedInvoice, error: invoiceFetchError } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          if (invoiceFetchError) {
            console.error('[update_payment_methods] Updated invoice fetch error:', invoiceFetchError);
          }
          // Get line items from separate table
          const { data: lineItems, error: lineItemsError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
            ascending: true
          });
          if (lineItemsError) {
            console.error('[update_payment_methods] Line items fetch error:', lineItemsError);
          }
          // Get client data for attachment
          let clientData = null;
          if (targetInvoice.client_id) {
            const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
            if (!clientError) {
              clientData = client;
            }
          }
          // Create attachment for updated invoice
          attachments.push({
            type: 'invoice',
            invoice_id: targetInvoice.id,
            invoice: updatedInvoice || targetInvoice,
            line_items: lineItems || [],
            client_id: targetInvoice.client_id,
            client: clientData
          });
          console.log('[update_payment_methods] Success - created attachment');
          message += `\n\nLet me know if you'd like any other changes!`;
          return message;
        } catch (error) {
          console.error('[update_payment_methods] Error:', error);
          return `Error updating payment methods: ${error.message}`;
        }
      }
      return `Unknown function: ${name}`;
    };
    // Use streaming response to prevent timeouts
    const stream = new ReadableStream({
      async start (controller) {
        try {
          let runStatus = run;
          let attempts = 0;
          while(true){
            runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
            console.log('[Assistants POC] Run status:', runStatus.status);
            if (runStatus.status === 'completed') {
              // Get final messages
              const messages = await openai.beta.threads.messages.list(thread.id);
              const assistantMessage = messages.data.filter((msg)=>msg.role === 'assistant').map((msg)=>{
                const textContent = msg.content.find((c)=>c.type === 'text');
                return textContent ? textContent.text.value : '';
              })[0] || 'No response generated';
              // Return JSON response compatible with current app
              const response = JSON.stringify({
                success: true,
                content: assistantMessage,
                attachments: attachments,
                messages: [
                  {
                    id: `user-${Date.now()}`,
                    role: 'user',
                    content: message,
                    created_at: new Date().toISOString()
                  },
                  {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: assistantMessage,
                    attachments: attachments,
                    created_at: new Date(Date.now() + 5000).toISOString()
                  }
                ],
                thread: {
                  id: thread.id,
                  user_id: user_id
                }
              });
              controller.enqueue(new TextEncoder().encode(response));
              controller.close();
              break;
            }
            if (runStatus.status === 'requires_action') {
              console.log('[Assistants POC] Requires action - handling tool calls');
              const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls || [];
              const toolOutputs = [];
              for (const toolCall of toolCalls){
                const output = await handleToolCall(toolCall);
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: output
                });
              }
              console.log('[Assistants POC] Submitting tool outputs:', toolOutputs.length);
              await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                tool_outputs: toolOutputs
              });
              continue;
            }
            if (runStatus.status === 'failed') {
              throw new Error(`Run failed: ${runStatus.last_error?.message || 'Unknown error'}`);
            }
            if (runStatus.status === 'cancelled') {
              throw new Error('Run was cancelled');
            }
            // Optimized polling with exponential backoff
            const delays = [
              100,
              200,
              500,
              1000,
              1000
            ] // Start fast, then slow
            ;
            const attempt = Math.min(attempts, delays.length - 1);
            await new Promise((resolve)=>setTimeout(resolve, delays[attempt] || 1000));
            attempts++;
          }
        } catch (error) {
          console.error('[Assistants POC] Stream error:', error);
          controller.error(error);
        }
      }
    });
    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('[Assistants POC] Error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

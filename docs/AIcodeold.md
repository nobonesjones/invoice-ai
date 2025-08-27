do not change this code ever! 

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import OpenAI from "https://esm.sh/openai@4.69.0";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Status message helper for streaming UX
function createStatusMessage(status, emoji = '🤔') {
  return {
    type: 'status',
    content: `${emoji} ${status}...`,
    timestamp: new Date().toISOString()
  };
}
// Stream status updates back to client
async function sendStatusUpdate(status, emoji = '🤔') {
  console.log(`[STATUS] ${emoji} ${status}...`);
  // Store status updates for frontend to display
  if (!globalThis.statusUpdates) {
    globalThis.statusUpdates = [];
  }
  globalThis.statusUpdates.push({
    status: `${emoji} ${status}...`,
    timestamp: new Date().toISOString()
  });
}
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
    'create quote',
    'make quote',
    'new quote',
    'quote for',
    'generate invoice',
    'generate estimate',
    'generate quote',
    'build invoice',
    'build estimate',
    'build quote',
    'start invoice',
    'start estimate',
    'start quote'
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
    'the estimate',
    'this estimate',
    'the quote',
    'this quote',
    'it',
    'the client',
    'address',
    'that invoice',
    'that estimate',
    'that quote'
  ];
  const hasUpdateKeyword = updateKeywords.some((keyword)=>lowerMessage.includes(keyword));
  const hasContextReference = contextReferences.some((ref)=>lowerMessage.includes(ref));
  // If user just created/updated something and now wants to modify it
  if (hasUpdateKeyword && (hasContextReference || lastAction)) {
    // Check if referring to specific invoice or estimate number
    const invoiceMatch = lowerMessage.match(/inv-\d+/i);
    const estimateMatch = lowerMessage.match(/(est|q)-\d+/i);
    if (invoiceMatch || estimateMatch) {
      return 'update_specific';
    }
    // 🚨 FIX: Only return 'update_latest' for invoice/estimate context
    // Don't trigger invoice updates when last action was just client creation
    if (lastAction) {
      const isInvoiceEstimateContext = lastAction.action && (lastAction.action.includes('invoice') || lastAction.action.includes('estimate') || lastAction.action.includes('quote') || lastAction.action === 'updated_client_info' || // This was updating a client within invoice context
      lastAction.action === 'added_line_item' || lastAction.action === 'updated_business_settings');
      // If there's explicit context reference OR invoice/estimate action, use update_latest
      if (hasContextReference || isInvoiceEstimateContext) {
        return 'update_latest';
      }
      // If last action was just creating a client, this is client context only
      if (lastAction.action === 'created_client') {
        return 'client_context';
      }
    }
    // Fallback to update_latest if there's explicit context reference
    if (hasContextReference) {
      return 'update_latest';
    }
  }
  return 'general';
}
// Function to detect if user wants to create invoice/estimate  
function detectInvoiceCreationIntent(message, userId = '') {
  return detectConversationContext(message, userId) === 'create';
}
// Function to check if user can create more items (usage limits)
async function checkCanCreateItem(supabase, userId) {
  try {
    // One efficient query - get everything we need
    const { data: profile, error: profileError } = await supabase.from('user_profiles').select('subscription_tier').eq('id', userId).maybeSingle();
    if (profileError) {
      console.error('[checkCanCreateItem] Error fetching profile:', profileError);
      // Fail open to avoid blocking legitimate users
      return {
        allowed: true
      };
    }
    // Premium/paid users - always allow
    if (profile?.subscription_tier && profile.subscription_tier !== 'free') {
      console.log(`[checkCanCreateItem] User ${userId} is ${profile.subscription_tier} - no limits`);
      return {
        allowed: true
      };
    }
    // Free users - check count using RPC function
    const { count, error: countError } = await supabase.rpc('count_user_items', {
      user_id: userId
    });
    if (countError) {
      console.error('[checkCanCreateItem] Error counting items:', countError);
      // Fail open to avoid blocking legitimate users
      return {
        allowed: true
      };
    }
    console.log(`[checkCanCreateItem] Free user ${userId} has ${count}/3 items`);
    if (count >= 3) {
      return {
        allowed: false,
        success: false,
        message: "You've reached your free plan limit of 3 items (invoices + estimates). Upgrade to create unlimited invoices and estimates!",
        showPaywall: true,
        currentCount: count,
        limit: 3
      };
    }
    return {
      allowed: true
    };
  } catch (error) {
    console.error('[checkCanCreateItem] Unexpected error:', error);
    // Fail open to avoid blocking legitimate users  
    return {
      allowed: true
    };
  }
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
    const requestId = payload.requestId;
    // Initialize status updates for this request
    globalThis.statusUpdates = [];
    // Create deduplication key for this request
    const deduplicationKey1 = requestId || `${user_id}-${message?.substring(0, 50)}-${Date.now()}`;
    // Simple in-memory deduplication (resets on cold start but prevents immediate duplicates)
    if (!globalThis.processingRequests) {
      globalThis.processingRequests = new Map();
    }
    // Check if we're already processing this exact request
    if (globalThis.processingRequests.has(deduplicationKey1)) {
      console.log('[Assistants POC] 🚫 Duplicate request detected, ignoring:', deduplicationKey1);
      return new Response(JSON.stringify({
        error: 'Duplicate request - processing in parallel instance'
      }), {
        status: 409,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Mark this request as being processed
    globalThis.processingRequests.set(deduplicationKey1, Date.now());
    console.log('[Assistants POC] ✅ Processing request:', deduplicationKey1);
    if (!message || !user_id) {
      globalThis.processingRequests.delete(deduplicationKey1);
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
    console.log('[Assistants POC] 🚨 ESTIMATE FIX DEPLOYED - Processing message:', message);
    console.log('[Assistants POC] User ID:', user_id);
    console.log('[Assistants POC] Received threadId:', threadId || 'NONE - will create new');
    // Force create new assistant to ensure estimate tools are available
    const FORCE_NEW_ASSISTANT = false; // FIXED: Use existing assistant to maintain context
    const ALLOW_ASSISTANT_UPDATE = false; // Set to true temporarily when you need to update the assistant
    // Force new assistant to get latest function definitions
    // Get assistant ID from database
    const { data: assistantConfig } = await supabase.from('system_config').select('value').eq('key', 'assistant_id').single();
    const ASSISTANT_ID = assistantConfig?.value || "asst_U3mCSffTmk79xS43fSgMPwDe"; // Fallback to stable ID
    console.log('[ASSISTANTS POC] 🚨 FORCE_NEW_ASSISTANT FLAG IS:', FORCE_NEW_ASSISTANT);
    console.log('[ASSISTANTS POC] Using assistant ID:', ASSISTANT_ID);
    let assistant;
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
      // Handle both invoice and estimate contexts
      const isEstimateAction = lastAction.action && (lastAction.action.includes('estimate') || lastAction.estimate_number);
      const isInvoiceAction = lastAction.action && (lastAction.action.includes('invoice') || lastAction.invoice_number);
      if (isEstimateAction) {
        // Estimate context
        const terminology = lastAction.terminology || 'estimate';
        if (lastAction.estimate_number) {
          contextString += `• Current ${terminology}: ${lastAction.estimate_number}\n`;
        }
        if (lastAction.client_name) {
          contextString += `• Current client: ${lastAction.client_name}\n`;
        }
        contextString += `• When user says "add", "update", "change" - they mean THIS ${terminology}/client\n`;
        contextString += `• Use estimate_identifier: "latest" or "${lastAction.estimate_number || 'latest'}"\n`;
        contextString += `• 🚨 IMPORTANT: User is referring to the ${terminology.toUpperCase()}, not an invoice!\n`;
      } else if (isInvoiceAction) {
        // Invoice context (original logic)
        if (lastAction.invoice_number) {
          contextString += `• Current invoice: ${lastAction.invoice_number}\n`;
        }
        if (lastAction.client_name) {
          contextString += `• Current client: ${lastAction.client_name}\n`;
        }
        contextString += `• When user says "add", "update", "change" - they mean THIS invoice/client\n`;
        contextString += `• Use invoice_identifier: "latest" or "${lastAction.invoice_number || 'latest'}"\n`;
      } else {
        // Generic context
        if (lastAction.client_name) {
          contextString += `• Current client: ${lastAction.client_name}\n`;
        }
        contextString += `• When user says "add", "update", "change" - refer to the most recent item\n`;
      }
    } else if (conversationContext === 'client_context' && lastAction) {
      console.log('[Assistants POC] Client context detected - last action was creating/updating client');
      contextString = `\n\nACTIVE CLIENT CONTEXT:\n`;
      contextString += `• Last action: ${lastAction.action}\n`;
      if (lastAction.client_name) {
        contextString += `• Current client: ${lastAction.client_name}\n`;
      }
      contextString += `• Context: Client management (NO active invoice/estimate)\n`;
      contextString += `• When user says "update", "change" - they likely mean client info OR business settings\n`;
      contextString += `• Do NOT automatically return invoices/estimates unless explicitly requested\n`;
      contextString += `• Focus on client operations: create_client, update_business_settings\n`;
    } else {
      console.log('[Assistants POC] General conversation - minimal context');
    }
    // Add subscription context for all requests
    try {
      const { data: profile } = await supabase.from('profiles').select('subscription_tier').eq('id', user_id).maybeSingle();
      const tier = profile?.subscription_tier || 'free';
      if (tier === 'free') {
        // For free users, get their current usage
        const { count } = await supabase.rpc('count_user_items', {
          user_id
        });
        contextString += `\n\nUSER SUBSCRIPTION CONTEXT:
• User is on FREE plan (3 item limit)
• Items created: ${count || 0} of 3
• Can create more: ${(count || 0) < 3 ? 'Yes' : 'No - limit reached'}
${(count || 0) >= 3 ? '• Politely mention upgrade benefits when relevant' : ''}

USAGE LIMITS - CRITICAL:
• Free users can ONLY create 3 items total (invoices + estimates combined)
• When limit is reached, the create functions will automatically block and show upgrade message
• Do NOT attempt to bypass or work around these limits
• If user asks about limits, explain they can upgrade for unlimited access

🚨🚨 PAYMENT WORKFLOWS - MANDATORY FOR ALL PAYMENT UPDATES 🚨🚨
**WHEN USER SAYS "MARK AS PAID" OR "SET TO PAID":**
- NEVER just update status alone!
- ALWAYS call update_invoice with ALL payment fields:
  * status: "paid"
  * paid_amount: [FULL total_amount from invoice]
  * payment_date: [current date YYYY-MM-DD]
  * payment_notes: "Marked as paid via AI assistant"
- Example: update_invoice(invoice_identifier="latest", status="paid", paid_amount=1500.00, payment_date="2024-12-27", payment_notes="Marked as paid via AI assistant")

**FOR PARTIAL PAYMENTS:**
- paid_amount: [exact amount paid]
- payment_date: [current date]
- payment_notes: "Payment recorded: $XXX.XX"
- Do NOT set status (let function auto-calculate)

**CRITICAL RULE: Status changes without payment amounts will show incorrect totals on invoice documents!**`;
      } else {
        contextString += `\n\nUSER SUBSCRIPTION CONTEXT:
• User is on ${tier.toUpperCase()} plan
• Unlimited items allowed
• No usage restrictions`;
      }
    } catch (error) {
      console.error('[Assistants POC] Error fetching subscription context:', error);
    // Continue without subscription context rather than failing
    }
    if (FORCE_NEW_ASSISTANT) {
      console.log('[Assistants POC] 🚨 FORCE_NEW_ASSISTANT = TRUE - Creating new assistant with estimate functions...');
      // Skip to creation
      assistant = null;
    } else {
      // Use pre-created assistant for speed (no creation overhead)
      // ASSISTANT_ID is already defined above - don't redefine it
      console.log('[Assistants POC] 🚨 FORCE_NEW_ASSISTANT = FALSE - Using pre-created assistant:', ASSISTANT_ID);
      // Verify assistant exists and update it with latest instructions
      try {
        assistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
        console.log('[Assistants POC] Found existing assistant:', assistant.id);
        if (!ALLOW_ASSISTANT_UPDATE) {
          console.log('[Assistants POC] Assistant update disabled - using existing assistant as-is');
        // Skip update to avoid "duplicate function names" error
        } else {
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
• You have access to powerful functions for invoice/estimate/quote/client/business management
• ALWAYS use the appropriate functions to complete user requests
• When user asks to create, update, search, or manage anything - call the relevant function
• Do NOT just describe what you would do - actually DO IT by calling functions
• Example: "create invoice" → call create_invoice function immediately
• Example: "create quote" → call create_estimate function immediately

🚨 CONTEXT-AWARE UPDATES - CRITICAL:
When user mentions updates WITHOUT specifying which invoice/estimate:
• ALWAYS use the most recently created/discussed document from the conversation
• Look at the conversation history to identify what was just created
• Use update_invoice for invoices, update_estimate for estimates
• NEVER create a new document when the user clearly wants to update the existing one

Examples:
• User: "Create invoice for Emily 100 cakes at $4 each"
• AI: Creates INV-079
• User: "Add a discount 10%"
• ✅ CORRECT: update_invoice(invoice_identifier: "INV-079", discount_type: "percentage", discount_value: 10)
• ❌ WRONG: create_invoice with discount (creates duplicate)
• ❌ WRONG: update_estimate on invoice (wrong function)

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
${contextString}

🚨 **CRITICAL: INVOICE vs ESTIMATE CONTEXT** 🚨
When user says "add address" or similar:
• If you JUST created an INVOICE → Use update_client_info with invoice_identifier
• If you JUST created an ESTIMATE → Use update_estimate with estimate_identifier
• NEVER mix them up! Check ConversationMemory.lastAction to see what was created

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

PAYMENT METHOD MANAGEMENT:
When users want to enable/disable payment options on invoices or estimates:

**ENABLING PAYMENTS:**
• Use update_payment_methods (invoices) or update_estimate_payment_methods (estimates)
• Keywords: "enable", "activate", "turn on", "add", "card payments", "stripe", "paypal", "bank transfer"
• Examples:
  - "Enable card payments on invoice INV-123456" → update_payment_methods(invoice_identifier: "INV-123456", enable_stripe: true)
  - "Add PayPal to this estimate" → update_estimate_payment_methods(estimate_identifier: "latest", enable_paypal: true)
  - "Turn on bank transfer for quote Q-001" → update_estimate_payment_methods(estimate_identifier: "Q-001", enable_bank_transfer: true)
• IMPORTANT: Only enable payment methods that are enabled in business settings

**DISABLING/REMOVING PAYMENTS:**
• Use update_payment_methods (invoices) or update_estimate_payment_methods (estimates) with false values
• Keywords: "remove", "disable", "turn off", "delete", "take off", "deactivate"
• Examples:
  - "Remove PayPal from invoice INV-123456" → update_payment_methods(invoice_identifier: "INV-123456", enable_paypal: false)
  - "Disable card payments on this estimate" → update_estimate_payment_methods(estimate_identifier: "latest", enable_stripe: false)
  - "Turn off bank transfer for quote Q-001" → update_estimate_payment_methods(estimate_identifier: "Q-001", enable_bank_transfer: false)
• IMPORTANT: Disabling always works regardless of business settings

• Both functions automatically show updated invoice/estimate with payment options updated

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

🚨 PAYPAL SETUP - CRITICAL WORKFLOW (NEVER SKIP STEP 1!) 🚨

**STEP 1 - MANDATORY CHECK (ALWAYS DO THIS FIRST):**
When user says "add PayPal to this invoice" or "enable PayPal":
- 🚨 ALWAYS call get_payment_options FIRST - NO EXCEPTIONS!
- NEVER call update_payment_methods without checking get_payment_options first!
- Check the response for paypal_enabled and paypal_email values

**STEP 2 - HANDLE BASED ON CURRENT STATE:**

IF PayPal already enabled globally (paypal_enabled=true AND paypal_email exists):
- ✅ CORRECT: Use update_payment_methods(invoice_identifier: "latest", enable_paypal: true)
- Show updated invoice with PayPal enabled
- Example response: "I've enabled PayPal on your invoice using your existing PayPal email: user@example.com"

IF PayPal NOT enabled globally (paypal_enabled=false OR no paypal_email):
- ❌ DO NOT call update_payment_methods - it will fail!
- ✅ CORRECT: Ask for PayPal email first
- Example: "I'll set up PayPal for your invoice. What's your PayPal email address?"
- Wait for email, then call setup_paypal_payments(paypal_email: "[email]", invoice_number: "latest")

**CRITICAL RULES:**
- NEVER call update_payment_methods for PayPal without checking get_payment_options first
- If update_payment_methods says "PayPal not configured", that means you skipped step 1!
- Always follow: get_payment_options → analyze response → choose correct function

**MANDATORY SEQUENCE:**
1. 🚨 get_payment_options (ALWAYS FIRST - NO EXCEPTIONS!)
2A. IF paypal_enabled=true: update_payment_methods(enable_paypal: true) 
2B. IF paypal_enabled=false: Ask for email → setup_paypal_payments  
3. Always show updated invoice

🚨 BANK TRANSFER SETUP - CRITICAL WORKFLOW (NEVER SKIP STEP 1!) 🚨

**STEP 1 - MANDATORY CHECK (ALWAYS DO THIS FIRST):**
When user says "add bank transfer", "enable bank transfer", "add my bank details":
- 🚨 ALWAYS call get_payment_options FIRST - NO EXCEPTIONS!
- NEVER call update_payment_methods without checking get_payment_options first!
- Check the response for bank_transfer_enabled and bank_details values

**STEP 2 - HANDLE BASED ON CURRENT STATE:**

IF Bank transfer already enabled globally (bank_transfer_enabled=true AND bank_details exists):
- ✅ CORRECT: Use update_payment_methods(invoice_identifier: "latest", enable_bank_transfer: true)
- Show updated invoice with bank transfer enabled
- Example response: "I've enabled bank transfer on your invoice using your existing bank details"
- ❌ NEVER ask for new bank details when they already exist

IF Bank transfer NOT enabled globally (bank_transfer_enabled=false OR no bank_details):
- ❌ DO NOT call update_payment_methods - it will fail!
- ✅ CORRECT: Ask for bank details first
- Example: "I'll set up bank transfer for your invoice. What are your bank account details?"
- Wait for details, then call setup_bank_transfer(bank_details: "[details]", invoice_number: "latest")

**CRITICAL RULES:**
- NEVER call update_payment_methods for bank transfer without checking get_payment_options first
- If update_payment_methods says "Bank transfer not configured", that means you skipped step 1!
- Always follow: get_payment_options → analyze response → choose correct function

**MANDATORY SEQUENCE:**
1. 🚨 get_payment_options (ALWAYS FIRST - NO EXCEPTIONS!)
2A. IF bank_transfer_enabled=true: update_payment_methods(enable_bank_transfer: true) 
2B. IF bank_transfer_enabled=false: Ask for details → setup_bank_transfer  
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

🚨 MULTIPLE ITEMS HANDLING - CRITICAL RULE:
When user asks to add MULTIPLE items in one request:
• Use parallel tool calls to add all items at once
• Return ONE summary message and ONE invoice preview after ALL items are added
• NEVER show intermediate states or multiple invoice previews

Example: "Add a suitcase $40, pump $10, backpack $15, pillow $30"
✅ CORRECT APPROACH: 
  1. Make 4 parallel add_line_item calls in a single response
  2. Wait for all to complete
  3. Show ONE message: "I've added all 4 items to invoice INV-XXX:"
     - Suitcase: $40
     - Pump: $10  
     - Backpack: $15
     - Pillow: $30
     Total: $XXX
  4. Show ONE invoice preview with all items

❌ WRONG APPROACH:
  - Making sequential calls with separate responses
  - Showing multiple invoice previews
  - Saying "I've added item X" multiple times

IMPLEMENTATION TIP: Use OpenAI's parallel tool calling feature - submit all add_line_item calls in ONE tool_calls array!

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
            tools: [
              {
                type: "function",
                function: {
                  name: "create_invoice",
                  description: "Creates a comprehensive invoice with ALL options in ONE operation - line items, due dates, payment terms, PayPal setup, notes, tax rates, design template, accent color, and more. Use invoice_design and accent_color parameters for styling during creation.",
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
                          required: [
                            "item_name",
                            "unit_price"
                          ]
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
                  name: "sync_bank_details",
                  description: "Sync bank details from payment options to business settings for invoice display. Use this if bank details aren't showing correctly on invoices.",
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
                    required: [
                      "client_name"
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
                        enum: [
                          "update_business_phone",
                          "update_business_address",
                          "update_business_email",
                          "update_client_phone",
                          "update_client_address",
                          "update_client_email",
                          "update_client_tax_number",
                          "remove_incorrect_data"
                        ]
                      },
                      correct_value: {
                        type: "string",
                        description: "The correct value that should be used"
                      },
                      remove_incorrect_from: {
                        type: "string",
                        description: "Where to remove the incorrect value from (e.g., 'client_tax_number', 'business_phone')",
                        enum: [
                          "client_tax_number",
                          "client_phone",
                          "client_email",
                          "client_address",
                          "business_phone",
                          "business_email",
                          "business_address"
                        ]
                      },
                      invoice_or_estimate_identifier: {
                        type: "string",
                        description: "Invoice or estimate number, client name, or 'latest' for most recent document"
                      }
                    },
                    required: [
                      "mistake_description",
                      "correct_action",
                      "correct_value",
                      "invoice_or_estimate_identifier"
                    ]
                  }
                }
              },
              {
                type: "function",
                function: {
                  name: "update_payment_methods",
                  description: "Enable or disable payment methods for an existing invoice. When enabling, only works if methods are enabled in business settings. When disabling, always works.",
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
                    required: [
                      "client_name"
                    ]
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
                        enum: [
                          "classic",
                          "modern",
                          "clean",
                          "simple",
                          "wave"
                        ]
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
                    required: [
                      "design_id"
                    ]
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
                    required: [
                      "accent_color"
                    ]
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
                        enum: [
                          "classic",
                          "modern",
                          "clean",
                          "simple",
                          "wave"
                        ]
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
                          required: [
                            "item_name",
                            "unit_price"
                          ]
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
                        enum: [
                          "classic",
                          "modern",
                          "clean",
                          "simple",
                          "wave"
                        ]
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
                        enum: [
                          "draft",
                          "sent",
                          "accepted",
                          "declined",
                          "expired",
                          "cancelled"
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
                      estimate_template: {
                        type: "string",
                        description: "Update estimate design template",
                        enum: [
                          "classic",
                          "modern",
                          "clean",
                          "simple",
                          "wave"
                        ]
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
                          required: [
                            "item_name",
                            "unit_price"
                          ]
                        }
                      }
                    },
                    required: [
                      "estimate_identifier"
                    ]
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
                    required: [
                      "estimate_identifier",
                      "item_name",
                      "unit_price"
                    ]
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
                    required: [
                      "estimate_identifier"
                    ]
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
                        enum: [
                          "draft",
                          "sent",
                          "accepted",
                          "declined",
                          "expired",
                          "converted",
                          "cancelled"
                        ]
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
                    required: [
                      "estimate_identifier"
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
                        enum: [
                          "update_business_phone",
                          "update_business_address",
                          "update_business_email",
                          "update_client_phone",
                          "update_client_address",
                          "update_client_email",
                          "update_client_tax_number",
                          "remove_incorrect_data"
                        ]
                      },
                      correct_value: {
                        type: "string",
                        description: "The correct value that should be used"
                      },
                      remove_incorrect_from: {
                        type: "string",
                        description: "Where to remove the incorrect value from (e.g., 'client_tax_number', 'business_phone')",
                        enum: [
                          "client_tax_number",
                          "client_phone",
                          "client_email",
                          "client_address",
                          "business_phone",
                          "business_email",
                          "business_address"
                        ]
                      },
                      invoice_or_estimate_identifier: {
                        type: "string",
                        description: "Invoice or estimate number, client name, or 'latest' for most recent document"
                      }
                    },
                    required: [
                      "mistake_description",
                      "correct_action",
                      "correct_value",
                      "invoice_or_estimate_identifier"
                    ]
                  }
                }
              }
            ],
            model: "gpt-4o-mini"
          });
          console.log('[Assistants POC] Updated assistant successfully');
        }
      } catch (error) {
        console.error('[Assistants POC] WARNING: Could not update assistant, using as-is:', error);
      // CRITICAL FIX: Don't set assistant to null! Use the existing assistant even if update fails
      // assistant = null; // REMOVED - This was causing new assistant creation!
      }
    }
    if (!assistant) {
      // CRITICAL: Never create new assistants - this destroys context!
      console.error('[Assistants POC] ERROR: No assistant found and creation is disabled');
      throw new Error('Assistant configuration error - cannot create new assistants');
    /* DISABLED - Creating new assistants destroys context
      console.log('[Assistants POC] Creating new assistant with all tools...');
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
• You have access to powerful functions for invoice/estimate/quote/client/business management
• ALWAYS use the appropriate functions to complete user requests
• When user asks to create, update, search, or manage anything - call the relevant function
• Do NOT just describe what you would do - actually DO IT by calling functions
• Example: "create invoice" → call create_invoice function immediately
• Example: "create quote" → call create_estimate function immediately

🚨 CONTEXT-AWARE UPDATES - CRITICAL:
When user mentions updates WITHOUT specifying which invoice/estimate:
• ALWAYS use the most recently created/discussed document from the conversation
• Look at the conversation history to identify what was just created
• Use update_invoice for invoices, update_estimate for estimates
• NEVER create a new document when the user clearly wants to update the existing one

Examples:
• User: "Create invoice for Emily 100 cakes at $4 each"
• AI: Creates INV-079
• User: "Add a discount 10%"
• ✅ CORRECT: update_invoice(invoice_identifier: "INV-079", discount_type: "percentage", discount_value: 10)
• ❌ WRONG: create_invoice with discount (creates duplicate)
• ❌ WRONG: update_estimate on invoice (wrong function)

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

🚨 **CRITICAL: INVOICE vs ESTIMATE CONTEXT** 🚨
When user says "add address" or similar:
• If you JUST created an INVOICE → Use update_client_info with invoice_identifier
• If you JUST created an ESTIMATE → Use update_estimate with estimate_identifier
• NEVER mix them up! The system tracks what was just created

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

PAYMENT METHOD MANAGEMENT:
When users want to enable/disable payment options on invoices or estimates:

**ENABLING PAYMENTS:**
• Use update_payment_methods (invoices) or update_estimate_payment_methods (estimates)
• Keywords: "enable", "activate", "turn on", "add", "card payments", "stripe", "paypal", "bank transfer"
• Examples:
  - "Enable card payments on invoice INV-123456" → update_payment_methods(invoice_identifier: "INV-123456", enable_stripe: true)
  - "Add PayPal to this estimate" → update_estimate_payment_methods(estimate_identifier: "latest", enable_paypal: true)
  - "Turn on bank transfer for quote Q-001" → update_estimate_payment_methods(estimate_identifier: "Q-001", enable_bank_transfer: true)
• IMPORTANT: Only enable payment methods that are enabled in business settings

**DISABLING/REMOVING PAYMENTS:**
• Use update_payment_methods (invoices) or update_estimate_payment_methods (estimates) with false values
• Keywords: "remove", "disable", "turn off", "delete", "take off", "deactivate"
• Examples:
  - "Remove PayPal from invoice INV-123456" → update_payment_methods(invoice_identifier: "INV-123456", enable_paypal: false)
  - "Disable card payments on this estimate" → update_estimate_payment_methods(estimate_identifier: "latest", enable_stripe: false)
  - "Turn off bank transfer for quote Q-001" → update_estimate_payment_methods(estimate_identifier: "Q-001", enable_bank_transfer: false)
• IMPORTANT: Disabling always works regardless of business settings

• Both functions automatically show updated invoice/estimate with payment options updated

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
        ],
        model: "gpt-4o-mini"
      });
      console.log('[Assistants POC] Created new assistant:', assistant.id);
      console.log('[Assistants POC] 🚨 UPDATE CODE: Set ASSISTANT_ID to:', assistant.id);
      */ }
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
    // Frontend handles immediate status - no need for backend status
    // Create run with assistant  
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistant.id
    });
    console.log('[Assistants POC] Started run:', run.id, threadReused ? '(reused thread)' : '(new thread)');
    // 🚪 ATTACHMENT GATE: Only return the last invoice/estimate to prevent duplicates
    let attachments = [];
    let lastInvoiceAttachment = null; // "Last Invoice Wins" pattern
    let lastEstimateAttachment = null; // "Last Estimate Wins" pattern
    // Function to handle tool calls
    const handleToolCall = async (toolCall)=>{
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = JSON.parse(args);
      console.log('[Assistants POC] Tool call:', name, parsedArgs);
      // Helper function to create complete invoice attachment with all required data
      const createInvoiceAttachment = async (invoiceData, lineItems = [], clientData = null)=>{
        try {
          // Get payment options and business settings for complete invoice display
          const { data: paymentOptions } = await supabase.from('payment_options').select('*').eq('user_id', user_id).single();
          const { data: businessSettings } = await supabase.from('business_settings').select('*').eq('user_id', user_id).single();
          return {
            type: 'invoice',
            invoice_id: invoiceData.id,
            invoice: invoiceData,
            line_items: lineItems,
            client_id: invoiceData.client_id,
            client: clientData,
            paymentOptions: paymentOptions,
            businessSettings: businessSettings
          };
        } catch (error) {
          console.error('[createInvoiceAttachment] Error:', error);
          // Fallback without payment/business data
          return {
            type: 'invoice',
            invoice_id: invoiceData.id,
            invoice: invoiceData,
            line_items: lineItems,
            client_id: invoiceData.client_id,
            client: clientData
          };
        }
      };
      // 🚪 ATTACHMENT GATE: Set the latest invoice/estimate (replaces push pattern)
      const setLatestInvoice = (invoiceAttachment)=>{
        console.log('[Invoice Gate] Setting latest invoice:', invoiceAttachment?.invoice?.invoice_number || 'unknown');
        lastInvoiceAttachment = invoiceAttachment;
      };
      const setLatestEstimate = (estimateAttachment)=>{
        console.log('[Estimate Gate] Setting latest estimate:', estimateAttachment?.estimate?.estimate_number || 'unknown');
        lastEstimateAttachment = estimateAttachment;
      };
      // Helper function to create complete estimate attachment with all required data
      const createEstimateAttachment = async (estimateData, lineItems = [], clientData = null)=>{
        try {
          // Get payment options and business settings for complete estimate display
          const { data: paymentOptions } = await supabase.from('payment_options').select('*').eq('user_id', user_id).single();
          const { data: businessSettings } = await supabase.from('business_settings').select('*').eq('user_id', user_id).single();
          return {
            type: 'estimate',
            estimate_id: estimateData.id,
            estimate: estimateData,
            line_items: lineItems,
            client_id: estimateData.client_id,
            client: clientData,
            paymentOptions: paymentOptions,
            businessSettings: businessSettings
          };
        } catch (error) {
          console.error('[createEstimateAttachment] Error:', error);
          // Fallback without payment/business data
          return {
            type: 'estimate',
            estimate_id: estimateData.id,
            estimate: estimateData,
            line_items: lineItems,
            client_id: estimateData.client_id,
            client: clientData
          };
        }
      };
      if (name === 'create_invoice') {
        // Check usage limits first
        const permission = await checkCanCreateItem(supabase, user_id);
        if (!permission.allowed) {
          await sendStatusUpdate('Free plan limit reached', '🔒');
          return JSON.stringify(permission);
        }
        // Status already sent - no duplicate needed
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
          const { data: fullClient } = await supabase.from('clients').select('*').eq('id', clientId).eq('user_id', user_id).single();
          if (fullClient) {
            clientData = fullClient;
          }
        }
        // Store attachment for UI with full client data
        const invoiceAttachment = await createInvoiceAttachment(invoice, createdLineItems, clientData);
        setLatestInvoice(invoiceAttachment);
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
        await sendStatusUpdate('Updating business settings', '⚙️');
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
        // 🔥 CRITICAL: Show updated invoice/estimate with new business settings
        const lastAction = ConversationMemory.getLastAction(user_id);
        console.log('[update_business_settings] Last action:', lastAction);
        // 🚨 FIX: Only show documents if we're NOT in client-only context
        const currentContext = detectConversationContext(message, user_id);
        console.log('[update_business_settings] Current context:', currentContext);
        // Only return documents if we have invoice/estimate context (not client_context)
        if (currentContext !== 'client_context' && (lastAction?.type === 'created_invoice' || lastAction?.type === 'updated_invoice')) {
          // Get the most recent invoice
          const { data: recentInvoice } = await supabase.from('invoices').select('*, client:clients(*)').eq('user_id', user_id).order('created_at', {
            ascending: false
          }).limit(1).single();
          if (recentInvoice) {
            const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', recentInvoice.id);
            const invoiceAttachment = await createInvoiceAttachment(recentInvoice, lineItems || [], recentInvoice.client);
            setLatestInvoice(invoiceAttachment);
            return successMessage + '\n\nHere\'s your invoice with the updated business information:';
          }
        } else if (currentContext !== 'client_context' && (lastAction?.type === 'created_estimate' || lastAction?.type === 'updated_estimate')) {
          // Get the most recent estimate
          const { data: recentEstimate } = await supabase.from('estimates').select('*, client:clients(*)').eq('user_id', user_id).order('created_at', {
            ascending: false
          }).limit(1).single();
          if (recentEstimate) {
            const { data: lineItems } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', recentEstimate.id);
            const estimateAttachment = await createEstimateAttachment(recentEstimate, lineItems || [], recentEstimate.client);
            setLatestEstimate(estimateAttachment);
            return successMessage + '\n\nHere\'s your estimate with the updated business information:';
          }
        }
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
• Stripe: ❌ Not configured (enable in Settings > Payment Options)
• PayPal: ❌ Not configured
• Bank Transfer: ❌ Not configured (enable in Settings > Payment Options)

To accept payments, configure at least one payment method.`;
        }
        let status = `⚙️ **Payment Options Status:**\n`;
        status += `• Stripe: ${paymentOptions.stripe_enabled ? '✅ Enabled' : '❌ Disabled (enable in Settings > Payment Options)'}\n`;
        status += `• PayPal: ${paymentOptions.paypal_enabled ? `✅ Enabled (${paymentOptions.paypal_email})` : '❌ Disabled'}\n`;
        status += `• Bank Transfer: ${paymentOptions.bank_transfer_enabled ? '✅ Enabled' : '❌ Disabled'}`;
        if (paymentOptions.bank_transfer_enabled && paymentOptions.bank_details) {
          status += `\n\n**Bank Details:**\n${paymentOptions.bank_details}`;
        }
        console.log('[get_payment_options] Payment status:', {
          stripe: paymentOptions.stripe_enabled,
          paypal: paymentOptions.paypal_enabled,
          bank: paymentOptions.bank_transfer_enabled
        });
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
                // Get line items and client data for complete attachment
                const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', invoice.id).order('created_at', {
                  ascending: true
                });
                let clientData = null;
                if (updatedInvoice.client_id) {
                  const { data: client } = await supabase.from('clients').select('*').eq('id', updatedInvoice.client_id).single();
                  clientData = client;
                }
                // Use proper helper and gate pattern
                const invoiceAttachment = await createInvoiceAttachment(updatedInvoice, lineItems || [], clientData);
                setLatestInvoice(invoiceAttachment);
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
        // Update payment_options table (for AI functions)
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
        // CRITICAL FIX: Also update business_settings table (for invoice display)
        const { error: businessError } = await supabase.from('business_settings').upsert({
          user_id: user_id,
          bank_details: bank_details,
          enable_bank_transfer_payments: true,
          updated_at: new Date().toISOString()
        });
        if (businessError) {
          console.error('[Assistants POC] Business settings bank details update error:', businessError);
        // Don't fail - payment_options is the primary source
        } else {
          console.log('[Assistants POC] Successfully synced bank details to business_settings for invoice display');
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
              // Get complete updated invoice data (same pattern as update_payment_methods)
              const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', invoice.id).single();
              // Get line items from correct table
              const { data: lineItems, error: lineItemsError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', invoice.id).order('created_at', {
                ascending: true
              });
              if (lineItemsError) {
                console.error('[setup_bank_transfer] Line items fetch error:', lineItemsError);
              }
              // Get client data for attachment
              let clientData = null;
              if (updatedInvoice && updatedInvoice.client_id) {
                const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', updatedInvoice.client_id).eq('user_id', user_id).single();
                if (!clientError) {
                  clientData = client;
                }
              }
              // Create complete attachment for updated invoice
              if (updatedInvoice) {
                const invoiceAttachment = await createInvoiceAttachment(updatedInvoice, lineItems || [], clientData);
                setLatestInvoice(invoiceAttachment);
                console.log('[setup_bank_transfer] Success - created complete invoice attachment with payment options');
              }
            }
          }
        }
        return response;
      }
      if (name === 'sync_bank_details') {
        console.log('[Assistants POC] Syncing bank details from payment_options to business_settings');
        // Get bank details from payment_options
        const { data: paymentOptions, error: paymentError } = await supabase.from('payment_options').select('bank_details, bank_transfer_enabled').eq('user_id', user_id).single();
        if (paymentError || !paymentOptions || !paymentOptions.bank_details) {
          return 'No bank details found in payment options to sync.';
        }
        // Update business_settings with the bank details
        const { error: businessError } = await supabase.from('business_settings').upsert({
          user_id: user_id,
          bank_details: paymentOptions.bank_details,
          enable_bank_transfer_payments: paymentOptions.bank_transfer_enabled,
          updated_at: new Date().toISOString()
        });
        if (businessError) {
          console.error('[sync_bank_details] Error:', businessError);
          return `Error syncing bank details: ${businessError.message}`;
        }
        return `✅ Successfully synced bank details to business settings:\n\n${paymentOptions.bank_details}`;
      }
      if (name === 'create_client') {
        const { client_name, client_email, client_phone, client_address, client_tax_number } = parsedArgs;
        try {
          console.log('[create_client] Creating new client:', {
            client_name,
            client_email,
            client_phone,
            client_address,
            client_tax_number
          });
          // Check if client already exists (case-insensitive search)
          const { data: existingClient, error: searchError } = await supabase.from('clients').select('*').eq('user_id', user_id).ilike('name', client_name.trim()).maybeSingle();
          if (searchError) {
            console.error('[create_client] Error searching for existing client:', searchError);
            return `Error searching for existing client: ${searchError.message}`;
          }
          let clientData;
          if (existingClient) {
            // Client exists, update with new information if provided
            const updateData = {};
            if (client_email) updateData.email = client_email;
            if (client_phone) updateData.phone = client_phone;
            if (client_address) updateData.address_client = client_address;
            if (client_tax_number) updateData.tax_number = client_tax_number;
            if (Object.keys(updateData).length > 0) {
              const { data: updatedClient, error: updateError } = await supabase.from('clients').update(updateData).eq('id', existingClient.id).select().single();
              if (updateError) {
                console.error('[create_client] Error updating existing client:', updateError);
                return `Error updating existing client: ${updateError.message}`;
              }
              clientData = updatedClient;
              console.log('[create_client] Updated existing client:', clientData.id);
            } else {
              clientData = existingClient;
              console.log('[create_client] Found existing client (no updates needed):', clientData.id);
            }
          } else {
            // Create new client
            const { data: newClient, error: createError } = await supabase.from('clients').insert({
              user_id: user_id,
              name: client_name.trim(),
              email: client_email || null,
              phone: client_phone || null,
              address_client: client_address || null,
              tax_number: client_tax_number || null
            }).select().single();
            if (createError) {
              console.error('[create_client] Error creating new client:', createError);
              return `Error creating client: ${createError.message}`;
            }
            clientData = newClient;
            console.log('[create_client] Created new client:', clientData.id);
          }
          // Create client attachment for preview
          const clientAttachment = {
            type: 'client',
            client_id: clientData.id,
            client: {
              id: clientData.id,
              name: clientData.name,
              email: clientData.email,
              phone: clientData.phone,
              address_client: clientData.address_client,
              tax_number: clientData.tax_number
            }
          };
          // Add to attachments (not using Last Wins pattern for clients)
          attachments.push(clientAttachment);
          // Track in conversation memory
          ConversationMemory.setLastAction(user_id, 'created_client', {
            client_name: clientData.name,
            client_id: clientData.id
          });
          let response = existingClient ? `✅ Updated client information for **${clientData.name}**` : `✅ Created new client **${clientData.name}**`;
          if (client_email) response += `\n• Email: ${client_email}`;
          if (client_phone) response += `\n• Phone: ${client_phone}`;
          if (client_address) response += `\n• Address: ${client_address}`;
          if (client_tax_number) response += `\n• Tax number: ${client_tax_number}`;
          response += `\n\n${clientData.name} has been added to your client database. You can now create invoices or estimates for them.`;
          return response;
        } catch (error) {
          console.error('[create_client] Error:', error);
          return `Error creating client: ${error.message}`;
        }
      }
      if (name === 'correct_mistake') {
        const { mistake_description, correct_action, correct_value, remove_incorrect_from, invoice_or_estimate_identifier } = parsedArgs;
        try {
          console.log('[correct_mistake] Starting correction:', {
            mistake_description,
            correct_action,
            correct_value,
            remove_incorrect_from,
            invoice_or_estimate_identifier
          });
          // Start with an apology
          let response = `🙏 I apologize for the mistake! You're absolutely right - ${mistake_description}.\n\nLet me fix that immediately:\n\n`;
          // Find the document (invoice or estimate)
          let targetDocument = null;
          let documentType = null;
          let documentIdField = null;
          // First try to find as invoice
          const invoiceResult = await findInvoice(supabase, user_id, invoice_or_estimate_identifier);
          if (typeof invoiceResult !== 'string') {
            targetDocument = invoiceResult;
            documentType = 'invoice';
            documentIdField = 'id';
          } else {
            // Try to find as estimate
            const estimateResult = await findEstimate(supabase, user_id, invoice_or_estimate_identifier);
            if (typeof estimateResult !== 'string') {
              targetDocument = estimateResult;
              documentType = 'estimate';
              documentIdField = 'id';
            } else {
              return `❌ Could not find invoice or estimate: ${invoice_or_estimate_identifier}`;
            }
          }
          console.log('[correct_mistake] Found document:', documentType, targetDocument[documentType === 'invoice' ? 'invoice_number' : 'estimate_number']);
          // Step 1: Remove incorrect data if specified
          if (remove_incorrect_from) {
            const removeUpdates = {};
            if (remove_incorrect_from.startsWith('client_')) {
              // Remove from client table
              const clientField = remove_incorrect_from.replace('client_', '');
              if (clientField === 'tax_number') {
                removeUpdates.tax_number = null;
              } else {
                removeUpdates[clientField] = null;
              }
              if (targetDocument.client_id) {
                const { error: removeError } = await supabase.from('clients').update(removeUpdates).eq('id', targetDocument.client_id);
                if (removeError) {
                  console.error('[correct_mistake] Remove error:', removeError);
                } else {
                  response += `✅ Removed incorrect value from client ${clientField}\n`;
                }
              }
            } else if (remove_incorrect_from.startsWith('business_')) {
              // Remove from business settings
              const businessField = remove_incorrect_from.replace('business_', '');
              removeUpdates[businessField] = null;
              const { error: removeError } = await supabase.from('business_settings').update(removeUpdates).eq('user_id', user_id);
              if (removeError) {
                console.error('[correct_mistake] Remove error:', removeError);
              } else {
                response += `✅ Removed incorrect value from business ${businessField}\n`;
              }
            }
          }
          // Step 2: Apply correct action
          const correctUpdates = {};
          if (correct_action.startsWith('update_client_')) {
            // Update client table
            const clientField = correct_action.replace('update_client_', '');
            if (clientField === 'tax_number') {
              correctUpdates.tax_number = correct_value;
            } else {
              correctUpdates[clientField] = correct_value;
            }
            if (targetDocument.client_id) {
              const { error: updateError } = await supabase.from('clients').update(correctUpdates).eq('id', targetDocument.client_id);
              if (updateError) {
                console.error('[correct_mistake] Update error:', updateError);
                return `❌ Error updating client information: ${updateError.message}`;
              } else {
                response += `✅ Updated client ${clientField} to: ${correct_value}\n`;
              }
            }
          } else if (correct_action.startsWith('update_business_')) {
            // Update business settings
            const businessField = correct_action.replace('update_business_', '');
            correctUpdates[businessField] = correct_value;
            const { error: updateError } = await supabase.from('business_settings').update(correctUpdates).eq('user_id', user_id);
            if (updateError) {
              console.error('[correct_mistake] Update error:', updateError);
              return `❌ Error updating business information: ${updateError.message}`;
            } else {
              response += `✅ Updated business ${businessField} to: ${correct_value}\n`;
            }
          }
          // Step 3: Return the corrected document
          response += `\nHere's your corrected ${documentType}:`;
          if (documentType === 'invoice') {
            // Get updated invoice data
            const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetDocument.id).single();
            const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetDocument.id).order('created_at', {
              ascending: true
            });
            let clientData = null;
            if (targetDocument.client_id) {
              const { data: client } = await supabase.from('clients').select('*').eq('id', targetDocument.client_id).single();
              clientData = client;
            }
            const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetDocument, lineItems || [], clientData);
            setLatestInvoice(invoiceAttachment);
          } else {
            // Get updated estimate data
            const { data: updatedEstimate } = await supabase.from('estimates').select('*').eq('id', targetDocument.id).single();
            const { data: lineItems } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', targetDocument.id).order('created_at', {
              ascending: true
            });
            let clientData = null;
            if (targetDocument.client_id) {
              const { data: client } = await supabase.from('clients').select('*').eq('id', targetDocument.client_id).single();
              clientData = client;
            }
            const estimateAttachment = await createEstimateAttachment(updatedEstimate || targetDocument, lineItems || [], clientData);
            setLatestEstimate(estimateAttachment);
          }
          response += `\n\n✅ All fixed! Thank you for catching my mistake - I'll be more careful next time.`;
          return response;
        } catch (error) {
          console.error('[correct_mistake] Error:', error);
          return `❌ Error correcting mistake: ${error.message}`;
        }
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
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, allLineItems || [], clientData);
          setLatestInvoice(invoiceAttachment);
          console.log('[update_invoice] Success - created attachment');
          // Enhanced response with payment details if payment was updated
          let response = `I've updated invoice ${targetInvoice.invoice_number}.`;
          if (paid_amount !== undefined) {
            const finalInvoice = updatedInvoice || targetInvoice;
            const totalAmount = finalInvoice.total_amount || 0;
            const remainingAmount = Math.max(totalAmount - paid_amount, 0);
            const paymentPercentage = totalAmount > 0 ? Math.min(paid_amount / totalAmount * 100, 100) : 0;
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
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, allLineItems, clientData);
          setLatestInvoice(invoiceAttachment);
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
      if (name === 'add_line_items') {
        await sendStatusUpdate('Adding line items', '➕');
        const { invoice_identifier, line_items } = parsedArgs;
        if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
          return 'Error: line_items array is required and must contain at least one item';
        }
        try {
          // First find the invoice
          const findResult = await findInvoice(supabase, user_id, invoice_identifier);
          if (typeof findResult === 'string') {
            return findResult;
          }
          const targetInvoice = findResult;
          console.log('[add_line_items] Adding', line_items.length, 'line items to invoice:', targetInvoice.invoice_number);
          // Prepare line items for bulk insert
          const itemsToInsert = line_items.map((item)=>({
              invoice_id: targetInvoice.id,
              user_id: user_id,
              item_name: item.item_name,
              item_description: item.item_description || null,
              quantity: item.quantity || 1,
              unit_price: item.unit_price,
              total_price: (item.quantity || 1) * item.unit_price,
              created_at: new Date().toISOString()
            }));
          // Bulk insert all line items
          const { data: newLineItems, error: lineItemError } = await supabase.from('invoice_line_items').insert(itemsToInsert).select();
          if (lineItemError) {
            console.error('[add_line_items] Bulk insert error:', lineItemError);
            return `Error adding line items: ${lineItemError.message}`;
          }
          console.log('[add_line_items] Successfully inserted', newLineItems.length, 'line items');
          // Get all line items for this invoice to recalculate totals
          const { data: allLineItems, error: fetchError } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id);
          if (fetchError) {
            console.error('[add_line_items] Error fetching line items:', fetchError);
            return `Error recalculating totals: ${fetchError.message}`;
          }
          // Recalculate totals from all line items
          const subtotal = allLineItems.reduce((sum, item)=>sum + (item.total_price || 0), 0);
          const taxAmount = subtotal * (targetInvoice.tax_percentage || 0) / 100;
          const discountAmount = targetInvoice.discount_type === 'percentage' ? subtotal * (targetInvoice.discount_value || 0) / 100 : targetInvoice.discount_value || 0;
          const total = subtotal + taxAmount - discountAmount;
          // Update invoice totals
          console.log('[add_line_items] Updating invoice totals:', {
            subtotal,
            total
          });
          const { error: updateError } = await supabase.from('invoices').update({
            subtotal_amount: subtotal,
            total_amount: total
          }).eq('user_id', user_id).eq('id', targetInvoice.id);
          if (updateError) {
            console.error('[add_line_items] Update error:', updateError);
            return `Error updating invoice totals: ${updateError.message}`;
          }
          console.log('[add_line_items] Successfully updated invoice:', targetInvoice.invoice_number);
          // Get updated invoice data with client info for attachment
          const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
          // Get client data if exists
          let clientData = null;
          if (targetInvoice.client_id) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
            clientData = client;
          }
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, allLineItems, clientData);
          setLatestInvoice(invoiceAttachment);
          // Track in conversation memory
          ConversationMemory.setLastAction(user_id, 'added_multiple_line_items', {
            invoice_number: targetInvoice.invoice_number,
            invoice_id: targetInvoice.id,
            client_id: targetInvoice.client_id,
            items_added: line_items.map((item)=>item.item_name).join(', '),
            items_count: line_items.length
          });
          const itemsList = line_items.map((item)=>`• ${item.item_name} (${item.quantity || 1}x $${item.unit_price})`).join('\n');
          return `Added ${line_items.length} line items to invoice ${targetInvoice.invoice_number}:

${itemsList}

Total updated to $${total.toFixed(2)}.

Let me know if you'd like any other changes!`;
        } catch (error) {
          console.error('[add_line_items] Error:', error);
          return `Error adding line items: ${error.message}`;
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
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, remainingItems, clientData);
          setLatestInvoice(invoiceAttachment);
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
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, allLineItems, clientData);
          setLatestInvoice(invoiceAttachment);
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
        await sendStatusUpdate('Updating client info', '👤');
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
            const { data: client, error: clientError } = await supabase.from('clients').select('id, name, email, phone, address_client, notes, tax_number, created_at, updated_at').eq('id', targetInvoice.client_id).eq('user_id', user_id).single();
            if (!clientError) {
              updatedClientData = client;
            }
          }
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, lineItems || [], updatedClientData);
          setLatestInvoice(invoiceAttachment);
          console.log('[update_client_info] Success - created attachment:', {
            type: invoiceAttachment.type,
            invoice_id: invoiceAttachment.invoice_id,
            has_invoice: !!invoiceAttachment.invoice,
            has_line_items: !!invoiceAttachment.line_items,
            line_items_count: invoiceAttachment.line_items?.length || 0,
            client_id: invoiceAttachment.client_id,
            has_client: !!invoiceAttachment.client
          });
          console.log('[update_client_info] Using setLatestInvoice for proper attachment gate');
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
        await sendStatusUpdate('Setting up payments', '💳');
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
          const { data: paymentOptions, error: paymentOptionsError } = await supabase.from('payment_options').select('stripe_enabled, paypal_enabled, bank_transfer_enabled, paypal_email, bank_details').eq('user_id', user_id).maybeSingle();
          if (paymentOptionsError) {
            console.error('[update_payment_methods] Payment options fetch error:', paymentOptionsError);
            return 'Error: Could not fetch payment options to validate payment methods';
          }
          // If no payment options exist, treat all as disabled
          const actualPaymentOptions = paymentOptions || {
            stripe_enabled: false,
            paypal_enabled: false,
            bank_transfer_enabled: false,
            paypal_email: null,
            bank_details: null
          };
          console.log('[update_payment_methods] Payment options:', actualPaymentOptions);
          let paymentUpdates = {};
          let message = `Updated payment methods for invoice ${targetInvoice.invoice_number}:`;
          let skippedMethods = [];
          // Check each payment method - use correct column names from payment_options
          if (enable_stripe !== undefined) {
            if (enable_stripe && actualPaymentOptions.stripe_enabled) {
              paymentUpdates.stripe_active = true;
              message += `\n- ✅ Stripe payments enabled`;
            } else if (enable_stripe && !actualPaymentOptions.stripe_enabled) {
              skippedMethods.push('Stripe (not configured in payment options)');
            } else {
              paymentUpdates.stripe_active = false;
              message += `\n- ❌ Stripe payments disabled`;
            }
          }
          if (enable_paypal !== undefined) {
            if (enable_paypal && actualPaymentOptions.paypal_enabled) {
              paymentUpdates.paypal_active = true;
              message += `\n- ✅ PayPal payments enabled`;
            } else if (enable_paypal && !actualPaymentOptions.paypal_enabled) {
              skippedMethods.push('PayPal (not configured in payment options)');
            } else {
              paymentUpdates.paypal_active = false;
              message += `\n- ❌ PayPal payments disabled`;
            }
          }
          if (enable_bank_transfer !== undefined) {
            if (enable_bank_transfer && actualPaymentOptions.bank_transfer_enabled) {
              paymentUpdates.bank_account_active = true;
              message += `\n- ✅ Bank transfer enabled`;
            } else if (enable_bank_transfer && !actualPaymentOptions.bank_transfer_enabled) {
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
          // Create attachment for updated invoice using the proper helper and gate pattern
          const invoiceAttachment = await createInvoiceAttachment(updatedInvoice || targetInvoice, lineItems || [], clientData);
          setLatestInvoice(invoiceAttachment);
          console.log('[update_payment_methods] Success - created attachment');
          message += `\n\nLet me know if you'd like any other changes!`;
          return message;
        } catch (error) {
          console.error('[update_payment_methods] Error:', error);
          return `Error updating payment methods: ${error.message}`;
        }
      }
      // Design and Color Control Functions - Implemented directly in edge function
      if (name === 'get_design_options') {
        try {
          return `📐 **Available Invoice Designs**

🏛️ **Classic** - Traditional, professional, trustworthy
   • Best for: Law firms, accounting, corporate services
   • Personality: Established, reliable, formal

🌟 **Modern** - Contemporary, clean, forward-thinking  
   • Best for: Tech startups, creative agencies, modern businesses
   • Personality: Innovative, fresh, progressive

✨ **Clean** - Minimalist, organized, efficient
   • Best for: Service businesses, consultants, small businesses
   • Personality: Clear, straightforward, organized

🎨 **Simple** - Elegant, refined, understated
   • Best for: Premium services, luxury brands, artistic businesses  
   • Personality: Sophisticated, minimal, high-end

🌊 **Wave** - Modern, creative, distinctive
   • Best for: Creative agencies, design studios, innovative businesses
   • Personality: Dynamic, artistic, contemporary
   • Features: Curved wave header with purple gradient and rounded corners

To change your design, just say something like:
• "Make it more modern"
• "Use the clean design" 
• "I want something more professional"`;
        } catch (error) {
          console.error('[get_design_options] Error:', error);
          return `Error getting design options: ${error.message}`;
        }
      }
      if (name === 'get_color_options') {
        try {
          return `🎨 **Available Invoice Colors**

🔵 **Professional Blues**
   • Navy (#1E40AF) - Authority, trust, corporate
   • Blue (#2563EB) - Professional, reliable, established

⚫ **Premium Colors**  
   • Black (#000000) - Luxury, sophisticated, exclusive
   • Dark Gray (#374151) - Professional, modern, refined

🟢 **Growth & Success**
   • Green (#10B981) - Prosperity, growth, success
   • Teal (#14B8A6) - Modern, balanced, fresh

🟣 **Creative Colors**
   • Purple (#8B5CF6) - Creative, innovative, premium
   • Violet (#7C3AED) - Artistic, unique, sophisticated

🟠 **Energy & Confidence** 
   • Orange (#F59E0B) - Energetic, confident, approachable
   • Amber (#D97706) - Warm, friendly, optimistic

🔴 **Bold & Attention**
   • Red (#EF4444) - Bold, powerful, urgent
   • Pink (#EC4899) - Creative, modern, friendly

To change colors, just say:
• "Make it blue"
• "Use a more creative color"
• "I want something professional"`;
        } catch (error) {
          console.error('[get_color_options] Error:', error);
          return `Error getting color options: ${error.message}`;
        }
      }
      if (name === 'update_invoice_design') {
        const { invoice_number, design_id, apply_to_defaults = false, reasoning } = parsedArgs;
        try {
          // Validate design_id
          const validDesigns = [
            'classic',
            'modern',
            'clean',
            'simple',
            'wave'
          ];
          if (!validDesigns.includes(design_id)) {
            return `Invalid design ID. Valid options are: ${validDesigns.join(', ')}`;
          }
          // Update business defaults if requested
          if (apply_to_defaults) {
            const { error: settingsError } = await supabase.from('business_settings').update({
              default_invoice_design: design_id,
              updated_at: new Date().toISOString()
            }).eq('user_id', user_id);
            if (settingsError) {
              console.error('[update_invoice_design] Settings update error:', settingsError);
            }
          }
          // Update specific invoice if provided
          if (invoice_number) {
            // Find the invoice
            const findResult = await findInvoice(supabase, user_id, invoice_number);
            if (typeof findResult === 'string') {
              return findResult;
            }
            const targetInvoice = findResult;
            // Update invoice design
            const { error: invoiceError } = await supabase.from('invoices').update({
              invoice_design: design_id
            }).eq('user_id', user_id).eq('id', targetInvoice.id);
            if (invoiceError) {
              console.error('[update_invoice_design] Invoice update error:', invoiceError);
              return `Error updating invoice design: ${invoiceError.message}`;
            }
            // Create updated invoice attachment
            const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
            const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
              ascending: true
            });
            let clientData = null;
            if (targetInvoice.client_id) {
              const { data: client } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
              clientData = client;
            }
            // 🚪 INVOICE GATE: Use "Last Invoice Wins" pattern
            const invoiceAttachment = {
              type: 'invoice',
              invoice_id: targetInvoice.id,
              invoice: updatedInvoice || targetInvoice,
              line_items: lineItems || [],
              client_id: targetInvoice.client_id,
              client: clientData
            };
            setLatestInvoice(invoiceAttachment);
            return `✅ Updated invoice ${targetInvoice.invoice_number} to use **${design_id}** design.${reasoning ? `\n\n${reasoning}` : ''}\n\nLet me know if you'd like any other changes!`;
          } else {
            return `✅ Set **${design_id}** as your default invoice design.${reasoning ? `\n\n${reasoning}` : ''}\n\nAll new invoices will use this design.`;
          }
        } catch (error) {
          console.error('[update_invoice_design] Error:', error);
          return `Error updating invoice design: ${error.message}`;
        }
      }
      if (name === 'update_invoice_color') {
        const { invoice_number, accent_color, apply_to_defaults = false, reasoning } = parsedArgs;
        try {
          // Validate hex color format
          const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
          if (!hexColorRegex.test(accent_color)) {
            return `Invalid color format. Please use hex color format like #3B82F6`;
          }
          // Update business defaults if requested
          if (apply_to_defaults) {
            const { error: settingsError } = await supabase.from('business_settings').update({
              default_accent_color: accent_color,
              updated_at: new Date().toISOString()
            }).eq('user_id', user_id);
            if (settingsError) {
              console.error('[update_invoice_color] Settings update error:', settingsError);
            }
          }
          // Update specific invoice if provided
          if (invoice_number) {
            // Find the invoice
            const findResult = await findInvoice(supabase, user_id, invoice_number);
            if (typeof findResult === 'string') {
              return findResult;
            }
            const targetInvoice = findResult;
            // Update invoice color
            const { error: invoiceError } = await supabase.from('invoices').update({
              accent_color: accent_color
            }).eq('user_id', user_id).eq('id', targetInvoice.id);
            if (invoiceError) {
              console.error('[update_invoice_color] Invoice update error:', invoiceError);
              return `Error updating invoice color: ${invoiceError.message}`;
            }
            // Create updated invoice attachment
            const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
            const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
              ascending: true
            });
            let clientData = null;
            if (targetInvoice.client_id) {
              const { data: client } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
              clientData = client;
            }
            // 🚪 INVOICE GATE: Use "Last Invoice Wins" pattern
            const invoiceAttachment = {
              type: 'invoice',
              invoice_id: targetInvoice.id,
              invoice: updatedInvoice || targetInvoice,
              line_items: lineItems || [],
              client_id: targetInvoice.client_id,
              client: clientData
            };
            setLatestInvoice(invoiceAttachment);
            return `✅ Updated invoice ${targetInvoice.invoice_number} accent color to **${accent_color}**.${reasoning ? `\n\n${reasoning}` : ''}\n\nLet me know if you'd like any other changes!`;
          } else {
            return `✅ Set **${accent_color}** as your default invoice color.${reasoning ? `\n\n${reasoning}` : ''}\n\nAll new invoices will use this color.`;
          }
        } catch (error) {
          console.error('[update_invoice_color] Error:', error);
          return `Error updating invoice color: ${error.message}`;
        }
      }
      if (name === 'update_invoice_appearance') {
        const { invoice_number, design_id, accent_color, apply_to_defaults = false, reasoning } = parsedArgs;
        try {
          // Validate inputs
          if (design_id) {
            const validDesigns = [
              'classic',
              'modern',
              'clean',
              'simple',
              'wave'
            ];
            if (!validDesigns.includes(design_id)) {
              return `Invalid design ID. Valid options are: ${validDesigns.join(', ')}`;
            }
          }
          if (accent_color) {
            const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
            if (!hexColorRegex.test(accent_color)) {
              return `Invalid color format. Please use hex color format like #3B82F6`;
            }
          }
          // Update business defaults if requested
          if (apply_to_defaults && (design_id || accent_color)) {
            const updateData = {
              updated_at: new Date().toISOString()
            };
            if (design_id) updateData.default_invoice_design = design_id;
            if (accent_color) updateData.default_accent_color = accent_color;
            const { error: settingsError } = await supabase.from('business_settings').update(updateData).eq('user_id', user_id);
            if (settingsError) {
              console.error('[update_invoice_appearance] Settings update error:', settingsError);
            }
          }
          // Update specific invoice if provided
          if (invoice_number) {
            // Find the invoice
            const findResult = await findInvoice(supabase, user_id, invoice_number);
            if (typeof findResult === 'string') {
              return findResult;
            }
            const targetInvoice = findResult;
            // Update invoice appearance
            const updateData = {};
            if (design_id) updateData.invoice_design = design_id;
            if (accent_color) updateData.accent_color = accent_color;
            const { error: invoiceError } = await supabase.from('invoices').update(updateData).eq('user_id', user_id).eq('id', targetInvoice.id);
            if (invoiceError) {
              console.error('[update_invoice_appearance] Invoice update error:', invoiceError);
              return `Error updating invoice appearance: ${invoiceError.message}`;
            }
            // Create updated invoice attachment
            const { data: updatedInvoice } = await supabase.from('invoices').select('*').eq('id', targetInvoice.id).single();
            const { data: lineItems } = await supabase.from('invoice_line_items').select('*').eq('invoice_id', targetInvoice.id).order('created_at', {
              ascending: true
            });
            let clientData = null;
            if (targetInvoice.client_id) {
              const { data: client } = await supabase.from('clients').select('*').eq('id', targetInvoice.client_id).single();
              clientData = client;
            }
            // 🚪 INVOICE GATE: Use "Last Invoice Wins" pattern
            const invoiceAttachment = {
              type: 'invoice',
              invoice_id: targetInvoice.id,
              invoice: updatedInvoice || targetInvoice,
              line_items: lineItems || [],
              client_id: targetInvoice.client_id,
              client: clientData
            };
            setLatestInvoice(invoiceAttachment);
            const changes = [];
            if (design_id) changes.push(`**${design_id}** design`);
            if (accent_color) changes.push(`**${accent_color}** color`);
            return `✅ Updated invoice ${targetInvoice.invoice_number} with ${changes.join(' and ')}.${reasoning ? `\n\n${reasoning}` : ''}\n\nLet me know if you'd like any other changes!`;
          } else {
            const changes = [];
            if (design_id) changes.push(`**${design_id}** design`);
            if (accent_color) changes.push(`**${accent_color}** color`);
            return `✅ Set ${changes.join(' and ')} as your default invoice appearance.${reasoning ? `\n\n${reasoning}` : ''}\n\nAll new invoices will use these settings.`;
          }
        } catch (error) {
          console.error('[update_invoice_appearance] Error:', error);
          return `Error updating invoice appearance: ${error.message}`;
        }
      }
      // Estimate/Quote Functions
      if (name === 'create_estimate') {
        // Check usage limits first
        const permission = await checkCanCreateItem(supabase, user_id);
        if (!permission.allowed) {
          await sendStatusUpdate('Free plan limit reached', '🔒');
          return JSON.stringify(permission);
        }
        await sendStatusUpdate('Creating estimate', '📄');
        const { client_name, client_email, client_phone, client_address, client_tax_number, line_items, valid_until_date, estimate_date, tax_percentage, notes, acceptance_terms, estimate_template, discount_type, discount_value } = parsedArgs;
        // Get user's terminology preference
        const { data: businessSettings } = await supabase.from('business_settings').select('estimate_terminology, default_estimate_template').eq('user_id', user_id).single();
        const terminology = businessSettings?.estimate_terminology || 'estimate';
        const termCapitalized = terminology.charAt(0).toUpperCase() + terminology.slice(1);
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
        const estimateDate = estimate_date || new Date().toISOString().split('T')[0];
        const validUntilDate = valid_until_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Generate estimate number using sequential numbering
        const estimate_number = await ReferenceNumberService.generateNextReference(supabase, user_id, 'estimate');
        // Use user's defaults
        const defaultTemplate = businessSettings?.default_estimate_template || 'clean';
        // 🚨 CRITICAL FIX: Check global payment settings like invoices do
        let paypalEnabled = false;
        let stripeEnabled = false;
        let bankTransferEnabled = false;
        try {
          const { data: paymentOptions } = await supabase.from('payment_options').select('paypal_enabled, stripe_enabled, bank_transfer_enabled').eq('user_id', user_id).maybeSingle(); // Use maybeSingle() to handle missing records
          if (paymentOptions) {
            paypalEnabled = paymentOptions.paypal_enabled || false;
            stripeEnabled = paymentOptions.stripe_enabled || false;
            bankTransferEnabled = paymentOptions.bank_transfer_enabled || false;
            console.log(`[create_estimate] Global payment settings: PayPal=${paypalEnabled}, Stripe=${stripeEnabled}, Bank=${bankTransferEnabled}`);
          } else {
            console.log(`[create_estimate] No payment options configured - all payment methods disabled`);
          }
        } catch (paymentError) {
          console.error('[create_estimate] Error loading payment options:', paymentError);
        // Error loading payment options (will disable all)
        }
        console.log(`[create_estimate] Creating ${terminology} with:`, {
          client_name,
          line_items_count: line_items.length,
          subtotal_amount,
          total_amount,
          estimate_number,
          valid_until: validUntilDate,
          payment_methods: {
            paypalEnabled,
            stripeEnabled,
            bankTransferEnabled
          }
        });
        // First, create or get client  
        let clientId = null;
        if (client_name) {
          // Try to find existing client
          const { data: existingClient, error: searchError } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('name', client_name.trim()).maybeSingle();
          if (searchError) {
            console.error('[create_estimate] Error searching for existing client:', searchError);
            return `Error searching for client: ${searchError.message}`;
          }
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
                console.error('[create_estimate] Client update error:', updateError);
              }
            }
          } else {
            // Create new client
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
              console.error('[create_estimate] Client creation error:', clientError);
              return `Error creating client: ${clientError.message}`;
            }
            clientId = newClient.id;
          }
        }
        // Create estimate in database - use global payment settings (like invoices)
        const { data: estimate, error: estimateError } = await supabase.from('estimates').insert({
          user_id: user_id,
          client_id: clientId,
          estimate_number,
          estimate_date: estimateDate,
          valid_until_date: validUntilDate,
          subtotal_amount: subtotal_amount,
          discount_type: discount_type || null,
          discount_value: discount_amount || 0,
          tax_percentage: tax_rate,
          total_amount,
          notes: notes || null,
          acceptance_terms: acceptance_terms || null,
          status: 'draft',
          estimate_template: estimate_template || defaultTemplate,
          // 🚨 CRITICAL FIX: Apply global payment settings (like invoices do)
          paypal_active: paypalEnabled,
          stripe_active: stripeEnabled,
          bank_account_active: bankTransferEnabled,
          created_at: new Date().toISOString()
        }).select().single();
        if (estimateError) {
          console.error('[create_estimate] Estimate creation error:', estimateError);
          return `Error creating ${terminology}: ${estimateError.message}`;
        }
        // Create line items
        const createdLineItems = [];
        for (const item of line_items){
          const quantity = item.quantity || 1;
          const { data: lineItem, error } = await supabase.from('estimate_line_items').insert({
            estimate_id: estimate.id,
            user_id: user_id,
            item_name: item.item_name,
            item_description: item.item_description || null,
            quantity: quantity,
            unit_price: item.unit_price,
            total_price: item.unit_price * quantity,
            created_at: new Date().toISOString()
          }).select().single();
          if (error) {
            console.error('[create_estimate] Line item error:', error);
          } else {
            createdLineItems.push(lineItem);
          }
        }
        // Fetch the full client data if we have a clientId
        let clientData = null;
        if (clientId) {
          const { data: fullClient } = await supabase.from('clients').select('*').eq('id', clientId).single();
          if (fullClient) {
            clientData = fullClient;
          }
        }
        // Store attachment for UI with complete data (like invoices)
        const estimateAttachment = await createEstimateAttachment(estimate, createdLineItems, clientData);
        setLatestEstimate(estimateAttachment);
        // 🚨 CONVERSATION MEMORY - Track that we just created this estimate
        ConversationMemory.setLastAction(user_id, 'created_estimate', {
          estimate_number: estimate_number,
          client_name: client_name,
          estimate_id: estimate.id,
          client_id: clientId,
          terminology: terminology
        });
        // Build success message
        const successMessage = `I've created ${terminology} ${estimate_number} for ${client_name} that totals $${total_amount.toFixed(2)}.\n\nValid until: ${validUntilDate}\n\nLet me know if you'd like any changes?`;
        return successMessage;
      }
      if (name === 'update_estimate') {
        const { estimate_identifier, client_name, client_email, client_phone, client_address, client_tax_number, estimate_date, valid_until_date, notes, acceptance_terms, status, tax_rate, discount_type, discount_value, estimate_template, estimate_number, line_items } = parsedArgs;
        // Get terminology
        const { data: businessSettings } = await supabase.from('business_settings').select('estimate_terminology').eq('user_id', user_id).single();
        const terminology = businessSettings?.estimate_terminology || 'estimate';
        console.log(`[update_estimate] Starting with:`, {
          estimate_identifier,
          ...parsedArgs
        });
        try {
          // Find the estimate
          let targetEstimate;
          if (estimate_identifier === 'latest') {
            // Get most recent estimate
            const { data: estimates, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).order('created_at', {
              ascending: false
            }).limit(1);
            if (error || !estimates || estimates.length === 0) {
              return `No ${terminology}s found.`;
            }
            targetEstimate = estimates[0];
          } else if (estimate_identifier.includes('EST') || estimate_identifier.includes('Q-')) {
            // Search by estimate number
            const { data: estimate, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).eq('estimate_number', estimate_identifier).single();
            if (error || !estimate) {
              return `${terminology} ${estimate_identifier} not found.`;
            }
            targetEstimate = estimate;
          } else {
            // Search by client name
            const { data: client, error: clientError } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('name', `%${estimate_identifier}%`).single();
            if (clientError || !client) {
              return `No client found with name matching "${estimate_identifier}".`;
            }
            // Get latest estimate for this client
            const { data: estimates, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).eq('client_id', client.id).order('created_at', {
              ascending: false
            }).limit(1);
            if (error || !estimates || estimates.length === 0) {
              return `No ${terminology}s found for ${estimate_identifier}.`;
            }
            targetEstimate = estimates[0];
          }
          console.log(`[update_estimate] Found ${terminology}:`, targetEstimate.id, targetEstimate.estimate_number);
          // Prepare update data for estimate
          const estimateUpdates = {};
          if (estimate_date !== undefined) estimateUpdates.estimate_date = estimate_date;
          if (valid_until_date !== undefined) estimateUpdates.valid_until_date = valid_until_date;
          if (notes !== undefined) estimateUpdates.notes = notes;
          if (acceptance_terms !== undefined) estimateUpdates.acceptance_terms = acceptance_terms;
          if (status !== undefined) estimateUpdates.status = status;
          if (tax_rate !== undefined) estimateUpdates.tax_percentage = tax_rate;
          if (discount_type !== undefined) estimateUpdates.discount_type = discount_type;
          if (discount_value !== undefined) estimateUpdates.discount_value = discount_value;
          if (estimate_template !== undefined) estimateUpdates.estimate_template = estimate_template;
          if (estimate_number !== undefined) estimateUpdates.estimate_number = estimate_number;
          // Update client information if provided
          let clientUpdates = {};
          if (client_name !== undefined) clientUpdates.name = client_name;
          if (client_email !== undefined) clientUpdates.email = client_email;
          if (client_phone !== undefined) clientUpdates.phone = client_phone;
          if (client_address !== undefined) clientUpdates.address_client = client_address;
          if (client_tax_number !== undefined) clientUpdates.tax_number = client_tax_number;
          // Update client if there are changes
          if (Object.keys(clientUpdates).length > 0 && targetEstimate.client_id) {
            const { error: clientError } = await supabase.from('clients').update(clientUpdates).eq('id', targetEstimate.client_id);
            if (clientError) {
              console.error('[update_estimate] Client update error:', clientError);
            }
          }
          // Handle line items replacement
          if (line_items && line_items.length > 0) {
            // Delete existing line items
            const { error: deleteError } = await supabase.from('estimate_line_items').delete().eq('estimate_id', targetEstimate.id).eq('user_id', user_id);
            if (deleteError) {
              console.error('[update_estimate] Delete line items error:', deleteError);
            }
            // Calculate totals
            let subtotal = 0;
            const lineItemsToCreate = line_items.map((item)=>{
              const itemTotal = (item.unit_price || 0) * (item.quantity || 1);
              subtotal += itemTotal;
              return {
                estimate_id: targetEstimate.id,
                user_id: user_id,
                item_name: item.item_name,
                item_description: item.item_description || null,
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                total_price: itemTotal,
                created_at: new Date().toISOString()
              };
            });
            // Create new line items
            const { error: lineItemsError } = await supabase.from('estimate_line_items').insert(lineItemsToCreate);
            if (lineItemsError) {
              console.error('[update_estimate] Line items update error:', lineItemsError);
              return `Error updating line items: ${lineItemsError.message}`;
            }
            // Recalculate totals
            const discountAmount = discount_value || targetEstimate.discount_value || 0;
            const discountType = discount_type || targetEstimate.discount_type;
            const taxRate = tax_rate !== undefined ? tax_rate : targetEstimate.tax_percentage || 0;
            let afterDiscount = subtotal;
            if (discountType === 'percentage' && discountAmount > 0) {
              afterDiscount = subtotal - subtotal * (discountAmount / 100);
            } else if (discountType === 'fixed' && discountAmount > 0) {
              afterDiscount = subtotal - discountAmount;
            }
            const taxAmount = afterDiscount * (taxRate / 100);
            const totalAmount = afterDiscount + taxAmount;
            // Update totals
            estimateUpdates.subtotal_amount = subtotal;
            estimateUpdates.total_amount = totalAmount;
          }
          // Update estimate if there are changes
          if (Object.keys(estimateUpdates).length > 0) {
            const { error: estimateError } = await supabase.from('estimates').update(estimateUpdates).eq('id', targetEstimate.id);
            if (estimateError) {
              console.error('[update_estimate] Estimate update error:', estimateError);
              return `Error updating ${terminology}: ${estimateError.message}`;
            }
          }
          // Get updated estimate for attachment
          const { data: updatedEstimate, error: estimateFetchError } = await supabase.from('estimates').select('*').eq('id', targetEstimate.id).single();
          if (estimateFetchError) {
            console.error('[update_estimate] Updated estimate fetch error:', estimateFetchError);
          }
          // Get line items
          const { data: allEstimateLineItems, error: lineItemsError } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', targetEstimate.id).order('created_at', {
            ascending: true
          });
          if (lineItemsError) {
            console.error('[update_estimate] Line items fetch error:', lineItemsError);
          }
          // Get client data for attachment
          let clientData = null;
          if (targetEstimate.client_id) {
            const { data: client, error: clientError } = await supabase.from('clients').select('*').eq('id', targetEstimate.client_id).single();
            if (!clientError && client) {
              clientData = client;
            }
          }
          // Store attachment with complete data (like invoices)
          const estimateAttachment = await createEstimateAttachment(updatedEstimate || targetEstimate, allEstimateLineItems || [], clientData);
          setLatestEstimate(estimateAttachment);
          // 🚨 CONVERSATION MEMORY - Track that we just updated this estimate
          ConversationMemory.setLastAction(user_id, 'updated_estimate', {
            estimate_number: targetEstimate.estimate_number,
            estimate_id: targetEstimate.id,
            client_id: targetEstimate.client_id,
            terminology: terminology
          });
          return `I've updated ${terminology} ${targetEstimate.estimate_number}. Let me know if you'd like any other changes!`;
        } catch (error) {
          console.error('[update_estimate] Error:', error);
          return `Error updating ${terminology}: ${error.message}`;
        }
      }
      if (name === 'add_estimate_line_item') {
        const { estimate_identifier, item_name, quantity = 1, unit_price, item_description } = parsedArgs;
        // Get terminology
        const { data: businessSettings } = await supabase.from('business_settings').select('estimate_terminology').eq('user_id', user_id).single();
        const terminology = businessSettings?.estimate_terminology || 'estimate';
        try {
          // Find the estimate (similar to update_estimate)
          let targetEstimate;
          if (estimate_identifier === 'latest') {
            const { data: estimates, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).order('created_at', {
              ascending: false
            }).limit(1);
            if (error || !estimates || estimates.length === 0) {
              return `No ${terminology}s found.`;
            }
            targetEstimate = estimates[0];
          } else {
            // Search by estimate number or client name
            // ... (similar logic to update_estimate)
            return `Please implement full search logic for ${terminology} identifier: ${estimate_identifier}`;
          }
          // Add the line item
          const { data: newLineItem, error: lineItemError } = await supabase.from('estimate_line_items').insert({
            estimate_id: targetEstimate.id,
            user_id: user_id,
            item_name: item_name,
            item_description: item_description || null,
            quantity: quantity,
            unit_price: unit_price,
            total_price: unit_price * quantity,
            created_at: new Date().toISOString()
          }).select().single();
          if (lineItemError) {
            console.error('[add_estimate_line_item] Error:', lineItemError);
            return `Error adding line item: ${lineItemError.message}`;
          }
          // Recalculate totals
          const { data: lineItemTotals, error: fetchError } = await supabase.from('estimate_line_items').select('total_price').eq('estimate_id', targetEstimate.id);
          if (!fetchError && lineItemTotals) {
            const subtotal = lineItemTotals.reduce((sum, item)=>sum + item.total_price, 0);
            // Apply discount and tax
            let afterDiscount = subtotal;
            if (targetEstimate.discount_type === 'percentage' && targetEstimate.discount_value > 0) {
              afterDiscount = subtotal - subtotal * (targetEstimate.discount_value / 100);
            } else if (targetEstimate.discount_type === 'fixed' && targetEstimate.discount_value > 0) {
              afterDiscount = subtotal - targetEstimate.discount_value;
            }
            const taxAmount = afterDiscount * (targetEstimate.tax_percentage / 100);
            const totalAmount = afterDiscount + taxAmount;
            // Update estimate totals
            const { error: updateError } = await supabase.from('estimates').update({
              subtotal_amount: subtotal,
              total_amount: totalAmount
            }).eq('id', targetEstimate.id);
            if (updateError) {
              console.error('[add_estimate_line_item] Update totals error:', updateError);
            }
          }
          // 🚨 CRITICAL: Get updated estimate and create attachment (like invoices do)
          const { data: updatedEstimate, error: estimateFetchError } = await supabase.from('estimates').select('*').eq('id', targetEstimate.id).single();
          // Get all line items for attachment
          const { data: allEstimateLineItems, error: lineItemsError } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', targetEstimate.id).order('created_at', {
            ascending: true
          });
          // Get client data
          let clientData = null;
          if (targetEstimate.client_id) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', targetEstimate.client_id).single();
            if (client) {
              clientData = client;
            }
          }
          // 🚨 CRITICAL: Create attachment with updated estimate (like invoices do)
          const estimateAttachment = await createEstimateAttachment(updatedEstimate || targetEstimate, allEstimateLineItems || [], clientData);
          setLatestEstimate(estimateAttachment);
          // 🚨 CONVERSATION MEMORY - Track that we just added an item to this estimate
          ConversationMemory.setLastAction(user_id, 'added_estimate_line_item', {
            estimate_number: targetEstimate.estimate_number,
            estimate_id: targetEstimate.id,
            client_id: targetEstimate.client_id,
            item_added: item_name,
            terminology: terminology
          });
          return `I've added "${item_name}" to ${terminology} ${targetEstimate.estimate_number}. Quantity: ${quantity}, Unit Price: $${unit_price}.`;
        } catch (error) {
          console.error('[add_estimate_line_item] Error:', error);
          return `Error adding line item: ${error.message}`;
        }
      }
      if (name === 'convert_estimate_to_invoice') {
        const { estimate_identifier, invoice_date, due_date, additional_notes } = parsedArgs;
        // Get terminology
        const { data: businessSettings } = await supabase.from('business_settings').select('estimate_terminology').eq('user_id', user_id).single();
        const terminology = businessSettings?.estimate_terminology || 'estimate';
        try {
          // Find the estimate (similar to update_estimate)
          let targetEstimate;
          if (estimate_identifier === 'latest') {
            const { data: estimates, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).order('created_at', {
              ascending: false
            }).limit(1);
            if (error || !estimates || estimates.length === 0) {
              return `No ${terminology}s found.`;
            }
            targetEstimate = estimates[0];
          } else {
            // Search by estimate number or client name
            // ... (similar logic to update_estimate)
            return `Please implement full search logic for ${terminology} identifier: ${estimate_identifier}`;
          }
          // Check if already converted
          if (targetEstimate.converted_to_invoice_id) {
            return `This ${terminology} has already been converted to an invoice.`;
          }
          // Get line items
          const { data: lineItems, error: lineItemsError } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', targetEstimate.id);
          if (lineItemsError) {
            console.error('[convert_estimate_to_invoice] Line items error:', lineItemsError);
            return `Error fetching line items: ${lineItemsError.message}`;
          }
          // Generate new invoice number
          const invoice_number = await ReferenceNumberService.generateNextReference(supabase, user_id, 'invoice');
          // Create dates
          const invoiceDate = invoice_date || new Date().toISOString().split('T')[0];
          const invoiceDueDate = due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          // Combine notes
          let finalNotes = targetEstimate.notes || '';
          if (additional_notes) {
            finalNotes += (finalNotes ? '\n\n' : '') + additional_notes;
          }
          // Create invoice
          const { data: invoice, error: invoiceError } = await supabase.from('invoices').insert({
            user_id: user_id,
            client_id: targetEstimate.client_id,
            invoice_number,
            invoice_date: invoiceDate,
            due_date: invoiceDueDate,
            subtotal_amount: targetEstimate.subtotal_amount,
            discount_type: targetEstimate.discount_type,
            discount_value: targetEstimate.discount_value,
            tax_percentage: targetEstimate.tax_percentage,
            invoice_tax_label: targetEstimate.estimate_tax_label || targetEstimate.tax_label,
            total_amount: targetEstimate.total_amount,
            notes: finalNotes,
            status: 'draft',
            invoice_design: targetEstimate.estimate_template,
            // 🔥 PRESERVE ALL SETTINGS from estimate  
            paypal_active: targetEstimate.paypal_active,
            stripe_active: targetEstimate.stripe_active,
            bank_account_active: targetEstimate.bank_account_active,
            accent_color: targetEstimate.accent_color,
            po_number: targetEstimate.po_number,
            custom_headline: targetEstimate.custom_headline,
            created_at: new Date().toISOString()
          }).select().single();
          if (invoiceError) {
            console.error('[convert_estimate_to_invoice] Invoice creation error:', invoiceError);
            return `Error creating invoice: ${invoiceError.message}`;
          }
          // Create invoice line items
          const invoiceLineItems = lineItems.map((item)=>({
              invoice_id: invoice.id,
              user_id: user_id,
              item_name: item.item_name,
              item_description: item.item_description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
              created_at: new Date().toISOString()
            }));
          const { error: lineItemsInsertError } = await supabase.from('invoice_line_items').insert(invoiceLineItems);
          if (lineItemsInsertError) {
            console.error('[convert_estimate_to_invoice] Line items insert error:', lineItemsInsertError);
          }
          // Update estimate status and link
          const { error: updateError } = await supabase.from('estimates').update({
            status: 'converted',
            converted_to_invoice_id: invoice.id
          }).eq('id', targetEstimate.id);
          if (updateError) {
            console.error('[convert_estimate_to_invoice] Estimate update error:', updateError);
          }
          // Get client data
          let clientData = null;
          if (targetEstimate.client_id) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', targetEstimate.client_id).single();
            if (client) {
              clientData = client;
            }
          }
          // Create invoice attachment
          const invoiceAttachment = await createInvoiceAttachment(invoice, lineItems.map((item)=>({
              ...item,
              invoice_id: invoice.id
            })), clientData);
          setLatestInvoice(invoiceAttachment);
          return `I've successfully converted ${terminology} ${targetEstimate.estimate_number} to invoice ${invoice_number}.\n\nThe invoice is ready to send to your client.`;
        } catch (error) {
          console.error('[convert_estimate_to_invoice] Error:', error);
          return `Error converting ${terminology} to invoice: ${error.message}`;
        }
      }
      if (name === 'search_estimates') {
        await sendStatusUpdate('Searching documents', '🔍');
        const { client_name, status, date_from, date_to, limit = 10 } = parsedArgs;
        // Get terminology
        const { data: businessSettings } = await supabase.from('business_settings').select('estimate_terminology').eq('user_id', user_id).single();
        const terminology = businessSettings?.estimate_terminology || 'estimate';
        const termPlural = terminology === 'quote' ? 'quotes' : 'estimates';
        try {
          let query = supabase.from('estimates').select(`
              *,
              client:clients(*)
            `).eq('user_id', user_id).order('created_at', {
            ascending: false
          }).limit(limit);
          // Apply filters
          if (status) {
            query = query.eq('status', status);
          }
          if (date_from) {
            query = query.gte('estimate_date', date_from);
          }
          if (date_to) {
            query = query.lte('estimate_date', date_to);
          }
          if (client_name) {
            // First find matching clients
            const { data: clients } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('name', `%${client_name}%`);
            if (clients && clients.length > 0) {
              const clientIds = clients.map((c)=>c.id);
              query = query.in('client_id', clientIds);
            } else {
              return `No ${termPlural} found for clients matching "${client_name}".`;
            }
          }
          const { data: estimates, error } = await query;
          if (error) {
            console.error('[search_estimates] Error:', error);
            return `Error searching ${termPlural}: ${error.message}`;
          }
          if (!estimates || estimates.length === 0) {
            return `No ${termPlural} found matching your criteria.`;
          }
          // Format results
          let result = `Found ${estimates.length} ${estimates.length === 1 ? terminology : termPlural}:\n\n`;
          estimates.forEach((est)=>{
            const clientName = est.client?.name || 'Unknown Client';
            const validUntil = new Date(est.valid_until_date).toLocaleDateString();
            result += `• ${est.estimate_number} - ${clientName} - $${est.total_amount.toFixed(2)} - Status: ${est.status} - Valid until: ${validUntil}\n`;
          });
          return result;
        } catch (error) {
          console.error('[search_estimates] Error:', error);
          return `Error searching ${termPlural}: ${error.message}`;
        }
      }
      if (name === 'update_estimate_payment_methods') {
        const { estimate_identifier, enable_stripe, enable_paypal, enable_bank_transfer } = parsedArgs;
        // Get terminology
        const { data: businessSettings } = await supabase.from('business_settings').select('estimate_terminology').eq('user_id', user_id).single();
        const terminology = businessSettings?.estimate_terminology || 'estimate';
        console.log('[update_estimate_payment_methods] Starting with:', {
          estimate_identifier,
          enable_stripe,
          enable_paypal,
          enable_bank_transfer
        });
        try {
          // Find the estimate (similar to update_estimate logic)
          let targetEstimate;
          if (estimate_identifier === 'latest') {
            const { data: estimates, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).order('created_at', {
              ascending: false
            }).limit(1);
            if (error || !estimates || estimates.length === 0) {
              return `No ${terminology}s found.`;
            }
            targetEstimate = estimates[0];
          } else if (estimate_identifier.includes('EST') || estimate_identifier.includes('Q-')) {
            // Search by estimate number
            const { data: estimate, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).eq('estimate_number', estimate_identifier).single();
            if (error || !estimate) {
              return `${terminology} ${estimate_identifier} not found.`;
            }
            targetEstimate = estimate;
          } else {
            // Search by client name
            const { data: client, error: clientError } = await supabase.from('clients').select('id').eq('user_id', user_id).ilike('name', `%${estimate_identifier}%`).single();
            if (clientError || !client) {
              return `No client found with name matching "${estimate_identifier}".`;
            }
            // Get latest estimate for this client
            const { data: estimates, error } = await supabase.from('estimates').select('*').eq('user_id', user_id).eq('client_id', client.id).order('created_at', {
              ascending: false
            }).limit(1);
            if (error || !estimates || estimates.length === 0) {
              return `No ${terminology}s found for ${estimate_identifier}.`;
            }
            targetEstimate = estimates[0];
          }
          console.log(`[update_estimate_payment_methods] Found ${terminology}:`, targetEstimate.id, targetEstimate.estimate_number);
          // Get payment options to check what's actually enabled (same logic as invoices)
          const { data: paymentOptions, error: paymentOptionsError } = await supabase.from('payment_options').select('stripe_enabled, paypal_enabled, bank_transfer_enabled').eq('user_id', user_id).single();
          if (paymentOptionsError) {
            console.error('[update_estimate_payment_methods] Payment options fetch error:', paymentOptionsError);
            return 'Error: Could not fetch payment options to validate payment methods';
          }
          console.log('[update_estimate_payment_methods] Payment options:', paymentOptions);
          let paymentUpdates = {};
          let message = `Updated payment methods for ${terminology} ${targetEstimate.estimate_number}:`;
          let skippedMethods = [];
          // Check each payment method - use same logic as update_payment_methods
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
            message += `\n\nSkipped methods: ${skippedMethods.join(', ')}`;
          }
          // Update the estimate if there are changes
          if (Object.keys(paymentUpdates).length > 0) {
            const { error: updateError } = await supabase.from('estimates').update(paymentUpdates).eq('id', targetEstimate.id);
            if (updateError) {
              console.error('[update_estimate_payment_methods] Update error:', updateError);
              return `Error updating payment methods: ${updateError.message}`;
            }
          }
          // Get updated estimate for attachment
          const { data: updatedEstimate } = await supabase.from('estimates').select('*').eq('id', targetEstimate.id).single();
          // Get line items
          const { data: allEstimateLineItems } = await supabase.from('estimate_line_items').select('*').eq('estimate_id', targetEstimate.id).order('created_at', {
            ascending: true
          });
          // Get client data
          let clientData = null;
          if (targetEstimate.client_id) {
            const { data: client } = await supabase.from('clients').select('*').eq('id', targetEstimate.client_id).single();
            if (client) {
              clientData = client;
            }
          }
          // Create attachment with updated estimate (like invoices do)
          const estimateAttachment = await createEstimateAttachment(updatedEstimate || targetEstimate, allEstimateLineItems || [], clientData);
          setLatestEstimate(estimateAttachment);
          // Track action in conversation memory
          ConversationMemory.setLastAction(user_id, 'updated_estimate_payments', {
            estimate_number: targetEstimate.estimate_number,
            estimate_id: targetEstimate.id,
            client_id: targetEstimate.client_id,
            terminology: terminology
          });
          return message;
        } catch (error) {
          console.error('[update_estimate_payment_methods] Error:', error);
          return `Error updating ${terminology} payment methods: ${error.message}`;
        }
      }
      return `Unknown function: ${name}`;
    };
    // 🚨 TIMEOUT FIX: Enhanced polling with longer timeouts for multi-step operations
    let runStatus = run;
    let attempts = 0;
    const maxAttempts = 150; // 2.5 minutes max for complex operations
    while(attempts < maxAttempts){
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log('[Assistants POC] Run status:', runStatus.status, `(attempt ${attempts + 1}/${maxAttempts})`);
      // No intermediate status updates - keep it clean
      if (runStatus.status === 'completed') {
        // Get final messages
        const messages = await openai.beta.threads.messages.list(thread.id);
        const assistantMessage = messages.data.filter((msg)=>msg.role === 'assistant').map((msg)=>{
          const textContent = msg.content.find((c)=>c.type === 'text');
          return textContent ? textContent.text.value : '';
        })[0] || 'No response generated';
        // Clean up request tracking
        if (globalThis.processingRequests) {
          globalThis.processingRequests.delete(deduplicationKey1);
          console.log('[Assistants POC] 🧹 Cleaned up successful request:', deduplicationKey1);
        }
        // 🚨 ATTACHMENT DEDUPLICATION SYSTEM
        // Remove duplicate invoice/estimate attachments when multiple functions modify the same item
        const deduplicateAttachments = (attachments)=>{
          if (!attachments || attachments.length === 0) return attachments;
          const seenItems = new Map(); // Map of "type:id" -> attachment
          const deduplicated = [];
          for (const attachment of attachments){
            if (!attachment.data) {
              // Keep non-data attachments as-is
              deduplicated.push(attachment);
              continue;
            }
            // Create unique key for invoices and estimates
            let uniqueKey = null;
            if (attachment.data.invoice_number) {
              uniqueKey = `invoice:${attachment.data.id}`;
            } else if (attachment.data.estimate_number) {
              uniqueKey = `estimate:${attachment.data.id}`;
            }
            if (uniqueKey) {
              // Track the latest version of each invoice/estimate
              seenItems.set(uniqueKey, attachment);
            } else {
              // Keep other attachment types as-is
              deduplicated.push(attachment);
            }
          }
          // Add all unique invoice/estimate attachments
          for (const attachment of seenItems.values()){
            deduplicated.push(attachment);
          }
          const duplicatesRemoved = attachments.length - deduplicated.length;
          if (duplicatesRemoved > 0) {
            console.log(`[Attachment Deduplication] Removed ${duplicatesRemoved} duplicate attachments`);
          }
          return deduplicated;
        };
        // 🚪 ATTACHMENT GATE: Return only the last invoice OR estimate (never both)
        const finalAttachments = [];
        if (lastInvoiceAttachment && lastEstimateAttachment) {
          // Both exist - prefer invoice (more recent action usually)
          finalAttachments.push(lastInvoiceAttachment);
          console.log('[Attachment Gate] Returning invoice over estimate:', lastInvoiceAttachment.invoice?.invoice_number || 'unknown');
        } else if (lastInvoiceAttachment) {
          finalAttachments.push(lastInvoiceAttachment);
          console.log('[Attachment Gate] Returning single invoice:', lastInvoiceAttachment.invoice?.invoice_number || 'unknown');
        } else if (lastEstimateAttachment) {
          finalAttachments.push(lastEstimateAttachment);
          console.log('[Attachment Gate] Returning single estimate:', lastEstimateAttachment.estimate?.estimate_number || 'unknown');
        } else {
          console.log('[Attachment Gate] No invoice or estimate to return');
        }
        // Frontend handles seamless transition to result - no final status needed
        // DEBUG: Log what statusUpdates we're about to send
        console.log('[DEBUG] Final statusUpdates being sent:', globalThis.statusUpdates);
        console.log('[DEBUG] StatusUpdates length:', (globalThis.statusUpdates || []).length);
        // Return JSON response compatible with current app
        return new Response(JSON.stringify({
          success: true,
          content: assistantMessage,
          attachments: finalAttachments,
          statusUpdates: globalThis.statusUpdates || [],
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
              attachments: finalAttachments,
              created_at: new Date(Date.now() + 5000).toISOString()
            }
          ],
          thread: {
            id: thread.id,
            user_id: user_id
          }
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      if (runStatus.status === 'requires_action') {
        console.log('[Assistants POC] Requires action - handling tool calls');
        // Frontend handles immediate status detection - no backend status needed
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
        attempts++; // Count this as an attempt
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
      ]; // Start fast, then slow
      const delayIndex = Math.min(attempts, delays.length - 1);
      await new Promise((resolve)=>setTimeout(resolve, delays[delayIndex] || 1000));
      attempts++;
    }
    // 🚨 TIMEOUT HANDLING: If we've exhausted all attempts without completion
    console.error('[Assistants POC] Request timed out after', maxAttempts, 'attempts (2.5 minutes)');
    // Try to get any partial response that might exist
    try {
      const messages = await openai.beta.threads.messages.list(thread.id);
      const assistantMessage = messages.data.filter((msg)=>msg.role === 'assistant').map((msg)=>{
        const textContent = msg.content.find((c)=>c.type === 'text');
        return textContent ? textContent.text.value : '';
      })[0];
      if (assistantMessage) {
        // Clean up request tracking
        if (globalThis.processingRequests) {
          globalThis.processingRequests.delete(deduplicationKey1);
          console.log('[Assistants POC] 🧹 Cleaned up timeout request with partial response:', deduplicationKey1);
        }
        // Apply same deduplication for timeout responses
        const deduplicateAttachments = (attachments)=>{
          if (!attachments || attachments.length === 0) return attachments;
          const seenItems = new Map();
          const deduplicated = [];
          for (const attachment of attachments){
            if (!attachment.data) {
              deduplicated.push(attachment);
              continue;
            }
            let uniqueKey = null;
            if (attachment.data.invoice_number) {
              uniqueKey = `invoice:${attachment.data.id}`;
            } else if (attachment.data.estimate_number) {
              uniqueKey = `estimate:${attachment.data.id}`;
            }
            if (uniqueKey) {
              seenItems.set(uniqueKey, attachment);
            } else {
              deduplicated.push(attachment);
            }
          }
          for (const attachment of seenItems.values()){
            deduplicated.push(attachment);
          }
          return deduplicated;
        };
        // 🚪 ATTACHMENT GATE: Apply "Last Wins" for timeout scenario too
        const timeoutFinalAttachments = [];
        if (lastInvoiceAttachment) {
          timeoutFinalAttachments.push(lastInvoiceAttachment);
        } else if (lastEstimateAttachment) {
          timeoutFinalAttachments.push(lastEstimateAttachment);
        }
        // Add timeout status
        await sendStatusUpdate('Timeout - operation incomplete', '⚠️');
        // Return partial response with timeout warning
        return new Response(JSON.stringify({
          success: true,
          content: `${assistantMessage}\n\n⚠️ Note: This operation took longer than expected and may have been partially completed.`,
          attachments: timeoutFinalAttachments,
          statusUpdates: globalThis.statusUpdates || [],
          timeout: true,
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
              attachments: timeoutFinalAttachments,
              created_at: new Date(Date.now() + 5000).toISOString()
            }
          ],
          thread: {
            id: thread.id,
            user_id: user_id
          }
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    } catch (partialError) {
      console.error('[Assistants POC] Error retrieving partial response:', partialError);
    }
    // No partial response available - return timeout error
    throw new Error(`Request timed out after 2.5 minutes. The operation may still be processing in the background.`);
  } catch (error) {
    console.error('[Assistants POC] Error:', error);
    // Add error status
    await sendStatusUpdate('Error occurred', '❌');
    // Clean up request tracking on error
    if (globalThis.processingRequests) {
      globalThis.processingRequests.delete(deduplicationKey);
      console.log('[Assistants POC] 🧹 Cleaned up error request:', deduplicationKey);
    }
    return new Response(JSON.stringify({
      error: error.message,
      statusUpdates: globalThis.statusUpdates || []
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

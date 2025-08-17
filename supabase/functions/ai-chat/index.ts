import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';
import OpenAI from 'https://deno.land/x/openai@v4.20.1/mod.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Initialize OpenAI
const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY')
});
// Custom function to make v2 API calls with proper headers
async function makeV2ApiCall(endpoint, method, body) {
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
// Initialize Supabase
const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { type, action, message, threadId, userId, userContext, runId, systemPrompt, history = [] } = await req.json();
    console.log('[AI-Chat] Processing request:', {
      type,
      action,
      userId
    });
    if (type === 'assistant') {
      switch(action){
        case 'create_thread':
          const thread = await makeV2ApiCall('/threads', 'POST', {
            metadata: {
              userId
            }
          });
          return new Response(JSON.stringify({
            success: true,
            thread
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        case 'send_message':
          if (!message || !threadId) {
            throw new Error('Message and threadId are required for send_message');
          }
          // Add message to thread
          await makeV2ApiCall(`/threads/${threadId}/messages`, 'POST', {
            role: 'user',
            content: message
          });
          console.log('🧠 Using client systemPrompt:', !!systemPrompt);
          console.log('🧵 History (client provided) count:', Array.isArray(history) ? history.length : 0);
          // Create run with assistant (use session assistant if systemPrompt provided)
          let assistantIdToUse = Deno.env.get('OPENAI_ASSISTANT_ID') || '';
          let tempAssistantId = '';
          if (systemPrompt) {
            const tempAssistant = await makeV2ApiCall('/assistants', 'POST', {
              name: 'Invoice AI Assistant (Session)',
              model: 'gpt-4o-mini',
              instructions: systemPrompt,
              tools: getRealInvoiceFunctions().map((func)=>({ type: 'function', function: { name: func.name, description: func.description, parameters: func.parameters } }))
            });
            tempAssistantId = tempAssistant.id;
            assistantIdToUse = tempAssistantId;
            console.log('[AI-Chat] Created session assistant with client prompt:', tempAssistantId);
          } else {
            assistantIdToUse = assistantIdToUse || await getOrCreateAssistant(userContext);
          }
          const run = await makeV2ApiCall(`/threads/${threadId}/runs`, 'POST', {
            assistant_id: assistantIdToUse,
            additional_instructions: buildContextInstructions(userContext)
          });
          // Wait for completion
          const result = await waitForRunCompletion(threadId, run.id, userId);
          // Cleanup session assistant
          if (tempAssistantId) {
            try { await makeV2ApiCall(`/assistants/${tempAssistantId}`, 'DELETE', {} as any); } catch (_e) {}
          }
          return new Response(JSON.stringify({
            success: true,
            result
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        case 'get_messages':
          if (!threadId) {
            throw new Error('ThreadId is required for get_messages');
          }
          const messages = await makeV2ApiCall(`/threads/${threadId}/messages`, 'GET');
          return new Response(JSON.stringify({
            success: true,
            messages: messages.data
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        case 'cancel_run':
          if (!threadId || !runId) {
            throw new Error('ThreadId and runId are required for cancel_run');
          }
          const cancelledRun = await makeV2ApiCall(`/threads/${threadId}/runs/${runId}/cancel`, 'POST');
          return new Response(JSON.stringify({
            success: true,
            run: cancelledRun
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        default:
          throw new Error(`Unsupported assistant action: ${action}`);
      }
    }
    throw new Error(`Unsupported request type: ${type}`);
  } catch (error) {
    console.error('[AI-Chat] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.toString()
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
// Get or create assistant with comprehensive prompt
async function getOrCreateAssistant(userContext) {
  // Try to get existing assistant from env
  const existingId = Deno.env.get('OPENAI_ASSISTANT_ID');
  if (existingId) {
    try {
      await makeV2ApiCall(`/assistants/${existingId}`, 'GET');
      return existingId;
    } catch  {
    // Assistant doesn't exist, create new one
    }
  }
  // Create new assistant with comprehensive instructions
  const assistant = await makeV2ApiCall('/assistants', 'POST', {
    name: "Invoice AI Assistant",
    model: "gpt-4o-mini",
    instructions: getComprehensivePrompt(userContext),
    tools: getRealInvoiceFunctions().map((func)=>({
        type: "function",
        function: {
          name: func.name,
          description: func.description,
          parameters: func.parameters
        }
      }))
  });
  console.log('[AI-Chat] Created new assistant:', assistant.id);
  return assistant.id;
}
// Build context instructions based on user context
function buildContextInstructions(userContext) {
  const instructions = [];
  if (userContext?.currency) {
    instructions.push(`CURRENCY: User's currency is ${userContext.currency} (${userContext.symbol}). Always use ${userContext.symbol} for prices.`);
  }
  if (userContext?.isFirstInvoice) {
    instructions.push(`FIRST INVOICE: This is the user's first invoice. Provide extra guidance and setup help.`);
  }
  if (!userContext?.hasLogo) {
    instructions.push(`LOGO GUIDANCE: User doesn't have a business logo. After invoice creation, suggest adding one.`);
  }
  return instructions.join(' ');
}
// Wait for run completion with tool calling support
async function waitForRunCompletion(threadId, runId, userId) {
  let run = await makeV2ApiCall(`/threads/${threadId}/runs/${runId}`, 'GET');
  while(run.status === 'queued' || run.status === 'in_progress'){
    await new Promise((resolve)=>setTimeout(resolve, 1000));
    run = await makeV2ApiCall(`/threads/${threadId}/runs/${runId}`, 'GET');
  }
  if (run.status === 'requires_action') {
    const toolCalls = run.required_action?.submit_tool_outputs?.tool_calls || [];
    const toolOutputs = [];
    for (const toolCall of toolCalls){
      try {
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const result = await executeInvoiceFunction(toolCall.function.name, functionArgs, userId);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify(result)
        });
      } catch (error) {
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: JSON.stringify({
            success: false,
            error: error.message
          })
        });
      }
    }
    await makeV2ApiCall(`/threads/${threadId}/runs/${runId}/submit_tool_outputs`, 'POST', {
      tool_outputs: toolOutputs
    });
    return await waitForRunCompletion(threadId, runId);
  }
  if (run.status === 'completed') {
    const messages = await makeV2ApiCall(`/threads/${threadId}/messages`, 'GET');
    const lastMessage = messages.data[0];
    return {
      content: lastMessage.content[0]?.text?.value || '',
      usage: run.usage,
      status: 'completed'
    };
  }
  return {
    content: 'I encountered an issue processing your request.',
    status: run.status,
    error: `Run ${run.status}`
  };
}
// Execute invoice functions using Supabase database
async function executeInvoiceFunction(functionName, args, userId) {
  console.log(`[AI-Chat] Executing function: ${functionName}`, args);
  try {
    switch(functionName){
      case 'create_invoice':
        return await createInvoice(args, userId);
      case 'check_usage_limits':
        return await checkUsageLimits(userId);
      case 'search_clients':
        return await searchClients(args);
      case 'get_business_settings':
        return await getBusinessSettings();
      case 'update_business_settings':
        return await updateBusinessSettings(args);
      case 'get_recent_invoices':
        return await getRecentInvoices(args);
      default:
        return {
          success: false,
          message: `Function ${functionName} not implemented`,
          error: `Unknown function: ${functionName}`
        };
    }
  } catch (error) {
    console.error(`[AI-Chat] Function execution error:`, error);
    return {
      success: false,
      message: `Error executing ${functionName}: ${error.message}`,
      error: error.message
    };
  }
}
// Basic function implementations
async function createInvoice(params, userId) {
  // 1) Usage limits (premium bypass)
  const usage = await checkUsageLimits(userId);
  if (!usage.success || usage.data?.canCreate === false) {
    return {
      success: false,
      message: usage.message || "You've reached your free plan limit of 3 items. Please upgrade to premium to continue.",
      error: 'Usage limit exceeded',
      showPaywall: usage.data?.isSubscribed ? false : true
    };
  }

  // 2) Find or create client
  const clientName = String(params.client_name || '').trim();
  let clientId: string | null = null;
  const { data: found } = await supabase
    .from('clients')
    .select('id, name, email')
    .eq('user_id', userId)
    .ilike('name', `%${clientName}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (found) {
    clientId = found.id;
  } else {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({
        user_id: userId,
        name: clientName,
        email: params.client_email || null,
        phone: params.client_phone || null,
        address_client: params.client_address || null
      })
      .select()
      .single();
    if (clientError) throw clientError;
    clientId = newClient.id;
  }

  // 3) Defaults (business/payment)
  let defaultTaxRate = 0;
  let defaultDesign = 'clean';
  let defaultAccentColor = '#1E40AF';
  let paypalEnabled = false, stripeEnabled = false, bankTransferEnabled = false;
  try {
    const { data: bs } = await supabase
      .from('business_settings')
      .select('default_tax_rate, auto_apply_tax, default_invoice_design, default_accent_color')
      .eq('user_id', userId)
      .maybeSingle();
    if (bs) {
      if (bs.auto_apply_tax && bs.default_tax_rate) defaultTaxRate = bs.default_tax_rate;
      if (bs.default_invoice_design) defaultDesign = bs.default_invoice_design;
      if (bs.default_accent_color) defaultAccentColor = bs.default_accent_color;
    }
  } catch {}
  try {
    const { data: po } = await supabase
      .from('payment_options')
      .select('paypal_enabled, stripe_enabled, bank_transfer_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (po) {
      paypalEnabled = !!po.paypal_enabled;
      stripeEnabled = !!po.stripe_enabled;
      bankTransferEnabled = !!po.bank_transfer_enabled;
    }
  } catch {}

  // 4) Compute totals
  const items = (params.line_items || []).map((it: any) => {
    const quantity = it.quantity && it.quantity > 0 ? it.quantity : 1;
    const unit = Number(it.unit_price) || 0;
    const total = quantity * unit;
    return { item_name: String(it.item_name || 'Item'), item_description: it.item_description || null, quantity, unit_price: unit, total_price: total };
  });
  const subtotal = items.reduce((s:number,i:any)=>s+(i.total_price||0),0);
  const taxPct = params.tax_percentage !== undefined ? Number(params.tax_percentage) : defaultTaxRate;
  const totalAmount = subtotal + (subtotal * (taxPct/100));

  // 5) Generate invoice number
  let nextNumber = 'INV-0001';
  try {
    const { data: last } = await supabase
      .from('invoices')
      .select('invoice_number, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.invoice_number) {
      const m = String(last.invoice_number).match(/(\d+)$/);
      if (m) {
        const n = String((parseInt(m[1]) + 1)).padStart(m[1].length, '0');
        nextNumber = last.invoice_number.replace(/\d+$/, n);
      }
    }
  } catch {}

  // 6) Insert invoice
  const { data: inv, error: invErr } = await supabase
    .from('invoices')
    .insert({
      user_id: userId,
      client_id: clientId,
      invoice_number: nextNumber,
      invoice_date: params.invoice_date || new Date().toISOString().split('T')[0],
      due_date: params.due_date || null,
      subtotal_amount: subtotal,
      discount_type: null,
      discount_value: 0,
      tax_percentage: taxPct,
      total_amount: totalAmount,
      notes: null,
      status: 'draft',
      stripe_active: stripeEnabled,
      bank_account_active: bankTransferEnabled,
      paypal_active: paypalEnabled,
      invoice_design: defaultDesign,
      accent_color: defaultAccentColor
    })
    .select()
    .single();
  if (invErr) throw invErr;

  // 7) Insert line items
  if (items.length) {
    const { error: liErr } = await supabase
      .from('invoice_line_items')
      .insert(items.map((it:any)=>({
        invoice_id: inv.id,
        user_id: userId,
        item_name: it.item_name,
        item_description: it.item_description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        total_price: it.total_price
      })));
    if (liErr) {
      await supabase.from('invoices').delete().eq('id', inv.id);
      throw liErr;
    }
  }

  const currencySymbol = '$'; // Optional: fetch from business settings if needed
  const summary = `Great! I’ve created invoice #${nextNumber} for ${clientName} totalling ${currencySymbol}${totalAmount.toFixed(2)}.\nLet me know if you need any changes.`;
  return {
    success: true,
    message: summary,
    data: { invoice: inv, client_id: clientId, line_items: items, calculations: { subtotal, tax: totalAmount - subtotal, total: totalAmount } },
    attachments: [{ type: 'invoice', invoice_id: inv.id, invoice_number: nextNumber, invoice: inv }]
  };
}

async function checkUsageLimits(userId) {
  try {
    // Read subscription
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    const isSubscribed = !!(profile?.subscription_tier && ['premium','grandfathered'].includes(profile.subscription_tier));
    if (isSubscribed) {
      return { success: true, data: { canCreate: true, isSubscribed: true }, message: 'Unlimited access.' };
    }
    // Count items for free users
    let totalItems = 0;
    try {
      const { count: invCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      const { count: estCount } = await supabase.from('estimates').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      totalItems = (invCount || 0) + (estCount || 0);
    } catch {}
    const remaining = Math.max(0, 3 - totalItems);
    if (totalItems >= 3) {
      return { success: true, data: { canCreate: false, isSubscribed: false, remaining: 0 }, message: "You've reached your free plan limit of 3 items." };
    }
    return { success: true, data: { canCreate: true, isSubscribed: false, remaining }, message: `You can create items. Remaining: ${remaining}` };
  } catch (e) {
    return { success: false, message: 'Failed to check usage limits.', error: String(e) };
  }
}
async function searchClients(params) {
  return {
    success: true,
    data: {
      clients: []
    },
    message: `No existing clients found for "${params.name}"`
  };
}
async function getBusinessSettings() {
  return {
    success: true,
    data: {
      settings: {}
    },
    message: "Business settings retrieved"
  };
}
async function updateBusinessSettings(params) {
  return {
    success: true,
    data: {
      settings: params
    },
    message: "Business settings updated"
  };
}
async function getRecentInvoices(params) {
  return {
    success: true,
    data: {
      invoices: []
    },
    message: "Recent invoices retrieved"
  };
}
// Use the comprehensive prompt from AssistantService
function getComprehensivePrompt(userContext) {
  const currencyInstruction = userContext ? `\n\nCURRENCY CONTEXT - CRITICAL:
The user's business currency is ${userContext.currency} (${userContext.symbol}). 
ALWAYS use ${userContext.symbol} when displaying prices, amounts, or totals.
NEVER use $ if the user's currency is different.
Examples:
• If user currency is GBP (£): "Total: £250" not "Total: $250"
• If user currency is EUR (€): "Total: €180" not "Total: $180"
• If user currency is USD ($): "Total: $150" is correct\n` : '';
  const firstInvoiceMode = userContext?.isFirstInvoice ? `\n\nFIRST INVOICE MODE - CRITICAL:
This user is creating their FIRST invoice! Use guided assistance:
• Be extra helpful and encouraging
• Use simple language and clear steps
• After successful invoice creation, offer logo guidance if they don't have one
• Celebrate their first invoice completion with "🎉 Congratulations on your first invoice!"\n` : '';
  const logoContext = userContext && !userContext.hasLogo ? `\n\nLOGO GUIDANCE - CRITICAL:
This user doesn't have a business logo. After creating their first invoice, suggest:
"I notice you don't have a business logo yet. Invoices with logos look more professional and build trust with clients. Would you like to add one? You can go to Settings → Business Profile → Add Logo to upload one."\n` : '';
  return `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.${currencyInstruction}${firstInvoiceMode}${logoContext}

ACT-FIRST DELIVERY MODE - CRITICAL:
• Default behavior: TAKE ACTION FIRST, THEN CLARIFY
• When asked to create or edit an invoice/estimate, perform the action immediately using sensible defaults
• If needed data is missing, assume reasonable defaults and create a DRAFT; then ask ONE follow-up question
• CLIENTS: Search for an existing client; if none found, AUTOMATICALLY create the client and proceed (do NOT ask "should I add them?")
• If exactly one strong match exists, use it without asking. If multiple ambiguous matches exist, pick the best match and proceed; afterwards, ask if they meant a different client
• LINE ITEMS: If price is missing, create with quantity 1 and unit_price 0, then ask for the price after showing the draft
• DATES: Default invoice_date to today and due_date to payment_terms_days or 30 days
• Be transparent post-action: "I created invoice #123 for Jane Doe with a placeholder price. Want me to set the price or send it?"

RESPONSE STYLE:
• Keep responses brief and to the point
• Be warm but not verbose
• Use 1-2 sentences when possible
• Prefer acting first; ask ONE follow-up question only if needed
• NEVER use emojis in responses
• Use **text** for emphasis instead of emojis

FREE PLAN LIMITATIONS - CRITICAL:
• Users on the free plan can only create 3 items total (invoices + estimates combined)
• MANDATORY: ALWAYS call check_usage_limits function BEFORE attempting to create any invoice or estimate
• The check_usage_limits function will tell you if the user can create items and how many they have left
• If check_usage_limits indicates the user cannot create (canCreate: false), DO NOT attempt to create items
• Instead, politely explain: "You've reached your free plan limit of 3 items. You'll need to upgrade to a premium plan to continue creating invoices and estimates."
• Premium users have unlimited access - the function will indicate this

CREATION WORKFLOW - MANDATORY:
When a user asks to create an invoice or estimate:
1. FIRST: Call check_usage_limits to verify if creation is allowed
2. If canCreate is false: Inform user about the limit and suggest upgrading
3. If canCreate is true: Proceed with creation and inform user of remaining items
4. NEVER skip the check_usage_limits step

You have access to comprehensive invoice management functions. Use them to help users accomplish their business tasks efficiently.`;
}
// Real invoice functions from the original system
function getRealInvoiceFunctions() {
  return [
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
              required: [
                "item_name",
                "unit_price"
              ]
            },
            minItems: 1
          }
        },
        required: [
          "client_name",
          "line_items"
        ]
      }
    },
    {
      name: "check_usage_limits",
      description: "Check if user can create more invoices/estimates based on their plan",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "search_clients",
      description: "Search for existing clients by name",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Client name to search for"
          }
        },
        required: [
          "name"
        ]
      }
    },
    {
      name: "get_business_settings",
      description: "Get current business settings including tax rates, currency, and business information",
      parameters: {
        type: "object",
        properties: {}
      }
    },
    {
      name: "update_business_settings",
      description: "Update business settings like name, address, email, phone, website",
      parameters: {
        type: "object",
        properties: {
          business_name: {
            type: "string"
          },
          business_address: {
            type: "string"
          },
          business_email: {
            type: "string"
          },
          business_phone: {
            type: "string"
          },
          business_website: {
            type: "string"
          }
        }
      }
    },
    {
      name: "get_recent_invoices",
      description: "Get recent invoices",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            default: 5,
            description: "Number of recent invoices to retrieve"
          }
        }
      }
    }
  ];
}

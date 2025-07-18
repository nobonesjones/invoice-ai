import OpenAI from 'openai';
import { supabase } from '@/config/supabase';
import { INVOICE_FUNCTIONS } from '@/services/invoiceFunctions';
import { MemoryService } from '@/services/memoryService';

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY as string,
  dangerouslyAllowBrowser: true
});

export interface AssistantThread {
  id: string;
  user_id: string;
  openai_thread_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  metadata: any;
}

export interface AssistantMessage {
  id: string;
  thread_id: string;
  openai_message_id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments: any[];
  created_at: string;
}

export interface AssistantRunResult {
  content: string;
  attachments: any[];
  tool_outputs?: any[];
  status: 'completed' | 'requires_action' | 'failed' | 'in_progress';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AssistantService {
  private static assistantId: string | null = null;
  private static isInitialized = false;
  private static assistantPromise: Promise<string> | null = null; // Cache the initialization promise

  // Initialize the assistant (create or get existing)
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log('[AssistantService] Initializing assistant...');
      const startTime = Date.now();
      
      // Try to get existing assistant or create new one
      this.assistantId = await this.getOrCreateAssistant();
      this.isInitialized = true;
      
      console.log(`[AssistantService] Assistant initialized in ${Date.now() - startTime}ms:`, this.assistantId);
    } catch (error) {
      console.error('[AssistantService] Failed to initialize:', error);
      throw error;
    }
  }

  // Create or get existing assistant
  private static async getOrCreateAssistant(): Promise<string> {
    // Use cached promise to avoid duplicate initialization
    if (this.assistantPromise) {
      return this.assistantPromise;
    }

    this.assistantPromise = this.createAssistant();
    return this.assistantPromise;
  }

  // Create new assistant (separated for caching)
  private static async createAssistant(): Promise<string> {
    console.log('[AssistantService] Creating new assistant...');
    
    const assistant = await openai.beta.assistants.create({
      name: "Invoice AI Assistant",
      instructions: await this.getSystemInstructions(), // Use base instructions for assistant creation
      model: "gpt-4o-mini", // Keep original model for Assistants API
      tools: this.convertFunctionsToTools()
      // Note: We explicitly only provide our custom tools - no code_interpreter or file_search
    });
    
    console.log('🔧 ASSISTANT TOOLS DEBUG:', assistant.tools?.map(t => ({ type: t.type, name: t.function?.name })));

    console.log('[AssistantService] Assistant created successfully');
    return assistant.id;
  }

  // Convert invoice functions to OpenAI Assistant tools format
  private static convertFunctionsToTools(): any[] {
    return INVOICE_FUNCTIONS.map(func => ({
      type: "function",
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters
      }
    }));
  }

  // Enhanced system instructions for Assistant
  private static async getSystemInstructions(userId?: string, currencyContext?: { currency: string; symbol: string }): Promise<string> {
    const currencyInstruction = currencyContext 
      ? `\n\nCURRENCY CONTEXT - CRITICAL:
The user's business currency is ${currencyContext.currency} (${currencyContext.symbol}). 
ALWAYS use ${currencyContext.symbol} when displaying prices, amounts, or totals.
NEVER use $ if the user's currency is different.
Examples:
• If user currency is GBP (£): "Total: £250" not "Total: $250"
• If user currency is EUR (€): "Total: €180" not "Total: $180"
• If user currency is USD ($): "Total: $150" is correct\n`
      : '';

    const baseInstructions = `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.${currencyInstruction}

RESPONSE STYLE:
• Keep responses brief and to the point
• Be warm but not verbose
• Use 1-2 sentences when possible
• Ask ONE question at a time if info is missing
• NEVER use emojis in responses
• Use **text** for emphasis instead of emojis

CAPABILITIES:
• Create/search/edit invoices, estimates, and clients
• Update existing invoices and estimates by adding/removing line items
• Convert estimates to invoices when accepted
• Delete invoices, estimates, and clients permanently
• Duplicate invoices, estimates, and clients for recurring work
• Mark invoices paid, send invoices
• Business insights and analytics

EDITING RECENTLY CREATED DOCUMENTS - CRITICAL:
When a user asks to modify/edit/change/update a document you just created:
• For INVOICES: ALWAYS use edit_recent_invoice function
• For ESTIMATES: ALWAYS use edit_recent_estimate function
• Common editing requests: "add an item", "remove something", "change the price", "update the date"
• NEVER create a new document when the user wants to modify an existing one
• These functions will automatically find the most recent document to edit

DATABASE STRUCTURE - CRITICAL UNDERSTANDING:
There are TWO SEPARATE data sources for different settings:

1. **BUSINESS SETTINGS** (business_settings table):
   - Business name, address, email, phone, website
   - Tax settings (default_tax_rate, tax_name, auto_apply_tax)
   - Currency and region settings
   - Business logo, tax number
   - Invoice design preferences
   - Function: get_business_settings

2. **PAYMENT OPTIONS** (payment_options table):
   - PayPal configuration (paypal_enabled, paypal_email)
   - Stripe configuration (stripe_enabled)
   - Bank transfer configuration (bank_transfer_enabled, bank_details)
   - Invoice payment terms/notes (invoice_terms_notes)
   - Function: get_payment_options

CRITICAL: When users ask about "payment details", "payment methods", "payment settings", "PayPal settings", "bank transfer details" - they want PAYMENT OPTIONS, NOT business settings!

FUNCTION SELECTION EXAMPLES:
User: "What payment methods are enabled?" → use get_payment_options
User: "Show me my PayPal settings" → use get_payment_options  
User: "What are my payment details?" → use get_payment_options
User: "Is bank transfer set up?" → use get_payment_options
User: "What's my business address?" → use get_business_settings
User: "What's my tax rate?" → use get_business_settings
User: "Show me my business info" → use get_business_settings

NEVER use get_business_settings when they're asking about payment methods!

INTELLIGENT PRICE PARSING - CRITICAL:
Be smart about extracting prices from natural language. Users often provide prices in these formats:
• "garden cleaning for 200" → item: garden cleaning, price: $200
• "web design for 500" → item: web design, price: $500  
• "consultation at 150" → item: consultation, price: $150
• "logo design 300" → item: logo design, price: $300
• "SEO work for $75/hour, 10 hours" → item: SEO work, price: $75, quantity: 10

ONLY ask for missing prices if you truly cannot extract any pricing information from their message.

CLIENT OUTSTANDING AMOUNTS - CRITICAL:
When users ask "how much does X owe me" or "what's X's balance" or "X wants to pay, how much":
1. Use get_client_outstanding_amount function with the client name
2. This will find ALL unpaid invoices for that client  
3. Shows total outstanding amount and breakdown of individual invoices

EXAMPLES:
User: "Peter Autos wants to pay all his invoices, how much does he owe me?"
✅ Good: Use get_client_outstanding_amount(client_name: "Peter Autos")
❌ Avoid: Using search_invoices with complex filters

User: "How much does Peter owe me?"
✅ Good: Use get_client_outstanding_amount(client_name: "Peter")
❌ Avoid: Using search_invoices

User: "What's Peter Autos' balance?"
✅ Good: Use get_client_outstanding_amount(client_name: "Peter Autos")
❌ Avoid: Using search_invoices

VALIDATE BEFORE FUNCTION CALLS:

FOR CREATE_INVOICE:
- Client name ✓
- At least one line item with BOTH name AND price (extracted from natural language) ✓
If you can extract prices: CREATE THE INVOICE immediately
If truly missing prices: "I have the client name and items, but I need the price for each item. Can you tell me the price for [list items]?"

FOR UPDATE_INVOICE_LINE_ITEMS:
- Invoice number or recent context ✓
- Line items with names AND prices (extracted from natural language) ✓
If you can extract prices: UPDATE THE INVOICE immediately
If truly missing prices: "I can add those items to the invoice, but I need to know the price for each one. What's the cost for [list items]?"

EXAMPLES OF SMART PARSING:
User: "Make invoice for John with garden cleaning for 200 and leaf blowing for 120"
✅ Good: Extract garden cleaning ($200), leaf blowing ($120) → CREATE INVOICE
❌ Bad: Ask for unit prices when they're clearly provided

User: "Add consulting work for 150 to latest invoice"  
✅ Good: Extract consulting work ($150) → UPDATE INVOICE
❌ Bad: Ask "what's the price for consulting work?"

INVOICE CREATION WORKFLOW - CRITICAL:
When users request to create an invoice:

STEP 1: ALWAYS search for client first
1. Extract client name from request
2. Use search_clients function with the client name
3. Wait for search results

STEP 2A: If client(s) found
- Show client card(s) with "I found [number] client(s) matching '[name]'. Is this the client you want to invoice?"
- Wait for user confirmation before proceeding
- After confirmation, create invoice with confirmed client

STEP 2B: If no client found  
- "I couldn't find a client named '[name]' in your system. I'll add them as a new client first."
- Create client with basic info from request
- Show client card and ask if they want to add more details
- Then create the invoice

EXAMPLES:
User: "Create invoice for John Smith, $500 for hedge trimming"
✅ Good Flow:
   1. search_clients(name: "John Smith")
   2. IF FOUND: "I found 1 client matching 'John Smith'. Is this the client? [client card]"
   3. User confirms: "Yes"
   4. create_invoice(client_name: "John Smith", line_items: [{"item_name": "hedge trimming", "unit_price": 500}])
   
User: "Bill Sarah for logo design $750"
✅ Good Flow:
   1. search_clients(name: "Sarah")
   2. IF NOT FOUND: "I couldn't find a client named 'Sarah'. I'll add them first."
   3. create_client(name: "Sarah")
   4. "Added Sarah as new client. Do you have email/phone to add?"
   5. create_invoice(client_name: "Sarah", line_items: [{"item_name": "logo design", "unit_price": 750}])

❌ Avoid: Creating invoice without searching clients first
❌ Avoid: Creating invoice without client confirmation when multiple matches

CLIENT CREATION WORKFLOW - CRITICAL:
When users want to create a client (not invoice):
1. IMMEDIATELY create client with just the name using create_client
2. Show confirmation and client card
3. Ask if they want to add more details (only missing fields)

EXAMPLES:
User: "Add new client Ben"
✅ Good Response: 
   1. Call create_client with name: "Ben"
   2. "Great! I added Ben as a new client. [client card shows]
      Would you like to add any more details?
      • Email?
      • Phone number? 
      • Address?"

CLIENT UPDATE WORKFLOW - CRITICAL:
When users want to update/edit client details:
1. Use update_client function with the client name or ID
2. Only update the fields they specify
3. Show what was updated

EXAMPLES:
User: "Update Ben's address to 123 Main St"
✅ Good Response:
   1. Call update_client with client_name: "Ben", address: "123 Main St"
   2. Show updated client card and confirmation

User: "Change Sarah's email to new@email.com"
✅ Good Response:
   1. Call update_client with client_name: "Sarah", email: "new@email.com"
   2. Confirm the update

INVOICE WORKFLOW - CRITICAL:
When users want to add items to invoices:
1. FIRST: Use get_recent_invoices or search_invoices to check for existing invoices
2. If adding to existing invoice: Use update_invoice_line_items with action="add"
3. If no relevant invoice exists: Create new invoice with create_invoice
4. PRESERVE CLIENT INFORMATION: When updating invoices, never modify client data unless explicitly asked

INVOICE UPDATE CAPABILITIES - CRITICAL:
When users want to update invoice details, use update_invoice_details for:
• Invoice reference number: "Change invoice number to INV-025"
• Invoice date: "Update invoice date to 2024-03-15"  
• Due date: "Set due date to 2024-04-15"
• Tax percentage: "Set tax to 20%"
• Notes: "Add note: Payment terms 30 days"

⚠️ CRITICAL CLIENT PRESERVATION RULE ⚠️
NEVER CHANGE CLIENT INFORMATION UNLESS EXPLICITLY REQUESTED:
- Do NOT pass client_name parameter to update_invoice_details unless user specifically says "change client to X"
- Do NOT pass client_email parameter unless user specifically says "change client email to X"
- When user says "edit invoice", "update invoice", "change due date", "duplicate invoice" - PRESERVE the existing client
- Only change client when user explicitly says: "change client to...", "update client on invoice to...", "switch client to..."
- If unsure whether user wants to change client, ASK for clarification

Examples of what should NOT change client:
❌ "Edit the invoice and change the due date" → Do NOT change client
❌ "Duplicate this invoice" → Do NOT change client (unless they specify new_client_name)
❌ "Update invoice with new tax rate" → Do NOT change client
❌ "Change the invoice date" → Do NOT change client

Examples of what SHOULD change client:
✅ "Change the client on invoice INV-001 to John Smith"
✅ "Update the invoice client to ABC Corp"
✅ "Switch the client to Sarah Johnson"

CLIENT VS INVOICE ADDRESS WORKFLOW - CRITICAL:
When users ask to "update address on invoice" or "change invoice address":
1. This means update the CLIENT's address (addresses are stored on clients, not invoices)
2. Use update_client function to change the client's address
3. Optionally use get_invoice_details to show how this affects the invoice
4. Example: "I've updated [Client Name]'s address. This will appear on all their invoices."

NEVER try to update invoice address directly - invoices get address from the client record.

TAX SETTINGS - CRITICAL:
• User's business profile contains default tax settings (rate, auto-apply)
• When creating invoices, tax is automatically applied from their business settings
• Users can override with specific tax rates if needed
• If user has auto_apply_tax enabled, their default_tax_rate is used automatically
• Examples: "Create invoice with 15% tax" (overrides default) vs "Create invoice for John" (uses business default)

CONVERSATIONAL CONTEXT UNDERSTANDING - CRITICAL:
When you've just created an invoice and asked "Would you like to send this invoice or make any changes?", and the user responds with requests like:
• "Enable bank transfer as well"
• "Add PayPal payments" 
• "Turn on Stripe"
• "Make some changes"
• "Update the invoice"

These are CLEARLY referring to the invoice you just created. DO NOT assume they want to create a new client or invoice. Use the invoice context from the conversation.

PAYMENT METHODS WORKFLOW - CRITICAL:
Payment methods (Stripe, PayPal, Bank Transfer) are configured at TWO levels:
1. USER LEVEL: Payment methods must first be enabled in the user's Payment Options settings
2. INVOICE LEVEL: Each individual invoice can have payment methods enabled/disabled

IMPORTANT: Payment methods are stored on INVOICES, not on CLIENTS.

SMART PAYMENT SETUP - NEW CAPABILITY:
When users want to enable payment methods, I can now SET THEM UP COMPLETELY:

FOR PAYPAL:
- If user says "enable PayPal" or "add PayPal payments", ask for their PayPal email
- Use setup_paypal_payments function to enable PayPal AND collect email
- This will enable it in their settings AND optionally on a specific invoice
- Example: "What's your PayPal email address?" → setup_paypal_payments(paypal_email: "user@example.com", invoice_number: "INV-001")

FOR BANK TRANSFER:
- If user says "enable bank transfer" or "add bank transfer", ask for their bank details
- Use setup_bank_transfer_payments function to enable bank transfer AND collect details
- This will enable it in their settings AND optionally on a specific invoice
- Example: "Please provide your bank details (bank name, account number, sort code/routing):" → setup_bank_transfer_payments(bank_details: "...", invoice_number: "INV-001")

FOR STRIPE/CARD PAYMENTS:
- I CANNOT set up Stripe as it requires connecting to Stripe's system
- If user asks for card payments/Stripe, explain: "Card payments require connecting your Stripe account, which needs to be done manually in your Payment Options settings. I can help set up PayPal and bank transfer payments though!"

PAYMENT METHOD VARIATIONS:
Users might say any of these - they all mean the same thing:
• "PayPal" = "PayPal payments" = "PayPal checkout" = "pay with PayPal"
• "Bank transfer" = "bank payment" = "wire transfer" = "direct transfer" = "bank account"
• "Card payments" = "credit card" = "Stripe" = "online payments" = "pay with card"

WORKFLOW EXAMPLES:
User: "Enable bank transfer as well" (after creating invoice)
✅ Response: "I can set up bank transfer payments for you. What are your bank account details? (Include bank name, account number, sort code/routing number)"
✅ Then: setup_bank_transfer_payments(bank_details: "provided details", invoice_number: "recent invoice")

User: "Add PayPal to this invoice"  
✅ Response: "I can set up PayPal payments. What's your PayPal email address?"
✅ Then: setup_paypal_payments(paypal_email: "user@example.com", invoice_number: "recent invoice")

User: "Can I accept card payments?"
✅ Response: "Card payments require connecting your Stripe account, which needs to be done manually in Payment Options. However, I can set up PayPal and bank transfer payments right now if you'd like!"

ALREADY CONFIGURED SCENARIOS:
If payment method is already enabled in settings but user wants to enable on invoice:
✅ Use update_invoice_payment_methods to just enable it on the specific invoice
✅ Example: "PayPal is already set up with your email. I'll enable it on this invoice."

DELETE AND DUPLICATE WORKFLOWS - CRITICAL:

DELETION FUNCTIONS:
Use these functions when users want to permanently remove data:

**DELETE INVOICE:**
- Use delete_invoice function for requests like "delete invoice INV-123"
- Requires invoice_number parameter
- Deletes invoice, line items, and activities permanently
- Cannot be undone - explain this to user
- Example: User: "Delete invoice INV-456" → delete_invoice(invoice_number: "INV-456")

**DELETE CLIENT:**
- Use delete_client function for requests like "delete John Smith"
- Requires client_name AND confirm_delete_invoices: true
- WILL DELETE ALL INVOICES for that client too!
- This is EXTREMELY destructive - make sure user understands
- Example: User: "Delete client ABC Corp and all their invoices" → delete_client(client_name: "ABC Corp", confirm_delete_invoices: true)

DUPLICATION FUNCTIONS:
Use these functions for recurring work or similar clients/invoices:

**DUPLICATE INVOICE:**
- Use duplicate_invoice function for "copy invoice", "duplicate INV-123", "create recurring invoice"
- Requires invoice_number parameter
- Optional: new_client_name (to change client), new_invoice_date (to update date)
- Creates new invoice with new number, always as draft status
- Copies all line items, payment settings, tax settings
- Example: User: "Duplicate invoice INV-123 for Sarah" → duplicate_invoice(invoice_number: "INV-123", new_client_name: "Sarah")

**DUPLICATE CLIENT:**
- Use duplicate_client function for "copy client", "create client like John", "duplicate ABC Corp"
- Requires client_name AND new_client_name parameters
- Copies all client details (email, phone, address, tax number, notes)
- Useful for similar businesses or multiple locations
- Example: User: "Create a client like ABC Corp called ABC Corp East" → duplicate_client(client_name: "ABC Corp", new_client_name: "ABC Corp East")

SAFETY WARNINGS FOR DELETIONS:
- Always explain that deletions cannot be undone
- For delete_client, explicitly mention it will delete ALL their invoices
- Ask for confirmation if the request seems unclear
- Show what will be deleted (number of invoices, total value)

DUPLICATION USE CASES:
- Monthly/recurring invoices: duplicate last month's invoice
- Similar clients: duplicate existing client with new name
- Template invoices: duplicate and change client
- Seasonal work: duplicate previous year's invoice with new date

AUTONOMOUS BEHAVIOR:
• Use conversation memory to avoid re-asking for info
• When context is clear, take action without confirmation
• Fill reasonable gaps (e.g., if user says "create invoice for John" and John exists, use his details)
• For requests like "add X to invoice", search recent invoices first
• Remember invoice numbers from conversation context
• ALWAYS validate required info before function calls
• CREATE CLIENTS IMMEDIATELY when given a name, then ask for more details
• PARSE PRICES INTELLIGENTLY from natural language
• UNDERSTAND CONVERSATIONAL CONTEXT - if just discussing an invoice, assume follow-up requests refer to that invoice

INVOICE UPDATE EXAMPLES:
User: "Add a $200 consultation to the James Williams invoice"
✅ Good: Search recent invoices → Find INV-004 for James → Use update_invoice_line_items
❌ Avoid: Creating new invoice

User: "Update invoice INV-003 with web design for $500"
✅ Good: Use update_invoice_line_items with specific invoice number

MISSING INFO EXAMPLES (only when truly missing):
User: "Create invoice for Ben with SEO work, keywords, websites" (no prices mentioned)
✅ Good: "I can create an invoice for Ben with those services, but I need the price for each item. What's the cost for the SEO work, keywords, and websites?"
❌ Avoid: Calling create_invoice without prices and getting an error

User: "Add consulting to the latest invoice" (no price mentioned)
✅ Good: "I can add consulting to your latest invoice. What's the price for the consulting work?"
❌ Avoid: Calling update_invoice_line_items without a price

Use tools to take action. Reference previous conversation naturally.`;

    // Enhance with user-specific patterns if available
    if (userId) {
      try {
        const enhancedInstructions = await MemoryService.generateEnhancedPrompt(userId, baseInstructions);
        return enhancedInstructions;
      } catch (error) {
        console.error('[AssistantService] Error loading user patterns:', error);
        return baseInstructions;
      }
    }

    return baseInstructions;
  }

  // Get or create thread for user
  static async getOrCreateThread(userId: string): Promise<string> {
    try {
      // Check if user has an active thread
      const { data: existingThread, error } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (existingThread && !error) {
        console.log('[AssistantService] Using existing thread:', existingThread.openai_thread_id);
        return existingThread.openai_thread_id;
      }

      // Create new OpenAI thread
      const thread = await openai.beta.threads.create({
        metadata: { userId }
      });

      // Save thread mapping to database
      const { data: savedThread, error: saveError } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          openai_thread_id: thread.id,
          title: 'New Chat',
          is_active: true,
          metadata: {}
        })
        .select()
        .single();

      if (saveError) {
        console.error('[AssistantService] Failed to save thread:', saveError);
        throw saveError;
      }

      console.log('[AssistantService] Created new thread:', thread.id);
      return thread.id;
    } catch (error) {
      console.error('[AssistantService] Error in getOrCreateThread:', error);
      throw error;
    }
  }

  // Send message and get response
  static async sendMessage(userId: string, message: string, currencyContext?: { currency: string; symbol: string }, statusCallback?: (status: string) => void): Promise<AssistantRunResult> {
    try {
      statusCallback?.('SuperAI is initializing...');
      
      // Ensure assistant is initialized
      await this.initialize();

      if (!this.assistantId) {
        throw new Error('Assistant not initialized');
      }

      statusCallback?.('SuperAI is connecting...');

      // Get or create thread
      let threadId = await this.getOrCreateThread(userId);

      // Check for active runs and clean them up
      try {
        const runs = await openai.beta.threads.runs.list(threadId, { limit: 5 });
        const activeRun = runs.data.find(run => 
          run.status === 'in_progress' || 
          run.status === 'queued' || 
          run.status === 'requires_action'
        );

        if (activeRun) {
          console.log(`[AssistantService] Found active run ${activeRun.id}, attempting to cancel...`);
          try {
            await openai.beta.threads.runs.cancel(threadId, activeRun.id);
            console.log(`[AssistantService] Successfully cancelled run ${activeRun.id}`);
            
            // Wait longer for the cancellation to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Double-check that it's actually cancelled
            const checkRun = await openai.beta.threads.runs.retrieve(threadId, activeRun.id);
            if (checkRun.status === 'in_progress' || checkRun.status === 'queued' || checkRun.status === 'requires_action') {
              console.log(`[AssistantService] Run ${activeRun.id} still active after cancel, creating new thread...`);
              threadId = await this.createNewThread(userId);
            }
          } catch (cancelError) {
            console.error(`[AssistantService] Failed to cancel run ${activeRun.id}:`, cancelError);
            
            // If we can't cancel, create a new thread
            console.log('[AssistantService] Creating new thread due to stuck run...');
            threadId = await this.createNewThread(userId);
          }
        }
      } catch (checkError) {
        console.error('[AssistantService] Error checking for active runs:', checkError);
        // If we can't check, try creating a new thread to be safe
        console.log('[AssistantService] Creating new thread due to check error...');
        threadId = await this.createNewThread(userId);
      }

      statusCallback?.('SuperAI is processing your message...');

      // Add user message to thread
      await openai.beta.threads.messages.create(threadId, {
        role: "user",
        content: message
      });

      // Save message to our database for UI display
      await this.saveMessageToDatabase(userId, threadId, 'user', message);

      statusCallback?.('SuperAI is generating response...');

      // Create and run the assistant with currency context if provided
      const runOptions: any = {
        assistant_id: this.assistantId
      };

      // Add currency-specific instructions if provided
      if (currencyContext) {
        runOptions.additional_instructions = `CURRENCY CONTEXT: User's business currency is ${currencyContext.currency} (${currencyContext.symbol}). ALWAYS use ${currencyContext.symbol} when displaying prices, amounts, or totals. Never use $ if the user's currency is different.`;
      }

      const run = await openai.beta.threads.runs.create(threadId, runOptions);

      // Wait for completion and handle tool calls
      const result = await this.waitForRunCompletion(threadId, run.id, userId, statusCallback);

      // Save assistant response to database
      if (result.content) {
        await this.saveMessageToDatabase(userId, threadId, 'assistant', result.content, result.attachments);
      }

      // Extract and save memory facts from the conversation
      try {
        const messages = await this.getThreadMessages(userId);
        if (messages.length >= 2) { // At least user message + assistant response
          const recentMessages = messages.slice(-2); // Get last 2 messages
          await MemoryService.extractFactsFromConversation(userId, threadId, recentMessages);
        }
      } catch (memoryError) {
        console.error('[AssistantService] Error extracting memory facts:', memoryError);
        // Don't fail the conversation if memory extraction fails
      }

      return result;
    } catch (error) {
      console.error('[AssistantService] Error in sendMessage:', error);
      
      // If it's the "active run" error, try creating a new thread
      if (error instanceof Error && error.message.includes('while a run') && error.message.includes('is active')) {
        console.log('[AssistantService] Attempting recovery with new thread...');
        try {
          const newThreadId = await this.createNewThread(userId);
          
          // Try sending the message again with the new thread
          await openai.beta.threads.messages.create(newThreadId, {
            role: "user",
            content: message
          });

          await this.saveMessageToDatabase(userId, newThreadId, 'user', message);

          const recoveryRunOptions: any = {
            assistant_id: this.assistantId
          };

          if (currencyContext) {
            recoveryRunOptions.additional_instructions = `CURRENCY CONTEXT: User's business currency is ${currencyContext.currency} (${currencyContext.symbol}). ALWAYS use ${currencyContext.symbol} when displaying prices, amounts, or totals. Never use $ if the user's currency is different.`;
          }

          const run = await openai.beta.threads.runs.create(newThreadId, recoveryRunOptions);

          const result = await this.waitForRunCompletion(newThreadId, run.id, userId);

          if (result.content) {
            await this.saveMessageToDatabase(userId, newThreadId, 'assistant', result.content, result.attachments);
          }

          return result;
        } catch (recoveryError) {
          console.error('[AssistantService] Recovery attempt failed:', recoveryError);
        }
      }
      
      throw error;
    }
  }

  // Wait for run completion and handle tool calls
  private static async waitForRunCompletion(
    threadId: string, 
    runId: string, 
    userId: string,
    statusCallback?: (status: string) => void
  ): Promise<AssistantRunResult> {
    let run = await openai.beta.threads.runs.retrieve(threadId, runId);
    let collectedAttachments: any[] = [];
    
    // Faster polling with timeout
    const maxWaitTime = 30000; // 30 seconds max
    const pollInterval = 500; // Check every 500ms instead of 1000ms
    const startTime = Date.now();
    
    while (run.status === 'in_progress' || run.status === 'queued') {
      // Check for timeout
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Assistant response timeout');
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      run = await openai.beta.threads.runs.retrieve(threadId, runId);
      
      // Log progress for debugging
      console.log(`[AssistantService] Run status: ${run.status}`);
    }

    if (run.status === 'requires_action' && run.required_action?.type === 'submit_tool_outputs') {
      // Handle tool calls
      const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
      
      // Determine status message based on function being called
      if (toolCalls.length > 0) {
        const functionName = toolCalls[0].function.name;
        if (functionName.includes('create_invoice')) {
          statusCallback?.('SuperAI is creating invoice...');
        } else if (functionName.includes('search')) {
          statusCallback?.('SuperAI is searching...');
        } else if (functionName.includes('update')) {
          statusCallback?.('SuperAI is updating...');
        } else if (functionName.includes('client')) {
          statusCallback?.('SuperAI is processing client data...');
        } else {
          statusCallback?.('SuperAI is executing action...');
        }
      }
      
      const { toolOutputs, attachments } = await this.handleToolCalls(
        toolCalls,
        userId
      );

      // Collect attachments from tool calls
      collectedAttachments = attachments;

      statusCallback?.('SuperAI is completing response...');

      // Submit tool outputs
      run = await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
        tool_outputs: toolOutputs
      });

      // Wait for completion after tool execution
      const result = await this.waitForRunCompletion(threadId, runId, userId, statusCallback);
      // Merge attachments from recursive calls
      result.attachments = [...collectedAttachments, ...result.attachments];
      return result;
    }

    if (run.status === 'completed') {
      // Get the assistant's response
      const messages = await openai.beta.threads.messages.list(threadId, {
        order: 'desc',
        limit: 1
      });

      const lastMessage = messages.data[0];
      if (lastMessage && lastMessage.role === 'assistant') {
        const content = lastMessage.content
          .filter(c => c.type === 'text')
          .map(c => c.type === 'text' ? c.text.value : '')
          .join('\n');

        return {
          content,
          attachments: collectedAttachments,
          status: 'completed',
          usage: run.usage ? {
            prompt_tokens: run.usage.prompt_tokens || 0,
            completion_tokens: run.usage.completion_tokens || 0,
            total_tokens: run.usage.total_tokens || 0
          } : undefined
        };
      }
    }

    if (run.status === 'failed') {
      throw new Error(`Assistant run failed: ${run.last_error?.message || 'Unknown error'}`);
    }

    return {
      content: 'I apologize, I could not process your request.',
      attachments: collectedAttachments,
      status: 'failed'
    };
  }

  // Sanitize JSON string to fix common AI-generated JSON issues
  private static sanitizeJsonString(jsonString: string): string {
    if (!jsonString || typeof jsonString !== 'string') {
      return '{}';
    }

    let cleaned = jsonString.trim();
    
    try {
      // Fix the specific malformed pattern: {"key":"value"},"other_key":value}
      // This happens when AI generates an extra } in the middle
      
      // Pattern 1: Remove extra } before comma and more JSON
      cleaned = cleaned.replace(/\}(\s*,\s*"[^"]+"\s*:\s*[^}]+)\}/g, '$1}');
      
      // Pattern 2: Fix array ending with }} pattern
      cleaned = cleaned.replace(/\]\}\s*,/g, '],');
      
      // Remove trailing commas before closing braces/brackets
      cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
      
      // Remove trailing commas at end of objects/arrays
      cleaned = cleaned.replace(/,(\s*})/g, '$1');
      cleaned = cleaned.replace(/,(\s*])/g, '$1');
      
      // Fix common quote issues
      cleaned = cleaned.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3'); // Add quotes to unquoted keys
      
      // Remove extra commas
      cleaned = cleaned.replace(/,,+/g, ','); // Multiple commas to single comma
      
      // Fix trailing commas at the very end
      cleaned = cleaned.replace(/,\s*$/, '');
      
      return cleaned;
    } catch (error) {
      console.error('[AssistantService] Error in sanitizeJsonString:', error);
      return '{}';
    }
  }

  // Handle tool calls from the assistant
  private static async handleToolCalls(toolCalls: any[], userId: string): Promise<{ toolOutputs: any[], attachments: any[] }> {
    const { InvoiceFunctionService } = await import('@/services/invoiceFunctions');
    
    console.log(`[AssistantService] Processing ${toolCalls.length} tool calls...`);
    const startTime = Date.now();
    const attachments: any[] = [];
    
    // Process tool calls in parallel when possible
    const outputs = await Promise.all(toolCalls.map(async (toolCall) => {
      try {
        const functionName = toolCall.function.name;
        let functionArgs;
        
        // Safely parse function arguments with comprehensive error handling
        try {
          const rawArgs = toolCall.function.arguments;
          console.log(`[AssistantService] Raw arguments for ${functionName}:`, rawArgs);
          
          // First try parsing as-is
          try {
            functionArgs = JSON.parse(rawArgs);
            console.log(`[AssistantService] Successfully parsed JSON on first try`);
          } catch (firstError) {
            console.log(`[AssistantService] First parse failed, trying sanitization...`);
            
            // Try with sanitization
            const sanitizedArgs = this.sanitizeJsonString(rawArgs);
            console.log(`[AssistantService] Sanitized arguments:`, sanitizedArgs);
            
            try {
              functionArgs = JSON.parse(sanitizedArgs);
              console.log(`[AssistantService] Successfully parsed sanitized JSON`);
            } catch (secondError) {
              console.error(`[AssistantService] Both parsing attempts failed for ${functionName}`);
              console.error(`[AssistantService] Original error:`, (firstError as Error).message);
              console.error(`[AssistantService] Sanitized error:`, (secondError as Error).message);
              console.error(`[AssistantService] Raw args:`, rawArgs);
              console.error(`[AssistantService] Sanitized args:`, sanitizedArgs);
              
              // Last resort: try to extract basic parameters manually
              functionArgs = this.extractBasicParams(rawArgs, functionName);
              console.log(`[AssistantService] Using extracted params:`, functionArgs);
            }
          }
        } catch (outerError) {
          console.error(`[AssistantService] Outer parsing error for ${functionName}:`, outerError);
          functionArgs = {};
        }

        console.log(`[AssistantService] Executing tool: ${functionName} with args:`, functionArgs);
        console.log('🔧 TOOL CALL DEBUG:', {
          toolName: functionName,
          isEstimateFunction: functionName.includes('estimate'),
          availableFunctions: ['create_estimate', 'search_estimates', 'get_estimate_by_number', 'get_recent_estimates', 'convert_estimate_to_invoice', 'edit_recent_estimate', 'edit_recent_invoice']
        });
        const toolStartTime = Date.now();

        // Execute the function
        const result = await InvoiceFunctionService.executeFunction(
          functionName,
          functionArgs,
          userId
        );

        console.log(`[AssistantService] Tool ${functionName} completed in ${Date.now() - toolStartTime}ms`);

        // Extract attachments from successful function results
        console.log('=== ASSISTANT SERVICE ATTACHMENT DEBUG ===');
        console.log('Function name:', functionName);
        console.log('Result success:', result.success);
        console.log('Result data:', result.data);
        console.log('Result attachments:', result.attachments);
        console.log('Result keys:', Object.keys(result));
        
        if (result.success && result.attachments && result.attachments.length > 0) {
          console.log('✅ Adding attachments from result.attachments');
          attachments.push(...result.attachments);
        } else if (result.success && result.data) {
          console.log('⚠️ Falling back to result.data');
          attachments.push(result.data);
        }

        return {
          tool_call_id: toolCall.id,
          output: JSON.stringify(result)
        };
      } catch (error) {
        console.error('[AssistantService] Tool call error:', error);
        return {
          tool_call_id: toolCall.id,
          output: JSON.stringify({ 
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Tool execution failed'
          })
        };
      }
    }));

    console.log(`[AssistantService] All tools completed in ${Date.now() - startTime}ms`);
    return { toolOutputs: outputs, attachments };
  }

  // Last resort parameter extraction for common functions
  private static extractBasicParams(rawArgs: string, functionName: string): any {
    console.log(`[AssistantService] Attempting manual parameter extraction for ${functionName}`);
    
    try {
      // For create_invoice, try to extract basic parameters
      if (functionName === 'create_invoice') {
        const params: any = {};
        
        // Extract client_name
        const clientNameMatch = rawArgs.match(/"client_name"\s*:\s*"([^"]+)"/);
        if (clientNameMatch) params.client_name = clientNameMatch[1];
        
        // Extract line_items array (improved to handle multiple items)
        const lineItemsMatch = rawArgs.match(/"line_items"\s*:\s*\[([^\]]+)\]/);
        if (lineItemsMatch) {
          try {
            // Try to parse multiple line items by finding all item objects
            const itemsContent = lineItemsMatch[1];
            const items = [];
            
            // Use regex to find all item objects within the array
            const itemRegex = /\{[^}]*"item_name"\s*:\s*"([^"]+)"[^}]*"unit_price"\s*:\s*(\d+(?:\.\d+)?)[^}]*\}/g;
            let match;
            
            while ((match = itemRegex.exec(itemsContent)) !== null) {
              items.push({
                item_name: match[1],
                unit_price: parseFloat(match[2]),
                quantity: 1
              });
            }
            
            // Fallback to single item extraction if no matches found
            if (items.length === 0) {
              const itemNameMatch = itemsContent.match(/"item_name"\s*:\s*"([^"]+)"/);
              const unitPriceMatch = itemsContent.match(/"unit_price"\s*:\s*(\d+(?:\.\d+)?)/);
              
              if (itemNameMatch && unitPriceMatch) {
                items.push({
                  item_name: itemNameMatch[1],
                  unit_price: parseFloat(unitPriceMatch[1]),
                  quantity: 1
                });
              }
            }
            
            if (items.length > 0) {
              params.line_items = items;
            }
          } catch (parseError) {
            console.log('[AssistantService] Error parsing multiple line items, trying single item fallback');
            // Original single-item fallback
            const itemNameMatch = lineItemsMatch[1].match(/"item_name"\s*:\s*"([^"]+)"/);
            const unitPriceMatch = lineItemsMatch[1].match(/"unit_price"\s*:\s*(\d+(?:\.\d+)?)/);
            
            if (itemNameMatch && unitPriceMatch) {
              params.line_items = [{
                item_name: itemNameMatch[1],
                unit_price: parseFloat(unitPriceMatch[1]),
                quantity: 1
              }];
            }
          }
        }
        
        return params;
      }
      
      // For create_client
      if (functionName === 'create_client') {
        const params: any = {};
        
        const nameMatch = rawArgs.match(/"name"\s*:\s*"([^"]+)"/);
        if (nameMatch) params.name = nameMatch[1];
        
        const emailMatch = rawArgs.match(/"email"\s*:\s*"([^"]+)"/);
        if (emailMatch) params.email = emailMatch[1];
        
        return params;
      }
      
      return {};
    } catch (error) {
      console.error('[AssistantService] Manual extraction failed:', error);
      return {};
    }
  }

  // Save message to database for UI display
  private static async saveMessageToDatabase(
    userId: string,
    threadId: string,
    role: 'user' | 'assistant',
    content: string,
    attachments: any[] = []
  ): Promise<void> {
    try {
      // Get our thread record
      const { data: thread } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('openai_thread_id', threadId)
        .eq('user_id', userId)
        .single();

      if (!thread) {
        console.error('[AssistantService] Thread not found for saving message');
        return;
      }

      // Save message for UI display
      await supabase
        .from('chat_message_display')
        .insert({
          thread_id: thread.id,
          role,
          content,
          attachments: attachments || []
        });

      // Update thread timestamp
      await supabase
        .from('chat_threads')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', thread.id);
    } catch (error) {
      console.error('[AssistantService] Error saving message to database:', error);
    }
  }

  // Get thread messages for UI display
  static async getThreadMessages(userId: string): Promise<AssistantMessage[]> {
    try {
      const { data: thread } = await supabase
        .from('chat_threads')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (!thread) return [];

      const { data: messages } = await supabase
        .from('chat_message_display')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at', { ascending: true });

      return messages || [];
    } catch (error) {
      console.error('[AssistantService] Error getting thread messages:', error);
      return [];
    }
  }

  // Get current thread for user
  static async getCurrentThread(userId: string): Promise<AssistantThread | null> {
    try {
      const { data: thread } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      return thread;
    } catch (error) {
      return null;
    }
  }

  // Check if service is configured
  static isConfigured(): boolean {
    const hasApiKey = !!process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    console.log('[AssistantService] Configuration check:', {
      hasApiKey,
      apiKeyLength: process.env.EXPO_PUBLIC_OPENAI_API_KEY?.length || 0,
      apiKeyPrefix: process.env.EXPO_PUBLIC_OPENAI_API_KEY?.substring(0, 7) || 'undefined'
    });
    return hasApiKey;
  }

  // Create a new thread and deactivate old ones
  private static async createNewThread(userId: string): Promise<string> {
    try {
      // Deactivate all existing threads for this user
      await supabase
        .from('chat_threads')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Create new OpenAI thread
      const thread = await openai.beta.threads.create({
        metadata: { userId }
      });

      // Save thread mapping to database
      const { data: savedThread, error: saveError } = await supabase
        .from('chat_threads')
        .insert({
          user_id: userId,
          openai_thread_id: thread.id,
          title: 'New Chat',
          is_active: true,
          metadata: {}
        })
        .select()
        .single();

      if (saveError) {
        console.error('[AssistantService] Failed to save new thread:', saveError);
        throw saveError;
      }

      console.log('[AssistantService] Created new thread after recovery:', thread.id);
      return thread.id;
    } catch (error) {
      console.error('[AssistantService] Error creating new thread:', error);
      throw error;
    }
  }

  // Clear current thread (for chat clearing functionality)
  static async clearCurrentThread(userId: string): Promise<void> {
    try {
      console.log('[AssistantService] Clearing current thread for user:', userId);
      
      // Get current active thread
      const { data: currentThread } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (currentThread) {
        // Deactivate the thread in database
        await supabase
          .from('chat_threads')
          .update({ is_active: false })
          .eq('id', currentThread.id);

        // Clear all display messages for this thread
        await supabase
          .from('chat_message_display')
          .delete()
          .eq('thread_id', currentThread.id);

        console.log('[AssistantService] Successfully cleared thread:', currentThread.openai_thread_id);
      }
    } catch (error) {
      console.error('[AssistantService] Error clearing current thread:', error);
      throw error;
    }
  }
}
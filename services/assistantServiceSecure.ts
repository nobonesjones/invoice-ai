// Secure Assistant Service using Supabase Edge Functions
// This keeps OpenAI API keys on the server, not in the client app

import { supabase } from '@/config/supabase';
import { INVOICE_FUNCTIONS } from '@/services/invoiceFunctions';
import { MemoryService } from '@/services/memoryService';

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

export class AssistantServiceSecure {
  private static assistantId: string | null = null;
  private static isInitialized = false;
  private static assistantPromise: Promise<string> | null = null;

  // Call edge function for assistant actions
  private static async callEdgeFunction(action: string, data: any): Promise<any> {
    const { data: result, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        api_type: 'assistants',
        action,
        data
      }
    });

    if (error) {
      throw new Error(`Edge Function error: ${error.message}`);
    }

    return result;
  }

  // Initialize the assistant (create or get existing)
  static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const startTime = Date.now();
      
      // Try to get existing assistant or create new one
      this.assistantId = await this.getOrCreateAssistant();
      this.isInitialized = true;
      
      console.log('✅ Assistant initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize assistant:', error);
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

  // Create new assistant via edge function
  private static async createAssistant(): Promise<string> {
    console.log('🤖 Creating new assistant via edge function...');
    
    const assistant = await this.callEdgeFunction('create_assistant', {
      name: "Invoice AI Assistant",
      instructions: await this.getSystemInstructions(),
      model: "gpt-4o-mini",
      tools: this.convertFunctionsToTools()
    });

    console.log('✅ Assistant created successfully:', assistant.id);
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
  private static async getSystemInstructions(userId?: string, userContext?: { currency: string; symbol: string; isFirstInvoice: boolean; hasLogo: boolean }): Promise<string> {
    const currencyInstruction = userContext 
      ? `\n\nCURRENCY CONTEXT - CRITICAL:
The user's business currency is ${userContext.currency} (${userContext.symbol}). 
ALWAYS use ${userContext.symbol} when displaying prices, amounts, or totals.
NEVER use $ if the user's currency is different.
Examples:
• If user currency is GBP (£): "Total: £250" not "Total: $250"
• If user currency is EUR (€): "Total: €180" not "Total: $180"
• If user currency is USD ($): "Total: $150" is correct\n`
      : '';

    const firstInvoiceMode = userContext?.isFirstInvoice
      ? `\n\nFIRST INVOICE MODE - CRITICAL:
This user is creating their FIRST invoice! Use guided assistance:
• Be extra helpful and encouraging
• Use simple language and clear steps
• After successful invoice creation, offer logo guidance if they don't have one
• Celebrate their first invoice completion with "🎉 Congratulations on your first invoice!"\n`
      : '';

    const logoContext = userContext && !userContext.hasLogo
      ? `\n\nLOGO GUIDANCE - CRITICAL:
This user doesn't have a business logo. After creating their first invoice, suggest:
"I notice you don't have a business logo yet. Invoices with logos look more professional and build trust with clients. Would you like to add one? You can go to Settings → Business Profile → Add Logo to upload one."\n`
      : '';

    const baseInstructions = `You are an AI assistant for invoice and estimate management. Be friendly, concise, and helpful.${currencyInstruction}${firstInvoiceMode}${logoContext}

Your primary capabilities include creating, updating, searching, and managing invoices, estimates, and clients. You can also handle business settings, payment configurations, and provide analytics insights.

Always prioritize user satisfaction by providing immediate, actionable results. When users request changes, show them the updated information right away.

Use tools to take action. Reference previous conversation naturally.`;

    // Enhance with user-specific patterns if available
    if (userId) {
      try {
        const enhancedInstructions = await MemoryService.generateEnhancedPrompt(userId, baseInstructions);
        return enhancedInstructions;
      } catch (error) {
        console.error('Error loading user patterns:', error);
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
        console.log('📱 Using existing thread:', existingThread.openai_thread_id);
        return existingThread.openai_thread_id;
      }

      // Create new OpenAI thread via edge function
      const thread = await this.callEdgeFunction('create_thread', {
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
        console.error('❌ Failed to save thread:', saveError);
        throw saveError;
      }

      console.log('✅ Created new thread:', thread.id);
      return thread.id;
    } catch (error) {
      console.error('❌ Error in getOrCreateThread:', error);
      throw error;
    }
  }

  // Send message and get response
  static async sendMessage(userId: string, message: string, userContext?: { currency: string; symbol: string; isFirstInvoice: boolean; hasLogo: boolean }, statusCallback?: (status: string) => void): Promise<AssistantRunResult> {
    try {
      statusCallback?.('SuperAI is initializing...');
      
      // Ensure assistant is initialized
      await this.initialize();

      if (!this.assistantId) {
        console.error('❌ Assistant not initialized');
        return {
          content: 'I apologize, but there was an issue initializing the AI assistant. Please try again.',
          attachments: [],
          status: 'failed'
        };
      }

      statusCallback?.('SuperAI is connecting...');

      // Get or create thread
      let threadId = await this.getOrCreateThread(userId);

      // Check for active runs and clean them up
      try {
        const runs = await this.callEdgeFunction('list_runs', { thread_id: threadId, limit: 5 });
        const activeRun = runs.data?.find((run: any) => 
          run.status === 'in_progress' || 
          run.status === 'queued' || 
          run.status === 'requires_action'
        );

        if (activeRun) {
          console.log('🔄 Found active run, attempting to cancel:', activeRun.id);
          try {
            await this.callEdgeFunction('cancel_run', { 
              thread_id: threadId, 
              run_id: activeRun.id 
            });
            
            // Wait for the cancellation to process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Double-check that it's actually cancelled
            const checkRun = await this.callEdgeFunction('get_run', { 
              thread_id: threadId, 
              run_id: activeRun.id 
            });
            
            if (checkRun.status === 'in_progress' || checkRun.status === 'queued' || checkRun.status === 'requires_action') {
              console.log('⚠️ Run still active after cancel, creating new thread');
              threadId = await this.createNewThread(userId);
            }
          } catch (cancelError) {
            console.log('⚠️ Failed to cancel run, creating new thread');
            threadId = await this.createNewThread(userId);
          }
        }
      } catch (checkError) {
        console.log('⚠️ Error checking for active runs, creating new thread');
        threadId = await this.createNewThread(userId);
      }

      statusCallback?.('SuperAI is processing your message...');

      // Add user message to thread
      await this.callEdgeFunction('add_message', {
        thread_id: threadId,
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

      // Add user context instructions if provided
      if (userContext) {
        const contextInstructions = [];
        
        // Currency context
        contextInstructions.push(`CURRENCY CONTEXT: User's business currency is ${userContext.currency} (${userContext.symbol}). ALWAYS use ${userContext.symbol} when displaying prices, amounts, or totals. Never use $ if the user's currency is different.`);
        
        // First invoice mode
        if (userContext.isFirstInvoice) {
          contextInstructions.push(`FIRST INVOICE MODE: This user is creating their FIRST invoice! Be extra helpful, encouraging, use simple language, and celebrate their completion.`);
        }
        
        // Logo guidance
        if (!userContext.hasLogo) {
          contextInstructions.push(`LOGO GUIDANCE: User doesn't have a business logo. After invoice creation, suggest adding one: "I notice you don't have a business logo yet. Invoices with logos look more professional. You can add one in Settings → Business Profile → Add Logo."`);
        }
        
        runOptions.additional_instructions = contextInstructions.join(' ');
      }

      const run = await this.callEdgeFunction('create_run', {
        thread_id: threadId,
        ...runOptions
      });

      // Wait for completion and handle tool calls
      const result = await this.waitForRunCompletion(threadId, run.id, userId, statusCallback);

      // Save assistant response to database
      if (result.content) {
        await this.saveMessageToDatabase(userId, threadId, 'assistant', result.content, result.attachments);
      }

      return result;
    } catch (error) {
      console.error('❌ Error in sendMessage:', error);
      throw error;
    }
  }

  // Wait for run completion and handle tool calls
  private static async waitForRunCompletion(
    threadId: string, 
    runId: string, 
    userId: string,
    statusCallback?: (status: string) => void,
    recursionDepth: number = 0
  ): Promise<AssistantRunResult> {
    // Prevent infinite recursion
    const MAX_RECURSION_DEPTH = 5;
    if (recursionDepth > MAX_RECURSION_DEPTH) {
      console.error('❌ Maximum recursion depth exceeded');
      
      return {
        content: 'I apologize, but I encountered a complex processing issue. Please try rephrasing your request or breaking it into smaller steps.',
        attachments: [],
        status: 'failed'
      };
    }
    
    console.log('🔄 waitForRunCompletion called, depth:', recursionDepth);
    let run = await this.callEdgeFunction('get_run', { thread_id: threadId, run_id: runId });
    let collectedAttachments: any[] = [];
    
    // Faster polling with timeout
    const maxWaitTime = 45000; // 45 seconds max
    const pollInterval = 1000; // Check every 1 second
    const startTime = Date.now();
    
    while (run.status === 'in_progress' || run.status === 'queued') {
      // Check for timeout
      if (Date.now() - startTime > maxWaitTime) {
        console.error('⏱️ Assistant response timeout');
        return {
          content: 'I apologize, but my response took too long to process. Please try again with a simpler request.',
          attachments: collectedAttachments,
          status: 'failed'
        };
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      run = await this.callEdgeFunction('get_run', { thread_id: threadId, run_id: runId });
      
      console.log('🔄 Run status updated:', run.status);
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
      
      let toolOutputs: any[];
      let attachments: any[];
      
      try {
        const toolResult = await this.handleToolCalls(toolCalls, userId);
        toolOutputs = toolResult.toolOutputs;
        attachments = toolResult.attachments;
        
        // Collect attachments from tool calls
        collectedAttachments = attachments;
        
        console.log('✅ Tool calls handled successfully');
      } catch (toolError) {
        console.error('❌ Error handling tool calls:', toolError);
        
        // Provide error outputs to let assistant handle gracefully
        toolOutputs = toolCalls.map((call: any) => ({
          tool_call_id: call.id,
          output: JSON.stringify({ 
            success: false, 
            error: 'Tool execution failed', 
            message: 'There was an error processing this request. Please try again.' 
          })
        }));
        attachments = [];
        collectedAttachments = [];
      }

      statusCallback?.('SuperAI is completing response...');

      try {
        // Submit tool outputs
        run = await this.callEdgeFunction('submit_tool_outputs', {
          thread_id: threadId,
          run_id: runId,
          tool_outputs: toolOutputs
        });

        // Wait for completion after tool execution with incremented depth
        const result = await this.waitForRunCompletion(threadId, runId, userId, statusCallback, recursionDepth + 1);
        // Merge attachments from recursive calls
        result.attachments = [...collectedAttachments, ...result.attachments];
        return result;
      } catch (submitError) {
        console.error('❌ Error submitting tool outputs:', submitError);
        
        // Return graceful error instead of throwing
        return {
          content: 'I encountered an issue processing your request. Please try rephrasing or simplifying your request.',
          attachments: collectedAttachments,
          status: 'failed'
        };
      }
    }

    if (run.status === 'completed') {
      // Get the assistant's response
      const messages = await this.callEdgeFunction('list_messages', {
        thread_id: threadId,
        order: 'desc',
        limit: 1
      });

      const lastMessage = messages.data[0];
      if (lastMessage && lastMessage.role === 'assistant') {
        const content = lastMessage.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.type === 'text' ? c.text.value : '')
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
      console.error('❌ Assistant run failed:', run.last_error?.message);
      return {
        content: `I apologize, but I encountered an error processing your request. ${run.last_error?.message ? 'Error: ' + run.last_error.message : 'Please try again or rephrase your request.'}`,
        attachments: collectedAttachments,
        status: 'failed'
      };
    }

    return {
      content: 'I apologize, I could not process your request.',
      attachments: collectedAttachments,
      status: 'failed'
    };
  }

  // Handle tool calls from the assistant
  private static async handleToolCalls(toolCalls: any[], userId: string): Promise<{ toolOutputs: any[], attachments: any[] }> {
    const { InvoiceFunctionService } = await import('@/services/invoiceFunctions');
    
    console.log('🔧 Processing tool calls:', toolCalls.length);
    const attachments: any[] = [];
    
    // Process tool calls in parallel when possible
    const outputs = await Promise.all(toolCalls.map(async (toolCall) => {
      try {
        const functionName = toolCall.function.name;
        let functionArgs;
        
        // Safely parse function arguments
        try {
          const rawArgs = toolCall.function.arguments;
          functionArgs = JSON.parse(rawArgs);
        } catch (parseError) {
          console.error('❌ Error parsing tool arguments:', parseError);
          functionArgs = {};
        }

        console.log('🔧 Executing tool:', functionName, 'with args:', functionArgs);

        // Execute the function
        const result = await InvoiceFunctionService.executeFunction(
          functionName,
          functionArgs,
          userId
        );

        console.log('✅ Tool completed successfully:', functionName);

        // Extract attachments from successful function results
        if (result.success && result.attachments && result.attachments.length > 0) {
          attachments.push(...result.attachments);
        } else if (result.success && result.data) {
          attachments.push(result.data);
        }

        return {
          tool_call_id: toolCall.id,
          output: JSON.stringify(result)
        };
      } catch (error) {
        console.error('❌ Tool call error:', error);
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

    console.log('✅ All tools completed');
    return { toolOutputs: outputs, attachments };
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
        console.error('❌ Thread not found for saving message');
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
      console.error('❌ Error saving message to database:', error);
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
      console.error('❌ Error getting thread messages:', error);
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
    // Edge Function handles API key, so we just check if Supabase is configured
    const hasSupabaseConfig = !!process.env.EXPO_PUBLIC_API_URL && !!process.env.EXPO_PUBLIC_API_KEY;
    console.log('🔍 Configuration check:', hasSupabaseConfig);
    return hasSupabaseConfig;
  }

  // Create a new thread and deactivate old ones
  private static async createNewThread(userId: string): Promise<string> {
    try {
      // Deactivate all existing threads for this user
      await supabase
        .from('chat_threads')
        .update({ is_active: false })
        .eq('user_id', userId);

      // Create new OpenAI thread via edge function
      const thread = await this.callEdgeFunction('create_thread', {
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
        console.error('❌ Failed to save new thread:', saveError);
        throw saveError;
      }

      console.log('✅ Created new thread after recovery:', thread.id);
      return thread.id;
    } catch (error) {
      console.error('❌ Error creating new thread:', error);
      throw error;
    }
  }

  // Clear current thread (for chat clearing functionality)
  static async clearCurrentThread(userId: string): Promise<void> {
    try {
      console.log('🧹 Clearing current thread for user:', userId);
      
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

        console.log('✅ Successfully cleared thread');
      }
    } catch (error) {
      console.error('❌ Error clearing current thread:', error);
      throw error;
    }
  }
}
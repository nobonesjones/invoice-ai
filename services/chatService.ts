import { supabase } from '@/config/supabase';
import { AssistantService, AssistantRunResult } from '@/services/assistantService';
import { InvoiceFunctionService, INVOICE_FUNCTIONS } from '@/services/invoiceFunctions';
import { UserContext } from './userContextService';

export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system' | 'function';
  content: string;
  message_type: 'text' | 'voice' | 'function_call' | 'function_result' | 'document';
  function_name?: string;
  function_parameters?: any;
  function_result?: any;
  attachments?: any[];
  created_at: string;
  tokens_used?: number;
}

export interface ChatConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  metadata: any;
}

export class ChatService {
  // Feature flag for Assistants API
  private static async shouldUseAssistants(userId: string): Promise<boolean> {
    // Enable the optimized V2 system
    const shouldUse = true;
    return shouldUse;
    
    // Example for gradual rollout:
    // const userConfig = await this.getUserConfig(userId);
    // return userConfig.use_assistants_api || false;
  }

  // Edge function helper for AI requests
  private static async callAIChatEdgeFunction(payload: {
    type: 'chat_completion' | 'assistant';
    messages?: OpenAIMessage[];
    message?: string;
    threadId?: string;
    userName?: string;
    functions?: any[];
    userContext?: any;
  }): Promise<any> {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ANON_KEY}`,
          'apikey': process.env.EXPO_PUBLIC_ANON_KEY!,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[ChatService] Edge function error:', errorData);
        throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('[ChatService] Edge function request failed:', error);
      throw error;
    }
  }

  // Main entry point - routes to appropriate service
  static async processUserMessage(
    userId: string,
    userMessage: string,
    userContext?: UserContext,
    statusCallback?: (status: string) => void
  ): Promise<{ conversation?: ChatConversation; thread?: any; messages: any[] }> {
    try {
      // Check if user should use the new Assistants API (optimized system)
      console.log('[ChatService] 🔍 Checking which AI system to use...');
      const useAssistants = await this.shouldUseAssistants(userId);
      console.log('[ChatService] 🎯 shouldUseAssistants result:', useAssistants);
      
      if (useAssistants) {
        console.log('[ChatService] ✅ Using optimized Assistants API system');
        try {
          const result = await this.processWithAssistants(userId, userMessage, userContext, statusCallback);
          console.log('[ChatService] ✅ Assistants API completed successfully');
          return result;
        } catch (assistantError) {
          console.error('[ChatService] ❌ Assistants API failed:', assistantError);
          throw assistantError; // No fallback - throw the error to debug the optimized system
        }
      } else {
        console.log('[ChatService] ⚠️ Using legacy Chat Completions system');
        return await this.processWithChatCompletions(userId, userMessage, userContext, statusCallback);
      }
    } catch (error) {
      console.error('[ChatService] ❌ Error processing message:', error);
      throw error;
    }
  }

  // New Assistants API flow
  private static async processWithAssistants(
    userId: string,
    userMessage: string,
    userContext?: UserContext,
    statusCallback?: (status: string) => void
  ): Promise<{ thread: any; messages: any[] }> {
    try {
      
      // Check if Assistants API is configured
      if (!AssistantService.isConfigured()) {
        console.error('[ChatService] AssistantService.isConfigured() returned false');
        throw new Error('AI service is not configured. Please check your API key settings.');
      }

      statusCallback?.('Processing...');

      // Reuse existing active thread if available
      const existingThread = await AssistantService.getCurrentThread(userId);

      // Prepare up to 15 previous messages for context (user/assistant only)
      let history: { role: 'user' | 'assistant'; content: string }[] | undefined = undefined;
      try {
        const threadMessages = await AssistantService.getThreadMessages(userId);
        const mapped = (threadMessages || [])
          .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content || '') }))
          .filter(m => m.role === 'user' || m.role === 'assistant');
        // Keep last 15 in chronological order
        history = mapped.slice(-15);
      } catch {}

      // Send message via Assistants API with user context and status updates
      const result: AssistantRunResult = await AssistantService.sendMessage(userId, userMessage, userContext, statusCallback, existingThread?.id, history);

      // Remove redundant status - processing is complete

      // Use messages directly from optimized response, and persist for history
      console.log('[ChatService] 🔍 Using optimized response messages directly');
      
      // 🐛 DEBUG: Check what the edge function returned
      console.log(`🐛 DEBUG [ChatService]: Edge function result structure:`, {
        has_messages: !!result.messages,
        messages_count: result.messages?.length || 0,
        has_content: !!result.content,
        has_attachments: !!result.attachments,
        attachments_count: result.attachments?.length || 0
      });
      
      if (result.attachments && result.attachments.length > 0) {
        console.log(`🐛 DEBUG [ChatService]: Result has ${result.attachments.length} attachments at root level, not in messages!`);
        console.log(`🐛 DEBUG [ChatService]: First attachment:`, {
          type: result.attachments[0].type,
          invoice_id: result.attachments[0].invoice_id,
          has_invoice: !!result.attachments[0].invoice,
          has_line_items: !!result.attachments[0].line_items
        });
      }
      
      let messages = result.messages || [];
      let thread = result.thread || existingThread || { id: `thread-${Date.now()}`, user_id: userId };

      // 🔧 FIX: If edge function returns attachments at root level, add them to the assistant message
      if (result.attachments && result.attachments.length > 0 && messages.length >= 2) {
        console.log(`🔧 FIX [ChatService]: Moving ${result.attachments.length} root-level attachments to assistant message`);
        const assistantMessage = messages[messages.length - 1]; // Last message should be assistant
        if (assistantMessage && assistantMessage.role === 'assistant') {
          assistantMessage.attachments = result.attachments;
          console.log(`🔧 FIX [ChatService]: Assistant message now has ${assistantMessage.attachments.length} attachments`);
        }
      }

      try {
        const savedThread = await AssistantService.persistOptimizedResult(userId, thread, messages);
        if (savedThread) thread = savedThread;
      } catch (e) {
        console.warn('[ChatService] Persist optimized result failed:', e);
      }
      
      // Load full history for this thread from DB
      let fullHistory: any[] = [];
      try {
        const all = await AssistantService.getThreadMessages(userId);
        fullHistory = all || [];
      } catch (e) {
        console.warn('[ChatService] Failed to load full history, falling back to current messages:', e);
        fullHistory = messages.map(m => ({ ...m, thread_id: thread?.id }));
      }

      // 🐛 DEBUG: Check if any messages have attachments before mapping
      const messagesWithAttachments = fullHistory.filter(msg => msg.attachments && msg.attachments.length > 0);
      console.log(`🐛 DEBUG [ChatService]: Full history has ${messagesWithAttachments.length} messages with attachments out of ${fullHistory.length} total`);
      
      if (messagesWithAttachments.length > 0) {
        console.log(`🐛 DEBUG [ChatService]: First message with attachments:`, {
          role: messagesWithAttachments[0].role,
          has_attachments: !!messagesWithAttachments[0].attachments,
          attachment_count: messagesWithAttachments[0].attachments?.length || 0,
          attachment_type: messagesWithAttachments[0].attachments?.[0]?.type
        });
      }

      return {
        thread,
        messages: fullHistory.map(msg => {
          const mappedMessage = {
            id: msg.id,
            conversation_id: msg.thread_id || thread?.id,
            role: msg.role,
            content: msg.content,
            message_type: (msg.attachments && msg.attachments.length > 0) ? 'document' : 'text',
            attachments: msg.attachments,
            created_at: msg.created_at
          };
          
          // 🐛 DEBUG: Log when mapping a message with attachments
          if (msg.attachments && msg.attachments.length > 0) {
            console.log(`🐛 DEBUG [ChatService]: Mapping message with ${msg.attachments.length} attachments, message_type: ${mappedMessage.message_type}`);
          }
          
          return mappedMessage;
        })
      };
    } catch (error) {
      console.error('[ChatService] Assistants API error:', error);
      // Don't re-throw - let the fallback mechanism handle it
      throw error;
    }
  }

  // Existing Chat Completions flow (for backward compatibility)
  private static async processWithChatCompletions(
    userId: string,
    userMessage: string,
    userContext?: UserContext,
    statusCallback?: (status: string) => void
  ): Promise<{ conversation: ChatConversation; messages: ChatMessage[] }> {
    try {
      // Check if edge function is configured
      if (!process.env.EXPO_PUBLIC_API_URL || !process.env.EXPO_PUBLIC_ANON_KEY) {
        throw new Error('AI service is not configured. Please check your edge function settings.');
      }

      // Get or create conversation
      const conversation = await this.getOrCreateConversation(userId);

      // Save user message
      const savedUserMessage = await this.saveMessage(
        conversation.id,
        'user',
        userMessage,
        'text'
      );

      // Get conversation history for context
      const allPreviousMessages = await this.getConversationMessages(conversation.id);
      
      // Limit conversation history to last 10 messages to avoid token limits
      const recentMessages = allPreviousMessages.slice(-10);
      
      // Include all messages - the user message is already saved
      const messages = this.convertChatMessagesToOpenAI(recentMessages);

      // Get user name for personalization
      const userName = await this.getUserName(userId);

      console.log('[ChatService] Sending messages to edge function:', messages);

      // Generate AI response via edge function
      const aiResult = await this.callAIChatEdgeFunction({
        type: 'chat_completion',
        messages,
        functions: INVOICE_FUNCTIONS,
        userName,
        userContext
      });

      console.log('[ChatService] Edge function raw response:', JSON.stringify(aiResult, null, 2));
      
      // Check for OpenAI format response
      const choice = aiResult.choices?.[0];
      const message = choice?.message;
      
      let aiResponseMessage = message?.content || aiResult.content || aiResult.response || aiResult.message;
      let functionCall = message?.function_call || aiResult.functionCall || aiResult.function_call;
      
      let functionResult = null;

      // Handle function calls
      if (functionCall) {
        console.log('[ChatService] Function call detected:', functionCall);
        try {
          // Parse arguments if they're a string
          const functionArgs = typeof functionCall.arguments === 'string' 
            ? JSON.parse(functionCall.arguments) 
            : functionCall.arguments;
            
          console.log('[ChatService] Executing function:', functionCall.name, 'with args:', functionArgs);
            
          // Execute the function
          functionResult = await InvoiceFunctionService.executeFunction(
            functionCall.name,
            functionArgs,
            userId
          );
          
          console.log('[ChatService] Function execution result:', JSON.stringify(functionResult, null, 2));


          // Save function call and result messages
          await this.saveMessage(
            conversation.id,
            'function',
            JSON.stringify(functionResult),
            'function_result',
            {
              function_name: functionCall.name,
              function_parameters: functionArgs,
              function_result: functionResult
            }
          );

          // If function provided UI content, integrate it into response
          if (functionResult?.uiContent) {
            aiResponseMessage = functionResult.uiContent;
          } else if (!aiResponseMessage && functionResult?.message) {
            // Use function result message if no AI response
            aiResponseMessage = functionResult.message;
          } else if (!aiResponseMessage) {
            // Generate a default message based on the function called
            aiResponseMessage = `I've executed the ${functionCall.name} function for you.`;
          }

        } catch (functionError) {
          console.error('[ChatService] Function execution error:', functionError);
          aiResponseMessage = `I encountered an error while trying to ${functionCall.name}: ${functionError.message}`;
        }
      }

      console.log('[ChatService] Final AI response message:', aiResponseMessage);
      console.log('[ChatService] Function result attachments:', functionResult?.attachments);
      
      // Save AI response message
      const savedAIMessage = await this.saveMessage(
        conversation.id,
        'assistant',
        aiResponseMessage,
        'text',
        {
          tokens_used: aiResult.tokensUsed || aiResult.usage?.total_tokens || aiResult.tokens_used,
          attachments: functionResult?.attachments || []
        }
      );
      
      console.log('[ChatService] Saved AI message with attachments:', savedAIMessage.attachments);

      // Update conversation title if it's the first exchange
      if (!conversation.title || conversation.title === 'New Chat') {
        const newTitle = this.generateConversationTitle(userMessage);
        await this.updateConversationTitle(conversation.id, newTitle);
        conversation.title = newTitle;
      }

      // Get all messages for return
      const allMessages = await this.getConversationMessages(conversation.id);

      return { conversation, messages: allMessages };
    } catch (error) {
      console.error('[ChatService] Chat Completions error:', error);
      throw error;
    }
  }

  static async getOrCreateConversation(userId: string): Promise<ChatConversation> {
    // First, try to get the most recent active conversation
    const { data: existingConversation, error: fetchError } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConversation && !fetchError) {
      return existingConversation;
    }

    // If no active conversation exists, create a new one
    const { data: newConversation, error: createError } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: userId,
        title: 'New Chat',
        is_active: true,
        metadata: {}
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create conversation: ${createError.message}`);
    }

    return newConversation;
  }

  static async getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
    
    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatService] Error fetching messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    // Filter out function call messages from user display - they're internal only
    const filteredMessages = (messages || []).filter(msg => msg.role !== 'function');
    

    return filteredMessages;
  }

  static async saveMessage(
    conversationId: string,
    role: ChatMessage['role'],
    content: string,
    messageType: ChatMessage['message_type'] = 'text',
    additionalData?: Partial<ChatMessage>
  ): Promise<ChatMessage> {
    const messageData = {
      conversation_id: conversationId,
      role,
      content,
      message_type: messageType,
      ...additionalData
    };

    const { data: savedMessage, error } = await supabase
      .from('chat_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save message: ${error.message}`);
    }

    // Update conversation's updated_at timestamp
    await supabase
      .from('chat_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return savedMessage;
  }

  private static convertChatMessagesToOpenAI(messages: ChatMessage[]): OpenAIMessage[] {
    const converted = messages
      .filter(msg => ['user', 'assistant', 'system'].includes(msg.role))
      .filter(msg => msg.content && msg.content.trim().length > 0) // Filter out null/empty content
      .map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content.trim()
      }));

    
    return converted;
  }

  private static async getUserName(userId: string): Promise<string | undefined> {
    try {
      const { data: user, error } = await supabase.auth.getUser();
      if (error) return undefined;
      
      return user.user?.user_metadata?.display_name || 
             user.user?.email?.split('@')[0] || 
             undefined;
    } catch {
      return undefined;
    }
  }

  private static generateConversationTitle(firstMessage: string): string {
    // Simple title generation based on first message
    const message = firstMessage.toLowerCase();
    
    if (message.includes('estimate') && message.includes('create')) {
      return 'Create Estimate';
    } else if (message.includes('invoice') && message.includes('create')) {
      return 'Create Invoice';
    } else if (message.includes('estimate') && (message.includes('search') || message.includes('find'))) {
      return 'Search Estimates';
    } else if (message.includes('search') || message.includes('find')) {
      return 'Search Invoices';
    } else if (message.includes('estimate') && (message.includes('summary') || message.includes('report'))) {
      return 'Estimate Summary';
    } else if (message.includes('summary') || message.includes('report')) {
      return 'Invoice Summary';
    } else if (message.includes('estimate') && message.includes('recent')) {
      return 'Recent Estimates';
    } else if (message.includes('recent')) {
      return 'Recent Invoices';
    } else if (message.includes('estimate')) {
      return 'Estimate Chat';
    } else {
      // Truncate to first few words
      const words = firstMessage.split(' ').slice(0, 4).join(' ');
      return words.length > 30 ? words.substring(0, 30) + '...' : words;
    }
  }

  static async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('chat_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (error) {
      throw new Error(`Failed to update conversation title: ${error.message}`);
    }
  }

  static async getUserConversations(userId: string): Promise<ChatConversation[]> {
    const { data: conversations, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return conversations || [];
  }

  static async clearConversationMessages(conversationId: string): Promise<void> {
    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      throw new Error(`Failed to clear conversation messages: ${error.message}`);
    }

    // Update conversation title to indicate it's been cleared
    await supabase
      .from('chat_conversations')
      .update({ 
        title: 'New Chat', 
        updated_at: new Date().toISOString() 
      })
      .eq('id', conversationId);
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    // First delete all messages
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (messagesError) {
      throw new Error(`Failed to delete conversation messages: ${messagesError.message}`);
    }

    // Then delete the conversation
    const { error: conversationError } = await supabase
      .from('chat_conversations')
      .delete()
      .eq('id', conversationId);

    if (conversationError) {
      throw new Error(`Failed to delete conversation: ${conversationError.message}`);
    }
  }
} 

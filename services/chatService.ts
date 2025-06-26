import { supabase } from '@/config/supabase';
import { OpenAIService, OpenAIMessage } from '@/services/openaiService';
import { AssistantService, AssistantRunResult } from '@/services/assistantService';
import { InvoiceFunctionService, INVOICE_FUNCTIONS } from '@/services/invoiceFunctions';

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
    // For now, enable for all users. Later you can add user-specific logic
    // or environment variables for gradual rollout
    return true;
    
    // Example for gradual rollout:
    // const userConfig = await this.getUserConfig(userId);
    // return userConfig.use_assistants_api || false;
  }

  // Main entry point - routes to appropriate service
  static async processUserMessage(
    userId: string,
    userMessage: string,
    currencyContext?: { currency: string; symbol: string },
    statusCallback?: (status: string) => void
  ): Promise<{ conversation?: ChatConversation; thread?: any; messages: any[] }> {
    try {
      const useAssistants = await this.shouldUseAssistants(userId);
      
      if (useAssistants) {
        console.log('[ChatService] Using Assistants API');
        return await this.processWithAssistants(userId, userMessage, currencyContext, statusCallback);
      } else {
        console.log('[ChatService] Using Chat Completions API');
        return await this.processWithChatCompletions(userId, userMessage, currencyContext, statusCallback);
      }
    } catch (error) {
      console.error('[ChatService] Error processing message:', error);
      throw error;
    }
  }

  // New Assistants API flow
  private static async processWithAssistants(
    userId: string,
    userMessage: string,
    currencyContext?: { currency: string; symbol: string },
    statusCallback?: (status: string) => void
  ): Promise<{ thread: any; messages: any[] }> {
    try {
      // Check if Assistants API is configured
      if (!AssistantService.isConfigured()) {
        throw new Error('AI service is not configured. Please check your API key settings.');
      }

      statusCallback?.('SuperAI is preparing...');

      // Send message via Assistants API with currency context and status updates
      const result: AssistantRunResult = await AssistantService.sendMessage(userId, userMessage, currencyContext, statusCallback);

      statusCallback?.('SuperAI is finalizing response...');

      // Get updated messages for UI
      const messages = await AssistantService.getThreadMessages(userId);
      const thread = await AssistantService.getCurrentThread(userId);

      console.log('[ChatService] Assistants API result:', {
        status: result.status,
        content: result.content.substring(0, 100) + '...',
        messagesCount: messages.length
      });

      return {
        thread,
        messages: messages.map(msg => ({
          id: msg.id,
          conversation_id: msg.thread_id, // Map for UI compatibility
          role: msg.role,
          content: msg.content,
          message_type: 'text',
          attachments: msg.attachments,
          created_at: msg.created_at
        }))
      };
    } catch (error) {
      console.error('[ChatService] Assistants API error:', error);
      throw error;
    }
  }

  // Existing Chat Completions flow (for backward compatibility)
  private static async processWithChatCompletions(
    userId: string,
    userMessage: string,
    currencyContext?: { currency: string; symbol: string },
    statusCallback?: (status: string) => void
  ): Promise<{ conversation: ChatConversation; messages: ChatMessage[] }> {
    try {
      // Check if OpenAI is configured
      if (!OpenAIService.isConfigured()) {
        throw new Error('AI service is not configured. Please check your API key settings.');
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
      const conversationHistory = this.convertChatMessagesToOpenAI(
        allPreviousMessages.slice(0, -1) // Exclude the just-saved user message
      );

      console.log('[ChatService] Conversation history length:', conversationHistory.length);

      // Get user name for personalization
      const userName = await this.getUserName(userId);

      // Generate AI response
      const aiResult = await OpenAIService.generateResponse(
        userMessage,
        conversationHistory,
        userName,
        INVOICE_FUNCTIONS
      );

      let aiResponseMessage = aiResult.response;
      let functionResult = null;

      // Handle function calls
      if (aiResult.functionCall) {
        try {
          // Execute the function
          functionResult = await InvoiceFunctionService.executeFunction(
            aiResult.functionCall.name,
            aiResult.functionCall.arguments,
            userId
          );

          console.log('[ChatService] Function result:', functionResult);

          // Save function call and result messages
          await this.saveMessage(
            conversation.id,
            'function',
            JSON.stringify(functionResult),
            'function_result',
            {
              function_name: aiResult.functionCall.name,
              function_parameters: aiResult.functionCall.arguments,
              function_result: functionResult
            }
          );

          // If function provided UI content, integrate it into response
          if (functionResult?.uiContent) {
            aiResponseMessage = functionResult.uiContent;
          }

        } catch (functionError) {
          console.error('[ChatService] Function execution error:', functionError);
          aiResponseMessage = `I encountered an error while trying to ${aiResult.functionCall.name}: ${functionError.message}`;
        }
      }

      // Save AI response message
      const savedAIMessage = await this.saveMessage(
        conversation.id,
        'assistant',
        aiResponseMessage,
        'text',
        {
          tokens_used: aiResult.tokensUsed,
          attachments: functionResult?.attachments || []
        }
      );

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
    console.log('[ChatService] Getting messages for conversation:', conversationId);
    
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
    
    console.log('[ChatService] Retrieved messages from DB:', messages?.length || 0);
    console.log('[ChatService] After filtering:', filteredMessages.length);
    console.log('[ChatService] Message roles:', filteredMessages.map(m => m.role));

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
      .map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      }));

    console.log('[ChatService] Converting messages to OpenAI format:');
    console.log(`[ChatService] Input: ${messages.length} messages, Output: ${converted.length} messages`);
    
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
    
    if (message.includes('invoice') && message.includes('create')) {
      return 'Create Invoice';
    } else if (message.includes('search') || message.includes('find')) {
      return 'Search Invoices';
    } else if (message.includes('summary') || message.includes('report')) {
      return 'Invoice Summary';
    } else if (message.includes('recent')) {
      return 'Recent Invoices';
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
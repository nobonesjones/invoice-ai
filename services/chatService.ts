import { supabase } from '@/config/supabase';
import { OpenAIService, OpenAIMessage } from '@/services/openaiService';
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
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    // Filter out function call messages from user display - they're internal only
    return (messages || []).filter(msg => msg.role !== 'function');
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
    return messages
      .filter(msg => ['user', 'assistant', 'system'].includes(msg.role))
      .map(msg => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content
      }));
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

  static async processUserMessage(
    userId: string,
    userMessage: string
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

          // Note: Function call details are stored in AI response metadata below
          // No need to save as separate message since users don't need to see raw parameters

          // Update AI response based on function result
          if (functionResult.success) {
            aiResponseMessage = functionResult.message;
            
            // If function returned data, mention it's available
            if (functionResult.data && Array.isArray(functionResult.data) && functionResult.data.length > 0) {
              aiResponseMessage += '\n\nI found the following information:';
              
              // For invoices, show basic details
              if (aiResult.functionCall.name.includes('invoice')) {
                functionResult.data.slice(0, 3).forEach((item: any, index: number) => {
                  if (item.invoice_number && item.client_name && item.total_amount) {
                    aiResponseMessage += `\n${index + 1}. Invoice #${item.invoice_number} - ${item.client_name} - $${item.total_amount.toFixed(2)} (${item.status})`;
                  }
                });
                
                if (functionResult.data.length > 3) {
                  aiResponseMessage += `\n... and ${functionResult.data.length - 3} more invoices.`;
                }
              }
            }
          } else {
            aiResponseMessage = `I encountered an issue: ${functionResult.message}`;
          }
        } catch (functionError) {
          console.error('Function execution error:', functionError);
          aiResponseMessage = 'I tried to help you, but encountered an error processing your request. Please try again.';
        }
      }

      // Save AI response
      const savedAiMessage = await this.saveMessage(
        conversation.id,
        'assistant',
        aiResponseMessage,
        'text',
        {
          tokens_used: aiResult.tokensUsed,
          ...(functionResult && { 
            function_result: functionResult,
            attachments: functionResult.data ? [functionResult.data] : []
          })
        }
      );

      // Get all messages for this conversation
      const allMessages = await this.getConversationMessages(conversation.id);

      // Auto-update conversation title if this is a new conversation
      if (allMessages.length <= 3 && conversation.title === 'New Chat') {
        const title = this.generateConversationTitle(userMessage);
        await this.updateConversationTitle(conversation.id, title);
        conversation.title = title;
      }

      return { conversation, messages: allMessages };
    } catch (error) {
      console.error('Error processing user message:', error);
      throw error;
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
} 
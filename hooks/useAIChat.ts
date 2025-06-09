import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';

import { ChatService, ChatMessage, ChatConversation } from '@/services/chatService';
import { AssistantService, AssistantThread } from '@/services/assistantService';
import { useSupabase } from '@/context/supabase-provider';

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  conversation: ChatConversation | null;
  thread: AssistantThread | null;
  sendMessage: (message: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  clearConversation: () => Promise<void>;
  error: string | null;
  clearError: () => void;
  isUsingAssistants: boolean;
}

export function useAIChat(): UseAIChatReturn {
  const { user } = useSupabase();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [thread, setThread] = useState<AssistantThread | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUsingAssistants, setIsUsingAssistants] = useState(true); // Default to Assistants API

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      if (isUsingAssistants) {
        // Load messages from Assistants API
        console.log('[useAIChat] Loading messages from Assistants API...');
        
        const threadMessages = await AssistantService.getThreadMessages(user.id);
        const currentThread = await AssistantService.getCurrentThread(user.id);
        
        // Convert to ChatMessage format for UI compatibility
        const convertedMessages: ChatMessage[] = threadMessages.map(msg => ({
          id: msg.id,
          conversation_id: msg.thread_id,
          role: msg.role,
          content: msg.content,
          message_type: 'text' as const,
          attachments: msg.attachments,
          created_at: msg.created_at
        }));

        setMessages(convertedMessages);
        setThread(currentThread);
        console.log('[useAIChat] Loaded', convertedMessages.length, 'messages from thread');
      } else {
        // Load messages from Chat Completions API (legacy)
        console.log('[useAIChat] Loading messages from Chat Completions API...');
        
      const conv = await ChatService.getOrCreateConversation(user.id);
      setConversation(conv);

      const existingMessages = await ChatService.getConversationMessages(conv.id);
      setMessages(existingMessages);
        console.log('[useAIChat] Loaded', existingMessages.length, 'messages from conversation');
      }

    } catch (err) {
      console.error('Error loading messages:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, isUsingAssistants]);

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!user?.id || !messageContent.trim()) return;

    // Create optimistic user message to show immediately in UI
    const optimisticUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`, // Temporary ID
      conversation_id: thread?.id || conversation?.id || '',
      role: 'user',
      content: messageContent.trim(),
      message_type: 'text',
      attachments: [],
      created_at: new Date().toISOString()
    };

    // Add user message to UI immediately (optimistic update)
    setMessages(prevMessages => [...prevMessages, optimisticUserMessage]);

    try {
      setIsLoading(true);
      setError(null);

      console.log('[useAIChat] Sending message via ChatService...');
      
      // ChatService automatically routes to the appropriate API
      const result = await ChatService.processUserMessage(user.id, messageContent.trim());
      
      if (result.thread) {
        // Assistants API result
        console.log('[useAIChat] Received Assistants API result');
        setThread(result.thread);
        setMessages(result.messages); // This will replace the optimistic message with real ones
        setIsUsingAssistants(true);
      } else if (result.conversation) {
        // Chat Completions API result
        console.log('[useAIChat] Received Chat Completions API result');
      setConversation(result.conversation);
        setMessages(result.messages); // This will replace the optimistic message with real ones
        setIsUsingAssistants(false);
      }

      console.log('[useAIChat] Updated messages count:', result.messages.length);

    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      
      // Remove the optimistic message on error and show error
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== optimisticUserMessage.id));
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, thread?.id, conversation?.id]);

  const clearConversation = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      if (isUsingAssistants) {
        // For Assistants API, properly clear the current thread
        console.log('[useAIChat] Clearing Assistants thread...');
        
        // Clear the thread in database and deactivate it
        await AssistantService.clearCurrentThread(user.id);
        
        // Clear UI state
        setThread(null);
        setMessages([]);
      } else if (conversation?.id) {
        // Clear Chat Completions conversation
        console.log('[useAIChat] Clearing chat completions conversation...');
        await ChatService.clearConversationMessages(conversation.id);
      setConversation(null);
      setMessages([]);
      }

      console.log('[useAIChat] Conversation/thread cleared successfully');

    } catch (err) {
      console.error('Error clearing conversation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear conversation';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, conversation?.id, thread?.id, isUsingAssistants]);

  // Load messages on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadMessages();
    } else {
      // Clear state if no user
      setMessages([]);
      setConversation(null);
      setThread(null);
      setError(null);
    }
  }, [user?.id, loadMessages]);

  return {
    messages,
    isLoading,
    conversation,
    thread,
    sendMessage,
    loadMessages,
    clearConversation,
    error,
    clearError,
    isUsingAssistants
  };
} 
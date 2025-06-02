import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';

import { ChatService, ChatMessage, ChatConversation } from '@/services/chatService';
import { useSupabase } from '@/context/supabase-provider';

interface UseAIChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  conversation: ChatConversation | null;
  sendMessage: (message: string) => Promise<void>;
  loadMessages: () => Promise<void>;
  clearConversation: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

export function useAIChat(): UseAIChatReturn {
  const { user } = useSupabase();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const loadMessages = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // Get or create conversation
      const conv = await ChatService.getOrCreateConversation(user.id);
      setConversation(conv);

      // Load existing messages
      const existingMessages = await ChatService.getConversationMessages(conv.id);
      setMessages(existingMessages);

    } catch (err) {
      console.error('Error loading messages:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const sendMessage = useCallback(async (messageContent: string) => {
    if (!user?.id || !messageContent.trim()) return;

    try {
      setIsLoading(true);
      setError(null);

      // Process the message (saves to DB and generates response)
      const result = await ChatService.processUserMessage(user.id, messageContent.trim());
      
      // Update state with new messages
      setConversation(result.conversation);
      setMessages(result.messages);

    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const clearConversation = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      setError(null);

      // If we have an active conversation, clear its messages from the database
      if (conversation?.id) {
        await ChatService.clearConversationMessages(conversation.id);
      }

      // Clear UI state
      setConversation(null);
      setMessages([]);

      console.log('[useAIChat] Conversation cleared successfully');

    } catch (err) {
      console.error('Error clearing conversation:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear conversation';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, conversation?.id]);

  // Load messages on mount and when user changes
  useEffect(() => {
    if (user?.id) {
      loadMessages();
    } else {
      // Clear state if no user
      setMessages([]);
      setConversation(null);
      setError(null);
    }
  }, [user?.id, loadMessages]);

  return {
    messages,
    isLoading,
    conversation,
    sendMessage,
    loadMessages,
    clearConversation,
    error,
    clearError
  };
} 
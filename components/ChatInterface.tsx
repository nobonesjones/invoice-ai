import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
  SafeAreaView,
} from 'react-native';
import { Send } from 'lucide-react-native';
import { ChatService } from '@/lib/services/chat-service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  error?: boolean;
}

interface ChatInterfaceProps {
  transcript: string;
  minutes: string;
}

export function ChatInterface({ transcript, minutes }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const chatService = useRef<ChatService | null>(null);

  useEffect(() => {
    try {
      chatService.current = new ChatService(transcript, minutes);
    } catch (error) {
      Alert.alert(
        'Chat Unavailable',
        'Chat functionality is not available until the transcript and minutes are generated.'
      );
    }
  }, [transcript, minutes]);

  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  const handleError = (error: Error) => {
    const errorMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: error.message || 'An error occurred. Please try again.',
      timestamp: new Date(),
      error: true,
    };
    setMessages(prev => [...prev, errorMessage]);
  };

  const handleSend = async () => {
    if (!chatService.current) {
      Alert.alert(
        'Chat Unavailable',
        'Chat functionality is not available until the transcript and minutes are generated.'
      );
      return;
    }

    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatService.current.sendMessage(userMessage.content);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to get response'));
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateLastResponse = async () => {
    if (!chatService.current || messages.length === 0) return;

    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;

    setIsLoading(true);

    try {
      const response = await chatService.current.regenerateResponse(lastUserMessage.content);
      
      setMessages(prev => {
        const newMessages = prev.filter(m => m.id !== prev[prev.length - 1].id);
        return [...newMessages, {
          id: Date.now().toString(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        }];
      });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error('Failed to regenerate response'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1 }}>
              <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-4"
                onContentSizeChange={scrollToBottom}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
              >
                {messages.map((message) => (
                  <View
                    key={message.id}
                    className={`mb-4 ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <View
                      className={`rounded-lg p-3 max-w-[80%] ${
                        message.role === 'user'
                          ? 'bg-primary ml-auto'
                          : message.error
                          ? 'bg-red-900/50 mr-auto'
                          : 'bg-card mr-auto'
                      }`}
                    >
                      <Text className="text-white">{message.content}</Text>
                    </View>
                  </View>
                ))}
                {isLoading && (
                  <View className="items-start mb-4">
                    <View className="bg-card rounded-lg p-4">
                      <ActivityIndicator color="#8b5cf6" />
                    </View>
                  </View>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>

        <View className="border-t border-border bg-background">
          <View className="px-4 py-2">
            <View className="flex-row items-center space-x-2">
              <TextInput
                className="flex-1 bg-transparent border border-border rounded-lg px-4 py-2 text-white"
                placeholder="Ask about your meeting..."
                placeholderTextColor="#666"
                value={inputMessage}
                onChangeText={setInputMessage}
                multiline
                maxLength={500}
                onSubmitEditing={handleSend}
                editable={!isLoading && !!chatService.current}
                style={{ maxHeight: 80 }}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={isLoading || !inputMessage.trim() || !chatService.current}
                className={`p-2 rounded-full ${
                  isLoading || !inputMessage.trim() || !chatService.current
                    ? 'opacity-50'
                    : 'opacity-100'
                } bg-primary`}
              >
                <Send size={20} color="#fff" />
              </TouchableOpacity>
            </View>
            {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].error && (
              <TouchableOpacity
                onPress={regenerateLastResponse}
                disabled={isLoading}
                className="mt-2 mb-1"
              >
                <Text className="text-primary text-sm">Regenerate response</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

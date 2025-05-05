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
  KeyboardEvent,
  Dimensions,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Send, RefreshCw } from 'lucide-react-native';
import { ChatService, StoredChatMessage } from '@/lib/services/chat-service';
import { useTheme } from '@/context/theme-provider';

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
  meetingId: string;
}

export function ChatInterface({ transcript, minutes, meetingId }: ChatInterfaceProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const chatService = useRef<ChatService | null>(null);

  // Enable LayoutAnimation for Android
  if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }

  useEffect(() => {
    const initializeChat = async () => {
      try {
        setIsInitializing(true);
        // Initialize chat service with transcript, minutes, and meetingId
        chatService.current = new ChatService(transcript, minutes, meetingId);
        
        // Load chat history
        const history = await chatService.current.loadChatHistory();
        
        // Convert stored messages to the Message format
        const formattedMessages = history.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.created_at),
          error: msg.error
        }));
        
        setMessages(formattedMessages);
      } catch (error) {
        Alert.alert(
          'Chat Unavailable',
          'Chat functionality is not available until the transcript and minutes are generated.'
        );
      } finally {
        setIsInitializing(false);
      }
    };
    
    initializeChat();
  }, [transcript, minutes, meetingId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [messages]);

  // Handle keyboard appearance and measure its height
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event: KeyboardEvent) => {
        // Get keyboard height
        const keyboardHeight = event.endCoordinates.height;
        setKeyboardHeight(keyboardHeight);
        setIsKeyboardVisible(true);
        
        // Animate layout changes
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        // Scroll to bottom when keyboard appears
        scrollToBottom();
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
        setIsKeyboardVisible(false);
        
        // Animate layout changes
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        
        // Scroll to bottom when keyboard hides
        scrollToBottom();
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);

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

    // Add user message to UI immediately (optimistic update)
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
      // Send message to chat service (which will handle persistence)
      const response = await chatService.current.sendMessage(userMessage.content);
      
      // Add assistant response to UI
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
      // Regenerate response using chat service
      const response = await chatService.current.regenerateResponse(lastUserMessage.content);
      
      // Update UI with new response (replace last assistant message)
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

  // Show loading indicator while initializing
  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 16, color: theme.foreground }}>
          Loading chat history...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollViewRef}
              className="flex-1 px-4"
              contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && !isLoading && (
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: theme.mutedForeground, textAlign: 'center' }}>
                    Ask questions about your meeting transcript and minutes.
                  </Text>
                </View>
              )}
              
              {messages.map((message) => (
                <View
                  key={message.id}
                  className={`mb-4 ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <View
                    style={{
                      backgroundColor: message.role === 'user'
                        ? theme.primary
                        : message.error
                        ? 'rgba(220, 38, 38, 0.2)'
                        : theme.card,
                      borderRadius: 16,
                      padding: 12,
                      maxWidth: '80%',
                      marginLeft: message.role === 'user' ? 'auto' : 0,
                      marginRight: message.role === 'user' ? 0 : 'auto',
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1
                    }}
                  >
                    <Text 
                      style={{ 
                        color: message.role === 'user' 
                          ? theme.primaryForeground 
                          : message.error 
                          ? theme.destructive 
                          : theme.foreground 
                      }}
                    >
                      {message.content}
                    </Text>
                    
                    {/* Message timestamp */}
                    <Text 
                      style={{ 
                        color: message.role === 'user' 
                          ? 'rgba(255, 255, 255, 0.7)' 
                          : theme.mutedForeground,
                        fontSize: 10,
                        marginTop: 4,
                        textAlign: message.role === 'user' ? 'right' : 'left'
                      }}
                    >
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
              
              {isLoading && (
                <View className="items-start mb-4">
                  <View 
                    style={{ 
                      backgroundColor: theme.card,
                      borderRadius: 16,
                      padding: 16,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: 0.1,
                      shadowRadius: 2,
                      elevation: 1
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <ActivityIndicator color={theme.primary} style={{ marginRight: 8 }} />
                      <Text style={{ color: theme.mutedForeground }}>Thinking...</Text>
                    </View>
                  </View>
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </View>

      {/* Input container that sits at the bottom or above keyboard */}
      <View 
        style={{ 
          borderTopColor: theme.border,
          backgroundColor: theme.background,
          borderTopWidth: 1,
          // Position at bottom or above keyboard
          position: 'absolute',
          bottom: isKeyboardVisible ? keyboardHeight : 0,
          left: 0,
          right: 0,
          // Add shadow for visual separation
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
          elevation: 3,
          zIndex: 10
        }} 
      >
        <View className="px-4 py-2">
          <View className="flex-row items-center space-x-2">
            <TextInput
              ref={inputRef}
              style={{ 
                flex: 1, 
                backgroundColor: 'transparent', 
                borderColor: theme.border,
                borderWidth: 1,
                borderRadius: 24,
                paddingHorizontal: 16,
                paddingVertical: 12,
                color: theme.foreground,
                maxHeight: 100
              }}
              placeholder="Ask about your meeting..."
              placeholderTextColor={theme.mutedForeground}
              value={inputMessage}
              onChangeText={setInputMessage}
              multiline
              maxLength={500}
              onSubmitEditing={handleSend}
              editable={!isLoading && !!chatService.current}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={isLoading || !inputMessage.trim() || !chatService.current}
              style={{
                padding: 12,
                borderRadius: 24,
                opacity: isLoading || !inputMessage.trim() || !chatService.current ? 0.5 : 1,
                backgroundColor: theme.primary
              }}
            >
              <Send size={20} color={theme.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

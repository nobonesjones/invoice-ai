import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceService, VoiceMessage } from '@/services/voiceService';

export interface VoiceChatState {
  isConnected: boolean;
  isRecording: boolean;
  isPlaying: boolean;
  error: string | null;
  messages: VoiceMessage[];
}

export interface VoiceChatActions {
  initialize: () => Promise<boolean>;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<void>;
  sendTextMessage: (text: string) => void;
  clearError: () => void;
  disconnect: () => void;
}

export function useVoiceChat(): [VoiceChatState, VoiceChatActions] {
  const [state, setState] = useState<VoiceChatState>({
    isConnected: false,
    isRecording: false,
    isPlaying: false,
    error: null,
    messages: [],
  });

  const messagesRef = useRef<VoiceMessage[]>([]);
  const audioBufferRef = useRef<string[]>([]);

  // Update messages ref when state changes
  useEffect(() => {
    messagesRef.current = state.messages;
  }, [state.messages]);

  const updateState = useCallback((updates: Partial<VoiceChatState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const addMessage = useCallback((message: VoiceMessage) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  }, []);

  const handleRealtimeMessage = useCallback((message: any) => {
    console.log('[useVoiceChat] Received message:', message.type);
    
    switch (message.type) {
      case 'session.created':
        updateState({ isConnected: true, error: null });
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('[useVoiceChat] Speech detected');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('[useVoiceChat] Speech ended');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const transcript = message.transcript;
        if (transcript) {
          const userMessage: VoiceMessage = {
            id: `user-${Date.now()}`,
            type: 'user',
            transcript,
            timestamp: new Date(),
          };
          addMessage(userMessage);
        }
        break;
        
      case 'response.audio.delta':
        // Accumulate audio data
        if (message.delta) {
          audioBufferRef.current.push(message.delta);
          updateState({ isPlaying: true });
        }
        break;
        
      case 'response.audio.done':
        // Play accumulated audio
        if (audioBufferRef.current.length > 0) {
          const fullAudio = audioBufferRef.current.join('');
          console.log('[useVoiceChat] Playing accumulated audio, chunks:', audioBufferRef.current.length);
          VoiceService.playAudio(fullAudio);
          audioBufferRef.current = [];
        }
        updateState({ isPlaying: false });
        break;
        
      case 'response.text.delta':
        // Handle text response if needed
        break;
        
      case 'response.done':
        updateState({ isPlaying: false });
        break;
        
      case 'error':
        const errorMessage = message.error?.message || 'An error occurred';
        updateState({ 
          error: errorMessage,
          isRecording: false,
          isPlaying: false 
        });
        break;
        
      default:
        console.log('[useVoiceChat] Unhandled message type:', message.type);
        break;
    }
  }, [updateState, addMessage]);

  const initialize = useCallback(async (): Promise<boolean> => {
    try {
      updateState({ error: null });
      
      const audioInitialized = await VoiceService.initialize();
      if (!audioInitialized) {
        updateState({ error: 'Microphone permission required' });
        return false;
      }

      const connected = await VoiceService.connectRealtime(handleRealtimeMessage);
      updateState({ 
        isConnected: connected,
        error: connected ? null : 'Failed to connect to voice service'
      });
      
      return connected;
    } catch (error) {
      console.error('[useVoiceChat] Initialize error:', error);
      updateState({ error: 'Failed to initialize voice service' });
      return false;
    }
  }, [handleRealtimeMessage, updateState]);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      if (!state.isConnected) {
        updateState({ error: 'Not connected to voice service' });
        return false;
      }

      const started = await VoiceService.startRecording();
      updateState({ 
        isRecording: started,
        error: started ? null : 'Failed to start recording'
      });
      
      return started;
    } catch (error) {
      console.error('[useVoiceChat] Start recording error:', error);
      updateState({ error: 'Failed to start recording' });
      return false;
    }
  }, [state.isConnected, updateState]);

  const stopRecording = useCallback(async (): Promise<void> => {
    try {
      const audioResult = await VoiceService.stopRecording();
      updateState({ isRecording: false });
      
      if (audioResult) {
        // Commit the audio input to trigger processing
        VoiceService.commitAudioInput();
      }
    } catch (error) {
      console.error('[useVoiceChat] Stop recording error:', error);
      updateState({ 
        isRecording: false,
        error: 'Failed to process voice input'
      });
    }
  }, [updateState]);

  const sendTextMessage = useCallback((text: string): void => {
    if (!state.isConnected) {
      updateState({ error: 'Not connected to voice service' });
      return;
    }

    try {
      VoiceService.sendTextMessage(text);
      
      // Add user message to state
      const userMessage: VoiceMessage = {
        id: `user-${Date.now()}`,
        type: 'user',
        transcript: text,
        timestamp: new Date(),
      };
      addMessage(userMessage);
    } catch (error) {
      console.error('[useVoiceChat] Send text message error:', error);
      updateState({ error: 'Failed to send message' });
    }
  }, [state.isConnected, updateState, addMessage]);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  const disconnect = useCallback(() => {
    VoiceService.disconnect();
    updateState({
      isConnected: false,
      isRecording: false,
      isPlaying: false,
      error: null,
    });
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const actions: VoiceChatActions = {
    initialize,
    startRecording,
    stopRecording,
    sendTextMessage,
    clearError,
    disconnect,
  };

  return [state, actions];
}
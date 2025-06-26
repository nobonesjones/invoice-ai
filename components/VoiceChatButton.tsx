import React, { useState, useEffect } from 'react';
import {
  TouchableOpacity,
  View,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Mic, MicOff, Volume2 } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { VoiceService } from '@/services/voiceService';

interface VoiceChatButtonProps {
  onVoiceMessage?: (transcript: string, audioUri?: string) => void;
  onVoiceResponse?: (audioData: string) => void;
  disabled?: boolean;
}

export default function VoiceChatButton({ 
  onVoiceMessage, 
  onVoiceResponse,
  disabled = false 
}: VoiceChatButtonProps) {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));

  const styles = getStyles(theme);

  // Initialize voice service on mount
  useEffect(() => {
    initializeVoice();
    return () => {
      VoiceService.disconnect();
    };
  }, []);

  // Pulse animation for recording state
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const initializeVoice = async () => {
    try {
      const audioInitialized = await VoiceService.initialize();
      if (!audioInitialized) {
        Alert.alert('Permission Required', 'Please enable microphone access to use voice features.');
        return;
      }

      const connected = await VoiceService.connectRealtime(handleRealtimeMessage);
      setIsConnected(connected);
      
      if (!connected) {
        Alert.alert('Connection Error', 'Failed to connect to voice service. Please try again.');
      }
    } catch (error) {
      console.error('[VoiceChatButton] Failed to initialize voice:', error);
      Alert.alert('Error', 'Failed to initialize voice features.');
    }
  };

  const handleRealtimeMessage = (message: any) => {
    console.log('[VoiceChatButton] Received realtime message:', message.type);
    
    switch (message.type) {
      case 'session.created':
        console.log('[VoiceChatButton] Session created successfully');
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('[VoiceChatButton] Speech detected');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('[VoiceChatButton] Speech ended');
        break;
        
      case 'conversation.item.input_audio_transcription.completed':
        const transcript = message.transcript;
        console.log('[VoiceChatButton] Transcription:', transcript);
        if (onVoiceMessage && transcript) {
          onVoiceMessage(transcript);
        }
        break;
        
      case 'response.audio.delta':
        // Handle streaming audio response
        if (message.delta && onVoiceResponse) {
          setIsPlaying(true);
          onVoiceResponse(message.delta);
        }
        break;
        
      case 'response.audio.done':
        setIsPlaying(false);
        console.log('[VoiceChatButton] Audio response completed');
        break;
        
      case 'response.done':
        console.log('[VoiceChatButton] Response completed');
        break;
        
      case 'error':
        console.error('[VoiceChatButton] Realtime API error:', message.error);
        Alert.alert('Voice Error', message.error?.message || 'An error occurred with voice processing.');
        break;
        
      default:
        // Handle other message types as needed
        break;
    }
  };

  const handlePress = async () => {
    if (disabled || !isConnected) {
      if (!isConnected) {
        Alert.alert('Not Connected', 'Voice service is not connected. Please try again.');
      }
      return;
    }

    if (isRecording) {
      // Stop recording
      try {
        setIsRecording(false);
        const audioResult = await VoiceService.stopRecording();
        
        if (audioResult && audioResult.base64) {
          // Small delay to ensure audio data is sent before committing
          setTimeout(() => {
            VoiceService.commitAudioInput();
            console.log('[VoiceChatButton] Audio committed for processing');
          }, 100);
        } else if (audioResult) {
          // Audio was too short
          Alert.alert('Recording Too Short', 'Please speak for at least 1 second for better recognition.');
        }
      } catch (error) {
        console.error('[VoiceChatButton] Failed to stop recording:', error);
        Alert.alert('Error', 'Failed to process voice input.');
      }
    } else {
      // Start recording
      try {
        const started = await VoiceService.startRecording();
        if (started) {
          setIsRecording(true);
        } else {
          Alert.alert('Error', 'Failed to start voice recording.');
        }
      } catch (error) {
        console.error('[VoiceChatButton] Failed to start recording:', error);
        Alert.alert('Error', 'Failed to start voice recording.');
      }
    }
  };

  const getButtonIcon = () => {
    if (isPlaying) {
      return <Volume2 size={20} color={theme.primaryForeground} />;
    } else if (isRecording) {
      return <MicOff size={20} color={theme.primaryForeground} />;
    } else {
      return <Mic size={20} color={theme.primaryForeground} />;
    }
  };

  const getButtonStyle = () => {
    if (disabled || !isConnected) {
      return [styles.button, styles.buttonDisabled];
    } else if (isRecording) {
      return [styles.button, styles.buttonRecording];
    } else if (isPlaying) {
      return [styles.button, styles.buttonPlaying];
    } else {
      return [styles.button, styles.buttonIdle];
    }
  };



  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={disabled || !isConnected}
        activeOpacity={0.8}
      >
        {getButtonIcon()}
      </TouchableOpacity>
    </Animated.View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  buttonIdle: {
    backgroundColor: theme.primary,
  },
  buttonRecording: {
    backgroundColor: '#ef4444', // Red for recording
  },
  buttonPlaying: {
    backgroundColor: '#10b981', // Green for playing
  },
  buttonDisabled: {
    backgroundColor: theme.muted,
    opacity: 0.5,
  },
}); 
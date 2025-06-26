import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { useTheme } from '@/context/theme-provider';

interface TranscribeButtonProps {
  onTranscript?: (transcript: string) => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onCancel?: () => void;
  onProcessing?: (isProcessing: boolean) => void;
}

export interface TranscribeButtonRef {
  cancelRecording: () => void;
  stopRecording: () => void;
  startRecording: () => void;
}

const TranscribeButton = forwardRef<TranscribeButtonRef, TranscribeButtonProps>(({ 
  onTranscript, 
  disabled = false,
  onRecordingStateChange,
  onCancel,
  onProcessing
}, ref) => {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));

  const styles = getStyles(theme);

  // Transcribe audio function (defined early for other functions)
  const transcribeAudio = async (audioUri: string) => {
    try {
      console.log('[TranscribeButton] Transcribing audio...');
      
      // Create FormData for the API request
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);
      formData.append('model', 'whisper-1');

      // Get OpenAI API key
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured');
      }

      // Send to OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.status}`);
      }

      const result = await response.json();
      const transcript = result.text?.trim();
      
      console.log('[TranscribeButton] Transcription result:', transcript);
      
      if (transcript && onTranscript) {
        onTranscript(transcript);
      } else {
        Alert.alert('No Speech Detected', 'Please try speaking more clearly.');
      }
    } catch (error) {
      console.error('[TranscribeButton] Transcription failed:', error);
      Alert.alert('Transcription Error', 'Failed to transcribe audio. Please try again.');
      onProcessing?.(false); // Clear processing state on transcription error
    }
  };

  // Cancel recording function (defined early for useImperativeHandle)
  const cancelRecording = async () => {
    try {
      console.log('[TranscribeButton] *** cancelRecording called via ref ***');
      console.log('[TranscribeButton] Current recording state:', !!recording);
      console.log('[TranscribeButton] Current isRecording state:', isRecording);
      
      if (!recording) {
        console.log('[TranscribeButton] No recording to cancel');
        return;
      }

      setIsRecording(false);
      onRecordingStateChange?.(false);
      await recording.stopAndUnloadAsync();
      setRecording(null);
      onCancel?.();
      console.log('[TranscribeButton] Recording canceled successfully');
    } catch (error) {
      console.error('[TranscribeButton] Failed to cancel recording:', error);
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setRecording(null);
    }
  };

  // Stop recording function (defined early for useImperativeHandle)
  const stopRecording = async () => {
    try {
      console.log('[TranscribeButton] *** stopRecording called via ref ***');
      console.log('[TranscribeButton] Current recording state:', !!recording);
      console.log('[TranscribeButton] Current isRecording state:', isRecording);
      
      if (!recording) {
        console.log('[TranscribeButton] No recording to stop');
        return;
      }

      setIsRecording(false);
      onRecordingStateChange?.(false);
      await recording.stopAndUnloadAsync();
      
      // Get the URI of the recorded audio
      const uri = recording.getURI();
      console.log('[TranscribeButton] Recording stopped, URI:', uri);
      
      if (uri) {
        // Notify that transcription processing is starting
        onProcessing?.(true);
        
        // Send to transcription
        await transcribeAudio(uri);
        
        // Notify that transcription processing is complete
        onProcessing?.(false);
      }
      
      setRecording(null);
      console.log('[TranscribeButton] stopRecording completed successfully');
    } catch (error) {
      console.error('[TranscribeButton] Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to process recording.');
      setIsRecording(false);
      onRecordingStateChange?.(false);
      onProcessing?.(false); // Clear processing state on error
      setRecording(null);
    }
  };

  // Expose cancel, stop, and start functions to parent
  useImperativeHandle(ref, () => ({
    cancelRecording,
    stopRecording,
    startRecording,
  }), [cancelRecording, stopRecording, startRecording, transcribeAudio]);

  // Initialize audio permissions
  useEffect(() => {
    initializeAudio();
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

  const initializeAudio = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable microphone access to use voice features.');
      }
    } catch (error) {
      console.error('[TranscribeButton] Failed to get audio permissions:', error);
    }
  };

  const startRecording = async () => {
    try {
      console.log('[TranscribeButton] Starting recording...');
      
      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      onRecordingStateChange?.(true);
      console.log('[TranscribeButton] Recording started');
    } catch (error) {
      console.error('[TranscribeButton] Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const handlePress = async () => {
    if (disabled) return;

    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const getButtonIcon = () => {
    if (isRecording) {
      return <MicOff size={20} color={theme.primaryForeground} />;
    } else {
      return <Mic size={20} color={theme.primaryForeground} />;
    }
  };

  const getButtonStyle = () => {
    if (disabled) {
      return [styles.button, styles.buttonDisabled];
    } else if (isRecording) {
      return [styles.button, styles.buttonRecording];
    } else {
      return [styles.button, styles.buttonIdle];
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={getButtonStyle()}
        onPress={handlePress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        {getButtonIcon()}
      </TouchableOpacity>
    </Animated.View>
  );
});

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
  buttonDisabled: {
    backgroundColor: theme.muted,
    opacity: 0.5,
  },
});

export default TranscribeButton;
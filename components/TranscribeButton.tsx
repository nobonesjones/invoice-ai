import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useRef } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Mic, MicOff, Loader2 } from 'lucide-react-native';
import { Audio } from 'expo-av';
import { useTheme } from '@/context/theme-provider';

interface TranscribeButtonProps {
  onTranscript?: (transcript: string) => void;
  disabled?: boolean;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onCancel?: () => void;
  onProcessing?: (isProcessing: boolean) => void;
  onAudioLevel?: (level: number) => void;
}

export interface TranscribeButtonRef {
  cancelRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  startRecording: () => Promise<void>;
}

const TranscribeButton = forwardRef<TranscribeButtonRef, TranscribeButtonProps>(({ 
  onTranscript, 
  disabled = false,
  onRecordingStateChange,
  onCancel,
  onProcessing,
  onAudioLevel
}, ref) => {
  const { theme } = useTheme();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [spinAnim] = useState(new Animated.Value(0));
  const audioLevelInterval = useRef<NodeJS.Timeout | null>(null);

  const styles = getStyles(theme);

  // Monitor audio levels during recording
  const startAudioLevelMonitoring = useCallback(() => {
    if (!recording || !onAudioLevel) return;

    audioLevelInterval.current = setInterval(async () => {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          // Convert metering to a 0-1 range for waveform visualization
          // Expo's metering is typically between -160 and 0 dB
          const normalizedLevel = Math.max(0, Math.min(1, (status.metering + 160) / 160));
          onAudioLevel(normalizedLevel);
        }
      } catch (error) {
        console.log('[TranscribeButton] Error getting audio level:', error);
      }
    }, 100); // Update every 100ms for smooth animation
  }, [recording, onAudioLevel]);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
  }, []);

  // Transcribe audio function (defined early for other functions)
  const transcribeAudio = async (audioUri: string) => {
    try {
      console.log('[TranscribeButton] Transcribing audio...');
      setIsProcessing(true);
      onProcessing?.(true);
      
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
    } finally {
      setIsProcessing(false);
      onProcessing?.(false);
    }
  };

  // Cancel recording function (defined early for useImperativeHandle)
  const cancelRecording = async () => {
    try {
      console.log('[TranscribeButton] *** cancelRecording called via ref ***');
      console.log('[TranscribeButton] Current recording state:', !!recording);
      console.log('[TranscribeButton] Current isRecording state:', isRecording);
      
      stopAudioLevelMonitoring();
      
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
      
      stopAudioLevelMonitoring();
      
      // Check if we're actually in a recording state
      if (!isRecording) {
        console.log('[TranscribeButton] Not currently recording, ignoring stop request');
        return;
      }
      
      if (!recording) {
        console.log('[TranscribeButton] No recording object but isRecording is true, resetting state');
        setIsRecording(false);
        onRecordingStateChange?.(false);
        return;
      }

      console.log('[TranscribeButton] Proceeding to stop recording...');
      
      // Get the URI before stopping
      const uri = recording.getURI();
      console.log('[TranscribeButton] Recording URI before stop:', uri);
      
      // Stop the recording
      await recording.stopAndUnloadAsync();
      console.log('[TranscribeButton] Recording stopped successfully');
      
      // Update states
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setRecording(null);
      
      if (uri) {
        console.log('[TranscribeButton] Sending for transcription...');
        // Send to transcription (processing state handled in transcribeAudio)
        await transcribeAudio(uri);
      } else {
        console.log('[TranscribeButton] No URI available for transcription');
      }
      
      console.log('[TranscribeButton] stopRecording completed successfully');
    } catch (error) {
      console.error('[TranscribeButton] Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to process recording.');
      // Force reset states on error
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setRecording(null);
      stopAudioLevelMonitoring();
    }
  };

  // Expose cancel, stop, and start functions to parent
  useImperativeHandle(ref, () => ({
    cancelRecording,
    stopRecording,
    startRecording,
  }), []);

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

  // Spinning animation for processing state
  useEffect(() => {
    if (isProcessing) {
      const spin = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spin.start();
      return () => spin.stop();
    } else {
      spinAnim.setValue(0);
    }
  }, [isProcessing, spinAnim]);

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
      console.log('[TranscribeButton] *** startRecording called ***');
      console.log('[TranscribeButton] Current isRecording state:', isRecording);
      console.log('[TranscribeButton] Current recording object:', !!recording);
      
      // Configure audio mode for recording with metering enabled
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording with metering enabled
      const { recording: newRecording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true, // Enable audio level monitoring
      });
      
      setRecording(newRecording);
      setIsRecording(true);
      onRecordingStateChange?.(true);
      
      // Start monitoring audio levels
      setTimeout(() => {
        startAudioLevelMonitoring();
      }, 100); // Small delay to ensure recording is fully started
      
      console.log('[TranscribeButton] Recording started successfully with metering enabled');
    } catch (error) {
      console.error('[TranscribeButton] Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioLevelMonitoring();
    };
  }, [stopAudioLevelMonitoring]);

  const handlePress = async () => {
    console.log('[TranscribeButton] *** handlePress called ***');
    console.log('[TranscribeButton] disabled:', disabled);
    console.log('[TranscribeButton] isProcessing:', isProcessing);
    console.log('[TranscribeButton] isRecording:', isRecording);
    
    if (disabled || isProcessing) {
      console.log('[TranscribeButton] handlePress ignored - button disabled or processing');
      return;
    }

    if (isRecording) {
      console.log('[TranscribeButton] handlePress - stopping recording');
      await stopRecording();
    } else {
      console.log('[TranscribeButton] handlePress - starting recording');
      await startRecording();
    }
  };

  const getButtonIcon = () => {
    if (isProcessing) {
      const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      });
      
      return (
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <Loader2 size={20} color={theme.primaryForeground} />
        </Animated.View>
      );
    } else if (isRecording) {
      return <MicOff size={20} color={theme.primaryForeground} />;
    } else {
      return <Mic size={20} color={theme.primaryForeground} />;
    }
  };

  const getButtonStyle = () => {
    if (disabled || isProcessing) {
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
        disabled={disabled || isProcessing}
        activeOpacity={0.8}
      >
        {getButtonIcon()}
      </TouchableOpacity>
    </Animated.View>
  );
});

const getStyles = (theme: any) => StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
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
        // Check if recording is still valid
        if (!recording) {
          console.log('[TranscribeButton] Recording object lost during monitoring, stopping interval');
          stopAudioLevelMonitoring();
          return;
        }

        const status = await recording.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          // Convert metering to a 0-1 range for waveform visualization
          // Expo's metering is typically between -160 and 0 dB
          const normalizedLevel = Math.max(0, Math.min(1, (status.metering + 160) / 160));
          onAudioLevel(normalizedLevel);
        } else if (!status.isRecording) {
          console.log('[TranscribeButton] Recording stopped during monitoring, cleaning up');
          stopAudioLevelMonitoring();
        }
      } catch (error) {
        console.log('[TranscribeButton] Error getting audio level:', error);
        // If we can't get status, assume recording is problematic
        stopAudioLevelMonitoring();
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
      console.log('[TranscribeButton] Transcribing audio from URI:', audioUri);
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

      console.log('[TranscribeButton] Sending transcription request to OpenAI...');

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Transcription timeout after 30 seconds')), 30000);
      });

      // Send to OpenAI Whisper API with timeout
      const response = await Promise.race([
        fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
          body: formData,
        }),
        timeoutPromise
      ]);

      console.log('[TranscribeButton] Received response from OpenAI, status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TranscribeButton] OpenAI error response:', errorText);
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      const transcript = result.text?.trim();
      
      console.log('[TranscribeButton] Transcription result:', transcript);
      
      if (transcript && transcript.length > 0 && onTranscript) {
        console.log('[TranscribeButton] Calling onTranscript with:', transcript);
        onTranscript(transcript);
      } else {
        console.log('[TranscribeButton] No transcript or empty transcript received');
        Alert.alert('No Speech Detected', 'Please try speaking more clearly.');
      }
    } catch (error) {
      console.error('[TranscribeButton] Transcription failed:', error);
      Alert.alert('Transcription Error', 'Failed to transcribe audio. Please try again.');
    } finally {
      console.log('[TranscribeButton] Transcription process completed');
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
      
      // Check if we have a recording object (more reliable than isRecording state)
      if (!recording) {
        console.log('[TranscribeButton] No recording object available');
        
        // Reset states to be consistent
        if (isRecording) {
          console.log('[TranscribeButton] Resetting inconsistent isRecording state');
          setIsRecording(false);
          onRecordingStateChange?.(false);
        }
        return;
      }

      console.log('[TranscribeButton] Proceeding to stop recording...');
      
      // Check if recording is actually active
      let recordingStatus;
      let uri = null;
      
      try {
        recordingStatus = await recording.getStatusAsync();
        console.log('[TranscribeButton] Recording status:', recordingStatus.isRecording ? 'active' : 'inactive');
        
        // Get the URI before any stop operations
        uri = recording.getURI();
        console.log('[TranscribeButton] Recording URI:', uri);
        
        // Only try to stop if recording is still active
        if (recordingStatus.isRecording) {
          console.log('[TranscribeButton] Recording is active, stopping...');
          await recording.stopAndUnloadAsync();
          console.log('[TranscribeButton] Recording stopped successfully');
        } else {
          console.log('[TranscribeButton] Recording already stopped, just unloading...');
          // Recording already stopped, but we still need to unload to clean up
          try {
            await recording.stopAndUnloadAsync();
            console.log('[TranscribeButton] Recording unloaded successfully');
          } catch (unloadError) {
            console.log('[TranscribeButton] Recording already unloaded:', unloadError.message);
            // This is fine, recording was already cleaned up
          }
        }
      } catch (statusError) {
        console.log('[TranscribeButton] Could not get recording status:', statusError);
        // Try to get URI anyway
        try {
          uri = recording.getURI();
          console.log('[TranscribeButton] Got URI despite status error:', uri);
        } catch (uriError) {
          console.log('[TranscribeButton] Could not get URI:', uriError);
        }
        
        // Try to stop anyway, but catch any errors
        try {
          await recording.stopAndUnloadAsync();
          console.log('[TranscribeButton] Recording stopped despite status error');
        } catch (stopError) {
          console.log('[TranscribeButton] Stop failed (expected if already stopped):', stopError.message);
        }
      }
      
      // Update states
      setIsRecording(false);
      onRecordingStateChange?.(false);
      setRecording(null);
      
      // Proceed with transcription if we have a URI
      if (uri) {
        console.log('[TranscribeButton] Sending for transcription...');
        await transcribeAudio(uri);
      } else {
        console.log('[TranscribeButton] No URI available for transcription');
        Alert.alert('Recording Error', 'Could not access the recorded audio. Please try again.');
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
      
      // Clean up any existing recording first
      if (recording) {
        console.log('[TranscribeButton] Cleaning up existing recording before starting new one');
        try {
          await recording.stopAndUnloadAsync();
        } catch (cleanupError) {
          console.log('[TranscribeButton] Error cleaning up existing recording:', cleanupError);
        }
        setRecording(null);
      }
      
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
      
      console.log('[TranscribeButton] New recording object created:', !!newRecording);
      
      // Verify recording is actually started
      const initialStatus = await newRecording.getStatusAsync();
      console.log('[TranscribeButton] Initial recording status:', initialStatus.isRecording ? 'active' : 'inactive');
      
      setRecording(newRecording);
      setIsRecording(true);
      onRecordingStateChange?.(true);
      
      // Start monitoring audio levels with a delay to ensure recording is fully started
      setTimeout(() => {
        if (newRecording) {
          console.log('[TranscribeButton] Starting audio level monitoring...');
          startAudioLevelMonitoring();
        }
      }, 100);
      
      console.log('[TranscribeButton] Recording started successfully with metering enabled');
    } catch (error) {
      console.error('[TranscribeButton] Failed to start recording:', error);
      // Clean up states on error
      setRecording(null);
      setIsRecording(false);
      onRecordingStateChange?.(false);
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
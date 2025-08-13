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
  const [pulseAnim] = useState(new Animated.Value(1));
  const [spinAnim] = useState(new Animated.Value(0));
  const recordingRef = useRef<Audio.Recording | null>(null);
  const audioLevelInterval = useRef<any>(null);

  const styles = getStyles(theme);

  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelInterval.current) {
      clearInterval(audioLevelInterval.current);
      audioLevelInterval.current = null;
    }
  }, []);

  const startAudioLevelMonitoring = useCallback(() => {
    if (!recordingRef.current || !onAudioLevel) return;

    // Clear any existing interval first
    stopAudioLevelMonitoring();

    audioLevelInterval.current = setInterval(async () => {
      try {
        if (!recordingRef.current) {
          console.log('[TranscribeButton] Recording object lost during monitoring, stopping interval');
          stopAudioLevelMonitoring();
          return;
        }

        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          const normalizedLevel = Math.max(0, Math.min(1, (status.metering + 160) / 160));
          onAudioLevel(normalizedLevel);
        } else if (!status.isRecording) {
          console.log('[TranscribeButton] Recording stopped during monitoring, cleaning up');
          stopAudioLevelMonitoring();
        }
      } catch (error: any) {
        // Suppress the common -50 error spam
        if (!error.message?.includes('-50') && !error.toString().includes('-50')) {
          console.log('[TranscribeButton] Error getting audio level:', error);
        }
        stopAudioLevelMonitoring();
      }
    }, 200); // Increased interval from 100ms to 200ms to reduce frequency
  }, [onAudioLevel, stopAudioLevelMonitoring]);

  const transcribeAudio = useCallback(async (audioUri: string) => {
    console.log(`[TranscribeButton] Attempting to transcribe audio from URI: ${audioUri}`);
    try {
      console.log('[TranscribeButton] Transcribing audio from URI:', audioUri);
      setIsProcessing(true);
      onProcessing?.(true);
      
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      } as any);

      console.log('[TranscribeButton] Sending transcription request to edge function...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/functions/v1/ai-transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_ANON_KEY}`,
          'apikey': process.env.EXPO_PUBLIC_ANON_KEY!,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('[TranscribeButton] Received response from edge function, status:', response.status);

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`[TranscribeButton] Edge Function Error (${response.status}):`, errorBody);
        throw new Error(`Transcription Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[TranscribeButton] Transcription successful:', data.text);

      if (data.text && onTranscript) {
        onTranscript(data.text);
      } else {
        console.log('[TranscribeButton] No transcript or empty transcript received');
        Alert.alert('No Speech Detected', 'Please try speaking more clearly.');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error('[TranscribeButton] Transcription request timed out.');
        Alert.alert('Transcription Error', 'The request timed out. Please check your network connection and try again.');
      } else {
        console.error('[TranscribeButton] Error during transcription:', error);
        Alert.alert('Transcription Error', `An unexpected error occurred: ${error.message}`);
      }
    } finally {
      console.log('[TranscribeButton] Transcription process completed');
      setIsProcessing(false);
      onProcessing?.(false);
    }
  }, [onTranscript, onProcessing]);

  const startRecording = useCallback(async () => {
    try {
      console.log('[TranscribeButton] *** startRecording called ***');

      if (recordingRef.current) {
        console.log('[TranscribeButton] Cleaning up existing recording before starting new one');
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      recordingRef.current = newRecording;
      setIsRecording(true);
      onRecordingStateChange?.(true);

      setTimeout(() => {
        if (recordingRef.current) {
          console.log('[TranscribeButton] Starting audio level monitoring...');
          startAudioLevelMonitoring();
        }
      }, 100);

      console.log('[TranscribeButton] Recording started successfully with metering enabled');
    } catch (error: any) {
      console.error('[TranscribeButton] Failed to start recording:', error);
      recordingRef.current = null;
      setIsRecording(false);
      onRecordingStateChange?.(false);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  }, [onRecordingStateChange, startAudioLevelMonitoring]);

  const stopRecording = useCallback(async () => {
    try {
      console.log('[TranscribeButton] *** stopRecording called ***');
      console.log('[TranscribeButton] Current recording object:', !!recordingRef.current);
      console.log('[TranscribeButton] Current isRecording state:', isRecording);

      stopAudioLevelMonitoring();

      if (!recordingRef.current) {
        console.log('[TranscribeButton] No recording object available, resetting state if inconsistent.');
        if (isRecording) {
          setIsRecording(false);
          onRecordingStateChange?.(false);
        }
        return;
      }

      console.log('[TranscribeButton] Proceeding to stop recording...');
      let uri = null;
      try {
        uri = recordingRef.current.getURI();
        console.log('[TranscribeButton] Recording URI:', uri);
        await recordingRef.current.stopAndUnloadAsync();
        console.log('[TranscribeButton] Recording stopped and unloaded successfully');
      } catch (error: any) {
        console.error('[TranscribeButton] Error stopping and unloading recording:', error);
        if (!uri) {
          try {
            uri = recordingRef.current.getURI();
            console.log('[TranscribeButton] Got URI despite stop error:', uri);
          } catch (uriError: any) {
            console.error('[TranscribeButton] Failed to get URI after stop error:', uriError);
          }
        }
      }

      recordingRef.current = null;
      setIsRecording(false);
      onRecordingStateChange?.(false);

      if (uri) {
        console.log('[TranscribeButton] Sending for transcription...');
        await transcribeAudio(uri);
      } else {
        console.log('[TranscribeButton] No URI available for transcription');
        Alert.alert('Recording Error', 'Could not access the recorded audio. Please try again.');
      }

      console.log('[TranscribeButton] stopRecording completed successfully');
    } catch (error: any) {
      console.error('[TranscribeButton] Critical failure in stopRecording:', error);
      Alert.alert('Error', 'Failed to process recording.');
      recordingRef.current = null;
      setIsRecording(false);
      onRecordingStateChange?.(false);
      stopAudioLevelMonitoring();
    }
  }, [isRecording, onRecordingStateChange, stopAudioLevelMonitoring, transcribeAudio]);

  const cancelRecording = useCallback(async () => {
    try {
      console.log('[TranscribeButton] *** cancelRecording called ***');
      stopAudioLevelMonitoring();

      if (recordingRef.current) {
        console.log('[TranscribeButton] Unloading recording...');
        await recordingRef.current.stopAndUnloadAsync();
        console.log('[TranscribeButton] Recording unloaded successfully');
      } else {
        console.log('[TranscribeButton] No active recording to cancel');
      }
    } catch (error: any) {
      console.error('[TranscribeButton] Error cancelling recording:', error);
    } finally {
      recordingRef.current = null;
      setIsRecording(false);
      setIsProcessing(false);
      onRecordingStateChange?.(false);
      onProcessing?.(false);
      onCancel?.();
      console.log('[TranscribeButton] Cancel recording completed');
    }
  }, [onCancel, onProcessing, onRecordingStateChange, stopAudioLevelMonitoring]);

  // Expose cancel, stop, and start functions to parent
  useImperativeHandle(ref, () => ({
    cancelRecording,
    stopRecording,
    startRecording,
  }), [cancelRecording, stopRecording, startRecording]);

  // Initialize audio permissions
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Required', 'Please enable microphone access to use voice features.');
        }
      } catch (error: any) {
        console.error('[TranscribeButton] Failed to get audio permissions:', error);
      }
    };
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[TranscribeButton] Unmounting component, ensuring cleanup...');
      stopAudioLevelMonitoring();
      if (recordingRef.current) {
        console.log('[TranscribeButton] Found active recording on unmount, unloading...');
        recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
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
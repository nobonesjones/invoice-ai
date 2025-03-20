import { useState, useCallback } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface UseTestRecorderProps {
  onRecordingComplete?: (uri: string) => Promise<void>;
  onError?: (error: string) => void;
}

export const useTestRecorder = ({ onRecordingComplete, onError }: UseTestRecorderProps) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const startRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        onError?.('Permission to record was denied');
        return false;
      }

      // Set audio mode with a unique identifier for testing
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      // Start recording with test-specific options
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
      return true;
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to start recording');
      return false;
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) {
        onError?.('No active recording found');
        return;
      }

      setIsProcessing(true);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (!uri) {
        throw new Error('No recording URI available');
      }

      // Get file info for testing
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      console.log('Test recording file info:', fileInfo);

      // Call the completion handler with the URI
      if (onRecordingComplete) {
        await onRecordingComplete(uri);
      }

      // Clean up
      setRecording(null);
      setIsRecording(false);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to stop recording');
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    recording,
    isRecording,
    isProcessing,
    startRecording,
    stopRecording
  };
};

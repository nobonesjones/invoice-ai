import { useState, useEffect, useRef } from 'react';
import { Audio } from 'expo-av';
import { supabase } from '@/config/supabase';
import * as FileSystem from 'expo-file-system';
import { Platform, AppState } from 'react-native';

// Define constants for audio configuration
const INTERRUPTION_MODE_IOS_DO_NOT_MIX = 1;
const INTERRUPTION_MODE_ANDROID_DO_NOT_MIX = 1;

interface UseAudioRecorderProps {
  meetingId?: string;
  onRecordingComplete?: (uri: string) => void;
  onError?: (error: string) => void;
}

export function useAudioRecorder({ 
  meetingId, 
  onRecordingComplete, 
  onError 
}: UseAudioRecorderProps = {}) {
  // State variables
  const [recording, setRecording] = useState<null | Audio.Recording>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for stable values across re-renders
  const meetingIdRef = useRef<string | undefined>(meetingId);
  const recordingRef = useRef<null | Audio.Recording>(null);
  const appState = useRef(AppState.currentState);
  
  // Update refs when props change
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        console.log('App going to background, checking recording state...');
        if (isRecording && recordingRef.current) {
          console.log('Recording in progress, stopping before app goes to background');
          stopRecording(meetingIdRef.current as string).catch(err => {
            console.error('Error stopping recording on app state change:', err);
          });
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('Audio recorder hook unmounting, cleaning up resources...');
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = async () => {
    try {
      console.log('Running cleanup...');
      
      // Clean up recording if it exists
      if (recordingRef.current) {
        try {
          console.log('Unloading recording...');
          await recordingRef.current.stopAndUnloadAsync();
        } catch (err) {
          console.error('Error unloading recording:', err);
        }
        recordingRef.current = null;
      }
      
      // Reset state
      setRecording(null);
      setIsRecording(false);
      setIsUploading(false);
      
      console.log('Cleanup complete');
    } catch (err) {
      console.error('Error in cleanup:', err);
    }
  };

  // Start recording function
  const startRecording = async () => {
    try {
      // Clear any existing error
      setError(null);
      
      console.log('Starting recording...');
      
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        const errorMsg = 'Permission to access microphone was denied';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return false;
      }

      // Configure audio session
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        interruptionModeAndroid: INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false
      });
      
      // Create and start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      // Update state and refs
      setRecording(recording);
      recordingRef.current = recording;
      setIsRecording(true);
      
      console.log('Recording started successfully');
      return true;
    } catch (err) {
      const errorMsg = `Failed to start recording: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return false;
    }
  };

  // Stop recording function
  const stopRecording = async (currentMeetingId: string) => {
    console.log(`[LOG AUDIO HOOK ${new Date().toISOString()}] ENTERING stopRecording. isRecording=${isRecording}, passedMeetingId=${currentMeetingId}`);
    try {
      if (!recordingRef.current) {
        const errorMsg = 'No active recording to stop';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return null;
      }

      console.log('Stopping recording...');
      const status = await recordingRef.current.stopAndUnloadAsync(); // Capture status
      console.log('Recording stopped, status:', status);

      // Extract duration in milliseconds
      const durationMillis = status.durationMillis;

      const uri = recordingRef.current.getURI();
      console.log('Recording URI:', uri);
      
      // Clear recording state
      setRecording(null);
      setIsRecording(false);
      
      // Store current recording reference before clearing
      const currentRecording = recordingRef.current;
      recordingRef.current = null;

      if (!uri) {
        const errorMsg = 'Recording URI is undefined after stopping';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return null;
      }

      if (!currentMeetingId) {
        const errorMsg = 'No meeting ID provided to stopRecording function';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        if (onRecordingComplete) onRecordingComplete(uri);
        return null;
      }

      try {
        console.log('Calling uploadToSupabase...');
        // Pass durationMillis to uploadToSupabase
        const publicUrl = await uploadToSupabase(uri, currentMeetingId, durationMillis);

        // Log the duration being passed
        console.log(`Duration passed to uploadToSupabase: ${durationMillis}ms`);

        if (onRecordingComplete) {
          console.log(`[LOG AUDIO HOOK ${new Date().toISOString()}] BEFORE calling onRecordingComplete from stopRecording. URI: ${uri}`);
          onRecordingComplete(uri);
        }

        return uri;
      } catch (uploadError) {
        console.error('Error uploading recording:', uploadError);
        setError(`Failed to upload recording: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        if (onError) onError(`Failed to upload recording: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        return uri; // Still return the URI even if upload failed
      }
    } catch (err) {
      const errorMsg = `Error stopping recording: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return null;
    }
  };

  // Upload recording to Supabase
  // Add durationMillis parameter
  const uploadToSupabase = async (
    uri: string, 
    meetingId: string, 
    durationMillis: number): Promise<string> => {
    console.log(`[LOG AUDIO HOOK ${new Date().toISOString()}] ENTERING uploadToSupabase. URI: ${uri}, MeetingID: ${meetingId}`);
    // Removed isUploading state management as it's handled in recording screen now
    // setError(null);

    try {
      console.log('Starting upload to Supabase...', { uri, meetingId });

      // Check if file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      console.log('File info:', fileInfo);

      if (!fileInfo.exists) {
        const errorMsg = 'Recording file not found';
        console.error(errorMsg);
        // setError(errorMsg);
        // if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      if (!fileInfo.size || fileInfo.size <= 0) {
        const errorMsg = 'Recording file is empty';
        console.error(errorMsg);
        // setError(errorMsg);
        // if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      // Check if the meetings bucket exists (optional, handled by RLS/policy usually)
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        console.log('Available buckets:', buckets);
        if (bucketsError) {
          console.warn('Could not list buckets (might be RLS):', bucketsError.message);
        }
        const meetingsBucketExists = buckets?.some(bucket => bucket.name === 'meetings');
        console.log('Meetings bucket exists (or check skipped):', meetingsBucketExists ?? 'Check Skipped');
        // We will proceed assuming the bucket exists or policies allow the upload
      } catch (bucketError) {
        console.warn('Error checking buckets:', bucketError);
      }

      // --- NEW: Use FormData ---
      console.log('Preparing FormData for upload...');
      const formData = new FormData();
      const file = {
          uri: uri,
          name: 'audio.m4a', // Name for the file field in FormData
          type: 'audio/m4a'  // Use standard MIME type
      };
      formData.append('file', file as any); // 'file' is the field name

      // Optional: Log FormData contents (might not show blob details)
      // console.log('FormData prepared:', formData); // This might not be very informative for blobs

      // Verify the file object within FormData (conceptual check)
      const appendedFile = formData.get('file');
      if (!appendedFile || typeof appendedFile === 'string' || !('size' in appendedFile) || appendedFile.size === 0) {
           // Note: Direct size check might not work reliably here depending on FormData implementation.
           // The real check is whether Supabase upload succeeds with content.
           console.warn("Could not reliably verify FormData file content before upload, proceeding.");
      }
      // --- END: Use FormData ---

      // Upload to Supabase Storage
      const fileName = `${meetingId}/audio.m4a`;
      console.log('Uploading FormData to path:', fileName);

      // *** Pass FormData directly ***
      const { error: uploadError, data } = await supabase.storage
        .from('meetings')
        .upload(fileName, formData, { // Pass FormData object
          // contentType is often inferred from FormData, but we specify to be sure
          contentType: 'audio/m4a', // Use standard type with FormData
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        // setError(`Upload error: ${uploadError.message}`);
        // if (onError) onError(`Upload error: ${uploadError.message}`);
        throw uploadError;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('meetings')
        .getPublicUrl(data.path); // Use path from successful upload data

       if (!urlData || !urlData.publicUrl) {
            console.error('Failed to get public URL for uploaded file.');
            throw new Error('Failed to get public URL.');
        }
        const publicUrl = urlData.publicUrl;
      console.log('Public URL:', publicUrl);

      // Update meeting with audio URL
      console.log('Updating meeting record with audio URL...');
      const { error: updateError, data: updateData } = await supabase
        .from('meetings')
        .update({
          audio_url: publicUrl,
          status: 'processing',
          // Add duration, converting ms to seconds (adjust if DB stores ms)
          duration: Math.round(durationMillis / 1000) 
        })
        .eq('id', meetingId)
        .select();

      console.log('Update result:', { error: updateError, data: updateData });

      if (updateError) {
        console.error('Update error:', updateError);
        // Simplified error handling, re-throwing
        // setError(`Database update error: ${updateError.message}`);
        // if (onError) onError(`Database update error: ${updateError.message}`);
        throw updateError;
      }

      return publicUrl;

    } catch (err) {
      console.error('Error in uploadToSupabase:', err);
      // Ensure status is updated to error on any failure during upload/DB update
       try {
         await supabase
           .from('meetings')
           .update({ status: 'error' })
           .eq('id', meetingId);
       } catch (statusUpdateError) {
         console.error('Failed to update meeting status to error:', statusUpdateError);
       }
      throw err; // Re-throw original error
    } // Removed finally block for setIsUploading
  };

  // --- Transcription & Minutes ---

  return {
    isRecording,
    isUploading,
    recording,
    startRecording,
    stopRecording,
    error
  };
}
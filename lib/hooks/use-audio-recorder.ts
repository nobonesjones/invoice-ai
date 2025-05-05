import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Audio, 
  InterruptionModeIOS, 
  InterruptionModeAndroid
} from 'expo-av';
import { supabase } from '@/config/supabase';
import * as FileSystem from 'expo-file-system';
import { Platform, AppState } from 'react-native';

// Define constants for audio configuration
const INTERRUPTION_MODE_IOS_DO_NOT_MIX = InterruptionModeIOS.DoNotMix;
const INTERRUPTION_MODE_ANDROID_DO_NOT_MIX = InterruptionModeAndroid.DoNotMix;
const METERING_UPDATE_INTERVAL = 100; // ms - How often to update audio level
const MIN_DBFS = -60; // dBFS value to treat as minimum (maps to 0.0)
const MAX_DBFS = 0;   // dBFS value to treat as maximum (maps to 1.0)

interface UseAudioRecorderProps {
  meetingId?: string;
  onRecordingComplete?: (uri: string) => void;
  onError?: (error: string) => void;
}

interface StopRecordingResult {
  uri: string | null;
  durationMillis: number;
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
  const [audioLevel, setAudioLevel] = useState(0); // Normalized 0-1
  const [isPaused, setIsPaused] = useState(false); // New state for paused status

  // Refs for stable values across re-renders
  const meetingIdRef = useRef<string | undefined>(meetingId);
  const recordingRef = useRef<null | Audio.Recording>(null);
  const meteringIntervalRef = useRef<number | null>(null); // Changed type to number | null
  const appState = useRef(AppState.currentState);
  
  // Update refs when props change
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const currentAppState = appState.current; // Capture current state
      appState.current = nextAppState;
      console.log(`AppState changed from ${currentAppState} to ${nextAppState}`);

      if (currentAppState.match(/active|foreground/) && nextAppState.match(/inactive|background/)) {
        console.log('App going to background, checking recording state...');
        // Use the state value directly, not the ref, as it reflects the current render cycle
        if (isRecording && !isPaused) { // Only pause if actively recording and not already paused
          console.log('Recording in progress and not paused, pausing before app goes to background');
          // Call the pause function directly
          pauseRecording().catch(err => { // Use the new pause function
            console.error('Error pausing recording on app state change:', err);
            // Optionally set an error state or notify the user
            setError('Failed to pause recording automatically.');
            if (onError) onError('Failed to pause recording automatically.');
          });
        } else if (isRecording && isPaused) {
          console.log('Recording is already paused, doing nothing.');
        } else {
          console.log('Not recording or already paused, doing nothing.');
        }
      }
      // Optional: Handle coming back to foreground (e.g., require manual resume)
      // else if (currentAppState.match(/inactive|background/) && nextAppState === 'active') {
      //   console.log('App coming to foreground.');
      //   // Decide if you want to auto-resume or require manual action
      // }
    });

    return () => {
      subscription.remove();
    };
  }, [isRecording, isPaused]); // Add isPaused to dependency array

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
      
      // Clear metering interval
      if (meteringIntervalRef.current) {
        clearInterval(meteringIntervalRef.current);
        meteringIntervalRef.current = null;
      }
      setAudioLevel(0);
      
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
      setIsPaused(false); // Reset paused state

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
      
      // Define explicit recording options instead of preset
      const customRecordingOptions: Audio.RecordingOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1, // Use 1 channel for potentially better compatibility
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1, // Use 1 channel for potentially better compatibility
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: { // Add basic web options if needed, though likely not primary target
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        }
      };

      console.log('Creating recording with custom options:', customRecordingOptions);

      // Create and start recording using custom options
      const { recording } = await Audio.Recording.createAsync(
        customRecordingOptions // Use custom options object
      );
      
      // Update state and refs
      setRecording(recording);
      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false); // Ensure not paused when starting
      setAudioLevel(0); // Reset level on new recording start
      
      console.log('Recording started successfully');
      
      // Start metering interval
      if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = setInterval(async () => {
        if (recordingRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              // Normalize the dBFS value
              const normalizedLevel = Math.max(
                0,
                Math.min(1, (status.metering - MIN_DBFS) / (MAX_DBFS - MIN_DBFS))
              );
              setAudioLevel(normalizedLevel); 
            } else if (!status.isRecording) {
                // If status says not recording, stop the interval
                if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
                meteringIntervalRef.current = null;
                setAudioLevel(0);
            }
          } catch (statusError) {
            console.error('Error getting recording status for metering:', statusError);
            // Stop interval on error to prevent spamming
            if (meteringIntervalRef.current) clearInterval(meteringIntervalRef.current);
            meteringIntervalRef.current = null;
            setAudioLevel(0);
          }
        }
      }, METERING_UPDATE_INTERVAL);
      
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
  const stopRecording = async (currentMeetingId: string): Promise<StopRecordingResult> => {
    console.log(`[LOG AUDIO HOOK ${new Date().toISOString()}] ENTERING stopRecording. isRecording=${isRecording}, passedMeetingId=${currentMeetingId}`);
    let durationMillis = 0; // Initialize duration
    let finalUri: string | null = null; // Initialize URI

    try {
      // Stop metering interval
      if (meteringIntervalRef.current) {
        clearInterval(meteringIntervalRef.current);
        meteringIntervalRef.current = null;
      }
      setAudioLevel(0); // Reset level on stop

      if (!recordingRef.current) {
        const errorMsg = 'No active recording to stop';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return { uri: null, durationMillis: 0 }; // Return default object
      }

      // --- Get status BEFORE stopping --- 
      try {
        const statusBeforeStop = await recordingRef.current.getStatusAsync();
        if (statusBeforeStop.isRecording) {
          durationMillis = statusBeforeStop.durationMillis ?? 0;
          console.log(`[LOG AUDIO HOOK] Status BEFORE stop: durationMillis = ${durationMillis}`);
        } else {
          console.warn('[LOG AUDIO HOOK] Recording status showed not recording before stop command.');
        }
      } catch (statusError) {
        console.error('[LOG AUDIO HOOK] Error getting status before stop:', statusError);
        // Continue stopping even if getting status fails, but duration might be 0
      }
      // --- End get status before stopping ---

      console.log('Stopping recording...');
      await recordingRef.current.stopAndUnloadAsync(); // Stop and unload (ignore status here)
      console.log('Recording stopped and unloaded.');

      // Get URI *after* stopping (might still work, documentation is a bit ambiguous)
      // If getURI fails after unload, we might need to store it from statusBeforeStop if available
      finalUri = recordingRef.current.getURI(); 
      console.log('Recording URI:', finalUri);
      
      // Clear recording state
      setRecording(null);
      setIsRecording(false); // Ensure isRecording is false after stop
      setIsPaused(false); // Ensure not paused when stopped

      // Store current recording reference before clearing
      const currentRecording = recordingRef.current;
      recordingRef.current = null;

      if (!finalUri) {
        const errorMsg = 'Recording URI is undefined after stopping';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return { uri: null, durationMillis: durationMillis }; // Return object
      }

      if (!currentMeetingId) {
        const errorMsg = 'No meeting ID provided to stopRecording function';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        if (onRecordingComplete) onRecordingComplete(finalUri);
        return { uri: finalUri, durationMillis: durationMillis }; // Return object
      }

      try {
        console.log('Calling uploadToSupabase...');
        // Pass durationMillis to uploadToSupabase
        const publicUrl = await uploadToSupabase(finalUri, currentMeetingId, durationMillis);

        // Log the duration being passed
        console.log(`Duration passed to uploadToSupabase: ${durationMillis}ms`);

        if (onRecordingComplete) {
          console.log(`[LOG AUDIO HOOK ${new Date().toISOString()}] BEFORE calling onRecordingComplete from stopRecording. URI: ${finalUri}`);
          onRecordingComplete(finalUri);
        }

        return { uri: finalUri, durationMillis: durationMillis }; // Return object
      } catch (uploadError) {
        console.error('Error uploading recording:', uploadError);
        setError(`Failed to upload recording: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        if (onError) onError(`Failed to upload recording: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
        return { uri: finalUri, durationMillis: durationMillis }; // Still return the object even if upload failed
      }
    } catch (err) {
      const errorMsg = `Error stopping recording: ${err instanceof Error ? err.message : String(err)}`;
      console.error(errorMsg);
      setError(errorMsg);
      if (onError) onError(errorMsg);
      return { uri: null, durationMillis: 0 }; // Return object on error
    }
  };

  // Upload recording to Supabase
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

  // --- Metering Functions ---
  const startMetering = () => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
    }
    meteringIntervalRef.current = setInterval(async () => {
      if (recordingRef.current) {
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // Normalize the dBFS value to a 0-1 range
            const normalizedLevel = Math.max(0, Math.min(1, (status.metering - MIN_DBFS) / (MAX_DBFS - MIN_DBFS)));
            setAudioLevel(normalizedLevel);
          }
        } catch (meteringError) {
          // console.warn('Error getting recording status for metering:', meteringError);
          // Stop metering if there's an error (e.g., recording stopped unexpectedly)
          stopMetering(); 
        }
      }
    }, METERING_UPDATE_INTERVAL);
  };

  const stopMetering = () => {
    if (meteringIntervalRef.current) {
      clearInterval(meteringIntervalRef.current);
      meteringIntervalRef.current = null;
    }
    setAudioLevel(0); // Reset audio level when stopping
  };

  // --- Pause/Resume Functions ---
  const pauseRecording = useCallback(async () => {
    console.log('Attempting to pause recording...');
    if (!recordingRef.current || !isRecording || isPaused) {
      console.log('Cannot pause: Not recording, already paused, or no recording object.');
      return;
    }
    try {
      await recordingRef.current.pauseAsync();
      stopMetering(); // Stop updating audio level
      setIsPaused(true);
      console.log('Recording paused successfully.');
    } catch (err: any) {
      const errorMsg = `Failed to pause recording: ${err.message || err}`;
      console.error(errorMsg, err);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [isRecording, isPaused, onError]);

  const resumeRecording = useCallback(async () => {
    console.log('Attempting to resume recording...');
    if (!recordingRef.current || !isRecording || !isPaused) {
      console.log('Cannot resume: Not recording, not paused, or no recording object.');
      return;
    }
    try {
      // Expo AV doesn't have a distinct 'resume'. We manage state and restart metering.
      // The underlying recording is expected to continue when read from.
      // *** ADD: Call startAsync() on the existing recording instance to resume audio capture ***
      await recordingRef.current.startAsync(); 

      setIsPaused(false);
      startMetering(); // Restart audio level updates
      console.log('Recording resumed successfully (state updated, metering restarted, startAsync called).');
    } catch (err: any) {
      // This block might be less likely to error as we're just managing state/interval
      const errorMsg = `Failed to resume recording: ${err.message || err}`;
      console.error(errorMsg, err);
      setError(errorMsg);
      if (onError) onError(errorMsg);
    }
  }, [isRecording, isPaused, onError]);

  // --- Transcription & Minutes ---

  return {
    isRecording,
    isUploading,
    recording,
    audioLevel, // Expose audio level
    isPaused, // Expose paused state
    startRecording,
    stopRecording,
    pauseRecording, // Expose pause function
    resumeRecording, // Expose resume function
    error
  };
}
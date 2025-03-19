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
          stopRecording().catch(err => {
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
  const stopRecording = async () => {
    try {
      if (!recordingRef.current) {
        const errorMsg = 'No active recording to stop';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        return null;
      }

      console.log('Stopping recording...');
      await recordingRef.current.stopAndUnloadAsync();
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

      // Get the current meeting ID from ref to avoid closure issues
      const currentMeetingId = meetingIdRef.current;
      console.log('Current meeting ID from ref:', currentMeetingId);
      
      // Check if meeting exists in the database
      if (currentMeetingId) {
        try {
          console.log('Checking if meeting exists in database...');
          const { data: meetingData, error: meetingError } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', currentMeetingId)
            .single();
            
          if (meetingError) {
            console.error('Error fetching meeting:', meetingError);
            setError(`Meeting not found: ${meetingError.message}`);
            if (onError) onError(`Meeting not found: ${meetingError.message}`);
            return null;
          }
          
          console.log('Meeting found in database:', meetingData);
        } catch (err) {
          console.error('Error checking meeting existence:', err);
        }
      }
      
      if (uri && currentMeetingId) {
        try {
          console.log(`Uploading recording for meeting ${currentMeetingId}`);
          const publicUrl = await uploadToSupabase(uri, currentMeetingId);
          console.log('Upload completed, public URL:', publicUrl);

          if (onRecordingComplete) {
            onRecordingComplete(uri);
          }

          return uri;
        } catch (uploadError) {
          console.error('Error uploading recording:', uploadError);
          setError(`Failed to upload recording: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
          if (onError) onError(`Failed to upload recording: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`);
          return uri; // Still return the URI even if upload failed
        }
      } else {
        console.log('No meeting ID provided, skipping upload');
        if (onRecordingComplete) {
          onRecordingComplete(uri);
        }
        return uri;
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
  const uploadToSupabase = async (uri: string, meetingId: string) => {
    try {
      setIsUploading(true);
      console.log('Starting upload to Supabase...', { uri, meetingId });

      // Check if file exists and has content
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      console.log('File info:', fileInfo);

      if (!fileInfo.exists) {
        const errorMsg = 'Recording file not found';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      if (!fileInfo.size || fileInfo.size <= 0) {
        const errorMsg = 'Recording file is empty';
        console.error(errorMsg);
        setError(errorMsg);
        if (onError) onError(errorMsg);
        throw new Error(errorMsg);
      }

      // Check if the meetings bucket exists
      try {
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        console.log('Available buckets:', buckets);
        
        if (bucketsError) {
          console.error('Error listing buckets:', bucketsError);
        }
        
        const meetingsBucketExists = buckets?.some(bucket => bucket.name === 'meetings');
        console.log('Meetings bucket exists:', meetingsBucketExists);
        
        if (!meetingsBucketExists) {
          console.error('Meetings bucket does not exist, attempting to create it...');
          
          // Try to create the meetings bucket
          const { data: newBucket, error: createError } = await supabase.storage.createBucket('meetings', {
            public: true
          });
          
          if (createError) {
            console.error('Error creating meetings bucket:', createError);
            throw new Error(`Failed to create meetings bucket: ${createError.message}`);
          }
          
          console.log('Created meetings bucket:', newBucket);
        }
      } catch (bucketError) {
        console.error('Error checking buckets:', bucketError);
      }

      // Create blob from file and upload
      console.log('Creating blob from file...');
      const fileBlob = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const blob = await fetch(`data:audio/m4a;base64,${fileBlob}`).then(res => res.blob());
      console.log('Blob created, size:', blob.size);

      // Upload to Supabase Storage
      const fileName = `${meetingId}/audio.m4a`;
      console.log('Uploading to path:', fileName);

      const { error: uploadError, data } = await supabase.storage
        .from('meetings')
        .upload(fileName, blob, {
          contentType: 'audio/m4a',
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError(`Upload error: ${uploadError.message}`);
        if (onError) onError(`Upload error: ${uploadError.message}`);
        throw uploadError;
      }

      console.log('Upload successful:', data);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('meetings')
        .getPublicUrl(fileName);

      console.log('Public URL:', publicUrl);

      // Update meeting with audio URL
      console.log('Updating meeting record with audio URL...');
      const { error: updateError, data: updateData } = await supabase
        .from('meetings')
        .update({ 
          audio_url: publicUrl,
          status: 'processing'
        })
        .eq('id', meetingId)
        .select();

      console.log('Update result:', { error: updateError, data: updateData });

      if (updateError) {
        console.error('Update error:', updateError);
        
        // Check if the error is due to RLS policies
        if (updateError.code === '42501') {
          console.error('This appears to be a permissions error. Checking RLS policies...');
          
          // Try to get the meeting to see if it exists
          const { data: meetingCheck, error: meetingCheckError } = await supabase
            .from('meetings')
            .select('*')
            .eq('id', meetingId)
            .single();
            
          if (meetingCheckError) {
            console.error('Error checking meeting:', meetingCheckError);
            setError(`Meeting not found or not accessible: ${meetingCheckError.message}`);
          } else {
            console.log('Meeting exists but update failed:', meetingCheck);
            setError(`Meeting exists but update failed due to permissions: ${updateError.message}`);
          }
        } else if (updateError.code === '23503') {
          console.error('This appears to be a foreign key constraint error. The meeting may have been deleted.');
          setError(`Meeting reference error: ${updateError.message}`);
        } else {
          setError(`Database update error: ${updateError.message}`);
        }
        
        if (onError) onError(`Database update error: ${updateError.message}`);
        throw updateError;
      }

      return publicUrl;
    } catch (err) {
      console.error('Error in uploadToSupabase:', err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    isRecording,
    isUploading,
    recording,
    startRecording,
    stopRecording,
    error
  };
}
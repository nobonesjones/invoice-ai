import { View, TouchableOpacity, Animated, Easing, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Bell, Mic } from 'lucide-react-native';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/config/supabase';
import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useMinutesGeneration } from '@/lib/hooks/use-minutes-generation';
import { useTranscription } from '@/lib/hooks/use-transcription';
import { useTheme } from "@/context/theme-provider";

interface Objective {
  id: string;
  description: string;
  display_order: number;
  displayed_at: number | null;
}

// Define permission status as a simple string
type PermissionStatusType = string;
const PERMISSION_GRANTED: PermissionStatusType = "granted";
const PERMISSION_DENIED: PermissionStatusType = "denied";
const PERMISSION_UNDETERMINED: PermissionStatusType = "undetermined";

export default function RecordingScreen() {
  const router = useRouter();
  const { meetingId } = useLocalSearchParams<{ meetingId: string }>();
  const { theme, isLightMode } = useTheme();
  const [recordingTime, setRecordingTime] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [currentObjective, setCurrentObjective] = useState<Objective | null>(null);
  const [meetingIdState, setMeetingId] = useState<string | undefined>(meetingId || undefined);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatusType>(PERMISSION_UNDETERMINED);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<{
    sound: Audio.Sound;
    duration: string;
    file: string;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { generateMinutes } = useMinutesGeneration();
  const { transcribeAudio } = useTranscription();

  // Memoize the error handler to avoid recreating it on each render
  const handleError = useCallback((error: string) => {
    console.error('Recording error:', error);
    setErrorMessage(error);
    
    // Show alert for errors that need immediate attention
    Alert.alert(
      'Recording Error',
      error,
      [{ text: 'OK' }]
    );
  }, []);

  const { 
    isRecording: recorderIsRecording, 
    isUploading: recorderIsUploading,
    recording,
    startRecording, 
    stopRecording, 
    error: recorderError 
  } = useAudioRecorder({
    meetingId: meetingIdState,
    onRecordingComplete: async (uri) => {
      console.log('Recording completed with URI:', uri);
      try {
        if (!recording || recording === null) {
          console.error('No recording available');
          return;
        }

        // Store the final duration before we reset it
        const finalDuration = recordingTime;
        console.log('Final recording duration:', finalDuration);

        // Show processing screen
        setIsProcessing(true);
        setProcessingStep('Preparing audio...');

        // Create a playable sound from the recording
        const { sound, status } = await recording.createNewLoadedSoundAsync();
        console.log('Recording status:', status);
        
        // Add to recordings list for local playback
        setRecordings(prev => [...prev, {
          sound: sound,
          duration: getDurationFormatted(finalDuration * 1000), // Convert seconds to milliseconds
          file: uri || ''
        }]);

        if (meetingIdState) {
          setIsLoading(true);
          setProcessingStep('Uploading recording...');
          
          // Upload the file to Supabase Storage
          // Log file info before reading
          const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
          console.log('Original file info:', fileInfo);

          try {
            // Create FormData for upload
            const formData = new FormData();
            formData.append('file', {
              uri: uri,
              type: 'audio/m4a',
              name: 'audio.m4a'
            } as any);

            console.log('FormData created with file:', {
              uri: uri,
              type: 'audio/m4a',
              size: fileInfo.exists ? fileInfo.size : 0
            });

            const storagePath = `recordings/${meetingId}/audio.m4a`;
            console.log('Uploading to path:', storagePath);

            // Upload to Supabase Storage using FormData
            const { error: uploadError, data } = await supabase.storage
              .from('meetings')
              .upload(storagePath, formData.get('file') as Blob, {
                contentType: 'audio/m4a',
                upsert: true
              });

            if (uploadError) {
              console.error('Upload error:', uploadError);
              setIsLoading(false);
              setIsProcessing(false);
              Alert.alert(
                'Error',
                'Failed to upload recording to storage.',
                [{ text: 'OK' }]
              );
              return;
            }

            console.log('Upload response:', data);
            setProcessingStep('Finalizing meeting...');

            // Get public URL without any query parameters
            const { data: { publicUrl } } = supabase.storage
              .from('meetings')
              .getPublicUrl(storagePath);

            // Clean up the URL by removing any empty query parameters
            const cleanUrl = publicUrl.split('?')[0];
            console.log('Final audio URL:', cleanUrl);

            // Update meeting with audio URL and status
            const { error: updateError } = await supabase
              .from('meetings')
              .update({ 
                audio_url: cleanUrl,
                status: 'completed',
                duration: finalDuration,
                updated_at: new Date().toISOString()
              })
              .eq('id', meetingIdState);
            
            if (updateError) {
              console.error('Error updating meeting:', updateError);
              setIsLoading(false);
              setIsProcessing(false);
              Alert.alert(
                'Error',
                'Failed to update meeting status.',
                [{ text: 'OK' }]
              );
            } else {
              console.log('Successfully updated meeting with duration:', finalDuration, 'Meeting ID:', meetingIdState);
              
              // Navigate directly to transcript tab
              setProcessingStep('Navigating to transcript...');
              
              // Small delay to ensure UI updates
              setTimeout(() => {
                router.replace({
                  pathname: '/meeting/[id]',
                  params: { 
                    id: meetingIdState,
                    tab: 'transcript' as const
                  }
                });
              }, 1000);
            }
          } catch (error) {
            console.error('Error processing file:', error);
            setIsLoading(false);
            setIsProcessing(false);
            Alert.alert(
              'Error',
              'Failed to process audio file.',
              [{ text: 'OK' }]
            );
            return;
          }
        }
      } catch (err) {
        console.error('Error in onRecordingComplete:', err);
        setIsLoading(false);
        setIsProcessing(false);
        Alert.alert(
          'Error',
          'Failed to process recording.',
          [{ text: 'OK' }]
        );
      }
    },
    onError: handleError
  });

  // Update local isRecording state based on recorder state
  useEffect(() => {
    setIsRecording(recorderIsRecording);
    setIsUploading(recorderIsUploading);
  }, [recorderIsRecording, recorderIsUploading]);

  // Cleanup function for recordings
  useEffect(() => {
    return () => {
      // Unload all sounds when component unmounts
      recordings.forEach(rec => {
        if (rec.sound) {
          rec.sound.unloadAsync().catch(console.error);
        }
      });
    };
  }, [recordings]);

  const handleEndRecording = useCallback(async () => {
    if (isRecording) {
      // Store the final duration before stopping
      const finalDuration = recordingTime;
      console.log('Stopping recording with duration:', finalDuration);
      await stopRecording();
      // Reset recording time after stopping
      setRecordingTime(0);

      // If we have a recording and meeting ID, start transcription
      if (recording && meetingIdState) {
        const uri = recording.getURI();
        if (uri) {
          try {
            setIsProcessing(true);
            
            // Navigate to the meeting details page with a processing indicator
            router.replace({
              pathname: '/meeting/[id]',
              params: { 
                id: meetingIdState,
                tab: 'transcript' as const,
                processing: 'true'
              }
            });
            
            // Process in sequence to ensure everything completes
            try {
              // First transcribe the audio
              console.log('Starting transcription...');
              await transcribeAudio(uri, meetingIdState);
              console.log('Transcription completed');
              
              // Then generate minutes
              console.log('Starting minutes generation...');
              await generateMinutes(meetingIdState);
              console.log('Minutes generation completed');
              
              // Update the UI to show completion
              console.log('All processing completed successfully');
            } catch (processingError) {
              console.error('Error in audio processing:', processingError);
            } finally {
              setIsProcessing(false);
            }
          } catch (error) {
            console.error('Error processing recording:', error);
            setIsProcessing(false);
            
            // Still navigate to the meeting details page even if there's an error
            router.replace({
              pathname: '/meeting/[id]',
              params: { 
                id: meetingIdState,
                tab: 'transcript' as const
              }
            });
          }
        }
      }
    }
  }, [isRecording, stopRecording, recordingTime, recording, meetingIdState, generateMinutes, transcribeAudio, router]);

  // Initialize and check permissions on mount
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        // Start with a short delay to prevent flickering
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isMounted) return;

        // Check permissions first
        const status = await Audio.getPermissionsAsync();
        if (!isMounted) return;
        
        // Validate meeting ID if present
        let meetingData = null;
        if (meetingId) {
          const { data, error } = await supabase
            .from('meetings')
            .select('id, name')
            .eq('id', meetingId)
            .single();
            
          if (error || !data) {
            if (isMounted) {
              console.error('Invalid meeting ID:', error || 'Meeting not found');
              Alert.alert(
                'Error',
                'Invalid meeting ID. Please try again.',
                [{ text: 'OK', onPress: () => router.push('/') }]
              );
            }
            return;
          }
          meetingData = data;
        }

        // Batch our state updates
        if (isMounted) {
          setPermissionStatus(status.status);
          if (meetingData) {
            setMeetingId(meetingData.id);
          }
          // Add a small delay before removing loading state
          initTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              setIsInitializing(false);
            }
          }, 300);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Error during initialization:', err);
          setErrorMessage('Failed to initialize recording screen');
          setIsInitializing(false);
        }
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [meetingId, router]);

  // Watch for recorder errors
  useEffect(() => {
    if (recorderError) {
      handleError(recorderError);
    }
  }, [recorderError, handleError]);

  // Fetch objectives for the current meeting
  useEffect(() => {
    const fetchObjectives = async () => {
      if (!meetingIdState) return;

      try {
        console.log('Fetching objectives for meeting:', meetingIdState);
        const { data, error } = await supabase
          .from('objectives')
          .select('*')
          .eq('meeting_id', meetingIdState)
          .order('display_order', { ascending: true });

        if (error) {
          console.error('Error fetching objectives:', error);
          return;
        }

        if (data && data.length > 0) {
          console.log(`Loaded ${data.length} objectives`);
          setObjectives(data);
        } else {
          console.log('No objectives found for this meeting');
        }
      } catch (err) {
        console.error('Error in fetchObjectives:', err);
      }
    };

    fetchObjectives();
  }, [meetingIdState]);

  // Show objectives at intervals
  useEffect(() => {
    if (isRecording && objectives.length > 0) {
      const interval = setInterval(() => {
        const currentIndex = Math.floor(recordingTime / 60) % objectives.length;
        const objective = objectives[currentIndex];
        setCurrentObjective(objective);
        
        // Update the displayed_at timestamp if not already set
        if (objective && objective.displayed_at === null) {
          supabase
            .from('objectives')
            .update({ displayed_at: Math.floor(Date.now() / 1000) })
            .eq('id', objective.id)
            .then(({ error }) => {
              if (error) {
                console.error('Error updating objective displayed_at:', error);
              }
            });
        }
      }, 60000); // Show new objective every minute

      return () => clearInterval(interval);
    }
  }, [isRecording, objectives, recordingTime]);

  // Start the rotating animation for the purple ring
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotationAnim, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  }, [rotationAnim]);

  // Start the pulse animation for the recording indicator
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  // Timer for recording duration
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRecording]);

  // Format time for display (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format duration helper function
  function getDurationFormatted(milliseconds: number) {
    const minutes = milliseconds / 1000 / 60;
    const seconds = Math.round((minutes - Math.floor(minutes)) * 60);
    return seconds < 10 
      ? `${Math.floor(minutes)}:0${seconds}` 
      : `${Math.floor(minutes)}:${seconds}`;
  }

  // Get recording lines helper function
  function getRecordingLines() {
    return recordings.map((recordingLine, index) => {
      return (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#cccccc', borderRadius: 10, padding: 16, marginBottom: 8 }}>
          <Text style={{ color: '#000000', flex: 1, marginRight: 16 }}>
            Recording #{recordings.length - index} | {recordingLine.duration}
          </Text>
          <TouchableOpacity
            onPress={() => recordingLine.sound.replayAsync()}
            style={{ backgroundColor: '#000000', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
          >
            <Text style={{ color: '#ffffff' }}>Play</Text>
          </TouchableOpacity>
        </View>
      );
    });
  }

  // Check permission status
  const checkPermissionStatus = async () => {
    try {
      const { status } = await Audio.getPermissionsAsync();
      console.log('Permission status:', status);
      setPermissionStatus(status);
      return status;
    } catch (err) {
      console.error('Error checking permission status:', err);
      setPermissionStatus(PERMISSION_UNDETERMINED);
      return PERMISSION_UNDETERMINED;
    }
  };

  // Request audio permission
  const requestAudioPermission = async () => {
    try {
      setIsProcessing(true);
      console.log('Requesting audio permission...');
      
      const { status } = await Audio.requestPermissionsAsync();
      console.log('Permission request result:', status);
      
      setPermissionStatus(status);
      
      if (status !== PERMISSION_GRANTED) {
        Alert.alert(
          'Permission Required',
          'Microphone access is required to record meetings. Please grant permission in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error requesting permission:', err);
      setPermissionStatus(PERMISSION_UNDETERMINED);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  // Simplified start recording function
  const handleStartRecording = async () => {
    try {
      setIsProcessing(true);
      setErrorMessage(null);
      console.log('Starting recording process...');
      
      // Double-check permission status
      const currentStatus = await checkPermissionStatus();
      
      // Check if we have permission before proceeding
      if (currentStatus !== PERMISSION_GRANTED) {
        console.log('Permission not granted, requesting...');
        const permissionGranted = await requestAudioPermission();
        if (!permissionGranted) {
          console.log('Permission request failed');
          setIsProcessing(false);
          return;
        }
      }
      
      // Ensure we have a valid meeting ID
      if (!meetingIdState) {
        if (meetingId) {
          console.log('Setting meeting ID from route:', meetingId);
          setMeetingId(meetingId);
        } else {
          console.error('No meeting ID available');
          Alert.alert(
            'Error',
            'No meeting ID provided. Cannot start recording.',
            [{ text: 'OK' }]
          );
          setIsProcessing(false);
          return;
        }
      }
      
      // Reset recording time
      setRecordingTime(0);
      
      console.log('Starting recording with meeting ID:', meetingIdState);
      const success = await startRecording();
      console.log('Recording started:', success);
      
      if (!success) {
        // If recording failed to start, show an alert to the user
        Alert.alert(
          'Recording Failed',
          'Unable to start recording. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.error('Error starting recording:', err);
      setErrorMessage(`Error starting recording: ${err instanceof Error ? err.message : String(err)}`);
      Alert.alert(
        'Recording Error',
        'An error occurred while trying to start the recording. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const spin = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Loading state
  if (isInitializing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={{ color: theme.foreground, marginTop: 16 }}>Initializing recording...</Text>
      </View>
    );
  }

  // Early return for loading state
  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <View style={{ justifyContent: 'center', alignItems: 'center', marginVertical: 16 }}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={{ color: theme.foreground, fontSize: 18, textAlign: 'center' }}>
            Saving your meeting...
          </Text>
          <Text style={{ color: theme.mutedForeground, fontSize: 14, textAlign: 'center' }}>
            You'll be redirected to your meeting page in a moment
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 24, paddingTop: 54 }}>
      {/* Header */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        marginBottom: 24,
        marginTop: 18,
        justifyContent: 'center', 
        position: 'relative' 
      }}>
        <TouchableOpacity 
          onPress={() => router.push('/')} 
          style={{ 
            position: 'absolute', 
            left: 0, 
            padding: 10, 
            zIndex: 10 
          }}
        >
          <Text>
            <ChevronLeft size={24} color={theme.foreground} />
          </Text>
        </TouchableOpacity>
        <Text style={{ 
          color: theme.foreground, 
          fontSize: 18,
          textAlign: 'center',
          fontWeight: '600',
          flex: 0, 
          width: '70%', 
          marginHorizontal: 'auto' 
        }}>
          {isUploading ? 'Uploading...' : isRecording ? 'Recording' : 'Ready to Record'}
        </Text>
      </View>

      {/* Error message display */}
      {errorMessage && (
        <View style={{ backgroundColor: '#ef4444', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Error</Text>
          <View>
            <Text style={{ color: '#ffffff' }}>{errorMessage}</Text>
          </View>
        </View>
      )}

      {/* Permission status */}
      {!isRecording && (
        <View style={{ 
          backgroundColor: '#ffffff',
          borderRadius: 12,
          padding: 16, 
          marginBottom: 24,
          marginTop: 7,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3
        }}>
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            marginBottom: permissionStatus !== PERMISSION_GRANTED ? 8 : 0,
            justifyContent: 'center' // Center the content horizontally
          }}>
            <Text>
              <Mic size={20} color={permissionStatus === PERMISSION_GRANTED ? "#10B981" : "#EF4444"} style={{ marginRight: 8 }} />
            </Text>
            <Text style={{ 
              color: permissionStatus === PERMISSION_GRANTED ? "#10B981" : "#EF4444",
              fontWeight: '500'
            }}>
              Microphone Permission: {permissionStatus === PERMISSION_GRANTED ? "Granted" : permissionStatus === PERMISSION_DENIED ? "Denied" : "Unknown"}
            </Text>
          </View>
          
          {/* Only show explanation text when permission is not granted */}
          {permissionStatus !== PERMISSION_GRANTED && (
            <View>
              <Text style={{ color: '#333333', fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
                Audio permission is required to record meetings with audio. This is especially important for iOS devices.
              </Text>
            </View>
          )}
          
          {permissionStatus === PERMISSION_DENIED && (
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                onPress={requestAudioPermission}
                style={{ 
                  backgroundColor: '#000000', 
                  paddingHorizontal: 16, 
                  paddingVertical: 8, 
                  borderRadius: 10,
                  marginTop: 4
                }}
                disabled={isProcessing}
              >
                <Text style={{ color: '#ffffff', textAlign: 'center', fontWeight: '500' }}>Request Permission</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Reminder Card */}
      {currentObjective && isRecording && (
        <View style={{ backgroundColor: '#cccccc', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Text>
              <Bell size={20} color="#a855f7" style={{ marginRight: 8 }} />
            </Text>
            <Text style={{ color: '#a855f7' }}>Reminder</Text>
          </View>
          <View>
            <Text style={{ color: '#000000', fontSize: 18 }}>{currentObjective.description}</Text>
          </View>
        </View>
      )}

      {/* Audio Visualization */}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ justifyContent: 'center', alignItems: 'center' }}>
          {/* Recording button */}
          <View style={{ alignItems: 'center' }}>
            {isRecording ? (
              <TouchableOpacity
                onPress={handleEndRecording}
                style={{
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 100,
                }}
                disabled={isUploading || isProcessing}
              >
                <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>
                  {isUploading ? "Uploading..." : isProcessing ? "Processing..." : "Stop Recording"}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleStartRecording}
                style={{
                  backgroundColor: permissionStatus === PERMISSION_GRANTED ? "#000000" : "#cccccc",
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 100,
                }}
                disabled={permissionStatus !== PERMISSION_GRANTED || isProcessing || isUploading}
              >
                <Text style={{ color: permissionStatus === PERMISSION_GRANTED ? "#ffffff" : "#666666", fontWeight: 'bold' }}>
                  {isProcessing ? "Preparing..." : "Start Recording"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recording time */}
        {isRecording && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ color: '#000000', fontSize: 24, fontWeight: 'bold' }}>
              {formatTime(recordingTime)}
            </Text>
          </View>
        )}
      </View>

      {/* Recordings List */}
      {recordings.length > 0 && (
        <View style={{ marginTop: 24, marginBottom: 16 }}>
          <Text style={{ color: '#000000', fontSize: 18, marginBottom: 16 }}>Recent Recordings</Text>
          <ScrollView>
            {getRecordingLines()}
          </ScrollView>
        </View>
      )}
      
      {/* Processing overlay */}
      {isProcessing && (
        <View style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={{ marginTop: 20, fontSize: 18, fontWeight: '500', color: '#000' }}>
            Processing Meeting
          </Text>
          <Text style={{ marginTop: 8, fontSize: 14, color: '#666' }}>
            {processingStep}
          </Text>
        </View>
      )}
    </View>
  );
}
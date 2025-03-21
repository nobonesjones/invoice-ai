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
  const [recordingTime, setRecordingTime] = useState(0);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [currentObjective, setCurrentObjective] = useState<Objective | null>(null);
  const [meetingIdState, setMeetingId] = useState<string | undefined>(meetingId || undefined);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatusType>(PERMISSION_UNDETERMINED);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<{
    sound: Audio.Sound;
    duration: string;
    file: string;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
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
    isRecording, 
    isUploading,
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
              Alert.alert(
                'Error',
                'Failed to upload recording to storage.',
                [{ text: 'OK' }]
              );
              return;
            }

            console.log('Upload response:', data);

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
              Alert.alert(
                'Error',
                'Failed to update meeting status.',
                [{ text: 'OK' }]
              );
            } else {
              console.log('Successfully updated meeting with duration:', finalDuration, 'Meeting ID:', meetingIdState);
              // Wait for 2 seconds then navigate to transcript tab
              setTimeout(() => {
                router.replace({
                  pathname: '/meeting/[id]',
                  params: { 
                    id: meetingIdState,
                    tab: 'transcript' as const
                  }
                });
              }, 2000);
            }
          } catch (error) {
            console.error('Error processing file:', error);
            setIsLoading(false);
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
        Alert.alert(
          'Error',
          'Failed to process recording.',
          [{ text: 'OK' }]
        );
      }
    },
    onError: handleError
  });

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
          // Start transcription process
          try {
            await transcribeAudio(uri, meetingIdState);
            // After transcription is complete, generate minutes
            await generateMinutes(meetingIdState);
          } catch (error) {
            console.error('Error processing recording:', error);
          }
        }
      }
    }
  }, [isRecording, stopRecording, recordingTime, recording, meetingIdState, generateMinutes, transcribeAudio]);

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
        <View key={index} className="flex-row items-center justify-between bg-gray-800 rounded-lg p-4 mb-3">
          <Text className="text-white flex-1 mr-4">
            Recording #{recordings.length - index} | {recordingLine.duration}
          </Text>
          <Button
            onPress={() => recordingLine.sound.replayAsync()}
            className="bg-purple-500 px-4 py-2 rounded-lg"
          >
            <Text className="text-white">Play</Text>
          </Button>
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
      <View className="flex-1 bg-black items-center justify-center">
        <ActivityIndicator size="large" color="#a855f7" />
        <Text className="text-white mt-4">Initializing recording...</Text>
      </View>
    );
  }

  // Early return for loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-4">
        <View className="items-center space-y-4">
          <ActivityIndicator size="large" color="#a855f7" />
          <Text className="text-white text-lg text-center">
            Saving your meeting...
          </Text>
          <Text className="text-gray-400 text-sm text-center">
            You'll be redirected to your meeting page in a moment
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black px-4 pt-20">
      {/* Header */}
      <View className="flex-row items-center mb-8">
        <TouchableOpacity onPress={() => router.push('/')} className="mr-4">
          <Text>
            <ChevronLeft size={24} color="white" />
          </Text>
        </TouchableOpacity>
        <Text className="text-white text-lg flex-1 text-center">
          {isUploading ? 'Uploading...' : isRecording ? 'Recording' : 'Ready to Record'}
        </Text>
        <View style={{ width: 24 }} /> {/* Spacer to center the title */}
      </View>

      {/* Error message display */}
      {errorMessage && (
        <View className="bg-red-900 rounded-lg p-4 mb-4">
          <Text className="text-white font-medium">Error</Text>
          <View>
            <Text className="text-white">{errorMessage}</Text>
          </View>
        </View>
      )}

      {/* Permission status */}
      {!isRecording && (
        <View className="bg-[#222222] rounded-lg p-4 mb-8">
        <View className="flex-row items-center mb-2">
          <Text>
            <Mic size={20} color={permissionStatus === PERMISSION_GRANTED ? "#10B981" : "#EF4444"} className="mr-2" />
          </Text>
          <Text className={permissionStatus === PERMISSION_GRANTED ? "text-green-400" : "text-red-400"}>
            Microphone Permission: {permissionStatus === PERMISSION_GRANTED ? "Granted" : permissionStatus === PERMISSION_DENIED ? "Denied" : "Unknown"}
          </Text>
        </View>
        <View>
          <Text className="text-white text-sm mb-3">
            Audio permission is required to record meetings with audio. This is especially important for iOS devices.
          </Text>
        </View>
        {permissionStatus === PERMISSION_DENIED && (
          <Button
            onPress={requestAudioPermission}
            className="bg-blue-600 py-2 mt-1"
            disabled={isProcessing}
          >
            <Text className="text-white text-center">Request Permission</Text>
          </Button>
        )}
      </View>
      )}

      {/* Reminder Card */}
      {currentObjective && isRecording && (
        <View className="bg-[#222222] rounded-lg p-4 mb-8">
          <View className="flex-row items-center mb-2">
            <Text>
              <Bell size={20} className="text-purple-500 mr-2" />
            </Text>
            <Text className="text-purple-400">Reminder</Text>
          </View>
          <View>
            <Text className="text-white text-lg">{currentObjective.description}</Text>
          </View>
        </View>
      )}

      {/* Audio Visualization */}
      <View className="flex-1 items-center justify-center">
        <View className="relative items-center justify-center">
          {/* Recording button */}
          <View className="items-center">
            {isRecording ? (
              <Button
                onPress={handleEndRecording}
                className="bg-red-500 px-6 py-3 rounded-full"
                disabled={isUploading || isProcessing}
              >
                <Text className="text-white font-semibold">
                  {isUploading ? "Uploading..." : isProcessing ? "Processing..." : "Stop Recording"}
                </Text>
              </Button>
            ) : (
              <Button
                onPress={handleStartRecording}
                className={`${permissionStatus === PERMISSION_GRANTED ? "bg-gradient-to-r from-purple-500 to-blue-500" : "bg-gray-500"} px-6 py-3 rounded-full`}
                disabled={permissionStatus !== PERMISSION_GRANTED || isProcessing || isUploading}
              >
                <Text className={`${permissionStatus === PERMISSION_GRANTED ? "text-black" : "text-gray-300"} font-semibold`}>
                  {isProcessing ? "Preparing..." : "Start Recording"}
                </Text>
              </Button>
            )}
          </View>
        </View>

        {/* Recording time */}
        {isRecording && (
          <View className="mt-8">
            <Text className="text-white text-2xl font-semibold">
              {formatTime(recordingTime)}
            </Text>
          </View>
        )}
      </View>

      {/* Recordings List */}
      {recordings.length > 0 && (
        <View className="mt-8 mb-4">
          <Text className="text-white text-lg mb-4">Recent Recordings</Text>
          <ScrollView>
            {getRecordingLines()}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus, Pressable, SafeAreaView } from 'react-native'; 
import { useRouter, useFocusEffect } from 'expo-router';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av'; 
import * as Haptics from 'expo-haptics'; 
import { supabase } from '@/config/supabase'; 
import { useSupabase } from '@/context/supabase-provider'; 
import { useTheme } from '@/context/theme-provider'; 
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useTranscription } from '@/lib/hooks/use-transcription';
import { useMinutesGeneration } from '@/lib/hooks/use-minutes-generation';
import ProcessingIndicator, { ProcessingStepKey } from '@/components/ui/ProcessingIndicator';

export default function RecordingScreen() {
  const { session } = useSupabase(); 
  const { theme: themeColors } = useTheme(); 
  const router = useRouter();
  const [recordingTime, setRecordingTime] = useState(0);
  const [meetingIdState, setMeetingIdState] = useState<string | undefined>(undefined); 
  const [isInitializing, setIsInitializing] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stopInitiated, setStopInitiated] = useState(false); 
  const [processingStep, setProcessingStep] = useState<ProcessingStepKey | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [hasPermission, setHasPermission] = useState(false); 

  // Refs for managing component state across renders and effects
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);
  const isFocusedRef = useRef(true);
  const timerIntervalRef = useRef<number | null>(null); 

  // --- Custom Hooks (must be defined before callbacks that use them) ---
  const { transcribeAudio, isTranscribing, error: transcriptionError } = useTranscription();
  const { generateMinutes, isGenerating, error: minutesError } = useMinutesGeneration(); 

  const {
    audioLevel, 
    startRecording,
    stopRecording,
    isRecording, 
    isPaused, 
    pauseRecording, 
    resumeRecording, 
    isUploading: isAudioHookUploading, 
    error: audioError,
  } = useAudioRecorder({
    meetingId: meetingIdState,
    onError: (err) => {
      console.error("[Audio Hook Error Callback]:", err);
      if (isActiveRef.current) setErrorMessage(err);
    },
  });

  // Handle stopping the recording
  const handleStopRecording = async (isDiscarding = false) => {
    console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] handleStopRecording called. isDiscarding=${isDiscarding}, isRecording=${isRecording}`);
    if (isDiscarding || !meetingIdState) {
      // If discarding, simply stop without processing
      // If no meetingId, also stop without processing (log error)
      if (!meetingIdState) {
        console.error(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Cannot stop recording: meetingIdState is null or undefined.`);
        Alert.alert('Error', 'Cannot stop recording, missing meeting ID.');
      }
      try {
        await stopRecording(meetingIdState ?? 'unknown'); // Call stopRecording even if discarding or no ID to unload audio
        setRecordingTime(0);
      } catch (stopErr) {
        console.error(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Error during simple stop/discard:`, stopErr);
      }
      if (isDiscarding) router.back(); // Go back if discarding
      return;
    }

    console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Attempting graceful stop and process for meeting: ${meetingIdState}`);
    setStopInitiated(true); // Indicate stop process has started
    setIsProcessing(true); // Show processing indicator immediately
    // Assume upload happens within stopRecording hook, start visual step at transcribing
    setProcessingStep('transcribing'); 

    try {
      const stopResult = await stopRecording(meetingIdState); 
      
      if (!stopResult?.uri) {
        throw new Error('Recording URI is missing after stopping.');
      }
      const audioUri = stopResult.uri;
      const durationMillis = stopResult.durationMillis;
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Recording stopped. URI: ${audioUri}, Duration: ${durationMillis}ms`);

      // --- Transcription --- 
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Starting transcription for meeting: ${meetingIdState}`);
      // Pass durationMillis argument, function returns void
      await transcribeAudio(audioUri, meetingIdState, durationMillis);
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Transcription complete for meeting: ${meetingIdState}`);
      // HAPTIC 1: Transcription complete
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Use correct key 'generating'
      setProcessingStep('generating'); // Update UI

      // --- Minutes Generation --- 
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Starting minutes generation for meeting: ${meetingIdState}`);
      // Pass only meetingIdState, function returns void
      await generateMinutes(meetingIdState);
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Minutes generation complete for meeting: ${meetingIdState}`);
      // HAPTIC 2: Minutes generation complete
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Use correct key 'finishing'
      setProcessingStep('finishing'); // Update UI
      
      // --- Final Update --- 
      // The services handle storing transcript/minutes and duration.
      // Just update status to completed here.
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Performing final status update for meeting: ${meetingIdState}`);
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ 
          status: 'completed', // Mark as completed
          updated_at: new Date().toISOString()
          // minutes_text: minutesText, // Incorrect - handled by service
          // duration: Math.round(durationMillis / 1000) // Incorrect - handled by transcribe service
        })
        .eq('id', meetingIdState);

      if (updateError) {
        throw new Error(`Database update error: ${updateError.message}`);
      }
      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Final update successful for meeting: ${meetingIdState}`);
      // HAPTIC 3: Finishing touches complete
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Navigate to the meeting details page
      router.replace(`/(app)/(protected)/meeting/${meetingIdState}`);
      
    } catch (err: any) {
      console.error(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Error during stop/processing:`, err);
      if (isActiveRef.current) {
        // Check if error is an instance of Error before accessing message
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
        if (errorMessage.includes("Component inactive")) {
            console.log("Processing stopped because component became inactive.");
            // Don't show error to user if navigation already happened
        } else {
            setErrorMessage(`Processing failed: ${errorMessage}`);
        }
      }
    } finally {
       // Ensure overlay is hidden even on error or inactivity
      if (isActiveRef.current) {
         console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] handleStopRecording: FINALLY block, Setting isProcessing = false.`);
         setIsProcessing(false);
         setProcessingStep(null);
         setStopInitiated(false); // Reset stop initiation flag
      }
    }
  };

  // Memoize the error handler to avoid recreating it on each render
  const handleError = useCallback((error: string) => {
    console.error('Recording error:', error);
    setErrorMessage(error);
    
    Alert.alert(
      'Recording Error',
      error,
      [{ text: 'OK' }]
    );
  }, []);

  // --- State Synchronization and Error Handling ---

  // Update local recording state based on hook
  useEffect(() => {
    setIsUploading(isAudioHookUploading);
  }, [isAudioHookUploading]);

  // Combine errors from different hooks/stages
  useEffect(() => {
    const combinedError = audioError || transcriptionError || minutesError;
    if (combinedError) {
      handleError(combinedError);
    }
  }, [audioError, transcriptionError, minutesError, handleError]);

  // --- Timer Logic ---
  useEffect(() => {
    let interval: number | null = null;
    // Only run the timer if recording is active and not paused
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        if (isActiveRef.current) { 
          setRecordingTime((prevTime) => prevTime + 1);
        }
      }, 1000);
    } else {
      // Clear interval if not recording or paused
      if (interval) {
        clearInterval(interval);
      }
    }
    // Cleanup function to clear interval when component unmounts or dependencies change
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, isPaused]);

  // --- Helper Functions ---

  // Format time for display (MM:SS)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60); 
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Meeting Creation Function --- 
  const handleCreateMeeting = async () => {
    if (!isFocusedRef.current || !isActiveRef.current || isCreatingMeeting) {
      console.log(`[LOG ${new Date().toISOString()}] handleCreateMeeting: Aborting - Screen not focused/active or already creating.`);
      return;
    }
    console.log(`[LOG ${new Date().toISOString()}] handleCreateMeeting: Attempting to create new meeting.`);
    setIsCreatingMeeting(true);
    setErrorMessage(null);

    if (!session?.user?.id) {
      const errMsg = 'User not authenticated when trying to create meeting.';
      console.error(`[ERROR ${new Date().toISOString()}] ${errMsg}`);
      if (isActiveRef.current) setErrorMessage(errMsg);
      setIsCreatingMeeting(false);
      return;
    }

    if (!supabase) {
      const errMsg = 'Supabase client not available.';
      console.error(`[ERROR ${new Date().toISOString()}] ${errMsg}`);
      if (isActiveRef.current) setErrorMessage(errMsg);
      setIsCreatingMeeting(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          user_id: session.user.id,
          name: `Meeting ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`
        })
        .select('id')
        .single();

      if (error) {
        console.error(`[ERROR ${new Date().toISOString()}] Error creating meeting:`, error);
        if (isActiveRef.current) setErrorMessage(`Failed to start new meeting: ${error.message}`);
      } else if (data && isActiveRef.current) {
        console.log(`[LOG ${new Date().toISOString()}] handleCreateMeeting: Successfully created meeting ID: ${data.id}`);
        setMeetingIdState(data.id);
      } else if (!data) {
        console.error(`[ERROR ${new Date().toISOString()}] Failed to create meeting, no data returned.`);
        if (isActiveRef.current) setErrorMessage('Failed to start new meeting: No ID returned.');
      } else {
        console.warn(`[WARN ${new Date().toISOString()}] Meeting created but component inactive. ID: ${data?.id}`);
      }
    } catch (error: any) {
      console.error(`[ERROR ${new Date().toISOString()}] Unexpected error creating meeting:`, error);
      if (!errorMessage && isActiveRef.current) {
        setErrorMessage(`An unexpected error occurred: ${error.message}`);
      }
    } finally {
      setIsCreatingMeeting(false);
      console.log(`[LOG ${new Date().toISOString()}] handleCreateMeeting: Finished attempt.`);
    }
  };

  // --- Focus Effect for Initialization, Permissions, and Meeting Creation ---
  useFocusEffect(
    useCallback(() => {
      console.log(`[LOG ${new Date().toISOString()}] useFocusEffect (focus): Screen focused.`);
      isActiveRef.current = true;
      isFocusedRef.current = true;

      // Reset state for a new session
      setIsProcessing(false);
      setProcessingStep(null);
      setErrorMessage(null);
      setMeetingIdState(undefined); 
      setRecordingTime(0); 
      setIsInitializing(true); 

      const setup = async () => {
        // 1. Check/Request Permissions
        try {
          let perm = await Audio.getPermissionsAsync();
          if (!perm.granted) {
            console.log('Requesting audio permissions...');
            perm = await Audio.requestPermissionsAsync();
          }
          setHasPermission(perm.granted);
          if (!perm.granted) {
            Alert.alert('Permissions Required', 'Audio recording permission is needed.');
            setIsInitializing(false);
            return; 
          }
           // Set audio mode (important for iOS)
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            interruptionModeIOS: InterruptionModeIOS.DoNotMix,
            interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
            staysActiveInBackground: true, 
          });

        } catch (err) {
          console.error('Error setting up permissions/audio mode:', err);
          setErrorMessage('Failed to setup audio permissions.');
          setHasPermission(false);
          setIsInitializing(false);
          return;
        }
        
        // 2. Create New Meeting (only if permission granted)
        console.log(`[LOG ${new Date().toISOString()}] useFocusEffect: Triggering new meeting creation.`);
        await handleCreateMeeting(); 

        // 3. Finish Initialization
        setIsInitializing(false); 
        console.log(`[LOG ${new Date().toISOString()}] useFocusEffect: Initialization complete. hasPermission=${hasPermission}`);
      };

      setup(); 

      return () => {
        console.log(`[LOG ${new Date().toISOString()}] useFocusEffect (blur): Screen blurred.`);
        isFocusedRef.current = false;
        // Reset meeting ID on blur to ensure next focus is fresh
        setMeetingIdState(undefined); 
      };
    }, [isActiveRef, isFocusedRef, session, supabase]) 
  );

  // --- Derived State ---
  const isReadyToRecord = hasPermission && !!meetingIdState && !isInitializing && !isCreatingMeeting && !isProcessing && !stopInitiated;

  // --- UI Handlers ---

  // Handle starting the recording
  const handleStartRecording = async () => {
    console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] handleStartRecording called. isReadyToRecord=${isReadyToRecord}, meetingId=${meetingIdState}, hasPermission=${hasPermission}, isRecording=${isRecording}, isInitializing=${isInitializing}`);
    if (!isReadyToRecord) {
      console.warn(`[WARN ${new Date().toISOString()}] Attempted to start recording when not ready. isReady=${isReadyToRecord}`);
      if (!meetingIdState) console.warn(` - Reason: meetingIdState is missing.`);
      if (!hasPermission) console.warn(` - Reason: No permission.`);
      if (isRecording) console.warn(` - Reason: Already recording.`);
      if (isInitializing) console.warn(` - Reason: Still initializing.`);
      return; 
    }
    // Removed meetingId check here as it's part of isReadyToRecord

    console.log(`[LOG ${new Date().toISOString()}] handleStartRecording: Starting recording for meeting: ${meetingIdState}`);
    setErrorMessage(null); 
    setRecordingTime(0); 

    try {
      await startRecording(); 
      console.log(`[LOG ${new Date().toISOString()}] handleStartRecording: Recording started successfully via hook.`);
    } catch (error: any) {
      console.error(`[ERROR ${new Date().toISOString()}] handleStartRecording: Error starting recording via hook:`, error);
      setErrorMessage(`Failed to start recording: ${error.message}`);
    }
  };

  const handleGoBack = () => {
    if (isRecording) {
      Alert.alert(
        "Stop Recording?",
        "Are you sure you want to go back? The current recording will be stopped and discarded.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Stop & Discard",
            style: "destructive",
            onPress: async () => { 
              await handleStopRecording(true); 
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  };

  // --- Styles (Moved inside component) ---
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    processingContainer: {
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center', 
    },
    processingInnerContainer: {
      width: '100%', 
      alignItems: 'center', 
      paddingHorizontal: 20, 
    },
    header: {
      width: '100%',
      height: 60, 
    },
    backButton: {
      position: 'absolute',
      top: 60, 
      left: 20,
      zIndex: 10, 
      padding: 10,
    },
    contentContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    timerContainer: {
      alignItems: 'center',
      marginBottom: 30, 
    },
    timerText: {
      fontSize: 18,
      marginBottom: 10,
      color: themeColors.foreground,
    },
    timer: {
      fontSize: 48, 
      fontWeight: 'bold',
      fontVariant: ['tabular-nums'], 
      color: themeColors.foreground,
    },
    controlsContainer: {
      flexDirection: 'row', 
      alignItems: 'center',
      justifyContent: 'center', 
      marginTop: 20, 
    },
    recordStopButton: {
      width: 100, 
      height: 100, 
      borderRadius: 50, 
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 20, 
    },
    readyButton: {
      backgroundColor: themeColors.primary, 
    },
    recordingButton: {
      backgroundColor: themeColors.destructive,
    },
    disabledButton: {
      opacity: 0.5, 
    },
    buttonText: {
      fontSize: 18,
      color: themeColors.primaryForeground,
    },
    discardButton: {
      backgroundColor: themeColors.muted, 
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 20,
      position: 'absolute', 
      right: -60, 
    },
    discardButtonText: {
      color: themeColors.mutedForeground,
    },
    statusText: {
      fontSize: 18,
      textAlign: 'center',
      marginVertical: 20,
      color: themeColors.foreground,
    },
    errorText: {
      fontSize: 16,
      color: themeColors.destructive,
      textAlign: 'center',
      marginVertical: 20,
      paddingHorizontal: 20,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#FFFFFF', 
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 100, 
    },
    overlayText: {
      color: themeColors.foreground, 
      fontSize: 18,
      fontWeight: 'bold',
      marginTop: 10,
    },
    visualizerContainer: { 
      marginTop: 20,
      height: 60, 
      width: '50%', 
      justifyContent: 'center',
      alignItems: 'center',
    },
    visualizerBase: { 
      height: '100%',
      width: 15, 
      backgroundColor: themeColors.border, 
      borderRadius: 8,
      overflow: 'hidden', 
      justifyContent: 'flex-end', 
    },
    visualizerLevel: { 
      width: '100%',
      borderRadius: 8, 
      // backgroundColor is set dynamically
      // height is set dynamically
    },
    controlButton: {
      paddingVertical: 15,
      paddingHorizontal: 30,
      borderRadius: 30,
      marginHorizontal: 10, 
      justifyContent: 'center',
      alignItems: 'center',
    },
    recordingControlsRow: { 
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    pauseButton: {
      backgroundColor: '#FFA500', 
    },
    resumeButton: {
      backgroundColor: '#32CD32', 
    },
    stopButton: {
      backgroundColor: '#FF4136', 
    },
  });

  // --- Render ---
  if (isProcessing) {
    return (
      <SafeAreaView style={[styles.processingContainer, { backgroundColor: themeColors.background }]}>
        <ProcessingIndicator currentStep={processingStep} />
      </SafeAreaView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header/Back Button */}
      <View style={styles.header}> 
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Text style={{ color: themeColors.primary }}>Back</Text>
        </Pressable>
      </View>

      {/* Main Content */} 
      <View style={styles.contentContainer}>
        
        {/* Initialization / Loading / Error States - Removed Initializing & Creating Meeting Text */}
        {!hasPermission ? (
          <View style={{alignItems: 'center'}}>
             <Text style={[styles.statusText, { color: themeColors.destructive, marginBottom: 10 }]}>Audio Permission Required</Text>
             {/* Optionally add a button to re-request permission or guide to settings */} 
          </View>
        ) : errorMessage ? (
            <Text style={[styles.errorText, { color: themeColors.destructive }]}>{errorMessage}</Text>
        ) : (
          // Ready State or Recording State
          <>
            {/* Recording Timer and Status */} 
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>
                {isRecording ? (isPaused ? 'Paused' : 'Recording...') : hasPermission ? 'Ready to Record' : ''}
              </Text>
              <Text style={styles.timer}>{formatTime(recordingTime)}</Text> 
              {/* Audio Level Visualizer */} 
              {isRecording && !isPaused && (
                <View style={styles.visualizerContainer}>
                  <View style={styles.visualizerBase}>
                    <View 
                      style={[
                        styles.visualizerLevel, 
                        { 
                          height: `${10 + audioLevel * 90}%`, 
                          backgroundColor: themeColors.primary 
                        }
                      ]} 
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Recording Controls */} 
            <View style={styles.controlsContainer}>
              {/* Conditional Rendering based on Recording and Paused State */}
              {isRecording ? (
                // Recording is active (either running or paused)
                <View style={styles.recordingControlsRow}> 
                  {isPaused ? (
                    // --- PAUSED STATE --- 
                    <TouchableOpacity
                      style={[styles.controlButton, styles.resumeButton]} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        resumeRecording();
                      }}
                    >
                      <Text style={styles.buttonText}>Resume</Text>
                    </TouchableOpacity>
                  ) : (
                    // --- ACTIVELY RECORDING STATE --- 
                    <TouchableOpacity
                      style={[styles.controlButton, styles.pauseButton]} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        pauseRecording();
                      }}
                    >
                      <Text style={styles.buttonText}>Pause</Text>
                    </TouchableOpacity>
                  )}
                  {/* STOP BUTTON (Always show when recording/paused) */}
                   <TouchableOpacity
                      style={[styles.controlButton, styles.stopButton]} 
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleStopRecording();
                      }}
                   >
                     <Text style={styles.buttonText}>Stop</Text>
                   </TouchableOpacity>
                </View>
              ) : (
                // --- READY/INITIAL STATE --- 
                <TouchableOpacity
                  style={[
                    styles.recordStopButton, 
                    styles.readyButton, 
                    // Existing disable logic
                    (!hasPermission ||
                     !meetingIdState ||
                     isInitializing ||
                     isCreatingMeeting ||
                     isProcessing ||
                     stopInitiated ||
                     isTranscribing ||
                     isGenerating
                    ) && styles.disabledButton
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    handleStartRecording();
                  }}
                  disabled={
                    // Existing disable logic
                    !hasPermission ||
                    !meetingIdState ||
                    isInitializing ||
                    isCreatingMeeting ||
                    isProcessing ||
                    stopInitiated ||
                    isTranscribing ||
                    isGenerating
                  }
                >
                  <Text style={styles.buttonText}>Record</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>

      {/* Loading/Processing Overlay - Only show for stop/processing */}
      {(isProcessing || stopInitiated) && (
        <View style={[styles.overlay, { backgroundColor: themeColors.background }]}>
          {/* Replace Text with ProcessingIndicator */} 
          <ProcessingIndicator currentStep={processingStep} />
        </View>
      )}
    </View>
  );
}
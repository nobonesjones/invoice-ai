import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, AppState, AppStateStatus, Pressable } from 'react-native'; 
import { useRouter, useFocusEffect } from 'expo-router';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av'; 
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
  const [isRecording, setIsRecording] = useState(false);
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
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); 

  // --- Custom Hooks (must be defined before callbacks that use them) ---
  const { transcribeAudio, isTranscribing, error: transcriptionError } = useTranscription();
  const { generateMinutes, isGenerating, error: minutesError } = useMinutesGeneration(); 

  const {
    audioLevel, // Destructure audioLevel
    startRecording,
    stopRecording,
    isRecording: isAudioHookRecording, 
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
        setIsRecording(false); // Manually update state if needed
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
      // Call the hook's stopRecording and get the result object
      const result = await stopRecording(meetingIdState);
      const { uri, durationMillis } = result || {}; // Destructure safely
      if (!uri) {
          console.error(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Stop recording failed: No URI returned.`);
          // Set error message, but keep processing indicator on transcribing briefly before showing error?
          // Or directly throw to show error?
          throw new Error('Recording failed: No audio file URI returned.');
      }
      if (!isActiveRef.current) throw new Error("Component inactive after stopping recording");

      // --- Step 2: Transcription --- 
      console.log(`[LOG ${new Date().toISOString()}] handleStopRecording: Starting transcribeAudio. URI: ${uri}, MeetingID: ${meetingIdState}, Duration: ${durationMillis}`);
      // Pass the durationMillis to transcribeAudio
      await transcribeAudio(uri, meetingIdState, durationMillis);
      console.log(`[LOG ${new Date().toISOString()}] handleStopRecording: Finished transcribeAudio.`);
      if (transcriptionError) { // Check for transcription error
          throw new Error(`Transcription failed: ${transcriptionError}`);
      }
      if (!isActiveRef.current) throw new Error("Component inactive after transcription");

      // Update step before starting generation
      setProcessingStep('generating');

      // --- Step 3: Generate Minutes --- 
      console.log(`[LOG ${new Date().toISOString()}] handleStopRecording: Starting generateMinutes.`);
      // Call generateMinutes (assuming it uses meetingIdState internally)
      await generateMinutes(meetingIdState);
      console.log(`[LOG ${new Date().toISOString()}] handleStopRecording: Finished generateMinutes.`);
      if (minutesError) { // Check for minutes error - Removed !generatedMinutes check
          throw new Error(`Minutes generation failed: ${minutesError}`);
      }
      if (!isActiveRef.current) throw new Error("Component inactive after minutes generation");

      // --- Step 4: Finishing --- 
      setProcessingStep('finishing');

      console.log(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Processing complete for meeting: ${meetingIdState}`);
      
      // --- Navigation --- 
      // Keep step as 'finishing' until navigation is complete
      console.log(`[LOG ${new Date().toISOString()}] handleStopRecording: Navigating to meeting page.`);
      router.push(`/(app)/(protected)/meeting/${meetingIdState}?tab=transcript`);

    } catch (error) {
      console.error(`[LOG RECORDING SCREEN ${new Date().toISOString()}] Error during stop/processing:`, error);
      if (isActiveRef.current) {
        // Check if error is an instance of Error before accessing message
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
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
    setIsRecording(isAudioHookRecording);
  }, [isAudioHookRecording]);

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
    if (isRecording) {
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        if (isActiveRef.current) { 
          setRecordingTime((Date.now() - startTime) / 1000);
        }
      }, 100); 
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Don't reset recordingTime here, keep the final time until next recording starts
    }
    
    // Cleanup interval on unmount or when recording stops
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [isRecording]);

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
      setIsRecording(false);
      setStopInitiated(false);
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
    },
    header: {
      width: '100%',
      height: 60, 
      // Add other styling like background color if desired
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
      fontVariant: ['tabular-nums'], // Ensures monospace digit spacing
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
      marginHorizontal: 20, // Add some space around the main button
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
      position: 'absolute', // Position it relative to the controls container
      right: -60, // Adjust as needed to position next to the main button
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
    visualizerContainer: { // Container for the visualizer bar
      marginTop: 20,
      height: 60, // Fixed height for the container
      width: '50%', // Take up some width
      justifyContent: 'center',
      alignItems: 'center',
    },
    visualizerBase: { // The background/base of the bar
      height: '100%',
      width: 15, // Fixed width for the bar
      backgroundColor: themeColors.border, // Use theme border color
      borderRadius: 8,
      overflow: 'hidden', // Clip the level indicator
      justifyContent: 'flex-end', // Make the level grow from bottom
    },
    visualizerLevel: { // The actual level indicator
      width: '100%',
      borderRadius: 8, // Match base rounding
      // backgroundColor is set dynamically
      // height is set dynamically
    },
  });

  // --- Render ---
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
                {isRecording ? 'Recording...' : hasPermission ? 'Ready to Record' : ''}
              </Text>
              <Text style={styles.timer}>{formatTime(recordingTime)}</Text> 
              {/* Audio Level Visualizer */} 
              {isRecording && (
                <View style={styles.visualizerContainer}>
                  <View style={styles.visualizerBase}>
                    <View 
                      style={[
                        styles.visualizerLevel, 
                        { 
                          height: `${10 + audioLevel * 90}%`, // Height from 10% to 100%
                          backgroundColor: themeColors.primary // Use theme color
                        }
                      ]} 
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Recording Controls */} 
            <View style={styles.controlsContainer}>
              {/* Main Record/Stop Button */} 
              <TouchableOpacity 
                style={[
                  styles.recordStopButton, 
                  isRecording ? styles.recordingButton : styles.readyButton,
                  (!isRecording && 
                    (!hasPermission || 
                     !meetingIdState || 
                     isInitializing || 
                     isCreatingMeeting || 
                     isProcessing || // Local processing state
                     stopInitiated ||
                     isTranscribing || // Correct hook state
                     isGenerating // Correct hook state
                    )
                  ) && styles.disabledButton 
                ]}
                onPress={isRecording ? () => handleStopRecording() : handleStartRecording}
                disabled={
                  isRecording 
                    ? false // Stop button MUST be enabled when recording
                    : // Record button is disabled if prerequisites not met OR any processing is active
                      !hasPermission || 
                      !meetingIdState || 
                      isInitializing || 
                      isCreatingMeeting || 
                      isProcessing || // Local processing state
                      stopInitiated ||
                      isTranscribing || // Correct hook state
                      isGenerating // Correct hook state
                }
              >
                <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Record'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Loading/Processing Overlay - Only show for stop/processing */}
      {(isProcessing || stopInitiated) && (
        <View style={styles.overlay}>
          {/* Replace Text with ProcessingIndicator */} 
          <ProcessingIndicator currentStep={processingStep} />
        </View>
      )}
    </View>
  );
}
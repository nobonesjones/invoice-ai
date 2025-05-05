import { View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Play, Pause, RefreshCw, MoreHorizontal } from 'lucide-react-native';
import React, { useState, useEffect, useRef } from 'react';
import { Share } from 'react-native'; // Import Share API
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/config/supabase';
import { Audio, AVPlaybackStatus } from 'expo-av';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics'; // Import Haptics

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ActionItemsList } from '@/components/ActionItemsList';
import { ChatInterface } from '@/components/ChatInterface';
import { ShareMeetingModal } from '@/components/modals/ShareMeetingModal'; // Import the new modal
import { useTheme } from '@/context/theme-provider'; // Import useTheme

interface Meeting {
  id: string;
  name: string;
  duration: number;
  created_at: string;
  transcript_json?: any;
  minutes_json?: any;
  minutes_text?: string;
  transcript?: string;
  has_minutes?: boolean;
  audio_url?: string;
}

type TabType = 'minutes' | 'transcript' | 'chat';

export default function MeetingView() {
  const router = useRouter();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: TabType }>();
  const { isLightMode, theme } = useTheme(); // Correct destructuring: use 'theme'
  const currentSchemeString = isLightMode ? 'light' : 'dark'; // Keep for potential direct access if needed

  const [activeTab, setActiveTab] = useState<TabType>(tab as TabType || 'minutes');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Add state for meeting name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [newMeetingName, setNewMeetingName] = useState('');
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // Implement lazy loading for tab content
  const [tabSpecificLoading, setTabSpecificLoading] = useState({
    minutes: false,
    transcript: false,
    chat: false,
    actionItems: false
  });

  // Add polling intervals
  const [pollingActive, setPollingActive] = useState(true);
  const [pollingCount, setPollingCount] = useState(0);

  // Add refreshing state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add audio states
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioLoadAttempts, setAudioLoadAttempts] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const maxAudioLoadAttempts = 3;

  // Ref to track if playback should resume after seeking
  const wasPlayingBeforeSeek = useRef(false);

  // State for share modal visibility
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);

  useEffect(() => {
    if (id) {
      // Load everything in parallel instead of sequentially
      Promise.all([
        fetchMeeting(),
        fetchTranscripts(),
        fetchActionItems()
      ]).then(() => {
        setIsLoading(false);
      }).catch(error => {
        console.error('Error loading meeting data:', error);
        setIsLoading(false);
      });
      
      // Subscribe to action items changes
      const actionItemsSubscription = supabase
        .channel('action_items_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'action_items',
            filter: `meeting_id=eq.${id}`
          },
          (payload) => {
            console.log('Action items changed:', payload);
            // Refresh action items when there's a change
            fetchActionItems();
          }
        )
        .subscribe();

      // Subscribe to transcript changes
      const transcriptSubscription = supabase
        .channel('transcript_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transcripts',
            filter: `meeting_id=eq.${id}`
          },
          (payload) => {
            console.log('Transcript changed:', payload);
            // Refresh transcripts when there's a change
            fetchTranscripts();
          }
        )
        .subscribe();
      
      return () => {
        // Cleanup sound and subscriptions when component unmounts
        if (sound) {
          sound.unloadAsync();
        }
        actionItemsSubscription.unsubscribe();
        transcriptSubscription.unsubscribe();
      };
    }
  }, [id]);

  useEffect(() => {
    // When tab changes, ensure content for that tab is loaded
    if (activeTab === 'transcript' && transcripts.length === 0) {
      setTabSpecificLoading(prev => ({ ...prev, transcript: true }));
      fetchTranscripts().finally(() => {
        setTabSpecificLoading(prev => ({ ...prev, transcript: false }));
      });
    } else if (activeTab === 'minutes' && !meeting?.minutes_text) {
      setTabSpecificLoading(prev => ({ ...prev, minutes: true }));
      // Refresh meeting data to get minutes if they've been generated
      fetchMeeting().finally(() => {
        setTabSpecificLoading(prev => ({ ...prev, minutes: false }));
      });
    }
  }, [activeTab]);

  useEffect(() => {
    // Only poll if we're missing data and haven't exceeded max attempts
    if (!pollingActive || pollingCount > 20) return;
    
    // Set up polling interval
    const pollInterval = setInterval(() => {
      console.log(`Polling for data (attempt ${pollingCount + 1})`);
      
      // Check if we need to poll for transcript
      if (activeTab === 'transcript' && transcripts.length === 0) {
        fetchTranscripts(true);
      }
      
      // Check if we need to poll for action items
      if (actionItems.length === 0) {
        fetchActionItems(true);
      }
      
      // Increment polling count
      setPollingCount(prev => prev + 1);
      
      // Stop polling if we have all data or exceeded max attempts
      if ((transcripts.length > 0 && actionItems.length > 0) || pollingCount >= 20) {
        console.log('Stopping polling - data received or max attempts reached');
        clearInterval(pollInterval);
        setPollingActive(false);
      }
    }, 500); // Poll every 500ms
    
    return () => clearInterval(pollInterval);
  }, [pollingActive, pollingCount, transcripts.length, actionItems.length, activeTab]);

  useEffect(() => {
    if (id) {
      setPollingCount(0);
      setPollingActive(true);
    }
  }, [id]);

  const fetchMeeting = async () => {
    try {
      // Use RPC (Remote Procedure Call) for faster response
      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .select('id, name, duration, created_at, minutes_text, audio_url') // Select only needed fields
        .eq('id', id)
        .single();

      if (meetingError) throw meetingError;

      // Fetch transcript with a more efficient query
      const { data: transcriptData, error: transcriptError } = await supabase
        .from('transcripts')
        .select('content')
        .eq('meeting_id', id)
        .limit(1) // Limit to 1 result for faster query
        .single();

      if (transcriptError && transcriptError.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" - not an error if no transcript yet
        throw transcriptError;
      }

      setMeeting({
        ...meetingData,
        transcript: transcriptData?.content || null
      });

      // Automatically load audio if URL exists
      if (meetingData.audio_url) {
        loadAudio(meetingData.audio_url);
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
    }
  };

  const fetchTranscripts = async (silent = false) => {
    try {
      if (!silent) {
        setTabSpecificLoading(prev => ({ ...prev, transcript: true }));
      }
      
      // Use a more efficient query with only needed fields and appropriate limits
      const { data, error } = await supabase
        .from('transcripts')
        .select('content')
        .eq('meeting_id', id)
        .order('timestamp', { ascending: true })
        .limit(50); // Limit to a reasonable number of results

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Process immediately
        const combinedTranscript = data.map(t => t.content).join('\n');
        setTranscripts([combinedTranscript]);
        
        // Stop polling if we were polling
        if (pollingActive && transcripts.length === 0) {
          console.log('Transcript found during polling, stopping transcript polls');
          setPollingActive(false);
        }
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    } finally {
      if (!silent) {
        setTabSpecificLoading(prev => ({ ...prev, transcript: false }));
      }
    }
  };

  const fetchActionItems = async (silent = false) => {
    try {
      if (!silent) {
        setTabSpecificLoading(prev => ({ ...prev, actionItems: true }));
      }
      
      // Use a more efficient query with only needed fields
      const { data, error } = await supabase
        .from('action_items')
        .select('id, content, completed, completed_at, created_at') // Select only needed fields
        .eq('meeting_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Process immediately
      if (data && data.length > 0) {
        setActionItems(data);
        
        // Stop polling if we were polling
        if (pollingActive && actionItems.length === 0) {
          console.log('Action items found during polling, stopping action item polls');
          setPollingActive(false);
        }
      }
    } catch (error) {
      console.error('Error fetching action items:', error);
    } finally {
      if (!silent) {
        setTabSpecificLoading(prev => ({ ...prev, actionItems: false }));
      }
    }
  };

  const loadAudio = async (url: string) => {
    // Reset state before attempting load
    setIsAudioLoading(true);
    setAudioReady(false);
    setAudioError(null);
    let currentAttempt = 1;

    // Extract expected meeting ID from the URL for validation
    const urlParts = url.split('/');
    const expectedMeetingIdInUrl = urlParts[urlParts.length - 2]; // Assumes format .../meetings/{id}/audio.m4a

    // Safeguard - Check if the URL matches the current component ID
    if (expectedMeetingIdInUrl !== id) {
      console.warn(`[loadAudio] Skipping load: URL's meeting ID (${expectedMeetingIdInUrl}) does not match current component ID (${id}). This might be stale data.`);
      setIsAudioLoading(false); // Stop loading indicator
      return; // Exit early
    }

    // Ensure any existing sound is unloaded before starting the load/retry loop for the new URL
    if (sound) {
      console.log(`[loadAudio] Unloading existing sound before attempting load for URL: ${url}`);
      await sound.unloadAsync();
      setSound(null); // Clear sound state immediately
      setPosition(0);
      setDuration(0);
      setIsPlaying(false);
    }

    const tryLoad = async () => {
      // Moved URL validation here
      if (!url || !url.startsWith('http')) {
        console.error('[loadAudio] Invalid audio URL format:', url);
        setAudioError('Invalid audio URL format');
        setIsAudioLoading(false);
        return;
      }
      console.log(`[loadAudio] Attempt ${currentAttempt}/${maxAudioLoadAttempts}: Loading audio from URL: ${url} (Matches component ID: ${id})`);

      try {
        // Initial delay ONLY on the first attempt
        if (currentAttempt === 1) {
          console.log('[loadAudio] Waiting 7000ms before first attempt...');
          await new Promise(resolve => setTimeout(resolve, 7000)); // Increased delay to 7 seconds
        }

        // Create new sound instance
        const { sound: newSound, status } = await Audio.Sound.createAsync(
          { uri: url },
          { shouldPlay: false }
        );

        if (status.isLoaded) {
          console.log(`[loadAudio] Successfully loaded audio on attempt ${currentAttempt}: ${url}`);
          setSound(newSound); // Set the new sound instance
          setDuration(status.durationMillis || 0);
          setPosition(0);
          setIsPlaying(false);
          newSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
          setAudioReady(true);
          setAudioError(null);
          setIsAudioLoading(false);
        } else {
          throw new Error('Audio status reported not loaded after creation.');
        }
      } catch (error: any) {
        console.error(`[loadAudio] Error loading audio on attempt ${currentAttempt}:`, error);
        
        // Critical: Ensure sound state is cleared on error before retry/failure
        setSound(null);
        setAudioReady(false);

        // Set error state only after clearing sound/ready state
        setAudioError(error.message || 'Unknown error loading audio');

        if (currentAttempt < maxAudioLoadAttempts) {
          currentAttempt++;
          console.log(`[loadAudio] Will retry audio loading in 3 seconds (attempt ${currentAttempt}/${maxAudioLoadAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          await tryLoad(); // Retry
        } else {
          console.error(`[loadAudio] Failed to load audio after ${maxAudioLoadAttempts} attempts: ${url}`);
          setIsAudioLoading(false); // Stop loading indicator
        }
      }
    };

    await tryLoad(); // Start the loading process
  };

  const onPlaybackStatusUpdate = async (status: AVPlaybackStatus) => { // Make async
    if (!status.isLoaded) {
      // Handle error state if needed, or return
      if (status.error) {
        console.error(`Playback Error: ${status.error}`);
        // Potentially update UI to show error
        setAudioError(`Playback Error: ${status.error}`); 
        setIsPlaying(false); // Ensure playing state is false on error
      }
      return;
    }

    // Update state based on status
    setIsPlaying(status.isPlaying);
    setPosition(status.positionMillis);
    setDuration(status.durationMillis || 0);

    // Check if playback just finished
    if (status.didJustFinish) {
      console.log('Playback finished, resetting UI state to start.');
      // Only update local state variables to reset the UI
      // Avoid calling sound methods here as it might be unloaded
      setPosition(0); // Update local state
      setIsPlaying(false); // Update playing state
    }
  };

  const handlePlayPause = async () => {
    if (!sound || !audioReady) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      // Check if we are at the end of the track
      const atEnd = duration > 0 && position >= duration - 50; // 50ms tolerance
      let startPosition = position;

      if (atEnd) {
        console.log('Detected playback attempt from end, resetting position to 0 before playing.');
        try {
          await sound.setPositionAsync(0); // Explicitly set position to 0
          startPosition = 0; // Ensure we play from 0
          setPosition(0); // Update state as well
        } catch (error) {
          console.error('Error setting position to 0 before playing:', error);
          // Fallback or handle error - perhaps just try playing from 0 anyway
          startPosition = 0;
        }
      }
      
      await sound.playFromPositionAsync(startPosition);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min ${seconds % 60} sec`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return date.toLocaleDateString(undefined, options);
  };

  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => {
    const isActive = activeTab === tab;
    return (
      <TouchableOpacity
        onPress={() => setActiveTab(tab)}
        // Add conditional style for the bottom border
        style={{
          borderBottomWidth: isActive ? 2 : 0, // Show border only if active
          borderBottomColor: isActive ? theme.primary : 'transparent', // Use theme color
        }}
        // Keep padding in className for consistency
        className={`flex-1 items-center py-2.5`}
      >
        <Text 
          style={{
            color: isActive ? theme.primary : theme.mutedForeground,
            fontWeight: isActive ? '600' : '400'
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'minutes':
        return (
          <ScrollView className="flex-1 px-4">
            {tabSpecificLoading.minutes ? (
              <View className="flex-1 items-center justify-center py-8" style={{ backgroundColor: theme.card }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ marginTop: 8, color: theme.mutedForeground }}>
                  Processing minutes...
                </Text>
              </View>
            ) : meeting?.minutes_text ? (
              <View>
                {/* Parse and display the minutes in the specified order */}
                {renderMinutesInOrder(meeting.minutes_text)}
              </View>
            ) : (
              <Text style={{ color: theme.foreground }}>
                Minutes are being generated...
              </Text>
            )}
          </ScrollView>
        );
      case 'transcript':
        return (
          <ScrollView className="flex-1 px-4 mt-4">
            {tabSpecificLoading.transcript ? (
              <View className="flex-1 items-center justify-center py-8" style={{ backgroundColor: theme.card }}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ marginTop: 8, color: theme.mutedForeground }}>
                  Processing transcript...
                </Text>
              </View>
            ) : (
              <Text style={{ color: theme.foreground }}>
                {transcripts.length > 0 ? transcripts[0] : 'No transcript available yet.'}
              </Text>
            )}
          </ScrollView>
        );
      case 'chat':
        return (
          <View className="flex-1">
            {tabSpecificLoading.chat ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={{ marginTop: 8, color: theme.mutedForeground }}>
                  Loading chat...
                </Text>
              </View>
            ) : meeting?.transcript && meeting?.minutes_text && meeting?.id ? (
              <ChatInterface 
                transcript={meeting.transcript} 
                minutes={meeting.minutes_text}
                meetingId={meeting.id}
              />
            ) : (
              <View className="flex-1 items-center justify-center p-4">
                <Text style={{ color: theme.foreground }} className="text-center">
                  Chat will be available once the meeting transcript and minutes are generated.
                </Text>
              </View>
            )}
          </View>
        );
      default:
        return null;
    }
  };

  // Helper function to render minutes in the specified order
  const renderMinutesInOrder = (minutesText: string) => {
    if (!minutesText) return null;

    const lines = minutesText.split('\n');
    const sections: { [key: string]: string[] } = {
      summary: [],
      minutes: [],
      actionItems: [] // We won't render this directly, but parse for completeness
    };
    let currentSection: keyof typeof sections | null = null;

    lines.forEach(line => {
      const trimmedLine = line.trim();
      // Use the new headings with asterisks
      if (trimmedLine.startsWith('**Meeting Summary:**')) {
        currentSection = 'summary';
      } else if (trimmedLine.startsWith('**Meeting Minutes:**')) {
        currentSection = 'minutes';
      } else if (trimmedLine.startsWith('**Main Action Items:**')) {
        currentSection = 'actionItems'; 
        // Don't add the heading itself to actionItems section if it's just "None"
        if (lines.find(l => l.trim() === '**Main Action Items:**')?.split('\n').map(s => s.trim()).filter(Boolean)[1]?.toLowerCase() === 'none') {
            // If the line immediately after Action Items is 'None', skip adding lines to this section
        } else if (currentSection && trimmedLine !== '**Main Action Items:**') { // Avoid adding the heading itself
           sections[currentSection].push(line); // Push original line to preserve formatting
        }
      } else if (currentSection && trimmedLine) { // Add non-empty lines to the current section
         // Add line to the current section, excluding the heading lines themselves
         if (currentSection === 'summary' && trimmedLine !== '**Meeting Summary:**') {
            sections.summary.push(line);
         } else if (currentSection === 'minutes' && trimmedLine !== '**Meeting Minutes:**') {
            sections.minutes.push(line);
         }
         // Action items are handled by the ActionItemsList component, so no need to push here
      }
    });

    // Filter out the heading lines from the content arrays
    const cleanSummary = sections.summary.filter(line => !line.trim().startsWith('**Meeting Summary:**')).join('\n').trim();
    const cleanMinutes = sections.minutes.filter(line => !line.trim().startsWith('**Meeting Minutes:**')).join('\n').trim();

    // Enhanced rendering logic for different sections
    const renderSectionContent = (header: string, content: string) => {
      const title = header.replace(/\*\*/g, ''); // Remove asterisks for display

      // ALWAYS render Meeting Summary as paragraphs, NEVER as bullets
      if (header === '**Meeting Summary:**') {
        const paragraphs = content.split('\n').map(p => p.trim()).filter(p => p);
        if (paragraphs.length === 0) return null;
        return (
          <View key={header} className="mb-4">
            <Text className="text-lg font-bold mb-2" style={{ color: theme.foreground }}>{title}</Text>
            {paragraphs.map((paragraph, index) => (
              <Text key={index} className="mb-2" style={{ color: theme.foreground, lineHeight: 20 }}>
                {paragraph}
              </Text>
            ))}
          </View>
        );
      }

      // Handle "Meeting Minutes" or general bullet points
      if (header === '**Meeting Minutes:**' || content.includes('\n- ')) {
        const points = content.split('\n').map(p => p.trim()).filter(p => p);
        if (points.length === 0) return null;
        return (
          <View key={header} className="mb-4">
            <Text className="text-lg font-bold mb-2" style={{ color: theme.foreground }}>{title}</Text>
            {points.map((point, index) => (
              <View key={index} className="flex-row mb-1">
                <Text style={{ color: theme.foreground, marginLeft: 0, marginRight: 8 }}>•</Text>
                <Text style={{ color: theme.foreground }} className="flex-1">
                  {point.replace(/^[•\-\*]\s*/, '')}
                </Text>
              </View>
            ))}
          </View>
        );
      }

      // Default rendering for other sections
      return (
        <View key={header} className="mb-4">
          <Text className="text-lg font-bold mb-2" style={{ color: theme.foreground }}>{title}</Text>
          <Text style={{ color: theme.foreground }}>
            {content}
          </Text>
        </View>
      );
    };

    return (
      <View className="px-2 py-4 mt-4">
        {cleanSummary ? (
          renderSectionContent('**Meeting Summary:**', cleanSummary)
        ) : null}
        
        {/* Action Items Section (using the dedicated component) */}
        <View className="mb-4">
          <Text className="text-lg font-bold mb-2" style={{ color: theme.foreground }}>
            Action Items
          </Text>
          <View className="pl-0 ml-0">
            <ActionItemsList meetingId={meeting!.id} actionItems={actionItems} />
          </View>
        </View>

        {cleanMinutes ? (
          renderSectionContent('**Meeting Minutes:**', cleanMinutes)
        ) : null}
      </View>
    );
  };

  const handleUpdateMeetingName = async () => {
    if (!meeting || !newMeetingName.trim() || newMeetingName === meeting.name) {
      setIsEditingName(false);
      return;
    }

    try {
      setIsUpdatingName(true);
      
      const { error } = await supabase
        .from('meetings')
        .update({ 
          name: newMeetingName,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setMeeting({
        ...meeting,
        name: newMeetingName
      });
      
      setIsEditingName(false);
    } catch (error) {
      console.error('Error updating meeting name:', error);
    } finally {
      setIsUpdatingName(false);
    }
  };

  // Add refresh function
  const refreshCurrentTab = () => {
    setIsRefreshing(true);
    console.log('Manual refresh triggered for tab:', activeTab);
    
    Promise.all([
      fetchMeeting(),
      activeTab === 'transcript' ? fetchTranscripts() : Promise.resolve(),
      fetchActionItems()
    ]).finally(() => {
      setIsRefreshing(false);
      console.log('Manual refresh completed');
    });
  };

  // Handler for when the user finishes dragging the slider
  const handleSeek = async (value: number) => {
    if (!sound || !audioReady) return;
    try {
      await sound.setPositionAsync(value);
      setPosition(value); // Update position state immediately
      // Resume playback if it was playing before seeking
      if (wasPlayingBeforeSeek.current) {
        await sound.playAsync();
        setIsPlaying(true); // Ensure state reflects playing
      }
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  };

  // Handler for when the user starts dragging the slider
  const handleSlidingStart = async () => {
    if (!sound || !audioReady) return;
    wasPlayingBeforeSeek.current = isPlaying;
    if (isPlaying) {
      await sound.pauseAsync(); // Pause playback while seeking
    }
  };

  // Determine slider or placeholder content
  let sliderOrPlaceholderContent;
  if (audioReady && sound) {
    sliderOrPlaceholderContent = (
      <View style={styles.sliderContainer}> 
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration}
          value={position}
          minimumTrackTintColor={theme.primary} 
          maximumTrackTintColor={theme.border} 
          thumbTintColor={theme.primary} 
          onSlidingStart={handleSlidingStart}
          onSlidingComplete={handleSeek}
        />
        <View style={styles.timeContainer} className="flex-row justify-between mt-0"> 
          <Text style={{ color: theme.mutedForeground }} className="text-xs">
            {formatTime(position)}
          </Text>
          <Text style={{ color: theme.mutedForeground }} className="text-xs">
            {formatTime(duration)}
          </Text>
        </View>
      </View>
    );
  } else {
    sliderOrPlaceholderContent = (
      <View style={[styles.sliderContainer, { justifyContent: 'center', alignItems: 'center' }]}> 
        {audioError ? (
            <Text style={{ color: theme.destructive }} className="text-xs text-center">
             Error: {audioError.length > 60 ? audioError.substring(0, 60) + '...' : audioError}
            </Text>
          ) : <View style={{ height: 10 }} />}
      </View>
    );
  }

  // --- Share Modal Handlers ---
  const openShareModal = () => setIsShareModalVisible(true);
  const closeShareModal = () => setIsShareModalVisible(false);

  // Placeholder share handlers (implement logic next)
  const handleShareMinutes = async () => {
    if (!meeting?.minutes_text) {
      console.warn('No minutes text available to share.');
      // Optionally show an alert to the user
      return;
    }
    try {
      await Share.share({
        message: `Meeting Minutes: ${meeting.name}\n\n${meeting.minutes_text}`,
        title: `Minutes for ${meeting.name}` // Optional: for email subject etc.
      });
    } catch (error) {
      console.error('Error sharing minutes:', error);
      // Optionally show an alert to the user
    }
    closeShareModal();
  };
  const handleShareTranscript = async () => {
    if (!meeting?.transcript) {
      console.warn('No transcript available to share.');
      return;
    }
    try {
      await Share.share({
        message: `Meeting Transcript: ${meeting.name}\n\n${meeting.transcript}`,
        title: `Transcript for ${meeting.name}`
      });
    } catch (error) {
      console.error('Error sharing transcript:', error);
    }
    closeShareModal();
  };
  const handleShareAudio = async () => {
    if (!meeting?.audio_url) {
      console.warn('No audio URL available to share.');
      return;
    }
    // Basic check if it looks like a URL
    if (!meeting.audio_url.startsWith('http')) {
      console.warn('Invalid audio URL format:', meeting.audio_url);
      return; 
    }
    try {
      await Share.share({
        message: `Audio recording for meeting: ${meeting.name}\n${meeting.audio_url}`,
        url: meeting.audio_url, // url is specifically for platforms like iOS
        title: `Audio for ${meeting.name}`
      });
    } catch (error) {
      console.error('Error sharing audio URL:', error);
    }
    closeShareModal();
  };

  return (
    <View style={{ backgroundColor: theme.background }} className="flex-1">
      {/* Header with Gradient Background */}
      <LinearGradient
        colors={['#A2C3F7', '#D94DD6', '#FBC1A9']} // Always use light mode gradient
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
          paddingTop: 60, // Increased padding to accommodate status bar etc.
          paddingBottom: 20,
          position: 'relative', // Add relative positioning for absolute children
          borderBottomLeftRadius: 24, // Changed to 24
          borderBottomRightRadius: 24, // Changed to 24
          borderRadius: 10, // Added for overall rounded corners
          borderBottomColor: theme.border, // Use theme color
          borderBottomWidth: 1
        }}
      >
        {/* Large touch area for back button (blue area) */}
        <TouchableOpacity 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Add haptic feedback
            router.back();
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '30%', // Wider touch area on the left side
            height: '100%', // Full height of the header
            zIndex: 10 // Ensure it's above other elements
          }}
        />

        {/* Back Button - Visual only */}
        <View className="flex-row items-center px-4 mb-3">
          <ChevronLeft size={24} color={theme.primaryForeground} />
        </View>

        {/* Three Dots Menu Button */}
        <TouchableOpacity
          onPress={openShareModal} // Open the modal
          style={{
            position: 'absolute',
            top: 60, // Align with back button roughly
            right: 16,
            padding: 8, // Add padding for easier tapping
            zIndex: 10 // Ensure it's above gradient content
          }}
        >
          <MoreHorizontal size={24} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Meeting Info */}
        <View className="px-4">
          {isEditingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={newMeetingName}
                onChangeText={setNewMeetingName}
                style={{
                  color: theme.primaryForeground,
                  fontSize: 30,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                  flex: 1,
                  marginBottom: 12,
                  paddingVertical: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.primaryForeground,
                }}
                autoFocus
              />
              <TouchableOpacity 
                onPress={handleUpdateMeetingName}
                disabled={isUpdatingName}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: theme.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                {isUpdatingName ? (
                  <ActivityIndicator size="small" color={theme.primaryForeground} />
                ) : (
                  <Text style={{ color: theme.primaryForeground, fontSize: 16 }}>✓</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {/* Touch area for editing name (yellow area) */}
              <TouchableOpacity
                onPress={() => {
                  setNewMeetingName(meeting?.name || '');
                  setIsEditingName(true);
                }}
                activeOpacity={0.7}
                style={{ 
                  position: 'absolute',
                  top: -10,
                  left: 0,
                  width: '100%',
                  height: 60,
                  zIndex: 5
                }}
              />
              
              {/* Meeting name - Visual only */}
              <Text 
                className="text-white text-3xl font-semibold mb-3" 
                style={{ letterSpacing: 0.3, marginTop: -3 }}
              >
                {meeting?.name || 'Loading...'}
              </Text>
            </View>
          )}
          
          <View 
            className="flex-row items-center justify-between"
            style={{ marginTop: -2 }}
          >
            <Text className="text-white opacity-80 text-sm">
              {meeting ? formatDate(meeting.created_at) : 'Loading...'}
            </Text>
            <Text 
              className="text-white opacity-80 text-sm"
              style={{ paddingRight: 8 }} 
            >
              {meeting ? formatDuration(meeting.duration) : 'Loading...'}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View 
        className="flex-row px-0"
      >
        <TabButton tab="minutes" label="Minutes" />
        <TabButton tab="transcript" label="Transcript" />
        <TabButton tab="chat" label="Chat" />
      </View>

      {/* Content Area */}
      <View style={{ flex: 1, backgroundColor: theme.card }}>
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={{ marginTop: 16, color: theme.mutedForeground }}>
              Loading meeting data...
            </Text>
          </View>
        ) : (
          renderContent()
        )}
      </View>

      {/* Audio Player (Fixed at bottom, hidden on Chat tab) */}
      {meeting?.audio_url && activeTab !== 'chat' && (
        <View 
          style={{
            borderTopColor: theme.border,
            borderTopWidth: 1,
            backgroundColor: theme.background,
            borderTopLeftRadius: 24, // Changed to 24
            borderTopRightRadius: 24, // Changed to 24
            borderRadius: 10, // Added for overall rounded corners
          }}
          className="px-4 py-5 flex-row items-center" 
        >
          {/* Left Button Container (fixed width) */}
          <View style={styles.buttonContainer}>
            {isAudioLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : audioError ? (
               // Placeholder on error for now in this small container
               <View style={{ width: 28 }} />
            ) : audioReady && sound ? (
              <TouchableOpacity 
                onPress={handlePlayPause} 
                style={{ transform: [{ translateY: -4 }] }} // Increased nudge amount further
              >
                {isPlaying ? (
                  <Pause size={28} color={theme.primary} />
                ) : (
                  <Play size={28} color={theme.primary} />
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 28 }} /> // Placeholder for alignment
            )}
          </View>
           
          {/* Container View for Slider OR Error/Placeholder */}
          <View className="flex-1 mx-2">
            {sliderOrPlaceholderContent}
          </View>

          {/* Right Placeholder (fixed width) */}
          <View style={styles.buttonContainer} />
        </View>
      )}
      
      {/* Share Modal */}
      <ShareMeetingModal 
        isVisible={isShareModalVisible}
        onClose={closeShareModal}
        onShareMinutes={handleShareMinutes}
        onShareTranscript={handleShareTranscript}
        onShareAudio={handleShareAudio}
        hasAudio={!!meeting?.audio_url} // Pass boolean based on audio_url existence
      />
    </View>
  );
}

// Add StyleSheet for Slider
const styles = StyleSheet.create({
  buttonContainer: { // Style for left/right fixed width containers
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderContainer: {
    flex: 1,
  },
  slider: {
    width: '100%',
    height: 10, // Reduced height for thinner look
  },
  timeContainer: {
    width: '100%',
  }
});
import { View, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Play, Pause, RefreshCw } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/config/supabase';
import { Audio, AVPlaybackStatus } from 'expo-av';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { ActionItemsList } from '@/components/ActionItemsList';
import { ChatInterface } from '@/components/ChatInterface';
import { colors } from '@/constants/colors';

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

      // Don't automatically load audio - let user trigger it manually
      // if (meetingData.audio_url) {
      //   loadAudio(meetingData.audio_url);
      // }
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
    try {
      // Clear previous errors
      setAudioError(null);
      setIsAudioLoading(true);
      
      // Skip loading if we've already tried too many times
      if (audioLoadAttempts >= maxAudioLoadAttempts) {
        setAudioError(`Failed to load audio after ${maxAudioLoadAttempts} attempts`);
        return;
      }
      
      console.log(`Loading audio from URL (attempt ${audioLoadAttempts + 1}):`, url);
      
      // Validate URL format
      if (!url || !url.startsWith('http')) {
        throw new Error('Invalid audio URL format');
      }
      
      // Add a longer delay before loading to ensure the audio file is ready
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Unload any existing sound
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }
      
      // Create the sound object with error handling
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      
      // Get initial status to set duration
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        setSound(newSound);
        setDuration(status.durationMillis || 0);
        setAudioLoadAttempts(0); // Reset attempts on success
        setAudioReady(true);
        console.log('Audio loaded successfully, duration:', status.durationMillis);
      } else {
        throw new Error('Audio loaded but status indicates it is not ready');
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      setAudioError(error instanceof Error ? error.message : 'Unknown error loading audio');
      
      // Increment attempt counter
      const newAttemptCount = audioLoadAttempts + 1;
      setAudioLoadAttempts(newAttemptCount);
      
      // Try again after a delay if we haven't exceeded max attempts
      if (newAttemptCount < maxAudioLoadAttempts) {
        console.log(`Will retry audio loading in 3 seconds (attempt ${newAttemptCount + 1}/${maxAudioLoadAttempts})`);
        setTimeout(() => {
          loadAudio(url);
        }, 3000);
      }
    } finally {
      setIsAudioLoading(false);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setIsPlaying(status.isPlaying);
    }
  };

  const handlePlayPause = async () => {
    if (!sound) return;
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
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
    return (
      <TouchableOpacity
        onPress={() => {
          setActiveTab(tab);
          
          // Refresh data when tab is clicked
          if (tab === 'transcript') {
            fetchTranscripts();
          } else if (tab === 'minutes') {
            fetchMeeting();
          }
        }}
        style={{
          flex: 1,
          paddingVertical: 12,
          borderBottomWidth: 2,
          borderBottomColor: activeTab === tab ? colors.light.primary : 'transparent',
          alignItems: 'center'
        }}
      >
        <Text
          style={{
            color: activeTab === tab ? colors.light.primary : colors.light.mutedForeground,
            fontWeight: activeTab === tab ? '600' : '400'
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
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator size="small" color={colors.light.primary} />
                <Text style={{ marginTop: 8, color: colors.light.mutedForeground }}>
                  Loading minutes...
                </Text>
              </View>
            ) : meeting?.minutes_text ? (
              <View>
                {/* Parse and display the minutes in the specified order */}
                {renderMinutesInOrder(meeting.minutes_text)}
              </View>
            ) : (
              <Text style={{ color: colors.light.foreground }}>
                Minutes are being generated...
              </Text>
            )}
          </ScrollView>
        );
      case 'transcript':
        return (
          <ScrollView className="flex-1 px-4">
            {tabSpecificLoading.transcript ? (
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator size="small" color={colors.light.primary} />
                <Text style={{ marginTop: 8, color: colors.light.mutedForeground }}>
                  Loading transcript...
                </Text>
              </View>
            ) : (
              <Text style={{ color: colors.light.foreground }}>
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
                <ActivityIndicator size="small" color={colors.light.primary} />
                <Text style={{ marginTop: 8, color: colors.light.mutedForeground }}>
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
                <Text style={{ color: colors.light.foreground }} className="text-center">
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
    // Split the text into sections based on headings
    const sections = minutesText.split(/\n(?=[A-Z][a-z]+ [A-Z][a-z]+:)/);
    
    // Extract sections by title
    let meetingSummary = null;
    let meetingMinutes = null;
    let otherSections: React.ReactNode[] = [];
    
    // First pass: identify each section
    sections.forEach((section, index) => {
      // Skip empty sections
      if (!section.trim()) return;
      
      // Extract the section title and content
      const titleMatch = section.match(/^([A-Z][a-z]+ [A-Z][a-z]+):/);
      if (!titleMatch) return;
      
      const title = titleMatch[1];
      const content = section.replace(/^[A-Z][a-z]+ [A-Z][a-z]+:/, '').trim();
      
      // Skip the action items section as we're displaying it separately
      if (title === "Main Action Items") {
        return;
      }
      
      // Format bullet points
      const bulletPoints = content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const formattedSection = (
        <View key={index} className="mb-6">
          <Text 
            style={{ color: colors.light.foreground }}
            className="text-lg font-semibold mb-2"
          >
            {title}
          </Text>
          <View className="pl-0">
            {bulletPoints.map((point, i) => (
              <View key={i} className="flex-row mb-1 pl-0">
                <Text style={{ color: colors.light.foreground, marginLeft: 0, marginRight: 8 }}>•</Text>
                <Text 
                  style={{ color: colors.light.foreground }}
                  className="flex-1"
                >
                  {point.replace(/^[•\-]\s*/, '')}
                </Text>
              </View>
            ))}
          </View>
        </View>
      );
      
      // Categorize sections
      if (title === "Meeting Summary") {
        meetingSummary = formattedSection;
      } else if (title === "Meeting Minutes") {
        meetingMinutes = formattedSection;
      } else {
        otherSections.push(formattedSection);
      }
    });
    
    // Now return sections in the desired order
    return (
      <>
        {/* 1. Meeting Summary */}
        {meetingSummary}
        
        {/* 2. Action Items */}
        <View className="mb-6">
          <Text 
            style={{ color: colors.light.foreground }}
            className="text-lg font-semibold mb-2"
          >
            Action Items
          </Text>
          <View className="pl-0 ml-0">
            <ActionItemsList meetingId={meeting!.id} actionItems={actionItems} />
          </View>
        </View>
        
        {/* 3. Meeting Minutes */}
        {meetingMinutes}
        
        {/* 4. Any other sections */}
        {otherSections}
      </>
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

  return (
    <View style={{ backgroundColor: colors.light.background }} className="flex-1">
      {/* Header with Gradient Background */}
      <LinearGradient
        colors={['#A2C3F7', '#D94DD6', '#FBC1A9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 6,
          paddingTop: 57,
          paddingBottom: 20,
          marginBottom: 16,
          position: 'relative' // Add relative positioning for absolute children
        }}
      >
        {/* Large touch area for back button (blue area) */}
        <TouchableOpacity 
          onPress={() => router.back()}
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
          <ChevronLeft size={24} color="#ffffff" />
        </View>

        {/* Meeting Info */}
        <View className="px-4">
          {isEditingName ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={newMeetingName}
                onChangeText={setNewMeetingName}
                style={{
                  color: 'white',
                  fontSize: 30,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                  flex: 1,
                  marginBottom: 12,
                  paddingVertical: 0,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255, 255, 255, 0.3)',
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
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 8,
                }}
              >
                {isUpdatingName ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: 'white', fontSize: 16 }}>✓</Text>
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
        style={{ 
          borderBottomColor: colors.light.border,
          borderBottomWidth: 1,
          marginBottom: 16
        }}
        className="flex-row px-0"
      >
        <TabButton tab="minutes" label="Minutes" />
        <TabButton tab="transcript" label="Transcript" />
        <TabButton tab="chat" label="Chat" />
        
        {/* Refresh button */}
        <TouchableOpacity
          onPress={refreshCurrentTab}
          disabled={isRefreshing}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <RefreshCw 
            size={18} 
            color={colors.light.primary}
            style={{
              opacity: isRefreshing ? 0.5 : 1,
              ...(isRefreshing && { 
                transform: [{ rotate: '45deg' }]
              })
            }}
          />
        </TouchableOpacity>
      </View>

      {/* Content Area */}
      <View className="flex-1">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.light.primary} />
            <Text style={{ marginTop: 16, color: colors.light.mutedForeground }}>
              Loading meeting data...
            </Text>
          </View>
        ) : (
          renderContent()
        )}
      </View>

      {/* Show audio playback controls only for Minutes and Transcript tabs */}
      {(activeTab === 'minutes' || activeTab === 'transcript') && meeting?.audio_url && (
        <View 
          style={{ borderTopColor: colors.light.border }}
          className="h-20 border-t px-4"
        >
          <View className="flex-row items-center justify-between py-4">
            {audioReady ? (
              <>
                <Text style={{ color: colors.light.mutedForeground }}>
                  {formatTime(position)} / {formatTime(duration)}
                </Text>
                <Button
                  onPress={handlePlayPause}
                  disabled={isAudioLoading}
                  className="bg-purple-500 w-12 h-12 rounded-full items-center justify-center"
                  style={{ overflow: 'hidden' }}
                >
                  <View style={{ 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    position: 'relative'
                  }}>
                    {isAudioLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : isPlaying ? (
                      <Pause size={24} color="white" style={{ position: 'absolute' }} />
                    ) : (
                      <Play size={24} color="white" style={{ position: 'absolute', marginLeft: 2 }} />
                    )}
                  </View>
                </Button>
              </>
            ) : (
              <>
                <View>
                  {audioError ? (
                    <Text style={{ color: colors.light.destructive, fontSize: 12 }}>
                      Error: {audioError.includes('AVFoundationErrorDomain') ? 'Audio not ready' : audioError}
                    </Text>
                  ) : (
                    <Text style={{ color: colors.light.mutedForeground }}>
                      Audio player not loaded
                    </Text>
                  )}
                </View>
                <Button
                  onPress={() => loadAudio(meeting.audio_url || '')}
                  disabled={isAudioLoading}
                  className="bg-purple-500 px-4 h-10 rounded-full items-center justify-center"
                  style={{ overflow: 'hidden' }}
                >
                  <View style={{ 
                    flexDirection: 'row',
                    alignItems: 'center', 
                    justifyContent: 'center',
                  }}>
                    {isAudioLoading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <RefreshCw size={16} color="white" style={{ marginRight: 6 }} />
                        <Text style={{ color: 'white', fontWeight: '500' }}>Load Audio</Text>
                      </>
                    )}
                  </View>
                </Button>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
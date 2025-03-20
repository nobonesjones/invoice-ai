import { View, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Play, Pause } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/config/supabase';
import { Audio, AVPlaybackStatus } from 'expo-av';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

interface Meeting {
  id: string;
  name: string;
  duration: number;
  created_at: string;
  transcript_json?: any;
  minutes_json?: any;
  minutes_text?: string;
  audio_url?: string;
}

type TabType = 'minutes' | 'transcript' | 'chat';

export default function MeetingView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('minutes');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [transcripts, setTranscripts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetchMeeting();
    fetchTranscripts();
    return () => {
      // Cleanup sound when component unmounts
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [id]);

  const fetchMeeting = async () => {
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setMeeting(data);
        // Load audio but don't play automatically
        if (data.audio_url) {
          loadAudio(data.audio_url);
        }
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select('content')
        .eq('meeting_id', id)
        .order('timestamp', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Combine all transcripts
        const combinedTranscript = data.map(t => t.content).join('\n');
        setTranscripts([combinedTranscript]);
      }
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    }
  };

  const loadAudio = async (url: string) => {
    try {
      console.log('Loading audio from URL:', url);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      setSound(newSound);
      
      // Get initial status to set duration
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        setDuration(status.durationMillis || 0);
      }
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setIsPlaying(status.isPlaying);
      if (!duration && status.durationMillis) {
        setDuration(status.durationMillis);
      }
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
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} minutes, ${remainingSeconds} seconds`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const TabButton = ({ tab, label }: { tab: TabType; label: string }) => (
    <TouchableOpacity
      onPress={() => setActiveTab(tab)}
      className={`flex-1 py-3 ${activeTab === tab ? 'border-b-2 border-purple-500' : ''}`}
    >
      <Text
        className={`text-center ${
          activeTab === tab ? 'text-purple-500 font-semibold' : 'text-gray-400'
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (isLoading || !meeting) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400">Loading...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'minutes':
        return (
          <ScrollView className="flex-1 px-4">
            {meeting.minutes_text ? (
              <>
                {meeting.minutes_text.split('\n\n').map((section, index) => {
                  if (section.startsWith('Meeting Summary:') || 
                      section.startsWith('Main Action Items:') || 
                      section.startsWith('Meeting Minutes:')) {
                    const [header, ...content] = section.split('\n');
                    return (
                      <View key={index} className="mb-4">
                        <Text className="text-gray-300 font-bold text-lg mb-2">
                          {header}
                        </Text>
                        <Text className="text-gray-300 leading-6 font-normal">
                          {content.join('\n').trim()}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })}
              </>
            ) : (
              <Text className="text-gray-300 leading-6">
                Minutes are being generated...
              </Text>
            )}
          </ScrollView>
        );
      case 'transcript':
        return (
          <ScrollView className="flex-1 px-4">
            <Text className="text-gray-300 leading-6">
              {transcripts.length > 0 ? transcripts[0] : 'No transcript available yet.'}
            </Text>
          </ScrollView>
        );
      case 'chat':
        return (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400">Chat feature coming soon</Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View className="flex-1 bg-black">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-16 pb-4">
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Meeting Info Card */}
      <LinearGradient
        colors={['#4c1d95', '#2563eb']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="mx-4 rounded-lg p-4 mb-6"
      >
        <Text className="text-white text-xl font-semibold mb-2">
          {meeting?.name || 'Loading...'}
        </Text>
        <Text className="text-gray-200 mb-1">
          {meeting ? formatDate(meeting.created_at) : 'Loading...'}
        </Text>
        <Text className="text-gray-200">
          {meeting ? formatDuration(meeting.duration) : 'Loading...'}
        </Text>
        <Text className="text-gray-200 mt-1 text-xs">
          Meeting ID: {meeting?.id || 'Loading...'}
        </Text>
      </LinearGradient>

      {/* Tabs */}
      <View className="flex-row border-b border-gray-800 px-4 mb-4">
        <TabButton tab="minutes" label="Minutes" />
        <TabButton tab="transcript" label="Transcript" />
        <TabButton tab="chat" label="Chat" />
      </View>

      {/* Content Area */}
      <View className="flex-1">
        {renderContent()}
      </View>

      {/* Audio Playback Controls */}
      {meeting?.audio_url && (
        <View className="h-20 border-t border-gray-800 px-4">
          <View className="flex-row items-center justify-between py-4">
            <Text className="text-gray-400">
              {formatTime(position)} / {formatTime(duration)}
            </Text>
            <Button
              onPress={handlePlayPause}
              className="bg-purple-500 w-12 h-12 rounded-full items-center justify-center"
            >
              {isPlaying ? (
                <Pause size={24} color="white" />
              ) : (
                <Play size={24} color="white" />
              )}
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
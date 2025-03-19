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
  audio_url?: string;
}

type TabType = 'minutes' | 'transcript' | 'chat';

export default function MeetingView() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('minutes');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    fetchMeeting();
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
      setMeeting(data);
      
      // Load audio if available
      if (data.audio_url) {
        loadAudio(data.audio_url);
      }
    } catch (error) {
      console.error('Error fetching meeting:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const playRecording = async (url: string) => {
    try {
      console.log('Playing recording from URL:', url);
      
      // Create the sound object with proper headers
      const { sound: newSound } = await Audio.Sound.createAsync(
        { 
          uri: url,
          headers: {
            'Accept': 'audio/m4a',
            'Content-Type': 'audio/m4a'
          }
        },
        { 
          shouldPlay: true,
          progressUpdateIntervalMillis: 1000
        },
        onPlaybackStatusUpdate
      );

      setSound(newSound);
    } catch (error) {
      console.error('Error playing recording:', error);
    }
  };

  const loadAudio = async (audioUrl: string) => {
    try {
      await playRecording(audioUrl);
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    setPlaybackPosition(status.positionMillis);
    setDuration(status.durationMillis || 0);
    setIsPlaying(status.isPlaying);
    if (status.didJustFinish) {
      setIsPlaying(false);
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
            <Text className="text-gray-300 leading-6">
              {meeting.minutes_json?.content || 'No minutes available yet.'}
            </Text>
          </ScrollView>
        );
      case 'transcript':
        return (
          <ScrollView className="flex-1 px-4">
            <Text className="text-gray-300 leading-6">
              {meeting.transcript_json?.content || 'No transcript available yet.'}
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
              {formatTime(playbackPosition)} / {formatTime(duration)}
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
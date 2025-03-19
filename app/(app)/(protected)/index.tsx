import { View, Text, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import { useEffect, useState, useRef } from 'react';
import { Meeting } from '@/types/meetings';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/colors';

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import MeetingObjectivesModal from "./meeting-objectives-modal";
import { Swipeable } from 'react-native-gesture-handler';

export default function Home() {
  const router = useRouter();
  const { user } = useSupabase();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meetings')
        .select('id, name, duration, created_at, updated_at, status, user_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      console.log('Fetched meetings:', data);
      setMeetings(data || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      console.log('Starting soft delete process for meeting:', meetingId);

      // Update the meeting to mark as deleted
      const { error: updateError } = await supabase
        .from('meetings')
        .update({ 
          is_deleted: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (updateError) {
        console.error('Error updating meeting:', updateError);
        Alert.alert('Error', 'Failed to delete meeting');
        return;
      }

      console.log('Meeting marked as deleted successfully');

      // Update local state
      setMeetings(meetings.filter(m => m.id !== meetingId));
      console.log('Local state updated');

    } catch (error) {
      console.error('Error in handleDeleteMeeting:', error);
      Alert.alert('Error', 'An unexpected error occurred while deleting the meeting');
    }
  };

  const handleRenameMeeting = async (meetingId: string, newName: string) => {
    try {
      if (!newName || !newName.trim()) {
        Alert.alert('Error', 'Meeting name cannot be empty');
        return;
      }

      const { error } = await supabase
        .from('meetings')
        .update({ 
          name: newName,
          updated_at: new Date().toISOString()
        })
        .eq('id', meetingId);

      if (error) {
        throw error;
      }

      // Update local state
      setMeetings(meetings.map(m => 
        m.id === meetingId ? { ...m, name: newName } : m
      ));

    } catch (error) {
      console.error('Error renaming meeting:', error);
      Alert.alert('Error', 'Failed to rename meeting');
    }
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.ceil(duration % 60);
    if (minutes === 0) {
      return `${seconds} seconds`;
    }
    return `${minutes} min, ${seconds} seconds`;
  };

  const renderRightActions = (meetingId: string) => {
    return (
      <View className="flex-row">
        <TouchableOpacity
          onPress={() => {
            const meeting = meetings.find(m => m.id === meetingId);
            Alert.prompt(
              'Rename Meeting',
              'Enter new name:',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Save',
                  onPress: async (text) => {
                    if (text) {
                      await handleRenameMeeting(meetingId, text);
                      swipeableRefs.current[meetingId]?.close();
                    }
                  }
                }
              ],
              'plain-text',
              meeting?.name || ''
            );
          }}
          className="bg-blue-500 w-20 h-full justify-center items-center"
        >
          <MaterialIcons name="edit" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Delete Meeting',
              'Are you sure you want to delete this meeting?',
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Delete', 
                  onPress: () => handleDeleteMeeting(meetingId),
                  style: 'destructive'
                }
              ]
            );
          }}
          className="bg-red-500 w-20 h-full justify-center items-center"
        >
          <MaterialIcons name="delete" size={24} color="white" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderMeetingCard = (meeting: Meeting) => (
    <Swipeable
      ref={ref => swipeableRefs.current[meeting.id] = ref}
      key={meeting.id}
      renderRightActions={() => renderRightActions(meeting.id)}
      overshootRight={false}
    >
      <TouchableOpacity
        onPress={() => router.push(`/meeting/${meeting.id}`)}
        className="bg-card rounded-lg p-3 mb-[0.5]"
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-primary/20 mr-4 items-center justify-center">
            <Text className="text-3xl">📝</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-semibold text-white">{meeting.name}</Text>
            <Text className="text-sm text-muted-foreground">
              {new Date(meeting.created_at).toLocaleDateString()}
            </Text>
            <Text className="text-sm text-muted-foreground">
              {meeting.duration ? formatDuration(meeting.duration) : 'No recording'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );

  const handleStartMeeting = () => {
    setIsModalVisible(true);
  };

  const handleModalClose = () => {
    setIsModalVisible(false);
  };

  const handleObjectivesConfirm = (objectives: string) => {
    console.log('Meeting objectives:', objectives);
    setIsModalVisible(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between py-4">
          <Image
            source={require("@/assets/summiticon.png")}
            className="w-12 h-12 rounded-xl"
          />
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => router.push("/test-recording")}
              className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center mr-2"
            >
              <Text className="text-xl">🎙️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              className="w-10 h-10 rounded-full bg-primary/20 items-center justify-center"
            >
              <Text className="text-xl">👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome Section */}
        <View className="mb-8">
          <H1>Welcome Back{user?.email ? `, ${user.email.split('@')[0]}` : ''}</H1>
        </View>

        {/* Meetings Section */}
        <View className="mb-4">
          <H2>My Meetings</H2>
        </View>

        {/* Meetings List */}
        {isLoading ? (
          <View className="mt-8" />
        ) : meetings.length > 0 ? (
          <View>
            {meetings.map(renderMeetingCard)}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-muted-foreground text-center mb-2">
              No meetings yet
            </Text>
            <Muted className="text-center">
              Start recording your first meeting
            </Muted>
          </View>
        )}
      </View>

      {/* Start Button */}
      <View className="p-4">
        <Button
          className="w-full bg-gradient-to-r from-purple-500 to-blue-500"
          onPress={handleStartMeeting}
        >
          <Text className="text-black font-semibold">Start</Text>
        </Button>
      </View>

      <MeetingObjectivesModal
        isVisible={isModalVisible}
        onClose={handleModalClose}
        onConfirm={handleObjectivesConfirm}
      />
    </SafeAreaView>
  );
}
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import { useEffect, useState } from 'react';
import { Meeting } from '@/types/meetings';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/colors';

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import MeetingObjectivesModal from "./meeting-objectives-modal";

export default function Home() {
  const router = useRouter();
  const { user } = useSupabase();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meetings')
        .select('id, name, duration, created_at, updated_at, status, user_id')
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
      console.log('Starting deletion process for meeting:', meetingId);

      // First check if meeting exists
      const { data: meeting, error: fetchError } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', meetingId)
        .single();

      if (fetchError) {
        console.error('Error fetching meeting:', fetchError);
        Alert.alert('Error', 'Could not find meeting to delete');
        return;
      }

      console.log('Found meeting to delete:', meeting);

      // Delete objectives
      console.log('Deleting meeting objectives...');
      const { error: objectivesError, data: deletedObjectives } = await supabase
        .from('objectives')
        .delete()
        .eq('meeting_id', meetingId)
        .select();

      if (objectivesError) {
        console.error('Error deleting objectives:', objectivesError);
        Alert.alert('Error', 'Failed to delete meeting objectives');
        return;
      }
      console.log('Objectives deleted:', deletedObjectives?.length || 0, 'objectives removed');

      // Delete the meeting
      console.log('Deleting meeting record...');
      const { error: meetingError, data: deletedMeeting } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId)
        .select();

      if (meetingError) {
        console.error('Error deleting meeting:', meetingError);
        Alert.alert('Error', 'Failed to delete meeting');
        return;
      }

      console.log('Meeting deleted successfully:', deletedMeeting);

      // Update local state
      setMeetings(meetings.filter(m => m.id !== meetingId));
      console.log('Local state updated');

    } catch (error) {
      console.error('Error in handleDeleteMeeting:', error);
      Alert.alert('Error', 'An unexpected error occurred while deleting the meeting');
    }
  };

  const renderRightActions = (meetingId: string) => {
    return (
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
    );
  };

  const renderMeetingCard = (meeting: Meeting) => (
    <TouchableOpacity
      key={meeting.id}
      onPress={() => router.push(`/meeting/${meeting.id}`)}
      className="bg-card rounded-lg p-4 mb-4"
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-primary/20 mr-4 items-center justify-center">
          <Text className="text-2xl">📝</Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold">{meeting.name}</Text>
          <Text className="text-muted-foreground">
            {new Date(meeting.created_at).toLocaleDateString()}
          </Text>
          <Text className="text-muted-foreground">
            Duration: {meeting.duration ? `${Math.floor(meeting.duration / 60)} minutes` : 'N/A'}
          </Text>
          <Text className="text-muted-foreground text-xs mt-1">ID: {meeting.id}</Text>
        </View>
      </View>
    </TouchableOpacity>
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
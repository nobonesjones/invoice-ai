import { View, Text, TouchableOpacity, Alert, TextInput, ScrollView } from 'react-native';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Meeting } from '@/types/meetings';
import { Button } from '@/components/ui/button';
import { colors } from '@/constants/colors';
import { useTheme } from "@/context/theme-provider";

import { Image } from "@/components/image";
import { SafeAreaView } from "@/components/safe-area-view";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { Swipeable } from 'react-native-gesture-handler';

export default function Home() {
  const router = useRouter();
  const { user } = useSupabase();
  const { theme, isLightMode } = useTheme();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  
  // Move state from renderRightActions to component level
  const [isRenaming, setIsRenaming] = useState(false);
  const [renamingMeetingId, setRenamingMeetingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('meetings')
        .select('id, name, duration, created_at, updated_at, status, user_id, audio_url')
        .eq('is_deleted', false)
        .not('audio_url', 'is', null)  // Only get meetings with recordings
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

  // Fetch meetings when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, fetching meetings...');
      fetchMeetings();
      
      // Reset any ongoing rename operations when screen is focused
      setIsRenaming(false);
      setRenamingMeetingId(null);
      setNewName('');
      
      // Return a cleanup function that runs when the screen loses focus
      return () => {
        // Reset renaming state when navigating away from the screen
        setIsRenaming(false);
        setRenamingMeetingId(null);
        setNewName('');
      };
    }, [])
  );

  useEffect(() => {
    if (user) {
      fetchUserName();
    }
  }, [user]);

  const fetchUserName = async () => {
    if (!user) return;
    
    // Get display name from user metadata
    const displayName = user.user_metadata?.display_name;
    if (displayName) {
      setUserName(displayName);
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

  // Memoize the renderRightActions function to prevent recreation on each render
  const renderRightActions = useCallback((meetingId: string) => {
    const handleActionPress = (text: string) => {
      if (text === 'Delete') {
        handleDeletePress();
      } else if (text === 'Rename') {
        handleRenamePress();
      }

      function handleRenamePress() {
        // Find the meeting to get its current name
        const meeting = meetings.find(m => m.id === meetingId);
        if (meeting) {
          setNewName(meeting.name);
          setIsRenaming(true);
          setRenamingMeetingId(meetingId);
        }
      }

      function handleDeletePress() {
        Alert.alert(
          'Delete Meeting',
          'Are you sure you want to delete this meeting?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                if (swipeableRefs.current[meetingId]) {
                  swipeableRefs.current[meetingId]?.close();
                }
              }
            },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                handleDeleteMeeting(meetingId);
                if (swipeableRefs.current[meetingId]) {
                  swipeableRefs.current[meetingId]?.close();
                }
              }
            }
          ]
        );
      }
    };

    if (isRenaming && renamingMeetingId === meetingId) {
      return (
        <View style={{ backgroundColor: theme.background, width: 250 }} className="flex-row items-center p-2">
          <TextInput
            style={{ 
              flex: 1, 
              borderWidth: 1, 
              borderColor: theme.border,
              borderRadius: 4,
              padding: 8,
              marginRight: 8,
              color: theme.foreground,
              backgroundColor: theme.card
            }}
            value={newName}
            onChangeText={setNewName}
          />
          <TouchableOpacity
            style={{ backgroundColor: theme.primary, padding: 8, borderRadius: 4 }}
            onPress={() => {
              handleRenameMeeting(meetingId, newName);
              setIsRenaming(false);
              setRenamingMeetingId(null);
              if (swipeableRefs.current[meetingId]) {
                swipeableRefs.current[meetingId]?.close();
              }
            }}
          >
            <Text style={{ color: theme.primaryForeground }}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ 
              backgroundColor: theme.muted, 
              padding: 8, 
              borderRadius: 4,
              marginLeft: 4
            }}
            onPress={() => {
              setIsRenaming(false);
              setRenamingMeetingId(null);
              if (swipeableRefs.current[meetingId]) {
                swipeableRefs.current[meetingId]?.close();
              }
            }}
          >
            <Text style={{ color: theme.mutedForeground }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ 
        flexDirection: 'row', 
        height: '100%',
        overflow: 'hidden',
        borderTopRightRadius: 12,
        borderBottomRightRadius: 12,
      }}>
        {['Rename', 'Delete'].map((text, index) => (
          <TouchableOpacity
            key={text}
            style={{
              backgroundColor: text === 'Delete' ? '#FF4136' : theme.primary,
              justifyContent: 'center',
              alignItems: 'center',
              width: 80,
              height: '100%',
              borderTopRightRadius: index === 1 ? 12 : 0,
              borderBottomRightRadius: index === 1 ? 12 : 0,
            }}
            onPress={() => handleActionPress(text)}
          >
            <Text style={{ 
              color: 'white',
              fontWeight: '600',
              fontSize: 14
            }}>{text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [theme, meetings, isRenaming, renamingMeetingId, newName, handleDeleteMeeting, handleRenameMeeting]);

  // Memoize the renderMeetingCard function to prevent recreation on each render
  const renderMeetingCard = useCallback((meeting: Meeting) => {
    return (
      <Swipeable
        key={meeting.id}
        ref={(ref) => {
          if (ref) {
            swipeableRefs.current[meeting.id] = ref;
          }
        }}
        renderRightActions={() => renderRightActions(meeting.id)}
        onSwipeableOpen={() => {
          // Close any other open swipeables
          Object.keys(swipeableRefs.current).forEach((key) => {
            if (key !== meeting.id && swipeableRefs.current[key]) {
              swipeableRefs.current[key]?.close();
            }
          });
        }}
        onSwipeableClose={() => {
          // Reset renaming state if this meeting was being renamed
          if (isRenaming && renamingMeetingId === meeting.id) {
            setIsRenaming(false);
            setRenamingMeetingId(null);
            setNewName('');
          }
        }}
        onSwipeableWillClose={() => {
          // Also reset on will close to catch all scenarios
          if (isRenaming && renamingMeetingId === meeting.id) {
            setIsRenaming(false);
            setRenamingMeetingId(null);
            setNewName('');
          }
        }}
        containerStyle={{
          marginBottom: 15,
          paddingHorizontal: 2,
          paddingVertical: 2
        }}
        childrenContainerStyle={{
          borderRadius: 12,
          overflow: 'hidden'
        }}
      >
        <TouchableOpacity
          onPress={() => router.push(`/meeting/${meeting.id}`)}
          style={{ 
            backgroundColor: theme.card,
            borderRadius: 12,
            // iOS shadow
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            // Android elevation
            elevation: 4,
            // Add margin to ensure shadow is visible
            margin: 2,
          }}
          className="p-4"
        >
          <View className="flex-row items-center">
            <View className="mr-3">
              <Text className="text-3xl">📝</Text>
            </View>
            <View className="flex-1">
              <Text style={{ color: theme.foreground }} className="text-lg font-semibold">
                {meeting.name}
              </Text>
              <Text style={{ color: theme.mutedForeground }} className="text-sm">
                {new Date(meeting.created_at).toLocaleDateString()}
              </Text>
              <Text style={{ color: theme.mutedForeground }} className="text-sm">
                {meeting.duration ? formatDuration(meeting.duration) : 'No recording'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }, [theme, router, renderRightActions]);

  const handleCreateMeeting = async () => {
    try {
      if (!user) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const { data: meetingData, error: meetingError } = await supabase
        .from('meetings')
        .insert([
          { 
            user_id: user.id,
            name: 'New Meeting',
            status: 'recording',
            duration: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (meetingError) {
        console.error('Meeting creation error:', meetingError);
        Alert.alert('Error', `Failed to create meeting: ${meetingError.message}`);
        return;
      }

      if (!meetingData) {
        console.error('No meeting data returned');
        Alert.alert('Error', 'Failed to create meeting: No data returned');
        return;
      }

      // Navigate to recording screen with meeting ID
      router.push({
        pathname: "/recording",
        params: { meetingId: meetingData.id }
      });
    } catch (error) {
      console.error('Error creating meeting:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: theme.background }} className="flex-1">
      <View className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between py-4">
          <Image
            source={require("@/assets/summiticon.png")}
            className="w-12 h-12 rounded-xl"
          />
          <View className="flex-row">
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              className="w-10 h-10 rounded-full bg-gray-200 items-center justify-center"
            >
              <Text className="text-xl">👤</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome Section */}
        <View className="mb-8">
          <H1 style={{ color: theme.foreground }}>Welcome Back{userName ? `, ${userName}` : ''}</H1>
        </View>

        {/* Meetings Section */}
        <View className="mb-4">
          <H2 style={{ color: theme.foreground }}>My Meetings</H2>
        </View>

        {/* Meetings List - Now Scrollable */}
        {isLoading ? (
          <View className="mt-8" />
        ) : meetings.length > 0 ? (
          <ScrollView 
            className="flex-1" 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            <View className="mt-2">
              {meetings.map(renderMeetingCard)}
            </View>
          </ScrollView>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text style={{ color: theme.mutedForeground }} className="text-center mb-2">
              No meetings yet
            </Text>
            <Muted style={{ color: theme.mutedForeground }} className="text-center">
              Start recording your first meeting
            </Muted>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
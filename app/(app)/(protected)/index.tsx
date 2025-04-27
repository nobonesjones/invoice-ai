import { View, Text, TouchableOpacity, Alert, TextInput, FlatList, Animated, ViewStyle, StyleProp, InteractionManager, Button, StyleSheet, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import Modal from 'react-native-modal';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Meeting } from '@/types/meetings';
import { colors } from '@/constants/colors';
import { useTheme } from "@/context/theme-provider";
import { CircleUserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from "@/components/image";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

export default function Home() {
  const router = useRouter();
  const { user } = useSupabase();
  const { theme, isLightMode, themePreference } = useTheme();
  const currentSchemeString = isLightMode ? 'light' : 'dark'; // Determine scheme string

  console.log(`[Home Render] isLightMode: ${isLightMode}, currentSchemeString: ${currentSchemeString}`);

  const insets = useSafeAreaInsets(); // Get safe area insets
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [renamingMeetingDetails, setRenamingMeetingDetails] = useState<{ id: string; name: string } | null>(null);

  const fetchMeetings = async () => {
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
    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMeetings();
    setIsRefreshing(false);
  }, []);

  // Fetch meetings when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, fetching meetings...');
      fetchMeetings();
      
      // Reset any ongoing rename operations when screen is focused
      setIsRenameModalVisible(false);
      setRenamingMeetingDetails(null);
      
      // Return a cleanup function that runs when the screen loses focus
      return () => {
        // Reset renaming state when navigating away from the screen
        setIsRenameModalVisible(false);
        setRenamingMeetingDetails(null);
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

  // --- Optimistic UI Rename Logic ---
 
  // 1. Function to update the database in the background
  const updateMeetingNameInDb = async (meetingId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ name: newName })
        .eq('id', meetingId);

      if (error) {
        console.error('Error updating meeting name in DB:', error);
        // Show error, but UI is already updated, so maybe just log or use a toast
        Alert.alert('Sync Error', 'Could not save the name change to the server.'); 
      }
    } catch (error) {
      console.error('Unexpected error updating meeting name in DB:', error);
      Alert.alert('Sync Error', 'An unexpected error occurred while saving.');
    }
  };

  // 2. Function passed to the modal's onSave prop
  const handleModalSave = (meetingId: string, newName: string) => {
    if (!newName || !newName.trim()) { // Basic validation
      Alert.alert('Error', 'Meeting name cannot be empty');
      return;
    }

    // Optimistic UI Update:
    setMeetings(currentMeetings => 
      currentMeetings.map(m => 
        m.id === meetingId ? { ...m, name: newName } : m
      )
    );

    // Close the modal immediately
    setIsRenameModalVisible(false);
    setRenamingMeetingDetails(null);

    // Trigger background database update (fire and forget for UI)
    updateMeetingNameInDb(meetingId, newName);
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
  const renderRightActions = useCallback((progress: any, dragX: any, meetingId: string, meetingName: string) => {
    const trans = dragX.interpolate({
      inputRange: [-160, 0], // Width of two 80px buttons
      outputRange: [0, 160],
      extrapolate: 'clamp',
    });

    // Define handlers inside useCallback to capture meetingId/name
    const handleRenamePress = () => {
      console.log(`Rename pressed for: ${meetingName} (ID: ${meetingId}) - Opening Modal`);
      setRenamingMeetingDetails({ id: meetingId, name: meetingName }); // Store details for modal
      setIsRenameModalVisible(true); // Show the modal
      swipeableRefs.current[meetingId]?.close(); // Close the swipeable row
    };

    const handleDeletePress = () => {
      swipeableRefs.current[meetingId]?.close();
      Alert.alert(
        "Confirm Delete",
        `Are you sure you want to delete "${meetingName}"?`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => console.log("Delete cancelled"),
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => handleDeleteMeeting(meetingId),
          },
        ],
        { cancelable: true }
      );
    };

    // Define button styles
    const actionButtonStyle: ViewStyle = {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      width: 80, // Fixed width for each button
      height: '100%', // Make button fill height of the container
    };

    return (
      <Animated.View
        style={{
          transform: [{ translateX: trans }],
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors[currentSchemeString].card,
          borderRadius: 10,       // Match card border radius
          overflow: 'hidden',       // Clip buttons to rounded corners
          height: '100%',
        }}
      >
        {/* Rename Button */}
        <TouchableOpacity
          onPress={handleRenamePress}
          style={{
            ...actionButtonStyle,
            backgroundColor: colors[currentSchemeString].primary, // Use theme primary color
          } as StyleProp<ViewStyle>}
        >
          <MaterialIcons name="edit" size={24} color={colors[currentSchemeString].primaryForeground} />{/* Use theme primary foreground color */}
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          onPress={handleDeletePress}
          style={{
            ...actionButtonStyle,
            backgroundColor: colors[currentSchemeString].destructive, // Use theme destructive color
          } as StyleProp<ViewStyle>}
        >
          <MaterialIcons name="delete" size={24} color={colors[currentSchemeString].destructiveForeground} /> {/* Use theme destructive foreground color */}
        </TouchableOpacity>
      </Animated.View>
    );
  }, [theme, handleDeleteMeeting]);

  const renderMeetingCard = useCallback(({ item }: { item: Meeting }) => {
    return (
      <Swipeable
        key={item.id}
        ref={(ref) => {
          if (ref) {
            swipeableRefs.current[item.id] = ref;
          }
        }}
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item.id, item.name)}
        onSwipeableOpen={() => {
          // Close any other open swipeables
          Object.keys(swipeableRefs.current).forEach((key) => {
            if (key !== item.id && swipeableRefs.current[key]) {
              swipeableRefs.current[key]?.close();
            }
          });
        }}
        containerStyle={{
          marginBottom: 5,
        }}
        childrenContainerStyle={{
          borderRadius: 10, // Match card borderRadius
          overflow: 'hidden'
        }}
      >
        <TouchableOpacity
          onPress={() => router.push(`/meeting/${item.id}`)}
          style={[
            styles.meetingCardBase, // Base styles
            { backgroundColor: colors[currentSchemeString].card } // Apply themed card background
          ]}
        >
          <View className="flex-row items-center">
            <View className="mr-3">
              <Text className="text-3xl">📝</Text>
            </View>
            <View className="flex-1">
              <Text style={{ color: colors[currentSchemeString].foreground }} className="text-lg font-semibold">
                {item.name}
              </Text>
              <Text style={{ color: colors[currentSchemeString].mutedForeground }} className="text-sm">
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
              <Text style={{ color: colors[currentSchemeString].mutedForeground }} className="text-sm">
                {item.duration ? formatDuration(item.duration) : 'No recording'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  }, [theme, router, meetings]);

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

  interface RenameModalProps {
    isVisible: boolean;
    // Theme props
    backgroundColor: string;
    textColor: string;
    mutedTextColor: string;
    borderColor: string;
    primaryColor: string;
    initialDetails: { id: string; name: string } | null;
    onClose: () => void;
    onSave: (meetingId: string, newName: string) => void;
  }

  const RenameMeetingModal: React.FC<RenameModalProps> = ({
    isVisible,
    initialDetails,
    onClose,
    onSave,
    // Destructure theme props
    backgroundColor,
    textColor,
    mutedTextColor,
    borderColor,
    primaryColor,
  }) => {
    const [internalNewName, setInternalNewName] = useState('');
    const modalInputRef = useRef<TextInput>(null); // Ref for the input inside the modal

    // Effect to update internal state when modal opens or details change
    useEffect(() => {
      if (isVisible && initialDetails) {
        setInternalNewName(initialDetails.name);
      } else {
        // Reset when modal is closed or details are null
        setInternalNewName(''); 
      }
    }, [isVisible, initialDetails]);

    const handleSavePress = () => {
      if (initialDetails && internalNewName.trim()) {
        onSave(initialDetails.id, internalNewName.trim());
        // onClose will likely be called within the onSave implementation in the parent
      } else {
        Alert.alert('Error', 'Meeting name cannot be empty.');
      }
    };

    return (
      <Modal
        animationIn="slideInUp"
        animationOut="slideOutDown"
        isVisible={isVisible}
        onBackdropPress={onClose} // Use onClose prop
        onModalShow={() => {
          // Programmatically select text after modal animation is complete
          // Small delay might sometimes be needed, but try without first
          modalInputRef.current?.setSelection(0, internalNewName.length || 0);
        }}
        style={styles.modal} // Apply styles
        avoidKeyboard // Automatically adjust position for keyboard
      >
        {/* Use passed theme props for styling */}
        <View style={[styles.modalContent, { backgroundColor: backgroundColor }]}>
          <Text style={[styles.modalTitle, { color: textColor }]}>Rename Meeting</Text>
          <TextInput
            value={internalNewName} // Use internal state
            onChangeText={setInternalNewName} // Update internal state
            placeholder="Enter new meeting name"
            placeholderTextColor={mutedTextColor}
            style={[styles.modalInput, { color: textColor, borderColor: borderColor }]}
            autoFocus // Keep autoFocus
            ref={modalInputRef} // Assign the ref
          />
          <View style={styles.modalButtons}>
            <Button
              title="Cancel"
              onPress={onClose} // Use onClose prop
              color={mutedTextColor} // Use theme prop
            />
            <Button
              title="Save"
              onPress={handleSavePress} // Use internal handler
              color={primaryColor} // Use theme prop
            />
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Use standard View and apply top inset manually */}
      <View style={{ 
        flex: 1, 
        backgroundColor: colors[currentSchemeString].background, // Apply dynamic background color
        paddingTop: insets.top // Apply top padding for status bar/notch
      }}>
        <View style={{ flex: 1, paddingHorizontal: 16 }}> {/* Restore paddingHorizontal */}
          {/* Header */}
          <View className="flex-row items-center justify-between py-4">
            <Image
              source={require("@/assets/summiticon.png")}
              className="w-12 h-12 rounded-xl"
            />
            <Pressable 
              onPress={() => router.push('/profile')} 
              style={{ marginRight: 10, marginBottom: 5 }} // Add inline style for adjustments
            >
              {({ pressed }: { pressed: boolean }) => (
                <CircleUserRound
                  size={30} // Adjust size as needed
                  color={theme.foreground}
                  style={{ opacity: pressed ? 0.7 : 1 }} // Keep opacity style here
                />
              )}
            </Pressable>
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
          {isLoading && !meetings.length ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color={colors[currentSchemeString].primary} />
            </View>
          ) : (
            <FlatList
              data={meetings}
              renderItem={renderMeetingCard}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={() => (
                <View className="flex-1 justify-center items-center mt-10 px-4">
                  <Muted>You haven't recorded any meetings yet.</Muted>
                  <Muted>Tap the record button to start.</Muted>
                </View>
              )}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={onRefresh}
                  tintColor={colors[currentSchemeString].primary} // Style refresh indicator
                />
              }
              contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 100 }} // Reduce horizontal padding
            />
          )}
        </View>
      </View>
      <RenameMeetingModal 
        isVisible={isRenameModalVisible} 
        // Pass theme colors from parent
        backgroundColor={theme.card}
        textColor={theme.foreground}
        mutedTextColor={theme.mutedForeground}
        borderColor={theme.border}
        primaryColor={theme.primary}
        // Pass other props
        initialDetails={renamingMeetingDetails} 
        onClose={() => setIsRenameModalVisible(false)} 
        onSave={handleModalSave} // Use the new optimistic handler
      />
     </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  meetingCardBase: {
    padding: 16,
    borderRadius: 10,
    marginBottom: 11, // Reduced by ~10% (from 12)
    shadowOffset: { width: 0, height: 2 }, // Slightly increased offset
    shadowRadius: 3, // Slightly increased radius
    elevation: 4, // Increased elevation for Android
    shadowColor: '#000', // Default shadow color
    shadowOpacity: 0.10, // Slightly increased opacity
  },
  modal: {
    justifyContent: 'center',
    margin: 0,
  },
  modalContent: {
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    width: '100%',
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
});
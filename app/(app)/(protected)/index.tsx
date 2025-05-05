import { View, Text, TouchableOpacity, Alert, TextInput, Animated, ViewStyle, StyleProp, InteractionManager, Button, StyleSheet, Pressable, RefreshControl, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect, Link } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '@/config/supabase';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Meeting } from '@/types/meetings';
import { colors } from '@/constants/colors';
import { useTheme } from "@/context/theme-provider";
import { CircleUserRound } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Skeleton } from 'moti/skeleton';
import { useColorScheme } from 'react-native'; 
import * as Haptics from 'expo-haptics'; // Import Haptics

import { Image } from "@/components/image";
import { H1, H2, Muted } from "@/components/ui/typography";
import { useSupabase } from "@/context/supabase-provider";
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { RenameAndEmojiModal } from '@/components/modals/RenameAndEmojiModal'; 
import { Text as CustomText } from '@/components/ui/text';

export default function Home() {
  const router = useRouter();
  const { user } = useSupabase();
  const { theme, isLightMode, themePreference } = useTheme();
  const currentSchemeString = isLightMode ? 'light' : 'dark'; 

  console.log(`[Home Render] isLightMode: ${isLightMode}, currentSchemeString: ${currentSchemeString}`);

  const insets = useSafeAreaInsets(); 
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const swipeableRefs = useRef<{ [key: string]: Swipeable | null }>({});
  const [isRenameAndEmojiModalVisible, setIsRenameAndEmojiModalVisible] = useState(false);
  const [editingMeetingDetails, setEditingMeetingDetails] = useState<{ id: string; name: string; icon: string } | null>(null);

  const fetchMeetings = async () => {
    setIsLoading(true);
    if (!user) {
      console.error("User not found, cannot fetch meetings.");
      setIsLoading(false);
      setMeetings([]);
      return;
    }

    const { data, error } = await supabase
      .from('meetings')
      .select('id, name, duration, created_at, updated_at, status, user_id, audio_url, icon')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .not('audio_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching meetings:", error);
      // Consider showing an error message to the user
      setMeetings([]); // Clear meetings on error
      // Optionally throw the error if you want to handle it higher up
      // throw error;
    } else {
      console.log('Fetched meetings for user:', user.id, data);
      setMeetings(data || []);
    }

    setIsLoading(false);
  };

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchMeetings();
    setIsRefreshing(false);
  }, [user]); // Added user to dependency array

  useFocusEffect(
    useCallback(() => {
      console.log('Home screen focused, checking user...');
      // Only fetch if user is available
      if (user) {
        console.log('User found, fetching meetings...');
        fetchMeetings();
      }
      
      return () => {
        setIsRenameAndEmojiModalVisible(false);
        setEditingMeetingDetails(null);
      };
    }, [user])
  );

  useEffect(() => {
    if (user) {
      fetchUserName();
    }
  }, [user]);

  const fetchUserName = async () => {
    if (!user) return;
    
    const displayName = user.user_metadata?.display_name;
    if (displayName) {
      setUserName(displayName);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      console.log('Starting soft delete process for meeting:', meetingId);

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

      setMeetings(meetings.filter(m => m.id !== meetingId));
      console.log('Local state updated');

    } catch (error) {
      console.error('Error in handleDeleteMeeting:', error);
      Alert.alert('Error', 'An unexpected error occurred while deleting the meeting');
    }
  };

  const updateMeetingDetailsInDb = async ({ id, name, icon }: { id: string, name: string, icon: string }) => {
    console.log('Updating meeting in DB:', { id, name, icon });
    const { error } = await supabase
      .from('meetings')
      .update({ name: name, icon: icon }) 
      .eq('id', id);

    if (error) {
      console.error('Error updating meeting details in DB:', error.message);
      throw error; 
    }
  };

  const handleModalSave = async ({ id, name, icon }: { id: string, name: string, icon: string }) => {
    console.log('Saving meeting details:', { id, name, icon });
    setMeetings((prevMeetings) =>
      prevMeetings.map((m) => (m.id === id ? { ...m, name: name.trim(), icon: icon } : m))
    );
    setIsRenameAndEmojiModalVisible(false); 
    setEditingMeetingDetails(null); 

    InteractionManager.runAfterInteractions(() => {
      updateMeetingDetailsInDb({ id, name: name.trim(), icon });
    });
  };

  const formatDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.ceil(duration % 60);
    if (minutes === 0) {
      return `${seconds} seconds`;
    }
    return `${minutes} min, ${seconds} seconds`;
  };

  const renderRightActions = useCallback((progress: any, dragX: any, meetingId: string, meetingName: string) => {
    const trans = dragX.interpolate({
      inputRange: [-160, 0], 
      outputRange: [0, 160],
      extrapolate: 'clamp',
    });

    const handleRenamePress = () => {
      console.log(`Rename pressed for: ${meetingName} (ID: ${meetingId}) - Opening Modal`);
      const currentMeeting = meetings.find(m => m.id === meetingId);
      setEditingMeetingDetails({ 
        id: meetingId, 
        name: meetingName, 
        icon: currentMeeting?.icon ?? '📝' 
      }); 
      setIsRenameAndEmojiModalVisible(true); 
      swipeableRefs.current[meetingId]?.close(); 
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

    const actionButtonStyle: ViewStyle = {
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      width: 80, 
      height: '100%', 
    };

    return (
      <Animated.View
        style={{
          transform: [{ translateX: trans }],
          flexDirection: 'row',
          alignItems: 'center', 
          backgroundColor: colors[currentSchemeString].card,
          borderRadius: 10,       
          overflow: 'hidden',       
          height: '100%', 
        }}
      >
        <TouchableOpacity
          onPress={handleRenamePress}
          style={{
            ...actionButtonStyle,
            backgroundColor: colors[currentSchemeString].primary, 
          } as StyleProp<ViewStyle>}
        >
          <MaterialIcons name="edit" size={24} color={colors[currentSchemeString].primaryForeground} /> 
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDeletePress}
          style={{
            ...actionButtonStyle,
            backgroundColor: colors[currentSchemeString].destructive, 
          } as StyleProp<ViewStyle>}
        >
          <MaterialIcons name="delete" size={24} color={colors[currentSchemeString].destructiveForeground} /> 
        </TouchableOpacity>
      </Animated.View>
    );
  }, [theme, handleDeleteMeeting]);

  const MeetingCardSkeleton: React.FC<{ style?: StyleProp<ViewStyle> }> = ({ style }) => (
    <View style={[styles.meetingCardBase, { backgroundColor: theme.card, opacity: 0.7 }, style]}>
      <View style={{ padding: 16 }}> 
        <View className="flex-row items-center">
          <View className="mr-3">
            <Skeleton colorMode={currentSchemeString} width={36} height={36} radius="round"/> 
          </View>
          <View className="flex-1">
            <Skeleton colorMode={currentSchemeString} width={'80%'} height={22} /> 
            <Skeleton colorMode={currentSchemeString} width={'50%'} height={16} /> 
            <Skeleton colorMode={currentSchemeString} width={'60%'} height={16} /> 
          </View>
        </View>
      </View>
    </View>
  );

  const renderMeetingCard = useCallback((item: Meeting) => {
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
          Object.keys(swipeableRefs.current).forEach((key) => {
            if (key !== item.id && swipeableRefs.current[key]) {
              swipeableRefs.current[key]?.close();
            }
          });
        }}
        containerStyle={{
          marginBottom: 11, 
        }}
        childrenContainerStyle={{
          borderRadius: 10, 
          overflow: 'hidden'
        }}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/meeting/${item.id}`)
          }}
          style={[
            styles.meetingCardBase, 
            { backgroundColor: colors[currentSchemeString].card } 
          ]}
        >
          <View style={{ padding: 16 }}> 
            <View className="flex-row items-center">
              <View className="mr-3">
                <Text className="text-3xl">{item.icon ?? '📝'}</Text> 
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Main screen view */}
      <View style={{ 
        flex: 1, 
        backgroundColor: colors[currentSchemeString].background, 
      }}>
        {/* Header Cloud Wrapper */}
        <View 
          style={{ 
            backgroundColor: theme.card, 
            paddingTop: insets.top, // Add safe area padding HERE for content
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            elevation: 3, // For Android
          }}
          // Reduce bottom padding further (pb-4 to pb-2)
          className="px-4 pb-2 mb-4" 
        >
          {/* Logo/Profile Row */}
          <View className="flex-row items-center justify-between">
            <Image
              source={require("@/assets/summiticon.png")}
              className="w-12 h-12 rounded-xl"
            />
            <Pressable 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Add haptic feedback
                router.push('/profile');
              }} 
              style={{ marginRight: 10, marginBottom: 5 }} 
            >
              {({ pressed }: { pressed: boolean }) => (
                <CircleUserRound
                  size={30} 
                  color={theme.foreground}
                  style={{ opacity: pressed ? 0.7 : 1 }} 
                />
              )}
            </Pressable>
          </View>

          {/* Add marginTop to push text down */}
          <View style={{ marginTop: 16 }}> 
            <H1 style={{ color: theme.foreground }}>Welcome Back{userName ? `, ${userName}` : ''}</H1>
            <H2 style={{ color: theme.foreground, marginTop: 8, borderBottomWidth: 0 }}>My Meetings</H2>
          </View>
        </View>
        {/* End Header Cloud Wrapper */}

        {/* Content Section below the cloud */}
        <View style={{ flex: 1, paddingHorizontal: 16 }}> 
          {isLoading && !isRefreshing ? ( 
            <Skeleton.Group show={true}>
              <MeetingCardSkeleton style={{ marginBottom: 11 }}/> 
              <MeetingCardSkeleton style={{ marginBottom: 11 }}/>
              <MeetingCardSkeleton style={{ marginBottom: 11 }}/>
              <MeetingCardSkeleton /> 
            </Skeleton.Group>
          ) : meetings.length === 0 ? (
            <View className="flex-1 justify-center items-center px-6">
              <CustomText style={{ color: theme.mutedForeground }} className="text-xl text-center mb-2"> 
                Ready when you are.
              </CustomText>
              <CustomText style={{ color: theme.mutedForeground }} className="text-xl text-center"> 
                Click the + button below to record your first meeting.
              </CustomText>
            </View>
          ) : (
            <ScrollView
              className="flex-1" 
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors[currentSchemeString].primary} />
              }
            >
              <View className="mt-2">
                {meetings.map((item) => renderMeetingCard(item))}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
      <RenameAndEmojiModal
        isVisible={isRenameAndEmojiModalVisible}
        onClose={() => {
          setIsRenameAndEmojiModalVisible(false);
          setEditingMeetingDetails(null); 
        }}
        onSave={handleModalSave}
        initialDetails={editingMeetingDetails}
        backgroundColor={theme.card}
        textColor={theme.foreground}
        mutedTextColor={theme.mutedForeground}
        borderColor={theme.border}
        secondaryColor={theme.secondary} 
        inputBackgroundColor={theme.input} 
        primaryColor={theme.primary} 
        primaryForeground={theme.primaryForeground} 
        card={theme.card}
        border={theme.border}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  meetingCardBase: {
    borderRadius: 10,
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 6, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.30, 
  },
  modal: {
    justifyContent: 'center',
    margin: 0,
  },
  modalContent: {
    borderRadius: 10,
    padding: 16, 
    alignItems: 'stretch', 
    marginHorizontal: 24, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 3, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.10, 
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end', 
    marginTop: 10,
  },
  inputRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  emojiButton: { 
    width: 40,
    height: 40,
    borderRadius: 20, 
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: colors['light'].secondary, 
    borderWidth: 1, 
    borderColor: colors['light'].border, 
  },
  emojiButtonDark: { 
    backgroundColor: colors['dark'].secondary,
    borderColor: colors['dark'].border,
  },
  emojiButtonText: { 
    fontSize: 24,
  },
});
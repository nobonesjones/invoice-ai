import { Tabs, Link } from "expo-router";
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CircleUserRound } from 'lucide-react-native'; // Import CircleUserRound
import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider"; // Import custom hook
import { supabase } from "@/config/supabase";
import { useSupabase } from "@/context/supabase-provider";
import { Alert } from "react-native";
import * as Haptics from 'expo-haptics'; // Import Haptics

// Function to trigger haptic feedback
const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function ProtectedLayout() {
  // Use light mode for protected screens
  const { isLightMode } = useTheme(); // Use state from our provider
  const currentSchemeString = isLightMode ? 'light' : 'dark'; // Determine scheme based on provider state
  const router = useRouter();
  const { user } = useSupabase();

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { height: 0, borderTopWidth: 0 }, // Keep default styling minimal
        tabBarActiveTintColor: colors[currentSchemeString].primary, // Use correct string key
        tabBarInactiveTintColor: colors[currentSchemeString].mutedForeground // Use correct string key
      }}
      tabBar={() => (
        <View style={{ height: 60, backgroundColor: colors[currentSchemeString].background, borderTopWidth: 1, borderTopColor: colors[currentSchemeString].border, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors[currentSchemeString].foreground }}>Temporary Tab Bar</Text>
        </View>
      )}
    >
      <Tabs.Screen 
        name="index" 
        options={{
          title: "Meetings",
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e) => {
            triggerHaptic();
          },
        }}
      />
      <Tabs.Screen 
        name="action-items" 
        options={{
          title: "Action Items",
          tabBarLabel: () => null
        }}
        listeners={{
          tabPress: (e) => {
            triggerHaptic();
          },
        }}
      />
      <Tabs.Screen 
        name="profile" 
        options={{
          title: "Profile",
          tabBarButton: () => null
        }}
      />
      <Tabs.Screen 
        name="change-password" 
        options={{
          title: "Change Password",
          tabBarButton: () => null
        }}
      />
      <Tabs.Screen 
        name="notifications" 
        options={{
          title: "Notifications",
          tabBarButton: () => null
        }}
      />
      <Tabs.Screen 
        name="recording" 
        options={{
          title: "Recording",
          tabBarButton: () => null
        }}
      />
      <Tabs.Screen 
        name="meeting/[id]" 
        options={{
          title: "Meeting Details",
          tabBarButton: () => null
        }}
      />
      <Tabs.Screen 
        name="chat" 
        options={{
          title: "Chat",
          tabBarLabel: () => null
        }}
        listeners={{
          tabPress: (e) => {
            triggerHaptic();
          },
        }}
      />
    </Tabs>
  );
}

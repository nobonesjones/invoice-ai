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
      tabBar={props => {
        // Only show the tab bar on the home screen (index)
        const currentRoute = props.state.routes[props.state.index];
        // Corrected logic: Show tab bar ONLY on 'index', 'action-items', and 'chat'
        if (!['index', 'action-items', 'chat'].includes(currentRoute.name)) {
          return null;
        }
        
        // Calculate the increased height (35% more)
        const originalHeight = 60;
        const increasedHeight = originalHeight + 20 + 1;
        
        // Get the name of the currently active route
        const activeRouteName = props.state.routes[props.state.index].name;

        return (
          <View style={{ 
            flexDirection: 'row', 
            backgroundColor: colors[currentSchemeString].background, // Changed from .secondary to .background
            height: increasedHeight, 
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.1)', // Consider adjusting border for dark mode
            paddingHorizontal: 20,
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            {/* Action Items Button */}
            <Pressable 
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center'
              }}
              onPress={() => {
                props.navigation.navigate('action-items');
                triggerHaptic();
              }}
            >
              <Text style={{ 
                // Set color based on whether 'action-items' is the active route
                color: activeRouteName === 'action-items' ? colors[currentSchemeString].primary : colors[currentSchemeString].mutedForeground, 
                fontSize: 16, 
                fontWeight: '500'
              }}>
                Action Items
              </Text>
            </Pressable>
            
            {/* Placeholder View to maintain spacing for the absolute positioned button */}
            <View style={{ width: 68 }} />
            
            {/* New Placeholder Button (Bigger, Overlapping) */}
            <Pressable 
              style={{ 
                // Re-apply absolute positioning for overlap
                position: 'absolute',
                bottom: 30, // Adjust for desired overlap
                left: '50%',
                transform: [{ translateX: -14 }], // Set value to -14 as requested
                width: 68, // Reduced size (80 * 0.85)
                height: 68, // Reduced size (80 * 0.85)
                borderRadius: 34, // Adjusted border radius (68 / 2)
                backgroundColor: colors[currentSchemeString].card, // Changed from .background to .card
                justifyContent: 'center',
                alignItems: 'center',
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
              }}
              onPress={() => {
                triggerHaptic(); // Add haptic feedback here
                handleCreateMeeting(); // Use the correct handler
              }}
            >
              {/* Placeholder Icon/Text - Replace with actual icon later */}
              <Text style={{ color: colors[currentSchemeString].secondaryForeground, fontSize: 34, fontWeight: 'bold' }}>+</Text>
            </Pressable>
            
            {/* Chat Button */}
            <Pressable 
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center'
              }}
              onPress={() => {
                props.navigation.navigate('chat');
                triggerHaptic();
              }}
            >
              <Text style={{ 
                // Set color based on whether 'chat' is the active route
                color: activeRouteName === 'chat' ? colors[currentSchemeString].primary : colors[currentSchemeString].mutedForeground, 
                fontSize: 16, 
                fontWeight: '500'
              }}>
                Chat
              </Text>
            </Pressable>

          </View>
        );
      }}
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

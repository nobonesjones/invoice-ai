import { Tabs, Link } from "expo-router";
import React from "react";
import { View, Text, Pressable, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CircleUserRound, ListChecks, MessageSquare } from 'lucide-react-native'; 
import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider"; 
import { supabase } from "@/config/supabase";
import { useSupabase } from "@/context/supabase-provider";
import * as Haptics from 'expo-haptics'; 

// Function to trigger haptic feedback
const triggerHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function ProtectedLayout() {
  // Use light mode for protected screens
  const { isLightMode } = useTheme(); 
  const theme = isLightMode ? colors.light : colors.dark; // Determine scheme based on provider state
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
        tabBarActiveTintColor: theme.primary, 
        tabBarInactiveTintColor: theme.mutedForeground, 
        // Keep tabBarStyle minimal here as we customize in tabBar prop
        tabBarStyle: { height: 0, borderTopWidth: 0 }, 
      }}
      tabBar={props => {
        // Get the name of the currently active route
        const activeRouteName = props.state.routes[props.state.index].name;

        // Only show the tab bar on the home screen (index)
        // Corrected logic: Show tab bar ONLY on 'index'
        if (!['index'].includes(activeRouteName)) {
          return null;
        }
        
        // Calculate the increased height (adjust as needed)
        const tabBarHeight = Platform.OS === 'ios' ? 90 : 70;
        
        return (
          <View style={{ 
            flexDirection: 'row', 
            backgroundColor: isLightMode ? '#FFFFFF' : theme.background, 
            height: tabBarHeight, 
            borderTopWidth: 1,
            borderTopColor: theme.border, 
            paddingHorizontal: 20,
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            {/* Action Items Button */}
            <Pressable 
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100%', 
                paddingBottom: Platform.OS === 'ios' ? 20 : 0, 
              }}
              onPress={() => {
                props.navigation.navigate('action-items');
                triggerHaptic();
              }}
            >
              <ListChecks color={isLightMode ? '#000000' : '#FFFFFF'} size={28} /> 
            </Pressable>
            
            {/* Placeholder View to maintain spacing for the absolute positioned button */}
            <View style={{ width: 68 }} />
            
            {/* Floating Action Button (+) */}
            <Pressable 
              style={{ 
                position: 'absolute',
                bottom: Platform.OS === 'ios' ? 35 : 20, 
                left: '50%',
                transform: [{ translateX: -20 }], 
                width: 68, 
                height: 68, 
                borderRadius: 34, 
                backgroundColor: theme.card, 
                justifyContent: 'center',
                alignItems: 'center',
                elevation: 4,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
              }}
              onPress={() => {
                triggerHaptic(); 
                handleCreateMeeting(); 
              }}
            >
              <Text style={{ color: theme.primary, fontSize: 34, fontWeight: 'bold' }}>+</Text> 
            </Pressable>
            
            {/* Chat Button */}
            <Pressable 
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100%', 
                paddingBottom: Platform.OS === 'ios' ? 20 : 0, 
              }}
              onPress={() => {
                props.navigation.navigate('chat');
                triggerHaptic();
              }}
            >
              <MessageSquare color={isLightMode ? '#000000' : '#FFFFFF'} size={28} />
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

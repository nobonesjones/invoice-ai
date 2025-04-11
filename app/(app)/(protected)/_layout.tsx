import { Tabs } from "expo-router";
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "@/constants/colors";
import { useColorScheme } from "@/lib/useColorScheme";
import { supabase } from "@/config/supabase";
import { useSupabase } from "@/context/supabase-provider";
import { Alert } from "react-native";

export default function ProtectedLayout() {
  // Use light mode for protected screens
  const colorScheme = "light";
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
        tabBarStyle: {
          backgroundColor: colors.light.background,
          borderTopWidth: 1,
          borderTopColor: 'rgba(0, 0, 0, 0.1)',
          height: 60,
          paddingBottom: 10
        },
        tabBarActiveTintColor: colors.light.primary,
        tabBarInactiveTintColor: colors.light.mutedForeground
      }}
      tabBar={props => {
        // Only show the tab bar on the home screen (index)
        const currentRoute = props.state.routes[props.state.index];
        if (currentRoute.name !== 'index') {
          return null;
        }
        
        // Calculate the increased height (35% more)
        const originalHeight = 60;
        const increasedHeight = Math.round(originalHeight * 1.35);
        
        return (
          <View style={{ 
            flexDirection: 'row', 
            backgroundColor: colors.light.background,
            height: increasedHeight, // Increased height
            borderTopWidth: 1,
            borderTopColor: 'rgba(0, 0, 0, 0.1)',
            paddingHorizontal: 20,
            paddingBottom: 15 // Added padding to account for increased height
          }}>
            {/* Action Items Button */}
            <TouchableOpacity 
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                paddingBottom: 10 // Adjust position within taller bar
              }}
              onPress={() => props.navigation.navigate('action-items')}
            >
              <Text style={{ 
                color: props.state.index === 0 ? colors.light.primary : colors.light.mutedForeground,
                fontWeight: '500'
              }}>
                Action Items
              </Text>
            </TouchableOpacity>
            
            {/* Add Button */}
            <TouchableOpacity 
              style={{ 
                width: 60,
                height: 60,
                borderRadius: 30,
                justifyContent: 'center',
                alignItems: 'center',
                bottom: Math.round(15 * 1.35), // Increased bottom offset
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 5,
                overflow: 'hidden' // Ensure gradient stays within rounded borders
              }}
              onPress={handleCreateMeeting}
            >
              <LinearGradient
                colors={['#A2C3F7', '#D94DD6', '#FBC1A9']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
              />
              <Text style={{ 
                color: 'white', 
                fontSize: 30, 
                fontWeight: 'bold',
                marginTop: -3,
                textShadowColor: 'rgba(0, 0, 0, 0.2)',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2
              }}>+</Text>
            </TouchableOpacity>
            
            {/* Chat Button */}
            <TouchableOpacity 
              style={{ 
                flex: 1, 
                justifyContent: 'center', 
                alignItems: 'center',
                paddingBottom: 10 // Adjust position within taller bar
              }}
              onPress={() => props.navigation.navigate('chat')}
            >
              <Text style={{ 
                color: props.state.index === 6 ? colors.light.primary : colors.light.mutedForeground,
                fontWeight: '500'
              }}>
                Chat
              </Text>
            </TouchableOpacity>
          </View>
        );
      }}
    >
      <Tabs.Screen 
        name="index" 
        options={{
          title: "Meetings",
          tabBarLabel: () => null
        }}
      />
      <Tabs.Screen 
        name="action-items" 
        options={{
          title: "Action Items",
          tabBarLabel: () => null
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
      />
    </Tabs>
  );
}

import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Text } from '@/components/ui/text'; // Assuming you have this for consistent text styling

export default function BusinessInformationScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useFocusEffect(
    React.useCallback(() => {
      setIsTabBarVisible(false); // Hide tab bar when this screen is focused
      return () => {
        // Optional: If navigating away to another screen that should show the tab bar,
        // this might be needed. But for back navigation to settings, settings will handle it.
        // setIsTabBarVisible(true);
      };
    }, [setIsTabBarVisible])
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Business Information',
          headerShown: true,
          animation: 'slide_from_right',
          headerStyle: {
            backgroundColor: isLightMode ? theme.background : theme.card,
          },
          headerTintColor: theme.foreground,
          headerTitleStyle: {
            fontFamily: 'Roboto-Medium',
          },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0 }}>
              <ChevronLeft size={24} color={theme.foreground} />
            </TouchableOpacity>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Business Information Screen</Text>
        {/* Content will go here */}
      </View>
    </>
  );
}

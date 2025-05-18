import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Text } from '@/components/ui/text';

export default function AppLanguageScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useFocusEffect(
    React.useCallback(() => {
      setIsTabBarVisible(false);
      return () => {};
    }, [setIsTabBarVisible])
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'App Language',
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
        <Text>App Language Screen</Text>
        {/* Content will go here */}
      </View>
    </>
  );
}

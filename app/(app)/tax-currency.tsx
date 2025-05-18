import React from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Text } from '@/components/ui/text';

export default function TaxCurrencyScreen() {
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
          title: 'Tax & Currency',
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
        <Text>Tax & Currency Screen</Text>
        {/* Content will go here */}
      </View>
    </>
  );
}

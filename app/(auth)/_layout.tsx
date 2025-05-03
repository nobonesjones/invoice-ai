import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Hide the header for all screens in this stack
      }}
      initialRouteName="onboarding-1" // Start with the first onboarding screen
    >
      <Stack.Screen name="onboarding-1" />
      <Stack.Screen name="onboarding-2" />
    </Stack>
  );
}

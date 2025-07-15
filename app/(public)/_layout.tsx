import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen 
        name="shared/invoice/[token]" 
        options={{
          title: 'Shared Invoice',
          headerShown: false,
        }}
      />
    </Stack>
  );
} 
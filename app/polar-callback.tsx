import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';

/**
 * Deep link handler for Polar OAuth callback.
 * URL: superinvoice://polar-callback?success=true or superinvoice://polar-callback?error=...
 *
 * This screen briefly shows a loading state, then navigates to payment-options.
 */
export default function PolarCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string; error?: string }>();

  useEffect(() => {
    // Small delay to ensure navigation stack is ready
    const timer = setTimeout(() => {
      if (params.error) {
        // Navigate to payment-options with error state
        router.replace({
          pathname: '/(app)/payment-options',
          params: { polarError: params.error }
        });
      } else if (params.success === 'true') {
        // Navigate to payment-options with success state
        router.replace({
          pathname: '/(app)/payment-options',
          params: { polarSuccess: 'true' }
        });
      } else {
        // No params, just go to payment-options
        router.replace('/(app)/payment-options');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [params.success, params.error]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
      <ActivityIndicator size="large" color="#fff" />
      <Text style={{ marginTop: 16, color: '#fff' }}>
        {params.error ? 'Connection failed...' : 'Connecting Polar...'}
      </Text>
    </View>
  );
}

import React, { useEffect, useCallback, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlacement } from 'expo-superwall';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import PaywallService, { PaywallService as PaywallServiceClass } from '@/services/paywallService';

export default function SoftPaywallScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSupabase();
  const [isPaywallPresented, setIsPaywallPresented] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  
  // Use the Superwall placement hook
  const { registerPlacement, state: placementState } = usePlacement({
    onError: (err) => {
      console.error('[SoftPaywall] Placement Error:', err);
      // Navigate to main app on error
      setShouldNavigate(true);
    },
    onPresent: (info) => {
      console.log('[SoftPaywall] Paywall Presented:', info);
      setIsPaywallPresented(true);
    },
    onDismiss: (info, result) => {
      console.log('[SoftPaywall] Paywall Dismissed:', info, 'Result:', result);
      // Navigate to main app regardless of purchase result (soft paywall)
      setShouldNavigate(true);
    },
  });

  const navigateToMainApp = useCallback(() => {
    // Navigate to the main protected area
    router.replace('/(app)/(protected)');
  }, [router]);

  const showOnboardingPaywall = useCallback(async () => {
    console.log('[SoftPaywall] Presenting onboarding paywall...');
    
    try {
      // Small delay to ensure smooth transition
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Register the onboarding placement
      await registerPlacement({
        placement: PaywallServiceClass.EVENTS.ONBOARDING_COMPLETE,
        params: {
          source: 'onboarding',
          userId: user?.id
        }
      });
      
      // If paywall doesn't show after 3 seconds, navigate anyway
      setTimeout(() => {
        if (!isPaywallPresented) {
          console.log('[SoftPaywall] Paywall timeout, navigating to main app');
          setShouldNavigate(true);
        }
      }, 3000);
      
    } catch (error) {
      console.error('[SoftPaywall] Failed to present paywall:', error);
      setShouldNavigate(true);
    }
  }, [registerPlacement, user?.id, isPaywallPresented]);

  useEffect(() => {
    // Show paywall immediately when screen loads
    showOnboardingPaywall();
  }, [showOnboardingPaywall]);
  
  // Handle navigation when needed
  useEffect(() => {
    if (shouldNavigate) {
      navigateToMainApp();
    }
  }, [shouldNavigate, navigateToMainApp]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>
          Loading special offers...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
});
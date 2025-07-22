import React, { useEffect, useCallback, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlacement, useSuperwall } from 'expo-superwall';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import PaywallService from '@/services/paywallService';

export default function SoftPaywallScreen() {
  console.log('[SoftPaywall] Screen component mounted');
  
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSupabase();
  const [isPaywallPresented, setIsPaywallPresented] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);
  
  // Get Superwall instance for debugging
  const superwall = useSuperwall();

  // Fallback timeout to prevent getting stuck
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      console.log('[SoftPaywall] Fallback timeout triggered - navigating to main app');
      setShouldNavigate(true);
    }, 10000); // 10 second fallback

    return () => clearTimeout(fallbackTimer);
  }, []);
  
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
      setIsPaywallPresented(false);
      
      // Navigate to main app regardless of purchase decision
      setShouldNavigate(true);
    },
  });

  // Navigate to main app when needed
  useEffect(() => {
    if (shouldNavigate) {
      const timer = setTimeout(() => {
        router.replace('/(app)/(protected)');
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [shouldNavigate, router]);

  // Present the paywall when the screen loads
  useEffect(() => {
    const presentPaywall = async () => {
      console.log('[SoftPaywall] Starting paywall presentation process...');
      console.log('[SoftPaywall] User ID:', user?.id);
      console.log('[SoftPaywall] registerPlacement available:', !!registerPlacement);
      console.log('[SoftPaywall] registerPlacement type:', typeof registerPlacement);
      
      if (!user?.id) {
        console.log('[SoftPaywall] No user ID found, navigating to main app');
        setShouldNavigate(true);
        return;
      }

      if (!registerPlacement) {
        console.log('[SoftPaywall] registerPlacement not ready, waiting...');
        // Try again in a moment
        setTimeout(presentPaywall, 500);
        return;
      }

      try {
        console.log('[SoftPaywall] Presenting onboarding paywall for user:', user.id);
        
        // Debug Superwall state before placement
        if (superwall) {
          try {
            const deviceAttributes = await superwall.getDeviceAttributes();
            console.log('[SoftPaywall] Device attributes:', deviceAttributes);
            console.log('[SoftPaywall] Subscription status:', deviceAttributes.subscriptionStatus);
            console.log('[SoftPaywall] Is sandbox:', deviceAttributes.isSandbox);
          } catch (debugError) {
            console.log('[SoftPaywall] Could not get device attributes:', debugError);
          }

          // Try to identify the user with Superwall
          try {
            console.log('[SoftPaywall] Identifying user with Superwall:', user.id);
            await superwall.identify(user.id);
            console.log('[SoftPaywall] User identified successfully');
          } catch (identifyError) {
            console.log('[SoftPaywall] Error identifying user:', identifyError);
          }
        }
        
        console.log('[SoftPaywall] Calling registerPlacement with:', {
          placement: 'onboarding_paywall',
          params: {
            source: 'post_signup',
            userId: user.id,
            timing: 'onboarding_complete'
          }
        });
        
        const result = await registerPlacement({
          placement: 'onboarding_paywall',
          params: {
            source: 'post_signup',
            userId: user.id,
            timing: 'onboarding_complete'
          }
        });
        
        console.log('[SoftPaywall] registerPlacement result:', result);
        console.log('[SoftPaywall] Placement state after call:', placementState);
        
        // If result is undefined and no callbacks fired, something's wrong
        if (result === undefined) {
          console.log('[SoftPaywall] registerPlacement returned undefined - this might indicate the placement was skipped');
          
          // Try alternative approach using campaign_trigger (which works in settings)
          try {
            console.log('[SoftPaywall] Trying with campaign_trigger placement...');
            const altResult = await registerPlacement({
              placement: 'campaign_trigger', // This works in settings
              params: {
                source: 'post_signup_fallback',
                userId: user.id,
                timing: 'onboarding_complete'
              }
            });
            console.log('[SoftPaywall] campaign_trigger result:', altResult);
          } catch (altError) {
            console.log('[SoftPaywall] campaign_trigger also failed:', altError);
          }
          
          // Also try superwall.register directly
          if (superwall) {
            try {
              console.log('[SoftPaywall] Trying direct superwall.register approach...');
              await superwall.register('onboarding_paywall', {
                source: 'post_signup',
                userId: user.id,
                timing: 'onboarding_complete'
              });
              console.log('[SoftPaywall] superwall.register called successfully');
            } catch (altError) {
              console.log('[SoftPaywall] Direct register also failed:', altError);
            }
          }
          
          // Wait a bit to see if callbacks fire, then navigate
          setTimeout(() => {
            if (!isPaywallPresented) {
              console.log('[SoftPaywall] No paywall presented after 3 seconds, navigating to main app');
              setShouldNavigate(true);
            }
          }, 3000);
        }
        
      } catch (error) {
        console.error('[SoftPaywall] Failed to present paywall:', error);
        console.error('[SoftPaywall] Error details:', JSON.stringify(error, null, 2));
        // Navigate to main app on error
        setShouldNavigate(true);
      }
    };

    // Small delay to ensure everything is loaded
    const timer = setTimeout(presentPaywall, 1000);
    
    return () => clearTimeout(timer);
  }, [user?.id, registerPlacement]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.text, { color: theme.foreground }]}>
        {isPaywallPresented ? 'Ready to upgrade?' : 'Preparing your experience...'}
      </Text>
      {!isPaywallPresented && (
        <Text style={[styles.subtext, { color: theme.mutedForeground }]}>
          Setting up your premium options
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});
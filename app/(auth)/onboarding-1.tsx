import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from 'expo-apple-authentication';
import { generateNonce, sha256Hex } from '@/utils/apple-nonce';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { SignUpModal } from "@/components/auth/sign-up-modal";
import { OnboardingInvoiceCarousel } from "@/components/OnboardingInvoiceCarousel";
import { Ionicons } from '@expo/vector-icons';
import { supabase } from "@/config/supabase";
import { OAUTH_REDIRECT } from "@/utils/oauth";
import { useOnboarding } from "@/context/onboarding-provider";
import { startAuthWatchdog } from "@/utils/auth-watchdog";
import { waitForSupabaseSession } from "@/utils/wait-for-session";
import { useAnalytics } from "@/hooks/useAnalytics";

WebBrowser.maybeCompleteAuthSession();

export default function OnboardingScreen1() {
  const router = useRouter();
  const { theme } = useTheme();
  const { saveOnboardingData } = useOnboarding();
  const analytics = useAnalytics();
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'auth' | 'signup' | 'signin'>('auth');
  const [signUpModalVisible, setSignUpModalVisible] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  // Hide status bar for immersive experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    // Track onboarding step view
    analytics.trackEvent('Onboarding Step Viewed', {
      step: 1,
      step_id: 'onboarding-1',
      step_name: 'welcome',
      group: 'onboarding'
    });
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, [analytics]);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.trackEvent('Onboarding Next', {
      from_step: 1,
      to_step: 2,
      action: 'get_started'
    });
    router.push("/(auth)/onboarding-2");
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.trackEvent('Onboarding CTA', { step: 1, action: 'open_signin' });
    setAuthModalMode('signin');
    setAuthModalVisible(true);
  };

  const handleGoogleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGoogleLoading(true);
    analytics.trackEvent('Onboarding CTA', { step: 1, action: 'continue_google' });
    
    try {
      const watchdog = startAuthWatchdog({ tag: 'google.onboarding1', router, loadingSetter: setIsGoogleLoading, timeoutMs: 10000 });
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
          redirectTo: OAUTH_REDIRECT,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error("Google Auth Error:", error.message);
        Alert.alert(
          "Authentication Error",
          error.message || "An unexpected error occurred.",
        );
        setIsGoogleLoading(false);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          OAUTH_REDIRECT,
        );
        if (result.type === 'success' && result.url) {
          const urlParts = result.url.includes('#') ? result.url.split('#') : result.url.split('?');
          const tokenString = urlParts[1] || '';
          const params = new URLSearchParams(tokenString);
          const access_token = params.get('access_token');
          const refresh_token = params.get('refresh_token');
          const code = params.get('code');
          if (access_token && refresh_token) {
            const { error: setError } = await supabase.auth.setSession({ access_token, refresh_token });
            if (setError) {
              console.error('Error setting session manually:', setError);
              Alert.alert('Session Error', 'Could not set user session.');
              return;
            }
          } else if (code) {
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession({ authCode: code });
            if (exchangeError) {
              console.error('Error exchanging code for session:', exchangeError);
              Alert.alert('Authentication Error', 'Could not complete sign-in.');
              return;
            }
          }

          const { data: sessionData } = await supabase.auth.getSession();
          const userId = sessionData?.session?.user?.id;
          if (userId) { try { await saveOnboardingData(userId); } catch {} }
          try { await waitForSupabaseSession(8000); } catch {}
          router.replace('/(app)/(protected)');
          try { watchdog.stop(); } catch {}
          return;
        }
        // Fallback: regardless of result, if session exists route immediately
        try {
          const { data: postSession } = await supabase.auth.getSession();
          const userId = postSession?.session?.user?.id;
          if (userId) {
            try { await saveOnboardingData(userId); } catch {}
            try { await waitForSupabaseSession(8000); } catch {}
            router.replace('/(app)/(protected)');
            try { watchdog.stop(); } catch {}
            return;
          }
        } catch {}
      } else {
        // No URL returned; check session in case callback already set it
        try {
          const { data: postSession } = await supabase.auth.getSession();
          const userId = postSession?.session?.user?.id;
          if (userId) {
            try { await saveOnboardingData(userId); } catch {}
            try { await waitForSupabaseSession(8000); } catch {}
            router.replace('/(app)/(protected)');
            try { watchdog.stop(); } catch {}
            return;
          }
        } catch {}
        Alert.alert('Authentication Error', 'Could not get authentication URL.');
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      Alert.alert("Error", "An unexpected error occurred.");
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleEmailAuth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.trackEvent('Onboarding CTA', { step: 1, action: 'continue_email' });
    setSignUpModalVisible(true);
  };

  const handleAppleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsAppleLoading(true);
    analytics.trackEvent('Onboarding CTA', { step: 1, action: 'continue_apple' });
    
    try {
      const rawNonce = await generateNonce(32);
      const hashedNonce = await sha256Hex(rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        // Per Apple docs, this must be the SHA-256 digest of the raw nonce
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        // (Preview-only debug removed to reduce bundle complexity)
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          // Supabase expects the original raw nonce
          nonce: rawNonce,
        });

        if (error) {
          console.error('Apple Sign In Error:', error.message);
          Alert.alert('Authentication Error', error.message);
          return;
        }

        console.log('Apple Sign In successful:', data);
        
        if (data.session?.user?.id) {
          try {
            await saveOnboardingData(data.session.user.id);
            console.log('[Onboarding] Onboarding data saved after Apple auth');
          } catch (error) {
            console.error('[Onboarding] Error saving onboarding data:', error);
          }
          
          // Check if user has completed onboarding to set correct mode
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('id', data.session.user.id)
            .maybeSingle();
          
          if (profile?.onboarding_completed) {
            // Existing user - set mode to signin
            setAuthModalMode('signin');
          }
          
          // Use the same success handler as email authentication
          handleAuthSuccess();
        }
        
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        console.log('Apple Sign In was canceled by user');
        return;
      }
      
      console.error('Apple Auth Error:', error);
      Alert.alert('Authentication Error', error.message || 'An unexpected error occurred');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    setAuthModalVisible(false);
    setSignUpModalVisible(false);
    if (authModalMode === 'signin') {
      // Existing user signing in - go directly to app
      router.replace("/(app)/(protected)");
    } else {
      // New user signing up - continue through onboarding
      console.log('[Onboarding] Navigating to onboarding-2 after email signup');
      router.push("/(auth)/onboarding-2");
    }
  };

  const styles = getStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.splitContainer}>
        {/* Top Side - Animated Invoice Carousel */}
        <View style={styles.topSide}>
          <View style={styles.carouselBackground}>
            <OnboardingInvoiceCarousel />
          </View>
        </View>

        {/* Bottom Side - Content Area */}
        <View style={styles.bottomSide}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#fefdfb' }]} />
          <View style={styles.contentArea}>
            {/* App Logo & Name */}
            <View style={styles.logoSection}>
              <Text style={[styles.appName, { color: theme.foreground }]}>SuperInvoice</Text>
              <Text style={[styles.tagline, { color: theme.mutedForeground }]}>
                The fastest way to create invoices and get paid.
              </Text>
            </View>

            {/* Spacer */}
            <View style={styles.spacer} />

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              {/* Apple Sign In */}
              <Pressable
                onPress={handleAppleAuth}
                style={[
                  styles.authButton, 
                  { 
                    backgroundColor: theme.card, 
                    borderColor: theme.border,
                    opacity: isAppleLoading ? 0.6 : 1
                  }
                ]}
                disabled={isAppleLoading}
              >
                {isAppleLoading ? (
                  <>
                    <ActivityIndicator color="#000000" />
                    <Text style={[styles.authButtonText, { color: "#000000", marginLeft: 12 }]}>Signing in...</Text>
                  </>
                ) : (
                  <>
                    <View style={styles.appleIconContainer}>
                      <Ionicons name="logo-apple" size={24} color="#000000" />
                    </View>
                    <Text style={[styles.authButtonText, { color: "#000000" }]}>Continue with Apple</Text>
                  </>
                )}
              </Pressable>

              {/* Google Sign In temporarily disabled */}

              {/* Email Sign In */}
              <Pressable
                onPress={handleEmailAuth}
                style={[styles.authButton, styles.emailButton, { backgroundColor: theme.primary }]}
              >
                <View style={styles.emailIcon}>
                  <Ionicons name="mail" size={20} color={theme.primaryForeground} />
                </View>
                <Text style={[styles.authButtonText, { color: theme.primaryForeground }]}>Continue with Email</Text>
              </Pressable>

              <Pressable onPress={handleSignIn} style={styles.secondaryButton}>
                <Text style={[styles.secondaryButtonText, { color: theme.primary }]}>
                  Already have an account?
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {/* Auth Modal */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        initialMode={authModalMode}
        plan="free"
        onSuccess={handleAuthSuccess}
        onNavigateToSignUp={() => setAuthModalVisible(false)}
      />
      
      {/* Email Sign Up Modal */}
      <SignUpModal
        visible={signUpModalVisible}
        onClose={() => setSignUpModalVisible(false)}
        onSwitchToSignIn={() => {
          setSignUpModalVisible(false);
          setAuthModalMode('signin');
          setAuthModalVisible(true);
        }}
        onSuccess={handleAuthSuccess}
        plan="free"
      />
    </View>
  );
}

const { height, width } = Dimensions.get('window');

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    height: height,
    width: width,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'column',
    height: '100%',
  },
  topSide: {
    flex: 1,
    height: '50%',
  },
  carouselBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    paddingTop: 45,
  },
  brandVisual: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomSide: {
    flex: 1,
    height: '50%',
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 15, // Moved up by 10px more (was 25)
  },
  appLogoContainer: {
    marginBottom: 16,
  },
  appLogo: {
    width: 60,
    height: 60,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  spacer: {
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 30,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    minHeight: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emailButton: {
    borderWidth: 0,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20, // Explicit line height to prevent clipping
    textAlignVertical: 'center', // Center text vertically (Android)
  },
  appleIconContainer: {
    marginRight: 10,
    position: 'relative',
    left: -3,
    top: -3,
  },
  googleIconContainer: {
    marginRight: 10,
    marginTop: 4,
    position: 'relative',
    left: -2,
    top: -2,
  },
  googleIconImage: {
    width: 20,
    height: 20,
  },
  emailIcon: {
    marginRight: 10,
    marginTop: 4,
    position: 'relative',
    left: -5,
    top: -3,
  },
});

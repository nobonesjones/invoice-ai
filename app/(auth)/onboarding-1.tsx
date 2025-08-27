import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from 'expo-apple-authentication';
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
import { useOnboarding } from "@/context/onboarding-provider";

WebBrowser.maybeCompleteAuthSession();

export default function OnboardingScreen1() {
  const router = useRouter();
  const { theme } = useTheme();
  const { saveOnboardingData } = useOnboarding();
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'auth' | 'signup' | 'signin'>('auth');
  const [signUpModalVisible, setSignUpModalVisible] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  // Hide status bar for immersive experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/onboarding-2");
  };

  const handleSignIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAuthModalMode('signin');
    setAuthModalVisible(true);
  };

  const handleGoogleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsGoogleLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          skipBrowserRedirect: true,
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
        console.log("OAuth URL from Supabase:", data.url);
        
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          "superinvoice://oauth/callback",
        );
        
        console.log("WebBrowser result:", result);
        
        if (result.type === "success" && result.url && result.url.includes("access_token")) {
          console.log("Got auth tokens from redirect URL:", result.url);
          
          const urlParts = result.url.includes('#') ? result.url.split("#") : result.url.split("?");
          const tokenString = urlParts[1] || urlParts[0];
          const params = new URLSearchParams(tokenString);
          
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const { error: setError } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (setError) {
              console.error("Error setting session manually:", setError);
              Alert.alert("Session Error", "Could not set user session.");
            } else {
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user?.id) {
                try {
                  await saveOnboardingData(sessionData.session.user.id);
                  console.log('[Onboarding] Onboarding data saved after Google auth');
                } catch (error) {
                  console.error('[Onboarding] Error saving onboarding data:', error);
                }
              }
              // Navigate to onboarding-2 to continue the signup flow
              console.log('[Onboarding] Navigating to onboarding-2 after Google signup');
              router.push("/(auth)/onboarding-2");
            }
          } else {
            Alert.alert(
              "Authentication Error",
              "Could not process authentication response.",
            );
          }
        }
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
    setSignUpModalVisible(true);
  };

  const handleAppleAuth = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsAppleLoading(true);
    
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: credential.nonce,
        });

        if (error) {
          console.error('Apple Sign In Error:', error.message);
          Alert.alert('Authentication Error', error.message);
          return;
        }

        console.log('Apple Sign In successful:', data);
        
        if (data.session) {
          router.push('/onboarding-2');
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

              {/* Google Sign In */}
              <Pressable
                onPress={handleGoogleAuth}
                style={[styles.authButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={styles.googleIconContainer}>
                  <Image 
                    source={require('@/assets/google.png')} 
                    style={styles.googleIconImage} 
                  />
                </View>
                <Text style={[styles.authButtonText, { color: theme.foreground }]}>Continue with Google</Text>
              </Pressable>

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
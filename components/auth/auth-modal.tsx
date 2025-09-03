import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from 'expo-apple-authentication';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useSupabase } from "@/context/supabase-provider";
import { useOnboarding } from "@/context/onboarding-provider";
import { supabase } from "@/config/supabase";
import { SignUpModal } from "./sign-up-modal";
import { SignInModal } from "./sign-in-modal";

WebBrowser.maybeCompleteAuthSession();

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  plan?: 'free' | 'paid';
  onSuccess?: () => void;
  initialMode?: 'auth' | 'signup' | 'signin';
  onNavigateToSignUp?: () => void;
}

export function AuthModal({ 
  visible, 
  onClose, 
  plan = 'free',
  onSuccess,
  initialMode = 'auth',
  onNavigateToSignUp
}: AuthModalProps) {
  const { theme } = useTheme();
  const { session } = useSupabase();
  const { saveOnboardingData } = useOnboarding();
  
  const [showSignUp, setShowSignUp] = useState(initialMode === 'signup');
  const [showSignIn, setShowSignIn] = useState(initialMode === 'signin');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  // Initialize video player
  const player = useVideoPlayer(require('../../assets/videos/0629.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const handleGoogleAuth = async () => {
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
        
        // Use the original approach - the token extraction should handle localhost redirects
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          "superinvoice://oauth/callback",
        );
        
        console.log("WebBrowser result:", result);
        
        // Handle the case where we get redirected to localhost with tokens
        if (result.type === "success" && result.url && result.url.includes("access_token")) {
          console.log("Got auth tokens from redirect URL:", result.url);
          
          // Extract tokens from the URL (could be after # or ?)
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
              // Get the user ID from the session and save onboarding data
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user?.id) {
                try {
                  await saveOnboardingData(sessionData.session.user.id);
                  console.log('[AuthModal] Onboarding data saved after Google auth');
                } catch (error) {
                  console.error('[AuthModal] Error saving onboarding data:', error);
                  // Don't block the flow if onboarding data save fails
                }
              }
              onSuccess?.();
            }
          } else {
            Alert.alert(
              "Authentication Error",
              "Could not process authentication response.",
            );
          }
        }
      } else {
        Alert.alert("Authentication Error", "Could not get authentication URL.");
      }
    } catch (catchError: any) {
      console.error(
        "Caught error during Google Auth:",
        JSON.stringify(catchError, null, 2),
      );
      Alert.alert(
        "Authentication Error",
        catchError.message || "An unexpected error occurred.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAppleAuth = async () => {
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
        
        // Save onboarding data for the new user
        if (data.session?.user?.id) {
          await saveOnboardingData(data.session.user.id);
        }
        
        // Call success callback to handle navigation
        onSuccess?.();
        
      } else {
        throw new Error('No identity token received from Apple');
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in request
        console.log('Apple Sign In was canceled by user');
        return;
      }
      
      console.error('Apple Auth Error:', error);
      Alert.alert('Authentication Error', error.message || 'An unexpected error occurred');
    } finally {
      setIsAppleLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleContinueWithEmail = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setShowSignIn(true);
  };

  const handleSignInPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setShowSignIn(true);
  };

  const styles = getStyles(theme);

  return (
    <>
      <Modal
        animationType="slide"
        transparent={true}
        visible={visible}
        onRequestClose={handleClose}
      >
        <View style={styles.container}>
          {/* Video Header Section */}
          <View style={styles.videoHeaderSection}>
            <VideoView
              style={styles.backgroundVideo}
              player={player}
              nativeControls={false}
              contentFit="cover"
            />
            <View style={styles.overlay}>
              
              <View style={styles.headerContent}>
                <Text style={styles.title}>
                  {initialMode === 'signin' ? 'Sign In' : 'Create Account'}
                </Text>
                <Text style={styles.subtitle}>
                  {initialMode === 'signin' 
                    ? 'Welcome back! Sign in to your account.'
                    : 'Join thousands of business owners who trust SuperInvoice.'
                  }
                </Text>
              </View>
            </View>
          </View>

          {/* Choice Section */}
          <View style={[styles.choiceSection, { backgroundColor: theme.card }]}>
            <View style={styles.choiceContent}>
              <View>
                {plan === 'paid' && (
                  <View style={[styles.planBadge, { backgroundColor: theme.primaryTransparent }]}>
                    <Ionicons name="star" size={16} color={theme.primary} />
                    <Text style={[styles.planBadgeText, { color: theme.primary }]}>PRO PLAN</Text>
                  </View>
                )}
                <Button
                  onPress={handleAppleAuth}
                  style={[styles.choiceButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  disabled={isAppleLoading}
                >
                  {isAppleLoading ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="logo-apple" size={24} color="#000000" style={styles.appleIcon} />
                      <Text style={[styles.appleButtonText, { color: "#000000" }]}>
                        Sign In With Apple
                      </Text>
                    </>
                  )}
                </Button>
                <Button
                  onPress={handleGoogleAuth}
                  style={[styles.choiceButton, { backgroundColor: theme.card, borderColor: theme.border }]}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <ActivityIndicator color={theme.foreground} />
                  ) : (
                    <>
                      <Image 
                        source={require('@/assets/google.png')} 
                        style={styles.googleIcon} 
                      />
                      <Text style={[styles.googleButtonText, { color: theme.foreground }]}>
                        Sign In With Google
                      </Text>
                    </>
                  )}
                </Button>
                <Button
                  onPress={handleContinueWithEmail}
                  style={[styles.choiceButton, styles.emailButton, { backgroundColor: theme.primary }]}                  
                >
                  <Ionicons name="mail" size={20} color={theme.primaryForeground} style={styles.emailIcon} />
                  <Text style={[styles.emailButtonText, { color: theme.primaryForeground }]}>
                    Sign In With Email
                  </Text>
                </Button>
              </View>
              <TouchableOpacity onPress={initialMode === 'signin' ? () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onClose();
              } : handleSignInPress} style={styles.signInLink}>
                <Text style={[styles.signInText, { color: theme.mutedForeground }]}>
                  {initialMode === 'signin' 
                    ? "Don't have an account? "
                    : "Already have an account? "
                  }
                  <Text style={[styles.signInHighlight, { color: theme.primary }]}>
                    {initialMode === 'signin' ? 'Sign Up' : 'Sign In'}
                  </Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Email Sign Up Modal */}
      <SignUpModal
        visible={showSignUp}
        onClose={() => setShowSignUp(false)}
        onSwitchToSignIn={() => {
          setShowSignUp(false);
          setShowSignIn(true);
        }}
        plan={plan}
        onSuccess={onSuccess}
      />

      {/* Sign In Modal */}
      <SignInModal
        visible={showSignIn}
        onClose={() => setShowSignIn(false)}
        onSwitchToSignUp={() => {
          setShowSignIn(false);
          if (onNavigateToSignUp) {
            onNavigateToSignUp();
          } else {
            setShowSignUp(true);
          }
        }}
        plan={plan}
        onSuccess={onSuccess}
      />
    </>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // New Video Header Styles
  videoHeaderSection: {
    flex: 2,  // Changed from 0.7 to 2 (2/3 of screen)
    backgroundColor: '#000',
  },
  backgroundVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 16,
    zIndex: 1,
  },
  headerContent: {
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Auth Choices Section
  choiceSection: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20, // Creates the overlap effect
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  choiceContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    justifyContent: 'flex-start',  // Changed from 'space-between' to reduce whitespace
    gap: 20,  // Add controlled gap between elements
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
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
  appleIcon: {
    marginRight: 12,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  emailIcon: {
    marginRight: 12,
  },
  choiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    transform: [{ translateY: -2 }],
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    transform: [{ translateY: -7 }],
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    transform: [{ translateY: -5 }],
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600',
    transform: [{ translateY: -5 }],
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 'auto',  // Push to bottom of the container
  },
  signInText: {
    fontSize: 15,
  },
  signInHighlight: {
    fontWeight: '600',
  },
}); 
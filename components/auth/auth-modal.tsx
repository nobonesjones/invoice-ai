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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useSupabase } from "@/context/supabase-provider";
import { useOnboarding } from "@/context/onboarding-provider";
import { supabase } from "@/config/supabase";
import { TrialService } from "@/services/trialService";
import { SignUpModal } from "./sign-up-modal";
import { SignInModal } from "./sign-in-modal";

WebBrowser.maybeCompleteAuthSession();

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  plan?: 'free' | 'paid';
  onSuccess?: () => void;
}

export function AuthModal({ 
  visible, 
  onClose, 
  plan = 'free',
  onSuccess 
}: AuthModalProps) {
  const { theme } = useTheme();
  const { session } = useSupabase();
  const { saveOnboardingData } = useOnboarding();
  
  const [showSignUp, setShowSignUp] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    
    // Set signup flag to prevent trial creation
    await TrialService.setSignupInProgress(true);
    
    try {
      const explicitRedirectTo = "expo-supabase-starter://oauth/callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: explicitRedirectTo,
        },
      });

      if (error) {
        console.error("Google Auth Error:", error.message);
        Alert.alert(
          "Authentication Error",
          error.message || "An unexpected error occurred.",
        );
        await TrialService.setSignupInProgress(false); // Clear flag on error
        setIsGoogleLoading(false);
        return;
      }

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          explicitRedirectTo,
        );
        if (result.type === "success" && result.url) {
          const params = new URLSearchParams(result.url.split("#")[1]);
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
              await TrialService.setSignupInProgress(false); // Clear flag on error
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
              await TrialService.setSignupInProgress(false); // Clear flag on success
              onSuccess?.();
            }
          } else {
            Alert.alert(
              "Authentication Error",
              "Could not process authentication response.",
            );
            await TrialService.setSignupInProgress(false); // Clear flag on error
          }
        } else {
          await TrialService.setSignupInProgress(false); // Clear flag if cancelled
        }
      } else {
        Alert.alert("Authentication Error", "Could not get authentication URL.");
        await TrialService.setSignupInProgress(false); // Clear flag on error
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
      await TrialService.setSignupInProgress(false); // Clear flag on error
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleContinueWithEmail = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    setShowSignUp(true);
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
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleClose}
      >
        <View style={[styles.container, { backgroundColor: theme.background }]}>
          {/* Animation Section - Top 70% */}
          <View style={styles.animationSection}>
            <View style={styles.gradientBackground}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#000000" />
              </TouchableOpacity>
              
              <View style={styles.animationContent}>
                <View style={styles.upperContent}>
                                  <View style={styles.logoContainer}>
                    <Image 
                      source={require('../../assets/superinvoiceicon.png')} 
                      style={styles.logoImage}
                    />
                  </View>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  {plan === 'paid' 
                    ? 'Start your Pro subscription' 
                    : 'Join thousands of business owners'}
                </Text>
                </View>
                
                <View style={styles.quoteSection}>
                                  <View style={styles.quoteContainer}>
                  <Image 
                    source={require('../../assets/onboarding/happyuser.png')} 
                    style={styles.profileImage}
                  />
                  <Text style={styles.quoteText}>
                    "AI that actually works and saves me hours of paperwork."
                  </Text>
                </View>
                </View>
              </View>
            </View>
          </View>

          {/* Choice Section - Bottom 30% */}
          <View style={[styles.choiceSection, { backgroundColor: theme.card }]}>
            <View style={styles.choiceContent}>
              {/* Plan indicator */}
              {plan === 'paid' && (
                <View style={[styles.planBadge, { backgroundColor: theme.primary }]}>
                  <Ionicons name="crown" size={16} color={theme.primaryForeground} />
                  <Text style={[styles.planBadgeText, { color: theme.primaryForeground }]}>
                    Pro Plan
                  </Text>
                </View>
              )}

              {/* Google Button */}
              <Button
                onPress={handleGoogleAuth}
                disabled={isGoogleLoading}
                style={[styles.choiceButton, { 
                  backgroundColor: theme.card, 
                  borderColor: theme.border 
                }]}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator size="small" color={theme.foreground} />
                ) : (
                  <>
                    <Image
                      source={require("@/assets/google.png")}
                      style={styles.googleIcon}
                    />
                    <Text style={[styles.choiceButtonText, { color: theme.foreground }]}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Button>

              {/* Email Button */}
              <Button
                onPress={handleContinueWithEmail}
                style={[styles.choiceButton, styles.emailButton, { 
                  backgroundColor: theme.primary 
                }]}
              >
                <Ionicons name="mail" size={20} color={theme.primaryForeground} style={styles.emailIcon} />
                <Text style={[styles.choiceButtonText, { color: theme.primaryForeground }]}>
                  Continue with Email
                </Text>
              </Button>

              {/* Sign In Link */}
              <TouchableOpacity onPress={handleSignInPress} style={styles.signInLink}>
                <Text style={[styles.signInText, { color: theme.mutedForeground }]}>
                  Already have an account?{' '}
                  <Text style={[styles.signInHighlight, { color: theme.primary }]}>
                    Sign In
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
        onClose={() => {
          setShowSignUp(false);
        }}
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
        onClose={() => {
          setShowSignIn(false);
        }}
        onSwitchToSignUp={() => {
          setShowSignIn(false);
          setShowSignUp(true);
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
  },
  animationSection: {
    height: '70%',
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginHorizontal: 16,
  },
  animationContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  upperContent: {
    alignItems: 'center',
    marginTop: 30,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  logoImage: {
    width: 65,
    height: 65,
    borderRadius: 16,
  },
  title: {
    color: '#000000',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(0, 0, 0, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  quoteSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  quoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    maxWidth: '90%',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  quoteText: {
    color: 'rgba(0, 0, 0, 0.7)',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'left',
    flex: 1,
  },
  choiceSection: {
    height: '30%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
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
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    justifyContent: 'space-between',
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
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
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
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    marginLeft: -2,
    transform: [{ translateY: 3 }],
  },
  emailIcon: {
    marginRight: 12,
    marginLeft: -2,
    transform: [{ translateY: 5 }],
  },
  choiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  signInLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 15,
  },
  signInHighlight: {
    fontWeight: '600',
  },
}); 
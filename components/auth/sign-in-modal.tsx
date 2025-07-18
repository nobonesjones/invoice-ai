import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useSupabase } from "@/context/supabase-provider";
import { useOnboarding } from "@/context/onboarding-provider";
import { supabase } from "@/config/supabase";

WebBrowser.maybeCompleteAuthSession();

const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Please enter at least 8 characters")
    .max(64, "Please enter fewer than 64 characters"),
});

interface SignInModalProps {
  visible: boolean;
  onClose: () => void;
  onSwitchToSignUp: () => void;
  plan?: 'free' | 'paid';
  onSuccess?: () => void;
}

export function SignInModal({ 
  visible, 
  onClose, 
  onSwitchToSignUp, 
  plan = 'free',
  onSuccess 
}: SignInModalProps) {
  const { theme } = useTheme();
  const { signInWithPassword } = useSupabase();
  const { saveOnboardingData } = useOnboarding();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const scrollViewRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<View>(null);
  const passwordInputRef = useRef<View>(null);

  const scrollToInput = (inputRef: React.RefObject<View>) => {
    if (inputRef.current && scrollViewRef.current) {
      inputRef.current.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, y - 50), // 50px padding from top
            animated: true,
          });
        },
        () => {} // onFail callback
      );
    }
  };

  const validateForm = () => {
    try {
      signInSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string } = {};
        error.errors.forEach((err) => {
          const path = err.path[0];
          if (path === "email" || path === "password") {
            fieldErrors[path] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSignIn = async () => {
    setGeneralError("");
    if (!validateForm()) return;

    try {
      setIsLoading(true);
      await signInWithPassword(email, password);
      
      // Get the current session to get user ID and save onboarding data
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        try {
          await saveOnboardingData(sessionData.session.user.id);
          console.log('[SignInModal] Onboarding data saved after sign in');
        } catch (error) {
          console.error('[SignInModal] Error saving onboarding data:', error);
          // Don't block the flow if onboarding data save fails
        }
      }
      
      onSuccess?.();
    } catch (error: any) {
      console.error("Error signing in:", error);
      if (error.message.includes("Invalid login")) {
        setGeneralError("Invalid email or password. Please try again.");
      } else {
        setGeneralError(error.message || "An error occurred during sign in");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    
    try {
      const explicitRedirectTo = "expo-supabase-starter://oauth/callback";
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: explicitRedirectTo,
        },
      });

      if (error) {
        console.error("Google Sign-In Error:", error.message);
        Alert.alert(
          "Sign In Error",
          error.message || "An unexpected error occurred.",
        );
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
            } else {
              // Get the user ID from the session and save onboarding data
              const { data: sessionData } = await supabase.auth.getSession();
              if (sessionData?.session?.user?.id) {
                try {
                  await saveOnboardingData(sessionData.session.user.id);
                  console.log('[SignInModal] Onboarding data saved after Google sign in');
                } catch (error) {
                  console.error('[SignInModal] Error saving onboarding data:', error);
                  // Don't block the flow if onboarding data save fails
                }
              }
              onSuccess?.();
            }
          } else {
            Alert.alert(
              "Sign In Error",
              "Could not process authentication response.",
            );
          }
        }
      } else {
        Alert.alert("Sign In Error", "Could not get authentication URL.");
      }
    } catch (catchError: any) {
      console.error(
        "Caught error during Google Sign-In:",
        JSON.stringify(catchError, null, 2),
      );
      Alert.alert(
        "Sign In Error",
        catchError.message || "An unexpected error occurred.",
      );
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmail("");
    setPassword("");
    setErrors({});
    setGeneralError("");
    onClose();
  };

  const handleSwitchToSignUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEmail("");
    setPassword("");
    setErrors({});
    setGeneralError("");
    onSwitchToSignUp();
  };

  const styles = getStyles(theme);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: theme.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.gradientHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <View style={styles.logoCircle}>
                <Image 
                  source={require('../../assets/superinvoiceicon.png')} 
                  style={styles.logoImage}
                />
              </View>
              <Text style={styles.headerTitle}>Sign In</Text>
              <View style={styles.testimonialContainer}>
                <View style={styles.aiProfileContainer}>
                  <Image 
                    source={require('../../assets/onboarding/happyuser.png')} 
                    style={styles.profileImage}
                  />
                </View>
                <Text style={styles.testimonialText}>
                  "AI that actually works and saves me hours of paperwork."
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Content */}
        <ScrollView 
          style={[styles.content, { backgroundColor: theme.card }]}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          ref={scrollViewRef}
        >
          {/* Plan indicator */}
          {plan === 'paid' && (
            <View style={[styles.planBadge, { backgroundColor: theme.primary }]}>
              <Ionicons name="crown" size={16} color={theme.primaryForeground} />
              <Text style={[styles.planBadgeText, { color: theme.primaryForeground }]}>
                Pro Plan
              </Text>
            </View>
          )}

          {generalError ? (
            <View style={[styles.errorContainer, { backgroundColor: `${theme.destructive}15` }]}>
              <Text style={[styles.errorText, { color: theme.destructive }]}>
                {generalError}
              </Text>
            </View>
          ) : null}

          {/* Google Sign In Button */}
          <Button
            onPress={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
            style={[styles.googleButton, { 
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
                <Text style={[styles.googleButtonText, { color: theme.foreground }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </Button>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.mutedForeground }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer} ref={emailInputRef}>
            <Text style={[styles.inputLabel, { color: theme.foreground }]}>Email</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons 
                name="mail" 
                size={20} 
                color={theme.mutedForeground} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { color: theme.foreground }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                onFocus={() => scrollToInput(emailInputRef)}
              />
            </View>
            {errors.email && (
              <Text style={[styles.errorText, { color: theme.destructive }]}>
                {errors.email}
              </Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer} ref={passwordInputRef}>
            <Text style={[styles.inputLabel, { color: theme.foreground }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
              <Ionicons 
                name="lock-closed" 
                size={20} 
                color={theme.mutedForeground} 
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.textInput, { color: theme.foreground }]}
                placeholder="Enter your password"
                placeholderTextColor={theme.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                onFocus={() => scrollToInput(passwordInputRef)}
              />
            </View>
            {errors.password && (
              <Text style={[styles.errorText, { color: theme.destructive }]}>
                {errors.password}
              </Text>
            )}
          </View>

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPasswordButton}>
            <Text style={[styles.forgotPasswordText, { color: theme.primary }]}>
              Forgot your password?
            </Text>
          </TouchableOpacity>

          {/* Sign In Button */}
          <Button
            onPress={handleSignIn}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            disabled={isLoading || isGoogleLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={theme.primaryForeground} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>
                Sign In
              </Text>
            )}
          </Button>

          {/* Sign Up Link */}
          <TouchableOpacity onPress={handleSwitchToSignUp} style={styles.switchButton}>
            <Text style={[styles.switchButtonText, { color: theme.mutedForeground }]}>
              Don't have an account?{' '}
              <Text style={[styles.switchButtonHighlight, { color: theme.primary }]}>
                Sign Up
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 160,
  },
  gradientHeader: {
    flex: 1,
    backgroundColor: '#25D366',
    paddingTop: Platform.OS === 'ios' ? 25 : 15,
    paddingHorizontal: 24,
    justifyContent: 'flex-start',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 10,
  },
  headerContent: {
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 0,
    marginTop: -45,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  logoImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  testimonialContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    paddingHorizontal: 10,
  },
  aiProfileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 12,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  testimonialText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    textAlign: 'center',
  },
  content: {
    flex: 1,
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
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 40,
  },
  planBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  planBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
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
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    marginTop: 6,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    marginBottom: 10,
  },
  forgotPasswordText: {
    fontSize: 15,
    fontWeight: '500',
  },
  primaryButton: {
    paddingVertical: 18,
    borderRadius: 12,
    marginBottom: 20,
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
  switchButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchButtonText: {
    fontSize: 15,
  },
  switchButtonHighlight: {
    fontWeight: '600',
  },
}); 
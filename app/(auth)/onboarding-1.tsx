import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  StatusBar,
  Dimensions,
  Image,
} from "react-native";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { OnboardingInvoiceCarousel } from "@/components/OnboardingInvoiceCarousel";
import { Ionicons } from '@expo/vector-icons';

export default function OnboardingScreen1() {
  const router = useRouter();
  const { theme } = useTheme();
  const [authModalVisible, setAuthModalVisible] = useState(false);

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
    setAuthModalVisible(true);
  };

  const handleAuthSuccess = () => {
    setAuthModalVisible(false);
    // User signed in successfully - navigate to the main app
    router.replace("/(app)/(protected)");
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
              {/* Apple Sign In - Disabled for now */}
              <Pressable
                onPress={() => {}}
                style={[styles.authButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <View style={styles.appleIconContainer}>
                  <Ionicons name="logo-apple" size={24} color="#000000" />
                </View>
                <Text style={[styles.authButtonText, { color: "#000000" }]}>Continue with Apple</Text>
              </Pressable>

              {/* Google Sign In */}
              <Pressable
                onPress={() => {}}
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
                onPress={() => {}}
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
        initialMode="signin"
        plan="free"
        onSuccess={handleAuthSuccess}
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
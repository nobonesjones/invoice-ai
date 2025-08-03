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
} from "react-native";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { AuthModal } from "@/components/auth/auth-modal";
import { OnboardingInvoiceCarousel } from "@/components/OnboardingInvoiceCarousel";

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
              <Button
                onPress={handleGetStarted}
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Get started</Text>
              </Button>

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
    marginTop: 55,
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
});
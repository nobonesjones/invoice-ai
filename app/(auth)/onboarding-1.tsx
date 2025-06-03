import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  SafeAreaView,
  Platform,
} from "react-native";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { AuthModal } from "@/components/auth/auth-modal";

export default function OnboardingScreen1() {
  const router = useRouter();
  const { theme } = useTheme();
  const [authModalVisible, setAuthModalVisible] = useState(false);

  const handleGetStarted = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding-2");
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.splitContainer}>
        {/* Top Side - Branded Visual */}
        <View style={styles.topSide}>
          <LinearGradient
            colors={['#4F46E5', '#7C3AED', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          >
            {/* Brand visual placeholder - replace with actual branded element */}
            <View style={styles.brandVisual}>
              <View style={styles.logoCircle}>
                <Text style={styles.logoText}>SI</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Bottom Side - Content Area */}
        <View style={[styles.bottomSide, { backgroundColor: theme.card }]}>
          <View style={styles.contentArea}>
            {/* App Logo & Name */}
            <View style={styles.logoSection}>
              <View style={styles.appLogoContainer}>
                <View style={[styles.appLogo, { backgroundColor: theme.muted }]}>
                  <Text style={styles.appLogoText}>📧</Text>
                </View>
              </View>
              <Text style={[styles.appName, { color: theme.foreground }]}>SupaInvoice</Text>
              <Text style={[styles.tagline, { color: theme.mutedForeground }]}>
                Create fast and professional invoices directly from your phone.
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
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  splitContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  topSide: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandVisual: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  bottomSide: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 20,
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
  appLogoText: {
    fontSize: 24,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
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
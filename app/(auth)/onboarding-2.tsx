import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";

export default function OnboardingScreen2() {
  const router = useRouter();
  const { theme } = useTheme();

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding-3");
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.backgroundContainer}>
        {/* Background - placeholder gradient, replace with actual image */}
        <LinearGradient
          colors={['#F3F4F6', '#E5E7EB', '#D1D5DB']}
          style={styles.background}
        >
          {/* Content overlay */}
          <View style={styles.overlay}>
            <View style={styles.contentContainer}>
              {/* Header content */}
              <View style={styles.headerContent}>
                <Text style={styles.headline}>Invoice in seconds</Text>
                <Text style={styles.subHeadline}>
                  Create professional invoices and send them from your phone
                </Text>
              </View>

              {/* Spacer */}
              <View style={styles.spacer} />

              {/* Bottom button */}
              <View style={styles.buttonContainer}>
                <Button
                  onPress={handleContinue}
                  style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                >
                  <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Continue</Text>
                </Button>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundContainer: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)', // Dark overlay for text readability
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headline: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subHeadline: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  spacer: {
    flex: 0.5,
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: 20,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
}); 
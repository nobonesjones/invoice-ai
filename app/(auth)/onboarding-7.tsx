import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Easing,
} from "react-native";

import { useTheme } from "@/context/theme-provider";

export default function OnboardingScreen7() {
  const router = useRouter();
  const { theme } = useTheme();
  const [progress, setProgress] = useState(0);
  
  // Animation refs
  const spinAnimation = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start spinner animation
    const spinLoop = Animated.loop(
      Animated.timing(spinAnimation, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    // Simulate account creation progress
    const progressSteps = [
      { message: 'Creating your account...', duration: 1000, progress: 25 },
      { message: 'Setting up business profile...', duration: 1500, progress: 50 },
      { message: 'Configuring preferences...', duration: 1000, progress: 75 },
      { message: 'Almost done...', duration: 1000, progress: 100 },
    ];

    let totalDelay = 0;

    progressSteps.forEach((step, index) => {
      setTimeout(() => {
        setProgress(step.progress);
        
        // Animate progress bar
        Animated.timing(progressAnimation, {
          toValue: step.progress / 100,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();

        // Navigate to next screen when complete
        if (index === progressSteps.length - 1) {
          setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.push("/onboarding-8");
          }, 500);
        }
      }, totalDelay);
      
      totalDelay += step.duration;
    });

    return () => {
      spinLoop.stop();
    };
  }, []);

  const spin = spinAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const progressWidth = progressAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentContainer}>
        {/* Loading Spinner */}
        <View style={styles.loadingSection}>
          <Animated.View 
            style={[
              styles.spinner,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          >
            <View style={[styles.spinnerOuter, { borderColor: theme.border, borderTopColor: theme.primary }]}>
              <View style={[styles.spinnerInner, { backgroundColor: theme.primary }]} />
            </View>
          </Animated.View>
          
          <Text style={[styles.loadingText, { color: theme.foreground }]}>Loading...</Text>
        </View>

        {/* Progress Information */}
        <View style={styles.progressSection}>
          <Text style={[styles.progressDescription, { color: theme.mutedForeground }]}>
            We are creating your account with all the business details.{'\n'}
            This should take only seconds...
          </Text>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
              <Animated.View 
                style={[
                  styles.progressBarFill,
                  { backgroundColor: theme.primary, width: progressWidth },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.mutedForeground }]}>{progress}%</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingSection: {
    alignItems: 'center',
    marginBottom: 60,
  },
  spinner: {
    marginBottom: 24,
  },
  spinnerOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    opacity: 0.3,
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    alignItems: 'center',
  },
  progressDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  progressBarContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
}); 
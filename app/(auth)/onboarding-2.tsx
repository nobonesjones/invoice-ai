import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  StatusBar,
  Dimensions,
} from "react-native";
import { VideoView, useVideoPlayer } from 'expo-video';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";

export default function OnboardingScreen2() {
  const router = useRouter();
  const { theme } = useTheme();

  // Initialize video player
  const player = useVideoPlayer(require('../../assets/videos/0627 (1).mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Hide status bar for immersive video experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/onboarding-2-1");
  };

  const styles = getStyles(theme);

  return (
    <View style={[styles.container, { backgroundColor: '#000000' }]}>
      <View style={styles.backgroundContainer}>
        {/* Video Background */}
        <VideoView
          style={styles.background}
          player={player}
          nativeControls={false}
          contentFit="cover"
        />
        
        {/* Content overlay */}
        <View style={styles.overlay}>
          <View style={styles.contentContainer}>
            {/* Top spacer to push content to bottom */}
            <View style={styles.topSpacer} />
            
            {/* Header content - positioned just above button */}
            <View style={styles.headerContent}>
              <Text style={styles.headline}>Make professional invoices in seconds from anywhere</Text>
            </View>

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
      </View>
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
  backgroundContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly lighter for better contrast
    height: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
    justifyContent: 'space-between',
    height: '100%',
  },
  headerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingBottom: 20,
  },
  headline: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 33,
    marginBottom: 0,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subHeadline: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  spacer: {
    flex: 0.5,
  },
  buttonContainer: {
    width: '100%',
    paddingBottom: 30,
    paddingHorizontal: 0,
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
  topSpacer: {
    flex: 0.85,
  },
}); 
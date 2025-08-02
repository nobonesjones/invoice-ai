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

export default function OnboardingScreen2_1() {
  const router = useRouter();
  const { theme } = useTheme();

  // Initialize video player
  const player = useVideoPlayer(require('@/assets/videos/ask_ai1.1.mp4'), (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  // Hide status bar for immersive experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/onboarding-2-2");
  };

  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      {/* Full screen video */}
      <VideoView
        style={styles.video}
        player={player}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      
      {/* Button overlay at the bottom */}
      <View style={styles.buttonOverlay}>
        <Button
          onPress={handleContinue}
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
        >
          <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Continue</Text>
        </Button>
      </View>
    </View>
  );
}

const { height, width } = Dimensions.get('window');

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  video: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    width: width,
    height: height,
  },
  buttonOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 35 : 15,
    paddingTop: 20,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
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
}); 
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  StatusBar,
  Dimensions,
  Image,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";

const TESTIMONIALS = [
  "Game-changer for my business! 📈",
  "So easy to create professional invoices ⚡",
  "Love the mobile-first approach 📱",
  "Best invoicing app I've ever used! 🌟",
  "Saves me hours every week 💼",
];

export default function OnboardingScreen6() {
  const router = useRouter();
  const { theme } = useTheme();
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  
  // Initialize video player
  const player = useVideoPlayer(require('../../assets/videos/0629.mp4'), (player) => {
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

  React.useEffect(() => {
    // Cycle through testimonials
    const interval = setInterval(() => {
      setCurrentTestimonialIndex((prev) => 
        (prev + 1) % TESTIMONIALS.length
      );
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(auth)/onboarding-7");
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
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.headerContent}>
            <Text style={[styles.headline, { color: '#FFFFFF' }]}>Try For Free</Text>
            <Text style={[styles.subHeadline, { color: '#FFFFFF' }]}>
              SupaInvoice was made for people like you.
            </Text>
          </View>

          {/* User Avatars Section */}
          <View style={styles.socialProofSection}>
            <View style={styles.avatarsContainer}>
              {/* Avatar Circles */}
              <View style={styles.avatarCluster}>
                <View style={[styles.avatar, styles.avatar1]}>
                  <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face&auto=format' }}
                    style={styles.avatarImage}
                  />
                </View>
                <View style={[styles.avatar, styles.avatar2]}>
                  <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1494790108755-2616b612b47c?w=150&h=150&fit=crop&crop=face&auto=format' }}
                    style={styles.avatarImage}
                  />
                </View>
                <View style={[styles.avatar, styles.avatar3]}>
                  <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face&auto=format' }}
                    style={styles.avatarImage}
                  />
                </View>
                <View style={[styles.avatar, styles.avatar4]}>
                  <Image 
                    source={{ uri: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face&auto=format' }}
                    style={[styles.avatarImage, styles.avatar4Image]}
                  />
                  <View style={styles.overlayBadge}>
                    <Text style={styles.badgeText}>14K+</Text>
                  </View>
                </View>
              </View>
              <Text style={[styles.userCountText, { color: '#FFFFFF' }]}>Over 14,000 businesses trust SuperInvoice</Text>
            </View>

            {/* Star Rating */}
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons 
                  key={star}
                  name="star" 
                  size={24} 
                  color="#FFD700" 
                  style={styles.star}
                />
              ))}
            </View>

            {/* Testimonials */}
            <View style={styles.testimonialContainer}>
              <Text style={[styles.testimonialText, { color: '#FFFFFF' }]}>
                {TESTIMONIALS[currentTestimonialIndex]}
              </Text>
            </View>
          </View>

          {/* Main Message */}
          <View style={styles.mainMessageSection}>
            <Text style={[styles.mainMessage, { color: '#FFFFFF' }]}>
              Look professional{'\n'}keep customers happy.
            </Text>
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Button */}
          <View style={styles.buttonContainer}>
            <Button
              onPress={handleContinue}
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            >
              <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Continue</Text>
            </Button>
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 30,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 70,
    marginBottom: 30,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subHeadline: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  socialProofSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  avatarsContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
  avatar1: {
    backgroundColor: '#EF4444',
  },
  avatar2: {
    backgroundColor: '#3B82F6',
  },
  avatar3: {
    backgroundColor: '#10B981',
  },
  avatar4: {
    backgroundColor: '#F59E0B',
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  avatar4Image: {
    borderRadius: 24,
  },
  overlayBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userCountText: {
    fontSize: 16,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  star: {
    marginHorizontal: 2,
  },
  testimonialContainer: {
    minHeight: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testimonialText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  mainMessageSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  mainMessage: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 36,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 30,
    paddingTop: 10,
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
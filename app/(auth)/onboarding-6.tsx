import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  ScrollView,
} from "react-native";
import * as StoreReview from 'expo-store-review';
import { Ionicons } from '@expo/vector-icons';

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
    
    try {
      // Try to show the rating prompt
      const isAvailable = await StoreReview.isAvailableAsync();
      if (isAvailable) {
        await StoreReview.requestReview();
      }
    } catch (error) {
      console.log('Store review not available or error:', error);
    }
    
    // Continue to next screen regardless of rating prompt
    router.push("/onboarding-7");
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.headerContent}>
            <Text style={[styles.headline, { color: theme.foreground }]}>Give us a rating</Text>
            <Text style={[styles.subHeadline, { color: theme.mutedForeground }]}>
              SupaInvoice was made for people like you.
            </Text>
          </View>

          {/* User Avatars Section */}
          <View style={styles.socialProofSection}>
            <View style={styles.avatarsContainer}>
              {/* Avatar Circles */}
              <View style={styles.avatarCluster}>
                <View style={[styles.avatar, styles.avatar1]}>
                  <Text style={styles.avatarText}>JD</Text>
                </View>
                <View style={[styles.avatar, styles.avatar2]}>
                  <Text style={styles.avatarText}>SM</Text>
                </View>
                <View style={[styles.avatar, styles.avatar3]}>
                  <Text style={styles.avatarText}>AL</Text>
                </View>
                <View style={[styles.avatar, styles.avatar4]}>
                  <Text style={styles.avatarText}>+1M</Text>
                </View>
              </View>
              <Text style={[styles.userCountText, { color: theme.mutedForeground }]}>+1M SupaInvoice people</Text>
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
              <Text style={[styles.testimonialText, { color: theme.mutedForeground }]}>
                {TESTIMONIALS[currentTestimonialIndex]}
              </Text>
            </View>
          </View>

          {/* Main Message */}
          <View style={styles.mainMessageSection}>
            <Text style={[styles.mainMessage, { color: theme.foreground }]}>
              Join Millions of Happy{'\n'}SupaInvoice users
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
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  subHeadline: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  userCountText: {
    fontSize: 16,
    fontWeight: '500',
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
  },
  spacer: {
    flex: 1,
    minHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 20,
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
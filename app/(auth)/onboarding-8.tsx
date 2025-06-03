import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
} from "react-native";
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";

export default function OnboardingScreen8() {
  const router = useRouter();
  const { theme } = useTheme();

  useEffect(() => {
    // Trigger success haptic feedback when screen loads
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleStartTutorial = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      console.log('Notification permission status:', finalStatus);
    } catch (error) {
      console.log('Error requesting notification permissions:', error);
    }
    
    // Navigate directly to the main app - soft paywall will handle monetization naturally
    router.replace("/(app)/soft-paywall");
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.contentContainer}>
        {/* Success Visual */}
        <View style={styles.visualSection}>
          {/* Invoice Preview Placeholder */}
          <View style={[styles.invoicePreview, { backgroundColor: theme.muted, borderColor: theme.border }]}>
            <View style={styles.invoiceHeader}>
              <View style={[styles.invoiceLogo, { backgroundColor: theme.primary }]} />
              <View style={[styles.invoiceTitle, { backgroundColor: theme.border }]} />
            </View>
            <View style={styles.invoiceContent}>
              <View style={[styles.invoiceLine, { backgroundColor: theme.border }]} />
              <View style={[styles.invoiceLine, { backgroundColor: theme.border }]} />
              <View style={[styles.invoiceLine, styles.invoiceLineShort, { backgroundColor: theme.border }]} />
            </View>
          </View>

          {/* Success Checkmark */}
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="#FFFFFF" />
          </View>
        </View>

        {/* Content */}
        <View style={styles.textSection}>
          <Text style={[styles.headline, { color: theme.foreground }]}>Account created!</Text>
          <Text style={[styles.description, { color: theme.mutedForeground }]}>
            Your account has been created. Start making your first invoices and grow your business!
          </Text>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button */}
        <View style={styles.buttonContainer}>
          <Button
            onPress={handleStartTutorial}
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          >
            <Text style={[styles.primaryButtonText, { color: theme.primaryForeground }]}>Start Invoice Tutorial</Text>
          </Button>
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
    alignItems: 'center',
  },
  visualSection: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 40,
    position: 'relative',
  },
  invoicePreview: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  invoiceHeader: {
    marginBottom: 12,
  },
  invoiceLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginBottom: 8,
  },
  invoiceTitle: {
    width: '80%',
    height: 12,
    borderRadius: 2,
  },
  invoiceContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  invoiceLine: {
    width: '100%',
    height: 8,
    borderRadius: 2,
    marginBottom: 6,
  },
  invoiceLineShort: {
    width: '60%',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: -12,
    right: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  textSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
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
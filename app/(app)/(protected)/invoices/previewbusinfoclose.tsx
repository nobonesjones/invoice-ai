import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { ChevronLeft } from 'lucide-react-native';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { PinchGestureHandlerGestureEvent, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';

interface PreviewScreenParams {
  invoiceData?: string; // JSON stringified invoice data
  businessSettings?: string; // JSON stringified business settings
}

// Currency symbol mapping function
const getCurrencySymbol = (code: string) => {
  const mapping: Record<string, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    AUD: 'A$',
    CAD: 'C$',
    JPY: '¥',
    INR: '₹',
    // Add more as needed
  };
  // Accept both 'GBP' and 'GBP - British Pound' style codes
  if (!code) return '$';
  const normalized = code.split(' ')[0];
  return mapping[normalized] || '$';
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 10, 
  },
  headerTitle: {
    fontSize: 20, 
    fontWeight: 'bold', 
    marginLeft: 10, // Spacing between icon and title
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Light gray background for invoice preview
  },
  gestureContainer: {
    flex: 1,
  },
  panContainer: {
    flex: 1,
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default function PreviewBusinfoCloseScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const styles = getStyles(theme);
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { invoiceData: invoiceDataParam, businessSettings: businessSettingsParam } = useLocalSearchParams();

  // Parse the passed data
  const [invoiceData, setInvoiceData] = useState<any | null>(() => {
    try {
      if (invoiceDataParam && typeof invoiceDataParam === 'string') {
        const parsed = JSON.parse(invoiceDataParam);
        console.log('[PreviewBusinfoCloseScreen] Parsed invoice data for Skia:', parsed);
        console.log('[PreviewBusinfoCloseScreen] Client data in parsed:', parsed.clients);
        console.log('[PreviewBusinfoCloseScreen] Line items in parsed:', parsed.invoice_line_items);
        console.log('[PreviewBusinfoCloseScreen] Payment methods in parsed - Stripe:', parsed.stripe_active, 'PayPal:', parsed.paypal_active, 'Bank:', parsed.bank_account_active);
        
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('[PreviewBusinfoCloseScreen] Error parsing invoice data:', error);
      return null;
    }
  });

  const [businessSettings, setBusinessSettings] = useState<any | null>(() => {
    try {
      if (businessSettingsParam && typeof businessSettingsParam === 'string') {
        const parsed = JSON.parse(businessSettingsParam);
        console.log('[PreviewBusinfoCloseScreen] Parsed business settings for Skia:', parsed);
        return parsed;
      }
      return null;
    } catch (error) {
      console.error('[PreviewBusinfoCloseScreen] Error parsing business settings:', error);
      return null;
    }
  });

  // Refresh data when screen comes back into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      const refreshData = () => {
        console.log('[PreviewBusinfoCloseScreen] Refreshing preview data on focus');
        
        // Re-parse invoice data
        try {
          if (invoiceDataParam && typeof invoiceDataParam === 'string') {
            const parsed = JSON.parse(invoiceDataParam);
            console.log('[PreviewBusinfoCloseScreen] Refreshed invoice data:', parsed);
            setInvoiceData(parsed);
          }
        } catch (error) {
          console.error('[PreviewBusinfoCloseScreen] Error refreshing invoice data:', error);
        }

        // Re-parse business settings
        try {
          if (businessSettingsParam && typeof businessSettingsParam === 'string') {
            const parsed = JSON.parse(businessSettingsParam);
            console.log('[PreviewBusinfoCloseScreen] Refreshed business settings:', parsed);
            setBusinessSettings(parsed);
          }
        } catch (error) {
          console.error('[PreviewBusinfoCloseScreen] Error refreshing business settings:', error);
        }
      };

      refreshData();
    }, [invoiceDataParam, businessSettingsParam])
  );

  // Zoom and pan animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Pan gesture handler
  const panGestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, { translateX: number; translateY: number }>({
    onStart: (_, context) => {
      context.translateX = translateX.value;
      context.translateY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.translateX + event.translationX;
      translateY.value = context.translateY + event.translationY;
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent, { scale: number }>({
    onStart: (_, context) => {
      context.scale = scale.value;
    },
    onActive: (event, context) => {
      scale.value = Math.max(0.5, Math.min(context.scale * event.scale, 3));
    },
    onEnd: () => {
      // Snap back if zoomed out too much
      if (scale.value < 0.8) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleBack = () => {
    console.log('[PreviewBusinfoCloseScreen] Back button pressed');
    router.back();
  };

  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={handleBack} style={{ padding: 6 }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Preview Invoice</Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, theme, styles]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[PreviewBusinfoCloseScreen] Focus event: Hiding tab bar');
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[PreviewBusinfoCloseScreen] Blur event: Showing tab bar');
      setIsTabBarVisible(true);
    });

    // Initial hide if screen is focused on mount
    if (navigation.isFocused()) {
      console.log('[PreviewBusinfoCloseScreen] Initial focus: Hiding tab bar');
      setIsTabBarVisible(false);
    }

    return () => {
      console.log('[PreviewBusinfoCloseScreen] Unmounting: Ensuring tab bar is visible');
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);

  // Get currency symbol from business settings
  const currencySymbol = businessSettings?.currency_code ? getCurrencySymbol(businessSettings.currency_code) : '$';

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Main Content Area */}
      <View style={styles.contentContainer}>
        {invoiceData && businessSettings ? (
          <GestureHandlerRootView style={styles.gestureContainer}>
            <PanGestureHandler onGestureEvent={panGestureHandler}>
              <Animated.View style={styles.panContainer}>
                <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
                  <Animated.View style={[styles.zoomContainer, animatedStyle]}>
                    <ScrollView 
                      contentContainerStyle={styles.scrollContainer}
                      showsVerticalScrollIndicator={false}
                      showsHorizontalScrollIndicator={false}
                      bounces={false}
                    >
                      <SkiaInvoiceCanvas
                        invoice={invoiceData}
                        business={businessSettings}
                        client={invoiceData.clients}
                        currencySymbol={currencySymbol}
                        style={{ alignSelf: 'center' }}
                      />
                    </ScrollView>
                  </Animated.View>
                </PinchGestureHandler>
              </Animated.View>
            </PanGestureHandler>
          </GestureHandlerRootView>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: themeColors.destructive }]}>
              Failed to load preview data
            </Text>
            <TouchableOpacity
              style={[styles.errorButton, { backgroundColor: themeColors.primary }]}
              onPress={handleBack}
            >
              <Text style={[styles.errorButtonText, { color: themeColors.primaryForeground }]}>
                Go Back
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
} 
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from './InvoiceTemplateOne';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

interface PreviewScreenParams {
  invoiceData: string; // JSON stringified invoice data
  businessSettings: string; // JSON stringified business settings
}

export default function PreviewScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const router = useRouter();
  const navigation = useNavigation();
  const { invoiceData: invoiceDataParam, businessSettings: businessSettingsParam } = useLocalSearchParams<PreviewScreenParams>();

  // Parse the passed data
  const [invoiceData, setInvoiceData] = useState<InvoiceForTemplate | null>(() => {
    try {
      if (invoiceDataParam) {
        const parsed = JSON.parse(invoiceDataParam);
        // Transform the form data into InvoiceForTemplate format
        return {
          ...parsed,
          id: 'preview-temp-id',
          user_id: 'preview-user',
          status: 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          clients: null, // Will be set if client data available
          invoice_line_items: parsed.items || [],
          currency: 'USD', // Default, will be overridden by business settings
          currency_symbol: '$',
          invoice_tax_label: parsed.invoice_tax_label || 'Tax',
        } as InvoiceForTemplate;
      }
      return null;
    } catch (error) {
      console.error('[PreviewScreen] Error parsing invoice data:', error);
      return null;
    }
  });

  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(() => {
    try {
      if (businessSettingsParam) {
        return JSON.parse(businessSettingsParam);
      }
      return null;
    } catch (error) {
      console.error('[PreviewScreen] Error parsing business settings:', error);
      return null;
    }
  });

  // Zoom and pan animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Pan gesture handler
  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
      context.translateX = translateX.value;
      context.translateY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.translateX + event.translationX;
      translateY.value = context.translateY + event.translationY;
    },
  });

  // Pinch gesture handler
  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context: any) => {
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
    console.log('[PreviewScreen] Back button pressed');
    router.back();
  };

  // Set up custom header using navigation.setOptions like business-information.tsx
  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: themeColors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border}]}>
          <TouchableOpacity onPress={handleBack} style={{ padding: 6 }}>
            <ChevronLeft size={24} color={themeColors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: themeColors.foreground}]}>Preview</Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, themeColors]);

  const styles = getStyles(themeColors);

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
                    <InvoiceTemplateOne
                      invoice={invoiceData}
                      clientName={invoiceData.clients?.name || 'Client Name'}
                      businessSettings={businessSettings}
                    />
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

const getStyles = (themeColors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 10, 
  },
  headerTitle: {
    fontSize: 18, 
    fontWeight: 'bold', 
    marginLeft: 10, // Spacing between icon and title
  },
  contentContainer: {
    flex: 1,
    backgroundColor: themeColors.border, // Matches invoice-viewer background
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
    padding: 20,
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
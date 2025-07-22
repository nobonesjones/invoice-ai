import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  ChevronLeft,
  Edit3,
  MoreHorizontal,
  History,
  Send,
  Share2,
  Trash2,
  X as XIcon,
  Mail,
  Link2,
} from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider'; 
import type { Tables } from '../../../../types/database.types'; 
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import { StatusBadge } from '@/components/StatusBadge';
import { EstimateStatus, getEstimateStatusConfig, isEstimateEditable, getPreviousStatus } from '@/constants/estimate-status';
import InvoiceSkeletonLoader from '@/components/InvoiceSkeletonLoader';
import { useEstimateActivityLogger } from './useEstimateActivityLogger';
import EstimateHistorySheet, { EstimateHistorySheetRef } from './EstimateHistorySheet';
import { EstimateConversionService } from '@/services/estimateConversionService';
import { EstimateSenderService } from '@/services/estimateSenderService';
import { usePaywall } from '@/context/paywall-provider';
import { usePlacement } from 'expo-superwall';
import PaywallService, { PaywallService as PaywallServiceClass } from '@/services/paywallService';

// SKIA IMPORTS for estimate rendering
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';
import SkiaInvoiceCanvasModern from '@/components/skia/SkiaInvoiceCanvasModern';
import { SkiaInvoiceCanvasSimple } from '@/components/skia/SkiaInvoiceCanvasSimple';
import { useCanvasRef } from '@shopify/react-native-skia';

interface EstimateForTemplate {
  id: string;
  estimate_number: string | null;
  estimate_date: string;
  valid_until_date: string | null;
  status: string | null;
  subtotal_amount: number | null;
  tax_amount: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  acceptance_terms: string | null;
  clients: Tables<'clients'> | null;
  estimate_line_items: Tables<'estimate_line_items'>[];
  currency: string;
  currency_symbol: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  invoice_design?: string | null;
  accent_color?: string | null;
  estimate_tax_label?: string;
  is_accepted?: boolean | null;
}

interface BusinessSettingsRow {
  id?: string;
  user_id: string;
  business_name?: string | null;
  business_address?: string | null;
  business_phone?: string | null;
  business_email?: string | null;
  business_website?: string | null;
  business_tax_number?: string | null;
  business_logo_url?: string | null;
  currency_code?: string | null;
  show_business_logo?: boolean | null;
  show_business_name?: boolean | null;
  show_business_address?: boolean | null;
  show_business_tax_number?: boolean | null;
  show_notes_section?: boolean | null;
  payment_instructions?: string | null;
  stripe_enabled?: boolean | null;
  paypal_enabled?: boolean | null;
  bank_account_enabled?: boolean | null;
  estimate_terminology?: 'estimate' | 'quote' | null;
}

function EstimateViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const { id: estimateId } = useLocalSearchParams<{ id: string }>();
  const { supabase, user } = useSupabase();
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { logEstimateCreated, logEstimateEdited, logEstimateSent, logEstimateConverted, logStatusChanged } = useEstimateActivityLogger();
  const { isSubscribed } = usePaywall();
  
  // Paywall for send block
  const { registerPlacement } = usePlacement({
    onError: (err) => console.error('[EstimateViewer] Send block error:', err),
    onPresent: (info) => console.log('[EstimateViewer] Send block presented:', info),
    onDismiss: (info, result) => {
      console.log('[EstimateViewer] Send block dismissed:', info, 'Result:', result);
      if (result?.type === 'purchased') {
        console.log('[EstimateViewer] User subscribed, continuing send...');
      }
    },
  });

  const [estimate, setEstimate] = useState<EstimateForTemplate | null>(null);
  const [client, setClient] = useState<Tables<'clients'> | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEstimateReady, setIsEstimateReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Modal refs
  const sendEstimateModalRef = useRef<BottomSheetModal>(null);
  const moreOptionsSheetRef = useRef<BottomSheetModal>(null);
  const historyModalRef = useRef<EstimateHistorySheetRef>(null);

  // Skia canvas ref for PDF export
  const skiaEstimateRef = useCanvasRef();

  // Disable default header to prevent flash (we use custom header in render)
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Tab bar visibility management (following pagetransitions.md Approach 2)
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[EstimateViewerScreen] Focus event: Hiding tab bar');
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[EstimateViewerScreen] Blur event: Showing tab bar');
      setIsTabBarVisible(true);
    });

    // Initial hide if screen is focused on mount
    if (navigation.isFocused()) {
      console.log('[EstimateViewerScreen] Initial focus: Hiding tab bar');
      setIsTabBarVisible(false);
    }

    return () => {
      console.log('[EstimateViewerScreen] Unmounting: Ensuring tab bar is visible');
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);



  const fetchBusinessSettings = async (userId: string) => {
    if (!userId) return;

    try {
      const { data, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single(); 

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('[fetchBusinessSettings] Error:', settingsError);
        setBusinessSettings(null); 
      } else {
        if (data) {
          const { data: paymentOpts, error: paymentOptsError } = await supabase
            .from('payment_options') 
            .select('*')
            .eq('user_id', userId) 
            .single();

          if (paymentOptsError && paymentOptsError.code !== 'PGRST116') {
            console.error('[fetchBusinessSettings] Payment options error:', paymentOptsError);
          }

          const combinedSettings = { ...data, ...(paymentOpts || {}) };
          setBusinessSettings(combinedSettings as BusinessSettingsRow); 
        } else {
          setBusinessSettings(null);
        }
      }
    } catch (e: any) {
      console.error('[fetchBusinessSettings] Exception:', e.message);
      setBusinessSettings(null);
    }
  };

  const fetchEstimateData = async (estimateId: string) => {
    try {
      const { data: estimateData, error: estimateError } = await supabase
        .from('estimates')
        .select(`
          *,
          clients (*),
          estimate_line_items (*)
        `)
        .eq('id', estimateId)
        .single();

      if (estimateError) {
        console.error('[fetchEstimateData] Error:', estimateError);
        setError('Failed to load estimate data.');
        return null;
      }

      if (!estimateData) {
        setError('Estimate not found.');
        return null;
      }
      
      const { data: businessDataForCurrency, error: businessError } = await supabase
        .from('business_settings')
        .select('currency_code')
        .eq('user_id', estimateData.user_id)
        .single();

      if (businessError && businessError.code !== 'PGRST116') {
        console.error('[fetchEstimateData] Currency error:', businessError);
      }

      const fetchedEstimate: EstimateForTemplate = {
        ...estimateData,
        estimate_number: estimateData.estimate_number ?? '', 
        clients: estimateData.clients as Tables<'clients'> | null,
        estimate_line_items: estimateData.estimate_line_items as Tables<'estimate_line_items'>[],
        currency: businessDataForCurrency?.currency_code || 'USD', 
        currency_symbol: getCurrencySymbol(businessDataForCurrency?.currency_code || 'USD'),
        valid_until_date: estimateData.valid_until_date ?? null,
        estimate_tax_label: estimateData.estimate_tax_label || 'Tax',
        is_accepted: estimateData.is_accepted || estimateData.status === 'accepted' || estimateData.converted_to_invoice_id,
      };
      
      setEstimate(fetchedEstimate);
      if (estimateData.clients) {
        setClient(estimateData.clients as Tables<'clients'>);
      }
      setError(null);
      return fetchedEstimate;
    } catch (e: any) {
      console.error('[fetchEstimateData] Exception:', e.message);
      setError('An unexpected error occurred.');
      return null;
    }
  };

  useEffect(() => {
    const processData = async () => {
      if (estimateId) {
        setIsLoading(true);
        try {
          const startTime = Date.now();
          const minLoadingTime = 800;
          
          const fetchedEstimate = await fetchEstimateData(estimateId);
          if (fetchedEstimate && fetchedEstimate.user_id) {
            await fetchBusinessSettings(fetchedEstimate.user_id);
          }
          
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime < minLoadingTime) {
            await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
          }
          
        } catch (error) {
          console.error('[processData] Error:', error);
          setError('Failed to load estimate data.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setError('No estimate specified.');
        setIsLoading(false);
      }
    };

    processData();
  }, [estimateId, supabase]);

  // Track when estimate is ready to render
  useEffect(() => {
    if (estimate && businessSettings && !isLoading) {
      const timer = setTimeout(() => {
        setIsEstimateReady(true);
      }, 300);
      
      return () => clearTimeout(timer);
    } else {
      setIsEstimateReady(false);
    }
  }, [estimate, businessSettings, isLoading]);

  const getCurrencySymbol = (currencyCode: string): string => {
    // Handles both codes and full names from the DB, e.g. 'GBP - British Pound'
    if (!currencyCode) return '$';
    const mapping: Record<string, string> = {
      'USD': '$',
      'USD - United States Dollar': '$',
      'GBP': '£',
      'GBP - British Pound': '£',
      'EUR': '€',
      'EUR - Euro': '€',
      // Add more as needed
    };
    // Try direct match
    if (mapping[currencyCode]) return mapping[currencyCode];
    // Try extracting code from start of string
    const code = currencyCode.split(' ')[0];
    if (mapping[code]) return mapping[code];
    return '$'; // Default fallback
  };

  // Calculate currency symbol for Skia canvas
  const currencySymbol = estimate?.currency ? getCurrencySymbol(estimate.currency) : '$';

  const getEstimateDesignComponent = () => {
    const designType = estimate?.invoice_design || 'classic';
    
    switch (designType.toLowerCase()) {
      case 'modern':
        return SkiaInvoiceCanvasModern;
      case 'simple':
        return SkiaInvoiceCanvasSimple;
      case 'classic':
      default:
        return SkiaInvoiceCanvas;
    }
  };

  const EstimateDesignComponent = getEstimateDesignComponent();

  const getAccentColor = () => {
    return estimate?.accent_color || '#14B8A6';
  };

  const handleEdit = () => {
    if (!estimate) return;
    
    const currentStatus = (estimate.status || 'draft') as EstimateStatus;
    
    if (!isEstimateEditable(currentStatus)) {
      const config = getEstimateStatusConfig(currentStatus);
      Alert.alert(
        'Edit Estimate', 
        `This estimate is currently marked as ${config.label}. Editing it may affect its status. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Edit Anyway', 
            onPress: () => {
              setIsTabBarVisible(false);
              router.push(`/estimates/create?id=${estimate.id}` as any);
            }
          }
        ]
      );
      return;
    }
    
    if (estimate.id) {
      setIsTabBarVisible(false);
      router.push(`/estimates/create?id=${estimate.id}` as any);
    }
  };

  const handleMoreOptions = () => {
    moreOptionsSheetRef.current?.present();
  };

  const handleViewHistory = () => {
    if (!estimate) return;
    console.log('[handleViewHistory] Opening history for estimate:', estimate.id);
    historyModalRef.current?.present(estimate.id, estimate.estimate_number || undefined);
  };

  const handleSend = () => {
    sendEstimateModalRef.current?.present();
  };

  const handleSendPDF = async () => {
    // Check if user is subscribed - sending is premium only
    if (!isSubscribed) {
      console.log('[handleSendPDF] Free user attempting to send - showing paywall');
      try {
        await registerPlacement({
          placement: PaywallServiceClass.EVENTS.SEND_BLOCK,
          params: {
            source: 'estimate_send_pdf',
            estimateId: estimate?.id,
            userId: user?.id
          }
        });
      } catch (error) {
        console.error('[handleSendPDF] Failed to show paywall:', error);
        Alert.alert('Premium Feature', 'Sending estimates requires a premium subscription.');
      }
      return;
    }

    if (!estimate || !businessSettings) {
      Alert.alert('Error', 'Cannot export PDF - estimate data not loaded');
      return;
    }

    try {
      const image = skiaEstimateRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot');
      }
      
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page { margin: 0; size: ${image.width()}px ${image.height()}px; }
            body { margin: 0; padding: 0; width: ${image.width()}px; height: ${image.height()}px; overflow: hidden; }
            .estimate-image { width: ${image.width()}px; height: ${image.height()}px; display: block; object-fit: none; }
          </style>
        </head>
        <body>
          <img src="data:image/png;base64,${image.encodeToBase64()}" class="estimate-image" alt="Estimate ${estimate.estimate_number}" />
        </body>
        </html>
      `;
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Update estimate status and log activity
      if (user && estimate.status !== 'sent') {
        const sendResult = await EstimateSenderService.sendEstimateByPDF(
          estimate.id,
          user.id,
          estimate.estimate_number || 'Unknown',
          supabase
        );

        if (sendResult.success) {
          // Update local state
          setEstimate(prev => prev ? { ...prev, status: 'sent' } : null);
        } else {
          console.warn('[handleSendPDF] Failed to update status:', sendResult.error);
        }
      }

      await Sharing.shareAsync(uri, { 
        mimeType: 'application/pdf', 
        dialogTitle: 'Share Estimate PDF' 
      });

      sendEstimateModalRef.current?.dismiss();
      
    } catch (error: any) {
      console.error('[handleSendPDF] Error:', error);
      Alert.alert('PDF Export Error', `Failed to export PDF: ${error.message}`);
    }
  };

  const handleSendByEmail = async () => {
    // Check if user is subscribed - sending is premium only
    if (!isSubscribed) {
      console.log('[handleSendByEmail] Free user attempting to send - showing paywall');
      try {
        await registerPlacement({
          placement: PaywallServiceClass.EVENTS.SEND_BLOCK,
          params: {
            source: 'estimate_send_email',
            estimateId: estimate?.id,
            userId: user?.id
          }
        });
      } catch (error) {
        console.error('[handleSendByEmail] Failed to show paywall:', error);
        Alert.alert('Premium Feature', 'Sending estimates requires a premium subscription.');
      }
      return;
    }

    if (!estimate || !businessSettings || !user) {
      Alert.alert('Error', 'Cannot send estimate - data not available');
      return;
    }

    try {
      // Update estimate status and log activity
      const sendResult = await EstimateSenderService.sendEstimateByEmail(
        estimate.id,
        user.id,
        estimate.estimate_number || 'Unknown',
        supabase
      );

      if (sendResult.success) {
        // Update local state
        setEstimate(prev => prev ? { ...prev, status: 'sent' } : null);
        Alert.alert('Success', sendResult.message || 'Estimate sent successfully');
      } else {
        Alert.alert('Error', sendResult.error || 'Failed to send estimate');
      }

      sendEstimateModalRef.current?.dismiss();
      
    } catch (error: any) {
      console.error('[handleSendByEmail] Error:', error);
      Alert.alert('Error', `Failed to send estimate: ${error.message}`);
    }
  };

  const handleSendByLink = async () => {
    // Check if user is subscribed - sending is premium only
    if (!isSubscribed) {
      console.log('[handleSendByLink] Free user attempting to send - showing paywall');
      try {
        await registerPlacement({
          placement: PaywallServiceClass.EVENTS.SEND_BLOCK,
          params: {
            source: 'estimate_send_link',
            estimateId: estimate?.id,
            userId: user?.id
          }
        });
      } catch (error) {
        console.error('[handleSendByLink] Failed to show paywall:', error);
        Alert.alert('Premium Feature', 'Sending estimates requires a premium subscription.');
      }
      return;
    }

    if (!estimate || !user) {
      Alert.alert('Error', 'Cannot send estimate - data not available');
      return;
    }

    try {
      // Update estimate status and log activity
      const sendResult = await EstimateSenderService.sendEstimateByLink(
        estimate.id,
        user.id,
        estimate.estimate_number || 'Unknown',
        supabase
      );

      if (sendResult.success) {
        // Update local state
        setEstimate(prev => prev ? { ...prev, status: 'sent' } : null);
        Alert.alert('Success', sendResult.message || 'Estimate link shared successfully');
      } else {
        Alert.alert('Error', sendResult.error || 'Failed to share estimate link');
      }

      sendEstimateModalRef.current?.dismiss();
      
    } catch (error: any) {
      console.error('[handleSendByLink] Error:', error);
    }
  };

  const handleDeleteEstimate = () => {
    moreOptionsSheetRef.current?.dismiss();
    Alert.alert(
      'Delete Estimate',
      'Are you sure you want to delete this estimate? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!estimate || !supabase) return;

            try {
              const { error: lineItemsError } = await supabase
                .from('estimate_line_items')
                .delete()
                .eq('estimate_id', estimate.id);

              if (lineItemsError) {
                Alert.alert('Error', 'Failed to delete estimate line items.');
                return;
              }

              const { error: estimateError } = await supabase
                .from('estimates')
                .delete()
                .eq('id', estimate.id);

              if (estimateError) {
                Alert.alert('Error', `Failed to delete estimate: ${estimateError.message}`);
                return;
              }

              Alert.alert('Estimate Deleted', 'The estimate has been permanently deleted.', [
                {
                  text: 'OK',
                  onPress: () => {
                    setIsTabBarVisible(true);
                    router.back();
                  }
                }
              ]);

            } catch (error: any) {
              Alert.alert('Error', 'An unexpected error occurred while deleting the estimate.');
            }
          }
        }
      ]
    );
  };

  const handleConvertToInvoice = async () => {
    if (!estimate || !user) {
      Alert.alert('Error', 'Cannot convert estimate at this time.');
      return;
    }

    // First, mark estimate as accepted if it's not already
    if (estimate.status !== 'accepted' && estimate.status !== 'converted') {
      try {
        const { error: statusError } = await supabase
          .from('estimates')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString()
          })
          .eq('id', estimate.id)
          .eq('user_id', user.id);

        if (statusError) {
          console.error('Error updating estimate status to accepted:', statusError);
          Alert.alert('Error', 'Failed to update estimate status');
          return;
        }

        // Update local state
        setEstimate(prev => prev ? { ...prev, status: 'accepted' } : null);
      } catch (error) {
        console.error('Error accepting estimate:', error);
        Alert.alert('Error', 'Failed to accept estimate');
        return;
      }
    }

    // Show confirmation dialog for conversion
    Alert.alert(
      'Convert to Invoice',
      `Are you sure you want to convert this estimate to an invoice?\n\nThis will:\n• Create a new invoice with the same details\n• Mark this estimate as "converted"\n• Take you to the new invoice`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Convert', 
          style: 'default',
          onPress: async () => {
            setIsConverting(true);
            
            try {
              const result = await EstimateConversionService.convertEstimateToInvoice(
                estimate.id,
                user.id
              );

              if (result.success && result.invoiceId) {
                // Log the conversion activity
                await logEstimateConverted(
                  estimate.id, 
                  estimate.estimate_number || undefined,
                  result.invoiceId,
                  result.invoiceNumber
                );

                // Update local state to show accepted status
                setEstimate(prev => prev ? { 
                  ...prev, 
                  status: 'accepted', 
                  is_accepted: true,
                  converted_to_invoice_id: result.invoiceId 
                } : null);

                // Force refresh the estimate data from database to ensure status is updated
                if (estimateId && user?.id) {
                  await fetchEstimateData(estimateId);
                }

                // Show success message
                Alert.alert(
                  'Conversion Successful',
                  result.message || 'Estimate has been converted to an invoice.',
                  [
                    {
                      text: 'View Invoice',
                      onPress: () => {
                        // Navigate to the invoice viewer and then to invoices dashboard
                        router.push({
                          pathname: '/(app)/(protected)/invoices/invoice-viewer',
                          params: { id: result.invoiceId }
                        });
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Conversion Failed', result.message || 'Failed to convert estimate to invoice.');
              }
            } catch (error) {
              console.error('Error converting estimate:', error);
              Alert.alert('Error', 'An unexpected error occurred while converting the estimate.');
            } finally {
              setIsConverting(false);
            }
          }
        },
      ]
    );
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.newTopSectionContainer, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerLeftContainer}>
              <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
              <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
            </TouchableOpacity>
          </View>
                  {/* Loading skeleton for action buttons */}
        <View style={styles.actionButtonsRow}>
          <View style={[styles.actionButton, { backgroundColor: themeColors.muted, borderColor: themeColors.border }]}>
            <View style={{ width: 20, height: 20, backgroundColor: themeColors.border, borderRadius: 4 }} />
            <View style={{ width: 30, height: 12, backgroundColor: themeColors.border, borderRadius: 2, marginLeft: 8 }} />
          </View>
          <View style={[styles.actionButton, { backgroundColor: themeColors.muted, borderColor: themeColors.border }]}>
            <View style={{ width: 20, height: 20, backgroundColor: themeColors.border, borderRadius: 4 }} />
            <View style={{ width: 40, height: 12, backgroundColor: themeColors.border, borderRadius: 2, marginLeft: 8 }} />
          </View>
          <View style={[styles.actionButton, { backgroundColor: themeColors.muted, borderColor: themeColors.border }]}>
            <View style={{ width: 20, height: 20, backgroundColor: themeColors.border, borderRadius: 4 }} />
            <View style={{ width: 30, height: 12, backgroundColor: themeColors.border, borderRadius: 2, marginLeft: 8 }} />
          </View>
        </View>
        </View>
        
        {/* Skeleton in ScrollView area - same as loaded state */}
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollViewContent, { backgroundColor: themeColors.border }]} 
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center', paddingTop: -10 }}> 
            <InvoiceSkeletonLoader />
          </View>
        </ScrollView>

        {/* Footer section - always rendered like invoice viewer */}
        <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: themeColors.card }]}>
          <View style={styles.estimateDetailsBottomContainer}>
            <View style={styles.estimateNumberAndTotalRow}>
              <Text style={[styles.estimateNumberDisplay, { color: themeColors.foreground }]}>
                {estimate?.estimate_number}
              </Text>
              <Text style={[styles.estimateTotalDisplay, { color: themeColors.foreground }]}>
                {`${estimate?.currency_symbol || '$'}${(estimate?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
            <View style={styles.clientAndStatusRow}>
              <Text style={[styles.clientNameDisplay, { color: themeColors.mutedForeground }]}>
                {client?.name}
              </Text>
              <View style={styles.statusToggleContainer}>
                <Switch
                  trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
                  thumbColor={(estimate?.is_accepted || estimate?.status === 'converted') ? themeColors.primary : themeColors.card}
                  ios_backgroundColor={themeColors.muted}
                  onValueChange={async (isAccepted) => {
                    if (isAccepted && !estimate?.is_accepted && estimate?.status !== 'converted') {
                      // Handle convert to invoice
                      handleConvertToInvoice();
                    } else if (!isAccepted && estimate?.status === 'converted') {
                      // Handle unconvert (toggle back from converted to accepted)
                      Alert.alert(
                        'Unconvert Estimate',
                        'Are you sure you want to revert this estimate back to accepted status? This will not affect the invoice that was already created.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Revert', 
                            style: 'default',
                            onPress: async () => {
                              try {
                                const { error } = await supabase
                                  .from('estimates')
                                  .update({
                                    status: 'accepted',
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', estimate.id)
                                  .eq('user_id', user?.id);

                                if (error) {
                                  console.error('Error reverting estimate status:', error);
                                  Alert.alert('Error', 'Failed to revert estimate status');
                                  return;
                                }

                                // Update local state
                                setEstimate(prev => prev ? { 
                                  ...prev, 
                                  status: 'accepted'
                                } : null);
                              } catch (error) {
                                console.error('Error reverting estimate:', error);
                                Alert.alert('Error', 'An unexpected error occurred');
                              }
                            }
                          }
                        ]
                      );
                    }
                  }}
                  value={estimate?.is_accepted || estimate?.status === 'converted'}
                  style={styles.statusSwitch}
                  disabled={isConverting}
                />
                <Text style={[styles.statusToggleValue, { color: estimate?.is_accepted || estimate?.status === 'converted' ? themeColors.primary : themeColors.foreground }]}>
                  {estimate?.status === 'converted' ? 'Converted' : estimate?.is_accepted ? 'Accepted' : 'Convert\nto invoice'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.primaryButton,
              {
                backgroundColor: themeColors.primary,
              },
            ]}
            onPress={handleSend}
          >
            <Send size={20} color={themeColors.primaryForeground} style={{ marginRight: 8 }}/>
            <Text style={[styles.primaryButtonText, { color: themeColors.primaryForeground }]}>
              {estimate?.status === 'draft' 
                ? `Send ${businessSettings?.estimate_terminology === 'quote' ? 'Quote' : 'Estimate'}` 
                : `Resend ${businessSettings?.estimate_terminology === 'quote' ? 'Quote' : 'Estimate'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !estimate) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.newTopSectionContainer, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerLeftContainer}>
              <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
              <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.centeredMessageContainer}>
          <Text style={[styles.errorText, { color: themeColors.destructive }]}>
            {error || 'Estimate not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BottomSheetModalProvider>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header Section */}
        <View style={[styles.newTopSectionContainer, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <View style={styles.topRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerLeftContainer}>
              <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
              <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
            </TouchableOpacity>
            
            <View style={styles.statusIndicatorContainer}>
              <StatusBadge 
                status={(estimate?.status || 'draft') as EstimateStatus} 
                size="medium" 
              />
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} 
              onPress={handleEdit} 
            >
              <Edit3 size={20} color={themeColors.primary} />
              <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} 
              onPress={handleViewHistory}
            >
              <History size={20} color={themeColors.primary} />
              <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} 
              onPress={handleMoreOptions} 
            >
              <MoreHorizontal size={20} color={themeColors.primary} />
              <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>More</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Estimate Canvas */}
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={[styles.scrollViewContent, { backgroundColor: themeColors.border }]} 
          showsVerticalScrollIndicator={false}
        >
          {isEstimateReady ? (
            <View style={{ alignItems: 'center', marginTop: -30 }}>
              <View style={{
                transform: [{ scale: 0.882 }],
                marginLeft: -175,
              }}>
                <EstimateDesignComponent
                  ref={skiaEstimateRef}
                  invoice={{
                    ...estimate,
                    // Transform estimate fields to invoice fields for Skia canvas compatibility
                    invoice_number: estimate?.estimate_number,
                    invoice_date: estimate?.estimate_date,
                    due_date: estimate?.valid_until_date,
                    invoice_line_items: estimate?.estimate_line_items, // Key transformation
                  }}
                  client={client}
                  business={businessSettings}
                  currencySymbol={currencySymbol}
                  accentColor={getAccentColor()}
                  documentType="estimate"
                  estimateTerminology={businessSettings?.estimate_terminology || 'estimate'}
                  renderSinglePage={0}
                  displaySettings={{
                    show_business_logo: businessSettings?.show_business_logo ?? true,
                    show_business_name: businessSettings?.show_business_name ?? true,
                    show_business_address: businessSettings?.show_business_address ?? true,
                    show_business_tax_number: businessSettings?.show_business_tax_number ?? true,
                    show_notes_section: businessSettings?.show_notes_section ?? true,
                  }}
                  style={{ 
                    width: 200, 
                    height: 295,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 3,
                  }}
                />
              </View>
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingTop: -10 }}> 
              <InvoiceSkeletonLoader />
            </View>
          )}
        </ScrollView>

        {/* Bottom Action Section */}
        <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: themeColors.card }]}>
          <View style={styles.estimateDetailsBottomContainer}>
            <View style={styles.estimateNumberAndTotalRow}>
              <Text style={[styles.estimateNumberDisplay, { color: themeColors.foreground }]}>
                {estimate?.estimate_number}
              </Text>
              <Text style={[styles.estimateTotalDisplay, { color: themeColors.foreground }]}>
                {`${estimate?.currency_symbol}${(estimate?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
            </View>
            <View style={styles.clientAndStatusRow}>
              <Text style={[styles.clientNameDisplay, { color: themeColors.mutedForeground }]}>
                {client?.name}
              </Text>
              <View style={styles.statusToggleContainer}>
                <Switch
                  trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
                  thumbColor={(estimate?.is_accepted || estimate?.status === 'converted') ? themeColors.primary : themeColors.card}
                  ios_backgroundColor={themeColors.muted}
                  onValueChange={async (isAccepted) => {
                    if (isAccepted && !estimate?.is_accepted && estimate?.status !== 'converted') {
                      // Handle convert to invoice
                      handleConvertToInvoice();
                    } else if (!isAccepted && estimate?.status === 'converted') {
                      // Handle unconvert (toggle back from converted to accepted)
                      Alert.alert(
                        'Unconvert Estimate',
                        'Are you sure you want to revert this estimate back to accepted status? This will not affect the invoice that was already created.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Revert', 
                            style: 'default',
                            onPress: async () => {
                              try {
                                const { error } = await supabase
                                  .from('estimates')
                                  .update({
                                    status: 'accepted',
                                    is_accepted: true,
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', estimate.id)
                                  .eq('user_id', user?.id);

                                if (error) {
                                  console.error('Error reverting estimate status:', error);
                                  Alert.alert('Error', 'Failed to revert estimate status');
                                  return;
                                }

                                // Update local state
                                setEstimate(prev => prev ? { 
                                  ...prev, 
                                  status: 'accepted',
                                  is_accepted: true
                                } : null);
                              } catch (error) {
                                console.error('Error reverting estimate:', error);
                                Alert.alert('Error', 'An unexpected error occurred');
                              }
                            }
                          }
                        ]
                      );
                    } else if (!isAccepted && estimate?.status === 'accepted') {
                      // Handle toggle back from accepted to previous status
                      const previousStatus = getPreviousStatus('accepted');
                      const statusLabel = previousStatus.charAt(0).toUpperCase() + previousStatus.slice(1);
                      
                      Alert.alert(
                        'Revert Estimate',
                        'Are you sure you want to revert this estimate back to "Sent" status?',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { 
                            text: 'Revert to Sent', 
                            style: 'default',
                            onPress: async () => {
                              try {
                                const { error } = await supabase
                                  .from('estimates')
                                  .update({
                                    status: 'sent',
                                    is_accepted: false,
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', estimate.id)
                                  .eq('user_id', user?.id);

                                if (error) {
                                  console.error('Error reverting estimate status:', error);
                                  Alert.alert('Error', 'Failed to revert estimate status');
                                  return;
                                }

                                // Log the status change activity
                                logStatusChanged(estimate.id, estimate.estimate_number || undefined, 'accepted', 'sent');

                                // Update local state
                                setEstimate(prev => prev ? { 
                                  ...prev, 
                                  status: 'sent',
                                  is_accepted: false
                                } : null);
                              } catch (error) {
                                console.error('Error reverting estimate:', error);
                                Alert.alert('Error', 'An unexpected error occurred');
                              }
                            }
                          }
                        ]
                      );
                    }
                  }}
                  value={estimate?.is_accepted || estimate?.status === 'converted'}
                  style={styles.statusSwitch}
                  disabled={isConverting}
                />
                <Text style={[styles.statusToggleValue, { color: estimate?.is_accepted || estimate?.status === 'converted' ? themeColors.primary : themeColors.foreground }]}>
                  {estimate?.status === 'converted' ? 'Converted' : estimate?.is_accepted ? 'Accepted' : 'Convert\nto Invoice'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: themeColors.primary }]}
            onPress={handleSend}
          >
            <Send size={20} color={themeColors.primaryForeground} style={{ marginRight: 8 }}/>
            <Text style={[styles.primaryButtonText, { color: themeColors.primaryForeground }]}>
              {estimate?.status === 'draft' 
                ? `Send ${businessSettings?.estimate_terminology === 'quote' ? 'Quote' : 'Estimate'}` 
                : `Resend ${businessSettings?.estimate_terminology === 'quote' ? 'Quote' : 'Estimate'}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Send Estimate Modal */}
        <BottomSheetModal
          ref={sendEstimateModalRef}
          index={0}
          snapPoints={['35%']}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
          backgroundStyle={{ backgroundColor: themeColors.card }}
        >
          <BottomSheetView style={styles.modalContentContainer}> 
            <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center', color: themeColors.foreground }]}>
                Send {businessSettings?.estimate_terminology === 'quote' ? 'Quote' : 'Estimate'}
              </Text>
              <TouchableOpacity onPress={() => sendEstimateModalRef.current?.dismiss()} style={{ padding: 4 }}>
                <XIcon size={24} color={themeColors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendByEmail}>
              <Mail size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
              <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send by Email</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: themeColors.border, marginLeft: 16 }} />

            <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendByLink}>
              <Link2 size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
              <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send Link</Text>
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: themeColors.border, marginLeft: 16 }} />

            <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendPDF}>
              <Share2 size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
              <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Export & Share PDF</Text>
            </TouchableOpacity>
          </BottomSheetView>
        </BottomSheetModal>

        {/* More Options Modal */}
        <BottomSheetModal
          ref={moreOptionsSheetRef}
          snapPoints={['40%']}
          backdropComponent={renderBackdrop}
          handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
          backgroundStyle={{ backgroundColor: themeColors.card }}
        >
          <BottomSheetView style={[styles.moreOptionsContainer, { backgroundColor: themeColors.card }]}>
            <View style={[styles.moreOptionsHeader, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.moreOptionsTitle, { color: themeColors.foreground }]}>
                More Options
              </Text>
              <TouchableOpacity 
                onPress={() => moreOptionsSheetRef.current?.dismiss()}
                style={styles.closeButton}
              >
                <MoreHorizontal size={24} color={themeColors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.moreOptionsContent} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.moreOptionItem} onPress={handleDeleteEstimate}>
                <View style={styles.moreOptionLeft}>
                  <Trash2 size={20} color="#DC2626" style={styles.moreOptionIcon} />
                  <Text style={[styles.moreOptionTitle, { color: "#DC2626" }]}>
                    Delete Estimate
                  </Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </BottomSheetView>
        </BottomSheetModal>

        {/* Estimate History Modal */}
        <EstimateHistorySheet
          ref={historyModalRef}
          onClose={() => console.log('Estimate History Modal Dismissed')}
        />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  newTopSectionContainer: { 
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 0, 
    paddingBottom: 12, 
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.5,
    elevation: 3,           
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    width: '100%',
  },
  headerLeftContainer: {
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 8, 
  },
  backButtonText: { 
    fontSize: 17,
    marginLeft: 6,
  },
  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto', 
  },
  actionButtonsRow: { 
    flexDirection: 'row',
    justifyContent: 'center', 
    marginTop: 10, 
    marginBottom: 10, 
  },
  actionButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center', 
    width: 120, 
    marginHorizontal: 5, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30, 
    shadowRadius: 4.65, 
    elevation: 8, 
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14, 
    fontWeight: 'bold', 
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: { 
    flexGrow: 1,
    paddingTop: 10,
    paddingBottom: 200,
    paddingHorizontal: 10,
  },
  centered: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredMessageContainer: { 
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: { 
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  actionBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, 
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
  estimateDetailsBottomContainer: { 
    marginBottom: 16, 
  },
  estimateNumberAndTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', 
    marginBottom: 0, 
  },
  estimateNumberDisplay: {
    fontSize: 22, 
    fontWeight: 'bold',
  },
  estimateTotalDisplay: { 
    fontSize: 16, 
    fontWeight: 'bold', 
  },
  clientAndStatusRow: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8, 
  },
  clientNameDisplay: { 
    fontSize: 14, 
  },
  statusToggleContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusSwitch: { 
    transform: Platform.OS === 'ios' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [], 
    marginRight: 8,
  },
  statusToggleValue: { 
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row', 
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContentContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12, 
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  modalOptionIcon: {
    marginRight: 16,
  },
  modalOptionText: {
    fontSize: 16,
  },
  moreOptionsContainer: {
    flex: 1,
  },
  moreOptionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moreOptionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 6,
  },
  moreOptionsContent: {
    flex: 1,
    paddingTop: 8,
  },
  moreOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  moreOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moreOptionIcon: {
    marginRight: 12,
  },
  moreOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
});

export default EstimateViewerScreen; 
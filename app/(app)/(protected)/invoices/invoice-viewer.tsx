import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
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
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import { ArrowLeft, Edit3, MoreHorizontal, Clock, Send, Maximize, ChevronLeft, History } from 'lucide-react-native'; 
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider'; 
import type { Database, Json, Tables } from '../../../../types/database.types'; 
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from './InvoiceTemplateOne'; 
import InvoiceSkeletonLoader from '@/components/InvoiceSkeletonLoader'; // Import the skeleton loader
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Mail, Link, FileText, X as XIcon } from 'lucide-react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf'; // Added import
import Share from 'react-native-share'; // Added import
import { generateInvoiceTemplateOneHtml } from '../../../utils/generateInvoiceTemplateOneHtml'; // Updated function and file name

type ClientRow = Tables<'clients'>;

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

interface PreviewLineItem {
  id: string; 
  user_saved_item_id?: string | null;
  item_name: string;
  description?: string | null; 
  quantity: number;
  unit_price: number; 
  total_price: number;
  line_item_discount_type?: 'percentage' | 'fixed' | null;
  line_item_discount_value?: number | null;
  item_image_url?: string | null;
}

interface PreviewInvoiceData {
  invoice_number: string;
  client_id: string | null; 
  clientName?: string; 
  invoice_date: string; 
  due_date: string | null; 
  due_date_option: string | null;
  items: PreviewLineItem[];
  po_number?: string;
  custom_headline?: string;
  taxPercentage?: number | null;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  subTotalAmount?: number; 
  totalAmount?: number;    
  notes?: string;
  payment_instructions_active_on_invoice?: boolean; 
  bank_account_active_on_invoice?: boolean;     
  paypal_active_on_invoice?: boolean;         
  stripe_active_on_invoice?: boolean;           
  currency: string; 
}

interface PdfInvoiceData {
  invoice: InvoiceForTemplate & { payment_terms?: string };
  businessSettings: BusinessSettingsRow;
  paymentOptions: any; // Add the missing paymentOptions property
}

const preparePdfData = (invoiceData: InvoiceForTemplate, businessSettingsData: BusinessSettingsRow, paymentOptionsData: any = null): PdfInvoiceData => {
  const htmlInvoiceData: InvoiceForTemplate & { payment_terms?: string } = {
    ...invoiceData, 
    payment_terms: 'Payment due upon receipt.', 
  };

  return {
    invoice: htmlInvoiceData,
    businessSettings: businessSettingsData,
    paymentOptions: paymentOptionsData, // Include the paymentOptions
  };
};

function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const { id: invoiceId, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { supabase } = useSupabase(); 

  const [invoice, setInvoice] = useState<InvoiceForTemplate | null>(null);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewingFromCreate, setIsPreviewingFromCreate] = useState(false); 
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Ref for the Send Invoice Modal
  const sendInvoiceModalRef = useRef<BottomSheetModal>(null);

  // Snap points for the Send Invoice Modal
  const sendInvoiceSnapPoints = useMemo(() => ['35%', '50%'], []); // Adjust as needed

  const { setIsTabBarVisible } = useTabBarVisibility(); // Use the context

  // Simplified tab bar management - dashboard already hides it before navigation
  // Just ensure it stays hidden and show it when leaving
  useFocusEffect(
    useCallback(() => {
      console.log('[InvoiceViewerScreen] FocusEffect: Ensuring tab bar stays hidden.');
      // No need to hide again since dashboard already did it before navigation
      // Just ensure it stays hidden in case something shows it
      setIsTabBarVisible(false);
      
      return () => {
        console.log('[InvoiceViewerScreen] FocusEffect cleanup: Showing tab bar.');
        setIsTabBarVisible(true); // Show tab bar when leaving
      };
    }, [setIsTabBarVisible])
  );

  const handleOpenSendModal = useCallback(() => {
    sendInvoiceModalRef.current?.present();
  }, []);

  // Callback to close the Send Invoice Modal
  const handleCloseSendModal = useCallback(() => {
    sendInvoiceModalRef.current?.dismiss();
  }, []);

  // Placeholder actions for modal options
  const handleSendByEmail = () => {
    console.log('Send by Email selected');
    handleCloseSendModal();
  };

  const handleSendLink = () => {
    console.log('Send Link selected');
    handleCloseSendModal();
  };

  const handleSendPDF = async () => {
    if (!invoice || !businessSettings) {
      Alert.alert('Error', 'Invoice or business data not loaded.');
      handleCloseSendModal();
      return;
    }

    const dataForHtml = preparePdfData(invoice, businessSettings, businessSettings);

    try {
      const html = generateInvoiceTemplateOneHtml(dataForHtml); 
      const pdfOptions = {
        html,
        fileName: `Invoice-${invoice.invoice_number || 'details'}`,
        directory: 'Invoices',
        width: 595, // A4 width in points
        height: 842, // A4 height in points
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        bgColor: '#FFFFFF',
      };
      const file = await RNHTMLtoPDF.convert(pdfOptions);
      await Share.open({ url: Platform.OS === 'android' ? 'file://' + file.filePath : file.filePath, title: 'Share Invoice PDF' });
    } catch (error: any) { 
      console.error('Error in handleSendPDF:', error);
      Alert.alert('PDF Error', `Failed: ${error.message}`);
    }
    handleCloseSendModal();
  };

  // Custom backdrop for the modal
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5} // Standard dimming
      />
    ),
    []
  );

  const navigation = useNavigation(); // Added

  const handleCustomBack = () => {
    console.log('[handleCustomBack] Called with from parameter:', from);
    
    // IMPORTANT: Navigation flow fix for create → preview → back
    // Problem: Dashboard → Create → Preview → Back was going to Dashboard ❌
    // Solution: Dashboard → Create → Preview → Back now goes to Create ✅
    // Check if user came from create/preview flow and should go back to create/edit
    if (from === 'new_preview' || from === 'draft_preview') {
      // User came from create mode preview - navigate back to create/edit screen
      console.log('[handleCustomBack] Coming from create preview - navigating back to create/edit with invoice ID:', invoiceId);
      
      if (invoiceId) {
        // Navigate back to create/edit screen with the invoice ID
        // Use router.push to maintain proper navigation stack and transition direction
        router.push(`/invoices/create?id=${invoiceId}` as any);
      } else {
        console.warn('[handleCustomBack] No invoice ID available for navigation back to create');
        // Fallback to dashboard
        router.back();
      }
    } else {
      // Default behavior for other cases (dashboard navigation, etc.)
      console.log('[handleCustomBack] Default navigation behavior');
      // Use router.back() for proper left-to-right transition direction
      // DO NOT CHANGE TO router.replace() - this breaks transition direction
      // Only change if explicitly requested by user
      router.back();
    }
  };

  const fetchBusinessSettings = async (userId: string) => {
    console.log('[fetchBusinessSettings] Function called with userId:', userId); 
    if (!userId) {
      console.error('[fetchBusinessSettings] No userId provided.');
      return;
    }

    try {
      const { data, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single(); 

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('[fetchBusinessSettings] Error fetching base business settings:', settingsError);
        setError('Failed to load business settings.');
        setBusinessSettings(null); 
      } else {
        console.log('[fetchBusinessSettings] Raw data from business_settings table:', data);
        // 'data' here is the result from business_settings query
        if (data) {
          // Now fetch payment_options for the same user
          const { data: paymentOpts, error: paymentOptsError } = await supabase
            .from('payment_options') 
            .select('*')
            .eq('user_id', userId) 
            .single();

          console.log('[fetchBusinessSettings] Raw data from payment_options table:', paymentOpts);

          if (paymentOptsError && paymentOptsError.code !== 'PGRST116') {
            console.error('[fetchBusinessSettings] Error fetching payment options:', paymentOptsError);
            // Continue with base settings even if payment options fail, or handle error as preferred
          }

          // Merge paymentOpts into the base business settings data.
          // If paymentOpts is null (not found or error), it won't add/overwrite properties from 'data'.
          const combinedSettings = { ...data, ...(paymentOpts || {}) };
          console.log('[fetchBusinessSettings] Combined settings before setBusinessSettings:', combinedSettings);
          setBusinessSettings(combinedSettings as BusinessSettingsRow); 
        } else {
          // No base business_settings found (PGRST116 or data was null from first query)
          console.log('[fetchBusinessSettings] No base business settings found for this user. Setting to null.');
          setBusinessSettings(null);
        }
      }
    } catch (e: any) {
      console.error('[fetchBusinessSettings] Exception fetching business settings:', e.message);
      setError('An unexpected error occurred while fetching business settings.');
      setBusinessSettings(null);
    }
  };

  const fetchInvoiceData = async (invoiceId: string): Promise<Database['public']['Tables']['invoices']['Row'] | null> => {
    setIsLoading(true);
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (*),
          invoice_line_items (*)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) {
        console.error('[fetchInvoiceData] Supabase invoiceError:', invoiceError);
        setError('Failed to load invoice data.');
        setInvoice(null);
        setIsLoading(false);
        return null;
      }

      if (!invoiceData) {
        setError('Invoice not found.');
        setInvoice(null);
        setIsLoading(false);
        return null;
      }
      
      console.log('[fetchInvoiceData] Raw invoiceData from Supabase:', invoiceData);
      console.log('[fetchInvoiceData] invoiceData.clients:', invoiceData.clients);
      console.log('[fetchInvoiceData] invoiceData.invoice_line_items from Supabase:', invoiceData.invoice_line_items);

      // Fetch business_settings specifically for currency information for this invoice instance
      // This does NOT set the main businessSettings state used for payment methods display.
      const { data: businessDataForCurrency, error: businessError } = await supabase
        .from('business_settings')
        .select('currency_code') // Only select currency_code
        .eq('user_id', invoiceData.user_id)
        .single();

      if (businessError && businessError.code !== 'PGRST116') { // PGRST116: no rows found, which is okay if settings don't exist yet
        console.error('[fetchInvoiceData] Error fetching business_settings for currency:', businessError);
      }

      // Explicitly type as InvoiceForTemplate
      const fetchedInvoiceForTemplate: InvoiceForTemplate = {
        ...invoiceData,
        invoice_number: invoiceData.invoice_number ?? '', 
        clients: invoiceData.clients as Tables<'clients'> | null, // Align with InvoiceForTemplate type
        invoice_line_items: invoiceData.invoice_line_items as Tables<'invoice_line_items'>[], // Align with InvoiceForTemplate type
        currency: businessDataForCurrency?.currency_code || 'USD', 
        currency_symbol: getCurrencySymbol(businessDataForCurrency?.currency_code || 'USD'),
        // Add missing invoice_tax_label, ensuring it's a string
        invoice_tax_label: invoiceData.invoice_tax_label || 'Tax', 
      };
      
      console.log('[fetchInvoiceData] Constructed fetchedInvoiceForTemplate:', JSON.stringify(fetchedInvoiceForTemplate, null, 2));
      setInvoice(fetchedInvoiceForTemplate);
      if (invoiceData.clients) {
        setClient(invoiceData.clients as ClientRow);
      }
      setError(null);
      setIsLoading(false);
      return fetchedInvoiceForTemplate;
    } catch (e: any) {
      console.error('[fetchInvoiceData] Exception:', e.message);
      setError('An unexpected error occurred while fetching invoice data.');
      setInvoice(null);
      setIsLoading(false);
      return null;
    }
  };

  useEffect(() => {
    console.log(`[EFFECT START] InvoiceViewerScreen useEffect triggered.`);
    console.log(`[EFFECT PARAMS] id: ${invoiceId}`);
    setIsLoading(true); // Start loading

    const processData = async () => {
      if (invoiceId) {
        console.log('[InvoiceViewerScreen useEffect] Attempting to call fetchInvoiceData with invoiceId:', invoiceId); 
        try {
          const fetchedInvoice = await fetchInvoiceData(invoiceId);
          if (fetchedInvoice && fetchedInvoice.user_id) {
            const targetUserId = fetchedInvoice.user_id;
            console.log('[InvoiceViewerScreen useEffect] Attempting to call fetchBusinessSettings with targetUserId (from fetched invoiceData):', targetUserId); 
            if (targetUserId) await fetchBusinessSettings(targetUserId); // Await this operation too
          }
        } catch (error) {
          console.error('[processData] Error:', error);
          setError('Failed to load invoice data.');
        } finally {
          setIsLoading(false); // End loading after all async operations complete
        }
      } else {
        console.warn("[EFFECT] No invoice ID. Cannot load invoice.");
        setError('No invoice specified.');
        setIsLoading(false);
      }
    };

    processData();
  }, [invoiceId, supabase]);

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

  const addAlpha = (color: string, opacity: number): string => {
    if (typeof color !== 'string' || !color.startsWith('#') || (color.length !== 7 && color.length !== 4)) {
      console.warn(`addAlpha: Color "${color}" is not a valid hex string. Opacity may not apply correctly.`);
      return color; 
    }
    const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
    let hexOpacity = _opacity.toString(16).toUpperCase();
    if (hexOpacity.length === 1) {
      hexOpacity = '0' + hexOpacity;
    }
    return color.slice(0, 7) + hexOpacity; 
  };

  interface StatusStyles {
    badgeStyle: ViewStyle;
    textStyle: TextStyle;
  }

  const getStatusBadgeStyle = (status?: string | null): StatusStyles => {
    const badgeStyle: ViewStyle = {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColors.border,      
      backgroundColor: themeColors.card,    
    };
    const textStyle: TextStyle = {
      fontSize: 12,
      fontWeight: '500',
      color: themeColors.foreground, 
    };

    switch (status?.toLowerCase() || 'draft') {
      case 'draft':
        badgeStyle.borderColor = addAlpha(themeColors.destructive, 0.40);
        badgeStyle.backgroundColor = addAlpha(themeColors.destructive, 0.10);
        textStyle.color = themeColors.destructive;
        break;
      case 'sent':
      case 'viewed':
        badgeStyle.borderColor = addAlpha(themeColors.statusPaid, 0.7);
        badgeStyle.backgroundColor = addAlpha(themeColors.statusPaid, 0.15); 
        textStyle.color = themeColors.statusPaid;
        break;
      case 'paid':
        badgeStyle.borderColor = themeColors.statusPaid;
        badgeStyle.backgroundColor = addAlpha(themeColors.statusPaid, 0.15); 
        textStyle.color = themeColors.statusPaid;
        break;
      case 'overdue':
        badgeStyle.borderColor = themeColors.statusDue; 
        badgeStyle.backgroundColor = addAlpha(themeColors.statusDue, 0.15);
        textStyle.color = themeColors.statusDue; 
        break;
      case 'cancelled':
        badgeStyle.borderColor = themeColors.destructive; 
        badgeStyle.backgroundColor = addAlpha(themeColors.destructive, 0.15);
        textStyle.color = themeColors.destructive; 
        break;
      default:
        break;
    }
    return { badgeStyle, textStyle };
  };

  const invoiceStatus = invoice?.status?.toLowerCase() || 'draft';
  const statusStyle = getStatusBadgeStyle(invoice?.status);
  
  const handlePrimaryAction = () => {
    if (isPreviewingFromCreate) return; 
    if (!invoice) return;
    console.log('Primary action pressed for invoice:', invoice.id);
  };

  const handleEdit = () => {
    if (isPreviewingFromCreate) return; 
    if (invoice && invoice.id) {
      // Hide tab bar before navigation like the working pattern
      setIsTabBarVisible(false);
      router.push(`/invoices/create?id=${invoice.id}` as any);
    } else {
      console.warn('Edit pressed but no invoice ID found');
      Alert.alert('Error', 'Cannot edit invoice without a valid ID.');
    }
  };

  const handleTogglePaid = (isPaid: boolean) => {
    if (invoice) {
      Alert.alert('Status Update', `Invoice marked as ${isPaid ? 'Paid' : 'Not Paid (Sent)'}. (DB update pending)`);
    }
  };

  const handleMoreOptions = () => {
    Alert.alert('Modal Coming Soon', 'More options modal will be available soon.');
  };

  const handleSendInvoice = () => {
    if (!invoice) return;
    if (invoice.status === 'draft') {
      Alert.alert('Send Invoice', 'Sending invoice...'); 
    } else if (invoice.status === 'sent' || invoice.status === 'overdue') {
      Alert.alert('Resend Invoice', 'Resending invoice...'); 
    }
  };

  const handleViewHistory = () => {
    Alert.alert('History', 'History functionality coming soon!');
  };
  
  const getStyles = (themeColors: any) => StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: { 
      flex: 1,
      padding: 16,
      paddingHorizontal: 16, 
    },
    centered: { 
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: { 
      flexGrow: 1,
      paddingHorizontal: 0, 
      paddingTop: 0, 
      paddingBottom: 200, 
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
    statusLabelText: {
      fontSize: 14,
      fontWeight: '500',
    },
    statusValueText: {
      fontSize: 14,
      fontWeight: '600',
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
      shadowOffset: {
        width: 0,
        height: 4, 
      },
      shadowOpacity: 0.30, 
      shadowRadius: 4.65, 
      elevation: 8, 
    },
    actionButtonText: {
      marginLeft: 8,
      fontSize: 14, 
      color: '#000000', 
      fontWeight: 'bold', 
    },
    invoiceNumberAndTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start', 
      marginBottom: 0, 
    },
    invoiceNumberDisplay: {
      fontSize: 22, 
      fontWeight: 'bold',
    },
    invoiceTotalDisplay: { 
      fontSize: 16, 
      fontWeight: 'bold', 
    },
    clientNameDisplay: { 
      fontSize: 14, 
    },
    clientAndStatusRow: { 
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8, 
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
    actionBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16, 
      borderTopWidth: StyleSheet.hairlineWidth,
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
    invoiceDetailsBottomContainer: { 
      marginBottom: 16, 
    },
    disabledButton: {
      opacity: 0.5, 
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
    button: { 
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { 
      fontSize: 16,
      fontWeight: '500',
    },
    modalContentContainer: {
      flex: 1,
      // backgroundColor: theme.card, // Handled by backgroundStyle on BottomSheetModal
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12, 
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
      backgroundColor: themeColors.card, // Ensure header has bg for consistency
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.foreground,
    },
    modalOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16, // Increased padding for better touch
      paddingHorizontal: 16,
    },
    modalOptionIcon: {
      marginRight: 16, // Increased spacing
    },
    modalOptionText: {
      fontSize: 16,
      color: themeColors.foreground,
    },
    modalSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: themeColors.border,
      marginLeft: 16, // Indent separator if desired, or remove for full width
    },
  });

  const styles = getStyles(themeColors);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <View style={[
        styles.newTopSectionContainer,
        { 
          backgroundColor: themeColors.card, 
          borderBottomColor: themeColors.border 
        }
      ]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleCustomBack} style={styles.headerLeftContainer}>
            <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
            <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
          </TouchableOpacity>
          
          <View style={styles.statusIndicatorContainer}>
            <View style={[{ backgroundColor: statusStyle.badgeStyle.backgroundColor, borderColor: statusStyle.badgeStyle.borderColor, borderWidth: statusStyle.badgeStyle.borderWidth, paddingVertical: statusStyle.badgeStyle.paddingVertical, paddingHorizontal: statusStyle.badgeStyle.paddingHorizontal, borderRadius: statusStyle.badgeStyle.borderRadius }]}>
              <Text style={[styles.statusValueText, statusStyle.textStyle]}>
                {invoiceStatus === 'draft' ? 'Not Sent' : (invoiceStatus.charAt(0).toUpperCase() + invoiceStatus.slice(1))}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }, isPreviewingFromCreate && styles.disabledButton]} 
            onPress={handleEdit} 
            disabled={isPreviewingFromCreate}
          >
            <Edit3 size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }, isPreviewingFromCreate && styles.disabledButton]} 
            onPress={handleViewHistory}
            disabled={isPreviewingFromCreate}
          >
            <History size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }, isPreviewingFromCreate && styles.disabledButton]} 
            onPress={handleMoreOptions} 
            disabled={isPreviewingFromCreate} 
          >
            <MoreHorizontal size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary }]}>More</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollViewContent, { backgroundColor: themeColors.border, paddingTop: 0, paddingBottom: 200 }]} 
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={{ alignItems: 'center', paddingTop: 20 }}> 
            <InvoiceSkeletonLoader />
          </View>
        ) : error ? (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : invoice ? (
          <View style={{ flex: 1, alignItems: 'center' }}>
            <InvoiceTemplateOne
              invoice={invoice} // invoice is InvoiceForTemplate | null
              clientName={client?.name || invoice.clients?.name || 'N/A'} // Get client name from client state or embedded in invoice
              businessSettings={businessSettings} // businessSettings is BusinessSettingsRow | null
            />
          </View>
        ) : (
          <View style={styles.centeredMessageContainer}>
            <Text style={{ color: themeColors.mutedForeground }}>No invoice data available.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: themeColors.card }]}>
        <View style={styles.invoiceDetailsBottomContainer}>
          <View style={styles.invoiceNumberAndTotalRow}>
            <Text style={[styles.invoiceNumberDisplay, { color: themeColors.foreground }]}>
              {invoice?.invoice_number}
            </Text>
            <Text style={[styles.invoiceTotalDisplay, { color: themeColors.foreground }]}>
              {`${invoice?.currency_symbol}${(invoice?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
          </View>
          <View style={styles.clientAndStatusRow}>
            <Text style={[styles.clientNameDisplay, { color: themeColors.mutedForeground }]}>
              {client?.name}
            </Text>
            <View style={styles.statusToggleContainer}>
              <Switch
                trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
                thumbColor={invoice?.status === 'paid' ? themeColors.primary : themeColors.card}
                ios_backgroundColor={themeColors.muted}
                onValueChange={(isPaid) => {
                  handleTogglePaid(isPaid);
                }}
                value={invoice?.status === 'paid'}
                style={styles.statusSwitch}
              />
              <Text style={[styles.statusToggleValue, { color: invoice?.status === 'paid' ? themeColors.primary : themeColors.foreground }]}>
                {invoice?.status === 'paid' ? 'Paid' : 'Unpaid'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[
            styles.primaryButton,
            {
              backgroundColor: invoice?.status === 'paid' ? themeColors.muted : themeColors.primary,
              opacity: invoice?.status === 'paid' ? 0.5 : 1, // Explicitly set opacity
            },
          ]}
          onPress={handleOpenSendModal} // Updated to open the modal
          disabled={invoice?.status === 'paid'} // Disable button if paid
        >
          <Send size={20} color={themeColors.primaryForeground} style={{ marginRight: 8 }}/>
          <Text style={[styles.primaryButtonText, { color: themeColors.primaryForeground }]}>
            {invoice?.status === 'draft' ? 'Send Invoice' : 
             invoice?.status === 'sent' || invoice?.status === 'overdue' ? 'Resend Invoice' : 
             invoice?.status === 'paid' ? 'Invoice Paid' : 'Send Invoice'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Send Invoice Modal */}
      <BottomSheetModal
        ref={sendInvoiceModalRef}
        index={0}
        snapPoints={sendInvoiceSnapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }} // Style grabber
        backgroundStyle={{ backgroundColor: themeColors.card }} // Modal background
        onDismiss={() => console.log('Send Invoice Modal Dismissed')}
      >
        <BottomSheetView style={styles.modalContentContainer}> 
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]}>Send Invoice</Text>
            <TouchableOpacity onPress={handleCloseSendModal} style={{ padding: 4 }}>
              <XIcon size={24} color={themeColors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Modal Options */}
          <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendByEmail}>
            <Mail size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
            <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send by Email</Text>
          </TouchableOpacity>
          <View style={[styles.modalSeparator, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendLink}>
            <Link size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
            <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send Link</Text>
          </TouchableOpacity>
          <View style={[styles.modalSeparator, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendPDF}>
            <FileText size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
            <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send PDF</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

export default InvoiceViewerScreen;

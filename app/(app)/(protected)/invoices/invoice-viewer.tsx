import React, { useState, useEffect, useCallback } from 'react';
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
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Edit3, MoreHorizontal, Clock, Send, Maximize, ChevronLeft, History } from 'lucide-react-native'; 
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider'; 
import type { Database, Json, Tables } from '../../../../types/database.types'; 
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from './InvoiceTemplateOne'; 
import InvoiceSkeletonLoader from '@/components/InvoiceSkeletonLoader'; // Import the skeleton loader

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];

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

function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; from?: string; previewInvoiceData?: string; fromScreen?: string }>(); 
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { supabase } = useSupabase(); 

  const [invoice, setInvoice] = useState<InvoiceForTemplate | null>(null); 
  const [client, setClient] = useState<ClientRow | null>(null);
  const [isPreviewingFromCreate, setIsPreviewingFromCreate] = useState(false); 
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(false); 
      return () => {
        setIsTabBarVisible(true); 
      };
    }, [setIsTabBarVisible])
  );

  const handleCustomBack = () => {
    console.log('[handleCustomBack] Called. fromScreen:', params.fromScreen);
    const fromScreen = params.fromScreen as string | undefined;
    if (fromScreen === 'DashboardScreen' || fromScreen === 'InvoicesListScreen') {
      router.replace(`/(app)/(protected)/${fromScreen.replace('Screen', '').toLowerCase()}` as any); // Use 'as any' to bypass strict type checking for dynamic routes
    } else if (params.from === 'create') {
      router.back(); 
    } else {
      router.replace('/(app)/(protected)/dashboard' as any); // Default fallback, 'as any' for type checking
    }
  };

  const fetchBusinessSettings = async (userId: string) => {
    console.log('[fetchBusinessSettings] Function called with userId:', userId); // LOG B
    if (!userId) {
      console.error('[fetchBusinessSettings] No userId provided.');
      setLoadingBusiness(false);
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
    } finally {
      setLoadingBusiness(false);
    }
  };

  const fetchInvoiceData = async (invoiceId: string): Promise<InvoiceForTemplate | null> => {
    setLoading(true);
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
        setLoading(false);
        return null;
      }

      if (!invoiceData) {
        setError('Invoice not found.');
        setInvoice(null);
        setLoading(false);
        return null;
      }
      
      console.log('[fetchInvoiceData] Raw invoiceData from Supabase:', invoiceData);
      console.log('[fetchInvoiceData] invoiceData.clients:', invoiceData.clients);
      console.log('[fetchInvoiceData] invoiceData.invoice_line_items from Supabase:', invoiceData.invoice_line_items);

      // Fetch business_settings specifically for currency information for this invoice instance
      // This does NOT set the main businessSettings state used for payment methods display.
      const { data: businessDataForCurrency, error: businessError } = await supabase
        .from('business_settings')
        .select('currency_iso_code, currency_symbol') // Only select what's needed here
        .eq('user_id', invoiceData.user_id)
        .single();

      if (businessError && businessError.code !== 'PGRST116') { // PGRST116: no rows found, which is okay if settings don't exist yet
        console.error('[fetchInvoiceData] Error fetching business_settings for currency:', businessError);
      }

      const fetchedInvoiceForTemplate: InvoiceForTemplate = {
        ...invoiceData,
        invoice_number: invoiceData.invoice_number ?? '', // Address lint error b5b84349-0dc3-4fbe-9c3d-20066c10aacc
        clients: invoiceData.clients as ClientRow, 
        invoice_line_items: invoiceData.invoice_line_items as Tables['invoice_line_items'][],
        currency: businessDataForCurrency?.currency_iso_code || 'USD', // Default if not found
        currency_symbol: businessDataForCurrency?.currency_symbol || getCurrencySymbol(businessDataForCurrency?.currency_iso_code || 'USD'),
      };
      
      console.log('[fetchInvoiceData] Constructed fetchedInvoiceForTemplate:', JSON.stringify(fetchedInvoiceForTemplate, null, 2));
      setInvoice(fetchedInvoiceForTemplate);
      if (invoiceData.clients) {
        setClient(invoiceData.clients as ClientRow);
      }
      setError(null);
      return fetchedInvoiceForTemplate;
    } catch (e: any) {
      console.error('[fetchInvoiceData] Exception:', e.message);
      setError('An unexpected error occurred while fetching invoice data.');
      setInvoice(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log(`[EFFECT START] InvoiceViewerScreen useEffect triggered.`);
    console.log(`[EFFECT PARAMS] from: ${params.from}, id: ${params.id}, previewData present: ${!!params.previewInvoiceData}`);
    setLoading(true); // Start loading

    const processData = async () => {
      if (params.from === 'create' && params.previewInvoiceData) {
        console.log('[EFFECT] Processing preview data...');
        setIsPreviewingFromCreate(true);
        try {
          const previewData = JSON.parse(params.previewInvoiceData) as PreviewInvoiceData;
          console.log('[EFFECT PREVIEW DATA] Parsed previewData:', JSON.stringify(previewData, null, 2));

          const previewInvoiceForTemplate: InvoiceForTemplate = {
            id: `preview-${Date.now()}`,
            user_id: '', 
            client_id: previewData.client_id || null,
            invoice_number: previewData.invoice_number ?? '', 
            status: 'draft', 
            invoice_date: previewData.invoice_date,
            due_date: previewData.due_date || null,
            due_date_option: previewData.due_date_option || null,
            po_number: previewData.po_number || null,
            custom_headline: previewData.custom_headline || null,
            subtotal_amount: previewData.subTotalAmount || 0,
            discount_type: previewData.discountType || null,
            discount_value: previewData.discountValue || 0,
            tax_percentage: previewData.taxPercentage || 0,
            total_amount: previewData.totalAmount || 0,
            notes: previewData.notes || null,
            stripe_active: previewData.stripe_active_on_invoice || false,
            bank_account_active: previewData.bank_account_active_on_invoice || false,
            paypal_active: previewData.paypal_active_on_invoice || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            invoice_line_items: (previewData.items || []).map((item, index) => ({
              ...item,
              id: item.id || `temp-preview-${index}`,
              user_id: '', 
              item_description: item.description || null,
              line_item_discount_type: item.line_item_discount_type || null,
              line_item_discount_value: item.line_item_discount_value || null,
              item_image_url: item.item_image_url || null,
              user_saved_item_id: item.user_saved_item_id || null,
              created_at: new Date().toISOString(), 
              updated_at: new Date().toISOString(), 
              invoice_id: '', 
            })),
            currency: previewData.currency || 'USD',
            currency_symbol: getCurrencySymbol(previewData.currency || 'USD'),
          };
          console.log('[EFFECT TRANSFORMED INVOICE] transformedInvoice:', JSON.stringify(previewInvoiceForTemplate, null, 2));
          setInvoice(previewInvoiceForTemplate);
          setError(null);
        } catch (e) {
          console.error("[EFFECT ERROR] Error processing preview data:", e);
          setError('Error processing preview data.');
        }
      } else if (params.id) {
        console.log('[InvoiceViewerScreen useEffect] Attempting to call fetchInvoiceData with invoiceId:', params.id); 
        fetchInvoiceData(params.id).then((fetchedInvoice) => {
          if (fetchedInvoice && fetchedInvoice.user_id) {
            const targetUserId = fetchedInvoice.user_id;
            console.log('[InvoiceViewerScreen useEffect] Attempting to call fetchBusinessSettings with targetUserId (from fetched invoiceData):', targetUserId); // LOG A
            if (targetUserId) fetchBusinessSettings(targetUserId); // This calls the main fetchBusinessSettings
          }
        });
      } else {
        console.warn("[EFFECT] No invoice ID and no preview data. Cannot load invoice.");
        setError('No invoice specified.');
      }
      setLoading(false); // End loading after processing
    };

    processData();
  }, [params.id, params.previewInvoiceData, params.from, supabase]);

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
        {loading || loadingBusiness ? (
          <View style={{ alignItems: 'center', paddingTop: 20 }}> 
            <InvoiceSkeletonLoader />
          </View>
        ) : error ? (
          <View style={[styles.centered, { paddingTop: 50, paddingBottom: 50 }]}>
            <Text style={{ color: themeColors.notification }}>Error: {error}</Text>
            {/* Optionally, add a retry button here */}
          </View>
        ) : invoice && businessSettings ? (
          <View style={{ alignItems: 'center' }}>
            <InvoiceTemplateOne 
              invoice={invoice}
              clientName={client?.name}
              businessSettings={businessSettings} 
            />
          </View>
        ) : (
          // Fallback if no invoice, no error, and not loading - should ideally not be reached in normal flow
          <View style={[styles.centered, { paddingTop: 50, paddingBottom: 50 }]}>
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
          onPress={handleSendInvoice}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
});

export default InvoiceViewerScreen;

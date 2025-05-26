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
  const [clientName, setClientName] = useState<string | null>(null);
  const [isPreviewingFromCreate, setIsPreviewingFromCreate] = useState(false); 
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchBusinessSettings = async (userIdToFetch?: string) => {
    console.log(`[fetchBusinessSettings] Called. Fetching for userId: ${userIdToFetch || 'current user'}`);
    let targetUserId = userIdToFetch;

    if (!targetUserId) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('[fetchBusinessSettings] Error fetching current user or user not found:', userError?.message);
        setError('Could not identify user for business settings.');
        return;
      }
      targetUserId = user.id;
      console.log(`[fetchBusinessSettings] Current user ID fetched: ${targetUserId}`);
    }

    if (!targetUserId) {
      console.error('[fetchBusinessSettings] No targetUserId available to fetch settings.');
      setError('User ID missing for fetching business settings.');
      return;
    }

    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', targetUserId)
        .single(); 

      if (settingsError) {
        console.error('[fetchBusinessSettings] Error fetching business settings:', settingsError.message);
        if (settingsError.code === 'PGRST116') { 
          console.warn('[fetchBusinessSettings] No business settings found for this user.');
          setError('No business settings found.'); 
        } else {
          setError('Failed to load business settings.');
        }
        setBusinessSettings(null); 
      } else if (settingsData) {
        console.log('[fetchBusinessSettings] Business settings fetched successfully:', settingsData);
        setBusinessSettings(settingsData as BusinessSettingsRow);
      } else {
        console.warn('[fetchBusinessSettings] No business settings data returned, though no error reported.');
        setBusinessSettings(null);
      }
    } catch (e: any) {
      console.error('[fetchBusinessSettings] Exception fetching business settings:', e.message);
      setError('An unexpected error occurred while fetching business settings.');
      setBusinessSettings(null);
    }
  };
  
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

  const fetchInvoiceData = async (invoiceId: string) => {
    setLoading(true);
    setError(null);

    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, clients(*), invoice_line_items(*)') // Changed clients(name) to clients(*)
        .eq('id', invoiceId)
        .single();

      console.log('[fetchInvoiceData] Raw invoiceData from Supabase:', JSON.stringify(invoiceData, null, 2));
      console.log('[fetchInvoiceData] Supabase invoiceError:', invoiceError);

      if (invoiceError) {
        throw invoiceError;
      }

      if (!invoiceData) {
        throw new Error('Invoice not found.');
      }

      console.log('[fetchInvoiceData] invoiceData.clients:', invoiceData.clients);
      console.log('[fetchInvoiceData] invoiceData.invoice_line_items from Supabase:', invoiceData.invoice_line_items);

      const { data: businessData, error: businessError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', invoiceData.user_id) 
        .single();

      if (businessError) {
        console.error('[fetchInvoiceData] Error fetching business settings:', businessError);
        // Decide if this is a critical error or if you can proceed without business settings
      }
      setBusinessSettings(businessData);

      // Construct the InvoiceForTemplate object
      const symbol = businessData?.currency_code ? getCurrencySymbol(businessData.currency_code) : '$';
      const fetchedInvoiceForTemplate: InvoiceForTemplate = {
        ...(invoiceData as any), // Cast to any to handle potential type discrepancies temporarily
        clients: invoiceData.clients as ClientRow, // Ensure clients is correctly typed
        invoice_line_items: invoiceData.invoice_line_items as Tables<'invoice_line_items'>[],
        currency: symbol,
        currency_symbol: symbol,
      };
      
      console.log('[fetchInvoiceData] Constructed fetchedInvoiceForTemplate:', JSON.stringify(fetchedInvoiceForTemplate, null, 2));

      setInvoice(fetchedInvoiceForTemplate);
      setClientName(fetchedInvoiceForTemplate.clients?.name || 'N/A');

    } catch (e: any) {
      console.error('[fetchInvoiceData] Error fetching invoice data:', e);
      setError(e.message || 'Failed to fetch invoice details.');
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

          await fetchBusinessSettings(); // Fetch for current user

          const transformedItems = (previewData.items || []).map((item, index) => ({
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
          }));

          // Resolve currency code for preview
          const baseCurrencyForPreview = previewData.currency || businessSettings?.currency_code;
          const finalCurrencyForPreview: string = baseCurrencyForPreview ?? 'USD';

          const transformedInvoice: InvoiceForTemplate = {
            id: `preview-${Date.now()}`,
            user_id: '', 
            client_id: previewData.client_id || null,
            invoice_number: previewData.invoice_number ? previewData.invoice_number : '', // Ensure a string using ternary
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
            invoice_line_items: transformedItems,
            currency: finalCurrencyForPreview as string, // Added 'as string' assertion
            currency_symbol: getCurrencySymbol(finalCurrencyForPreview),
            clients: null, // No direct client object in preview, clientName is separate
          };
          console.log('[EFFECT TRANSFORMED INVOICE] transformedInvoice:', JSON.stringify(transformedInvoice, null, 2));
          setInvoice(transformedInvoice);
          setClientName(previewData.clientName || 'N/A'); 
          setError(null);
        } catch (e) {
          console.error("[EFFECT ERROR] Error processing preview data:", e);
          setError('Error processing preview data.');
        }
      } else if (params.id) {
        await fetchInvoiceData(params.id); 
      } else {
        console.warn("[EFFECT] No invoice ID and no preview data. Cannot load invoice.");
        setError('No invoice specified.');
      }
      setLoading(false); // End loading after processing
    };

    processData();
  }, [params.id, params.previewInvoiceData, params.from, supabase]);

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
  
  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.centeredMessageContainer}>
          <Text style={[styles.errorText, { color: themeColors.destructive }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: themeColors.primary }]} 
            onPress={handleCustomBack} // Use the restored handleCustomBack
          >
            <Text style={[styles.buttonText, { color: themeColors.primaryForeground }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card, justifyContent: 'center', alignItems: 'center' }]}>
        <View style={styles.centeredMessageContainer}>
          <Text style={[styles.errorText, { color: themeColors.foreground }]}>No invoice data found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Log the invoice and client data before rendering the template
  // This log is crucial for debugging the client address issue.
  // We expect invoice to be non-null here due to the checks above.
  console.log('[InvoiceViewerScreen] Full invoice object being passed to template:', JSON.stringify(invoice, null, 2));
  console.log('[InvoiceViewerScreen] Client data from invoice.clients:', JSON.stringify(invoice.clients, null, 2));

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
        {invoice && (
          <View style={{ alignItems: 'center' }}>
            <InvoiceTemplateOne 
              invoice={invoice}
              clientName={clientName}
              businessSettings={businessSettings} 
            />
          </View>
        )}
      </ScrollView>

      <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: themeColors.card }]}>
        <View style={styles.invoiceDetailsBottomContainer}>
          <View style={styles.invoiceNumberAndTotalRow}>
            <Text style={[styles.invoiceNumberDisplay, { color: themeColors.foreground }]}>
              {invoice.invoice_number}
            </Text>
            <Text style={[styles.invoiceTotalDisplay, { color: themeColors.foreground }]}>
              {`${invoice.currency_symbol}${(invoice.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
          </View>
          <View style={styles.clientAndStatusRow}>
            <Text style={[styles.clientNameDisplay, { color: themeColors.mutedForeground }]}>
              {clientName}
            </Text>
            <View style={styles.statusToggleContainer}>
              <Switch
                trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
                thumbColor={invoice.status === 'paid' ? themeColors.primary : themeColors.card}
                ios_backgroundColor={themeColors.muted}
                onValueChange={(isPaid) => {
                  handleTogglePaid(isPaid);
                }}
                value={invoice.status === 'paid'}
                style={styles.statusSwitch}
              />
              <Text style={[styles.statusToggleValue, { color: invoice.status === 'paid' ? themeColors.primary : themeColors.foreground }]}>
                {invoice.status === 'paid' ? 'Paid' : 'Unpaid'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[
            styles.primaryButton,
            {
              backgroundColor: invoice.status === 'paid' ? themeColors.muted : themeColors.primary,
              opacity: invoice.status === 'paid' ? 0.5 : 1, // Explicitly set opacity
            },
          ]}
          onPress={handleSendInvoice}
          disabled={invoice.status === 'paid'} // Disable button if paid
        >
          <Send size={20} color={themeColors.primaryForeground} style={{ marginRight: 8 }}/>
          <Text style={[styles.primaryButtonText, { color: themeColors.primaryForeground }]}>
            {invoice.status === 'draft' ? 'Send Invoice' : 
             invoice.status === 'sent' || invoice.status === 'overdue' ? 'Resend Invoice' : 
             invoice.status === 'paid' ? 'Invoice Paid' : 'Send Invoice'}
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

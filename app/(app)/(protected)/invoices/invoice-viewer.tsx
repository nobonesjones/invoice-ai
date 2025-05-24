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
  TextStyle, // Added TextStyle
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Edit3, MoreHorizontal, Clock, Send, Maximize, ChevronLeft, History } from 'lucide-react-native'; 
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider'; 
// import { useAuth } from '@/context/AuthContext'; // Temporarily commented out
import type { Database, Json, Tables } from '../../../../types/database.types'; // Import Json type and Tables
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from './InvoiceTemplateOne'; // Updated import

// Define types for Supabase table rows using direct access
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];

// Define PreviewLineItem based on InvoiceLineItem from create.tsx
interface PreviewLineItem {
  id: string; 
  user_saved_item_id?: string | null;
  item_name: string;
  description?: string | null; 
  quantity: number;
  unit_price: number; // Matches create.tsx
  total_price: number;
  line_item_discount_type?: 'percentage' | 'fixed' | null;
  line_item_discount_value?: number | null;
  item_image_url?: string | null;
}

// Define PreviewInvoiceData based on InvoiceFormData from create.tsx
interface PreviewInvoiceData {
  invoice_number: string;
  client_id: string | null; // client_id is string in InvoiceFormData, but can be null if not selected
  clientName?: string; // Passed separately or resolved if client_id exists
  invoice_date: string; // Dates are passed as strings in JSON
  due_date: string | null; // Dates are passed as strings in JSON
  due_date_option: string | null;
  items: PreviewLineItem[];
  po_number?: string;
  custom_headline?: string;
  taxPercentage?: number | null;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  subTotalAmount?: number; // Matches create.tsx (subTotalAmount)
  totalAmount?: number;    // Matches create.tsx (totalAmount)
  notes?: string;
  payment_instructions_active_on_invoice?: boolean; // Added from InvoiceFormData
  bank_account_active_on_invoice?: boolean;     // Added from InvoiceFormData
  paypal_active_on_invoice?: boolean;         // Added from InvoiceFormData
  stripe_active_on_invoice?: boolean;           // Added from InvoiceFormData
  currency: string; // Assuming currency is passed, if not, it needs to be sourced
}

function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; from?: string; previewInvoiceData?: string; fromScreen?: string }>(); 
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { supabase } = useSupabase(); 
  // const { user } = useAuth(); // Temporarily commented out

  const [invoice, setInvoice] = useState<InvoiceForTemplate | null>(null); // Updated type
  const [clientName, setClientName] = useState<string | null>(null);
  const [isPreviewingFromCreate, setIsPreviewingFromCreate] = useState(false); // New state for preview mode
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null); // Added for template
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore useFocusEffect for tab bar visibility
  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(false); 
      return () => {
        setIsTabBarVisible(true); 
      };
    }, [setIsTabBarVisible])
  );

  // Restore handleCustomBack function
  const handleCustomBack = () => {
    if (isPreviewingFromCreate || params.fromScreen === 'create_preview') {
      router.back(); // Go back to create screen
    } else if (params.from === 'create') {
      router.back(); // Go back if came from create screen (after save)
    } else if (params.from === 'save') {
      router.replace('/(app)/(protected)/invoices/'); 
    } else {
      router.back(); 
    }
  };

  useEffect(() => {
    console.log('[EFFECT START] InvoiceViewerScreen useEffect triggered.');
    console.log(`[EFFECT PARAMS] from: ${params.from}, id: ${params.id}, previewData present: ${!!params.previewInvoiceData}`);

    // Simulate auth for preview if needed, or ensure it's handled if useAuth is re-enabled
    // For now, auth remains null as per declaration if not fetched and set.

    if (params.from === 'create' && params.previewInvoiceData) {
      console.log('[EFFECT BRANCH] Preview mode detected.');
      try {
        const previewData = JSON.parse(params.previewInvoiceData) as PreviewInvoiceData;
        console.log('[EFFECT PREVIEW_DATA] Parsed previewData:', JSON.stringify(previewData, null, 2));
        console.log('[EFFECT PREVIEW_DATA ITEMS] previewData.items:', JSON.stringify(previewData.items, null, 2));

        setIsPreviewingFromCreate(true);

        const transformedInvoice = {
          id: `preview-${Date.now()}`,
          user_id: '', // Will be set by RLS or on save
          client_id: previewData.client_id ?? null,
          invoice_number: previewData.invoice_number,
          status: 'draft', // Preview is always a draft initially
          invoice_date: previewData.invoice_date,
          due_date: previewData.due_date ?? null,
          subtotal_amount: previewData.subTotalAmount ?? 0, 
          discount_type: previewData.discountType ?? null,
          discount_value: previewData.discountValue ?? null, // Handles undefined by making it null
          tax_percentage: previewData.taxPercentage ?? null, // Handles undefined by making it null
          total_amount: previewData.totalAmount ?? 0, 
          notes: previewData.notes ?? null,
          po_number: previewData.po_number ?? null,
          custom_headline: previewData.custom_headline ?? null,
          due_date_option: previewData.due_date_option ?? null, 
          // Boolean flags - ensure they are booleans or null, and match InvoiceForTemplate fields
          payment_instructions_active: previewData.payment_instructions_active_on_invoice ?? null,
          bank_account_active: previewData.bank_account_active_on_invoice ?? null,
          paypal_active: previewData.paypal_active_on_invoice ?? null,
          stripe_active: previewData.stripe_active_on_invoice ?? null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          stripe_payment_intent_id: null,
          currency: previewData.currency, // Ensure currency is passed in previewData
          invoice_line_items: Array.isArray(previewData.items) ? previewData.items.map((item: PreviewLineItem) => ({
            // Map PreviewLineItem to Tables<'invoice_line_items'> structure
            id: item.id || `preview-item-${Date.now()}-${Math.random()}`,
            invoice_id: '', // Will be set when invoice is saved
            user_id: '', // Will be set by RLS or on save
            user_saved_item_id: item.user_saved_item_id || null,
            item_name: item.item_name,
            item_description: item.description || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            line_item_discount_type: item.line_item_discount_type || null,
            line_item_discount_value: item.line_item_discount_value || null,
            item_image_url: item.item_image_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })) : [], // Default to empty array if previewData.items is not an array
        } as InvoiceForTemplate; // Explicit cast here

        console.log('[EFFECT TRANSFORMED LINE_ITEMS] transformedInvoice.invoice_line_items:', JSON.stringify(transformedInvoice.invoice_line_items, null, 2));
        setInvoice(transformedInvoice);
        // If clientName is part of previewData, use it, otherwise it needs to be fetched or handled
        setClientName(previewData.clientName || 'Preview Client'); 
        setIsPreviewingFromCreate(true);
        setLoading(false);
        setError(null);
      } catch (e) {
        console.error('[EFFECT ERROR] Error processing preview data:', e);
        setError('Error processing preview data.');
        setLoading(false);
      }
      return; // Exit early, no need to fetch from DB
    }

    // Existing logic for fetching from Supabase if not in preview mode
    setIsPreviewingFromCreate(false);
    // if (!params.id || !supabase || !user) { // Temporarily removed user check
    if (!params.id || !supabase) { 
      setError('Missing invoice ID or Supabase client.'); // Temporarily removed user session from error
      setLoading(false);
      return;
    }

    const fetchInvoiceData = async () => {
      console.log('[fetchInvoiceData] Called');
      setLoading(true);
      setError(null);
      try {
        // const { data: { user: currentUser } } = await supabase.auth.getUser(); // Temporarily commented out
        // if (!currentUser) { // Temporarily commented out
        //   setError('User not authenticated.'); // Temporarily commented out
        //   setLoading(false); // Temporarily commented out
        //   return; // Temporarily commented out
        // } // Temporarily commented out

        if (!params.id) {
          console.error('[fetchInvoiceData] No invoice ID provided.');
          setError('No invoice ID provided.');
          setLoading(false);
          return;
        }
        console.log(`[fetchInvoiceData] Fetching invoice with ID: ${params.id}`);

        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select(`
            *,
            clients ( name ),
            invoice_line_items ( * )
          `)
          .eq('id', params.id)
          .single();

        console.log('[fetchInvoiceData] Raw invoiceData from Supabase:', JSON.stringify(invoiceData, null, 2));
        console.log('[fetchInvoiceData] Supabase invoiceError:', JSON.stringify(invoiceError, null, 2));

        if (invoiceError) throw invoiceError;

        if (invoiceData) {
          console.log('[fetchInvoiceData] invoiceData.clients:', JSON.stringify(invoiceData.clients, null, 2));
          console.log('[fetchInvoiceData] invoiceData.invoice_line_items from Supabase:', JSON.stringify(invoiceData.invoice_line_items, null, 2));

          const client = invoiceData.clients as { name: string } | null;
          setClientName(client?.name || 'Client Not Found');

          const fetchedInvoiceForTemplate: InvoiceForTemplate = {
            ...invoiceData,
            invoice_line_items: Array.isArray(invoiceData.invoice_line_items) 
              ? invoiceData.invoice_line_items 
              : [],
            currency: invoiceData.currency || businessSettings?.currency_code || 'USD', // Ensure currency
          };
          
          console.log('[fetchInvoiceData] Constructed fetchedInvoiceForTemplate:', JSON.stringify(fetchedInvoiceForTemplate, null, 2));
          console.log('[fetchInvoiceData] fetchedInvoiceForTemplate.invoice_line_items:', JSON.stringify(fetchedInvoiceForTemplate.invoice_line_items, null, 2));

          setInvoice(fetchedInvoiceForTemplate);
        } else {
          console.log('[fetchInvoiceData] No invoiceData returned from Supabase.');
          setError('Invoice not found.');
        }
      } catch (err: any) {
        console.error('[fetchInvoiceData] Error fetching invoice data:', err);
        setError(err.message || 'Failed to fetch invoice data.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceData();
  }, [params.id, params.previewInvoiceData, params.fromScreen, supabase]); // Added supabase to dependency array, removed user

  // Hide tab bar when this screen is focused
  useEffect(() => {
    setIsTabBarVisible(false);
    // Restore tab bar visibility when the screen is unfocused
    return () => setIsTabBarVisible(true);
  }, [setIsTabBarVisible]);

  const addAlpha = (color: string, opacity: number) => {
    // Add a check to ensure color is a string and valid hex
    if (typeof color !== 'string' || !color.startsWith('#') || (color.length !== 7 && color.length !== 4)) {
      console.warn(`addAlpha: Color "${color}" is not a valid hex string. Opacity may not apply correctly.`);
      return color; // Return original color or a default if it's invalid
    }
    const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
    let hexOpacity = _opacity.toString(16).toUpperCase();
    if (hexOpacity.length === 1) {
      hexOpacity = '0' + hexOpacity;
    }
    return color.slice(0, 7) + hexOpacity; // Ensure base color is 6-digit hex for consistency
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
      borderColor: themeColors.border,      // Default
      backgroundColor: themeColors.card,    // Default
    };
    const textStyle: TextStyle = {
      fontSize: 12,
      fontWeight: '500',
      color: themeColors.foreground, // Default
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
        textStyle.color = themeColors.statusDue; // Changed to themeColors.statusDue for consistency
        break;
      case 'cancelled':
        badgeStyle.borderColor = themeColors.destructive; 
        badgeStyle.backgroundColor = addAlpha(themeColors.destructive, 0.15);
        textStyle.color = themeColors.destructive; // Changed to themeColors.destructive
        break;
      default:
        // Defaults already applied
        break;
    }
    return { badgeStyle, textStyle };
  };

  const invoiceStatus = invoice?.status?.toLowerCase() || 'draft';
  const statusStyle = getStatusBadgeStyle(invoice?.status);
  
  const handlePrimaryAction = () => {
    if (isPreviewingFromCreate) return; // Disable in preview mode
    if (!invoice) return;
    console.log('Primary action pressed for invoice:', invoice.id);
  };

  const handleEdit = () => {
    if (isPreviewingFromCreate) return; // Disable in preview mode
    if (invoice && invoice.id) {
      router.push(`/invoices/create?id=${invoice.id}`);
    } else {
      console.warn('Edit pressed but no invoice ID found');
      // Optionally, show an alert to the user
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

  const isSentStatus = ['sent', 'paid', 'viewed', 'overdue'].includes(invoiceStatus);
  
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
            onPress={() => router.back()}
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

  // Existing summary cards and other UI elements will remain above this
  // For Checkpoint 1, we render InvoiceTemplateOne below everything else in the ScrollView

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      {/* New Top Section */}
      <View style={[
        styles.newTopSectionContainer,
        { 
          backgroundColor: themeColors.card, 
          borderBottomColor: themeColors.border 
        }
      ]}>
        {/* Top Row: Back Button and Status Indicator */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleCustomBack} style={styles.headerLeftContainer}>
            <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
            <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
          </TouchableOpacity>
          
          {/* Updated Status Display Structure - Label Removed */}
          <View style={styles.statusIndicatorContainer}>
            <View style={[{ backgroundColor: statusStyle.badgeStyle.backgroundColor, borderColor: statusStyle.badgeStyle.borderColor, borderWidth: statusStyle.badgeStyle.borderWidth, paddingVertical: statusStyle.badgeStyle.paddingVertical, paddingHorizontal: statusStyle.badgeStyle.paddingHorizontal, borderRadius: statusStyle.badgeStyle.borderRadius }]}>
              <Text style={[styles.statusValueText, statusStyle.textStyle]}>
                {invoiceStatus === 'draft' ? 'Not Sent' : (invoiceStatus.charAt(0).toUpperCase() + invoiceStatus.slice(1))}
              </Text>
            </View>
          </View>
        </View>

        {/* Second Row: Action Buttons (Centered) */}
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
            disabled={isPreviewingFromCreate} // Or conditionally disable if 'More Options' leads to destructive actions
          >
            <MoreHorizontal size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary }]}>More</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollViewContent, { backgroundColor: themeColors.border, paddingTop: 0, paddingBottom: 200 }]} // Ensure enough space for the bottom action bar and template
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

      {/* Action Bar (Bottom Section) */}
      <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: themeColors.card }]}>
        {/* Invoice Number/Total and Client/Status moved here */}
        <View style={styles.invoiceDetailsBottomContainer}>
          <View style={styles.invoiceNumberAndTotalRow}>
            <Text style={[styles.invoiceNumberDisplay, { color: themeColors.foreground }]}>
              {invoice.invoice_number}
            </Text>
            <Text style={[styles.invoiceTotalDisplay, { color: themeColors.foreground }]}>
              {`$${invoice.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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
          style={[styles.primaryButton, { backgroundColor: themeColors.primary }]} 
          onPress={handleSendInvoice}
          disabled={invoice.status === 'paid' || invoice.status === 'draft'} 
        >
          <Send size={20} color={themeColors.primaryForeground} style={{ marginRight: 8 }}/>
          <Text style={[styles.primaryButtonText, { color: themeColors.primaryForeground }]}>
            {invoice.status === 'draft' ? 'Send Invoice' : 
             invoice.status === 'sent' ? 'Resend Invoice' : 
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
    // backgroundColor and borderBottomColor moved to inline style
    // Add shadow for iOS
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
    marginLeft: 'auto', // Pushes it to the right of the back button
  },
  statusLabelText: {
    fontSize: 14,
    fontWeight: '500',
    // color is now set inline using themeColors.mutedForeground
  },
  statusValueText: {
    fontSize: 14,
    fontWeight: '600',
    // color is now set inline using statusStyle.textColor
  },
  actionButtonsRow: { 
    flexDirection: 'row',
    justifyContent: 'center', 
    marginTop: 10, // Changed from 20 to 10
    marginBottom: 10, 
  },
  actionButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center', // Keep this to vertically align icon and text
    justifyContent: 'center', // Add this to horizontally center content in button
    width: 120, // Add fixed width
    marginHorizontal: 5, // Add horizontal margin for spacing
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4, // Deeper shadow
    },
    shadowOpacity: 0.30, // More visible opacity
    shadowRadius: 4.65, // Blur radius
    elevation: 8, // Elevation for Android
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 14, // Slightly larger font
    color: '#000000', // Black text
    fontWeight: 'bold', // Bold text
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
    opacity: 0.5, // Style for disabled buttons
  },
  centeredMessageContainer: { // For centering error/loading messages
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: { // For error messages
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  button: { // General button style for 'Go Back' etc.
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { // Text for general buttons
    fontSize: 16,
    fontWeight: '500',
  },
});

export default InvoiceViewerScreen;

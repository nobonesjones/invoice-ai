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
import type { Database, Json } from '../../../../types/database.types'; // Import Json type

// Define types for Supabase table rows using direct access
type InvoiceRow = Database['public']['Tables']['invoices']['Row'];
type ClientRow = Database['public']['Tables']['clients']['Row'];

// Define the type for the preview data passed from create.tsx
// This should align with the structure of previewDataForViewer
type PreviewInvoiceDataType = Omit<InvoiceRow, 'line_items' | 'client_id' | 'user_id' | 'created_at' | 'updated_at' | 'due_date' | 'issue_date'> & {
  id: string; // Can be temp ID
  client_name?: string | null; // Client name directly
  client_id?: string | null;
  line_items: any[]; // Or a more specific type if InvoiceLineItem from create.tsx is imported
  issue_date: string; // ISO string
  due_date: string | null; // ISO string or null
  created_at?: string; // ISO string
  user_id?: string | null;
  total: number; // Added from previewDataForViewer
  subtotal: number; // Added from previewDataForViewer
  // Add any other fields from previewDataForViewer that are not directly in InvoiceRow or need type adjustment
};

function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; from?: string; previewInvoiceData?: string; fromScreen?: string }>(); 
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { supabase } = useSupabase(); 
  // const { user } = useAuth(); // Temporarily commented out

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [isPreviewingFromCreate, setIsPreviewingFromCreate] = useState(false); // New state for preview mode
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
    if (params.previewInvoiceData && params.fromScreen === 'create_preview') {
      try {
        const parsedPreviewData = JSON.parse(params.previewInvoiceData) as PreviewInvoiceDataType;
        
        // Transform/map previewData to fit InvoiceRow structure for the 'invoice' state
        // Many fields will map directly. Ensure line_items is handled correctly.
        const invoiceForState: InvoiceRow = {
          ...parsedPreviewData, // Spread most fields
          id: parsedPreviewData.id, // Already a string
          client_id: parsedPreviewData.client_id || null,
          // 'line_items' in InvoiceRow is Json | null. We have an array.
          // For display, we can use parsedPreviewData.line_items directly if rendering logic adapts,
          // or stringify if InvoiceRow strictly expects a JSON string for this field when not null.
          // For now, let's assume rendering logic can handle an array directly if invoice.line_items is one.
          // If invoice.line_items is used as JSON string elsewhere, this needs care.
          line_items: parsedPreviewData.line_items as Json, // Cast, assuming rendering handles array
          // Ensure date strings are directly usable or convert if InvoiceRow expects Date objects (it expects strings from DB)
          issue_date: parsedPreviewData.issue_date, 
          due_date: parsedPreviewData.due_date,
          created_at: parsedPreviewData.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(), // For preview, updated_at can be now
          user_id: parsedPreviewData.user_id || '', // Assuming user_id in InvoiceRow is string
          // Map other fields as necessary, ensuring type compatibility
          total_amount: parsedPreviewData.total, // Renamed in previewData
          subtotal_amount: parsedPreviewData.subtotal, // Renamed in previewData
        } as InvoiceRow; // Use 'as InvoiceRow' carefully, ensure all required fields are present

        setInvoice(invoiceForState);
        setClientName(parsedPreviewData.client_name || 'N/A');
        setIsPreviewingFromCreate(true);
        setLoading(false);
        setError(null);
      } catch (e) {
        console.error('Failed to parse preview data:', e);
        setError('Failed to load preview. Please try again.');
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
      setLoading(true);
      setError(null);
      try {
        // const { data: { user: currentUser } } = await supabase.auth.getUser(); // Temporarily commented out
        // if (!currentUser) { // Temporarily commented out
        //   setError('User not authenticated.'); // Temporarily commented out
        //   setLoading(false); // Temporarily commented out
        //   return; // Temporarily commented out
        // } // Temporarily commented out

        const { data: invoiceData, error: invoiceError } = await supabase
          .from('invoices')
          .select('*, clients(*)') // Fetch client data directly
          .eq('id', params.id as string)
          // .eq('user_id', currentUser.id) // Temporarily commented out user_id filter
          .single();

        if (invoiceError) throw invoiceError;
        if (!invoiceData) throw new Error('Invoice not found.');

        // The client data is now part of invoiceData.clients
        const clientInfo = invoiceData.clients as ClientRow | null; 

        setInvoice(invoiceData as InvoiceRow);
        setClientName(clientInfo?.name || 'N/A');

      } catch (err: any) {
        console.error('Error fetching invoice:', err);
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
        <Text style={{ color: themeColors.foreground, marginTop: 10 }}>Loading Invoice...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}>
        <Text style={{ color: themeColors.destructive, marginBottom: 10 }}>Error: {error}</Text>
        <TouchableOpacity onPress={handleCustomBack} style={styles.actionButton}>
          <ArrowLeft size={20} color={themeColors.primary} />
          <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!invoice) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}>
        <Text style={{ color: themeColors.foreground }}>Invoice not found.</Text>
        <TouchableOpacity onPress={handleCustomBack} style={[styles.actionButton, { marginTop: 10}]}>
          <ArrowLeft size={20} color={themeColors.primary} />
          <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const primaryButtonText = 
    invoice.status === 'draft' ? 'Send Invoice' :
    (invoice.status === 'sent' || invoice.status === 'overdue') ? 'Mark as Paid' :
    null; 

  const showPaidToggle = ['sent', 'paid', 'overdue'].includes(invoice.status);
  
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}>
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
            style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginLeft: 10 }, isPreviewingFromCreate && styles.disabledButton]} 
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
        contentContainerStyle={[styles.scrollViewContent, { backgroundColor: themeColors.border /* Changed to border for a slightly darker background */ }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Preview (Main Body) */}
        <View style={[styles.previewContainer, { backgroundColor: themeColors.card, shadowColor: '#000' }]}>
          <Text style={{ color: themeColors.mutedForeground, textAlign: 'center' }}>Invoice Preview Area</Text>
          <TouchableOpacity 
            style={styles.expandPreviewIcon} 
            onPress={() => Alert.alert('Expand', 'Expand preview functionality coming soon!')} 
          >
            <Maximize size={20} color={themeColors.mutedForeground} /> 
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Action Bar (Bottom Section) */}
      <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: '#FFFFFF' }]}>
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
    paddingBottom: 20, 
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
    marginTop: 20,
    marginBottom: 10, 
  },
  actionButton: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
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
  previewContainer: {
    flex: 1, 
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    margin: 16,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.5,
    elevation: 3,           
  },
  expandPreviewIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
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
});

export default InvoiceViewerScreen;

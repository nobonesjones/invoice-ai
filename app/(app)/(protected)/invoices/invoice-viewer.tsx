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
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ArrowLeft, Edit3, MoreHorizontal, Clock, Send, Maximize, ChevronLeft, History } from 'lucide-react-native'; 
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';

// Define the type for the invoice data this screen will display
type DisplayInvoice = {
  id: string;
  invoice_number: string;
  client_name: string;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  due_date: string; 
  // Add other fields if needed by preview section later
};

// Mock data for initial UI development
const mockInvoiceData: DisplayInvoice = {
  id: 'mock123',
  invoice_number: 'INV2024-001',
  client_name: 'Ben Kenobi',
  total_amount: 25000.00,
  status: 'draft', // Initial state for testing actions
  due_date: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0],
};

function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; from?: string }>(); 
  const { setIsTabBarVisible } = useTabBarVisibility();

  const [invoice, setInvoice] = useState<DisplayInvoice | null>(mockInvoiceData); 
  const [isPreviewMode, setIsPreviewMode] = useState(true); // Assume preview mode for now
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoiceStatus = invoice?.status?.toLowerCase() || 'draft';
  const isSentStatus = ['sent', 'paid', 'viewed', 'overdue'].includes(invoiceStatus);
  
  const addAlpha = (color: string, opacity: number) => {
    const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
    if (color.startsWith('#') && (color.length === 7 || color.length === 4)) { // Check if it's a hex color
      return color + _opacity.toString(16).padStart(2, '0').toUpperCase();
    }
    // For named colors or other formats, opacity might not be directly applicable this way
    // Consider returning an rgba string or handling based on theme structure if not hex
    console.warn(`addAlpha: Color ${color} is not a standard hex color. Opacity may not apply correctly.`);
    return color; // Return original color if not hex, or handle as rgba
  };

  const statusDisplayColor = isSentStatus 
    ? addAlpha(themeColors.success, 0.7) 
    : addAlpha(themeColors.mutedForeground, 0.7);
  
  const statusDisplayText = isSentStatus ? 'Sent' : 'Not Sent';
  
  const handleCustomBack = () => {
    // If the viewer was opened from the create screen (preview flow), simply go back.
    // This will use the default stack pop animation (slide right).
    if (params.from === 'create') {
      router.back();
    // If the viewer was opened after saving an invoice, replace with dashboard.
    } else if (params.from === 'save') {
      router.replace('/(app)/(protected)/invoices/');
    } else {
      router.back(); // Default behavior for other cases (e.g., from dashboard list)
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(false); 
      return () => {
        setIsTabBarVisible(true); 
      };
    }, [setIsTabBarVisible])
  );

  const getStatusBadgeStyle = (status: DisplayInvoice['status']) => {
    let backgroundColor = themeColors.muted;
    let textColor = themeColors.mutedForeground;

    switch (status) {
      case 'draft':
        backgroundColor = themeColors.muted; // Gray
        textColor = themeColors.foreground;
        break;
      case 'sent':
        backgroundColor = themeColors.primary; // Fallback from info
        textColor = themeColors.primaryForeground; // Fallback from infoForeground
        break;
      case 'paid':
        backgroundColor = themeColors.statusPaid; // Green
        textColor = themeColors.primaryForeground; // White text on green
        break;
      case 'overdue':
        backgroundColor = themeColors.statusDue; // Red
        textColor = themeColors.primaryForeground; // White text on red
        break;
      case 'cancelled':
        backgroundColor = themeColors.destructive; 
        textColor = themeColors.destructiveForeground;
        break;
      default:
        break;
    }
    return { backgroundColor, textColor };
  };

  const handlePrimaryAction = () => {
    if (!invoice) return;
    if (invoice.status === 'draft') {
      Alert.alert('Send Invoice', 'Sending invoice...'); // Placeholder
    } else if (invoice.status === 'sent' || invoice.status === 'overdue') {
      Alert.alert('Mark as Paid', 'Marking invoice as paid...'); // Placeholder
    }
  };

  const handleEdit = () => {
    Alert.alert('Coming Soon', 'Edit functionality will be available soon.');
  };

  const handleTogglePaid = (isPaid: boolean) => {
    if (!invoice) return;
    // Placeholder logic for toggling paid status
    const newStatus = isPaid ? 'paid' : (new Date(invoice.due_date) < new Date() && invoice.status !== 'draft' ? 'overdue' : 'sent');
    setInvoice({ ...invoice, status: newStatus as DisplayInvoice['status'] });
    Alert.alert('Status Updated', `Invoice marked as ${newStatus}.`);
  };

  const handleMoreOptions = () => {
    Alert.alert('Modal Coming Soon', 'More options modal will be available soon.');
  };

  const handleSendInvoice = () => {
    if (!invoice) return;
    if (invoice.status === 'draft') {
      Alert.alert('Send Invoice', 'Sending invoice...'); // Placeholder
    } else if (invoice.status === 'sent' || invoice.status === 'overdue') {
      Alert.alert('Resend Invoice', 'Resending invoice...'); // Placeholder
    }
  };

  const handleViewHistory = () => {
    Alert.alert('History', 'History functionality coming soon!');
  };

  if (loading && !invoice) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}><View style={styles.centered}><Text>Loading...</Text></View></SafeAreaView>;
  }

  if (error) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}><View style={styles.centered}><Text>Error: {error}</Text></View></SafeAreaView>;
  }

  if (!invoice) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card /* Make top status bar area white */ }]}><View style={styles.centered}><Text>No invoice data found.</Text></View></SafeAreaView>;
  }

  const primaryButtonText = 
    invoice.status === 'draft' ? 'Send Invoice' :
    (invoice.status === 'sent' || invoice.status === 'overdue') ? 'Mark as Paid' :
    null; // No primary button if already paid or cancelled

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
          backgroundColor: themeColors.card, // Apply theme-dependent background inline
          borderBottomColor: themeColors.border // Apply theme-dependent border color inline
        }
      ]}>
        {/* Top Row: Back Button and Status Indicator */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleCustomBack} style={styles.headerLeftContainer}>
            <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
            <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
          </TouchableOpacity>
          
          <View style={styles.statusIndicatorContainer}>
            <Text style={[styles.statusLabelText, { color: themeColors.mutedForeground }]}>Status: </Text>
            <Text style={[styles.statusValueText, { color: statusDisplayColor }]}>
              {statusDisplayText}
            </Text>
          </View>
        </View>

        {/* Second Row: Action Buttons (Centered) */}
        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={handleEdit}>
            <Edit3 size={18} color={themeColors.foreground} />
            <Text style={[styles.actionButtonText, { color: themeColors.foreground }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginLeft: 8 }]} onPress={handleViewHistory}>
            <History size={18} color={themeColors.foreground} />
            <Text style={[styles.actionButtonText, { color: themeColors.foreground }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginLeft: 8 }]} onPress={handleMoreOptions}>
            <MoreHorizontal size={18} color={themeColors.foreground} />
            <Text style={[styles.actionButtonText, { color: themeColors.foreground }]}>More</Text>
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
            onPress={() => Alert.alert('Expand', 'Expand preview functionality coming soon!')} // Placeholder action
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
              {invoice.client_name}
            </Text>
            <View style={styles.statusToggleContainer}>
              <Switch
                trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
                thumbColor={invoice.status === 'paid' ? themeColors.primary : themeColors.card}
                ios_backgroundColor={themeColors.muted}
                onValueChange={(isPaid) => {
                  setInvoice(prev => prev ? { ...prev, status: isPaid ? 'paid' : 'draft' } : null);
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
          disabled={invoice.status === 'paid' || invoice.status === 'draft'} // Example disable logic
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
  newTopSectionContainer: { // Static styles for the new top section
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 0, // Reduced to 0 for a more compact header
    paddingBottom: 12, // Space below the content of the header
    borderBottomWidth: StyleSheet.hairlineWidth,
    // backgroundColor and borderBottomColor moved to inline style
    // Add shadow for iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.5,
    elevation: 3,           // Standard elevation for cards
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    width: '100%',
  },
  headerLeftContainer: {
    flex: 1, 
    flexDirection: 'row', // To align icon and text horizontally
    alignItems: 'center', 
    paddingVertical: 8, 
  },
  backButtonText: { // Added style for the 'Back' text
    fontSize: 17,
    marginLeft: 6,
  },
  statusIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8, // Match back button's vertical padding
  },
  statusLabelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  statusValueText: {
    fontSize: 15,
    fontWeight: '600', 
  },
  actionButtonsRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 10, 
    marginBottom: 8, 
    // paddingHorizontal: 8, // Removed to allow buttons to use full width
  },
  actionButton: {
    flex: 1, // Make buttons share width equally
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center content within the button
    paddingVertical: 10,
    paddingHorizontal: 12, 
    borderRadius: 8,       
    borderWidth: StyleSheet.hairlineWidth,
    // borderColor: themeColors.border, // Moved to inline style to fix lint error
    // backgroundColor will be themeColors.card (white/dark card)
    shadowColor: '#000', // Shadow for iOS
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1,                  
    shadowRadius: 3,                   
    elevation: 3, // Elevation for Android
  },
  actionButtonText: {
    fontSize: 15,
    marginLeft: 8, // Space between icon and text
    fontWeight: '500',
    // color will be themeColors.primary
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
    // backgroundColor will be set inline with themeColors.card
    // shadowColor will be set inline
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.5,
    elevation: 3,           // Standard elevation for cards
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
  invoiceDetailsBottomContainer: { // Container for invoice details in the bottom bar
    marginBottom: 16, // Space above the Send Invoice button
  },
});

export default InvoiceViewerScreen;

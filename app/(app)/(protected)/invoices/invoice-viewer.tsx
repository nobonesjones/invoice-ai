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
import { ArrowLeft, Edit3, MoreHorizontal, Clock, Send, Maximize } from 'lucide-react-native'; 
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

export default function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const params = useLocalSearchParams();
  const { setIsTabBarVisible } = useTabBarVisibility();

  const [invoice, setInvoice] = useState<DisplayInvoice | null>(mockInvoiceData); 
  const [isPreviewMode, setIsPreviewMode] = useState(true); // Assume preview mode for now
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (loading && !invoice) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}><View style={styles.centered}><Text>Loading...</Text></View></SafeAreaView>;
  }

  if (error) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}><View style={styles.centered}><Text>Error: {error}</Text></View></SafeAreaView>;
  }

  if (!invoice) {
    return <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}><View style={styles.centered}><Text>No invoice data found.</Text></View></SafeAreaView>;
  }

  const primaryButtonText = 
    invoice.status === 'draft' ? 'Send Invoice' :
    (invoice.status === 'sent' || invoice.status === 'overdue') ? 'Mark as Paid' :
    null; // No primary button if already paid or cancelled

  const showPaidToggle = ['sent', 'paid', 'overdue'].includes(invoice.status);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      {/* New Top Section */}
      <View style={[styles.newTopSectionContainer, { borderBottomColor: themeColors.border, backgroundColor: '#FFFFFF' }]}>
        {/* Row 1: Back Button */}
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonContainer}>
            <ArrowLeft size={24} color={themeColors.foreground} />
            <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Invoice Number and Total Amount */}
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

      <ScrollView 
        style={{ flex: 1 }} // Added flex: 1 here
        contentContainerStyle={styles.scrollContentContainer} // Ensure this has flexGrow: 1
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
        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity 
            style={[styles.secondaryActionButton, {
              backgroundColor: themeColors.card, 
              borderColor: themeColors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
              borderRadius: 6,
            }]} 
            onPress={() => Alert.alert('Edit', 'Edit functionality coming soon!')}
          >
            <Edit3 size={20} color={themeColors.foreground} />
            <Text style={[styles.secondaryActionText, { color: themeColors.foreground }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.secondaryActionButton, {
              backgroundColor: themeColors.card, 
              borderColor: themeColors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
              borderRadius: 6,
            }]} 
            onPress={() => Alert.alert('History', 'History functionality coming soon!')}
          >
            <Clock size={20} color={themeColors.foreground} />
            <Text style={[styles.secondaryActionText, { color: themeColors.foreground }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.secondaryActionButton, {
              backgroundColor: themeColors.card, 
              borderColor: themeColors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 2,
              elevation: 2,
              borderRadius: 6,
            }]} 
            onPress={() => Alert.alert('More', 'More options functionality coming soon!')}
          >
            <MoreHorizontal size={20} color={themeColors.foreground} />
            <Text style={[styles.secondaryActionText, { color: themeColors.foreground }]}>More</Text>
          </TouchableOpacity>
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
  newTopSectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 16, 
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonContainer: { 
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4, 
  },
  backButtonText: {
    fontSize: 16,
    marginLeft: 6,
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
    marginLeft: 8, 
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
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 16,
    flexGrow: 1, 
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
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around', 
    alignItems: 'center',
    marginBottom: 16, 
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12, 
    paddingVertical: 8,    
    borderRadius: 6,       
    borderWidth: StyleSheet.hairlineWidth, 
    // backgroundColor, borderColor, shadowColor will be applied inline
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1,                  
    shadowRadius: 2,                   
    elevation: 2,                      
  },
  secondaryActionText: {
    fontSize: 15,
    marginLeft: 6,
  },
});

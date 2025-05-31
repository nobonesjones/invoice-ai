import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { 
  InvoiceStatus, 
  getStatusConfig, 
  getAvailableStatusOptions,
} from '@/constants/invoice-status';
import { StatusBadge } from './StatusBadge';
import { X as XIcon, ChevronRight } from 'lucide-react-native';

interface StatusSelectorSheetProps {
  currentStatus: InvoiceStatus;
  onStatusChange: (newStatus: InvoiceStatus) => void;
  onClose: () => void;
  invoiceNumber?: string;
}

export const StatusSelectorSheet: React.FC<StatusSelectorSheetProps> = ({
  currentStatus,
  onStatusChange,
  onClose,
  invoiceNumber,
}) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const insets = useSafeAreaInsets();
  const availableStatuses = getAvailableStatusOptions(currentStatus);
  const currentConfig = getStatusConfig(currentStatus);

  const handleStatusChange = (newStatus: InvoiceStatus) => {
    const newConfig = getStatusConfig(newStatus);
    
    // Show confirmation for potentially destructive actions with helpful context
    if (newStatus === 'cancelled') {
      Alert.alert(
        'Cancel Invoice',
        `Mark ${invoiceNumber ? `invoice ${invoiceNumber}` : 'this invoice'} as cancelled? You can change this back to any other status later if needed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Mark as Cancelled', 
            style: 'destructive',
            onPress: () => {
              onStatusChange(newStatus);
              onClose();
            }
          }
        ]
      );
      return;
    }

    // Show confirmation for sending invoice
    if (newStatus === 'sent' && currentStatus === 'draft') {
      Alert.alert(
        'Send Invoice',
        `Mark ${invoiceNumber ? `invoice ${invoiceNumber}` : 'this invoice'} as sent? This typically means the client can view and pay the invoice.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Mark as Sent', 
            onPress: () => {
              onStatusChange(newStatus);
              onClose();
            }
          }
        ]
      );
      return;
    }

    // For other statuses, change immediately without confirmation
    onStatusChange(newStatus);
    onClose();
  };

  const getStyles = (themeColors: any) => StyleSheet.create({
    container: {
      flex: 1,
    },
    // Standard modal header following pagestylinguide.md
    modalHeaderContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.foreground,
    },
    closeButton: {
      padding: 4, // Small touch target padding
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingBottom: Math.max(insets.bottom, 20),
    },
    currentSection: {
      marginTop: 20,
      marginBottom: 25,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: themeColors.mutedForeground,
      marginBottom: 12,
      marginLeft: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    currentStatusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: themeColors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: themeColors.border,
      // Standard card shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 3,
    },
    currentStatusText: {
      marginLeft: 12,
      flex: 1,
    },
    currentStatusLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: themeColors.foreground,
    },
    currentStatusDescription: {
      fontSize: 13,
      color: themeColors.mutedForeground,
      marginTop: 2,
    },
    transitionsSection: {
      flex: 1,
    },
    transitionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: themeColors.card,
      borderRadius: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
      // Standard card shadow
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 3,
    },
    transitionText: {
      marginLeft: 12,
      flex: 1,
    },
    transitionLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: themeColors.foreground,
    },
    transitionDescription: {
      fontSize: 12,
      color: themeColors.mutedForeground,
      marginTop: 2,
    },
    chevron: {
      marginLeft: 10,
    },
    noTransitions: {
      textAlign: 'center',
      color: themeColors.mutedForeground,
      fontSize: 14,
      fontStyle: 'italic',
      marginTop: 40,
      paddingHorizontal: 20,
    },
    // Standard modal separator
    modalSeparator: {
      height: StyleSheet.hairlineWidth,
    },
  });

  const styles = getStyles(themeColors);

  return (
    <BottomSheetView style={styles.container}>
      {/* Standard Modal Header */}
      <View style={styles.modalHeaderContainer}>
        <Text style={styles.modalTitle}>Change Status</Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <XIcon size={24} color={themeColors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {/* Current Status Section */}
        <View style={styles.currentSection}>
          <Text style={styles.sectionTitle}>Current Status</Text>
          <View style={styles.currentStatusCard}>
            <StatusBadge status={currentStatus} size="medium" />
            <View style={styles.currentStatusText}>
              <Text style={styles.currentStatusLabel}>{currentConfig.label}</Text>
              <Text style={styles.currentStatusDescription}>{currentConfig.description}</Text>
            </View>
          </View>
        </View>

        {/* Available Transitions Section */}
        <View style={styles.transitionsSection}>
          <Text style={styles.sectionTitle}>Change Status To</Text>
          {availableStatuses.length === 0 ? (
            <Text style={styles.noTransitions}>
              No other statuses available.
            </Text>
          ) : (
            availableStatuses.map((status) => {
              const config = getStatusConfig(status);
              return (
                <TouchableOpacity
                  key={status}
                  style={styles.transitionItem}
                  onPress={() => handleStatusChange(status)}
                  activeOpacity={0.7}
                >
                  <StatusBadge status={status} size="medium" />
                  <View style={styles.transitionText}>
                    <Text style={styles.transitionLabel}>{config.label}</Text>
                    <Text style={styles.transitionDescription}>{config.description}</Text>
                  </View>
                  <ChevronRight size={16} color={themeColors.mutedForeground} style={styles.chevron} />
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>
    </BottomSheetView>
  );
};

export default StatusSelectorSheet; 
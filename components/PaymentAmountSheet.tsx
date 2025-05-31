import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  TextInput, 
  Alert,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, DollarSign } from 'lucide-react-native';

interface PaymentAmountSheetProps {
  totalAmount: number;
  paidAmount: number;
  currencySymbol: string;
  invoiceNumber?: string;
  onPaymentUpdate: (amount: number, notes?: string) => void;
  onClose: () => void;
}

export const PaymentAmountSheet: React.FC<PaymentAmountSheetProps> = ({
  totalAmount,
  paidAmount,
  currencySymbol,
  invoiceNumber,
  onPaymentUpdate,
  onClose,
}) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const insets = useSafeAreaInsets();
  
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const paymentAmountNum = parseFloat(paymentAmount) || 0;
  const newPaidAmount = paidAmount + paymentAmountNum;

  const handleQuickAmount = (amount: number) => {
    setPaymentAmount(amount.toFixed(2));
  };

  const handleSubmit = () => {
    if (paymentAmountNum <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount.');
      return;
    }

    if (newPaidAmount > totalAmount) {
      Alert.alert(
        'Overpayment Warning',
        `This payment (${currencySymbol}${paymentAmountNum.toFixed(2)}) would result in an overpayment. The remaining amount due is ${currencySymbol}${remainingAmount.toFixed(2)}. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Continue', 
            onPress: () => {
              onPaymentUpdate(newPaidAmount, paymentNotes.trim() || undefined);
              onClose();
            }
          }
        ]
      );
      return;
    }

    onPaymentUpdate(newPaidAmount, paymentNotes.trim() || undefined);
    onClose();
  };

  const getStyles = (themeColors: any) => StyleSheet.create({
    container: {
      flex: 1,
    },
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
      padding: 4,
    },
    contentContainer: {
      flex: 1,
      paddingHorizontal: 16,
      paddingBottom: Math.max(insets.bottom, 20),
    },
    summarySection: {
      marginTop: 20,
      marginBottom: 25,
      padding: 16,
      backgroundColor: themeColors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    summaryLabel: {
      fontSize: 14,
      color: themeColors.mutedForeground,
    },
    summaryValue: {
      fontSize: 14,
      fontWeight: '500',
      color: themeColors.foreground,
    },
    summaryTotal: {
      fontWeight: 'bold',
      fontSize: 16,
      color: themeColors.foreground,
    },
    inputSection: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: themeColors.mutedForeground,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    amountInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      backgroundColor: themeColors.card,
    },
    currencySymbol: {
      fontSize: 18,
      fontWeight: '500',
      color: themeColors.mutedForeground,
      marginRight: 4,
    },
    amountInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 18,
      color: themeColors.foreground,
    },
    quickAmountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    quickAmountButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: themeColors.muted,
      borderRadius: 6,
      alignItems: 'center',
      marginHorizontal: 4,
    },
    quickAmountText: {
      fontSize: 12,
      color: themeColors.foreground,
      fontWeight: '500',
    },
    notesInput: {
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: themeColors.card,
      color: themeColors.foreground,
      fontSize: 14,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    submitButton: {
      backgroundColor: themeColors.primary,
      paddingVertical: 16,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 20,
    },
    submitButtonDisabled: {
      backgroundColor: themeColors.muted,
    },
    submitButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
    },
    statusText: {
      textAlign: 'center',
      marginTop: 12,
      fontSize: 14,
      fontStyle: 'italic',
    },
  });

  const styles = getStyles(themeColors);

  const getStatusText = () => {
    if (newPaidAmount >= totalAmount) {
      return { text: 'This will mark the invoice as fully paid', color: themeColors.statusPaid };
    } else if (newPaidAmount > paidAmount) {
      return { text: 'This will mark the invoice as partially paid', color: '#D97706' };
    }
    return { text: '', color: themeColors.mutedForeground };
  };

  const statusInfo = getStatusText();

  return (
    <BottomSheetView style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        {/* Modal Header */}
        <View style={styles.modalHeaderContainer}>
          <Text style={styles.modalTitle}>Record Payment</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <XIcon size={24} color={themeColors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={styles.contentContainer}>
          {/* Payment Summary */}
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Invoice Total:</Text>
              <Text style={styles.summaryValue}>{currencySymbol}{totalAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Already Paid:</Text>
              <Text style={styles.summaryValue}>{currencySymbol}{paidAmount.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Remaining:</Text>
              <Text style={[styles.summaryValue, styles.summaryTotal]}>{currencySymbol}{remainingAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Payment Amount Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Payment Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>{currencySymbol}</Text>
              <TextInput
                style={styles.amountInput}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="0.00"
                placeholderTextColor={themeColors.mutedForeground}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            
            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountRow}>
              <TouchableOpacity 
                style={styles.quickAmountButton}
                onPress={() => handleQuickAmount(remainingAmount / 4)}
              >
                <Text style={styles.quickAmountText}>25%</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickAmountButton}
                onPress={() => handleQuickAmount(remainingAmount / 2)}
              >
                <Text style={styles.quickAmountText}>50%</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.quickAmountButton}
                onPress={() => handleQuickAmount(remainingAmount)}
              >
                <Text style={styles.quickAmountText}>Full</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Payment Notes */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Payment Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              value={paymentNotes}
              onChangeText={setPaymentNotes}
              placeholder="Add notes about this payment..."
              placeholderTextColor={themeColors.mutedForeground}
              multiline
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity 
            style={[
              styles.submitButton, 
              paymentAmountNum <= 0 && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={paymentAmountNum <= 0}
          >
            <Text style={styles.submitButtonText}>
              Record Payment ({currencySymbol}{paymentAmountNum.toFixed(2)})
            </Text>
          </TouchableOpacity>

          {statusInfo.text ? (
            <Text style={[styles.statusText, { color: statusInfo.color }]}>
              {statusInfo.text}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </BottomSheetView>
  );
};

export default PaymentAmountSheet; 
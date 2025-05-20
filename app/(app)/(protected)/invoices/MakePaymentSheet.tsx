import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon } from 'lucide-react-native'; 

export interface PaymentData {
  paymentAmount: string; 
  paymentMethod: string;
}

export interface MakePaymentSheetProps {
  onSave: (data: PaymentData) => void;
  onClose: () => void;
  invoiceTotal: number;
  previouslyPaidAmount: number;
}

export interface MakePaymentSheetRef {
  present: (invoiceTotal: number, previouslyPaidAmount: number) => void;
  dismiss: () => void;
}

const MakePaymentSheet = forwardRef<MakePaymentSheetRef, MakePaymentSheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const [paymentAmount, setPaymentAmount] = useState<string>(''); 
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  const [currentInvoiceTotal, setCurrentInvoiceTotal] = useState<number>(0);
  const [currentPreviouslyPaid, setCurrentPreviouslyPaid] = useState<number>(0);

  const [displayPaidAfterThisPayment, setDisplayPaidAfterThisPayment] = useState<number>(0);
  const [displayBalanceDue, setDisplayBalanceDue] = useState<number>(0);
  
  React.useImperativeHandle(ref, () => ({
    present: (invoiceTotal: number, previouslyPaidAmount: number) => {
      console.log('[MakePaymentSheet] Presenting with total:', invoiceTotal, 'previously paid:', previouslyPaidAmount);
      setCurrentInvoiceTotal(invoiceTotal);
      setCurrentPreviouslyPaid(previouslyPaidAmount);
      setPaymentAmount(''); 
      setPaymentMethod(''); 
      bottomSheetModalRef.current?.present();
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  useEffect(() => {
    const currentPayment = parseFloat(paymentAmount.replace(',', '.')) || 0;
    const totalPaid = currentPreviouslyPaid + currentPayment;
    const balanceDue = currentInvoiceTotal - totalPaid;

    setDisplayPaidAfterThisPayment(totalPaid);
    setDisplayBalanceDue(balanceDue);
    console.log(`[MakePaymentSheet] Calc: currentPayment: ${currentPayment}, totalPaid: ${totalPaid}, balanceDue: ${balanceDue}`);
  }, [paymentAmount, currentInvoiceTotal, currentPreviouslyPaid]);

  const renderBackdrop = useCallback(
    (backdropProps: any) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  const handleSheetDismissed = () => {
    if (props.onClose) {
      props.onClose(); 
    }
  };

  const handleInternalSave = () => {
    const trimmedPaymentAmount = paymentAmount.trim();
    const numericPaymentAmount = parseFloat(trimmedPaymentAmount.replace(',', '.'));

    if (!trimmedPaymentAmount || isNaN(numericPaymentAmount) || numericPaymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
      return;
    }
    if (numericPaymentAmount > displayBalanceDue + numericPaymentAmount - currentPreviouslyPaid) { 
      Alert.alert('Overpayment Warning', `The payment amount ($${numericPaymentAmount.toFixed(2)}) exceeds the balance due ($${(currentInvoiceTotal - currentPreviouslyPaid).toFixed(2)}). Please adjust.`);
      return;
    }

    const trimmedPaymentMethod = paymentMethod.trim();
    const saveData: PaymentData = {
      paymentAmount: numericPaymentAmount.toFixed(2), 
      paymentMethod: trimmedPaymentMethod
    };

    props.onSave(saveData);
    bottomSheetModalRef.current?.dismiss(); 
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background, 
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 20 : 15,
      paddingBottom: 10, 
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.foreground,
    },
    closeButton: {
      padding: 5, 
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 10, 
      paddingBottom: Platform.OS === 'ios' ? 95 : 85, 
      flexGrow: 1,
      justifyContent: 'space-between',
    },
    card: {
      backgroundColor: themeColors.card,
      borderRadius: 10,
      marginVertical: 20, 
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 }, 
      shadowOpacity: 0.1,
      shadowRadius: 2.5,
      elevation: 3,
    },
    inputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Platform.OS === 'ios' ? 16 : 14, 
      paddingHorizontal: 16,
    },
    inputLabel: {
      fontSize: 16,
      color: themeColors.foreground,
      fontWeight: 'bold',
      marginRight: 16, 
    },
    textInput: {
      fontSize: 16,
      color: themeColors.foreground,
      textAlign: 'right',
      flex: 1, 
      paddingVertical: 0, 
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: themeColors.border,
      marginLeft: 16, 
    },
    handleIndicator: {
      backgroundColor: themeColors.mutedForeground,
    },
    modalBackground: {
      backgroundColor: themeColors.background, 
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    saveButton: {
      backgroundColor: themeColors.primary,
      paddingVertical: 16, 
      borderRadius: 10, 
      alignItems: 'center',
      marginTop: 30, 
    },
    saveButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
    },
    summaryRow: { 
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12, 
      paddingHorizontal: 16,
    },
    summaryLabel: { 
      fontSize: 16,
      color: themeColors.mutedForeground, 
      marginRight: 16, 
    },
    summaryValue: { 
      fontSize: 16,
      color: themeColors.foreground,
      fontWeight: '500',
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0} 
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed} 
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enablePanDownToClose={true} 
    >
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={{width: 24 + 10}} /> 
          <Text style={styles.title}>Add Payment</Text>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <XIcon size={24} color={themeColors.foreground} />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled" 
        >
          <View> 
            <View style={styles.card}>
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Amount</Text>
                <BottomSheetTextInput
                  style={styles.textInput}
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  placeholder="0.00"
                  keyboardType="numeric"
                  placeholderTextColor={themeColors.mutedForeground}
                />
              </View>
              <View style={styles.separator} />
              <View style={styles.inputRow}>
                <Text style={styles.inputLabel}>Payment Method</Text>
                <BottomSheetTextInput
                  style={styles.textInput}
                  value={paymentMethod}
                  onChangeText={setPaymentMethod}
                  placeholder="e.g. Card, Cash, Transfer"
                  placeholderTextColor={themeColors.mutedForeground}
                />
              </View>
            </View>

            {/* Summary Section */}
            <View style={[styles.card, { marginTop: 10, marginBottom: 20 }]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryValue}>${currentInvoiceTotal.toFixed(2)}</Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paid</Text>
                <Text style={[styles.summaryValue, { color: themeColors.primary }]}>
                  ${displayPaidAfterThisPayment.toFixed(2)}
                </Text>
              </View>
              <View style={styles.separator} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Balance Due</Text>
                <Text style={[styles.summaryValue, displayBalanceDue < 0 ? {color: themeColors.destructive} : {}]}>
                  ${displayBalanceDue.toFixed(2)}
                </Text>
              </View>
            </View>

          </View>
          <TouchableOpacity onPress={handleInternalSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Add Payment</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

export default MakePaymentSheet;

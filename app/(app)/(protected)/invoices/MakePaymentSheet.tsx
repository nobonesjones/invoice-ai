import React, { forwardRef, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon } from 'lucide-react-native'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const lastPresentTime = useRef<number>(0);
  const insets = useSafeAreaInsets();

  const [paymentAmount, setPaymentAmount] = useState<string>(''); 
  const [paymentMethod, setPaymentMethod] = useState<string>('');

  const [currentInvoiceTotal, setCurrentInvoiceTotal] = useState<number>(0);
  const [currentPreviouslyPaid, setCurrentPreviouslyPaid] = useState<number>(0);

  const [displayPaidAfterThisPayment, setDisplayPaidAfterThisPayment] = useState<number>(0);
  const [displayBalanceDue, setDisplayBalanceDue] = useState<number>(0);
  
  React.useImperativeHandle(ref, () => ({
    present: (invoiceTotal: number, previouslyPaidAmount: number) => {
      // Prevent multiple rapid opens (debounce 500ms)
      const now = Date.now();
      if (now - lastPresentTime.current < 500) {
        console.log('[MakePaymentSheet] 🚫 Blocked rapid open');
        return;
      }
      lastPresentTime.current = now;
      
      console.log('[MakePaymentSheet] 🚀 PRESENT CALLED - Total:', invoiceTotal, 'Previously Paid:', previouslyPaidAmount);
      console.log('[MakePaymentSheet] 📊 Current State - paymentAmount:', paymentAmount, 'paymentMethod:', paymentMethod);
      
      setCurrentInvoiceTotal(invoiceTotal);
      setCurrentPreviouslyPaid(previouslyPaidAmount);
      setPaymentAmount(''); 
      setPaymentMethod(''); 
      
      console.log('[MakePaymentSheet] 🎯 About to call bottomSheetModalRef.current?.present()');
      bottomSheetModalRef.current?.present();
      console.log('[MakePaymentSheet] ✅ bottomSheetModalRef.present() called');
    },
    dismiss: () => {
      console.log('[MakePaymentSheet] 🔽 DISMISS CALLED');
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
    console.log('[MakePaymentSheet] 📤 MODAL DISMISSED');
    if (props.onClose) {
      props.onClose(); 
    }
  };

  const handleSheetAnimate = (fromIndex: number, toIndex: number) => {
    console.log('[MakePaymentSheet] 🎭 ANIMATE - From:', fromIndex, 'To:', toIndex);
  };

  const handleSheetChange = (index: number) => {
    console.log('[MakePaymentSheet] 🔄 INDEX CHANGED TO:', index);
  };

  const handleInternalSave = () => {
    const trimmedPaymentAmount = paymentAmount.trim();
    const numericPaymentAmount = parseFloat(trimmedPaymentAmount.replace(',', '.'));

    if (!trimmedPaymentAmount || isNaN(numericPaymentAmount) || numericPaymentAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
      return;
    }

    // Calculate remaining balance that can be paid
    const remainingBalance = currentInvoiceTotal - currentPreviouslyPaid;
    
    // Check if trying to pay more than the remaining balance
    if (numericPaymentAmount > remainingBalance) {
      Alert.alert(
        'Payment Too Large', 
        `The payment amount ($${numericPaymentAmount.toFixed(2)}) exceeds the remaining balance of $${remainingBalance.toFixed(2)}. Please enter a smaller amount.`
      );
      return;
    }

    // Check if there's no remaining balance to pay
    if (remainingBalance <= 0) {
      Alert.alert(
        'Invoice Fully Paid', 
        'This invoice has already been fully paid. No additional payments can be recorded.'
      );
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

  // Function to handle percentage button clicks
  const handlePercentageClick = (percentage: number) => {
    const remainingBalance = currentInvoiceTotal - currentPreviouslyPaid;
    const calculatedAmount = (currentInvoiceTotal * percentage) / 100;
    
    // Don't allow percentages that would exceed the remaining balance
    if (calculatedAmount > remainingBalance) {
      // Instead, set to the exact remaining balance
      setPaymentAmount(remainingBalance.toFixed(2));
    } else {
      setPaymentAmount(calculatedAmount.toFixed(2));
    }
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
      paddingBottom: Platform.OS === 'ios' ? 40 : 30,
      minHeight: 500,
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
    percentageButtonsContainer: {
      marginBottom: 8,
    },
    percentageButtonsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 4,
    },
    percentageButton: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      minWidth: 50,
      alignItems: 'center',
    },
    percentageButtonText: {
      fontSize: 14,
      fontWeight: '500',
    },
    remainingBalanceText: {
      fontSize: 14,
      fontWeight: '500',
    },
  });

  const snapPoints = useMemo(() => ['90%', '95%'], []);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={1} 
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed} 
      onAnimate={handleSheetAnimate}
      onChange={handleSheetChange}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      enableOverDrag={false}
      enableDynamicSizing={false}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      topInset={Math.max(12, insets.top)}
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
          {/* Percentage Buttons */}
          <View style={styles.percentageButtonsContainer}>
            {/* Remaining Balance Indicator */}
            <Text style={[styles.remainingBalanceText, { color: themeColors.mutedForeground, marginBottom: 8, textAlign: 'center' }]}>
              Remaining Balance: ${(currentInvoiceTotal - currentPreviouslyPaid).toFixed(2)}
            </Text>
            
            <View style={styles.percentageButtonsRow}>
              {[10, 20, 50, 75, 100].map((percentage) => (
                <TouchableOpacity
                  key={percentage}
                  style={[styles.percentageButton, { borderColor: themeColors.border, backgroundColor: themeColors.card }]}
                  onPress={() => handlePercentageClick(percentage)}
                >
                  <Text style={[styles.percentageButtonText, { color: themeColors.foreground }]}>
                    {percentage}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

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

          <TouchableOpacity onPress={handleInternalSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Add Payment</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

export default MakePaymentSheet;

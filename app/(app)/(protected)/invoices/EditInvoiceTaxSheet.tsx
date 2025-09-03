import React, { forwardRef, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon } from 'lucide-react-native'; 

export interface TaxData {
  taxName: string;
  taxRate: string; // Keep as string for input, convert to number on save if needed by consumer
}

export interface EditInvoiceTaxSheetProps {
  onSave: (data: TaxData) => void;
  onClose: () => void;
  initialTaxName?: string | null;
  initialTaxRate?: number | string | null; // Allow number or string for rate initially
}

export interface EditInvoiceTaxSheetRef {
  present: (initialTaxName?: string | null, initialTaxRate?: number | string | null) => void;
  dismiss: () => void;
}

const EditInvoiceTaxSheet = forwardRef<EditInvoiceTaxSheetRef, EditInvoiceTaxSheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const lastPresentTime = useRef<number>(0);

  const [taxName, setTaxName] = useState<string>('');
  const [taxRate, setTaxRate] = useState<string>('');
  
  React.useImperativeHandle(ref, () => ({
    present: (initialName?: string | null, initialRate?: number | string | null) => {
      // Prevent multiple rapid opens (debounce 500ms)
      const now = Date.now();
      if (now - lastPresentTime.current < 500) {
        console.log('[EditInvoiceTaxSheet] 🚫 Blocked rapid open');
        return;
      }
      lastPresentTime.current = now;
      
      console.log('[EditInvoiceTaxSheet] 🚀 PRESENT CALLED - Name:', initialName, 'Rate:', initialRate);
      setTaxName(initialName || '');
      setTaxRate(initialRate !== null && initialRate !== undefined ? String(initialRate) : '');
      
      console.log('[EditInvoiceTaxSheet] 🎯 About to call bottomSheetModalRef.current?.present()');
      bottomSheetModalRef.current?.present();
      console.log('[EditInvoiceTaxSheet] ✅ bottomSheetModalRef.present() called');
    },
    dismiss: () => {
      console.log('[EditInvoiceTaxSheet] 🔽 DISMISS CALLED');
      bottomSheetModalRef.current?.dismiss();
    },
  }));

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

  const snapPoints = useMemo(() => ['60%', '75%'], []);

  const handleSheetDismissed = () => {
    console.log('[EditInvoiceTaxSheet] 📤 MODAL DISMISSED');
    if (props.onClose) {
      props.onClose(); 
    }
  };

  const handleSheetAnimate = (fromIndex: number, toIndex: number) => {
    console.log('[EditInvoiceTaxSheet] 🎭 ANIMATE - From:', fromIndex, 'To:', toIndex);
  };

  const handleSheetChange = (index: number) => {
    console.log('[EditInvoiceTaxSheet] 🔄 INDEX CHANGED TO:', index);
  };

  const handleInternalSave = () => {
    const trimmedTaxName = taxName.trim();
    if (!trimmedTaxName) {
      Alert.alert('Missing Tax Name', 'Please enter a name for the tax (e.g., VAT, Sales Tax).');
      return;
    }

    const numericTaxRate = parseFloat(taxRate.replace(',', '.')); // Allow comma as decimal separator
    if (isNaN(numericTaxRate) || numericTaxRate < 0 || numericTaxRate > 100) {
      Alert.alert('Invalid Tax Rate', 'Please enter a tax rate between 0 and 100 (e.g., 20 for 20%).');
      return;
    }

    const saveData: TaxData = {
      taxName: trimmedTaxName,
      taxRate: String(numericTaxRate) // Save as string, consistent with state
    };

    props.onSave(saveData);
    bottomSheetModalRef.current?.dismiss(); 
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background, // Modal container background
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
      minHeight: 400,
    },
    card: {
      backgroundColor: themeColors.card,
      borderRadius: 10,
      marginVertical: 20, // Spacing for the card itself
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 }, // Softer shadow
      shadowOpacity: 0.1,
      shadowRadius: 2.5,
      elevation: 3,
    },
    inputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Platform.OS === 'ios' ? 16 : 14, // Consistent padding
      paddingHorizontal: 16,
    },
    inputLabel: {
      fontSize: 16,
      color: themeColors.foreground,
      fontWeight: 'bold',
      marginRight: 16, // Space between label and input area
    },
    textInput: {
      fontSize: 16,
      color: themeColors.foreground,
      textAlign: 'right',
      flex: 1, // Take remaining space
      paddingVertical: 0, // Remove default padding if any from BottomSheetTextInput
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: themeColors.border,
      marginLeft: 16, // Align with padding of inputRow if it has leading icon/indentation
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
      paddingVertical: 16, // Increased padding for a more substantial button
      borderRadius: 10, // Consistent with input fields
      alignItems: 'center',
      marginTop: 30, // Ensure space above the button
    },
    saveButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0} 
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed}
      onAnimate={handleSheetAnimate}
      onChange={handleSheetChange}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enablePanDownToClose={true}
      enableDynamicSizing={false}
    >
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={{width: 24 + 10}} /> 
          <Text style={styles.title}>Edit Invoice Tax</Text>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <XIcon size={24} color={themeColors.foreground} />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView 
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled" 
        >
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Tax Name</Text>
              <BottomSheetTextInput
                style={styles.textInput}
                value={taxName}
                onChangeText={setTaxName}
                placeholder="e.g. VAT, Sales Tax"
                placeholderTextColor={themeColors.mutedForeground}
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>Tax Rate (%)</Text>
              <BottomSheetTextInput
                style={styles.textInput}
                value={taxRate}
                onChangeText={setTaxRate}
                placeholder="e.g. 20"
                placeholderTextColor={themeColors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <TouchableOpacity onPress={handleInternalSave} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>Save Tax Changes</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
 
       </View>
    </BottomSheetModal>
  );
});

export default EditInvoiceTaxSheet;

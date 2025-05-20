import React, { forwardRef, useMemo, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, Keyboard } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon } from 'lucide-react-native'; 

export interface DiscountData {
  discountType: 'percentage' | 'fixed';
  discountValue: number;
}

export interface DuplicateDiscountSheetProps {
  onSave: (data: DiscountData) => void;
  onClose: () => void;
  initialDiscountType?: 'percentage' | 'fixed' | null;
  initialDiscountValue?: number | null;
}

export interface DuplicateDiscountSheetRef {
  present: (initialType?: 'percentage' | 'fixed' | null, initialValue?: number | null) => void;
  dismiss: () => void;
}

const DuplicateDiscountSheet = forwardRef<DuplicateDiscountSheetRef, DuplicateDiscountSheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // State for the form inputs
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(props.initialDiscountType || null);
  // discountValue from input is always a string, then parsed to number for saving
  const [discountValue, setDiscountValue] = useState<string>(props.initialDiscountValue !== null && props.initialDiscountValue !== undefined ? String(props.initialDiscountValue) : '');
  const clearOnCloseRef = useRef(true);

  React.useImperativeHandle(ref, () => ({
    present: (initialTypeParam?: 'percentage' | 'fixed' | null, initialValueParam?: number | null) => {
      const typeToSet = initialTypeParam !== undefined ? initialTypeParam : (props.initialDiscountType || null);
      const valueToSet = initialValueParam !== undefined ? initialValueParam : (props.initialDiscountValue || null);
      
      setDiscountType(typeToSet);
      setDiscountValue(valueToSet !== null && valueToSet !== undefined ? String(valueToSet) : '');
      bottomSheetModalRef.current?.present();
    },
    dismiss: () => {
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

  const handleDiscountTypeSelect = (type: 'percentage' | 'fixed') => {
    setDiscountType(type);
    setDiscountValue(''); 
  };

  // Callback when the sheet is manually dismissed (e.g., by pan down or backdrop press)
  const handleSheetDismissed = () => {
    if (props.onClose) {
      props.onClose(); 
    }
  };

  const snapPoints = useMemo(() => ['60%'], []);

  const handleInternalSave = () => {
    Keyboard.dismiss();

    if (!discountType) {
      Alert.alert('No Discount Type', 'Please select a discount type (Percentage or Fixed Amount).');
      return;
    }

    // discountValue is a string from state, so .replace() and .trim() are valid
    const numericDiscountValue = parseFloat(discountValue.replace(/[^\d.-]/g, ''));

    if (discountValue.trim() === '' || isNaN(numericDiscountValue)) {
      Alert.alert('Invalid Discount Value', 'Please enter a valid number for the discount.');
      return;
    }
    if (numericDiscountValue <= 0) {
      Alert.alert('Invalid Discount Value', 'Discount value must be greater than zero.');
      return;
    }
    if (discountType === 'percentage' && numericDiscountValue > 100) {
      Alert.alert('Invalid Percentage', 'Percentage discount cannot exceed 100%.');
      return;
    }

    const saveData: DiscountData = {
      discountType: discountType, 
      discountValue: numericDiscountValue,
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
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 15 : 12,
      paddingBottom: 10, 
    },
    title: {
      flex: 1, 
      fontSize: 20,
      fontWeight: '600',
      color: themeColors.foreground,
      textAlign: 'center',
    },
    closeButton: {
      padding: 5, 
    },
    contentContainer: { 
      paddingHorizontal: 20,
      paddingTop: 10, 
      paddingBottom: Platform.OS === 'ios' ? 100 : 90, 
      flexGrow: 1,
      justifyContent: 'space-between',
    },
    handleIndicator: {
      backgroundColor: themeColors.mutedForeground, 
    },
    modalBackground: {
      backgroundColor: themeColors.background, 
    },
    inputLabel: {
      fontSize: 16,
      color: themeColors.foreground,
      marginBottom: 10,
      marginTop: 15, 
      fontWeight: '500',
    },
    textInput: {
      backgroundColor: themeColors.card,
      color: themeColors.foreground,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 15 : 12, 
      fontSize: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: themeColors.border,
      marginBottom: 20, 
    },
    saveDiscountButton: {
        backgroundColor: themeColors.primary,
        paddingVertical: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 20, 
        marginBottom: Platform.OS === 'ios' ? 20 : 10, 
    },
    saveDiscountButtonText: {
        color: themeColors.primaryForeground,
        fontSize: 16,
        fontWeight: 'bold',
    },
    discountTypeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 20, 
    },
    discountTypeButton: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
      alignItems: 'center',
      marginHorizontal: 5,
    },
    discountTypeButtonSelected: {
      borderColor: themeColors.primary,
      backgroundColor: themeColors.primaryTransparent,
    },
    discountTypeButtonText: {
      fontSize: 16,
      color: themeColors.foreground,
      fontWeight: '500',
    },
    discountTypeButtonTextSelected: {
      color: themeColors.primary,
      fontWeight: 'bold',
    }
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0} 
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed} 
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enablePanDownToClose={true} 
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
    >
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={{width: 24 + 10}} /> 
          <Text style={styles.title}>Add Discount</Text>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <XIcon size={24} color={themeColors.foreground} />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView 
          contentContainerStyle={styles.contentContainer}
        >
          <View>
            <Text style={styles.inputLabel}>Select Discount Type</Text>
            <View style={styles.discountTypeContainer}>
              <TouchableOpacity 
                style={[
                  styles.discountTypeButton,
                  discountType === 'percentage' && styles.discountTypeButtonSelected
                ]}
                onPress={() => handleDiscountTypeSelect('percentage')}
              >
                <Text style={[
                  styles.discountTypeButtonText,
                  discountType === 'percentage' && styles.discountTypeButtonTextSelected
                ]}>Percentage (%)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.discountTypeButton,
                  discountType === 'fixed' && styles.discountTypeButtonSelected
                ]}
                onPress={() => handleDiscountTypeSelect('fixed')}
              >
                <Text style={[
                  styles.discountTypeButtonText,
                  discountType === 'fixed' && styles.discountTypeButtonTextSelected
                ]}>Fixed Amount ($)</Text>
              </TouchableOpacity>
            </View>

            {discountType && (
              <>
                <Text style={styles.inputLabel}>
                  {discountType === 'percentage' ? 'Enter Discount Percentage' : 'Enter Fixed Discount'}
                </Text>
                <BottomSheetTextInput
                  style={styles.textInput}
                  value={discountValue} 
                  onChangeText={setDiscountValue} 
                  placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 50'}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </>
            )}
          </View> 

          <TouchableOpacity 
            style={styles.saveDiscountButton} 
            onPress={handleInternalSave}
          >
            <Text style={styles.saveDiscountButtonText}>Apply Discount</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
 
       </View>
    </BottomSheetModal>
  );
});

export default DuplicateDiscountSheet;

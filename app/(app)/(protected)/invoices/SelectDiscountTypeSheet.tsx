import React, { forwardRef, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, Percent, DollarSign } from 'lucide-react-native'; 

export interface DiscountData {
  discountType: 'percentage' | 'fixed' | null;
  discountValue: string;
}

export interface SelectDiscountTypeSheetProps {
  onApply: (data: DiscountData) => void;
  onClose: () => void;
}

export interface SelectDiscountTypeSheetRef {
  present: (initialDiscountType?: 'percentage' | 'fixed' | null, initialDiscountValue?: number | string | null) => void;
  dismiss: () => void;
}

const SelectDiscountTypeSheet = forwardRef<SelectDiscountTypeSheetRef, SelectDiscountTypeSheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const lastPresentTime = useRef<number>(0);

  const [selectedType, setSelectedType] = useState<'percentage' | 'fixed' | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  
  React.useImperativeHandle(ref, () => ({
    present: (initialType?: 'percentage' | 'fixed' | null, initialValue?: number | string | null) => {
      // Prevent multiple rapid opens (debounce 500ms)
      const now = Date.now();
      if (now - lastPresentTime.current < 500) {
        console.log('[SelectDiscountTypeSheet] 🚫 Blocked rapid open');
        return;
      }
      lastPresentTime.current = now;
      
      console.log('[SelectDiscountTypeSheet] 🚀 PRESENT CALLED - Type:', initialType, 'Value:', initialValue);
      console.log('[SelectDiscountTypeSheet] 📊 Current State - selectedType:', selectedType, 'inputValue:', inputValue);
      
      // Reset state before presenting
      setSelectedType(initialType || null);
      setInputValue(
        initialValue !== null && initialValue !== undefined
          ? String(initialValue)
          : ''
      );
      
      console.log('[SelectDiscountTypeSheet] 🎯 About to call bottomSheetModalRef.current?.present()');
      bottomSheetModalRef.current?.present();
      console.log('[SelectDiscountTypeSheet] ✅ bottomSheetModalRef.present() called');
    },
    dismiss: () => {
      console.log('[SelectDiscountTypeSheet] 🔽 DISMISS CALLED');
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

  const handleSheetDismissed = () => {
    console.log('[SelectDiscountTypeSheet] 📤 MODAL DISMISSED');
    if (props.onClose) {
      props.onClose(); 
    }
  };

  const handleSheetAnimate = (fromIndex: number, toIndex: number) => {
    console.log('[SelectDiscountTypeSheet] 🎭 ANIMATE - From:', fromIndex, 'To:', toIndex);
  };

  const handleSheetChange = (index: number) => {
    console.log('[SelectDiscountTypeSheet] 🔄 INDEX CHANGED TO:', index);
  };

  const handleInternalApply = () => {
    if (!selectedType) {
      Alert.alert('Select Type', 'Please select a discount type (Percentage or Fixed).');
      return;
    }

    const numericValue = parseFloat(inputValue.replace(',', '.'));
    if (isNaN(numericValue) || numericValue < 0) {
      Alert.alert('Invalid Value', 'Please enter a valid positive discount value.');
      return;
    }
    if (selectedType === 'percentage' && numericValue > 100) {
      Alert.alert('Invalid Percentage', 'Percentage discount cannot exceed 100%.');
      return;
    }

    const applyData: DiscountData = {
      discountType: selectedType,
      discountValue: String(numericValue),
    };

    props.onApply(applyData);
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
      paddingBottom: Platform.OS === 'ios' ? 40 : 30,
      minHeight: 400,
    },
    card: {
      backgroundColor: themeColors.card,
      borderRadius: 10,
      marginVertical: 20, 
      // Remove shadow to prevent rendering issues
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    typeSelectionContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: 16,
    },
    typeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    typeButtonSelected: {
      borderColor: themeColors.primary,
      backgroundColor: themeColors.primaryTransparent,
    },
    typeButtonText: {
      fontSize: 15,
      marginLeft: 8,
      color: themeColors.foreground,
      fontWeight: 'bold',
    },
    typeButtonTextSelected: {
      color: themeColors.primary,
      fontWeight: 'bold',
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
    applyButton: {
      backgroundColor: themeColors.primary,
      paddingVertical: 16, 
      borderRadius: 10, 
      alignItems: 'center',
      marginTop: 30, 
    },
    applyButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
    },
    disabledApplyButton: {
      backgroundColor: themeColors.muted,
    }
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0} 
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed} 
      onAnimate={handleSheetAnimate}
      onChange={handleSheetChange}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enablePanDownToClose={true}
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
          keyboardShouldPersistTaps="handled" 
        >
          <View style={styles.card}>
            <View style={styles.typeSelectionContainer}>
              <TouchableOpacity
                style={[
                  styles.typeButton,
                  selectedType === 'percentage' && styles.typeButtonSelected,
                ]}
                onPress={() => setSelectedType('percentage')}
              >
                <Percent
                  size={18}
                  color={
                    selectedType === 'percentage'
                      ? themeColors.primary
                      : themeColors.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    selectedType === 'percentage' &&
                      styles.typeButtonTextSelected,
                  ]}
                >
                  Percentage
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typeButton,
                  selectedType === 'fixed' && styles.typeButtonSelected,
                ]}
                onPress={() => setSelectedType('fixed')}
              >
                <DollarSign
                  size={18}
                  color={
                    selectedType === 'fixed'
                      ? themeColors.primary
                      : themeColors.mutedForeground
                  }
                />
                <Text
                  style={[
                    styles.typeButtonText,
                    selectedType === 'fixed' && styles.typeButtonTextSelected,
                  ]}
                >
                  Fixed Amount
                </Text>
              </TouchableOpacity>
            </View>

            {selectedType && (
              <>
                <View style={styles.separator} />
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>
                    {selectedType === 'percentage'
                      ? 'Discount (%)'
                      : 'Discount Amount'}
                  </Text>
                  <BottomSheetTextInput
                    style={styles.textInput}
                    value={inputValue}
                    onChangeText={setInputValue}
                    placeholder={
                      selectedType === 'percentage' ? 'e.g. 10' : 'e.g. 5.00'
                    }
                    placeholderTextColor={themeColors.mutedForeground}
                    keyboardType="numeric"
                    returnKeyType="none"
                    autoFocus={true}
                  />
                </View>
              </>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.applyButton,
              !selectedType || !inputValue ? styles.disabledApplyButton : {}
            ]}
            onPress={handleInternalApply}
            disabled={!selectedType || !inputValue}
          >
            <Text style={styles.applyButtonText}>Apply Discount</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

export default SelectDiscountTypeSheet;
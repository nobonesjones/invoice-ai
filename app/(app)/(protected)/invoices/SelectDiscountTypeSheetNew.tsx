import React, { forwardRef, useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, TextInput } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, Percent, DollarSign } from 'lucide-react-native';

export interface DiscountData {
  discountType: 'percentage' | 'fixed' | null;
  discountValue: string;
}

export interface SelectDiscountTypeSheetProps {
  onApply: (data: DiscountData) => void;
  onClose?: () => void;
  initialDiscountType?: 'percentage' | 'fixed' | null;
  initialDiscountValue?: number | string | null;
}

export interface SelectDiscountTypeSheetRef {
  present: (
    initialDiscountType?: 'percentage' | 'fixed' | null,
    initialDiscountValue?: number | string | null
  ) => void;
  dismiss: () => void;
}

const SelectDiscountTypeSheetNew = forwardRef<
  SelectDiscountTypeSheetRef,
  SelectDiscountTypeSheetProps
>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const isOpenRef = useRef<boolean>(false);
  const inputRef = useRef<TextInput>(null);

  const [selectedType, setSelectedType] = useState<'percentage' | 'fixed' | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  React.useImperativeHandle(ref, () => ({
    present: (
      initialType?: 'percentage' | 'fixed' | null,
      initialValue?: number | string | null
    ) => {
      if (isOpenRef.current) return; // Prevent double present
      setSelectedType(initialType || null);
      setInputValue(
        initialValue !== null && initialValue !== undefined
          ? String(initialValue)
          : ''
      );
      isOpenRef.current = true;
      bottomSheetModalRef.current?.present();
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
      isOpenRef.current = false;
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
    isOpenRef.current = false;
    if (props.onClose) {
      props.onClose();
    }
  };

  const handleApply = () => {
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
      paddingBottom: Platform.OS === 'ios' ? 95 : 85, // Space for save button
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
      fontWeight: '500',
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
    },
  });

  // Open low at ~30%, expand higher on selection
  const snapPoints = useMemo(() => ['30%', '80%'], []);

  // When a type is selected, expand the sheet and focus the input
  useEffect(() => {
    if (selectedType) {
      requestAnimationFrame(() => {
        bottomSheetModalRef.current?.snapToIndex(1);
        setTimeout(() => {
          inputRef.current?.focus();
        }, 50);
      });
    }
  }, [selectedType]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      stackBehavior="replace"
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enablePanDownToClose={true}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={{ width: 24 + 10 }} />
          <Text style={styles.title}>Add Discount</Text>
          <TouchableOpacity
            onPress={() => bottomSheetModalRef.current?.dismiss()}
            style={styles.closeButton}
          >
            <XIcon size={24} color={themeColors.foreground} />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View>
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
                      selectedType === 'percentage' && styles.typeButtonTextSelected,
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
                      ref={inputRef as any}
                      style={styles.textInput}
                      value={inputValue}
                      onChangeText={setInputValue}
                      placeholder={
                        selectedType === 'percentage' ? 'e.g. 10' : 'e.g. 5.00'
                      }
                      placeholderTextColor={themeColors.mutedForeground}
                      keyboardType="number-pad"
                      returnKeyType="none"
                      autoFocus={true}
                    />
                  </View>
                </>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.applyButton,
              (!selectedType || !inputValue) && styles.disabledApplyButton,
            ]}
            onPress={handleApply}
            disabled={!selectedType || !inputValue}
          >
            <Text style={styles.applyButtonText}>Apply Discount</Text>
          </TouchableOpacity>
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

export default SelectDiscountTypeSheetNew;

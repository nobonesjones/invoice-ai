import React, { useMemo, useCallback, useState, forwardRef, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import SetDueDateSheet, { DueDateOption } from './SetDueDateSheet';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { format, parseISO, isValid } from 'date-fns';

interface InvoiceDetailsData {
  invoiceNumber: string;
  creationDate: Date;
  dueDateType: string;
  customDueDate?: Date | null;
  poNumber?: string;
  customHeadline?: string;
}

interface EditInvoiceDetailsSheetProps {
  initialDetails?: InvoiceDetailsData;
  onSave: (updatedDetails: InvoiceDetailsData) => void;
  onClose?: () => void;
}

const EditInvoiceDetailsSheet = forwardRef<
  BottomSheetModal,
  EditInvoiceDetailsSheetProps
>(({ initialDetails, onSave, onClose }, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const styles = getStyles(themeColors, isLightMode);

  const [invoiceNumber, setInvoiceNumber] = useState(initialDetails?.invoiceNumber || '');

  const initialCreationDate = initialDetails?.creationDate
    ? (typeof initialDetails.creationDate === 'string' ? parseISO(initialDetails.creationDate) : initialDetails.creationDate)
    : new Date();
  const [creationDateObject, setCreationDateObject] = useState<Date>(
    isValid(initialCreationDate) ? initialCreationDate : new Date()
  );
  const [isCreationDatePickerVisible, setCreationDatePickerVisibility] = useState(false);

  const [selectedDueDateType, setSelectedDueDateType] = useState(initialDetails?.dueDateType || 'on_receipt');
  const [selectedCustomDueDate, setSelectedCustomDueDate] = useState(initialDetails?.customDueDate || null);
  const [dueDateDisplay, setDueDateDisplay] = useState(
    initialDetails?.customDueDate
      ? initialDetails.customDueDate.toLocaleDateString()
      : initialDetails?.dueDateType === 'none' ? 'None' : 'On receipt'
  );

  const [poNumber, setPoNumber] = useState(initialDetails?.poNumber || '');
  const [customHeadline, setCustomHeadline] = useState(initialDetails?.customHeadline || '');

  const [isLoading, setIsLoading] = useState(false);

  const setDueDateSheetRef = useRef<BottomSheetModal>(null);
  const [isCustomDatePickerVisible, setCustomDatePickerVisibility] = useState(false);

  const snapPoints = useMemo(() => ['70%', '95%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        outputRange={['0', '0.5']}
      />
    ),
    []
  );

  const handleInternalSave = () => {
    setIsLoading(true);
    const updatedDetails: InvoiceDetailsData = {
      invoiceNumber: invoiceNumber.trim(),
      creationDate: creationDateObject,
      dueDateType: selectedDueDateType,
      customDueDate: selectedCustomDueDate,
      poNumber: poNumber.trim(),
      customHeadline: customHeadline.trim(),
    };
    onSave(updatedDetails);
    setIsLoading(false);
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>Edit Invoice Details</Text>
      <TouchableOpacity
        onPress={() => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()}
        style={styles.closeButton}
        disabled={isLoading}
      >
        <X size={24} color={themeColors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );

  const handleDueDateSelect = (type: string, customDate?: Date | null, displayLabel?: string) => {
    setSelectedDueDateType(type);
    if (type === 'custom') {
      setCustomDatePickerVisibility(true);
    } else {
      setSelectedCustomDueDate(null);
      setDueDateDisplay(displayLabel || type);
    }
  };

  const showCustomDatePicker = () => {
    setCustomDatePickerVisibility(true);
  };

  const hideCustomDatePicker = () => {
    setCustomDatePickerVisibility(false);
  };

  const handleConfirmCustomDueDate = (date: Date) => {
    setSelectedDueDateType('custom');
    setSelectedCustomDueDate(date);
    setDueDateDisplay(date.toLocaleDateString());
    hideCustomDatePicker();
  };

  const showCreationDatePicker = () => {
    setCreationDatePickerVisibility(true);
  };

  const hideCreationDatePicker = () => {
    setCreationDatePickerVisibility(false);
  };

  const handleConfirmCreationDate = (date: Date) => {
    setCreationDateObject(date);
    hideCreationDatePicker();
  };

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      onChange={(index) => {
        if (index === -1 && onClose) {
          onClose();
        }
      }}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      enablePanDownToClose={!isLoading}
    >
      <BottomSheetView style={styles.bottomSheetContentContainer}>
        {renderHeader()}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingContainer}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Invoice Number</Text>
              <TextInput
                style={styles.input}
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
                placeholder="e.g., INV-001"
                placeholderTextColor={themeColors.mutedForeground}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Creation Date</Text>
              <TouchableOpacity
                style={styles.pressableRow}
                onPress={showCreationDatePicker}
                disabled={isLoading}
              >
                <Text style={styles.pressableRowText}>
                  {format(creationDateObject, "do MMM yyyy")}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Due Date</Text>
              <TouchableOpacity
                style={styles.pressableRow}
                onPress={() => setDueDateSheetRef.current?.present()}
                disabled={isLoading}
              >
                <Text style={styles.pressableRowText}>{dueDateDisplay}</Text>
                <X size={18} color={themeColors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PO Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={poNumber}
                onChangeText={setPoNumber}
                placeholder="Purchase Order Number"
                placeholderTextColor={themeColors.mutedForeground}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Custom Headline (Optional)</Text>
              <TextInput
                style={styles.input}
                value={customHeadline}
                onChangeText={setCustomHeadline}
                placeholder="e.g., Project Alpha Phase 1"
                placeholderTextColor={themeColors.mutedForeground}
                editable={!isLoading}
                multiline
                numberOfLines={2}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleInternalSave}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Details</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        <SetDueDateSheet
          ref={setDueDateSheetRef}
          currentDueDateType={selectedDueDateType}
          currentCustomDueDate={selectedCustomDueDate}
          onSelectDueDate={handleDueDateSelect}
        />

        <DateTimePickerModal
          isVisible={isCustomDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmCustomDueDate}
          onCancel={hideCustomDatePicker}
          date={selectedCustomDueDate || new Date()}
        />

        <DateTimePickerModal
          isVisible={isCreationDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmCreationDate}
          onCancel={hideCreationDatePicker}
          date={creationDateObject}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const getStyles = (themeColors: any, isLightMode: boolean) => StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 21,
    fontWeight: '600',
    color: themeColors.foreground,
  },
  closeButton: {
    padding: 6,
  },
  bottomSheetContentContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: themeColors.foreground,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: themeColors.input,
    color: themeColors.foreground,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: themeColors.border,
  },
  pressableRow: {
    backgroundColor: themeColors.input,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: themeColors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pressableRowText: {
    fontSize: 16,
    color: themeColors.foreground,
  },
  saveButton: {
    backgroundColor: themeColors.primary,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: themeColors.primaryMuted,
  },
  saveButtonText: {
    color: themeColors.primaryForeground,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditInvoiceDetailsSheet;

import React, { useMemo, useCallback, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { X, CheckCircle } from 'lucide-react-native'; // Added CheckCircle for selection indication
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';

export interface DueDateOption {
  label: string;
  type: string; // e.g., 'none', 'on_receipt', 'next_day', 'net_7', 'net_14', 'net_30', 'custom'
  days?: number; // For 'net_X' types or 'next_day'
}

interface SetDueDateSheetProps {
  currentDueDateType?: string;
  currentCustomDueDate?: Date | null;
  onSelectDueDate: (type: string, customDate?: Date | null, displayLabel?: string) => void;
  onClose?: () => void;
}

const DUE_DATE_OPTIONS: DueDateOption[] = [
  { label: 'None', type: 'none' },
  { label: 'Due on receipt', type: 'on_receipt' },
  { label: 'Next day', type: 'next_day', days: 1 },
  { label: '7 Days', type: 'net_7', days: 7 },
  { label: '14 Days', type: 'net_14', days: 14 },
  { label: '30 Days', type: 'net_30', days: 30 },
  { label: 'Custom', type: 'custom' },
];

const SetDueDateSheet = forwardRef<
  BottomSheetModal,
  SetDueDateSheetProps
>(({ currentDueDateType, currentCustomDueDate, onSelectDueDate, onClose }, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const styles = getStyles(themeColors, isLightMode);

  const snapPoints = useMemo(() => ['60%', '80%'], []); // Adjusted snap points

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

  const handleSelectOption = (option: DueDateOption) => {
    if (option.type === 'custom') {
      console.log('Custom date selection to be implemented here - will open date picker');
      // For now, don't close or call onSelectDueDate until date picker is implemented
      // onSelectDueDate(option.type, null, option.label); 
      // (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
      alert('Custom date picker coming soon!');
      return;
    }
    onSelectDueDate(option.type, null, option.label);
    (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>Set Due Date</Text>
      <TouchableOpacity 
        onPress={() => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()} 
        style={styles.closeButton}
      >
        <X size={24} color={themeColors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
  
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
      enablePanDownToClose={true}
    >
      <BottomSheetView style={styles.bottomSheetContentContainer}>
        {renderHeader()}
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContentContainer}
        >
          {DUE_DATE_OPTIONS.map((option) => {
            const isSelected = option.type === currentDueDateType;
            // Further logic for custom date selection indication can be added here
            return (
              <TouchableOpacity 
                key={option.type}
                style={styles.optionRow}
                onPress={() => handleSelectOption(option)}
              >
                <Text style={[styles.optionText, isSelected && styles.selectedOptionText]}>
                  {option.label}
                </Text>
                {isSelected && <CheckCircle size={20} color={themeColors.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
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
    paddingHorizontal: 0, // Options will have their own padding
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContentContainer: {
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: themeColors.border,
  },
  optionText: {
    fontSize: 16,
    color: themeColors.foreground,
  },
  selectedOptionText: {
    color: themeColors.primary,
    fontWeight: '600',
  },
});

export default SetDueDateSheet;

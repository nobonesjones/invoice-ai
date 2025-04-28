import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { X, Trash2, CheckSquare, ListFilter, List } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';

interface ActionItemsMenuModalProps {
  isVisible: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onCheckAll: () => void;
  onViewIncomplete: () => void;
  onViewAll: () => void;
}

export const ActionItemsMenuModal: React.FC<ActionItemsMenuModalProps> = ({
  isVisible,
  onClose,
  onClearAll,
  onCheckAll,
  onViewIncomplete,
  onViewAll,
}) => {
  const { theme } = useTheme();
  const modalBackgroundColor = theme.background; // Adjust as needed
  const textColor = theme.foreground;
  const mutedTextColor = theme.mutedForeground;
  const borderColor = theme.border;

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onBackButtonPress={onClose}
      style={styles.modal}
      swipeDirection={['down']}
      useNativeDriver={true} // Added for performance
      useNativeDriverForBackdrop={true} // Added for performance
      onSwipeComplete={onClose}
      propagateSwipe
      backdropOpacity={0.3}
      animationIn="slideInUp"
      animationInTiming={500} // Added for smoother animation
      animationOut="slideOutDown"
      animationOutTiming={500} // Added for smoother animation
    >
      <View style={[styles.content, { backgroundColor: modalBackgroundColor }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Action Item Options</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={24} color={mutedTextColor} />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Option Rows */}
          <TouchableOpacity style={styles.optionRow} onPress={onClearAll}>
            <Trash2 size={22} color={textColor} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: textColor }]}>Clear All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={onCheckAll}>
            <CheckSquare size={22} color={textColor} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: textColor }]}>Check All</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={onViewIncomplete}>
            <ListFilter size={22} color={textColor} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: textColor }]}>View Incomplete</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionRow} onPress={onViewAll}>
            <List size={22} color={textColor} style={styles.optionIcon} />
            <Text style={[styles.optionText, { color: textColor }]}>View All</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40, // Adjust for safe area if needed
    maxHeight: '40%', // Approximately 30-40%
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  optionsContainer: {
    // Styles for options rows will go here
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },
  optionIcon: {
    marginRight: 15,
    width: 24, // Ensure consistent alignment
    textAlign: 'center',
  },
  optionText: {
    fontSize: 16,
  },
});

export default ActionItemsMenuModal;

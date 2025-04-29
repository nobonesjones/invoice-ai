import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Modal from 'react-native-modal';
import { X, Database, ListVideo, Clock, Hourglass } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { Text } from '@/components/ui/text';
import { H3 } from '@/components/ui/typography';

interface LanguageSelectorModalProps {
  isVisible: boolean;
  onClose: () => void;
  title?: string;
}

const dummyLanguages = [
  'English',
  'Spanish',
  'French',
  'German',
  'Mandarin Chinese',
  'Japanese',
  'Arabic',
  'Portuguese',
  'Russian',
  'Hindi',
];

export const LanguageSelectorModal: React.FC<LanguageSelectorModalProps> = ({
  isVisible,
  onClose,
  title = "Select Language",
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose}
      onSwipeComplete={onClose}
      swipeDirection="down"
      style={styles.modal}
      propagateSwipe // Allows scrolling within the modal
      animationInTiming={500} // Adjust timing
      animationOutTiming={500} // Adjust timing
      useNativeDriver={true} // Use native driver for smoother animations
      hideModalContentWhileAnimating={true} // Improve performance
    >
      <View style={[styles.contentContainer, { backgroundColor: theme.card }]}>
        {/* Header with Title and Close Button */}
        <View style={styles.header}>
          <H3 style={{ color: theme.foreground }}>{title}</H3>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={24} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Coming Soon Text - Now Conditional */}
        {title === 'Storage' && (
          <View style={styles.storageContentContainer}>
            {/* Total Storage Row */}
            <View style={styles.statRow}>
              <Database size={20} color={theme.foreground} style={styles.iconStyle} />
              <Text style={[styles.statLabel, { color: theme.foreground }]}>Total Storage</Text>
              <Text style={[styles.statValue, { color: theme.mutedForeground }]}>25%</Text>
            </View>
            {/* Percentage Bar */}
            <View style={[styles.progressBarBackground, { backgroundColor: theme.border, marginBottom: 24 }]}>
              <View style={[styles.progressBarFill, { width: '25%', backgroundColor: theme.primary }]} />
            </View>

            {/* Other Stats */}
            <View style={styles.statRow}>
              <ListVideo size={20} color={theme.foreground} style={styles.iconStyle} />
              <Text style={[styles.statLabel, { color: theme.foreground }]}>Total Meetings</Text>
              <Text style={[styles.statValue, { color: theme.mutedForeground }]}>20</Text>
            </View>
            <View style={styles.statRow}>
              <Clock size={20} color={theme.foreground} style={styles.iconStyle} />
              <Text style={[styles.statLabel, { color: theme.foreground }]}>Total minutes recorded</Text>
              <Text style={[styles.statValue, { color: theme.mutedForeground }]}>121</Text>
            </View>
            <View style={styles.statRow}>
              <Hourglass size={20} color={theme.foreground} style={styles.iconStyle} />
              <Text style={[styles.statLabel, { color: theme.foreground }]}>Total Time Saved</Text>
              <Text style={[styles.statValue, { color: theme.mutedForeground }]}>60 minutes</Text>
            </View>
          </View>
        )}

        {/* Language List - Conditional */}
        {title !== 'Storage' && (
          <View style={{ flex: 1 }}> {/* Wrap in a view to take space */}
            <Text style={[styles.comingSoonText, { color: theme.mutedForeground }]}>
              Language Select Coming Soon
            </Text>
            <ScrollView style={styles.scrollView}>
              {dummyLanguages.map((lang, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.languageItem, { borderBottomColor: theme.border }]}
                  // onPress={() => { /* Handle language selection later */ onClose(); }}
                >
                  <Text style={{ color: theme.foreground, fontSize: 16 }}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  contentContainer: {
    height: '50%', // Make it 50% height
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20, // Add some padding at the bottom
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  centeredContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storageContentContainer: {
    flex: 1,
    paddingTop: 10, // Add some top padding
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18, // Increased spacing between rows slightly
  },
  iconStyle: {
    marginRight: 16, // Space between icon and label
  },
  statLabel: {
    fontSize: 16,
    flex: 1, // Allow label to push value to the right
  },
  statValue: {
    fontSize: 16,
    textAlign: 'right', // Ensure value is right-aligned
  },
  progressBarBackground: {
    height: 8, 
    borderRadius: 4,
    overflow: 'hidden', // Ensure fill stays within bounds
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  comingSoonText: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  scrollView: {
    flex: 1, // Allow scrollview to take remaining space
  },
  languageItem: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

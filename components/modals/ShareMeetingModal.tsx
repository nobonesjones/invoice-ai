import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Modalize } from 'react-native-modalize';
import { Portal } from 'react-native-portalize';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';
import { Share, FileText, Music } from 'lucide-react-native';

interface ShareMeetingModalProps {
  isVisible: boolean;
  onClose: () => void;
  onShareMinutes: () => void;
  onShareTranscript: () => void;
  onShareAudio: () => void;
  hasAudio: boolean; // To conditionally show the audio share option
}

export const ShareMeetingModal: React.FC<ShareMeetingModalProps> = ({ 
  isVisible, 
  onClose, 
  onShareMinutes, 
  onShareTranscript, 
  onShareAudio,
  hasAudio
}) => {
  const modalizeRef = useRef<Modalize>(null);
  const { theme } = useTheme();

  React.useEffect(() => {
    if (isVisible) {
      modalizeRef.current?.open();
    } else {
      modalizeRef.current?.close();
    }
  }, [isVisible]);

  const handleClose = () => {
    onClose();
  };

  const renderItem = (icon: React.ReactNode, label: string, onPress: () => void) => (
    <TouchableOpacity 
      style={[styles.item, { borderBottomColor: theme.border }]}
      onPress={() => {
        onPress();
        handleClose();
      }}
    >
      {icon}
      <Text style={[styles.itemText, { color: theme.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Portal>
      <Modalize
        ref={modalizeRef}
        adjustToContentHeight
        onClose={handleClose} // Ensure onClose is called when modal is dismissed
        modalStyle={{ backgroundColor: theme.card, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
        handleStyle={{ backgroundColor: theme.mutedForeground }}
        handlePosition="inside"
        useNativeDriver={true}
        useNativeDriverForBackdrop={true}
      >
        <View style={styles.contentContainer}>
          {renderItem(
            <FileText size={22} color={theme.primary} />,
            'Share Minutes',
            onShareMinutes
          )}
          {renderItem(
            <FileText size={22} color={theme.primary} />,
            'Share Transcript',
            onShareTranscript
          )}
          {hasAudio && renderItem(
            <Music size={22} color={theme.primary} />,
            'Share Audio',
            onShareAudio
          )}
        </View>
      </Modalize>
    </Portal>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  itemText: {
    marginLeft: 16,
    fontSize: 16,
  },
});

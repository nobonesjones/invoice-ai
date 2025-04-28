import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Modal from 'react-native-modal';
import { EmojiKeyboard } from 'rn-emoji-keyboard';
import { Button } from '@/components/ui/button';

interface RenameAndEmojiModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSave: (details: { id: string; name: string; icon: string }) => void;
  initialDetails: { id: string; name: string; icon: string } | null;
  backgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  borderColor: string;
  secondaryColor: string;
  inputBackgroundColor: string;
  primaryColor: string;
  primaryForeground: string;
  card: string;
  border: string;
}

export const RenameAndEmojiModal: React.FC<RenameAndEmojiModalProps> = ({
  isVisible,
  onClose,
  onSave,
  initialDetails,
  backgroundColor,
  textColor,
  mutedTextColor,
  borderColor,
  secondaryColor,
  inputBackgroundColor,
  primaryColor,
  primaryForeground,
  card,
  border,
}) => {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📝'); // Default emoji
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Update state when initialDetails change (when modal is opened)
  useEffect(() => {
    if (initialDetails) {
      setName(initialDetails.name);
      setIcon(initialDetails.icon || '📝');
      setIsKeyboardVisible(false); // Ensure keyboard is hidden initially
    } else {
      // Reset when modal is closed or no details
      setName('');
      setIcon('📝');
      setIsKeyboardVisible(false);
    }
  }, [initialDetails]);

  const handleSave = () => {
    if (name.trim() && initialDetails) {
      onSave({ id: initialDetails.id, name: name.trim(), icon: icon });
    }
    onClose(); // Close modal on save
  };

  const handleEmojiSelect = (emojiObject: { emoji: string }) => {
    setIcon(emojiObject.emoji);
    setIsKeyboardVisible(false); // Hide keyboard after selection
  };

  const handleEmojiButtonPress = () => {
    setIsKeyboardVisible(!isKeyboardVisible); // Toggle keyboard visibility
  };

  const commonButtonStyle = {
    backgroundColor: card, // Use card color for theme adaptability
    borderColor: border, // Use destructured theme prop
    borderWidth: 1,
    minWidth: 100,
    // Shadow styles
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, // Subtle shadow
    shadowRadius: 3,
    elevation: 3, // For Android
  };

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={onClose} // Close on backdrop press
      // Avoid covering the full screen if keyboard is large
      style={styles.modal}
      backdropOpacity={0.3}
      avoidKeyboard={true}
    >
      <View style={[styles.content, { backgroundColor: backgroundColor }]}>
        <Text style={[styles.title, { color: textColor }]}>Rename Meeting</Text>

        {/* Input Row */}
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={[styles.emojiButton, { backgroundColor: secondaryColor, borderColor: borderColor }]}
            onPress={handleEmojiButtonPress}
          >
            <Text style={styles.emojiButtonText}>{icon}</Text>
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              { color: textColor, borderColor: borderColor, backgroundColor: inputBackgroundColor },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Meeting Name"
            placeholderTextColor={mutedTextColor}
            autoFocus={true}
          />
        </View>

        {/* Conditional Emoji Keyboard */}
        {isKeyboardVisible && (
          <View style={styles.keyboardContainer}>
            <EmojiKeyboard
              onEmojiSelected={handleEmojiSelect}
              // Pass theme to make keyboard background match modal background
              theme={{
                // Use 'container' instead of 'background'
                container: backgroundColor, 
                // Keep category adjustments
                category: {
                  icon: textColor,
                  iconActive: primaryColor,
                  container: backgroundColor, // Category container background also matches
                }
              }}
              // Optionally disable the built-in safe area if it causes issues
              // enableSafeArea={false} 
              // Explicitly enable the search bar
              enableSearchBar={true}
            />
          </View>
        )}

        {/* Buttons - Only show if keyboard is NOT visible? */}
        {!isKeyboardVisible && (
           <View style={styles.buttonsContainer}>
             {/* Apply common style, remove variant */}
             <Button
               onPress={onClose}
               className="mr-2" // Keep margin
               style={commonButtonStyle}
             >
               <Text style={{ color: textColor }}>Cancel</Text>
             </Button>
             {/* Apply common style, keep disabled logic */}
             <Button
               onPress={handleSave}
               disabled={!name.trim()}
               style={commonButtonStyle}
             >
               <Text style={{ color: textColor }}>Save</Text>
             </Button>
           </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end', // Position modal at the bottom initially
    margin: 0,
  },
  content: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  emojiButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
  },
  emojiButtonText: {
    fontSize: 26,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  keyboardContainer: {
    height: 250, // Adjust height as needed for the keyboard
    marginTop: 10,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
  },
});

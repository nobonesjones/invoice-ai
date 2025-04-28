import React from 'react';
import { useColorScheme, View } from 'react-native'; 
import { EmojiKeyboard } from 'rn-emoji-keyboard'; 
import { colors } from '@/constants/colors';

interface EmojiPickerModalProps {
  isVisible: boolean;
  onClose: () => void;
  onEmojiSelected: (emoji: string) => void;
}

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({ isVisible, onClose, onEmojiSelected }) => {
  const scheme = useColorScheme();
  const themeColors = colors[scheme || 'light'];

  const handleEmojiSelect = (emojiObject: { emoji: string }) => {
    onEmojiSelected(emojiObject.emoji); 
    onClose(); // Call parent's onClose to hide the keyboard
  };

  // Render EmojiKeyboard conditionally based on isVisible
  return isVisible ? (
    <EmojiKeyboard
      onEmojiSelected={handleEmojiSelect}
      // Removed invalid onClose prop
    />
  ) : null; // Render nothing if not visible
};

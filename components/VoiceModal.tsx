import React, { useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions, Keyboard, Modal } from 'react-native';
import { X, Mic } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { useVoiceChat } from '@/hooks/useVoiceChat';

interface VoiceModalProps {
  isVisible: boolean;
  onClose: () => void;
  businessSettings?: any;
}

const { width: screenWidth } = Dimensions.get('window');

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isVisible,
  onClose,
  businessSettings
}) => {
  const { theme } = useTheme();
  const { isRecording, isPlaying, startVoiceChat, stopVoiceChat } = useVoiceChat();
  
  // Waveform animation
  const waveforms = useRef([...Array(5)].map(() => new Animated.Value(0.3))).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Handle modal presentation
  useEffect(() => {
    if (isVisible) {
      // Dismiss keyboard before showing modal
      Keyboard.dismiss();
    }
  }, [isVisible]);

  // Animate waveforms when recording
  useEffect(() => {
    if (isRecording) {
      // Start waveform animation
      const animations = waveforms.map((wave, index) => 
        Animated.loop(
          Animated.sequence([
            Animated.timing(wave, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 300 + index * 100,
              useNativeDriver: false,
            }),
            Animated.timing(wave, {
              toValue: Math.random() * 0.8 + 0.2,
              duration: 300 + index * 100,
              useNativeDriver: false,
            }),
          ])
        )
      );
      
      animations.forEach(anim => anim.start());

      // Pulse animation for mic button
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      return () => {
        animations.forEach(anim => anim.stop());
        pulseAnim.stopAnimation();
      };
    } else {
      // Reset animations
      waveforms.forEach(wave => wave.setValue(0.3));
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  const handleVoiceToggle = useCallback(async () => {
    if (isRecording) {
      await stopVoiceChat();
    } else {
      // Prepare currency context if business settings are loaded
      const currencyContext = businessSettings ? {
        currency: businessSettings.currency,
        symbol: businessSettings.currency_symbol
      } : undefined;
      
      await startVoiceChat(currencyContext);
    }
  }, [isRecording, startVoiceChat, stopVoiceChat, businessSettings]);

  const handleClose = useCallback(() => {
    if (isRecording) {
      stopVoiceChat();
    }
    onClose();
  }, [isRecording, stopVoiceChat, onClose]);

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      {/* Backdrop */}
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
      }}>
        <TouchableOpacity 
          style={{ flex: 1 }} 
          onPress={handleClose}
          activeOpacity={1}
        />
        
        {/* Modal Content - 25% of screen height */}
        <View style={{
          height: Dimensions.get('window').height * 0.25,
          backgroundColor: theme.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 24,
          paddingVertical: 16,
        }}>
          {/* Header with close button */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: '600', 
              color: theme.foreground 
            }}>
              Voice Chat
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={theme.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Main content area */}
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {/* Waveform visualization */}
            <View style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 16,
              height: 40
            }}>
              {waveforms.map((wave, index) => (
                <Animated.View
                  key={index}
                  style={{
                    width: 4,
                    backgroundColor: isRecording ? theme.primary : theme.mutedForeground,
                    marginHorizontal: 2,
                    borderRadius: 2,
                    height: wave.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 32],
                    }),
                  }}
                />
              ))}
            </View>

            {/* Status text */}
            <Text style={{ 
              fontSize: 14, 
              color: theme.mutedForeground, 
              textAlign: 'center',
              marginBottom: 16
            }}>
              {isRecording ? 'Listening...' : isPlaying ? 'Playing response...' : 'Tap to start voice chat'}
            </Text>

            {/* Voice button */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                onPress={handleVoiceToggle}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 30,
                  backgroundColor: isRecording ? '#EF4444' : theme.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3.84,
                  elevation: 5,
                }}
              >
                <Mic size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </View>
    </Modal>
  );
}; 
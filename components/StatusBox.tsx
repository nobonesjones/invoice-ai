import React, { useEffect, useRef, useState } from 'react';
import { View, Animated } from 'react-native';
import { Text } from './ui/text';

interface StatusBoxProps {
  message: string;
  theme: any;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ message, theme }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [animatedMessage, setAnimatedMessage] = useState(message);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  // Animate dots for all active status messages (not "Done")
  useEffect(() => {
    const isActiveStatus = message.includes('Thinking') || 
                          message.includes('Creating') || 
                          message.includes('Updating') || 
                          message.includes('Managing');
    
    if (isActiveStatus && !message.includes('Done')) {
      let dotCount = 1;
      const interval = setInterval(() => {
        const dots = '.'.repeat(dotCount);
        const spaces = '\u00A0'.repeat(3 - dotCount); // Non-breaking spaces to maintain width
        
        // Extract the base message without existing dots
        const baseMessage = message.replace(/\.+$/, '');
        setAnimatedMessage(`${baseMessage}${dots}${spaces}`);
        dotCount = dotCount >= 3 ? 1 : dotCount + 1;
      }, 500);

      return () => clearInterval(interval);
    } else {
      setAnimatedMessage(message);
    }
  }, [message]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ scale: scaleAnim }],
        backgroundColor: theme.card,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: theme.primary + '20',
        shadowColor: theme.primary,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
      }}
    >
      <Text 
        style={{ 
          color: theme.primary, 
          fontSize: 14,
          fontWeight: '500',
          textAlign: 'center',
        }}
      >
        {animatedMessage}
      </Text>
    </Animated.View>
  );
};
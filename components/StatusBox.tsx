import React, { useEffect, useRef } from 'react';
import { View, Animated } from 'react-native';
import { Text } from './ui/text';

interface StatusBoxProps {
  message: string;
  theme: any;
}

export const StatusBox: React.FC<StatusBoxProps> = ({ message, theme }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

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
        {message}
      </Text>
    </Animated.View>
  );
};
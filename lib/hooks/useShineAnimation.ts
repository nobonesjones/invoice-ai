import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';

interface ShineAnimationConfig {
  duration?: number;
  delay?: number;
  outputRange?: [number, number];
}

export const useShineAnimation = (config?: ShineAnimationConfig) => {
  const { 
    duration = 1000, 
    delay = 3000, 
    outputRange = [-200, 200] 
  } = config || {};

  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: duration,
          useNativeDriver: true,
        }),
        Animated.delay(delay),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 0, // Instant reset
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [animatedValue, duration, delay]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: outputRange,
  });

  return translateX;
};

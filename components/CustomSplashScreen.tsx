import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Image, Dimensions, useColorScheme } from 'react-native';

interface CustomSplashScreenProps {
  onLoadingComplete?: () => void;
  loadingProgress?: number;
}

const { width, height } = Dimensions.get('window');

export const CustomSplashScreen: React.FC<CustomSplashScreenProps> = ({ 
  onLoadingComplete, 
  loadingProgress = 0 
}) => {
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Animate logo entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    // Animate progress bar
    Animated.timing(progressAnim, {
      toValue: loadingProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Call onLoadingComplete when progress reaches 100
    if (loadingProgress >= 100 && onLoadingComplete) {
      setTimeout(() => {
        onLoadingComplete();
      }, 300); // Wait for animation to complete
    }
  }, [loadingProgress, onLoadingComplete]);

  const backgroundColor = isLightMode ? '#ffffff' : '#000000';
  const progressBarColor = isLightMode ? '#14B8A6' : '#14B8A6';
  const progressBarBackground = isLightMode ? '#f3f4f6' : '#374151';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Animated.View 
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: logoScaleAnim }]
          }
        ]}
      >
        <Image
          source={require('../assets/superinvoiceicon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.View style={[styles.progressContainer, { opacity: fadeAnim }]}>
        <View style={[styles.progressBarBackground, { backgroundColor: progressBarBackground }]}>
          <Animated.View 
            style={[
              styles.progressBarFill,
              { 
                backgroundColor: progressBarColor,
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                  extrapolate: 'clamp',
                })
              }
            ]}
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    width: 100, // Further reduced size for splash screen
    height: 100, // Further reduced size for splash screen
    borderRadius: 20,
  },
  progressContainer: {
    position: 'absolute',
    bottom: height * 0.3, // Position slightly higher
    width: width * 0.7, // 70% of screen width for better visibility
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 6, // Slightly thicker for better visibility
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 12, // Larger minimum width for visual feedback
  },
});

export default CustomSplashScreen; 
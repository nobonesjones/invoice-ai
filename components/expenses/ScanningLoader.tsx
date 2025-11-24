import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';

export type ScanningStage = 'uploading' | 'scanning' | 'finalizing' | 'success';

interface ScanningLoaderProps {
  visible: boolean;
  stage: ScanningStage;
}

const STAGE_CONFIG = {
  uploading: {
    title: 'Uploading receipt...',
    subtitle: 'Just a moment',
  },
  scanning: {
    title: 'Scanning receipt...',
    subtitle: "This won't take long",
  },
  finalizing: {
    title: 'Almost there...',
    subtitle: 'Finalizing details',
  },
  success: {
    title: 'Done!',
    subtitle: 'Receipt scanned',
  },
};

export const ScanningLoader: React.FC<ScanningLoaderProps> = ({ visible, stage }) => {
  const { theme } = useTheme();

  // Animations
  const scanLinePosition = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  // Scanning line animation (moves down the receipt)
  useEffect(() => {
    if (visible && (stage === 'scanning' || stage === 'uploading')) {
      // Reset and start scanning animation
      scanLinePosition.setValue(0);

      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLinePosition, {
            toValue: 1,
            duration: 2000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(scanLinePosition, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible, stage]);

  // Pulse animation for finalizing stage
  useEffect(() => {
    if (visible && stage === 'finalizing') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible, stage]);

  // Success animation
  useEffect(() => {
    if (stage === 'success') {
      Animated.spring(successScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }).start();
    } else {
      successScale.setValue(0);
    }
  }, [stage]);

  // Fade in animation
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const config = STAGE_CONFIG[stage];

  // Calculate scan line position (moves down the receipt icon area)
  const scanLineTranslateY = scanLinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 80], // Moves from top to bottom of the receipt icon
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View
          style={[
            styles.container,
            { opacity: fadeAnim }
          ]}
        >
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {/* Receipt Icon Container with Scanning Effect */}
            <View style={styles.iconContainer}>
              <Animated.View
                style={[
                  styles.iconWrapper,
                  stage === 'finalizing' && { transform: [{ scale: pulseAnim }] },
                  stage === 'success' && { transform: [{ scale: successScale }] },
                ]}
              >
                <Receipt
                  size={80}
                  color={stage === 'success' ? '#22c55e' : theme.primary}
                  strokeWidth={1.5}
                />

                {/* Scanning Line Effect */}
                {(stage === 'scanning' || stage === 'uploading') && (
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        backgroundColor: theme.primary,
                        transform: [{ translateY: scanLineTranslateY }],
                      },
                    ]}
                  />
                )}

                {/* Success Checkmark Overlay */}
                {stage === 'success' && (
                  <Animated.View
                    style={[
                      styles.successBadge,
                      {
                        backgroundColor: '#22c55e',
                        transform: [{ scale: successScale }],
                      },
                    ]}
                  >
                    <Text style={styles.successCheckmark}>✓</Text>
                  </Animated.View>
                )}
              </Animated.View>

              {/* Animated Dots for Scanning */}
              {(stage === 'scanning' || stage === 'uploading') && (
                <View style={styles.scanningDots}>
                  <AnimatedDot delay={0} color={theme.primary} />
                  <AnimatedDot delay={200} color={theme.primary} />
                  <AnimatedDot delay={400} color={theme.primary} />
                </View>
              )}
            </View>

            {/* Text Content */}
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: theme.foreground }]}>
                {config.title}
              </Text>
              <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                {config.subtitle}
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// Animated Dot Component
const AnimatedDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          opacity,
        },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    width: 320,
    height: 320,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  iconWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanLine: {
    position: 'absolute',
    width: 100,
    height: 3,
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  successBadge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  successCheckmark: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanningDots: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textContainer: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
    maxWidth: '100%',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: '100%',
  },
});

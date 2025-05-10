import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, useColorScheme as useDeviceColorScheme, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { Button } from '@/components/ui/button';
import { StepIndicator } from '@/components/ui/step-indicator';
import ShiningText from '@/components/ui/ShiningText';
import { P } from '@/components/ui/typography';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';

export default function OnboardingScreen1() {
  const router = useRouter();
  const deviceColorScheme = useDeviceColorScheme() ?? 'light';
  const isDeviceLightMode = deviceColorScheme === 'light';

  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = Animated.sequence([
      Animated.timing(translateY, {
        toValue: 5,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 1500,
        useNativeDriver: true,
      }),
    ]);

    Animated.loop(bounce).start();
  }, [translateY]);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding-2');
  };

  return (
    <SafeAreaView className={`flex-1 bg-background ${!isDeviceLightMode ? 'dark' : ''}`}>
      <View style={styles.container}>
        <StepIndicator currentStep={1} totalSteps={3} />

        {/* Image Box */}
        <View
          style={styles.box}
        >
          <Animated.View
            style={{
              width: '100%',
              height: '100%',
              transform: [{ translateY }],
            }}
          >
            <View
              className="w-full h-full bg-gray-300 rounded-lg"
            />
          </Animated.View>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <ShiningText
            text="Onboarding 1"
            className="text-3xl font-bold text-center text-foreground mb-4"
          />
          <P style={[styles.description, { color: colors[deviceColorScheme].mutedForeground }]}>Something about the app...</P>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button */}
        <Button 
          onPress={handleNext} 
          className="w-full dark:bg-white dark:text-primary"
        >
          Get Started
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  box: {
    width: '80%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderRadius: 10,
    overflow: 'hidden',
    padding: 10,
    marginTop: 30,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
    marginTop: 60,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  spacer: {
    flex: 1,
  },
});

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, useColorScheme as useDeviceColorScheme, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { StepIndicator } from '@/components/ui/step-indicator';
import ShiningText from '@/components/ui/ShiningText';
import { P } from '@/components/ui/typography';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';

export default function OnboardingScreen2() {
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
    router.push('/onboarding-3');
  };

  return (
    <SafeAreaView className={`flex-1 bg-background ${!isDeviceLightMode ? 'dark' : ''}`}>
      <View style={styles.container}>
        <StepIndicator currentStep={2} totalSteps={3} />

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

        <View style={styles.textContainer}>
          <ShiningText
            text="Onboarding 2"
            className="text-3xl font-bold text-center text-foreground mb-4"
          />
          <P style={[styles.description, { color: colors[deviceColorScheme].mutedForeground }]}>Something else about the app...</P>
        </View>

        <View style={styles.spacer} />

        <Button 
          onPress={handleNext} 
          className="w-full dark:bg-white dark:text-primary"
        >
          Continue
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
    padding: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    width: '100%', 
    position: 'absolute', 
    top: 10, 
  },
  stepIndicator: {
    height: 8,
    width: 60,
    borderRadius: 4,
    marginHorizontal: 5,
  },
  stepIndicatorActive: {
  },
  box: {
    width: '80%',
    aspectRatio: 1, 
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 30,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
    marginTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  spacer: {
    flex: 1, 
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25, 
    width: '90%',
    alignItems: 'center',
    marginBottom: 20, 
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

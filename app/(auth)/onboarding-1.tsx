import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, useColorScheme, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { Button } from '@/components/ui/button';
import { StepIndicator } from '@/components/ui/step-indicator';
import ShiningText from '@/components/ui/ShiningText';
import { P } from '@/components/ui/typography';
import * as Haptics from 'expo-haptics';

export default function OnboardingScreen1() {
  const router = useRouter();
  const { theme } = useTheme();
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
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
            <Image
              source={require('../../assets/1light.png')}
              className="w-full h-full"
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <ShiningText
            text="Easily Record Meetings"
            className="text-3xl font-bold text-center text-foreground mb-4"
          />
          <P style={[styles.description, { color: theme.mutedForeground }]}>Get crystal clear summaries, minutes and action items in seconds.</P>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button */}
        <Button onPress={handleNext} className="w-full">
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

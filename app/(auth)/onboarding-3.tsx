import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, useColorScheme as useDeviceColorScheme, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { StepIndicator } from '@/components/ui/step-indicator';
import ShiningText from '@/components/ui/ShiningText';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';

export default function OnboardingScreen3() {
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
    router.replace('/(app)/welcome'); 
  };

  const imageSource = isDeviceLightMode
    ? require('../../assets/3light.png')
    : require('../../assets/3dark.png');

  return (
    <SafeAreaView className={`flex-1 bg-background ${!isDeviceLightMode ? 'dark' : ''}`}>
      <View style={styles.container}>
        <StepIndicator currentStep={3} totalSteps={3} />

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
              source={imageSource}
              className="w-full h-full"
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        <View className="items-center mb-12">
          <ShiningText
            text="Share Everything Instantly"
            className="text-3xl font-bold text-center text-foreground mb-4"
          />
          <Text style={[styles.description, { color: colors[deviceColorScheme].mutedForeground }]}>
            Replay audio, read transcripts and share minutes with one tap.
          </Text>
        </View>

        {/* Action Button */}
        <Button onPress={handleNext} className="w-full dark:bg-white dark:text-primary">
          Sign Up
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
    paddingBottom: 40,
  },
  box: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 10,
    padding: 10,
    marginTop: 30,
  },
  description: {
    textAlign: 'center',
    fontSize: 18,
  },
});

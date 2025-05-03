import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, Image, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '../../constants/colors';
import { StepIndicator } from '@/components/ui/step-indicator'; 
import { Button } from '@/components/ui/button'; 
import ShiningText from '@/components/ui/ShiningText'; 
import * as Haptics from 'expo-haptics';

export default function OnboardingScreen2() {
  const router = useRouter();
  const { theme } = useTheme();
  const currentSchemeString = theme === 'light' ? 'light' : 'dark';
  const themeColors = colors[currentSchemeString];

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
    // Navigate to the onboarding-3 screen
    router.push('/onboarding-3');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <View style={styles.container}>
        <StepIndicator currentStep={2} totalSteps={3} />

        {/* Image Placeholder Box */}
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
              source={require('../../assets/2light.png')}
              className="w-full h-full"
              resizeMode="contain"
            />
          </Animated.View>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <ShiningText
            text="Save Hours Every Week"
            className="text-3xl font-bold text-center text-foreground mb-4"
          />
          <Text style={[styles.description, { color: theme.mutedForeground }]}>Leave the notes to AI, focus on having great meetings.</Text>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Button */}
        <Button onPress={handleNext} className="w-full">
          Continue
        </Button>
      </View>
    </SafeAreaView>
  );
}

// Reuse styles from OnboardingScreen1, potentially extract to a common file later
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
    width: '100%', // Ensure indicators span width
    position: 'absolute', // Position at the top
    top: 10, // Adjust as needed from safe area edge
  },
  stepIndicator: {
    height: 8,
    width: 60,
    borderRadius: 4,
    // backgroundColor: '#E0E0E0', // Removed static color
    marginHorizontal: 5,
  },
  stepIndicatorActive: {
    // backgroundColor: '#007AFF', // Removed static color
  },
  box: {
    width: '80%',
    aspectRatio: 1, // Square placeholder
    // backgroundColor: '#EEEEEE', // Removed static color
    borderRadius: 10,
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
    flex: 1, // Pushes button to the bottom
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25, // Rounded corners
    width: '90%',
    alignItems: 'center',
    marginBottom: 20, // Space from bottom edge
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

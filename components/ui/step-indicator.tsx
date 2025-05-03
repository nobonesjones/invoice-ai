import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/context/theme-provider';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, totalSteps }) => {
  const { theme } = useTheme();
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      {steps.map((step) => (
        <View
          key={step}
          style={[
            styles.bar,
            {
              backgroundColor: step === currentStep ? theme.primary : theme.border,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    gap: 8,
    width: '80%',
    alignSelf: 'center',
    marginBottom: 20,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
});

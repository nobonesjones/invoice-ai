import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { CheckCircle, Circle } from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';

// Define the processing steps in order
const STEPS = [
  { key: 'uploading', label: 'Uploading Audio' },
  { key: 'transcribing', label: 'Transcribing Audio' },
  { key: 'generating', label: 'Generating Minutes' },
  { key: 'finishing', label: 'Finishing Touches' },
];

export type ProcessingStepKey = 'uploading' | 'transcribing' | 'generating' | 'finishing';

interface ProcessingIndicatorProps {
  currentStep: ProcessingStepKey | null; // The key of the currently active step
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ currentStep }) => {
  const { theme } = useTheme();
  const currentStepIndex = currentStep ? STEPS.findIndex(step => step.key === currentStep) : -1;

  return (
    <View style={styles.container}>
      {/* Title outside the card */}
      <Text style={[styles.title, { color: theme.foreground }]}>Processing Recording</Text>

      {/* Card container for steps */}
      <View style={[styles.card, { backgroundColor: theme.card, shadowColor: '#000' }]}>
        {STEPS.map((step, index) => {
          const isCompleted = currentStepIndex > index;
          const isActive = currentStepIndex === index;
          const isPending = currentStepIndex < index;

          let IconComponent;
          let iconColor = theme.mutedForeground;

          if (isCompleted) {
            IconComponent = CheckCircle;
            iconColor = '#23e200'; // Update completed icon color
          } else if (isActive) {
            IconComponent = ActivityIndicator; // Use ActivityIndicator for active step
            iconColor = theme.primary; // Keep active color as theme primary
          } else { // Pending
            IconComponent = Circle;
          }

          return (
            <View key={step.key} style={styles.stepContainer}>
              <View style={styles.iconWrapper}>
                {isActive ? (
                  <ActivityIndicator size="small" color={iconColor} />
                ) : (
                  <IconComponent size={20} color={iconColor} />
                )}
              </View>
              <View style={styles.stepTextContainer}>
                <Text 
                  style={[
                    styles.stepText,
                    { color: isCompleted || isActive ? theme.foreground : theme.mutedForeground },
                    isActive && styles.activeStepText
                  ]}
                >
                  {step.label}
                </Text>
                {/* Simple Visual Progress Bar Placeholder */}
                <View style={[styles.progressBarBackground, { backgroundColor: theme.border }]}>
                  <View style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: theme.primary,
                      width: isCompleted ? '100%' : isActive ? '50%' : '0%' // Placeholder: 100% done, 50% active, 0% pending
                    }
                  ]} />
                </View>
              </View>
            </View>
          );
        })}
      </View> 

      {/* Footer text below the card */}
      <Text style={[styles.footerText, { color: theme.mutedForeground }]}>
        The robots are working... your minutes will be ready soon.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 15, // Adjust overall horizontal padding if needed
    alignItems: 'stretch', // Stretch items to fill width
    width: '100%',
  },
  title: {
      fontSize: 22, // Increased size like Profile headings
      fontWeight: '600',
      marginBottom: 15, // Spacing below title
      paddingHorizontal: 5, // Align with card padding
      // Removed alignSelf: 'center' - default is left
  },
  card: {
    borderRadius: 15, // Rounded corners
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginBottom: 20, // Space between card and footer text
    // Shadow properties
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3, // for Android
  },
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20, // Keep spacing between steps
    width: '100%',
  },
  iconWrapper: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  stepTextContainer: { // Added container for text and progress bar
    flex: 1, // Take remaining space
  },
  stepText: {
    fontSize: 16,
    marginBottom: 5, // Space between text and progress bar
  },
  activeStepText: {
    fontWeight: '500',
  },
  progressBarBackground: {
    height: 4, 
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  footerText: {
      marginTop: 0, // Reset margin, controlled by card marginBottom
      fontSize: 13,
      textAlign: 'center',
      paddingHorizontal: 10,
      alignSelf: 'center',
  }
});

export default ProcessingIndicator;

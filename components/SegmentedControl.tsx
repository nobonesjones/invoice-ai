import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onSelectionChange: (index: number) => void;
  style?: any;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  selectedIndex,
  onSelectionChange,
  style,
}) => {
  const colorScheme = useColorScheme();
  const themeColors = colors[colorScheme || 'light'];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.muted }, style]}>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        
        return (
          <TouchableOpacity
            key={option}
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: themeColors.background,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
                elevation: 2,
              }
            ]}
            onPress={() => onSelectionChange(index)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: isSelected 
                    ? themeColors.foreground 
                    : themeColors.mutedForeground,
                  fontWeight: isSelected ? '600' : '500',
                }
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    padding: 2,
    height: 36,
  },
  segment: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    marginHorizontal: 1,
  },
  segmentText: {
    fontSize: 14,
  },
}); 
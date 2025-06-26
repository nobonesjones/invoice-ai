import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';

interface ColorOption {
  id: string;
  name: string;
  color: string;
}

interface ColorSelectorProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const COLOR_OPTIONS: ColorOption[] = [
  { id: 'navy', name: 'Navy', color: '#1E40AF' },
  { id: 'blue', name: 'Blue', color: '#3B82F6' },
  { id: 'purple', name: 'Purple', color: '#8B5CF6' },
  { id: 'green', name: 'Green', color: '#10B981' },
  { id: 'orange', name: 'Orange', color: '#F59E0B' },
  { id: 'red', name: 'Red', color: '#EF4444' },
  { id: 'pink', name: 'Pink', color: '#EC4899' },
  { id: 'turquoise', name: 'Turquoise', color: '#14B8A6' },
];

export const ColorSelector: React.FC<ColorSelectorProps> = ({
  selectedColor,
  onColorSelect,
}) => {
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const themeColors = colors[colorScheme || 'light'];

  return (
    <View style={styles.container}>
      <View style={styles.colorGrid}>
        {COLOR_OPTIONS.map((colorOption) => {
          const isSelected = selectedColor === colorOption.color;
          
          return (
            <TouchableOpacity
              key={colorOption.id}
              style={[
                styles.colorOption,
                isSelected && styles.selectedColorOption,
                { 
                  shadowColor: isLightMode ? '#000' : '#fff',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isLightMode ? 0.1 : 0.3,
                  shadowRadius: 4,
                  elevation: 3,
                }
              ]}
              onPress={() => onColorSelect(colorOption.color)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.colorSwatch,
                  { backgroundColor: colorOption.color }
                ]}
              >
                {isSelected && (
                  <Check 
                    size={20} 
                    color="white" 
                    strokeWidth={3}
                  />
                )}
              </View>
              <Text style={[styles.colorName, { color: themeColors.foreground }]}>
                {colorOption.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 31,
    paddingBottom: -2,
    paddingHorizontal: 20,
    backgroundColor: 'white',
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    height: 140, // Increased height to match design selector
  },
  colorOption: {
    width: '22%', // 4 colors per row with spacing
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectedColorOption: {
    transform: [{ scale: 1.05 }],
  },
  colorSwatch: {
    width: 36, // Smaller dots
    height: 36, // Smaller dots
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6, // Reduced spacing
    borderWidth: 2, // Thinner border
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  colorName: {
    fontSize: 11, // Slightly smaller text
    fontWeight: '500',
    textAlign: 'center',
  },
}); 
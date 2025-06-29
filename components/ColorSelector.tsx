import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, PanResponder, Dimensions } from 'react-native';
import { Check, Palette } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { useColorScheme } from 'react-native';
import Slider from '@react-native-community/slider';

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
  { id: 'custom', name: 'Custom', color: 'custom' },
];

// Helper function to convert HSV to RGB
const hsvToRgb = (h: number, s: number, v: number): [number, number, number] => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  
  let r = 0, g = 0, b = 0;
  
  if (h >= 0 && h < 60) {
    r = c; g = x; b = 0;
  } else if (h >= 60 && h < 120) {
    r = x; g = c; b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0; g = c; b = x;
  } else if (h >= 180 && h < 240) {
    r = 0; g = x; b = c;
  } else if (h >= 240 && h < 300) {
    r = x; g = 0; b = c;
  } else if (h >= 300 && h < 360) {
    r = c; g = 0; b = x;
  }
  
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
};

// Helper function to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number, opacity: number = 1): string => {
  if (opacity < 1) {
    const alpha = Math.round(opacity * 255);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}${alpha.toString(16).padStart(2, '0')}`;
  }
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export const ColorSelector: React.FC<ColorSelectorProps> = ({
  selectedColor,
  onColorSelect,
}) => {
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const themeColors = colors[colorScheme || 'light'];
  
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customHue, setCustomHue] = useState(180);
  const [customSaturation, setCustomSaturation] = useState(0.8);
  const [customValue, setCustomValue] = useState(0.8);
  const [customOpacity, setCustomOpacity] = useState(1);

  const handleCustomColorChange = () => {
    const [r, g, b] = hsvToRgb(customHue, customSaturation, customValue);
    const hexColor = rgbToHex(r, g, b, customOpacity);
    onColorSelect(hexColor);
  };

  const handleColorRectangleTouch = (event: any) => {
    // This function is now handled by individual color cell touches
    // but kept for potential future use
  };

  const getCurrentCustomColor = () => {
    const [r, g, b] = hsvToRgb(customHue, customSaturation, customValue);
    return rgbToHex(r, g, b, customOpacity);
  };

  const getRowFromHSV = (h: number, s: number, v: number) => {
    // Determine which row this HSV combination would appear in
    if (s >= 0.8 && v >= 0.9) return s >= 0.9 ? 0 : 1;
    if (s >= 0.6 && v >= 0.9) return s >= 0.7 ? 2 : 3;
    if (s >= 0.8 && v >= 0.7) return s >= 0.9 ? 4 : 5;
    if (s >= 0.6 && v >= 0.7) return s >= 0.7 ? 6 : 7;
    return s >= 0.5 ? 8 : 9;
  };

  const renderCustomPicker = () => (
    <View style={styles.customPickerContainer}>
      {/* Opacity Slider */}
      <View style={styles.sliderContainer}>
        <Text style={[styles.sliderLabel, { color: themeColors.foreground }]}>Opacity</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={customOpacity}
          onValueChange={(value) => {
            setCustomOpacity(value);
            handleCustomColorChange();
          }}
          minimumTrackTintColor={getCurrentCustomColor()}
          maximumTrackTintColor="#ddd"
          thumbStyle={{ backgroundColor: getCurrentCustomColor() }}
        />
      </View>

      {/* Color Rectangle */}
      <View style={styles.colorRectangleContainer}>
        <TouchableOpacity
          style={[
            styles.colorRectangle,
            { backgroundColor: `hsl(${customHue}, 100%, 50%)` }
          ]}
          onPress={handleColorRectangleTouch}
          activeOpacity={1}
        >
          {/* Create a comprehensive color grid with ALL colors */}
          {Array.from({ length: 10 }, (_, row) => (
            <View key={row} style={styles.colorRow}>
              {Array.from({ length: 28 }, (_, col) => {
                // Create a full spectrum grid
                // First 24 columns: Full hue spectrum with varying saturation/value
                // Last 4 columns: Grayscale
                
                let hue, saturation, value;
                
                if (col < 24) {
                  // Full color spectrum - 24 hues across the rainbow
                  hue = (col / 23) * 360; // 0 to 360 degrees
                  
                  // Vary saturation and value based on row
                  if (row < 2) {
                    // Top 2 rows: High saturation, high value (bright colors)
                    saturation = 0.9 - (row * 0.1);
                    value = 1;
                  } else if (row < 4) {
                    // Next 2 rows: Medium saturation, high value
                    saturation = 0.7 - ((row - 2) * 0.1);
                    value = 1;
                  } else if (row < 6) {
                    // Next 2 rows: High saturation, medium value
                    saturation = 0.9 - ((row - 4) * 0.1);
                    value = 0.8;
                  } else if (row < 8) {
                    // Next 2 rows: Medium saturation, medium value
                    saturation = 0.7 - ((row - 6) * 0.1);
                    value = 0.8;
                  } else {
                    // Bottom 2 rows: Lower saturation and value (muted colors)
                    saturation = 0.5 - ((row - 8) * 0.1);
                    value = 0.6;
                  }
                } else {
                  // Grayscale section (last 4 columns)
                  hue = 0;
                  saturation = 0;
                  value = 1 - ((row / 9) * 0.9); // White to near-black
                }
                
                const [r, g, b] = hsvToRgb(hue, saturation, value);
                const color = `rgb(${r}, ${g}, ${b})`;
                
                return (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.colorCell,
                      { backgroundColor: color }
                    ]}
                    onPress={() => {
                      setCustomHue(hue);
                      setCustomSaturation(saturation);
                      setCustomValue(value);
                      const hexColor = rgbToHex(r, g, b, customOpacity);
                      onColorSelect(hexColor);
                    }}
                  />
                );
              })}
            </View>
          ))}
          
          {/* Selection indicator - positioned based on current color */}
          <View
            style={[
              styles.colorSelector,
              {
                left: (customHue / 360) * (24 * (320/28)) - 6, // Position based on hue across 24 color columns with new width
                top: getRowFromHSV(customHue, customSaturation, customValue) * 14 - 6, // Updated for new row height
              }
            ]}
          />
        </TouchableOpacity>
      </View>


    </View>
  );

  if (showCustomPicker) {
    return (
      <View style={[styles.container, { paddingTop: 5 }]}>
        {renderCustomPicker()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.colorGrid}>
        {COLOR_OPTIONS.map((colorOption) => {
          const isCustom = colorOption.id === 'custom';
          const isSelected = !isCustom && selectedColor === colorOption.color;
          
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
              onPress={() => {
                if (isCustom) {
                  setShowCustomPicker(true);
                } else {
                  onColorSelect(colorOption.color);
                }
              }}
              activeOpacity={0.8}
            >
              {isCustom ? (
                <View style={[styles.colorSwatch, styles.customColorSwatch]}>
                  <Palette 
                    size={20} 
                    color={themeColors.foreground} 
                    strokeWidth={2}
                  />
                </View>
              ) : (
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
              )}
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
  customColorSwatch: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ddd',
  },
  colorName: {
    fontSize: 11, // Slightly smaller text
    fontWeight: '500',
    textAlign: 'center',
  },
  // Custom Picker Styles
  customPickerContainer: {
    height: 170,
    paddingTop: 0,
  },
  colorRectangleContainer: {
    alignItems: 'center',
    marginBottom: 6,
  },
  colorRectangle: {
    width: 320, // Increased width
    height: 140, // Much larger height
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  colorRow: {
    flexDirection: 'row',
    height: 14, // 140 height / 10 rows
  },
  colorCell: {
    flex: 1,
    height: 14,
  },
  colorSelector: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
    backgroundColor: 'transparent',
  },
  sliderContainer: {
    marginBottom: 2,
    marginTop: 0,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 1,
    marginTop: 0,
  },
  slider: {
    width: 320, // Match the color rectangle width
    height: 20,
    alignSelf: 'center',
  },

}); 
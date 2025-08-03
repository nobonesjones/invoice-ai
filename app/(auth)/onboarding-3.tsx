import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
  TextInput,
  Platform,
  ScrollView,
  Pressable,
  Alert,
  Keyboard,
  StatusBar,
  Dimensions,
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useOnboarding } from "@/context/onboarding-provider";

const REGIONS = [
  { label: 'Select Region', value: '', flag: '' },
  
  // Major English-speaking countries
  { label: '🇺🇸 United States', value: 'US', flag: '🇺🇸' },
  { label: '🇬🇧 United Kingdom', value: 'GB', flag: '🇬🇧' },
  { label: '🇨🇦 Canada', value: 'CA', flag: '🇨🇦' },
  { label: '🇦🇺 Australia', value: 'AU', flag: '🇦🇺' },
  { label: '🇳🇿 New Zealand', value: 'NZ', flag: '🇳🇿' },
  
  // European Union Countries (Eurozone)
  { label: '🇩🇪 Germany', value: 'DE', flag: '🇩🇪' },
  { label: '🇫🇷 France', value: 'FR', flag: '🇫🇷' },
  { label: '🇪🇸 Spain', value: 'ES', flag: '🇪🇸' },
  { label: '🇮🇹 Italy', value: 'IT', flag: '🇮🇹' },
  { label: '🇳🇱 Netherlands', value: 'NL', flag: '🇳🇱' },
  { label: '🇧🇪 Belgium', value: 'BE', flag: '🇧🇪' },
  { label: '🇦🇹 Austria', value: 'AT', flag: '🇦🇹' },
  { label: '🇮🇪 Ireland', value: 'IE', flag: '🇮🇪' },
  { label: '🇵🇹 Portugal', value: 'PT', flag: '🇵🇹' },
  { label: '🇫🇮 Finland', value: 'FI', flag: '🇫🇮' },
  { label: '🇬🇷 Greece', value: 'GR', flag: '🇬🇷' },
  { label: '🇱🇺 Luxembourg', value: 'LU', flag: '🇱🇺' },
  { label: '🇸🇮 Slovenia', value: 'SI', flag: '🇸🇮' },
  { label: '🇸🇰 Slovakia', value: 'SK', flag: '🇸🇰' },
  { label: '🇪🇪 Estonia', value: 'EE', flag: '🇪🇪' },
  { label: '🇱🇻 Latvia', value: 'LV', flag: '🇱🇻' },
  { label: '🇱🇹 Lithuania', value: 'LT', flag: '🇱🇹' },
  { label: '🇲🇹 Malta', value: 'MT', flag: '🇲🇹' },
  { label: '🇨🇾 Cyprus', value: 'CY', flag: '🇨🇾' },
  { label: '🇭🇷 Croatia', value: 'HR', flag: '🇭🇷' },
  
  // European Union (Non-Eurozone)
  { label: '🇧🇬 Bulgaria', value: 'BG', flag: '🇧🇬' },
  { label: '🇨🇿 Czech Republic', value: 'CZ', flag: '🇨🇿' },
  { label: '🇭🇺 Hungary', value: 'HU', flag: '🇭🇺' },
  { label: '🇵🇱 Poland', value: 'PL', flag: '🇵🇱' },
  { label: '🇷🇴 Romania', value: 'RO', flag: '🇷🇴' },
  { label: '🇸🇪 Sweden', value: 'SE', flag: '🇸🇪' },
  { label: '🇩🇰 Denmark', value: 'DK', flag: '🇩🇰' },
  
  // Other European Countries
  { label: '🇨🇭 Switzerland', value: 'CH', flag: '🇨🇭' },
  { label: '🇳🇴 Norway', value: 'NO', flag: '🇳🇴' },
  
  // Middle East
  { label: '🇦🇪 United Arab Emirates', value: 'AE', flag: '🇦🇪' },
  
  { label: '🌍 Other', value: 'OTHER', flag: '🌍' },
];

export default function OnboardingScreen3() {
	const router = useRouter();
  const { theme } = useTheme();
  const { updateBusinessInfo, onboardingData, loadOnboardingData } = useOnboarding();
  const nameInputRef = useRef<TextInput>(null);

  const [businessName, setBusinessName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [isNameInputFocused, setIsNameInputFocused] = useState(true);

  // Hide status bar for immersive experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  // Auto-focus name input when screen loads
	useEffect(() => {
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, []);

  const isFormValid = businessName.trim().length > 0 && selectedRegion.length > 0;

  const handleContinue = () => {
    if (!isFormValid) {
      Alert.alert('Required Fields', 'Please fill in all required fields to continue.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Store the business info using the onboarding context
    console.log('[Onboarding3] Saving business info:', { businessName, selectedRegion });
    updateBusinessInfo({ businessName, selectedRegion });
    
    router.push("/(auth)/onboarding-4");
  };

  const handleRegionPress = () => {
    Keyboard.dismiss(); // Hide the keyboard
    if (nameInputRef.current) {
      nameInputRef.current.blur(); // Programmatically blur the input
    }
    setIsNameInputFocused(false); // Remove focus from name input
    setShowRegionPicker(true);
  };

  const styles = getStyles(theme);

	return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.backgroundContainer}>
        {/* Background - placeholder gradient, replace with actual image */}
        <LinearGradient
          colors={['#F8FAFC', '#F1F5F9', '#E2E8F0']}
          style={styles.background}
        >
          {/* Content overlay */}
          <View style={[styles.overlay, { backgroundColor: `${theme.card}E6` }]}>
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.contentContainer}>
                {/* Header */}
                <View style={styles.headerContent}>
                  <Text style={[styles.headline, { color: theme.foreground }]}>Business Info</Text>
                  <Text style={[styles.subtitle, { color: theme.mutedForeground }]}>
                    Help us tailor your invoices with your business name.
                  </Text>
				</View>

                {/* Form */}
                <View style={styles.formContainer}>
                  {/* Name Input */}
                  <View style={styles.inputContainer}>
                    <View style={[
                      styles.inputWrapper, 
                      { 
                        backgroundColor: theme.card, 
                        borderColor: isNameInputFocused ? theme.primary : theme.border,
                        borderWidth: isNameInputFocused ? 2 : 1
                      }
                    ]}>
                      <Ionicons 
                        name="business" 
                        size={20} 
                        color={isNameInputFocused ? theme.primary : theme.mutedForeground} 
                        style={styles.inputIcon}
                      />
                      <TextInput
                        ref={nameInputRef}
                        style={[styles.textInput, { color: theme.foreground }]}
                        placeholder="Name"
                        placeholderTextColor={theme.mutedForeground}
                        value={businessName}
                        onChangeText={setBusinessName}
                        autoCapitalize="words"
                        returnKeyType="next"
                        onSubmitEditing={handleRegionPress}
                        onFocus={() => setIsNameInputFocused(true)}
                        onBlur={() => setIsNameInputFocused(false)}
                      />
                    </View>
                    <Text style={[styles.helperText, { color: theme.mutedForeground }]}>
                      Required, can be edited any time
                    </Text>
                  </View>

                  {/* Region Picker */}
                  <View style={styles.inputContainer}>
                    <Pressable 
						style={[
                        styles.inputWrapper, 
                        styles.pickerWrapper,
                        { backgroundColor: theme.card, borderColor: selectedRegion ? theme.primary : theme.border }
                      ]}
                      onPress={handleRegionPress}
                    >
                      <Ionicons 
                        name="globe" 
                        size={20} 
                        color={theme.mutedForeground} 
                        style={styles.inputIcon}
                      />
                      <Text style={[
                        styles.pickerText,
                        { color: selectedRegion ? theme.foreground : theme.mutedForeground }
                      ]}>
                        {selectedRegion 
                          ? REGIONS.find(r => r.value === selectedRegion)?.label 
                          : 'Region'
                        }
                      </Text>
                      <Ionicons 
                        name="chevron-down" 
                        size={20} 
                        color={theme.mutedForeground} 
                        style={styles.chevronIcon}
                      />
                    </Pressable>
                    <Text style={[styles.helperText, { color: theme.mutedForeground }]}>
                      Required, helps us tailor your experience
                    </Text>
                  </View>
				</View>

                {/* Spacer */}
				<View style={styles.spacer} />

                {/* Button */}
                <View style={styles.buttonContainer}>
				<Button
                    onPress={handleContinue}
                    style={[
                      styles.primaryButton,
                      { backgroundColor: isFormValid ? theme.primary : theme.muted }
                    ]}
                    disabled={!isFormValid}
                  >
                    <Text style={[
                      styles.primaryButtonText,
                      { color: isFormValid ? theme.primaryForeground : theme.mutedForeground }
                    ]}>
                      Continue
                    </Text>
				</Button>
			</View>
              </View>
            </ScrollView>
          </View>
        </LinearGradient>
      </View>

      {/* Region Picker Modal */}
      {showRegionPicker && (
        <View style={styles.pickerModal}>
          <View style={[styles.pickerContainer, { backgroundColor: theme.card }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: theme.border }]}>
              <Pressable onPress={() => setShowRegionPicker(false)}>
                <Text style={[styles.pickerCancel, { color: theme.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.pickerTitle, { color: theme.foreground }]}>Select Region</Text>
              <Pressable onPress={() => setShowRegionPicker(false)}>
                <Text style={[styles.pickerDone, { color: theme.primary }]}>Done</Text>
              </Pressable>
            </View>
            <Picker
              selectedValue={selectedRegion}
              onValueChange={(value) => {
                if (value !== '') {
                  setSelectedRegion(value);
                }
              }}
              style={styles.picker}
            >
              {REGIONS.map((region) => (
                <Picker.Item 
                  key={region.value} 
                  label={region.label} 
                  value={region.value}
                  enabled={region.value !== ''}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}
		</View>
	);
}

const { height, width } = Dimensions.get('window');

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    height: height,
    width: width,
  },
  backgroundContainer: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  background: {
    flex: 1,
    height: '100%',
  },
  overlay: {
    flex: 1,
    height: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 30,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 75,
    marginBottom: 30,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  formContainer: {
		flex: 1,
	},
  inputContainer: {
    marginBottom: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
		flex: 1,
    fontSize: 16,
  },
  pickerWrapper: {
    justifyContent: 'space-between',
	},
  pickerText: {
    flex: 1,
		fontSize: 16,
  },
  chevronIcon: {
    marginLeft: 8,
	},
  helperText: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
	},
	spacer: {
		flex: 1,
    minHeight: 20,
  },
  buttonContainer: {
    paddingBottom: 30,
    paddingTop: 10,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickerModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerCancel: {
    fontSize: 16,
  },
  pickerDone: {
    fontSize: 16,
    fontWeight: '600',
  },
  picker: {
    height: 200,
	},
});
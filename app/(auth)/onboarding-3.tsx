import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Platform,
  ScrollView,
  Pressable,
  Alert,
  Keyboard,
} from "react-native";
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useOnboarding } from "@/context/onboarding-provider";

const REGIONS = [
  { label: 'Select Region', value: '' },
  { label: 'United States', value: 'US' },
  { label: 'Canada', value: 'CA' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'Germany', value: 'DE' },
  { label: 'France', value: 'FR' },
  { label: 'Australia', value: 'AU' },
  { label: 'New Zealand', value: 'NZ' },
  { label: 'Netherlands', value: 'NL' },
  { label: 'Sweden', value: 'SE' },
  { label: 'Norway', value: 'NO' },
  { label: 'Denmark', value: 'DK' },
  { label: 'Finland', value: 'FI' },
  { label: 'Switzerland', value: 'CH' },
  { label: 'Austria', value: 'AT' },
  { label: 'Belgium', value: 'BE' },
  { label: 'Ireland', value: 'IE' },
  { label: 'Spain', value: 'ES' },
  { label: 'Italy', value: 'IT' },
  { label: 'Portugal', value: 'PT' },
  { label: 'Japan', value: 'JP' },
  { label: 'South Korea', value: 'KR' },
  { label: 'Singapore', value: 'SG' },
  { label: 'Hong Kong', value: 'HK' },
  { label: 'Other', value: 'OTHER' },
];

export default function OnboardingScreen3() {
  const router = useRouter();
  const { theme } = useTheme();
  const { updateBusinessInfo, onboardingData, loadOnboardingData } = useOnboarding();
  const nameInputRef = useRef<TextInput>(null);
  
  const [businessName, setBusinessName] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [showRegionPicker, setShowRegionPicker] = useState(false);

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
    
    router.push("/onboarding-4");
  };

  const handleRegionPress = () => {
    Keyboard.dismiss(); // Hide the keyboard
    setShowRegionPicker(true);
  };

  const styles = getStyles(theme);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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
                </View>

                {/* Form */}
                <View style={styles.formContainer}>
                  {/* Name Input */}
                  <View style={styles.inputContainer}>
                    <View style={[styles.inputWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      <Ionicons 
                        name="business" 
                        size={20} 
                        color={theme.mutedForeground} 
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
    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundContainer: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
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
    paddingBottom: 20,
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
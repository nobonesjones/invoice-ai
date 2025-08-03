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
  FlatList,
  StatusBar,
  Dimensions,
} from "react-native";
import { Ionicons } from '@expo/vector-icons';

import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/theme-provider";
import { useOnboarding } from "@/context/onboarding-provider";

const INDUSTRIES = [
  'Accounting',
  'Advertising & Marketing',
  'Architecture',
  'Automotive',
  'Beauty & Wellness',
  'Carpentry',
  'Cleaning Services',
  'Computer/IT Services',
  'Construction',
  'Consulting',
  'Design & Creative',
  'Digital Freelancer',
  'Education & Training',
  'Electrical',
  'Engineering',
  'Event Planning',
  'Fitness & Personal Training',
  'Food & Beverage',
  'General Contracting',
  'Healthcare',
  'Home Services',
  'Insurance',
  'Landscaping',
  'Legal Services',
  'Manufacturing',
  'Photography',
  'Plumbing',
  'Real Estate',
  'Retail',
  'Transportation',
  'Travel & Tourism',
  'Video Production',
  'Web Development',
  'Writing & Content',
  'Other',
];

export default function OnboardingScreen4() {
  const router = useRouter();
  const { theme } = useTheme();
  const { updateIndustry } = useOnboarding();
  const searchInputRef = useRef<TextInput>(null);
  
  const [searchText, setSearchText] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');

  // Hide status bar for immersive experience
  useEffect(() => {
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  // Filter industries based on search text
  const filteredIndustries = INDUSTRIES.filter(industry =>
    industry.toLowerCase().includes(searchText.toLowerCase())
  );

  const isFormValid = selectedIndustry.length > 0;

  const handleContinue = () => {
    if (!isFormValid) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Store the industry selection
    console.log('[Onboarding4] Saving industry:', selectedIndustry);
    updateIndustry(selectedIndustry);
    router.push("/(auth)/onboarding-5");
  };

  const handleIndustrySelect = (industry: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIndustry(industry);
  };

  const styles = getStyles(theme);

  const renderIndustryItem = ({ item }: { item: string }) => (
    <Pressable
      style={[
        styles.industryItem,
        { 
          backgroundColor: theme.card,
          borderColor: selectedIndustry === item ? theme.primary : theme.border
        }
      ]}
      onPress={() => handleIndustrySelect(item)}
    >
      <View style={styles.industryContent}>
        <Text style={[
          styles.industryText,
          { color: selectedIndustry === item ? theme.primary : theme.foreground }
        ]}>
          {item}
        </Text>
        <View style={[
          styles.radioButton,
          { borderColor: selectedIndustry === item ? theme.primary : theme.border }
        ]}>
          {selectedIndustry === item && (
            <View style={[styles.radioButtonInner, { backgroundColor: theme.primary }]} />
          )}
        </View>
      </View>
    </Pressable>
  );

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
            <View style={styles.contentContainer}>
              {/* Header */}
              <View style={styles.headerContent}>
                <Text style={[styles.headline, { color: theme.foreground }]}>Industry</Text>
                <Text style={[styles.instructionText, { color: theme.mutedForeground }]}>
                  Please select the industry you work in to personalize your app experience.
                </Text>
              </View>

              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <View style={[styles.searchWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons 
                    name="search" 
                    size={20} 
                    color={theme.mutedForeground} 
                    style={styles.searchIcon}
                  />
                  <TextInput
                    ref={searchInputRef}
                    style={[styles.searchInput, { color: theme.foreground }]}
                    placeholder="Search industry"
                    placeholderTextColor={theme.mutedForeground}
                    value={searchText}
                    onChangeText={setSearchText}
                    autoCapitalize="none"
                    returnKeyType="search"
                  />
                </View>
              </View>

              {/* Industry List */}
              <View style={styles.listContainer}>
                <FlatList
                  data={filteredIndustries}
                  renderItem={renderIndustryItem}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                />
              </View>

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
          </View>
        </LinearGradient>
      </View>
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
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingTop: 30,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 35,
    marginBottom: 20,
  },
  headline: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  searchContainer: {
    marginBottom: 24,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 20,
  },
  industryItem: {
    borderRadius: 12,
    marginBottom: 8,
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
  industryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  industryText: {
    fontSize: 16,
    flex: 1,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
}); 
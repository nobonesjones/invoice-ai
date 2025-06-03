import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Switch, Alert, ActivityIndicator, TouchableOpacity, Platform, SafeAreaView } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSupabase } from '@/context/supabase-provider';
import { useTheme } from '@/context/theme-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Text } from '@/components/ui/text';
import { SettingsListItem } from '@/components/ui/SettingsListItem';
import { ChevronRight, AlertCircle, MapPin, Coins, X as XIcon, Search as SearchIcon, Tag as TagIcon, ChevronLeft } from 'lucide-react-native';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';

const REGIONS_DATA = [
  { id: 'us', name: 'United States' },
  { id: 'ca', name: 'Canada' },
  { id: 'gb', name: 'United Kingdom' },
  { id: 'au', name: 'Australia' },
  { id: 'de', name: 'Germany' },
  { id: 'fr', name: 'France' },
  { id: 'jp', name: 'Japan' },
  { id: 'in', name: 'India' },
  { id: 'br', name: 'Brazil' },
  { id: 'za', name: 'South Africa' },
  { id: 'other', name: 'Other' },
];

const CURRENCIES_DATA = [
  { id: 'usd', name: 'USD - United States Dollar', symbol: '$' },
  { id: 'cad', name: 'CAD - Canadian Dollar', symbol: 'CA$' },
  { id: 'gbp', name: 'GBP - British Pound', symbol: '£' },
  { id: 'aud', name: 'AUD - Australian Dollar', symbol: 'A$' },
  { id: 'eur', name: 'EUR - Euro', symbol: '€' },
  { id: 'jpy', name: 'JPY - Japanese Yen', symbol: '¥' },
  { id: 'inr', name: 'INR - Indian Rupee', symbol: '₹' },
  { id: 'brl', name: 'BRL - Brazilian Real', symbol: 'R$' },
  { id: 'zar', name: 'ZAR - South African Rand', symbol: 'R' },
];

const TAX_NAMES_DATA = [
  { id: 'vat', name: 'VAT' },
  { id: 'salestax', name: 'Sales Tax' },
  { id: 'gst', name: 'GST' },
  { id: 'none', name: 'None' },
  { id: 'custom', name: 'Custom...' },
];

const COUNTRY_AUTOFIL_SETTINGS: Record<string, { currencyCode: string; taxRate: string; taxName: string }> = {
  'United Kingdom': { currencyCode: 'GBP', taxRate: '20%', taxName: 'VAT' },
  'United States': { currencyCode: 'USD', taxRate: '0%', taxName: 'Sales Tax' },
  'Germany': { currencyCode: 'EUR', taxRate: '19%', taxName: 'VAT' },
  'Canada': { currencyCode: 'CAD', taxRate: '5%', taxName: 'GST' },
  'Australia': { currencyCode: 'AUD', taxRate: '10%', taxName: 'GST' },
  'France': { currencyCode: 'EUR', taxRate: '20%', taxName: 'VAT' },
  'India': { currencyCode: 'INR', taxRate: '18%', taxName: 'GST' },
  'Brazil': { currencyCode: 'BRL', taxRate: '17%', taxName: 'ICMS' },
  'Japan': { currencyCode: 'JPY', taxRate: '10%', taxName: 'Consumption Tax' },
  'South Africa': { currencyCode: 'ZAR', taxRate: '15%', taxName: 'VAT' },
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 90, // Space for the sticky button
  },
  sectionContainer: {
    borderRadius: 10,
    overflow: 'hidden', // Important for borderRadius with shadows on Android if content bleeds
    marginBottom: 16, 
    // Shadow properties for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.5,
    // Elevation for Android
    elevation: 5,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14, 
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor will be set by theme
    // Ensure SettingsListItem also has a consistent internal padding or adjust if needed
  },
  label: {
    fontSize: 16,
    // color will be set by theme
    flexShrink: 1, // Allow label to shrink if needed
    marginRight: 8,
  },
  boldLabel: { 
    fontWeight: 'bold',
  },
  input: {
    fontSize: 16,
    textAlign: 'right',
    flexGrow: 1, 
    // color will be set by theme
    // marginLeft: 8, // Added some space if label is very long and input is short
  },
  buttonContainer: { // Structural styles for the sticky footer area
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, // More padding for iOS home indicator
    borderTopWidth: StyleSheet.hairlineWidth,
    // borderTopColor and backgroundColor will be set dynamically using theme
  },
  actualButton: { // Structural styles for the TouchableOpacity button
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor will be set dynamically using theme
  },
  buttonText: { // Structural styles for text within the button
    fontSize: 16,
    fontWeight: 'bold',
    // color will be set dynamically using theme
  },
  modalHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor set by theme below
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    // color set by theme below
    flex: 1, 
    textAlign: 'center',
    marginLeft: 30, 
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16, 
    padding: 4, 
  },
  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // borderBottomColor set by theme below
  },
  modalSearchIcon: {
    marginRight: 8,
  },
  modalSearchInput: { // Structural styles
    flex: 1,
    height: 40,
    fontSize: 16,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    // borderColor, color, and backgroundColor will be set by theme
  },
  modalListContentContainer: {
    paddingHorizontal: 0, 
  },
  modalListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  modalListItemText: { // Structural styles
    fontSize: 16,
    // color set by theme below
  },
  modalListItemTextSelected: { // Structural outline, color by theme
    fontWeight: 'bold',
    // color set by theme (primary) below
  },
  modalSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16, 
    // backgroundColor set by theme
  },
});

export default function TaxCurrencyScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { supabase, user } = useSupabase(); // Get Supabase client and user

  const [autoApplyTax, setAutoApplyTax] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState('Select Region');
  const [selectedCurrency, setSelectedCurrency] = useState('Select Currency');
  const [selectedTaxName, setSelectedTaxName] = useState('VAT');
  const [actualCustomTaxName, setActualCustomTaxName] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true); // New state for loading indicator

  // Bottom Sheet Refs
  const regionModalRef = useRef<BottomSheetModal>(null);
  const currencyModalRef = useRef<BottomSheetModal>(null);
  const taxNameModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['60%', '85%'], []);
  const taxNameSnapPoints = useMemo(() => ['40%', '50%'], []);

  const [regionSearch, setRegionSearch] = useState('');
  const [currencySearch, setCurrencySearch] = useState('');

  const styles = useMemo(() => {
    const baseStyles = getStyles(theme); // Pass theme if getStyles uses it for *non-dynamic* parts
    return {
      ...baseStyles,
      // Theme the button and its container correctly
      buttonContainer: {
        ...baseStyles.buttonContainer,
        backgroundColor: theme.background, 
        borderTopColor: theme.border,
      },
      actualButton: {
        ...baseStyles.actualButton,
        backgroundColor: theme.primary, 
      },
      buttonText: {
        ...baseStyles.buttonText,
        color: theme.primaryForeground,
      },
      // Theme modal styles
      modalHeaderContainer: {
        ...baseStyles.modalHeaderContainer,
        borderBottomColor: theme.border,
      },
      modalTitle: {
        ...baseStyles.modalTitle,
        color: theme.foreground,
      },
      modalSearchContainer: {
        ...baseStyles.modalSearchContainer,
        borderBottomColor: theme.border,
      },
      modalSearchInput: {
        ...baseStyles.modalSearchInput,
        color: theme.foreground,
        borderColor: theme.border, // Or theme.muted, depending on desired look
        backgroundColor: theme.input, // Or theme.card if input should match modal card bg
      },
      modalListItemText: {
        ...baseStyles.modalListItemText,
        color: theme.foreground,
      },
      modalListItemTextSelected: {
        ...baseStyles.modalListItemTextSelected,
        color: theme.primary,
      },
      modalSeparator: {
        ...baseStyles.modalSeparator,
        backgroundColor: theme.border,
      }
      // Ensure other existing themed styles from the previous large edit are maintained if they were correct
      // For example, styles for sectionContainer, inputRow, label, input etc. if they are part of baseStyles
      // and need specific theme overrides, they should be here.
      // However, many of those might be getting theme colors directly if `theme` is passed to getStyles
      // and used for properties that don't change based on component state, which is acceptable.
      // The key is that `theme` is not undefined when accessed.
    };
  }, [theme]);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(false);
      return () => setIsTabBarVisible(true);
    }, [setIsTabBarVisible])
  );

  // Fetch settings when component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user || !supabase) {
        setIsLoadingSettings(false);
        return;
      }
      setIsLoadingSettings(true);
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', user.id)
          .single(); // We expect one row per user

        if (error && error.code !== 'PGRST116') { // PGRST116: 'Searched item was not found'
          console.error('Error fetching settings:', error);
          Alert.alert('Error', 'Could not load your settings.');
        }

        if (data) {
          setTaxRate(data.default_tax_rate ? `${data.default_tax_rate}` : ''); // Convert numeric to string
          setAutoApplyTax(data.auto_apply_tax ?? true); // Default to true if null from DB
          setTaxNumber(data.tax_number || ''); // Load tax number

          setSelectedRegion(data.region || 'Select Region');
          setSelectedCurrency(data.currency_code || 'Select Currency');
          
          // Logic to handle pre-defined vs custom tax name
          const predefinedTaxName = TAX_NAMES_DATA.find(tn => tn.name === data.tax_name);
          if (predefinedTaxName && data.tax_name !== 'Custom...') {
            setSelectedTaxName(data.tax_name);
            setActualCustomTaxName('');
          } else if (data.tax_name) { // It's a custom name or 'Custom...' was stored (older logic)
            setSelectedTaxName('Custom...');
            setActualCustomTaxName(data.tax_name === 'Custom...' ? '' : data.tax_name); // If 'Custom...' was stored, clear actual custom name for new entry
          } else {
            setSelectedTaxName('VAT'); // Default if nothing stored
            setActualCustomTaxName('');
          }

        }
      } catch (e: any) {
        console.error('Exception fetching settings:', e);
        Alert.alert('Error', 'An unexpected error occurred while loading settings.');
      } finally {
        setIsLoadingSettings(false);
      }
    };

    fetchSettings();
  }, [user, supabase]);

  const handleSaveChanges = async () => {
    if (!user || !supabase) {
      Alert.alert('Error', 'User not authenticated.');
      return;
    }

    const finalTaxNameToSave = selectedTaxName === 'Custom...' ? actualCustomTaxName.trim() : selectedTaxName;
    
    let numericTaxRate: number | null = null;
    if (taxRate.trim() !== '') {
      const parsedRate = parseFloat(taxRate.replace('%', '').trim());
      if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        Alert.alert('Invalid Tax Rate', 'Please enter a valid tax rate (0-100), or leave it empty.');
        return;
      }
      numericTaxRate = parsedRate;
    }

    if (selectedTaxName === 'Custom...' && !actualCustomTaxName.trim()) {
      Alert.alert('Missing Custom Tax Name', 'Please enter your custom tax name or choose a predefined one.');
      return;
    }

    setIsSaving(true);
    try {
      const settingsData = {
        user_id: user.id,
        default_tax_rate: numericTaxRate,
        tax_name: finalTaxNameToSave,
        tax_number: taxNumber.trim() || null, // Save tax number
        auto_apply_tax: autoApplyTax,
        region: selectedRegion === 'Select Region' ? null : selectedRegion,
        currency_code: selectedCurrency === 'Select Currency' ? null : selectedCurrency,
        // updated_at is handled by the database trigger
      };

      const { error } = await supabase
        .from('business_settings')
        .upsert(settingsData, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving settings:', error);
        Alert.alert('Error', error.message || 'Failed to save settings.');
      } else {
        Alert.alert('Success', 'Settings saved successfully!');
      }
    } catch (e: any) {
      console.error('Exception saving settings:', e);
      Alert.alert('Error', e.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegionSelect = useCallback(() => {
    setRegionSearch('');
    regionModalRef.current?.present();
  }, []);

  const handleCurrencySelect = useCallback(() => {
    setCurrencySearch('');
    currencyModalRef.current?.present();
  }, []);

  const handleTaxNameSelect = useCallback(() => {
    taxNameModalRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const filteredRegions = useMemo(() => 
    REGIONS_DATA.filter(region => 
      region.name.toLowerCase().includes(regionSearch.toLowerCase())
    )
  , [regionSearch]);

  const filteredCurrencies = useMemo(() => 
    CURRENCIES_DATA.filter(currency => 
      currency.name.toLowerCase().includes(currencySearch.toLowerCase()) ||
      currency.id.toLowerCase().includes(currencySearch.toLowerCase())
    )
  , [currencySearch]);

  const renderSelectionItem = (
    item: { id: string; name: string }, 
    onPress: () => void,
    isSelected: boolean
  ) => (
    <TouchableOpacity 
      style={styles.modalListItem} 
      onPress={onPress}
    >
      <Text style={[styles.modalListItemText, isSelected && styles.modalListItemTextSelected]}>{item.name}</Text>
      {isSelected && <ChevronRight size={20} color={theme.primary} />}
    </TouchableOpacity>
  );

  if (isLoadingSettings) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ marginTop: 10, color: theme.foreground }}>Loading settings...</Text>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen
          options={{
            title: 'Tax & Currency',
            headerShown: true,
            animation: 'slide_from_right',
            headerStyle: {
              backgroundColor: isLightMode ? theme.background : theme.card,
            },
            headerTintColor: theme.foreground,
            headerTitleStyle: {
              fontFamily: 'Roboto-Medium',
            },
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0 }}>
                <ChevronLeft size={24} color={theme.foreground} />
              </TouchableOpacity>
            ),
          }}
        />
        <ScrollView contentContainerStyle={styles.scrollContentContainer}>
          {/* Region Selector */}
          <View style={[styles.sectionContainer, { backgroundColor: theme.card, marginTop: 16 }]}>
            <SettingsListItem
              label="Region"
              labelStyle={styles.boldLabel} 
              rightContent={<Text style={{ color: theme.mutedForeground }}>{selectedRegion}</Text>}
              onPress={handleRegionSelect}
              icon={<MapPin size={20} color={theme.mutedForeground} />}
            />
          </View>

          {/* Currency Selector */}
          <View style={[styles.sectionContainer, { backgroundColor: theme.card, marginTop: 16 }]}>
            <SettingsListItem
              label="Currency"
              labelStyle={styles.boldLabel} 
              rightContent={<Text style={{ color: theme.mutedForeground }}>{selectedCurrency}</Text>}
              onPress={handleCurrencySelect}
              icon={<Coins size={20} color={theme.mutedForeground} />}
            />
          </View>

          {/* Tax Settings Group */}
          <View style={[styles.sectionContainer, { backgroundColor: theme.card, marginTop: 16, marginBottom: 80 }]}>
            {/* Default Tax Rate */}
            <View style={[styles.inputRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.label, styles.boldLabel, { color: theme.foreground }]}>Default Tax Rate</Text>
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="e.g., 10%"
                placeholderTextColor={theme.mutedForeground}
                keyboardType="numeric"
                value={taxRate}
                onChangeText={setTaxRate}
              />
            </View>

            {/* Tax Name Selector */}
            <View style={{ borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }}>
              <SettingsListItem
                label="Tax Name"
                labelStyle={styles.boldLabel}
                rightContent={<Text style={{ color: theme.mutedForeground }}>{selectedTaxName === 'Custom...' && actualCustomTaxName ? actualCustomTaxName : selectedTaxName}</Text>}
                onPress={handleTaxNameSelect}
                icon={<TagIcon size={20} color={theme.mutedForeground} />}
              />
            </View>

            {/* Conditionally render TextInput for Custom Tax Name */}
            {selectedTaxName === 'Custom...' && (
              <View style={[styles.inputRow, { backgroundColor: theme.card, borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <TextInput
                  style={[styles.input, { color: theme.foreground, textAlign: 'left', marginLeft: 16 + 20 + 12 }]} // Align with label text, marginLeft = icon + padding + text margin
                  placeholder="Enter Custom Tax Name"
                  placeholderTextColor={theme.mutedForeground}
                  value={actualCustomTaxName}
                  onChangeText={setActualCustomTaxName}
                  autoFocus
                />
              </View>
            )}

            {/* Tax Number */}
            <View style={[styles.inputRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.label, styles.boldLabel, { color: theme.foreground }]}>Tax Number</Text>
              <TextInput
                style={[styles.input, { color: theme.foreground }]}
                placeholder="e.g., VAT123456789"
                placeholderTextColor={theme.mutedForeground}
                value={taxNumber}
                onChangeText={setTaxNumber}
                autoCapitalize="characters"
              />
            </View>

            {/* Auto Apply Tax Toggle */}
            <View style={[styles.inputRow, { borderBottomWidth: 0 /* Last item */ }]}>
              <Text style={[styles.label, styles.boldLabel, { color: theme.foreground }]}>Auto Apply Tax</Text>
              <Switch
                trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
                thumbColor={autoApplyTax ? theme.primary : (Platform.OS === 'ios' ? theme.card : theme.mutedForeground) }
                ios_backgroundColor={theme.muted}
                onValueChange={setAutoApplyTax}
                value={autoApplyTax}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonContainer}> 
          <TouchableOpacity style={styles.actualButton} onPress={handleSaveChanges} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.primaryForeground} />
            ) : (
              <Text style={styles.buttonText}>Save Settings</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Region Selection Modal */}
      <BottomSheetModal
        ref={regionModalRef}
        index={1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: theme.mutedForeground }}
        backgroundStyle={{ backgroundColor: theme.card }}
        enablePanDownToClose
      >
        <View style={styles.modalHeaderContainer}>
          <Text style={styles.modalTitle}>Select Region</Text>
          <TouchableOpacity onPress={() => regionModalRef.current?.dismiss()} style={styles.modalCloseButton}>
            <XIcon size={24} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalSearchContainer}>
            <SearchIcon size={20} color={theme.mutedForeground} style={styles.modalSearchIcon} />
            <BottomSheetTextInput
                placeholder="Search regions..."
                placeholderTextColor={theme.mutedForeground}
                style={styles.modalSearchInput}
                value={regionSearch}
                onChangeText={setRegionSearch}
            />
        </View>
        <BottomSheetFlatList
          data={filteredRegions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderSelectionItem(
            item, 
            () => {
              setSelectedRegion(item.name);

              // Autofill logic
              const autofillSettings = COUNTRY_AUTOFIL_SETTINGS[item.name];
              if (autofillSettings) {
                // Set Tax Rate
                setTaxRate(autofillSettings.taxRate);

                // Set Tax Name
                const predefinedTaxName = TAX_NAMES_DATA.find(tn => tn.name.toLowerCase() === autofillSettings.taxName.toLowerCase() && tn.name !== 'Custom...');
                if (predefinedTaxName) {
                  setSelectedTaxName(predefinedTaxName.name);
                  setActualCustomTaxName(''); // Clear custom if a predefined one is autofilled
                } else { // Handles 'Custom...' or any other tax name not in TAX_NAMES_DATA as custom
                    setSelectedTaxName('Custom...');
                    setActualCustomTaxName(autofillSettings.taxName); 
                }

                // Set Currency
                const currencyData = CURRENCIES_DATA.find(c => c.id.toLowerCase() === autofillSettings.currencyCode.toLowerCase());
                if (currencyData) {
                  setSelectedCurrency(currencyData.name);
                } else {
                  // If currency code not found, perhaps clear or set to 'Select Currency'
                  // For now, it will retain its current value or the one from DB fetch if currency is not found
                  console.warn(`Autofill: Currency code ${autofillSettings.currencyCode} not found in CURRENCIES_DATA.`);
                }
              } // else no autofill settings for this region, existing values remain

              regionModalRef.current?.dismiss();
            },
            selectedRegion === item.name
          )}
          contentContainerStyle={styles.modalListContentContainer}
          ItemSeparatorComponent={() => <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />}
        />
      </BottomSheetModal>

      {/* Currency Selection Modal */}
      <BottomSheetModal
        ref={currencyModalRef}
        index={1}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: theme.mutedForeground }}
        backgroundStyle={{ backgroundColor: theme.card }}
        enablePanDownToClose
      >
        <View style={styles.modalHeaderContainer}>
          <Text style={styles.modalTitle}>Select Currency</Text>
          <TouchableOpacity onPress={() => currencyModalRef.current?.dismiss()} style={styles.modalCloseButton}>
            <XIcon size={24} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
        <View style={styles.modalSearchContainer}>
            <SearchIcon size={20} color={theme.mutedForeground} style={styles.modalSearchIcon} />
            <BottomSheetTextInput
                placeholder="Search currencies..."
                placeholderTextColor={theme.mutedForeground}
                style={styles.modalSearchInput}
                value={currencySearch}
                onChangeText={setCurrencySearch}
            />
        </View>
        <BottomSheetFlatList
          data={filteredCurrencies}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderSelectionItem(
            item, 
            () => {
              setSelectedCurrency(item.name);
              currencyModalRef.current?.dismiss();
            },
            selectedCurrency === item.name
          )}
          contentContainerStyle={styles.modalListContentContainer}
          ItemSeparatorComponent={() => <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />}
        />
      </BottomSheetModal>

      {/* Tax Name Selection Modal */}
      <BottomSheetModal
        ref={taxNameModalRef}
        index={1}
        snapPoints={taxNameSnapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: theme.mutedForeground }}
        backgroundStyle={{ backgroundColor: theme.card }}
        enablePanDownToClose
      >
        <View style={styles.modalHeaderContainer}>
          <Text style={styles.modalTitle}>Select Tax Name</Text>
          <TouchableOpacity onPress={() => taxNameModalRef.current?.dismiss()} style={styles.modalCloseButton}>
            <XIcon size={24} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
        <BottomSheetFlatList
          data={TAX_NAMES_DATA}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderSelectionItem(
            item, 
            () => {
              setSelectedTaxName(item.name);
              if (item.id !== 'custom') {
                setActualCustomTaxName(''); // Clear custom input if a predefined one is chosen
              }
              taxNameModalRef.current?.dismiss();
            },
            selectedTaxName === item.name
          )}
          contentContainerStyle={styles.modalListContentContainer}
          ItemSeparatorComponent={() => <View style={[styles.modalSeparator, { backgroundColor: theme.border }]} />}
        />
      </BottomSheetModal>
    </GestureHandlerRootView>
  );
}

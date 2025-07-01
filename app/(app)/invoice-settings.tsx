import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
  TextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { Text } from '@/components/ui/text';
import { ChevronLeft, ChevronRight, Palette, X } from 'lucide-react-native';
import { INVOICE_DESIGNS, getDesignById, DEFAULT_DESIGN_ID } from '@/constants/invoiceDesigns';
import { InvoicePreviewModal } from '@/components/InvoicePreviewModal';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetModalProvider, BottomSheetView, BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  sectionContainer: {
    backgroundColor: theme.card,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 3,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.foreground,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.mutedForeground,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  lastSettingRow: {
    borderBottomWidth: 0,
  },
  settingLeft: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: theme.foreground,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 14,
    color: theme.mutedForeground,
    marginTop: 2,
  },
  designRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  designInfo: {
    flex: 1,
    marginRight: 12,
  },
  designName: {
    fontSize: 16,
    color: theme.foreground,
    fontWeight: '500',
  },
  designDescription: {
    fontSize: 14,
    color: theme.mutedForeground,
    marginTop: 2,
  },
  chevronIcon: {
    marginLeft: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 10, 
  },
  headerTitle: {
    fontSize: 20, 
    fontWeight: 'bold', 
    marginLeft: 10,
  },
  comingSoonContainer: {
    padding: 16,
    alignItems: 'center',
  },
  comingSoonText: {
    fontSize: 16,
    color: theme.mutedForeground,
    fontStyle: 'italic',
  },
  terminologyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  terminologyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: theme.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: theme.primaryForeground,
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

// Reference Schema Sheet Component
const ReferenceSchemaSheet = React.forwardRef<BottomSheetModal, {
  theme: any;
  currentFormat: string;
  onSave: (format: string) => void;
}>((props, ref) => {
  const { theme, currentFormat, onSave } = props;
  const [selectedFormat, setSelectedFormat] = useState(currentFormat);
  const [customPrefix, setCustomPrefix] = useState('INV');
  const [numberLength, setNumberLength] = useState(3);
  const [includeYear, setIncludeYear] = useState(false);
  const [includeMonth, setIncludeMonth] = useState(false);
  const [startingNumber, setStartingNumber] = useState(1);

  // Snap points for the modal
  const snapPoints = useMemo(() => ['75%', '90%'], []);

  // Parse current format to set initial values
  useEffect(() => {
    if (currentFormat) {
      // Extract prefix (everything before the first dash or number)
      const prefixMatch = currentFormat.match(/^([A-Za-z]+)/);
      if (prefixMatch) {
        setCustomPrefix(prefixMatch[1]);
      }
      
      // Check for year and month patterns
      setIncludeYear(currentFormat.includes('YYYY') || currentFormat.includes(new Date().getFullYear().toString()));
      setIncludeMonth(currentFormat.includes('MM') || /\d{2}/.test(currentFormat.substring(currentFormat.indexOf('-') + 1, currentFormat.indexOf('-') + 3)));
      
      // Extract number length from trailing zeros pattern
      const numberMatch = currentFormat.match(/(\d+)$/);
      if (numberMatch) {
        setNumberLength(numberMatch[1].length);
        setStartingNumber(parseInt(numberMatch[1]) || 1);
      }
    }
  }, [currentFormat]);

  const presetFormats = [
    { label: 'INV-001', pattern: 'PREFIX-NNN', description: 'Simple sequential numbering' },
    { label: 'INV-2024-001', pattern: 'PREFIX-YYYY-NNN', description: 'Include year' },
    { label: 'INV-01-001', pattern: 'PREFIX-MM-NNN', description: 'Include month' },
    { label: 'INV-2024-01-001', pattern: 'PREFIX-YYYY-MM-NNN', description: 'Include year and month' },
    { label: 'QUOTE-001', pattern: 'CUSTOM-NNN', description: 'Custom prefix' },
  ];

  const generatePreview = () => {
    let preview = customPrefix;
    
    if (includeYear) {
      preview += `-${new Date().getFullYear()}`;
    }
    
    if (includeMonth) {
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      preview += `-${month}`;
    }
    
    const number = startingNumber.toString().padStart(numberLength, '0');
    preview += `-${number}`;
    
    return preview;
  };

  const handleSave = () => {
    const newFormat = generatePreview();
    onSave(newFormat);
    (ref as any)?.current?.dismiss();
  };

  const sheetStyles = StyleSheet.create({
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 80, // Space for sticky button
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    closeButton: {
      padding: 8,
      borderRadius: 20,
      backgroundColor: theme.muted,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.foreground,
      flex: 1,
      textAlign: 'center',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.foreground,
      marginBottom: 12,
      marginTop: 20,
    },
    presetItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.card,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedPreset: {
      borderColor: theme.primary,
      backgroundColor: theme.primaryTransparent,
    },
    presetLeft: {
      flex: 1,
    },
    presetLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.foreground,
    },
    presetDescription: {
      fontSize: 14,
      color: theme.mutedForeground,
      marginTop: 2,
    },
    customSection: {
      backgroundColor: theme.card,
      borderRadius: 8,
      padding: 16,
      marginTop: 16,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    inputLabel: {
      flex: 1,
      fontSize: 16,
      color: theme.foreground,
    },
    textInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.foreground,
      backgroundColor: theme.background,
      width: 80,
    },
    numberInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 16,
      color: theme.foreground,
      backgroundColor: theme.background,
      width: 100,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    previewSection: {
      backgroundColor: theme.muted,
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      alignItems: 'center',
    },
    previewLabel: {
      fontSize: 14,
      color: theme.mutedForeground,
      marginBottom: 8,
    },
    previewText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.primary,
    },
    stickyButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: theme.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    stickyButton: {
      backgroundColor: theme.primary,
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: 'center',
    },
    stickyButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.primaryForeground,
    },
  });

  // Render backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
    >
      <BottomSheetScrollView 
        contentContainerStyle={sheetStyles.contentContainer}
      >
        {/* Header with X button */}
        <View style={sheetStyles.header}>
          <View style={{ width: 40 }} />
          <Text style={sheetStyles.title}>Invoice Reference Format</Text>
          <TouchableOpacity
            style={sheetStyles.closeButton}
            onPress={() => (ref as any)?.current?.dismiss()}
          >
            <X size={20} color={theme.foreground} />
          </TouchableOpacity>
        </View>
        
        {/* Preview Section - moved to top */}
        <View style={sheetStyles.previewSection}>
          <Text style={sheetStyles.previewLabel}>Preview:</Text>
          <Text style={sheetStyles.previewText}>{generatePreview()}</Text>
        </View>
        
        <Text style={sheetStyles.sectionTitle}>Quick Presets</Text>
        {presetFormats.map((preset, index) => (
          <TouchableOpacity
            key={index}
            style={[sheetStyles.presetItem, selectedFormat === preset.label && sheetStyles.selectedPreset]}
            onPress={() => {
              setSelectedFormat(preset.label);
              // Parse preset to update custom settings
              const labelParts = preset.label.split('-');
              setCustomPrefix(labelParts[0]);
              setIncludeYear(preset.pattern.includes('YYYY'));
              setIncludeMonth(preset.pattern.includes('MM'));
              
              // Extract number from preset
              const numberPart = labelParts[labelParts.length - 1];
              if (numberPart && /^\d+$/.test(numberPart)) {
                setStartingNumber(parseInt(numberPart));
                setNumberLength(numberPart.length);
              }
            }}
          >
            <View style={sheetStyles.presetLeft}>
              <Text style={sheetStyles.presetLabel}>{preset.label}</Text>
              <Text style={sheetStyles.presetDescription}>{preset.description}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={sheetStyles.sectionTitle}>Custom Format</Text>
        <View style={sheetStyles.customSection}>
          <View style={sheetStyles.inputRow}>
            <Text style={sheetStyles.inputLabel}>Prefix:</Text>
            <BottomSheetTextInput
              style={sheetStyles.textInput}
              value={customPrefix}
              onChangeText={setCustomPrefix}
              placeholder="INV"
              maxLength={10}
            />
          </View>
          
          <View style={sheetStyles.switchRow}>
            <Text style={sheetStyles.inputLabel}>Include Year</Text>
            <Switch
              value={includeYear}
              onValueChange={setIncludeYear}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={includeYear ? theme.primary : theme.foreground}
            />
          </View>
          
          <View style={sheetStyles.switchRow}>
            <Text style={sheetStyles.inputLabel}>Include Month</Text>
            <Switch
              value={includeMonth}
              onValueChange={setIncludeMonth}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={includeMonth ? theme.primary : theme.foreground}
            />
          </View>
          
          <View style={sheetStyles.inputRow}>
            <Text style={sheetStyles.inputLabel}>Number Length:</Text>
            <BottomSheetTextInput
              style={sheetStyles.textInput}
              value={numberLength.toString()}
              onChangeText={(text) => setNumberLength(Math.max(1, Math.min(6, parseInt(text) || 3)))}
              keyboardType="numeric"
              maxLength={1}
            />
          </View>
          
          <View style={sheetStyles.inputRow}>
            <Text style={sheetStyles.inputLabel}>Starting Number:</Text>
            <BottomSheetTextInput
              style={sheetStyles.numberInput}
              value={startingNumber.toString()}
              onChangeText={(text) => setStartingNumber(Math.max(1, parseInt(text) || 1))}
              keyboardType="numeric"
              placeholder="1"
            />
          </View>
        </View>

      </BottomSheetScrollView>
      
      {/* Sticky Save Button */}
      <View style={sheetStyles.stickyButtonContainer}>
        <TouchableOpacity
          style={sheetStyles.stickyButton}
          onPress={handleSave}
        >
          <Text style={sheetStyles.stickyButtonText}>Save Format</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  );
});

interface InvoiceSettings {
  default_invoice_design: string;
  default_accent_color: string;
  show_business_logo: boolean;
  show_business_name: boolean;
  show_business_address: boolean;
  show_business_tax_number: boolean;
  show_notes_section: boolean;
  auto_update_default_design: boolean;
  invoice_reference_format: string;
  estimate_terminology: 'estimate' | 'quote';
}

// Helper function to generate dummy invoice data for preview
const generateDummyInvoiceData = (businessSettings: any, settings: InvoiceSettings) => {
  const currentDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(currentDate.getDate() + 30); // 30 days from now

  // Generate dummy tax number if not available
  const taxNumber = businessSettings?.tax_number || 'GB-VAT-123456789';
  
  // Use business currency or default to USD
  const currencyCode = businessSettings?.currency_code || 'USD';
  const currencySymbol = getCurrencySymbol(currencyCode);
  
  // Sample line items with different quantities and prices
  const lineItems = [
    {
      id: '1',
      description: 'Item 1 (example item)',
      quantity: 1,
      rate: 10.00,
      amount: 10.00
    },
    {
      id: '2', 
      description: 'Item 2 (example item)',
      quantity: 1,
      rate: 50.00,
      amount: 50.00
    },
    {
      id: '3',
      description: 'Item 3 (example item)',
      quantity: 2, 
      rate: 100.00,
      amount: 200.00
    }
  ];

  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = businessSettings?.default_tax_rate || 0;
  const taxAmount = businessSettings?.auto_apply_tax ? (subtotal * (taxRate / 100)) : 0;
  const total = subtotal + taxAmount;

  return {
    id: 'preview-invoice',
    invoice_number: 'INV-001',
    issue_date: currentDate.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    status: 'draft',
    currency_code: currencyCode,
    currency_symbol: currencySymbol,
    subtotal_amount: subtotal,
    tax_amount: taxAmount,
    tax_percentage: taxRate,
    total_amount: total,
    notes: settings.show_notes_section ? 'Thank you for your business!' : '',
    invoice_design: settings.default_invoice_design,
    accent_color: settings.default_accent_color,
    // Use the correct field name that Skia canvas expects
    invoice_line_items: lineItems.map(item => ({
      id: item.id,
      item_name: item.description,
      item_description: '', // Keep descriptions empty for clean preview
      quantity: item.quantity,
      unit_price: item.rate,
      total_price: item.amount
    })),
    // Business info (conditionally shown based on settings)
    business_name: settings.show_business_name ? businessSettings?.business_name : '',
    business_logo_url: settings.show_business_logo ? businessSettings?.business_logo_url : '',
    business_address: settings.show_business_address ? (businessSettings?.business_address || '') : '',
    business_email: businessSettings?.business_email || '',
    business_phone: businessSettings?.business_phone || '',
    business_website: businessSettings?.business_website || '',
    tax_number: settings.show_business_tax_number ? taxNumber : '',
    tax_name: businessSettings?.tax_name || 'Tax',
  };
};

// Helper function to get currency symbol
const getCurrencySymbol = (currencyCode: string): string => {
  const currencySymbols: { [key: string]: string } = {
    'USD': '$',
    'EUR': '€', 
    'GBP': '£',
    'JPY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'SEK': 'kr',
    'NZD': 'NZ$',
  };
  return currencySymbols[currencyCode] || currencyCode;
};

// Dummy client data for preview
const generateDummyClientData = () => ({
  id: 'preview-client',
  name: 'Acme Corporation',
  email: 'billing@acmecorp.com',
  address_client: '123 Business Street\nSuite 100\nNew York, NY 10001\nUnited States',
  phone: '+1 (555) 123-4567',
  tax_number: 'US-TAX-987654321',
});

export default function InvoiceSettingsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { supabase, session } = useSupabase();
  const navigation = useNavigation();
  const previewModalRef = useRef<any>(null);
  const referenceSchemaRef = useRef<BottomSheetModal>(null);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [businessSettings, setBusinessSettings] = useState<any>(null);
  
  // Invoice settings state
  const [settings, setSettings] = useState<InvoiceSettings>({
    default_invoice_design: DEFAULT_DESIGN_ID,
    default_accent_color: '#14B8A6',
    show_business_logo: true,
    show_business_name: true,
    show_business_address: true,
    show_business_tax_number: true,
    show_notes_section: true,
    auto_update_default_design: true,
    invoice_reference_format: 'INV-001',
    estimate_terminology: 'estimate',
  });

  const fetchInvoiceSettings = useCallback(async (): Promise<void> => {
    if (!session || !supabase) return;
    setInitialLoading(true);
    try {
      // Fetch all business settings including invoice settings
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettingsId(data.id);
        setBusinessSettings(data); // Store all business settings for dummy data
        setSettings({
          default_invoice_design: data.default_invoice_design || DEFAULT_DESIGN_ID,
          default_accent_color: data.default_accent_color || '#14B8A6',
          show_business_logo: data.show_business_logo ?? true,
          show_business_name: data.show_business_name ?? true,
          show_business_address: data.show_business_address ?? true,
          show_business_tax_number: data.show_business_tax_number ?? true,
          show_notes_section: data.show_notes_section ?? true,
          auto_update_default_design: data.auto_update_default_design ?? true,
          invoice_reference_format: data.invoice_reference_format || 'INV-001',
          estimate_terminology: (data.estimate_terminology as 'estimate' | 'quote') || 'estimate',
        });
      }
    } catch (error) {
      console.error('Error fetching invoice settings:', error);
      Alert.alert('Error', 'Could not fetch invoice settings.');
    } finally {
      setInitialLoading(false);
    }
  }, [session, supabase]);

  useFocusEffect(
    useCallback(() => {
      fetchInvoiceSettings();
    }, [fetchInvoiceSettings])
  );

  // Handle back button press and unsaved changes
  const handleBackPress = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to save them before leaving?',
        [
          {
            text: 'Don\'t Save',
            style: 'destructive',
            onPress: () => router.back()
          },
          {
            text: 'Cancel',
            style: 'cancel'
          },
          {
            text: 'Save',
            onPress: async () => {
              await handleSaveSettings();
              router.back();
            }
          }
        ]
      );
      return true; // Prevent default back behavior
    }
    return false; // Allow default back behavior
  }, [hasChanges, router, handleSaveSettings]);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        return handleBackPress();
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [handleBackPress])
  );

  const updateSetting = (key: keyof InvoiceSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveSettings = async () => {
    if (!session || !supabase) {
      Alert.alert('Error', 'You must be logged in to save settings.');
      return;
    }
    
    setLoading(true);
    try {
      const updates = {
        user_id: session.user.id,
        default_invoice_design: settings.default_invoice_design,
        default_accent_color: settings.default_accent_color,
        show_business_logo: settings.show_business_logo,
        show_business_name: settings.show_business_name,
        show_business_address: settings.show_business_address,
        show_business_tax_number: settings.show_business_tax_number,
        show_notes_section: settings.show_notes_section,
        auto_update_default_design: settings.auto_update_default_design,
        invoice_reference_format: settings.invoice_reference_format,
        estimate_terminology: settings.estimate_terminology,
        updated_at: new Date().toISOString(),
      };

      let responseError = null;
      let responseData = null;

      if (settingsId) {
        const { data, error } = await supabase
          .from('business_settings')
          .update(updates)
          .eq('id', settingsId)
          .select()
          .single();
        responseData = data;
        responseError = error;
      } else {
        const { data, error } = await supabase
          .from('business_settings')
          .insert(updates)
          .select()
          .single();
        responseData = data;
        responseError = error;
      }

      if (responseError) {
        throw responseError;
      }

      if (responseData) {
        setSettingsId(responseData.id);
        setHasChanges(false);
        Alert.alert('Settings Saved', 'Your invoice settings have been saved successfully!');
      }
    } catch (error: any) {
      console.error('Error saving invoice settings:', error);
      Alert.alert('Error', error?.message || 'Failed to save invoice settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleDesignSelection = () => {
    // Open the existing InvoicePreviewModal in "settings mode"
    if (previewModalRef.current) {
      previewModalRef.current.present();
    }
  };

  const handleDesignSaved = (designId: string, accentColor: string) => {
    updateSetting('default_invoice_design', designId);
    updateSetting('default_accent_color', accentColor);
  };

  const handleOpenReferenceSchema = () => {
    console.log('Opening reference schema modal...');
    referenceSchemaRef.current?.present();
  };

  const handleReferenceFormatSaved = (format: string) => {
    updateSetting('invoice_reference_format', format);
  };

  const getCurrentDesign = () => {
    return getDesignById(settings.default_invoice_design) || getDesignById(DEFAULT_DESIGN_ID);
  };

  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={() => {
            if (!handleBackPress()) {
              router.back();
            }
          }} style={{ padding: 6 }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Invoice Settings</Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, theme, styles, handleBackPress]);

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const currentDesign = getCurrentDesign();

  return (
    <BottomSheetModalProvider>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <ScrollView 
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
        >
        {/* Invoice Design Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Invoice Design</Text>
            <Text style={styles.sectionSubtitle}>Choose your default invoice template and appearance</Text>
          </View>
          
          <TouchableOpacity style={styles.designRow} onPress={handleDesignSelection}>
            <Palette size={20} color={theme.primary} style={{ marginRight: 12 }} />
            <View style={styles.designInfo}>
              <Text style={styles.designName}>
                {currentDesign?.displayName || 'Classic'} Template
              </Text>
              <Text style={styles.designDescription}>
                {currentDesign?.description || 'Traditional business invoice'}
              </Text>
            </View>
            <ChevronRight size={20} color={theme.mutedForeground} style={styles.chevronIcon} />
          </TouchableOpacity>

          <View style={[styles.settingRow, styles.lastSettingRow]}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Auto-Update Default</Text>
              <Text style={styles.settingDescription}>Automatically set your last used design as default</Text>
            </View>
            <Switch 
              value={settings.auto_update_default_design} 
              onValueChange={(value) => updateSetting('auto_update_default_design', value)}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={settings.auto_update_default_design ? theme.primary : theme.foreground}
            />
          </View>
        </View>

        {/* Invoice Display Options Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Display Options</Text>
            <Text style={styles.sectionSubtitle}>Configure what appears on your invoices by default</Text>
          </View>
          
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Show Business Logo</Text>
              <Text style={styles.settingDescription}>Display your logo on new invoices</Text>
            </View>
            <Switch 
              value={settings.show_business_logo} 
              onValueChange={(value) => updateSetting('show_business_logo', value)}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={settings.show_business_logo ? theme.primary : theme.foreground}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Show Business Name</Text>
              <Text style={styles.settingDescription}>Display your business name on invoices</Text>
            </View>
            <Switch 
              value={settings.show_business_name} 
              onValueChange={(value) => updateSetting('show_business_name', value)}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={settings.show_business_name ? theme.primary : theme.foreground}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Show Business Address</Text>
              <Text style={styles.settingDescription}>Display your business address on invoices</Text>
            </View>
            <Switch 
              value={settings.show_business_address} 
              onValueChange={(value) => updateSetting('show_business_address', value)}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={settings.show_business_address ? theme.primary : theme.foreground}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Show Business Tax Number</Text>
              <Text style={styles.settingDescription}>Display your tax number on invoices</Text>
            </View>
            <Switch 
              value={settings.show_business_tax_number} 
              onValueChange={(value) => updateSetting('show_business_tax_number', value)}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={settings.show_business_tax_number ? theme.primary : theme.foreground}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Show Notes Section</Text>
              <Text style={styles.settingDescription}>Include a notes field on new invoices</Text>
            </View>
            <Switch 
              value={settings.show_notes_section} 
              onValueChange={(value) => updateSetting('show_notes_section', value)}
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={settings.show_notes_section ? theme.primary : theme.foreground}
            />
          </View>

          <TouchableOpacity style={[styles.settingRow, styles.lastSettingRow]} onPress={handleOpenReferenceSchema}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Invoice Reference Format</Text>
              <Text style={styles.settingDescription}>Current: {settings.invoice_reference_format}</Text>
            </View>
            <ChevronRight size={20} color={theme.mutedForeground} style={styles.chevronIcon} />
          </TouchableOpacity>
        </View>

        {/* Estimates Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Estimates</Text>
            <Text style={styles.sectionSubtitle}>Configure estimate templates and defaults</Text>
          </View>
          
          <View style={[styles.settingRow, styles.lastSettingRow, { paddingVertical: 18 }]}>
            <View style={styles.settingLeft}>
              <Text style={styles.settingLabel}>Document Terminology</Text>
              <Text style={styles.settingDescription}>Choose how you want to label your estimate documents</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                style={[
                  styles.terminologyButton,
                  { backgroundColor: settings.estimate_terminology === 'estimate' ? theme.primary : theme.muted }
                ]}
                onPress={() => updateSetting('estimate_terminology', 'estimate')}
              >
                <Text style={[
                  styles.terminologyButtonText,
                  { color: settings.estimate_terminology === 'estimate' ? theme.primaryForeground : theme.mutedForeground }
                ]}>
                  Estimate
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.terminologyButton,
                  { 
                    backgroundColor: settings.estimate_terminology === 'quote' ? theme.primary : theme.muted, 
                    marginLeft: 8 
                  }
                ]}
                onPress={() => updateSetting('estimate_terminology', 'quote')}
              >
                <Text style={[
                  styles.terminologyButtonText,
                  { color: settings.estimate_terminology === 'quote' ? theme.primaryForeground : theme.mutedForeground }
                ]}>
                  Quote
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Save Button - Only show if there are changes */}
      {hasChanges && (
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity onPress={handleSaveSettings} style={styles.saveButton} disabled={loading}>
            {loading ? (
              <>
                <ActivityIndicator color={theme.primaryForeground} />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </>
            ) : (
              <Text style={styles.saveButtonText}>Save Settings</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Invoice Preview Modal for Design Selection */}
      <InvoicePreviewModal 
        ref={previewModalRef}
        mode="settings" // Special mode for settings
        onDesignSaved={handleDesignSaved}
        initialDesign={settings.default_invoice_design}
        initialAccentColor={settings.default_accent_color}
        invoiceData={businessSettings ? generateDummyInvoiceData(businessSettings, settings) : null}
        businessSettings={businessSettings}
        clientData={generateDummyClientData()}
      />

      {/* Reference Schema Sheet */}
      <ReferenceSchemaSheet
        ref={referenceSchemaRef}
        theme={theme}
        currentFormat={settings.invoice_reference_format}
        onSave={handleReferenceFormatSaved}
      />
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
} 
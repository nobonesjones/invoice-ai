import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { Text } from '@/components/ui/text';
import { ChevronLeft, ChevronRight, Palette } from 'lucide-react-native';
import { INVOICE_DESIGNS, getDesignById, DEFAULT_DESIGN_ID } from '@/constants/invoiceDesigns';
import { InvoicePreviewModal } from '@/components/InvoicePreviewModal';

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

interface InvoiceSettings {
  default_invoice_design: string;
  default_accent_color: string;
  show_business_logo: boolean;
  show_business_name: boolean;
  show_business_address: boolean;
  show_business_tax_number: boolean;
  show_notes_section: boolean;
  auto_update_default_design: boolean;
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
        Alert.alert('Success', 'Invoice settings saved successfully!');
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

  const getCurrentDesign = () => {
    return getDesignById(settings.default_invoice_design) || getDesignById(DEFAULT_DESIGN_ID);
  };

  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Invoice Settings</Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, theme, styles]);

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

          <View style={[styles.settingRow, styles.lastSettingRow]}>
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
        </View>

        {/* Estimates Section - Coming Soon */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Estimates</Text>
            <Text style={styles.sectionSubtitle}>Configure estimate templates and defaults</Text>
          </View>
          
          <View style={styles.comingSoonContainer}>
            <Text style={styles.comingSoonText}>Coming Soon</Text>
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
    </SafeAreaView>
  );
} 
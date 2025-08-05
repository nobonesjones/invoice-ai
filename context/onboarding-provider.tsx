import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/config/supabase';

interface OnboardingData {
  businessName: string;
  selectedRegion: string;
  selectedIndustry: string;
  logoUri: string | null;
}

interface OnboardingContextType {
  onboardingData: OnboardingData;
  updateBusinessInfo: (businessInfo: { businessName: string, selectedRegion: string }) => void;
  updateIndustry: (selectedIndustry: string) => void;
  updateLogo: (logoUri: string | null) => void;
  saveOnboardingData: (userId?: string) => Promise<void>;
  clearOnboardingData: () => Promise<void>;
  loadOnboardingData: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const ONBOARDING_STORAGE_KEY = '@onboarding_data';

// Region to currency and tax mapping
const REGION_CURRENCY_TAX_MAP: Record<string, { currency: string; taxName: string; defaultTaxRate: number }> = {
  // Major English-speaking countries
  'US': { currency: 'USD', taxName: 'Sales Tax', defaultTaxRate: 0.0 }, // Updated to 0% as default - varies by state
  'GB': { currency: 'GBP', taxName: 'VAT', defaultTaxRate: 20.0 },
  'CA': { currency: 'CAD', taxName: 'GST', defaultTaxRate: 5.0 }, // Updated to federal GST rate
  'AU': { currency: 'AUD', taxName: 'GST', defaultTaxRate: 10.0 },
  'NZ': { currency: 'NZD', taxName: 'GST', defaultTaxRate: 15.0 },
  
  // European Union Countries (Eurozone) - All use EUR with local VAT terms
  'DE': { currency: 'EUR', taxName: 'USt.', defaultTaxRate: 19.0 },
  'FR': { currency: 'EUR', taxName: 'TVA', defaultTaxRate: 20.0 },
  'ES': { currency: 'EUR', taxName: 'IVA', defaultTaxRate: 21.0 },
  'IT': { currency: 'EUR', taxName: 'IVA', defaultTaxRate: 22.0 },
  'NL': { currency: 'EUR', taxName: 'BTW', defaultTaxRate: 21.0 },
  'BE': { currency: 'EUR', taxName: 'TVA/BTW', defaultTaxRate: 21.0 },
  'AT': { currency: 'EUR', taxName: 'USt.', defaultTaxRate: 20.0 },
  'IE': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 23.0 },
  'PT': { currency: 'EUR', taxName: 'IVA', defaultTaxRate: 23.0 },
  'FI': { currency: 'EUR', taxName: 'ALV', defaultTaxRate: 24.0 },
  'GR': { currency: 'EUR', taxName: 'ΦΠΑ', defaultTaxRate: 24.0 },
  'LU': { currency: 'EUR', taxName: 'TVA', defaultTaxRate: 16.0 },
  'SI': { currency: 'EUR', taxName: 'DDV', defaultTaxRate: 22.0 },
  'SK': { currency: 'EUR', taxName: 'DPH', defaultTaxRate: 20.0 },
  'EE': { currency: 'EUR', taxName: 'KM', defaultTaxRate: 20.0 },
  'LV': { currency: 'EUR', taxName: 'PVN', defaultTaxRate: 21.0 },
  'LT': { currency: 'EUR', taxName: 'PVM', defaultTaxRate: 21.0 },
  'MT': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 18.0 },
  'CY': { currency: 'EUR', taxName: 'ΦΠΑ', defaultTaxRate: 19.0 },
  'HR': { currency: 'EUR', taxName: 'PDV', defaultTaxRate: 25.0 },
  
  // European Union (Non-Eurozone) with local currencies and VAT terms
  'BG': { currency: 'BGN', taxName: 'ДДС', defaultTaxRate: 20.0 },
  'CZ': { currency: 'CZK', taxName: 'DPH', defaultTaxRate: 21.0 },
  'HU': { currency: 'HUF', taxName: 'ÁFA', defaultTaxRate: 27.0 },
  'PL': { currency: 'PLN', taxName: 'VAT', defaultTaxRate: 23.0 },
  'RO': { currency: 'RON', taxName: 'TVA', defaultTaxRate: 19.0 },
  'SE': { currency: 'SEK', taxName: 'MOMS', defaultTaxRate: 25.0 },
  'DK': { currency: 'DKK', taxName: 'MOMS', defaultTaxRate: 25.0 },
  
  // Other European Countries
  'CH': { currency: 'CHF', taxName: 'VAT', defaultTaxRate: 7.7 },
  'NO': { currency: 'NOK', taxName: 'VAT', defaultTaxRate: 25.0 },
  
  // Middle East
  'AE': { currency: 'AED', taxName: 'VAT', defaultTaxRate: 5.0 },
  
  // Default
  'OTHER': { currency: 'USD', taxName: 'Tax', defaultTaxRate: 0.0 },
};

// Comprehensive EU Localization Data for future UI features
const EU_LOCALIZATION_DATA: Record<string, {
  vatTerm: string;
  vatRate: number;
  invoiceTerm: string;
  invoiceNumberFormat: string;
  dateFormat: string;
  currency: string;
}> = {
  'AT': { vatTerm: 'USt.', vatRate: 20, invoiceTerm: 'Rechnung', invoiceNumberFormat: 'Rechnung #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'BE': { vatTerm: 'TVA / BTW', vatRate: 21, invoiceTerm: 'Facture / Factuur', invoiceNumberFormat: 'Facture / Factuur #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'BG': { vatTerm: 'ДДС', vatRate: 20, invoiceTerm: 'Фактура', invoiceNumberFormat: 'Фактура #1001', dateFormat: 'DD.MM.YYYY', currency: 'BGN' },
  'HR': { vatTerm: 'PDV', vatRate: 25, invoiceTerm: 'Račun', invoiceNumberFormat: 'Račun #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'CY': { vatTerm: 'ΦΠΑ', vatRate: 19, invoiceTerm: 'Τιμολόγιο', invoiceNumberFormat: 'Τιμολόγιο #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'CZ': { vatTerm: 'DPH', vatRate: 21, invoiceTerm: 'Faktura', invoiceNumberFormat: 'Faktura #1001', dateFormat: 'DD.MM.YYYY', currency: 'CZK' },
  'DK': { vatTerm: 'MOMS', vatRate: 25, invoiceTerm: 'Faktura', invoiceNumberFormat: 'Faktura #1001', dateFormat: 'DD-MM-YYYY', currency: 'DKK' },
  'EE': { vatTerm: 'Käibemaks', vatRate: 20, invoiceTerm: 'Arve', invoiceNumberFormat: 'Arve #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'FI': { vatTerm: 'ALV', vatRate: 24, invoiceTerm: 'Lasku', invoiceNumberFormat: 'Lasku #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'FR': { vatTerm: 'TVA', vatRate: 20, invoiceTerm: 'Facture', invoiceNumberFormat: 'Facture #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'DE': { vatTerm: 'USt. / MwSt.', vatRate: 19, invoiceTerm: 'Rechnung', invoiceNumberFormat: 'Rechnung #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'GR': { vatTerm: 'ΦΠΑ', vatRate: 24, invoiceTerm: 'Τιμολόγιο', invoiceNumberFormat: 'Τιμολόγιο #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'HU': { vatTerm: 'ÁFA', vatRate: 27, invoiceTerm: 'Számla', invoiceNumberFormat: 'Számla #1001', dateFormat: 'YYYY.MM.DD', currency: 'HUF' },
  'IE': { vatTerm: 'VAT', vatRate: 23, invoiceTerm: 'Invoice', invoiceNumberFormat: 'Invoice #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'IT': { vatTerm: 'IVA', vatRate: 22, invoiceTerm: 'Fattura', invoiceNumberFormat: 'Fattura #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'LV': { vatTerm: 'PVN', vatRate: 21, invoiceTerm: 'Rēķins', invoiceNumberFormat: 'Rēķins #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'LT': { vatTerm: 'PVM', vatRate: 21, invoiceTerm: 'Sąskaita faktūra', invoiceNumberFormat: 'Sąskaita faktūra #1001', dateFormat: 'YYYY-MM-DD', currency: 'EUR' },
  'LU': { vatTerm: 'TVA', vatRate: 16, invoiceTerm: 'Facture', invoiceNumberFormat: 'Facture #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'MT': { vatTerm: 'VAT', vatRate: 18, invoiceTerm: 'Fattura', invoiceNumberFormat: 'Fattura #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'NL': { vatTerm: 'BTW', vatRate: 21, invoiceTerm: 'Factuur', invoiceNumberFormat: 'Factuur #1001', dateFormat: 'DD-MM-YYYY', currency: 'EUR' },
  'PL': { vatTerm: 'VAT', vatRate: 23, invoiceTerm: 'Faktura', invoiceNumberFormat: 'Faktura #1001', dateFormat: 'DD.MM.YYYY', currency: 'PLN' },
  'PT': { vatTerm: 'IVA', vatRate: 23, invoiceTerm: 'Fatura', invoiceNumberFormat: 'Fatura #1001', dateFormat: 'DD-MM-YYYY', currency: 'EUR' },
  'RO': { vatTerm: 'TVA', vatRate: 19, invoiceTerm: 'Factură', invoiceNumberFormat: 'Factură #1001', dateFormat: 'DD.MM.YYYY', currency: 'RON' },
  'SK': { vatTerm: 'DPH', vatRate: 20, invoiceTerm: 'Faktúra', invoiceNumberFormat: 'Faktúra #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'SI': { vatTerm: 'DDV', vatRate: 22, invoiceTerm: 'Račun', invoiceNumberFormat: 'Račun #1001', dateFormat: 'DD.MM.YYYY', currency: 'EUR' },
  'ES': { vatTerm: 'IVA', vatRate: 21, invoiceTerm: 'Factura', invoiceNumberFormat: 'Factura #1001', dateFormat: 'DD/MM/YYYY', currency: 'EUR' },
  'SE': { vatTerm: 'MOMS', vatRate: 25, invoiceTerm: 'Faktura', invoiceNumberFormat: 'Faktura #1001', dateFormat: 'YYYY-MM-DD', currency: 'SEK' },
  // Middle East
  'AE': { vatTerm: 'VAT', vatRate: 5, invoiceTerm: 'Invoice', invoiceNumberFormat: 'Invoice #1001', dateFormat: 'DD/MM/YYYY', currency: 'AED' },
};

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    businessName: '',
    selectedRegion: '',
    selectedIndustry: '',
    logoUri: null,
  });

  // Load onboarding data from AsyncStorage when provider initializes
  useEffect(() => {
    loadOnboardingData();
  }, []);

  const updateBusinessInfo = ({ businessName, selectedRegion }: { businessName: string, selectedRegion: string }) => {
    const newData = { ...onboardingData, businessName, selectedRegion };
    console.log('[OnboardingProvider] updateBusinessInfo called with:', { businessName, selectedRegion });
    console.log('[OnboardingProvider] Current data before update:', onboardingData);
    console.log('[OnboardingProvider] New data after update:', newData);
    setOnboardingData(newData);
    // Also save to AsyncStorage for persistence
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newData));
    console.log('[OnboardingProvider] Saved to AsyncStorage');
  };

  const updateIndustry = (selectedIndustry: string) => {
    const newData = { ...onboardingData, selectedIndustry };
    console.log('[OnboardingProvider] updateIndustry called with:', selectedIndustry);
    console.log('[OnboardingProvider] Current data before update:', onboardingData);
    console.log('[OnboardingProvider] New data after update:', newData);
    setOnboardingData(newData);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newData));
    console.log('[OnboardingProvider] Saved to AsyncStorage');
  };

  const updateLogo = (logoUri: string | null) => {
    const newData = { ...onboardingData, logoUri };
    console.log('[OnboardingProvider] updateLogo called with:', logoUri);
    console.log('[OnboardingProvider] Current data before update:', onboardingData);
    console.log('[OnboardingProvider] New data after update:', newData);
    setOnboardingData(newData);
    AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(newData));
    console.log('[OnboardingProvider] Saved to AsyncStorage');
  };

  const saveOnboardingData = async (userId?: string): Promise<void> => {
    try {
      if (!userId) {
        console.log('[OnboardingProvider] No userId provided, skipping save');
        return;
      }

      // Load fresh data from AsyncStorage to make sure we have the latest
      const storedData = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      let dataToSave = onboardingData;
      
      if (storedData) {
        try {
          const parsedData = JSON.parse(storedData);
          dataToSave = parsedData;
          console.log('[OnboardingProvider] Loaded fresh data from AsyncStorage:', parsedData);
        } catch (error) {
          console.error('[OnboardingProvider] Error parsing stored data:', error);
        }
      }

      // Check if we have any onboarding data to save
      const hasData = dataToSave.businessName || 
                     dataToSave.selectedRegion || 
                     dataToSave.selectedIndustry || 
                     dataToSave.logoUri;

      if (!hasData) {
        console.log('[OnboardingProvider] No onboarding data to save');
        console.log('[OnboardingProvider] Current state:', dataToSave);
        console.log('[OnboardingProvider] AsyncStorage data:', storedData);
        return;
      }

      console.log('[OnboardingProvider] Saving onboarding data for user:', userId);
      console.log('[OnboardingProvider] Data to save:', dataToSave);

      // Get regional settings based on selected region
      const regionalSettings = REGION_CURRENCY_TAX_MAP[dataToSave.selectedRegion] || 
                              REGION_CURRENCY_TAX_MAP['OTHER'];
      
      console.log('[OnboardingProvider] Regional settings for', dataToSave.selectedRegion, ':', regionalSettings);

      // Prepare business settings data
      const businessSettingsData: any = {
        user_id: userId,
        updated_at: new Date().toISOString(),
        // Set clean + navy defaults for all new users
        default_invoice_design: 'clean',
        default_accent_color: '#1E40AF',
      };

      // Add business name if provided
      if (dataToSave.businessName) {
        businessSettingsData.business_name = dataToSave.businessName;
        console.log('[OnboardingProvider] Adding business name:', dataToSave.businessName);
      }

      // Add region and auto-set currency/tax if provided
      if (dataToSave.selectedRegion) {
        businessSettingsData.region = dataToSave.selectedRegion;
        businessSettingsData.currency_code = regionalSettings.currency;
        businessSettingsData.tax_name = regionalSettings.taxName;
        businessSettingsData.default_tax_rate = regionalSettings.defaultTaxRate;
        businessSettingsData.auto_apply_tax = true; // Enable tax by default for business users
        console.log('[OnboardingProvider] Adding region settings:', {
          region: dataToSave.selectedRegion,
          currency: regionalSettings.currency,
          taxName: regionalSettings.taxName,
          taxRate: regionalSettings.defaultTaxRate
        });
      }

      // Add logo if provided
      if (dataToSave.logoUri) {
        businessSettingsData.business_logo_url = dataToSave.logoUri;
        console.log('[OnboardingProvider] Adding logo URL:', dataToSave.logoUri);
      }

      console.log('[OnboardingProvider] Final business settings data:', businessSettingsData);

      // Save to business_settings table (upsert to handle existing records)
      const { error: businessError } = await supabase
        .from('business_settings')
        .upsert(businessSettingsData, { onConflict: 'user_id' });

      if (businessError) {
        console.error('[OnboardingProvider] Error saving business settings:', businessError);
        throw businessError;
      }

      console.log('[OnboardingProvider] Successfully saved business settings');

      // Also save industry to user_profiles if provided
      if (dataToSave.selectedIndustry) {
        console.log('[OnboardingProvider] Saving industry to user_profiles:', dataToSave.selectedIndustry);
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ 
            industry: dataToSave.selectedIndustry,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (profileError) {
          console.error('[OnboardingProvider] Error saving industry to profile:', profileError);
          // Don't throw here, business settings are more important
        } else {
          console.log('[OnboardingProvider] Successfully saved industry to user_profiles');
        }
      }

      console.log('[OnboardingProvider] Successfully saved all onboarding data to database');
      
      // Clear from storage after successful save
      await clearOnboardingData();
      console.log('[OnboardingProvider] Cleared onboarding data from AsyncStorage');
    } catch (error) {
      console.error('[OnboardingProvider] Error saving onboarding data:', error);
      throw error;
    }
  };

  const clearOnboardingData = async (): Promise<void> => {
    setOnboardingData({
      businessName: '',
      selectedRegion: '',
      selectedIndustry: '',
      logoUri: null,
    });
    await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
  };

  const loadOnboardingData = async (): Promise<void> => {
    try {
      const storedData = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (storedData) {
        setOnboardingData(JSON.parse(storedData));
      }
    } catch (error) {
      console.error('[OnboardingProvider] Error loading onboarding data:', error);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        onboardingData,
        updateBusinessInfo,
        updateIndustry,
        updateLogo,
        saveOnboardingData,
        clearOnboardingData,
        loadOnboardingData,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};

// Export localization data for future use
export { EU_LOCALIZATION_DATA }; 
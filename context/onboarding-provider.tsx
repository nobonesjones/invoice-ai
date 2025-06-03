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
  'US': { currency: 'USD', taxName: 'Sales Tax', defaultTaxRate: 8.5 },
  'CA': { currency: 'CAD', taxName: 'GST/HST', defaultTaxRate: 13.0 },
  'GB': { currency: 'GBP', taxName: 'VAT', defaultTaxRate: 20.0 },
  'DE': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 19.0 },
  'FR': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 20.0 },
  'AU': { currency: 'AUD', taxName: 'GST', defaultTaxRate: 10.0 },
  'NZ': { currency: 'NZD', taxName: 'GST', defaultTaxRate: 15.0 },
  'NL': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 21.0 },
  'SE': { currency: 'SEK', taxName: 'VAT', defaultTaxRate: 25.0 },
  'NO': { currency: 'NOK', taxName: 'VAT', defaultTaxRate: 25.0 },
  'DK': { currency: 'DKK', taxName: 'VAT', defaultTaxRate: 25.0 },
  'FI': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 24.0 },
  'CH': { currency: 'CHF', taxName: 'VAT', defaultTaxRate: 7.7 },
  'AT': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 20.0 },
  'BE': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 21.0 },
  'IE': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 23.0 },
  'ES': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 21.0 },
  'IT': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 22.0 },
  'PT': { currency: 'EUR', taxName: 'VAT', defaultTaxRate: 23.0 },
  'JP': { currency: 'JPY', taxName: 'Consumption Tax', defaultTaxRate: 10.0 },
  'KR': { currency: 'KRW', taxName: 'VAT', defaultTaxRate: 10.0 },
  'SG': { currency: 'SGD', taxName: 'GST', defaultTaxRate: 8.0 },
  'HK': { currency: 'HKD', taxName: 'Tax', defaultTaxRate: 0.0 },
  'OTHER': { currency: 'USD', taxName: 'Tax', defaultTaxRate: 0.0 },
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
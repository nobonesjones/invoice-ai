import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSupabase } from '@/context/supabase-provider';
import PaywallService, { PaywallConfig } from '@/services/paywallService';

interface PaywallContextType {
  isInitialized: boolean;
  isLoading: boolean;
  isSubscribed: boolean;
  presentPaywall: (config: PaywallConfig) => Promise<void>;
  restorePurchases: () => Promise<void>;
  checkSubscriptionStatus: () => Promise<boolean>;
}

const PaywallContext = createContext<PaywallContextType | undefined>(undefined);

interface PaywallProviderProps {
  children: ReactNode;
}

export function PaywallProvider({ children }: PaywallProviderProps) {
  const { user } = useSupabase();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const initializePaywall = async () => {
    try {
      setIsLoading(true);
      // Temporarily disable Superwall initialization to avoid native module errors
      console.log('[PaywallProvider] Temporarily using mock paywall services');
      setIsInitialized(true);
      setIsSubscribed(false); // Default to not subscribed
      
      console.log('[PaywallProvider] Mock paywall services initialized successfully');
    } catch (error) {
      console.error('[PaywallProvider] Failed to initialize paywall services:', error);
      // Don't block the app if paywall initialization fails
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const presentPaywall = async (config: PaywallConfig): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Paywall services not initialized');
    }
    
    try {
      console.log('[PaywallProvider] Mock paywall presented for:', config.event);
      console.log('[PaywallProvider] This would show your Superwall paywall in production');
      // Don't actually call the service to avoid native module errors
      // await PaywallService.presentPaywall(config);
    } catch (error) {
      console.error('[PaywallProvider] Failed to present paywall:', error);
      throw error;
    }
  };

  const restorePurchases = async (): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Paywall services not initialized');
    }
    
    try {
      console.log('[PaywallProvider] Mock restore purchases');
      // Don't actually call the service to avoid native module errors
      // await PaywallService.restorePurchases();
    } catch (error) {
      console.error('[PaywallProvider] Failed to restore purchases:', error);
      throw error;
    }
  };

  const checkSubscriptionStatus = async (): Promise<boolean> => {
    if (!isInitialized) {
      return false;
    }
    
    try {
      console.log('[PaywallProvider] Mock subscription check - returning false');
      // Don't actually call the service to avoid native module errors
      // const subscriptionStatus = await PaywallService.isUserSubscribed();
      // setIsSubscribed(subscriptionStatus);
      return false;
    } catch (error) {
      console.error('[PaywallProvider] Failed to check subscription status:', error);
      return false;
    }
  };

  useEffect(() => {
    if (user) {
      initializePaywall();
    } else {
      // Reset state when user logs out
      setIsInitialized(false);
      setIsSubscribed(false);
      setIsLoading(false);
    }
  }, [user]);

  const value: PaywallContextType = {
    isInitialized,
    isLoading,
    isSubscribed,
    presentPaywall,
    restorePurchases,
    checkSubscriptionStatus
  };

  return (
    <PaywallContext.Provider value={value}>
      {children}
    </PaywallContext.Provider>
  );
}

export function usePaywall() {
  const context = useContext(PaywallContext);
  if (context === undefined) {
    throw new Error('usePaywall must be used within a PaywallProvider');
  }
  return context;
}
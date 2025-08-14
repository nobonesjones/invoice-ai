import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useSupabase } from '@/context/supabase-provider';
import PaywallService, { PaywallConfig } from '@/services/paywallService';
import { supabase } from '@/config/supabase';

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
      await PaywallService.initialize(user?.id);
      setIsInitialized(true);
      
      // Check initial subscription status (but don't fail if it doesn't work)
      try {
        const subscriptionStatus = await PaywallService.isUserSubscribed();
        setIsSubscribed(subscriptionStatus);
      } catch (error) {
        console.error('[PaywallProvider] Failed to check subscription status:', error);
        setIsSubscribed(false);
      }
      
      console.log('[PaywallProvider] Paywall services initialized successfully');
    } catch (error) {
      console.error('[PaywallProvider] Failed to initialize paywall services:', error);
      // Still set as initialized so paywall can be presented
      setIsInitialized(true);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const presentPaywall = async (config: PaywallConfig): Promise<void> => {
    if (!isInitialized) {
      throw new Error('Paywall services not initialized');
    }
    
    try {
      await PaywallService.presentPaywall(config);
      
      // Check subscription status after paywall interaction
      const subscriptionStatus = await PaywallService.isUserSubscribed();
      setIsSubscribed(subscriptionStatus);
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
      await PaywallService.restorePurchases();
      
      // Check subscription status after restore
      const subscriptionStatus = await PaywallService.isUserSubscribed();
      setIsSubscribed(subscriptionStatus);
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
      const subscriptionStatus = await PaywallService.isUserSubscribed();
      setIsSubscribed(subscriptionStatus);
      return subscriptionStatus;
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

  // Realtime subscription to reflect upgrades immediately
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user_profile_subscription_tier')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          const row = (payload.new || payload.record) as any;
          if (!row) return;
          const subscribed = ['premium', 'grandfathered'].includes(row.subscription_tier || '');
          setIsSubscribed(subscribed);
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [user?.id]);

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

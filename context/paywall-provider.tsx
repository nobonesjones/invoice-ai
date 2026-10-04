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

  // The database is the one place every gate looks (the app's checks and the
  // AI's usage limit both read user_profiles.subscription_tier), but until now
  // only the settings paywall's onDismiss ever wrote it. Anyone who subscribed
  // on another screen, restored on a new phone, or hit a network blip in that
  // one callback stayed 'free' in the database forever while Apple happily
  // billed them. On every sign-in, ask the store (RevenueCat) and heal the row.
  const syncEntitlementToProfile = async (): Promise<boolean | null> => {
    if (!user?.id) return null;
    try {
      const { default: RevenueCatService } = await import('@/services/revenueCatService');
      const entitled = await RevenueCatService.isUserSubscribed();
      if (entitled) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .maybeSingle();
        const tier = profile?.subscription_tier;
        if (tier !== 'premium' && tier !== 'grandfathered') {
          const { UsageService } = await import('@/services/usageService');
          await UsageService.updateSubscriptionTier(user.id, 'premium');
          console.log('[PaywallProvider] Healed subscription_tier to premium from store entitlement');
        }
      }
      return entitled;
    } catch (error) {
      // Store unreachable (offline, simulator) — leave the database as is.
      console.warn('[PaywallProvider] Entitlement sync skipped:', error);
      return null;
    }
  };

  const initializePaywall = async () => {
    try {
      setIsLoading(true);
      await PaywallService.initialize(user?.id);
      setIsInitialized(true);
      
      // Check initial subscription status (but don't fail if it doesn't work)
      try {
        await syncEntitlementToProfile();
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
      await syncEntitlementToProfile();
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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSupabase } from '@/context/supabase-provider';
import { UsageService, UsageStats } from '@/services/usageService';

interface UsageContextType {
  usageStats: UsageStats | null;
  isLoading: boolean;
  refreshUsage: () => Promise<void>;
  canCreateInvoice: boolean;
  showUsageWarning: boolean; // True when user has 1 or fewer invoices remaining
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

interface UsageProviderProps {
  children: ReactNode;
}

export function UsageProvider({ children }: UsageProviderProps) {
  const { user } = useSupabase();
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsage = async () => {
    if (!user) {
      // Check if we're in a trial session even without a user
      try {
        const { TrialService } = await import('@/services/trialService');
        const isTrialSession = await TrialService.isTrialSession();
        
        if (isTrialSession) {
          console.log('[UsageProvider] Refreshing trial session usage');
          const trialStatus = await TrialService.getTrialStatus();
          setUsageStats({
            invoiceCount: trialStatus.invoiceCount,
            sentInvoiceCount: trialStatus.sentInvoiceCount,
            freeLimit: trialStatus.maxInvoices,
            subscriptionTier: 'trial',
            canCreateInvoice: true, // Always true in freemium
            canSendInvoice: trialStatus.canSendInvoice,
            remainingInvoices: trialStatus.remaining,
            isTrial: true
          });
          setIsLoading(false);
          return;
        }
      } catch (trialError) {
        console.error('Error checking trial session:', trialError);
      }
      
      // No user and no trial session
      setUsageStats(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const stats = await UsageService.getUsageStats(user.id);
      setUsageStats(stats);
    } catch (error) {
      console.error('Error fetching usage stats:', error);
      // Set default free tier stats on error
      setUsageStats({
        invoiceCount: 0,
        sentInvoiceCount: 0,
        freeLimit: 3,
        subscriptionTier: 'free',
        canCreateInvoice: true,
        canSendInvoice: true,
        remainingInvoices: 3
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUsage();
  }, [user]);

  const canCreateInvoice = usageStats?.canCreateInvoice ?? false;
  const showUsageWarning = usageStats ? 
    (usageStats.subscriptionTier === 'free' && usageStats.remainingInvoices <= 1) : 
    false;

  const value: UsageContextType = {
    usageStats,
    isLoading,
    refreshUsage,
    canCreateInvoice,
    showUsageWarning
  };

  return (
    <UsageContext.Provider value={value}>
      {children}
    </UsageContext.Provider>
  );
}

export function useUsage() {
  const context = useContext(UsageContext);
  if (context === undefined) {
    throw new Error('useUsage must be used within a UsageProvider');
  }
  return context;
} 
import { useEffect, useState, useCallback } from 'react';
import { useSupabase } from '@/context/supabase-provider';
import { usePaywall } from '@/context/paywall-provider';
import { usePlacement } from 'expo-superwall';
import UsageTrackingService from '@/services/usageTrackingService';

interface UseItemCreationLimitReturn {
  canCreateItem: boolean;
  showLimitPaywall: () => Promise<void>;
  totalItems: number;
  hasReachedLimit: boolean;
  isLoading: boolean;
  checkAndShowPaywall: () => Promise<boolean>; // Returns true if can proceed
}

export function useItemCreationLimit(): UseItemCreationLimitReturn {
  const { user } = useSupabase();
  const { isSubscribed } = usePaywall();
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  // Superwall placement for creation limit
  const { registerPlacement } = usePlacement({
    onError: (err) => {
      console.error('[ItemCreationLimit] Paywall error:', err);
    },
    onPresent: (info) => {
      console.log('[ItemCreationLimit] Paywall presented:', info);
    },
    onDismiss: (info, result) => {
      console.log('[ItemCreationLimit] Paywall dismissed:', result);
    },
  });

  // Load usage stats
  useEffect(() => {
    const loadUsage = async () => {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const stats = await UsageTrackingService.getUserUsageStats(user.id);
        setTotalItems(stats.totalItemsCreated);
      } catch (error) {
        console.error('[ItemCreationLimit] Error loading usage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsage();
  }, [user?.id]);

  const hasReachedLimit = totalItems >= 3;
  const canCreateItem = isSubscribed || !hasReachedLimit;

  const showLimitPaywall = useCallback(async () => {
    if (!registerPlacement) {
      console.error('[ItemCreationLimit] registerPlacement not available');
      return;
    }

    try {
      await registerPlacement({
        placement: 'create_item_limit',
        params: {
          userId: user?.id,
          currentItems: totalItems,
          source: 'creation_attempt'
        }
      });
    } catch (error) {
      console.error('[ItemCreationLimit] Failed to show paywall:', error);
    }
  }, [registerPlacement, user?.id, totalItems]);

  const checkAndShowPaywall = useCallback(async (): Promise<boolean> => {
    if (canCreateItem) {
      return true; // Can proceed
    }
    
    // Show paywall
    await showLimitPaywall();
    return false; // Cannot proceed
  }, [canCreateItem, showLimitPaywall]);

  return {
    canCreateItem,
    showLimitPaywall,
    totalItems,
    hasReachedLimit,
    isLoading,
    checkAndShowPaywall
  };
}
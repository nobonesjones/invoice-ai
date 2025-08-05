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
      console.error('[ItemCreationLimit] registerPlacement not available - using fallback');
      // Fallback for Expo Go - navigate to subscription page
      const { router } = await import('expo-router');
      router.push('/subscription');
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
      // Fallback on error
      const { router } = await import('expo-router');
      router.push('/subscription');
    }
  }, [registerPlacement, user?.id, totalItems]);

  const checkAndShowPaywall = useCallback(async (): Promise<boolean> => {
    // Refresh usage stats before checking
    if (!user?.id) return false;
    
    try {
      const stats = await UsageTrackingService.getUserUsageStats(user.id);
      const currentTotalItems = stats.totalItemsCreated;
      console.log('[ItemCreationLimit] checkAndShowPaywall - Current stats:', {
        totalItems: currentTotalItems,
        isSubscribed,
        canCreate: isSubscribed || currentTotalItems < 3
      });
      
      // Update local state with fresh data
      setTotalItems(currentTotalItems);
      
      // Check if can create based on fresh data
      const canCreate = isSubscribed || currentTotalItems < 3;
      
      if (canCreate) {
        return true; // Can proceed
      }
      
      // Show paywall
      await showLimitPaywall();
      return false; // Cannot proceed
    } catch (error) {
      console.error('[ItemCreationLimit] Error checking paywall:', error);
      return false;
    }
  }, [user?.id, isSubscribed, showLimitPaywall]);

  return {
    canCreateItem,
    showLimitPaywall,
    totalItems,
    hasReachedLimit,
    isLoading,
    checkAndShowPaywall
  };
}
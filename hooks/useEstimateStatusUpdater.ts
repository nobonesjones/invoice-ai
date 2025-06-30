import { useEffect } from 'react';
import { useSupabase } from '@/context/supabase-provider';
import { ESTIMATE_STATUSES, shouldAutoMarkExpired } from '@/constants/estimate-status';

export const useEstimateStatusUpdater = () => {
  const { supabase, user } = useSupabase();

  const updateExpiredEstimates = async () => {
    if (!supabase || !user) return;

    try {
      console.log('[useEstimateStatusUpdater] Checking for expired estimates...');
      
      // Find all 'sent' estimates that are past their valid until date
      const { data: sentEstimates, error: fetchError } = await supabase
        .from('estimates')
        .select('id, valid_until_date, status')
        .eq('user_id', user.id)
        .eq('status', ESTIMATE_STATUSES.SENT)
        .not('valid_until_date', 'is', null);

      if (fetchError) {
        console.error('[useEstimateStatusUpdater] Error fetching sent estimates:', fetchError);
        return;
      }

      if (!sentEstimates || sentEstimates.length === 0) {
        console.log('[useEstimateStatusUpdater] No sent estimates found');
        return;
      }

      // Filter estimates that should be marked expired
      const estimatesToUpdate = sentEstimates.filter(estimate => 
        shouldAutoMarkExpired(estimate.status as any, estimate.valid_until_date)
      );

      if (estimatesToUpdate.length === 0) {
        console.log('[useEstimateStatusUpdater] No estimates to mark as expired');
        return;
      }

      console.log(`[useEstimateStatusUpdater] Marking ${estimatesToUpdate.length} estimates as expired`);

      // Update estimates to expired status
      const updatePromises = estimatesToUpdate.map(estimate =>
        supabase
          .from('estimates')
          .update({ status: ESTIMATE_STATUSES.EXPIRED })
          .eq('id', estimate.id)
      );

      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      
      console.log(`[useEstimateStatusUpdater] Status update complete: ${successful} successful, ${failed} failed`);
      
      if (failed > 0) {
        console.warn('[useEstimateStatusUpdater] Some status updates failed');
      }

    } catch (error: any) {
      console.error('[useEstimateStatusUpdater] Unexpected error:', error);
    }
  };

  // Run status updates on mount and set up periodic checks
  useEffect(() => {
    updateExpiredEstimates();
    
    // Check for expired estimates every 5 minutes
    const interval = setInterval(updateExpiredEstimates, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.id, supabase]);

  return { updateExpiredEstimates };
}; 
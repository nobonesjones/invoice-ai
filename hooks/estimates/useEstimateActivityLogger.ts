import { useSupabase } from '@/context/supabase-provider';

export type EstimateActivityType = 
  | 'created'
  | 'edited' 
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'rejected'
  | 'status_changed'
  | 'note_added'
  | 'downloaded'
  | 'email_sent'
  | 'link_shared'
  | 'expired'
  | 'converted_to_invoice';

interface LogActivityParams {
  estimateId: string;
  activityType: EstimateActivityType;
  description: string;
  data?: Record<string, any>;
}

interface EstimateActivity {
  id: string;
  estimate_id: string;
  user_id: string;
  activity_type: EstimateActivityType;
  activity_description: string;
  activity_data: Record<string, any>;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export const useEstimateActivityLogger = () => {
  const { supabase, user } = useSupabase();

  const logActivity = async ({ estimateId, activityType, description, data = {} }: LogActivityParams): Promise<boolean> => {
    if (!supabase || !user) {
      console.error('[logActivity] No supabase client or user available');
      return false;
    }

    try {
      console.log(`[logActivity] Logging activity: ${activityType} for estimate ${estimateId}`);
      
      const { error } = await supabase
        .from('estimate_activities')
        .insert({
          estimate_id: estimateId,
          user_id: user.id,
          activity_type: activityType,
          activity_description: description,
          activity_data: data
        });

      if (error) {
        console.error('[logActivity] Error logging activity:', error);
        return false;
      }

      console.log(`[logActivity] Successfully logged: ${activityType}`);
      return true;
    } catch (error: any) {
      console.error('[logActivity] Exception:', error.message);
      return false;
    }
  };

  const getEstimateHistory = async (estimateId: string): Promise<EstimateActivity[]> => {
    if (!supabase || !user) {
      console.error('[getEstimateHistory] No supabase client or user available');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('estimate_activities')
        .select('*')
        .eq('estimate_id', estimateId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[getEstimateHistory] Error fetching history:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('[getEstimateHistory] Exception:', error.message);
      return [];
    }
  };

  // Helper functions for common activities
  const logEstimateCreated = (estimateId: string, estimateNumber?: string) => {
    return logActivity({
      estimateId,
      activityType: 'created',
      description: `Estimate ${estimateNumber || estimateId} was created`,
      data: { estimate_number: estimateNumber }
    });
  };

  const logEstimateEdited = (estimateId: string, estimateNumber?: string, changes?: string[]) => {
    return logActivity({
      estimateId,
      activityType: 'edited',
      description: `Estimate ${estimateNumber || estimateId} was edited`,
      data: { estimate_number: estimateNumber, changes }
    });
  };

  const logEstimateSent = (estimateId: string, estimateNumber?: string, method?: string) => {
    return logActivity({
      estimateId,
      activityType: 'sent',
      description: `Estimate ${estimateNumber || estimateId} was sent${method ? ` via ${method}` : ''}`,
      data: { estimate_number: estimateNumber, send_method: method }
    });
  };

  const logEstimateAccepted = (estimateId: string, estimateNumber?: string) => {
    return logActivity({
      estimateId,
      activityType: 'accepted',
      description: `Estimate ${estimateNumber || estimateId} was accepted by client`,
      data: { estimate_number: estimateNumber }
    });
  };

  const logEstimateRejected = (estimateId: string, estimateNumber?: string, reason?: string) => {
    return logActivity({
      estimateId,
      activityType: 'rejected',
      description: `Estimate ${estimateNumber || estimateId} was rejected by client`,
      data: { estimate_number: estimateNumber, rejection_reason: reason }
    });
  };

  const logStatusChanged = (estimateId: string, estimateNumber?: string, fromStatus?: string, toStatus?: string) => {
    return logActivity({
      estimateId,
      activityType: 'status_changed',
      description: `Estimate status changed${fromStatus && toStatus ? ` from ${fromStatus} to ${toStatus}` : ''}`,
      data: { 
        estimate_number: estimateNumber, 
        from_status: fromStatus,
        to_status: toStatus
      }
    });
  };

  const logEstimateConverted = (estimateId: string, estimateNumber?: string, invoiceId?: string, invoiceNumber?: string) => {
    return logActivity({
      estimateId,
      activityType: 'converted_to_invoice',
      description: `Estimate ${estimateNumber || estimateId} was converted to invoice${invoiceNumber ? ` ${invoiceNumber}` : ''}`,
      data: { 
        estimate_number: estimateNumber,
        invoice_id: invoiceId,
        invoice_number: invoiceNumber
      }
    });
  };

  return {
    logActivity,
    getEstimateHistory,
    // Helper functions
    logEstimateCreated,
    logEstimateEdited,
    logEstimateSent,
    logEstimateAccepted,
    logEstimateRejected,
    logStatusChanged,
    logEstimateConverted
  };
}; 
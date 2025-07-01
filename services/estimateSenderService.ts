import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export interface EstimateSendResult {
  success: boolean;
  message?: string;
  error?: string;
}

export class EstimateSenderService {
  /**
   * Mark estimate as sent and log the activity
   */
  static async markEstimateAsSent(
    estimateId: string,
    userId: string,
    estimateNumber: string,
    sendMethod: 'email' | 'link' | 'pdf',
    supabase: SupabaseClient<Database>
  ): Promise<EstimateSendResult> {
    try {
      // Update estimate status to sent
      const { error: updateError } = await supabase
        .from('estimates')
        .update({ 
          status: 'sent',
          updated_at: new Date().toISOString()
        })
        .eq('id', estimateId)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[EstimateSenderService] Error updating status:', updateError);
        return {
          success: false,
          error: 'Failed to update estimate status'
        };
      }

      // Log the send activity
      const { error: activityError } = await supabase
        .from('estimate_activities')
        .insert({
          estimate_id: estimateId,
          user_id: userId,
          activity_type: 'sent',
          description: `Estimate ${estimateNumber} was sent via ${sendMethod}`,
          activity_data: { 
            estimate_number: estimateNumber, 
            send_method: sendMethod 
          }
        });

      if (activityError) {
        console.warn('[EstimateSenderService] Failed to log activity:', activityError);
        // Don't fail the whole operation if logging fails
      }

      return {
        success: true,
        message: `Estimate ${estimateNumber} has been sent successfully`
      };

    } catch (error: any) {
      console.error('[EstimateSenderService] Unexpected error:', error);
      return {
        success: false,
        error: 'An unexpected error occurred while sending the estimate'
      };
    }
  }

  /**
   * Send estimate via email (updates status and logs activity)
   */
  static async sendEstimateByEmail(
    estimateId: string,
    userId: string,
    estimateNumber: string,
    supabase: SupabaseClient<Database>
  ): Promise<EstimateSendResult> {
    return this.markEstimateAsSent(estimateId, userId, estimateNumber, 'email', supabase);
  }

  /**
   * Send estimate via link (updates status and logs activity)
   */
  static async sendEstimateByLink(
    estimateId: string,
    userId: string,
    estimateNumber: string,
    supabase: SupabaseClient<Database>
  ): Promise<EstimateSendResult> {
    return this.markEstimateAsSent(estimateId, userId, estimateNumber, 'link', supabase);
  }

  /**
   * Send estimate via PDF (updates status and logs activity)
   */
  static async sendEstimateByPDF(
    estimateId: string,
    userId: string,
    estimateNumber: string,
    supabase: SupabaseClient<Database>
  ): Promise<EstimateSendResult> {
    return this.markEstimateAsSent(estimateId, userId, estimateNumber, 'pdf', supabase);
  }
} 
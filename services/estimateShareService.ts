import { supabase } from '../config/supabase';
import { Tables } from '../types/database.types';

export interface EstimateShare extends Tables<'estimate_shares'> {}

export interface ShareLinkResult {
  success: boolean;
  shareUrl?: string;
  shareToken?: string;
  expiresAt?: string;
  error?: string;
}

export class EstimateShareService {
  /**
   * Generate a shareable link from Skia canvas for estimates
   * Simplified version that just creates a database record
   */
  static async generateShareLinkFromCanvas(
    estimateId: string,
    userId: string,
    canvasRef: any,
    expiresInDays?: number
  ): Promise<ShareLinkResult> {
    try {
      console.log('[EstimateShareService] NEW VERSION - Starting share link generation for estimate:', estimateId);
      console.log('[EstimateShareService] NO STORAGE BUCKET CODE IN THIS VERSION');
      
      // Generate a unique token
      const shareToken = this.generateUniqueToken();
      
      // Calculate expiration date
      let expiresAt: string | null = null;
      if (expiresInDays && expiresInDays > 0) {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + expiresInDays);
        expiresAt = expiration.toISOString();
      }

      console.log('[EstimateShareService] Creating share record with token:', shareToken);

      // Store share record in estimate_shares table
      const { data: shareRecord, error: insertError } = await supabase
        .from('estimate_shares')
        .insert({
          estimate_id: estimateId,
          user_id: userId,
          share_token: shareToken,
          expires_at: expiresAt,
          is_active: true
        })
        .select()
        .single();

      if (insertError) {
        console.error('[EstimateShareService] Database insert error:', insertError);
        throw insertError;
      }

      console.log('[EstimateShareService] Share record created successfully');

      // Return a simple URL with message since estimate web viewer doesn't exist yet
      const shareUrl = `https://invoices.getsuperinvoice.com/coming-soon.html?type=estimate&token=${shareToken}`;

      return {
        success: true,
        shareUrl: shareUrl,
        shareToken,
        expiresAt: shareRecord.expires_at || undefined
      };

    } catch (error) {
      console.error('[EstimateShareService] Error generating share link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate share link'
      };
    }
  }

  /**
   * Generate a unique token for sharing
   */
  private static generateUniqueToken(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${timestamp}${randomStr}`;
  }
}
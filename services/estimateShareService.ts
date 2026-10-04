import { supabase } from '../config/supabase';
import { Tables } from '../types/database.types';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface EstimateShare extends Tables<'estimate_shares'> {}

export interface ShareLinkResult {
  success: boolean;
  shareUrl?: string;
  shareToken?: string;
  expiresAt?: string;
  /** Public URL of the uploaded PDF, when the upload succeeded. */
  pdfUrl?: string;
  error?: string;
}

const BUCKET = 'shared-estimates';

export class EstimateShareService {
  /**
   * Upload the rendered PDF and create a share record for it, the same shape as
   * invoices. The share URL is the hosted estimate page, which offers the stored
   * PDF for download via `pdf_path`.
   */
  static async generateShareLinkFromPdf(
    estimateId: string,
    userId: string,
    pdfUri: string,
    expiresInDays?: number
  ): Promise<ShareLinkResult> {
    try {
      const shareToken = this.generateUniqueToken();

      let pdfPath: string | null = null;
      let pdfUrl: string | undefined;
      try {
        const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, { encoding: FileSystem.EncodingType.Base64 });
        const fileName = `estimate-${estimateId}-${shareToken}.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(fileName, decode(pdfBase64), { contentType: 'application/pdf', upsert: true });
        if (uploadError) throw uploadError;
        pdfPath = uploadData.path;
        pdfUrl = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path).data.publicUrl;
      } catch (uploadErr) {
        // A missing bucket must not block sending; the email still goes with the
        // PDF attached, it just has no link to it.
        console.warn('[EstimateShareService] PDF upload failed, continuing without pdf_path:', uploadErr);
      }

      let expiresAt: string | null = null;
      if (expiresInDays && expiresInDays > 0) {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + expiresInDays);
        expiresAt = expiration.toISOString();
      }

      const { data: shareRecord, error: insertError } = await supabase
        .from('estimate_shares')
        .insert({
          estimate_id: estimateId,
          user_id: userId,
          share_token: shareToken,
          pdf_path: pdfPath,
          expires_at: expiresAt,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return {
        success: true,
        // The hosted estimate page (shared-estimate) with Accept / Decline.
        shareUrl: `https://invoices.getsuperinvoice.com/estimate/${shareToken}`,
        shareToken,
        pdfUrl,
        expiresAt: shareRecord.expires_at || undefined,
      };
    } catch (error) {
      console.error('[EstimateShareService] Error generating share link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate share link',
      };
    }
  }

  private static generateUniqueToken(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${timestamp}${randomStr}`;
  }
}

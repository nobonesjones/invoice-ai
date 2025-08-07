import { supabase } from '../config/supabase';
import { Tables } from '../types/database.types';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface InvoiceShare extends Tables<'invoice_shares'> {}
export interface InvoiceShareAnalytics extends Tables<'invoice_share_analytics'> {}

export type ShareEventType = 'view' | 'download' | 'print' | 'copy_link';

export interface ShareAnalyticsEvent {
  event_type: ShareEventType;
  ip_address?: string;
  user_agent?: string;
  referrer?: string;
  country?: string;
  city?: string;
  metadata?: Record<string, any>;
}

export interface ShareLinkResult {
  success: boolean;
  shareUrl?: string;
  shareToken?: string;
  expiresAt?: string;
  error?: string;
}

export interface ShareAnalytics {
  totalViews: number;
  totalDownloads: number;
  totalPrints: number;
  uniqueVisitors: number;
  viewsByDay: Array<{ date: string; count: number }>;
  downloadsByDay: Array<{ date: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
  lastViewed?: string;
  lastDownloaded?: string;
}

export class InvoiceShareService {
  /**
   * Generate a shareable PDF link from Skia canvas
   */
  static async generateShareLinkFromCanvas(
    invoiceId: string,
    userId: string,
    canvasRef: any,
    expiresInDays?: number
  ): Promise<ShareLinkResult> {
    try {
      // Generate a unique token
      const shareToken = this.generateUniqueToken();
      
      // Capture the Skia canvas as an image using Skia's native methods
      const image = canvasRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot from Skia canvas');
      }

      // Encode to PNG bytes
      const imageBytes = image.encodeToBytes();
      
      // Convert to base64 for HTML embedding
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < imageBytes.length; i += chunkSize) {
        const chunk = imageBytes.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64String = btoa(binaryString);

      // Convert image to PDF using Print API with exact canvas dimensions
      const { uri: pdfUri } = await Print.printToFileAsync({
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                margin: 0;
                size: ${image.width()}px ${image.height()}px;
              }
              body {
                margin: 0;
                padding: 0;
                width: ${image.width()}px;
                height: ${image.height()}px;
                overflow: hidden;
              }
              .invoice-image {
                width: ${image.width()}px;
                height: ${image.height()}px;
                display: block;
                object-fit: none;
              }
            </style>
          </head>
          <body>
            <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice" />
          </body>
          </html>
        `,
        base64: false,
      });

      // Read PDF file as base64
      const pdfBase64 = await FileSystem.readAsStringAsync(pdfUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Upload PDF to Supabase Storage
      const fileName = `invoice-${invoiceId}-${shareToken}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-invoices')
        .upload(fileName, decode(pdfBase64), {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Calculate expiration date
      let expiresAt: string | null = null;
      if (expiresInDays && expiresInDays > 0) {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + expiresInDays);
        expiresAt = expiration.toISOString();
      }

      // Store share record in database
      const { data: shareRecord, error: insertError } = await supabase
        .from('invoice_shares')
        .insert({
          invoice_id: invoiceId,
          user_id: userId,
          share_token: shareToken,
          pdf_path: uploadData.path,
          expires_at: expiresAt,
          is_active: true
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Clean up temporary PDF file
      await FileSystem.deleteAsync(pdfUri, { idempotent: true });

      // Return branded invoice viewer URL with query parameter
      const shareUrl = `https://invoices.getsuperinvoice.com?token=${shareToken}`;

      return {
        success: true,
        shareUrl: shareUrl,
        shareToken,
        expiresAt: shareRecord.expires_at || undefined
      };

    } catch (error) {
      console.error('[InvoiceShareService] Error generating PDF share link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate PDF share link'
      };
    }
  }

  /**
   * Generate a shareable link for an invoice (legacy HTML method)
   */
  static async generateShareLink(
    invoiceId: string, 
    userId: string,
    expiresInDays?: number
  ): Promise<ShareLinkResult> {
    try {
      // Generate a unique token
      const shareToken = this.generateUniqueToken();
      
      // Calculate expiration date
      let expiresAt: string | null = null;
      if (expiresInDays && expiresInDays > 0) {
        const expiration = new Date();
        expiration.setDate(expiration.getDate() + expiresInDays);
        expiresAt = expiration.toISOString();
      }

      // Check if an active share already exists for this invoice
      const { data: existingShare } = await supabase
        .from('invoice_shares')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      let shareRecord: InvoiceShare;

      if (existingShare) {
        // Update existing share with new token and expiration
        const { data: updatedShare, error: updateError } = await supabase
          .from('invoice_shares')
          .update({
            share_token: shareToken,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingShare.id)
          .select()
          .single();

        if (updateError) throw updateError;
        shareRecord = updatedShare;
      } else {
        // Create new share
        const { data: newShare, error: insertError } = await supabase
          .from('invoice_shares')
          .insert({
            invoice_id: invoiceId,
            user_id: userId,
            share_token: shareToken,
            expires_at: expiresAt,
            is_active: true
          })
          .select()
          .single();

        if (insertError) throw insertError;
        shareRecord = newShare;
      }

      // Use branded invoice viewer with query parameter
      const shareUrl = `https://invoices.getsuperinvoice.com?token=${shareToken}`;

      return {
        success: true,
        shareUrl,
        shareToken,
        expiresAt: shareRecord.expires_at || undefined
      };

    } catch (error) {
      console.error('[InvoiceShareService] Error generating share link:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate share link'
      };
    }
  }

  /**
   * Get invoice data by share token (for public viewing)
   */
  static async getInvoiceByShareToken(shareToken: string) {
    try {
      // Get share record and check if it's valid
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select(`
          *,
          invoices!inner (
            *,
            clients (*),
            invoice_line_items (*),
            users!inner (
              business_settings (*),
              payment_options (*)
            )
          )
        `)
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (shareError || !share) {
        return { success: false, error: 'Share link not found or expired' };
      }

      // Check if expired
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        return { success: false, error: 'Share link has expired' };
      }

      return {
        success: true,
        data: {
          share,
          invoice: share.invoices,
          businessSettings: share.invoices.users.business_settings,
          paymentOptions: share.invoices.users.payment_options
        }
      };

    } catch (error) {
      console.error('[InvoiceShareService] Error getting invoice by token:', error);
      return {
        success: false,
        error: 'Failed to retrieve invoice'
      };
    }
  }

  /**
   * Track share event for analytics
   */
  static async trackShareEvent(
    shareToken: string, 
    eventType: 'view' | 'download' | 'print' | 'copy_link',
    metadata?: {
      userAgent?: string;
      referrer?: string;
      ipAddress?: string;
      country?: string;
      city?: string;
    }
  ) {
    try {
      // Get share record to validate token
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select('id, invoice_id, is_active, expires_at')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (shareError || !share) {
        console.warn('[InvoiceShareService] Share link not found for tracking:', shareToken);
        return { success: false, error: 'Share link not found or expired' };
      }

      // Check if expired
      if (share.expires_at && new Date(share.expires_at) < new Date()) {
        console.warn('[InvoiceShareService] Share link expired for tracking:', shareToken);
        return { success: false, error: 'Share link has expired' };
      }

      // Insert analytics event
      const { error: analyticsError } = await supabase
        .from('invoice_share_analytics')
        .insert({
          share_id: share.id,
          event_type: eventType,
          ip_address: metadata?.ipAddress || 'unknown',
          user_agent: metadata?.userAgent,
          referrer: metadata?.referrer,
          country: metadata?.country,
          city: metadata?.city,
          metadata: {
            timestamp: new Date().toISOString(),
            method: 'web_client'
          }
        });

      if (analyticsError) {
        console.error('[InvoiceShareService] Analytics error:', analyticsError);
      }

      // Log activity for important events
      if (['view', 'download', 'print'].includes(eventType)) {
        const { data: invoice } = await supabase
          .from('invoices')
          .select('user_id')
          .eq('id', share.invoice_id)
          .single();

        if (invoice) {
          const activityType = eventType === 'view' ? 'opened' : eventType === 'download' ? 'downloaded' : 'printed';
          const activityDescription = `Invoice ${activityType} via shared link from ${metadata?.country || 'Unknown location'}`;

          await supabase
            .from('invoice_activities')
            .insert({
              invoice_id: share.invoice_id,
              user_id: invoice.user_id,
              activity_type: activityType,
              activity_description: activityDescription,
              activity_data: {
                share_token: shareToken,
                ip_address: metadata?.ipAddress || 'unknown',
                user_agent: metadata?.userAgent,
                country: metadata?.country,
                city: metadata?.city,
                referrer: metadata?.referrer
              },
              ip_address: metadata?.ipAddress || 'unknown',
              user_agent: metadata?.userAgent
            });
        }
      }

      return { success: true };

    } catch (error) {
      console.error('[InvoiceShareService] Error tracking share event:', error);
      return {
        success: false,
        error: 'Failed to track event'
      };
    }
  }

  /**
   * Track analytics event for a shared invoice
   */
  static async trackEvent(
    shareToken: string,
    event: ShareAnalyticsEvent
  ): Promise<boolean> {
    try {
      // Get share ID from token
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select('id')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (shareError || !share) {
        console.error('[InvoiceShareService] Share not found for tracking:', shareToken);
        return false;
      }

      // Insert analytics event
      const { error: analyticsError } = await supabase
        .from('invoice_share_analytics')
        .insert({
          share_id: share.id,
          event_type: event.event_type,
          ip_address: event.ip_address,
          user_agent: event.user_agent,
          referrer: event.referrer,
          country: event.country,
          city: event.city,
          metadata: event.metadata || {}
        });

      if (analyticsError) {
        console.error('[InvoiceShareService] Error tracking event:', analyticsError);
        return false;
      }

      return true;

    } catch (error) {
      console.error('[InvoiceShareService] Error tracking event:', error);
      return false;
    }
  }

  /**
   * Get comprehensive analytics for a shared invoice
   */
  static async getShareAnalytics(invoiceId: string, userId: string) {
    try {
      const { data: share } = await supabase
        .from('invoice_shares')
        .select(`
          id,
          created_at,
          invoice_share_analytics (*)
        `)
        .eq('invoice_id', invoiceId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!share) return null;

      // Only use analytics from the most recent share link
      const analytics = share.invoice_share_analytics || [];
      
      const totalViews = analytics.filter(a => a.event_type === 'view').length;
      const totalDownloads = analytics.filter(a => a.event_type === 'download').length;
      const totalPrints = analytics.filter(a => a.event_type === 'print').length;
      const uniqueVisitors = new Set(analytics.map(a => a.ip_address)).size;
      
      const lastViewed = analytics
        .filter(a => a.event_type === 'view')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at;
      
      const lastDownloaded = analytics
        .filter(a => a.event_type === 'download')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at;

      // Country analytics
      const countryStats = analytics
        .filter(a => a.country)
        .reduce((acc, a) => {
          acc[a.country] = (acc[a.country] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      const countries = Object.entries(countryStats)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);

      return {
        totalViews,
        totalDownloads,
        totalPrints,
        uniqueVisitors,
        lastViewed,
        lastDownloaded,
        countries,
        shareCreated: share.created_at,
        recentActivity: analytics
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 10)
      };

    } catch (error) {
      console.error('[InvoiceShareService] Error getting analytics:', error);
      return null;
    }
  }

  /**
   * Track when an invoice is opened via shared link
   */
  static async trackInvoiceOpened(shareToken: string, metadata?: any) {
    try {
      const { data: share } = await supabase
        .from('invoice_shares')
        .select('id, invoice_id')
        .eq('share_token', shareToken)
        .eq('is_active', true)
        .single();

      if (!share) return;

      // Insert analytics event
      await supabase
        .from('invoice_share_analytics')
        .insert({
          share_id: share.id,
          event_type: 'view',
          ip_address: metadata?.ipAddress,
          user_agent: metadata?.userAgent,
          referrer: metadata?.referrer,
          country: metadata?.country,
          city: metadata?.city,
          metadata: {
            timestamp: new Date().toISOString(),
            ...metadata
          }
        });

      // Also log to invoice activities for comprehensive tracking
      await supabase
        .from('invoice_activities')
        .insert({
          invoice_id: share.invoice_id,
          activity_type: 'opened',
          description: 'Invoice was opened via shared link',
          activity_data: {
            share_token: shareToken,
            ip_address: metadata?.ipAddress,
            user_agent: metadata?.userAgent,
            country: metadata?.country
          }
        });

    } catch (error) {
      console.error('[InvoiceShareService] Error tracking opened event:', error);
    }
  }

  /**
   * Deactivate a shared invoice link
   */
  static async deactivateShare(invoiceId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('invoice_shares')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('invoice_id', invoiceId)
        .eq('user_id', userId);

      return !error;
    } catch (error) {
      console.error('[InvoiceShareService] Error deactivating share:', error);
      return false;
    }
  }

  /**
   * Generate a unique token for sharing
   */
  private static generateUniqueToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Group events by day for analytics
   */
  private static groupEventsByDay(events: InvoiceShareAnalytics[]): Array<{ date: string; count: number }> {
    const grouped = events.reduce((acc, event) => {
      const date = event.created_at?.split('T')[0] || new Date().toISOString().split('T')[0]; // Get just the date part
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Group events by country for analytics
   */
  private static groupEventsByCountry(events: InvoiceShareAnalytics[]): Array<{ country: string; count: number }> {
    const grouped = events
      .filter(event => event.country)
      .reduce((acc, event) => {
        const country = event.country!;
        acc[country] = (acc[country] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }
} 
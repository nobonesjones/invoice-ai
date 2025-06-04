import { supabase } from '../config/supabase';
import { Tables } from '../types/database.types';

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
   * Generate a shareable link for an invoice
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

      // Construct the share URL
      const baseUrl = process.env.EXPO_PUBLIC_WEB_URL || 'https://your-app.com';
      const shareUrl = `${baseUrl}/shared/invoice/${shareToken}`;

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
   * Get analytics for a shared invoice
   */
  static async getShareAnalytics(invoiceId: string, userId: string): Promise<ShareAnalytics | null> {
    try {
      // Get share record
      const { data: share, error: shareError } = await supabase
        .from('invoice_shares')
        .select('id')
        .eq('invoice_id', invoiceId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (shareError || !share) {
        return null;
      }

      // Get analytics data
      const { data: analytics, error: analyticsError } = await supabase
        .from('invoice_share_analytics')
        .select('*')
        .eq('share_id', share.id)
        .order('created_at', { ascending: false });

      if (analyticsError) {
        console.error('[InvoiceShareService] Error getting analytics:', analyticsError);
        return null;
      }

      if (!analytics || analytics.length === 0) {
        return {
          totalViews: 0,
          totalDownloads: 0,
          totalPrints: 0,
          uniqueVisitors: 0,
          viewsByDay: [],
          downloadsByDay: [],
          countries: []
        };
      }

      // Process analytics data
      const totalViews = analytics.filter(a => a.event_type === 'view').length;
      const totalDownloads = analytics.filter(a => a.event_type === 'download').length;
      const totalPrints = analytics.filter(a => a.event_type === 'print').length;
      
      // Count unique visitors by IP
      const uniqueIps = new Set(analytics.map(a => a.ip_address).filter(Boolean));
      const uniqueVisitors = uniqueIps.size;

      // Group by day
      const viewsByDay = this.groupEventsByDay(analytics.filter(a => a.event_type === 'view'));
      const downloadsByDay = this.groupEventsByDay(analytics.filter(a => a.event_type === 'download'));

      // Group by country
      const countries = this.groupEventsByCountry(analytics);

      // Get last events
      const lastViewed = analytics.find(a => a.event_type === 'view')?.created_at;
      const lastDownloaded = analytics.find(a => a.event_type === 'download')?.created_at;

      return {
        totalViews,
        totalDownloads,
        totalPrints,
        uniqueVisitors,
        viewsByDay,
        downloadsByDay,
        countries,
        lastViewed,
        lastDownloaded
      };

    } catch (error) {
      console.error('[InvoiceShareService] Error getting analytics:', error);
      return null;
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
      const date = event.created_at.split('T')[0]; // Get just the date part
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
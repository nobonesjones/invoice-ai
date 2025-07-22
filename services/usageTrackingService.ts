import { createClient } from '@/lib/supabase';

interface UsageStats {
  invoicesCreated: number;
  estimatesCreated: number;
  totalItemsCreated: number;
}

class UsageTrackingService {
  private static instance: UsageTrackingService;
  private supabase = createClient();

  static getInstance(): UsageTrackingService {
    if (!UsageTrackingService.instance) {
      UsageTrackingService.instance = new UsageTrackingService();
    }
    return UsageTrackingService.instance;
  }

  /**
   * Get current usage stats for a user
   */
  async getUserUsageStats(userId: string): Promise<UsageStats> {
    try {
      // Count invoices created by user
      const { count: invoicesCount, error: invoicesError } = await this.supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (invoicesError) {
        console.error('[UsageTracking] Error counting invoices:', invoicesError);
      }

      // Count estimates created by user
      const { count: estimatesCount, error: estimatesError } = await this.supabase
        .from('estimates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (estimatesError) {
        console.error('[UsageTracking] Error counting estimates:', estimatesError);
      }

      const invoicesCreated = invoicesCount || 0;
      const estimatesCreated = estimatesCount || 0;
      const totalItemsCreated = invoicesCreated + estimatesCreated;

      console.log('[UsageTracking] Usage stats for user:', {
        userId,
        invoicesCreated,
        estimatesCreated,
        totalItemsCreated
      });

      return {
        invoicesCreated,
        estimatesCreated,
        totalItemsCreated
      };
    } catch (error) {
      console.error('[UsageTracking] Error getting usage stats:', error);
      return {
        invoicesCreated: 0,
        estimatesCreated: 0,
        totalItemsCreated: 0
      };
    }
  }

  /**
   * Check if user can create a new item (invoice or estimate)
   */
  async canUserCreateItem(userId: string, isSubscribed: boolean): Promise<boolean> {
    // Subscribed users have unlimited access
    if (isSubscribed) {
      return true;
    }

    // Free users are limited to 3 total items
    const stats = await this.getUserUsageStats(userId);
    const canCreate = stats.totalItemsCreated < 3;

    console.log('[UsageTracking] Can user create item?', {
      userId,
      isSubscribed,
      totalItems: stats.totalItemsCreated,
      canCreate
    });

    return canCreate;
  }

  /**
   * Get remaining items for free users
   */
  async getRemainingItems(userId: string, isSubscribed: boolean): Promise<number> {
    if (isSubscribed) {
      return Infinity; // Unlimited for subscribed users
    }

    const stats = await this.getUserUsageStats(userId);
    const remaining = Math.max(0, 3 - stats.totalItemsCreated);

    console.log('[UsageTracking] Remaining items for user:', {
      userId,
      totalItems: stats.totalItemsCreated,
      remaining
    });

    return remaining;
  }

  /**
   * Constants for usage limits
   */
  static readonly FREE_TIER_LIMIT = 3;
}

export default UsageTrackingService.getInstance();
export { UsageTrackingService };
export type { UsageStats };
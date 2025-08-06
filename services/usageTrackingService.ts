import { supabase } from '@/lib/supabase';

interface UsageStats {
  invoicesCreated: number;
  estimatesCreated: number;
  totalItemsCreated: number;
}

class UsageTrackingService {
  private static instance: UsageTrackingService;
  private supabase = supabase;

  static getInstance(): UsageTrackingService {
    if (!UsageTrackingService.instance) {
      UsageTrackingService.instance = new UsageTrackingService();
    }
    return UsageTrackingService.instance;
  }

  /**
   * Get current usage stats for a user (lifetime total)
   */
  async getUserUsageStats(userId: string): Promise<UsageStats> {
    try {
      // Checking lifetime usage for user

      // Count ALL invoices created by user
      const { count: invoicesCount, error: invoicesError } = await this.supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (invoicesError) {
        // Error counting invoices
      }

      // Count ALL estimates created by user
      const { count: estimatesCount, error: estimatesError } = await this.supabase
        .from('estimates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (estimatesError) {
        // Error counting estimates
      }

      const invoicesCreated = invoicesCount || 0;
      const estimatesCreated = estimatesCount || 0;
      const totalItemsCreated = invoicesCreated + estimatesCreated;

      // Usage stats calculated for user

      return {
        invoicesCreated,
        estimatesCreated,
        totalItemsCreated
      };
    } catch (error) {
      // Error getting usage stats
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

    // Can user create item check completed

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

    // Remaining items calculated for user

    return remaining;
  }

  /**
   * Increment usage count (called after creating an invoice or estimate)
   * Note: This is just for logging/tracking purposes since we count from the database
   */
  async incrementUsageCount(userId: string, type: 'invoice' | 'estimate'): Promise<void> {
    // Usage incremented for user
    
    // Force a refresh of the usage stats
    await this.getUserUsageStats(userId);
  }

  /**
   * Constants for usage limits
   */
  static readonly FREE_TIER_LIMIT = 3;
}

export default UsageTrackingService.getInstance();
export { UsageTrackingService };
export type { UsageStats };
import { supabase } from '@/config/supabase';

export interface UsageStats {
  invoiceCount: number;
  sentInvoiceCount: number;
  freeLimit: number;
  subscriptionTier: 'free' | 'premium' | 'grandfathered';
  canCreateInvoice: boolean;
  canSendInvoice: boolean;
  remainingInvoices: number;
  subscriptionExpiresAt?: Date;
}

export interface UserProfile {
  id: string;
  onboarding_completed: boolean;
  industry?: string;
  region?: string;
  business_logo_url?: string;
  invoice_count: number;
  subscription_tier: string;
  free_limit: number;
  subscription_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export class UsageService {
  /**
   * Check if user can create a new invoice based on their current usage and subscription
   * Users can create unlimited invoices but can only send 3 free invoices
   */
  static async checkInvoiceLimit(userId: string): Promise<{
    canCreate: boolean; // Always true for freemium flow
    canSend: boolean; // Check send permissions based on sent count
    remaining: number; // Remaining sends
    total: number;
    subscriptionTier: string;
    requiresUpgrade: boolean;
  }> {
    try {
      // Get user profile from database
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }

      // If profile doesn't exist, create it
      if (!profile) {
        await this.createUserProfile(userId);
        return {
          canCreate: true,
          canSend: true,
          remaining: 3,
          total: 0,
          subscriptionTier: 'free',
          requiresUpgrade: false
        };
      }

      const isUnlimited = ['premium', 'grandfathered'].includes(profile.subscription_tier);
      
      if (isUnlimited) {
        return {
          canCreate: true,
          canSend: true,
          remaining: -1, // Unlimited
          total: profile.sent_invoice_count || 0,
          subscriptionTier: profile.subscription_tier,
          requiresUpgrade: false
        };
      }

      // Free tier logic - check sent invoices, not created
      const sentCount = profile.sent_invoice_count || 0;
      const remaining = Math.max(0, profile.free_limit - sentCount);
      const canSend = remaining > 0;

      return {
        canCreate: true, // Always allow creation
        canSend,
        remaining,
        total: sentCount,
        subscriptionTier: profile.subscription_tier,
        requiresUpgrade: !canSend
      };

    } catch (error) {
      console.error('Error checking invoice limit:', error);
      throw error;
    }
  }

  /**
   * Increment the user's invoice count after successful invoice creation
   */
  static async incrementInvoiceCount(userId: string): Promise<void> {
    try {

      // Original authenticated user logic
      // First get current count
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('invoice_count')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current invoice count:', fetchError);
        throw fetchError;
      }

      // If profile doesn't exist, create it first
      if (!profile) {
        await this.createUserProfile(userId);
      }

      // Then increment it
      const newCount = (profile?.invoice_count || 0) + 1;
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          invoice_count: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error incrementing invoice count:', error);
        throw error;
      }

      console.log(`[UsageService] Incremented invoice count for user ${userId}`);
    } catch (error) {
      console.error('Error incrementing invoice count:', error);
      throw error;
    }
  }

  /**
   * Increment the user's sent invoice count after successful invoice send
   * This is what triggers the freemium limits
   */
  static async incrementSentInvoiceCount(userId: string): Promise<void> {
    try {

      // Authenticated user logic
      // First get current count
      const { data: profile, error: fetchError } = await supabase
        .from('user_profiles')
        .select('sent_invoice_count')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching current sent invoice count:', fetchError);
        throw fetchError;
      }

      // If profile doesn't exist, create it first
      if (!profile) {
        await this.createUserProfile(userId);
      }

      // Then increment it
      const newCount = (profile?.sent_invoice_count || 0) + 1;
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          sent_invoice_count: newCount,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error incrementing sent invoice count:', error);
        throw error;
      }

      console.log(`[UsageService] Incremented sent invoice count for user ${userId}`);
    } catch (error) {
      console.error('Error incrementing sent invoice count:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive usage statistics for a user
   */
  static async getUsageStats(userId: string): Promise<UsageStats> {
    try {
      // Get user profile from database
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching usage stats:', error);
        throw error;
      }

      // If profile doesn't exist, create default stats
      if (!profile) {
        return {
          invoiceCount: 0,
          sentInvoiceCount: 0,
          freeLimit: 3,
          subscriptionTier: 'free' as any,
          canCreateInvoice: true,
          canSendInvoice: true,
          remainingInvoices: 3,
          isTrial: false
        };
      }

      const isUnlimited = ['premium', 'grandfathered'].includes(profile.subscription_tier);
      const sentCount = profile.sent_invoice_count || 0;
      
      return {
        invoiceCount: profile.invoice_count,
        sentInvoiceCount: sentCount,
        freeLimit: profile.free_limit,
        subscriptionTier: profile.subscription_tier as any,
        canCreateInvoice: true, // Always true for freemium
        canSendInvoice: isUnlimited || sentCount < profile.free_limit,
        remainingInvoices: isUnlimited ? -1 : Math.max(0, profile.free_limit - sentCount),
        subscriptionExpiresAt: profile.subscription_expires_at ? new Date(profile.subscription_expires_at) : undefined,
        isTrial: false
      };
    } catch (error) {
      console.error('Error getting usage stats:', error);
      throw error;
    }
  }

  /**
   * Update user's subscription tier (when they upgrade)
   */
  static async updateSubscriptionTier(
    userId: string, 
    tier: 'free' | 'premium' | 'trial' | 'grandfathered',
    expiresAt?: Date
  ): Promise<void> {
    try {
      const updateData: any = {
        subscription_tier: tier,
        updated_at: new Date().toISOString()
      };

      if (expiresAt) {
        updateData.subscription_expires_at = expiresAt.toISOString();
      }

      const { error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('id', userId);

      if (error) {
        console.error('Error updating subscription tier:', error);
        throw error;
      }

      console.log(`[UsageService] Updated subscription tier to ${tier} for user ${userId}`);
    } catch (error) {
      console.error('Error updating subscription tier:', error);
      throw error;
    }
  }

  /**
   * Create user profile if it doesn't exist
   */
  static async createUserProfile(userId: string): Promise<UserProfile> {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          onboarding_completed: false,
          invoice_count: 0,
          subscription_tier: 'free',
          free_limit: 3
        })
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }

      console.log(`[UsageService] Created profile for user ${userId}`);
      return profile;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * Get user profile data
   */
  static async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }

      return profile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  /**
   * Update onboarding completion status
   */
  static async markOnboardingCompleted(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error marking onboarding completed:', error);
        throw error;
      }

      console.log(`[UsageService] Marked onboarding completed for user ${userId}`);
    } catch (error) {
      console.error('Error marking onboarding completed:', error);
      throw error;
    }
  }

  /**
   * Update user's business information from onboarding
   */
  static async updateBusinessInfo(userId: string, businessInfo: {
    industry?: string;
    region?: string;
    business_logo_url?: string;
  }): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          ...businessInfo,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error updating business info:', error);
        throw error;
      }

      console.log(`[UsageService] Updated business info for user ${userId}`);
    } catch (error) {
      console.error('Error updating business info:', error);
      throw error;
    }
  }

  /**
   * Reset invoice count (useful for testing or subscription resets)
   */
  static async resetInvoiceCount(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ 
          invoice_count: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Error resetting invoice count:', error);
        throw error;
      }

      console.log(`[UsageService] Reset invoice count for user ${userId}`);
    } catch (error) {
      console.error('Error resetting invoice count:', error);
      throw error;
    }
  }

  /**
   * Get all users and their usage stats (admin function)
   */
  static async getAllUsageStats(): Promise<UserProfile[]> {
    try {
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching all usage stats:', error);
        throw error;
      }

      return profiles || [];
    } catch (error) {
      console.error('Error getting all usage stats:', error);
      throw error;
    }
  }
} 
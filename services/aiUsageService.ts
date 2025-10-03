import { supabase } from '@/config/supabase';
import { UsageService } from '@/services/usageService';

type SubscriptionTier = 'free' | 'premium' | 'trial' | 'grandfathered';

export interface AiUsageInfo {
  aiItemsCreated: number;
  lastAiItemCreatedAt: string | null;
  subscriptionTier: SubscriptionTier;
}

export interface AiAllowanceResult {
  allowed: boolean;
  reason: 'subscribed' | 'free_slot' | 'limit_reached' | 'no_user';
  remainingFreeSlots: number;
  usage: AiUsageInfo | null;
}

class AIUsageService {
  private static instance: AIUsageService;

  static getInstance(): AIUsageService {
    if (!AIUsageService.instance) {
      AIUsageService.instance = new AIUsageService();
    }
    return AIUsageService.instance;
  }

  async getUsage(userId: string): Promise<AiUsageInfo | null> {
    if (!userId) {
      return null;
    }

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('ai_items_created, last_ai_item_created_at, subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[AIUsageService] Failed to load user profile:', error.message || error);
      throw error;
    }

    if (!profile) {
      await UsageService.createUserProfile(userId);
      return {
        aiItemsCreated: 0,
        lastAiItemCreatedAt: null,
        subscriptionTier: 'free',
      };
    }

    return {
      aiItemsCreated: profile.ai_items_created ?? 0,
      lastAiItemCreatedAt: profile.last_ai_item_created_at ?? null,
      subscriptionTier: (profile.subscription_tier as SubscriptionTier) ?? 'free',
    };
  }

  async incrementUsage(userId: string): Promise<void> {
    if (!userId) {
      console.warn('[AIUsageService] incrementUsage called without userId');
      return;
    }

    const usage = await this.getUsage(userId);
    const nextCount = (usage?.aiItemsCreated ?? 0) + 1;

    const { error } = await supabase
      .from('user_profiles')
      .update({
        ai_items_created: nextCount,
        last_ai_item_created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('[AIUsageService] Failed to increment AI usage:', error.message || error);
      throw error;
    }
  }

  async evaluateAllowance(userId: string): Promise<AiAllowanceResult> {
    if (!userId) {
      return {
        allowed: false,
        reason: 'no_user',
        remainingFreeSlots: 0,
        usage: null,
      };
    }

    const usage = await this.getUsage(userId);

    if (!usage) {
      return {
        allowed: false,
        reason: 'no_user',
        remainingFreeSlots: 0,
        usage: null,
      };
    }

    const isSubscribed = ['premium', 'grandfathered'].includes(usage.subscriptionTier);

    if (isSubscribed) {
      return {
        allowed: true,
        reason: 'subscribed',
        remainingFreeSlots: Infinity,
        usage,
      };
    }

    const aiCreated = usage.aiItemsCreated ?? 0;
    const limit = 3;

    if (aiCreated < limit) {
      return {
        allowed: true,
        reason: 'free_slot',
        remainingFreeSlots: limit - aiCreated,
        usage,
      };
    }

    return {
      allowed: false,
      reason: 'limit_reached',
      remainingFreeSlots: 0,
      usage,
    };
  }
}

export default AIUsageService.getInstance();

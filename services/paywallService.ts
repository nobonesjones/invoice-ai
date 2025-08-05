import RevenueCatService from './revenueCatService';
import SuperwallService from './superwallService';

export interface PaywallConfig {
  event: string;
  params?: Record<string, any>;
}

class PaywallService {
  private static instance: PaywallService;
  private isInitialized = false;

  static getInstance(): PaywallService {
    if (!PaywallService.instance) {
      PaywallService.instance = new PaywallService();
    }
    return PaywallService.instance;
  }

  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('[PaywallService] Already initialized');
      return;
    }

    try {
      console.log('[PaywallService] Initializing RevenueCat and Superwall...');
      
      // Initialize RevenueCat
      try {
        await RevenueCatService.initialize(userId);
        console.log('[PaywallService] RevenueCat initialized successfully');
      } catch (error) {
        console.error('[PaywallService] RevenueCat initialization failed:', error);
        // Continue with Superwall only
      }
      
      // Initialize Superwall
      await SuperwallService.initialize();
      
      // If user is provided, set it for Superwall only (but don't fail if it doesn't work)
      if (userId) {
        try {
          await SuperwallService.setUserId(userId);
        } catch (error) {
          console.error('[PaywallService] Failed to set user ID, continuing anyway:', error);
        }
      }

      this.isInitialized = true;
      console.log('[PaywallService] Successfully initialized Superwall');
    } catch (error) {
      console.error('[PaywallService] Failed to initialize:', error);
      throw error;
    }
  }

  async setUserId(userId: string): Promise<void> {
    try {
      // Only set for Superwall until RevenueCat is fixed
      await SuperwallService.setUserId(userId);
      console.log('[PaywallService] User ID set for Superwall:', userId);
    } catch (error) {
      console.error('[PaywallService] Failed to set user ID:', error);
      throw error;
    }
  }

  async presentPaywall(config: PaywallConfig): Promise<void> {
    try {
      console.log('[PaywallService] Presenting paywall for event:', config.event);
      
      // Map events to actual Superwall placements that exist
      let placement: string;
      switch (config.event) {
        case 'no_send':
          // Use existing working placement until no_send is configured
          placement = 'create_item_limit';
          break;
        case 'create_item_limit':
          placement = 'create_item_limit';
          break;
        case 'campaign_trigger':
          placement = 'campaign_trigger';
          break;
        default:
          placement = 'campaign_trigger'; // Default fallback
      }
      
      console.log('[PaywallService] Using placement:', placement);
      
      // Use registerPlacement instead of presentPaywall
      const { usePlacement } = await import('expo-superwall');
      
      // This is a workaround - we'll need to refactor to use the hook properly
      // For now, let's use SuperwallService but with placement approach
      await SuperwallService.presentPaywall(placement, config.params);
      
    } catch (error) {
      console.error('[PaywallService] Failed to present paywall:', error);
      
      // Fallback for development (Expo Go) - navigate to subscription page
      console.log('[PaywallService] Using fallback navigation to subscription page');
      const { router } = await import('expo-router');
      router.push('/subscription');
      
      // Don't throw error for fallback
      return;
    }
  }

  async isUserSubscribed(): Promise<boolean> {
    try {
      // Check database subscription status since RevenueCat is disabled
      const { supabase } = await import('@/lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.log('[PaywallService] No authenticated user found');
        return false;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('[PaywallService] Failed to fetch user profile:', error);
        return false;
      }

      const isSubscribed = profile?.subscription_tier && ['premium', 'grandfathered'].includes(profile.subscription_tier);
      console.log('[PaywallService] Database subscription check:', profile?.subscription_tier, 'isSubscribed:', isSubscribed);
      return isSubscribed;
    } catch (error) {
      console.error('[PaywallService] Failed to check subscription status:', error);
      return false;
    }
  }

  async restorePurchases(): Promise<void> {
    try {
      await RevenueCatService.restorePurchases();
      console.log('[PaywallService] Purchases restored successfully');
    } catch (error) {
      console.error('[PaywallService] Failed to restore purchases:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      // Only reset Superwall until RevenueCat is fixed
      await SuperwallService.reset();
      console.log('[PaywallService] Reset successful');
    } catch (error) {
      console.error('[PaywallService] Failed to reset:', error);
      throw error;
    }
  }

  // Predefined paywall events
  static readonly EVENTS = {
    SETTINGS_UPGRADE: 'campaign_trigger', // Use the placement that works
    ONBOARDING_COMPLETE: 'campaign_trigger', // Using same placement for now
    SEND_BLOCK: 'send_block', // Old send block campaign
    NO_SEND: 'no_send', // New no_send paywall for send items block campaign
    INVOICE_LIMIT_REACHED: 'invoice_limit_reached',
    PREMIUM_FEATURE_ACCESSED: 'premium_feature_accessed'
  } as const;
}

const paywallServiceInstance = PaywallService.getInstance();

// Export both the instance and the class for accessing static properties
export { PaywallService };
export default paywallServiceInstance;
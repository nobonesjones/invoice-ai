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
      
      // Temporarily disable RevenueCat until we get the public key
      // await RevenueCatService.initialize(userId);
      console.log('[PaywallService] RevenueCat temporarily disabled - need public key');
      
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
      await SuperwallService.presentPaywall(config.event, config.params);
    } catch (error) {
      console.error('[PaywallService] Failed to present paywall:', error);
      throw error;
    }
  }

  async isUserSubscribed(): Promise<boolean> {
    try {
      // Return false until RevenueCat is properly configured
      console.log('[PaywallService] Subscription check disabled - RevenueCat needs public key');
      return false;
    } catch (error) {
      console.error('[PaywallService] Failed to check subscription status:', error);
      return false;
    }
  }

  async restorePurchases(): Promise<void> {
    try {
      console.log('[PaywallService] Restore purchases disabled - RevenueCat needs public key');
      // await RevenueCatService.restorePurchases();
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
    SEND_BLOCK: 'send_block', // New send block campaign
    INVOICE_LIMIT_REACHED: 'invoice_limit_reached',
    PREMIUM_FEATURE_ACCESSED: 'premium_feature_accessed'
  } as const;
}

const paywallServiceInstance = PaywallService.getInstance();

// Export both the instance and the class for accessing static properties
export { PaywallService };
export default paywallServiceInstance;
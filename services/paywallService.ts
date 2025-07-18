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
      await RevenueCatService.initialize(userId);
      
      // Initialize Superwall
      await SuperwallService.initialize();
      
      // If user is provided, set it for both services
      if (userId) {
        await this.setUserId(userId);
      }

      this.isInitialized = true;
      console.log('[PaywallService] Successfully initialized both services');
    } catch (error) {
      console.error('[PaywallService] Failed to initialize:', error);
      throw error;
    }
  }

  async setUserId(userId: string): Promise<void> {
    try {
      await Promise.all([
        RevenueCatService.setUserId(userId),
        SuperwallService.setUserId(userId)
      ]);
      console.log('[PaywallService] User ID set for both services:', userId);
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
      return await RevenueCatService.isUserSubscribed();
    } catch (error) {
      console.error('[PaywallService] Failed to check subscription status:', error);
      return false;
    }
  }

  async restorePurchases(): Promise<void> {
    try {
      await RevenueCatService.restorePurchases();
      console.log('[PaywallService] Purchases restored');
    } catch (error) {
      console.error('[PaywallService] Failed to restore purchases:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      await Promise.all([
        RevenueCatService.logOut(),
        SuperwallService.reset()
      ]);
      console.log('[PaywallService] Reset successful');
    } catch (error) {
      console.error('[PaywallService] Failed to reset:', error);
      throw error;
    }
  }

  // Predefined paywall events
  static readonly EVENTS = {
    SETTINGS_UPGRADE: 'app_launch', // Using your configured trigger
    ONBOARDING_COMPLETE: 'onboarding_complete',
    INVOICE_LIMIT_REACHED: 'invoice_limit_reached',
    PREMIUM_FEATURE_ACCESSED: 'premium_feature_accessed'
  } as const;
}

const paywallServiceInstance = PaywallService.getInstance();

// Export both the instance and the class for accessing static properties
export { PaywallService };
export default paywallServiceInstance;
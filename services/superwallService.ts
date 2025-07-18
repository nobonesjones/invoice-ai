import * as Superwall from 'expo-superwall';
import { Platform } from 'react-native';

class SuperwallService {
  private static instance: SuperwallService;
  private isInitialized = false;

  static getInstance(): SuperwallService {
    if (!SuperwallService.instance) {
      SuperwallService.instance = new SuperwallService();
    }
    return SuperwallService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[Superwall] Already initialized');
      return;
    }

    try {
      // With expo-superwall, initialization is handled by SuperwallProvider
      this.isInitialized = true;
      console.log('[Superwall] Successfully initialized');
    } catch (error) {
      console.error('[Superwall] Failed to initialize:', error);
      throw error;
    }
  }

  async presentPaywall(event: string, params?: Record<string, any>): Promise<void> {
    try {
      console.log('[Superwall] Presenting paywall for event:', event, 'with params:', params);
      
      // Check what methods are available on the Superwall object
      console.log('[Superwall] Available methods:', Object.keys(Superwall));
      
      // Try different possible method names
      if (typeof Superwall.register === 'function') {
        await Superwall.register({
          placement: event,
          ...params
        });
      } else if (typeof Superwall.present === 'function') {
        await Superwall.present(event, params);
      } else if (typeof Superwall.presentPaywall === 'function') {
        await Superwall.presentPaywall(event, params);
      } else {
        console.log('[Superwall] No suitable method found, paywall methods available:', Object.keys(Superwall));
        throw new Error('No suitable paywall presentation method found');
      }
    } catch (error) {
      console.error('[Superwall] Failed to present paywall:', error);
      throw error;
    }
  }

  async setUserId(userId: string): Promise<void> {
    try {
      // Check if the method exists before calling it
      if (typeof Superwall.setUserId === 'function') {
        await Superwall.setUserId(userId);
        console.log('[Superwall] User identified:', userId);
      } else if (typeof Superwall.identify === 'function') {
        await Superwall.identify(userId);
        console.log('[Superwall] User identified via identify:', userId);
      } else {
        console.log('[Superwall] User identification method not available, skipping');
      }
    } catch (error) {
      console.error('[Superwall] Failed to identify user:', error);
      // Don't throw - let initialization continue
      console.log('[Superwall] Continuing without user identification');
    }
  }

  async setUserAttributes(attributes: Record<string, any>): Promise<void> {
    try {
      await Superwall.setUserAttributes(attributes);
      console.log('[Superwall] User attributes set:', attributes);
    } catch (error) {
      console.error('[Superwall] Failed to set user attributes:', error);
      throw error;
    }
  }

  async reset(): Promise<void> {
    try {
      await Superwall.reset();
      console.log('[Superwall] Reset successful');
    } catch (error) {
      console.error('[Superwall] Failed to reset:', error);
      throw error;
    }
  }

  async getPresentationResult(): Promise<any> {
    try {
      // This would typically be handled through delegates/callbacks
      // For now, we'll return a placeholder
      return { success: true };
    } catch (error) {
      console.error('[Superwall] Failed to get presentation result:', error);
      throw error;
    }
  }
}

export default SuperwallService.getInstance();
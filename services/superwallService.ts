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
      // Use the correct expo-superwall API
      await Superwall.register({
        placement: event,
        ...params
      });
    } catch (error) {
      console.error('[Superwall] Failed to present paywall:', error);
      throw error;
    }
  }

  async setUserId(userId: string): Promise<void> {
    try {
      await Superwall.identify({ userId });
      console.log('[Superwall] User identified:', userId);
    } catch (error) {
      console.error('[Superwall] Failed to identify user:', error);
      throw error;
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
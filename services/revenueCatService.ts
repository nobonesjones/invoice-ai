import Purchases, { PurchasesConfiguration, PurchasesOffering, PurchasesCustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

class RevenueCatService {
  private static instance: RevenueCatService;
  private isInitialized = false;

  static getInstance(): RevenueCatService {
    if (!RevenueCatService.instance) {
      RevenueCatService.instance = new RevenueCatService();
    }
    return RevenueCatService.instance;
  }

  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('[RevenueCat] Already initialized');
      return;
    }

    try {
      const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY;
      
      if (!apiKey) {
        throw new Error('RevenueCat API key not found in environment variables');
      }

      const configuration: PurchasesConfiguration = {
        apiKey,
        appUserID: userId || undefined,
        observerMode: false,
        userDefaultsSuiteName: undefined,
        useStoreKit2IfAvailable: Platform.OS === 'ios',
        shouldShowInAppMessagesAutomatically: true,
      };

      await Purchases.configure(configuration);
      this.isInitialized = true;
      console.log('[RevenueCat] Successfully initialized');
    } catch (error) {
      console.error('[RevenueCat] Failed to initialize:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<PurchasesOffering[]> {
    try {
      const offerings = await Purchases.getOfferings();
      return Object.values(offerings.all);
    } catch (error) {
      console.error('[RevenueCat] Failed to get offerings:', error);
      throw error;
    }
  }

  async getCurrentOffering(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('[RevenueCat] Failed to get current offering:', error);
      return null;
    }
  }

  async getCustomerInfo(): Promise<PurchasesCustomerInfo> {
    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('[RevenueCat] Failed to get customer info:', error);
      throw error;
    }
  }

  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<PurchasesCustomerInfo> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      console.log('[RevenueCat] Purchase successful:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Purchase failed:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<PurchasesCustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('[RevenueCat] Restore successful:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Restore failed:', error);
      throw error;
    }
  }

  async isUserSubscribed(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      return Object.keys(customerInfo.activeSubscriptions).length > 0;
    } catch (error) {
      console.error('[RevenueCat] Failed to check subscription status:', error);
      return false;
    }
  }

  async logIn(userId: string): Promise<PurchasesCustomerInfo> {
    try {
      const { customerInfo } = await Purchases.logIn(userId);
      console.log('[RevenueCat] User logged in successfully:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Failed to log in user:', error);
      throw error;
    }
  }

  async logOut(): Promise<PurchasesCustomerInfo> {
    try {
      const { customerInfo } = await Purchases.logOut();
      console.log('[RevenueCat] User logged out successfully');
      return customerInfo;
    } catch (error) {
      console.error('[RevenueCat] Failed to log out user:', error);
      throw error;
    }
  }

  async setUserId(userId: string): Promise<void> {
    try {
      await this.logIn(userId);
    } catch (error) {
      console.error('[RevenueCat] Failed to set user ID:', error);
      throw error;
    }
  }
}

export default RevenueCatService.getInstance();
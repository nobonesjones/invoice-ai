import { supabase } from '@/config/supabase';

export interface UserContext {
  userId: string;
  totalInvoices: number;
  totalEstimates: number;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  hasLogo: boolean;
  businessName: string;
  isFirstInvoice: boolean;
}

class UserContextService {
  private static instance: UserContextService;

  static getInstance(): UserContextService {
    if (!UserContextService.instance) {
      UserContextService.instance = new UserContextService();
    }
    return UserContextService.instance;
  }

  async getUserContext(userId: string): Promise<UserContext> {
    try {
      console.log('[UserContext] Getting context for user:', userId);

      // Get invoice and estimate counts
      const [invoiceResult, estimateResult, businessResult] = await Promise.all([
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        supabase
          .from('estimates')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId),
        
        supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', userId)
          .single()
      ]);

      const totalInvoices = invoiceResult.count || 0;
      const totalEstimates = estimateResult.count || 0;
      const businessSettings = businessResult.data;

      // Default settings if no business settings found
      const context: UserContext = {
        userId,
        totalInvoices,
        totalEstimates,
        currency: businessSettings?.currency || 'USD',
        currencySymbol: businessSettings?.currency_symbol || '$',
        taxRate: businessSettings?.tax_rate || 0,
        hasLogo: !!businessSettings?.logo_url,
        businessName: businessSettings?.business_name || '',
        isFirstInvoice: totalInvoices === 0
      };

      console.log('[UserContext] Context loaded:', {
        totalInvoices: context.totalInvoices,
        currency: context.currency,
        hasLogo: context.hasLogo,
        isFirstInvoice: context.isFirstInvoice
      });

      return context;
    } catch (error) {
      console.error('[UserContext] Error getting user context:', error);
      
      // Return default context on error
      return {
        userId,
        totalInvoices: 0,
        totalEstimates: 0,
        currency: 'USD',
        currencySymbol: '$',
        taxRate: 0,
        hasLogo: false,
        businessName: '',
        isFirstInvoice: true
      };
    }
  }

  async markFirstInvoiceCompleted(userId: string): Promise<void> {
    try {
      // This could be used to track onboarding progress
      console.log('[UserContext] First invoice completed for user:', userId);
      
      // Could store in user_metadata or separate onboarding table
      // For now, just log - the invoice count will naturally increment
    } catch (error) {
      console.error('[UserContext] Error marking first invoice completed:', error);
    }
  }

  getCurrencyExamples(currencySymbol: string): string[] {
    return [
      `Invoice John Smith for 1 days labour ${currencySymbol}500`,
      `Bill Sarah for 6 rooms painted ${currencySymbol}450 per room`,
      `Invoice ABC Company for 2 bathroom renovations ${currencySymbol}3000 each`,
      `Bill Tom for 8 hours consulting ${currencySymbol}150 per hour`
    ];
  }
}

export default UserContextService.getInstance();
export { UserContextService };
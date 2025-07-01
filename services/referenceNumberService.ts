import { supabase } from '@/config/supabase';

export interface ReferenceNumberOptions {
  prefix?: string;
  includeYear?: boolean;
  includeMonth?: boolean;
  numberLength?: number;
  customFormat?: string;
}

export class ReferenceNumberService {
  /**
   * Generate the next reference number for estimates and invoices using unified format
   * @param userId - The user ID
   * @param type - Either 'invoice' or 'estimate' 
   * @returns Promise with the next reference number
   */
  static async generateNextReference(userId: string, type: 'invoice' | 'estimate' = 'invoice'): Promise<string> {
    try {
      // Step 1: Get user's invoice reference format from settings
      const { data: businessSettings, error: settingsError } = await supabase
        .from('business_settings')
        .select('invoice_reference_format')
        .eq('user_id', userId)
        .single();

      if (settingsError) {
        console.warn('[ReferenceNumberService] No business settings found, using default format');
      }

      const referenceFormat = businessSettings?.invoice_reference_format || 'INV-001';
      
      // Step 2: Parse the format to understand structure
      const formatConfig = this.parseReferenceFormat(referenceFormat);
      
      // Step 3: Get the latest number from the combined sequence
      const latestNumber = await this.getLatestReferenceNumber(userId);
      
      // Step 4: Generate the next number using the format
      const nextNumber = latestNumber + 1;
      
      // Step 5: Apply the format structure
      return this.formatReferenceNumber(formatConfig, nextNumber, type);
      
    } catch (error) {
      console.error('[ReferenceNumberService] Error generating reference number:', error);
      // Fallback to timestamp-based number
      const timestamp = Date.now().toString().slice(-6);
      return type === 'estimate' ? `EST-${timestamp}` : `INV-${timestamp}`;
    }
  }

  /**
   * Parse the reference format string to extract structure
   * @param format - Format string like "INV-001", "INV-2024-001", etc.
   * @returns Parsed format configuration
   */
  private static parseReferenceFormat(format: string): ReferenceNumberOptions {
    // Extract prefix (everything before the first dash or number)
    const prefixMatch = format.match(/^([A-Za-z]+)/);
    const prefix = prefixMatch ? prefixMatch[1] : 'INV';
    
    // Check for year pattern
    const includeYear = format.includes('YYYY') || /\d{4}/.test(format);
    
    // Check for month pattern
    const includeMonth = format.includes('MM') || (includeYear && /\d{2}/.test(format.replace(/\d{4}/, '')));
    
    // Extract number length from the trailing number
    const numberMatch = format.match(/(\d+)$/);
    const numberLength = numberMatch ? numberMatch[1].length : 3;
    
    return {
      prefix,
      includeYear,
      includeMonth,
      numberLength,
      customFormat: format
    };
  }

  /**
   * Get the latest reference number from both invoices and estimates tables
   * This ensures unified numbering across both document types
   * @param userId - The user ID
   * @returns The highest number used so far
   */
  private static async getLatestReferenceNumber(userId: string): Promise<number> {
    try {
      // Get latest from invoices
      const { data: latestInvoice } = await supabase
        .from('invoices')
        .select('invoice_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // Get latest from estimates  
      const { data: latestEstimate } = await supabase
        .from('estimates')
        .select('estimate_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let maxNumber = 0;
      
      // Extract number from invoice
      if (latestInvoice?.invoice_number) {
        const invoiceMatch = latestInvoice.invoice_number.match(/(\d+)$/);
        if (invoiceMatch) {
          maxNumber = Math.max(maxNumber, parseInt(invoiceMatch[1]));
        }
      }
      
      // Extract number from estimate  
      if (latestEstimate?.estimate_number) {
        const estimateMatch = latestEstimate.estimate_number.match(/(\d+)$/);
        if (estimateMatch) {
          maxNumber = Math.max(maxNumber, parseInt(estimateMatch[1]));
        }
      }
      
      return maxNumber;
      
    } catch (error) {
      console.error('[ReferenceNumberService] Error getting latest reference number:', error);
      return 0;
    }
  }

  /**
   * Format the reference number according to the configuration
   * @param config - The format configuration
   * @param number - The sequential number
   * @param type - Document type for prefix adjustment
   * @returns Formatted reference number
   */
  private static formatReferenceNumber(
    config: ReferenceNumberOptions, 
    number: number, 
    type: 'invoice' | 'estimate'
  ): string {
    let reference = config.prefix || 'INV';
    
    // For estimates, keep the same prefix since they share the same numbering sequence
    // This ensures continuity when converting estimate to invoice
    
    if (config.includeYear) {
      reference += `-${new Date().getFullYear()}`;
    }
    
    if (config.includeMonth) {
      const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
      reference += `-${month}`;
    }
    
    const paddedNumber = number.toString().padStart(config.numberLength || 3, '0');
    reference += `-${paddedNumber}`;
    
    return reference;
  }

  /**
   * Check if a reference number already exists
   * @param userId - The user ID
   * @param referenceNumber - The reference number to check
   * @returns Promise<boolean> indicating if reference exists
   */
  static async referenceExists(userId: string, referenceNumber: string): Promise<boolean> {
    try {
      // Check in invoices
      const { data: invoice } = await supabase
        .from('invoices')
        .select('id')
        .eq('user_id', userId)
        .eq('invoice_number', referenceNumber)
        .single();

      if (invoice) return true;

      // Check in estimates
      const { data: estimate } = await supabase
        .from('estimates')
        .select('id')
        .eq('user_id', userId)
        .eq('estimate_number', referenceNumber)
        .single();

      return Boolean(estimate);
      
    } catch (error) {
      // If no record found, that's good - reference doesn't exist
      return false;
    }
  }

  /**
   * Convert an estimate reference to the same number for invoice conversion
   * Since we're using unified numbering, the estimate and invoice should have the same reference
   * @param estimateNumber - The estimate reference number
   * @returns The same reference number (for conversion continuity)
   */
  static convertEstimateToInvoiceReference(estimateNumber: string): string {
    // Since we're using unified numbering, the invoice keeps the same reference number
    // This ensures continuity and trackability for businesses
    return estimateNumber;
  }
} 
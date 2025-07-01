import { supabase } from '@/config/supabase';
import { ReferenceNumberService } from './referenceNumberService';

export interface EstimateConversionResult {
  success: boolean;
  invoiceId?: string;
  invoiceNumber?: string;
  message?: string;
  error?: string;
}

export class EstimateConversionService {
  /**
   * Convert an estimate to an invoice
   * @param estimateId - The ID of the estimate to convert
   * @param userId - The user ID for security checks
   * @returns Promise with conversion result
   */
  static async convertEstimateToInvoice(
    estimateId: string, 
    userId: string
  ): Promise<EstimateConversionResult> {
    try {
      // Step 1: Fetch the estimate with all related data
      const { data: estimate, error: estimateError } = await supabase
        .from('estimates')
        .select(`
          *,
          clients (*),
          estimate_line_items (*)
        `)
        .eq('id', estimateId)
        .eq('user_id', userId)
        .single();

      if (estimateError || !estimate) {
        return {
          success: false,
          error: 'Estimate not found or access denied',
          message: 'Could not find the estimate to convert.'
        };
      }

      // Step 2: Check if estimate can be converted
      if (estimate.status === 'converted') {
        return {
          success: false,
          error: 'Already converted',
          message: 'This estimate has already been converted to an invoice.'
        };
      }

      // Step 3: Use the same reference number for continuity
      const invoiceNumber = ReferenceNumberService.convertEstimateToInvoiceReference(estimate.estimate_number);

      // Step 4: Get user's business settings for defaults
      const { data: businessSettings } = await supabase
        .from('business_settings')
        .select('default_tax_rate, currency_code, default_invoice_design, default_accent_color')
        .eq('user_id', userId)
        .single();

      // Step 5: Calculate invoice dates (use estimate date as invoice date, calculate due date)
      const invoiceDate = estimate.estimate_date;
      const dueDateObj = new Date(invoiceDate);
      dueDateObj.setDate(dueDateObj.getDate() + 30); // Default 30 days
      const dueDate = dueDateObj.toISOString();

      // Step 6: Create the invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          user_id: userId,
          client_id: estimate.client_id,
          invoice_number: invoiceNumber,
          status: 'draft',
          invoice_date: invoiceDate,
          due_date: dueDate,
          due_date_option: 'custom_date',
          po_number: estimate.po_number,
          custom_headline: estimate.custom_headline,
          subtotal_amount: estimate.subtotal_amount,
          discount_type: estimate.discount_type,
          discount_value: estimate.discount_value,
          tax_percentage: estimate.tax_percentage,
          total_amount: estimate.total_amount,
          notes: estimate.notes,
          // Payment options from estimate
          stripe_active: estimate.stripe_active,
          paypal_active: estimate.paypal_active,
          bank_account_active: estimate.bank_account_active,
          // Design settings - preserve from estimate
          invoice_design: estimate.estimate_template || businessSettings?.default_invoice_design || 'modern',
          accent_color: estimate.accent_color || businessSettings?.default_accent_color || '#3b82f6',
          // Tax label
          invoice_tax_label: estimate.estimate_tax_label || 'Tax',
          // Amounts
          paid_amount: 0,
          payment_date: null,
          payment_notes: null,
        })
        .select('*')
        .single();

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        return {
          success: false,
          error: 'Failed to create invoice',
          message: 'An error occurred while creating the invoice. Please try again.'
        };
      }

      // Step 7: Create invoice line items from estimate line items
      if (estimate.estimate_line_items && estimate.estimate_line_items.length > 0) {
        const invoiceLineItems = estimate.estimate_line_items.map((item: any) => ({
          invoice_id: invoice.id,
          user_id: userId,
          item_name: item.item_name,
          item_description: item.item_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          line_item_discount_type: item.line_item_discount_type,
          line_item_discount_value: item.line_item_discount_value,
          item_image_url: item.item_image_url,
        }));

        const { error: lineItemsError } = await supabase
          .from('invoice_line_items')
          .insert(invoiceLineItems);

        if (lineItemsError) {
          console.error('Error creating invoice line items:', lineItemsError);
          // Clean up the invoice if line items failed
          await supabase.from('invoices').delete().eq('id', invoice.id);
          return {
            success: false,
            error: 'Failed to create invoice items',
            message: 'An error occurred while creating invoice items. Please try again.'
          };
        }
      }

      // Step 8: Update estimate status and link to invoice
      const { error: estimateUpdateError } = await supabase
        .from('estimates')
        .update({
          status: 'accepted', // First mark as accepted, then converted in next step
          is_accepted: true, // Set the boolean toggle field
          converted_to_invoice_id: invoice.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', estimateId)
        .eq('user_id', userId);

      if (estimateUpdateError) {
        console.error('Error updating estimate status:', estimateUpdateError);
        // Note: We don't rollback the invoice creation here as it's still valid
        // The estimate just won't show as converted, but the invoice exists
      }

      // Step 9: Update estimate to converted status after successful linking
      const { error: convertedUpdateError } = await supabase
        .from('estimates')
        .update({
          status: 'converted',
          updated_at: new Date().toISOString()
        })
        .eq('id', estimateId)
        .eq('user_id', userId);

      if (convertedUpdateError) {
        console.error('Error updating estimate to converted status:', convertedUpdateError);
        // The estimate will show as accepted but linked to invoice
      }

      return {
        success: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        message: `Successfully converted estimate ${estimate.estimate_number} to invoice ${invoice.invoice_number}`
      };

    } catch (error) {
      console.error('Error converting estimate to invoice:', error);
      return {
        success: false,
        error: 'Conversion failed',
        message: 'An unexpected error occurred during conversion. Please try again.'
      };
    }
  }

  /**
   * Check if an estimate can be converted to an invoice
   */
  static canConvertEstimate(estimateStatus: string): boolean {
    // Allow conversion for accepted estimates, but also draft/sent for flexibility
    return ['draft', 'sent', 'accepted'].includes(estimateStatus);
  }

  /**
   * Get the linked invoice for a converted estimate
   */
  static async getLinkedInvoice(estimateId: string, userId: string) {
    const { data: estimate, error } = await supabase
      .from('estimates')
      .select(`
        converted_to_invoice_id,
        invoices:converted_to_invoice_id (
          id,
          invoice_number,
          status,
          total_amount
        )
      `)
      .eq('id', estimateId)
      .eq('user_id', userId)
      .single();

    if (error || !estimate?.converted_to_invoice_id) {
      return null;
    }

    return estimate.invoices;
  }
} 
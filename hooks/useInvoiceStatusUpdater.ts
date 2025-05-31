import { useEffect } from 'react';
import { useSupabase } from '@/context/supabase-provider';
import { INVOICE_STATUSES, shouldAutoMarkOverdue } from '@/constants/invoice-status';

export const useInvoiceStatusUpdater = () => {
  const { supabase, user } = useSupabase();

  const updateOverdueInvoices = async () => {
    if (!supabase || !user) return;

    try {
      console.log('[useInvoiceStatusUpdater] Checking for overdue invoices...');
      
      // Find all 'sent' invoices that are past due
      const { data: sentInvoices, error: fetchError } = await supabase
        .from('invoices')
        .select('id, due_date, status')
        .eq('user_id', user.id)
        .eq('status', INVOICE_STATUSES.SENT)
        .not('due_date', 'is', null);

      if (fetchError) {
        console.error('[useInvoiceStatusUpdater] Error fetching sent invoices:', fetchError);
        return;
      }

      if (!sentInvoices || sentInvoices.length === 0) {
        console.log('[useInvoiceStatusUpdater] No sent invoices found');
        return;
      }

      // Filter invoices that should be marked overdue
      const invoicesToUpdate = sentInvoices.filter(invoice => 
        shouldAutoMarkOverdue(invoice.status as any, invoice.due_date)
      );

      if (invoicesToUpdate.length === 0) {
        console.log('[useInvoiceStatusUpdater] No invoices to mark as overdue');
        return;
      }

      console.log(`[useInvoiceStatusUpdater] Marking ${invoicesToUpdate.length} invoices as overdue`);

      // Update invoices to overdue status
      const updatePromises = invoicesToUpdate.map(invoice =>
        supabase
          .from('invoices')
          .update({ status: INVOICE_STATUSES.OVERDUE })
          .eq('id', invoice.id)
      );

      const results = await Promise.allSettled(updatePromises);
      
      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;
      
      console.log(`[useInvoiceStatusUpdater] Status update complete: ${successful} successful, ${failed} failed`);
      
      if (failed > 0) {
        console.warn('[useInvoiceStatusUpdater] Some status updates failed');
      }

    } catch (error: any) {
      console.error('[useInvoiceStatusUpdater] Unexpected error:', error);
    }
  };

  // Run status updates on mount and set up periodic checks
  useEffect(() => {
    updateOverdueInvoices();
    
    // Check for overdue invoices every 5 minutes
    const interval = setInterval(updateOverdueInvoices, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user?.id, supabase]);

  return { updateOverdueInvoices };
}; 
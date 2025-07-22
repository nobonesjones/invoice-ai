import { useSupabase } from '@/context/supabase-provider';

export type InvoiceActivityType = 
  | 'created'
  | 'edited' 
  | 'sent'
  | 'viewed'
  | 'payment_added'
  | 'payment_removed'
  | 'status_changed'
  | 'note_added'
  | 'downloaded'   // When invoice PDF is downloaded via shared link
  | 'email_sent'
  | 'link_shared'
  | 'opened'       // When invoice is opened/viewed via shared link
  | 'printed'      // When invoice is printed via shared link
  | 'link_generated'; // When a shareable link is created

interface LogActivityParams {
  invoiceId: string;
  activityType: InvoiceActivityType;
  description: string;
  data?: Record<string, any>;
}

interface InvoiceActivity {
  id: string;
  invoice_id: string;
  user_id: string;
  activity_type: InvoiceActivityType;
  activity_description: string;
  activity_data: Record<string, any>;
  created_at: string;
  ip_address?: string;
  user_agent?: string;
}

export const useInvoiceActivityLogger = () => {
  const { supabase, user } = useSupabase();

  const logActivity = async ({ invoiceId, activityType, description, data = {} }: LogActivityParams): Promise<boolean> => {
    if (!supabase || !user) {
      console.error('[logActivity] No supabase client or user available');
      return false;
    }

    try {
      console.log(`[logActivity] Logging activity: ${activityType} for invoice ${invoiceId}`);
      
      const { error } = await supabase
        .from('invoice_activities')
        .insert({
          invoice_id: invoiceId,
          user_id: user.id,
          activity_type: activityType,
          activity_description: description,
          activity_data: data
        });

      if (error) {
        console.error('[logActivity] Error logging activity:', error);
        return false;
      }

      console.log(`[logActivity] Successfully logged: ${activityType}`);
      return true;
    } catch (error: any) {
      console.error('[logActivity] Exception:', error.message);
      return false;
    }
  };

  const getInvoiceHistory = async (invoiceId: string): Promise<InvoiceActivity[]> => {
    if (!supabase || !user) {
      console.error('[getInvoiceHistory] No supabase client or user available');
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('invoice_activities')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[getInvoiceHistory] Error fetching history:', error);
        return [];
      }

      return data || [];
    } catch (error: any) {
      console.error('[getInvoiceHistory] Exception:', error.message);
      return [];
    }
  };

  // Helper functions for common activities
  const logInvoiceCreated = (invoiceId: string, invoiceNumber?: string) => {
    return logActivity({
      invoiceId,
      activityType: 'created',
      description: `Invoice ${invoiceNumber || invoiceId} was created`,
      data: { invoice_number: invoiceNumber }
    });
  };

  const logInvoiceEdited = (invoiceId: string, invoiceNumber?: string, changes?: string[]) => {
    return logActivity({
      invoiceId,
      activityType: 'edited',
      description: `Invoice ${invoiceNumber || invoiceId} was edited`,
      data: { invoice_number: invoiceNumber, changes }
    });
  };

  const logInvoiceSent = (invoiceId: string, invoiceNumber?: string, method?: string) => {
    return logActivity({
      invoiceId,
      activityType: 'sent',
      description: `Invoice ${invoiceNumber || invoiceId} was sent${method ? ` via ${method}` : ''}`,
      data: { invoice_number: invoiceNumber, send_method: method }
    });
  };

  const logPaymentAdded = (invoiceId: string, invoiceNumber?: string, amount?: number, method?: string) => {
    return logActivity({
      invoiceId,
      activityType: 'payment_added',
      description: `Payment of ${amount ? `$${amount.toFixed(2)}` : 'unknown amount'} recorded${method ? ` via ${method}` : ''}`,
      data: { 
        invoice_number: invoiceNumber, 
        payment_amount: amount, 
        payment_method: method 
      }
    });
  };

  const logStatusChanged = (invoiceId: string, invoiceNumber?: string, fromStatus?: string, toStatus?: string) => {
    return logActivity({
      invoiceId,
      activityType: 'status_changed',
      description: `Invoice status changed${fromStatus && toStatus ? ` from ${fromStatus} to ${toStatus}` : ''}`,
      data: { 
        invoice_number: invoiceNumber, 
        from_status: fromStatus,
        to_status: toStatus
      }
    });
  };

  return {
    logActivity,
    getInvoiceHistory,
    // Helper functions
    logInvoiceCreated,
    logInvoiceEdited,
    logInvoiceSent,
    logPaymentAdded,
    logStatusChanged
  };
}; 
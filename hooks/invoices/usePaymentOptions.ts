import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase'; // Use same client as provider
import type { Database } from '../../../../supabase/types/database.types'; // Corrected path

// Define the structure of a single payment option record based on your table
export type PaymentOptionData = Database['public']['Tables']['payment_options']['Row'];

interface UsePaymentOptionsReturn {
  paymentOptions: PaymentOptionData | null;
  loading: boolean;
  error: any;
  refetchPaymentOptions: () => void;
}

export const usePaymentOptions = (): UsePaymentOptionsReturn => {
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  console.log('[usePaymentOptions] Hook called, current state:', { 
    hasPaymentOptions: !!paymentOptions, 
    loading, 
    hasError: !!error 
  });

  const fetchPaymentOptions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get user directly from Supabase instead of context to avoid provider cascade issues
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      console.log('[usePaymentOptions] Direct supabase auth call - User:', currentUser?.id, 'Error:', userError);
      
      if (userError || !currentUser) {
        console.log('[usePaymentOptions] No authenticated user found');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle(); // Use maybeSingle for new users without payment options

      if (fetchError) {
        throw fetchError;
      }

      console.log('[usePaymentOptions] Successfully fetched payment options:', data);
      
      // If no payment options exist, create default record
      if (!data) {
        console.log('[usePaymentOptions] No payment options found, creating default record');
        const { data: newRecord, error: createError } = await supabase
          .from('payment_options')
          .insert({
            user_id: currentUser.id,
            stripe_enabled: false,
            paypal_enabled: false,
            bank_transfer_enabled: false
          })
          .select()
          .single();
          
        if (createError) {
          console.error('[usePaymentOptions] Error creating default record:', createError);
          setPaymentOptions(null);
        } else {
          console.log('[usePaymentOptions] Created default payment options:', newRecord);
          setPaymentOptions(newRecord as PaymentOptionData);
        }
      } else {
        setPaymentOptions(data as PaymentOptionData);
      }
    } catch (e) {
      setError(e);
      console.error('Error fetching payment options:', e);
      setPaymentOptions(null); // Clear data on error
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed since we get user directly from supabase

  useEffect(() => {
    console.log('[usePaymentOptions] useEffect triggered, calling fetchPaymentOptions');
    fetchPaymentOptions();
  }, []); // Remove fetchPaymentOptions dependency to avoid infinite loop

  return { paymentOptions, loading, error, refetchPaymentOptions: fetchPaymentOptions };
};

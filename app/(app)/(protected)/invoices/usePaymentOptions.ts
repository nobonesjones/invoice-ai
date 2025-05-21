import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase'; // Assuming supabase client is here
import { useSupabase } from '@/context/supabase-provider'; // To get the user
import type { Database } from '../../../../types/database.types'; // Corrected path

// Define the structure of a single payment option record based on your table
export type PaymentOptionData = Database['public']['Tables']['payment_options']['Row'];

interface UsePaymentOptionsReturn {
  paymentOptions: PaymentOptionData | null;
  loading: boolean;
  error: any;
  refetchPaymentOptions: () => void;
}

export const usePaymentOptions = (): UsePaymentOptionsReturn => {
  const { user } = useSupabase();
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchPaymentOptions = useCallback(async () => {
    if (!user) {
      setLoading(false);
      // setError(new Error('User not authenticated')); // Optional: set error if user must be present
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', user.id)
        .single(); // Assuming one row per user

      if (fetchError) {
        throw fetchError;
      }

      setPaymentOptions(data as PaymentOptionData | null);
    } catch (e) {
      setError(e);
      console.error('Error fetching payment options:', e);
      setPaymentOptions(null); // Clear data on error
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPaymentOptions();
  }, [fetchPaymentOptions]);

  return { paymentOptions, loading, error, refetchPaymentOptions: fetchPaymentOptions };
};

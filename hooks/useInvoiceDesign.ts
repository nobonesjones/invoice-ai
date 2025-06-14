import { useState, useEffect, useCallback } from 'react';
import { 
  InvoiceDesign, 
  getDefaultDesign, 
  getDesignById, 
  getAllDesigns,
  DEFAULT_DESIGN_ID 
} from '@/constants/invoiceDesigns';
import { useSupabase } from '@/context/supabase-provider';

interface UseInvoiceDesignReturn {
  currentDesign: InvoiceDesign;
  availableDesigns: InvoiceDesign[];
  isLoading: boolean;
  error: string | null;
  selectDesign: (designId: string) => void;
  saveAsDefault: (designId: string) => Promise<boolean>;
  resetToDefault: () => void;
}

export const useInvoiceDesign = (initialDesignId?: string): UseInvoiceDesignReturn => {
  const { supabase, user } = useSupabase();
  const [currentDesign, setCurrentDesign] = useState<InvoiceDesign>(getDefaultDesign());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get all available designs
  const availableDesigns = getAllDesigns();

  // Load user's default design preference from database
  const loadUserDesignPreference = useCallback(async () => {
    if (!supabase || !user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data: businessSettings, error: fetchError } = await supabase
        .from('business_settings')
        .select('default_invoice_design')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching design preference:', fetchError);
        setError('Failed to load design preference');
        return;
      }

      // Use initial design ID if provided, otherwise use saved preference or default
      const designId = initialDesignId || 
                      businessSettings?.default_invoice_design || 
                      DEFAULT_DESIGN_ID;

      const design = getDesignById(designId);
      if (design) {
        setCurrentDesign(design);
      } else {
        console.warn(`Design '${designId}' not found, using default`);
        setCurrentDesign(getDefaultDesign());
      }

    } catch (err: any) {
      console.error('Exception loading design preference:', err);
      setError('Failed to load design preference');
      setCurrentDesign(getDefaultDesign());
    } finally {
      setIsLoading(false);
    }
  }, [supabase, user, initialDesignId]);

  // Load design preference on mount
  useEffect(() => {
    loadUserDesignPreference();
  }, [loadUserDesignPreference]);

  // Select a design (temporary, not saved to database)
  const selectDesign = useCallback((designId: string) => {
    const design = getDesignById(designId);
    if (design) {
      setCurrentDesign(design);
      setError(null);
    } else {
      setError(`Design '${designId}' not found`);
    }
  }, []);

  // Save design as user's default preference
  const saveAsDefault = useCallback(async (designId: string): Promise<boolean> => {
    if (!supabase || !user) {
      setError('Unable to save design preference');
      return false;
    }

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('business_settings')
        .upsert({
          user_id: user.id,
          default_invoice_design: designId,
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('Error saving design preference:', updateError);
        setError('Failed to save design preference');
        return false;
      }

      console.log(`Design preference saved: ${designId}`);
      return true;

    } catch (err: any) {
      console.error('Exception saving design preference:', err);
      setError('Failed to save design preference');
      return false;
    }
  }, [supabase, user]);

  // Reset to default design
  const resetToDefault = useCallback(() => {
    setCurrentDesign(getDefaultDesign());
    setError(null);
  }, []);

  return {
    currentDesign,
    availableDesigns,
    isLoading,
    error,
    selectDesign,
    saveAsDefault,
    resetToDefault,
  };
}; 
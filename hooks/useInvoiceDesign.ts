import { useState, useEffect, useCallback } from 'react';
import { 
  InvoiceDesign, 
  getDefaultDesign, 
  getDesignById, 
  getAllDesigns,
  DEFAULT_DESIGN_ID,
  INVOICE_DESIGNS
} from '@/constants/invoiceDesigns';
import { useSupabase } from '@/context/supabase-provider';

interface UseInvoiceDesignReturn {
  currentDesign: InvoiceDesign;
  availableDesigns: InvoiceDesign[];
  currentAccentColor: string;
  isLoading: boolean;
  error: string | null;
  selectDesign: (designId: string) => void;
  selectAccentColor: (color: string) => void;
  saveAsDefault: (designId: string, accentColor?: string) => Promise<boolean>;
  resetToDefault: () => void;
}

export const useInvoiceDesign = (initialDesignId?: string, initialAccentColor?: string): UseInvoiceDesignReturn => {
  const { supabase, user } = useSupabase();
  const [currentDesign, setCurrentDesign] = useState<InvoiceDesign>(getDefaultDesign());
  const [currentAccentColor, setCurrentAccentColor] = useState<string>(initialAccentColor || '#1E40AF');
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
        .select('default_invoice_design, default_accent_color')
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

      // Use initial accent color if provided, otherwise use saved preference or default
      const accentColor = initialAccentColor || 
                         businessSettings?.default_accent_color || 
                         '#1E40AF';

      const design = getDesignById(designId);
      if (design) {
        setCurrentDesign(design);
      } else {
        console.warn(`Design '${designId}' not found, using default`);
        setCurrentDesign(getDefaultDesign());
      }

      setCurrentAccentColor(accentColor);
      // console.log('[useInvoiceDesign] Loaded design:', designId, 'color:', accentColor);

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

  // Select an accent color (temporary, not saved to database)
  const selectAccentColor = useCallback((color: string) => {
    setCurrentAccentColor(color);
    setError(null);
    // console.log('[useInvoiceDesign] Selected accent color:', color);
  }, []);

  // Save design as user's default preference
  const saveAsDefault = useCallback(async (designId: string, accentColor?: string): Promise<boolean> => {
    if (!supabase || !user) {
      setError('Unable to save design preference');
      return false;
    }

    try {
      setError(null);

      const updateData: any = {
        user_id: user.id,
        default_invoice_design: designId,
      };

      // Include accent color if provided, otherwise use current color
      if (accentColor || currentAccentColor) {
        updateData.default_accent_color = accentColor || currentAccentColor;
      }

      const { error: updateError } = await supabase
        .from('business_settings')
        .upsert(updateData, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('Error saving design preference:', updateError);
        setError('Failed to save design preference');
        return false;
      }

      console.log(`Design preference saved: ${designId}, color: ${accentColor || currentAccentColor}`);
      return true;

    } catch (err: any) {
      console.error('Exception saving design preference:', err);
      setError('Failed to save design preference');
      return false;
    }
  }, [supabase, user, currentAccentColor]);

  // Reset to default design
  const resetToDefault = useCallback(() => {
    setCurrentDesign(getDefaultDesign());
    setError(null);
  }, []);

  return {
    currentDesign,
    availableDesigns,
    currentAccentColor,
    isLoading,
    error,
    selectDesign,
    selectAccentColor,
    saveAsDefault,
    resetToDefault,
  };
};

// New interface for individual invoice design management
interface UseInvoiceDesignForInvoiceReturn {
  currentDesign: InvoiceDesign;
  availableDesigns: InvoiceDesign[];
  currentAccentColor: string;
  isLoading: boolean;
  error: string | null;
  selectDesign: (designId: string) => void;
  selectAccentColor: (color: string) => void;
  saveToInvoice: (invoiceId: string, designId: string, accentColor: string) => Promise<boolean>;
  updateDefaultForNewInvoices: (designId: string, accentColor: string) => Promise<boolean>;
}

// Hook for managing design of individual invoices
export const useInvoiceDesignForInvoice = (
  invoiceId?: string,
  initialDesignId?: string, 
  initialAccentColor?: string
): UseInvoiceDesignForInvoiceReturn => {
  const { supabase, user } = useSupabase();
  const [currentDesign, setCurrentDesign] = useState<InvoiceDesign>(getDefaultDesign());
  const [currentAccentColor, setCurrentAccentColor] = useState<string>(initialAccentColor || '#1E40AF');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load design and color from invoice or defaults
  useEffect(() => {
    const loadInvoiceDesign = async () => {
      if (!supabase || !user) {
        setIsLoading(false);
        return;
      }

      try {
        setError(null);

        // If we have an invoice ID, load its specific design
        if (invoiceId) {
          const { data: invoiceData, error: invoiceError } = await supabase
            .from('invoices')
            .select('invoice_design, accent_color')
            .eq('id', invoiceId)
            .single();

          if (invoiceError) {
            console.error('Error loading invoice design:', invoiceError);
            // Fall back to business defaults
          } else if (invoiceData) {
            const designId = invoiceData.invoice_design || DEFAULT_DESIGN_ID;
            const accentColor = invoiceData.accent_color || '#1E40AF';
            
            const design = getDesignById(designId);
            if (design) {
              setCurrentDesign(design);
            }
            setCurrentAccentColor(accentColor);
            // console.log(`[useInvoiceDesignForInvoice] Loaded invoice design: ${designId}, color: ${accentColor}`);
            setIsLoading(false);
            return;
          }
        }

        // Fall back to business defaults for new invoices
        const { data: businessSettings, error: fetchError } = await supabase
          .from('business_settings')
          .select('default_invoice_design, default_accent_color')
          .eq('user_id', user.id)
          .single();

        if (fetchError) {
          console.error('Error loading business settings:', fetchError);
        }

        // Use initial values, business settings, or defaults
        const designId = initialDesignId || 
                        businessSettings?.default_invoice_design || 
                        DEFAULT_DESIGN_ID;

        const accentColor = initialAccentColor || 
                           businessSettings?.default_accent_color || 
                           '#1E40AF';

        const design = getDesignById(designId);
        if (design) {
          setCurrentDesign(design);
        } else {
          console.warn(`Design '${designId}' not found, using default`);
          setCurrentDesign(getDefaultDesign());
        }

        setCurrentAccentColor(accentColor);
        // console.log(`[useInvoiceDesignForInvoice] Loaded default design: ${designId}, color: ${accentColor}`);

      } catch (err: any) {
        console.error('Exception loading invoice design:', err);
        setError('Failed to load design preferences');
      } finally {
        setIsLoading(false);
      }
    };

    loadInvoiceDesign();
  }, [supabase, user, invoiceId, initialDesignId, initialAccentColor]);

  // Select a design (temporary, not saved)
  const selectDesign = useCallback((designId: string) => {
    const design = getDesignById(designId);
    if (design) {
      setCurrentDesign(design);
      setError(null);
    } else {
      setError(`Design '${designId}' not found`);
    }
  }, []);

  // Select an accent color (temporary, not saved)
  const selectAccentColor = useCallback((color: string) => {
    setCurrentAccentColor(color);
    setError(null);
    // console.log('[useInvoiceDesignForInvoice] Selected accent color:', color);
  }, []);

  // Save design and color to specific invoice
  const saveToInvoice = useCallback(async (invoiceId: string, designId: string, accentColor: string): Promise<boolean> => {
    if (!supabase || !user) {
      setError('Unable to save invoice design');
      return false;
    }

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          invoice_design: designId,
          accent_color: accentColor,
        })
        .eq('id', invoiceId);

      if (updateError) {
        console.error('Error saving invoice design:', updateError);
        setError('Failed to save invoice design');
        return false;
      }

      // console.log(`[useInvoiceDesignForInvoice] Saved invoice design: ${designId}, color: ${accentColor}`);
      return true;

    } catch (err: any) {
      console.error('Exception saving invoice design:', err);
      setError('Failed to save invoice design');
      return false;
    }
  }, [supabase, user]);

  // Update business settings to use as default for new invoices
  const updateDefaultForNewInvoices = useCallback(async (designId: string, accentColor: string): Promise<boolean> => {
    if (!supabase || !user) {
      setError('Unable to update default design');
      return false;
    }

    try {
      setError(null);

      const { error: updateError } = await supabase
        .from('business_settings')
        .upsert({
          user_id: user.id,
          default_invoice_design: designId,
          default_accent_color: accentColor,
        }, {
          onConflict: 'user_id'
        });

      if (updateError) {
        console.error('Error updating default design:', updateError);
        setError('Failed to update default design');
        return false;
      }

      // console.log(`[useInvoiceDesignForInvoice] Updated default design: ${designId}, color: ${accentColor}`);
      return true;

    } catch (err: any) {
      console.error('Exception updating default design:', err);
      setError('Failed to update default design');
      return false;
    }
  }, [supabase, user]);

  return {
    currentDesign,
    availableDesigns: INVOICE_DESIGNS, // Add the missing availableDesigns property
    currentAccentColor,
    isLoading,
    error,
    selectDesign,
    selectAccentColor,
    saveToInvoice,
    updateDefaultForNewInvoices,
  };
}; 
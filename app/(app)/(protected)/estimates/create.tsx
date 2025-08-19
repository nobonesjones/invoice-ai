/**
 * CreateEstimateScreen - Unified Estimate Creation and Editing
 * 
 * This screen handles both creating new estimates and editing existing ones
 * based on the presence of an 'id' parameter in the route.
 * 
 * USAGE:
 * - Create mode: /estimates/create
 * - Edit mode: /estimates/create?id=estimate_id
 * 
 * FEATURES:
 * - Automatic mode detection based on URL parameters
 * - Complete form population from database in edit mode
 * - Smart save logic (INSERT vs UPDATE operations)
 * - Line items management (create/update/delete)
 * - Loading and error states for edit mode
 * - Consistent UX between create and edit flows
 * - Auto-save as draft for seamless preview functionality
 * - Valid until date management (estimate-specific)
 * 
 * ESTIMATE-SPECIFIC ADAPTATIONS:
 * - Uses estimate_number instead of invoice_number
 * - Uses valid_until_date instead of due_date
 * - Estimate status management (draft, sent, accepted, etc.)
 * - Acceptance terms field for client approval
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Switch,
  Image,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { ChevronRight, PlusCircle, X as XIcon, Edit3, Calendar, Trash2, Percent, CreditCard, Banknote, Paperclip, Landmark, ChevronLeft, Palette } from 'lucide-react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { addDays } from 'date-fns';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { InvoicePreviewModal, InvoicePreviewModalRef } from '@/components/InvoicePreviewModal';
import { Controller, useForm } from 'react-hook-form';
import { useSupabase } from '@/context/supabase-provider';
import { SwipeListView } from 'react-native-swipe-list-view';
import { ESTIMATE_STATUSES } from '@/constants/estimate-status';
import { UsageService } from '@/services/usageService';
import { usePaymentOptions } from '@/hooks/invoices/usePaymentOptions';
import { useEstimateActivityLogger } from '@/hooks/estimates/useEstimateActivityLogger';
import { ReferenceNumberService } from '@/services/referenceNumberService';

// Import estimate-specific components and modals
import NewClientSelectionSheet, { Client as ClientType } from './NewClientSelectionSheet';
import AddItemSheet, { AddItemSheetRef } from './AddItemSheet';
import { NewItemData } from './AddNewItemFormSheet';
import SelectDiscountTypeSheet, { SelectDiscountTypeSheetRef, DiscountData } from './SelectDiscountTypeSheet';
import EditInvoiceTaxSheet, { EditInvoiceTaxSheetRef, TaxData as EstimateTaxData } from './EditInvoiceTaxSheet';
import EditEstimateDetailsSheet, { EditEstimateDetailsSheetRef, EstimateDetailsData } from './EditEstimateDetailsSheet';
import { DEFAULT_DESIGN_ID } from '@/constants/invoiceDesigns';

// Currency symbol mapping function
const getCurrencySymbol = (code: string) => {
  const mapping: Record<string, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    AUD: 'A$',
    CAD: 'C$',
    JPY: '¥',
    INR: '₹',
  };
  if (!code) return '$';
  const normalized = code.split(' ')[0];
  return mapping[normalized] || '$';
};

// Define data structures for estimate form
interface EstimateFormData {
  estimate_number: string;
  client_id: string;
  estimate_date: Date;
  valid_until_date: Date | null;
  valid_until_option: string | null;
  items: EstimateLineItem[];
  po_number?: string;
  custom_headline?: string;
  taxPercentage?: number | null;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  subTotalAmount?: number;
  totalAmount?: number;
  notes?: string;
  acceptance_terms?: string; // Estimate-specific field
  paypal_active: boolean;
  stripe_active: boolean;
  bank_account_active: boolean;
}

interface EstimateLineItem {
  id: string;
  user_saved_item_id?: string | null;
  item_name: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  line_item_discount_type?: 'percentage' | 'fixed' | null;
  line_item_discount_value?: number | null;
  item_image_url?: string | null;
}

// Define a type for the theme color palette structure
type ThemeColorPalette = typeof colors.light;

// Define FormSection Component
const FormSection = ({ title, children, themeColors, noPadding }: { 
  title?: string, 
  children: React.ReactNode, 
  themeColors: ThemeColorPalette, 
  noPadding?: boolean 
}) => {
  const sectionContentStyle = {
    backgroundColor: themeColors.card,
    borderRadius: 10,
    padding: noPadding ? 0 : 16,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.00,
    elevation: 1,
  } as const;
  
  return (
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      {title && (
        <Text 
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: themeColors.mutedForeground, 
            marginBottom: 8, 
            marginLeft: Platform.OS === 'ios' ? 16 : 0,
            textTransform: 'uppercase'
          }}
        >
          {title}
        </Text>
      )}
      <View style={sectionContentStyle}>
        {children}
      </View>
    </View>
  );
};

// Define ActionRow Component  
const ActionRow = ({ 
  label, 
  onPress, 
  icon: IconComponent, 
  value, 
  themeColors, 
  showChevron = true,
  showSwitch = false,
  switchValue,
  onSwitchChange
}: { 
  label: string | React.ReactNode, 
  onPress?: () => void, 
  icon?: React.ElementType, 
  value?: string, 
  themeColors: ThemeColorPalette,
  showChevron?: boolean,
  showSwitch?: boolean,
  switchValue?: boolean,
  onSwitchChange?: (val: boolean) => void
}) => {
  return (
    <TouchableOpacity 
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: themeColors.border,
      }}
      onPress={onPress}
      disabled={!onPress}
    >
      {IconComponent && (
        <IconComponent 
          size={20} 
          color={themeColors.primary} 
          style={{ marginRight: 12 }} 
        />
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontSize: 16,
          color: themeColors.foreground,
          fontWeight: '500'
        }}>
          {label}
        </Text>
        {value && (
          <Text style={{ 
            fontSize: 14,
            color: themeColors.mutedForeground,
            marginTop: 2
          }}>
            {value}
          </Text>
        )}
      </View>
      {showSwitch && (
        <Switch
          value={switchValue || false}
          onValueChange={onSwitchChange}
          trackColor={{ false: themeColors.border, true: themeColors.primary }}
          thumbColor={switchValue ? '#fff' : '#f4f3f4'}
        />
      )}
      {showChevron && !showSwitch && (
        <ChevronRight size={20} color={themeColors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
};

const formatFriendlyDate = (date: Date | null | undefined): string => {
  if (!date) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  
  return date.toLocaleDateString();
};

const formatValidUntilDisplay = (validUntilDate: Date | null, validUntilOption: string | null): string => {
  if (validUntilDate) {
    return `Valid until ${formatFriendlyDate(validUntilDate)}`;
  }
  
  // Default display based on option
  switch (validUntilOption) {
    case 'on_receipt':
      return 'Valid on receipt';
    case 'net_7':
      return 'Valid for 7 days';
    case 'net_14':
      return 'Valid for 14 days';
    case 'net_30':
      return 'Valid for 30 days';
    case 'net_60':
      return 'Valid for 60 days';
    case 'net_90':
      return 'Valid for 90 days';
    default:
      return 'Valid for 30 days';
  }
};

const calculateGrandTotal = (
  subtotal: number,
  discountType: 'percentage' | 'fixed' | null | undefined,
  discountValue: number | null | undefined,
  taxPercentage: number | null | undefined
): number => {
  let total = subtotal;
  
  // Apply discount
  if (discountType && discountValue) {
    if (discountType === 'percentage') {
      total = total * (1 - discountValue / 100);
    } else if (discountType === 'fixed') {
      total = Math.max(0, total - discountValue);
    }
  }
  
  // Apply tax
  if (taxPercentage) {
    total = total * (1 + taxPercentage / 100);
  }
  
  return total;
};

export default function CreateEstimateScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const router = useRouter();
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { supabase, user } = useSupabase();
  
  // Add activity logger for estimate tracking
  const { logEstimateCreated, logEstimateEdited } = useEstimateActivityLogger();
  
  const params = useLocalSearchParams<{ 
    id?: string;
    selectedClientId?: string; 
    selectedClientName?: string;
  }>();
  
  const editEstimateId = params?.id || null;
  const isEditMode = Boolean(editEstimateId);
  
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string>('GBP');
  const [currentEstimateLineItems, setCurrentEstimateLineItems] = useState<EstimateLineItem[]>([]);
  const [isSavingEstimate, setIsSavingEstimate] = useState(false);
  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [estimateTerminology, setEstimateTerminology] = useState<'estimate' | 'quote'>('estimate');
  const [currentDesign, setCurrentDesign] = useState<string>(DEFAULT_DESIGN_ID); // Use correct default ('clean') instead of hardcoded 'classic'
  const [currentAccentColor, setCurrentAccentColor] = useState<string>('#14B8A6');
  const [isLoadingEstimateNumber, setIsLoadingEstimateNumber] = useState(true);
  
  // Preview modal state
  const [previewData, setPreviewData] = useState<{
    estimateData: any;
    businessSettings: any;
    clientData: any;
  } | null>(null);
  
  // Business settings cache for preview
  const [businessSettingsCache, setBusinessSettingsCache] = useState<any>(null);
  
  // Sheet refs
  const newClientSheetRef = useRef<BottomSheetModal>(null);
  const addItemSheetRef = useRef<AddItemSheetRef>(null);
  const discountSheetRef = useRef<SelectDiscountTypeSheetRef>(null);
  const taxSheetRef = useRef<EditInvoiceTaxSheetRef>(null);
  const editEstimateDetailsSheetRef = useRef<EditEstimateDetailsSheetRef>(null);
  const estimatePreviewModalRef = useRef<InvoicePreviewModalRef>(null);
  
  const defaultValues = {
    estimate_number: '', // Will be updated with proper unified number when component loads
    client_id: '', 
    estimate_date: new Date(),
    valid_until_date: null,
    valid_until_option: 'net_30',
    items: [],
    taxPercentage: 20,
    discountType: null,
    discountValue: 0,
    notes: '',
    acceptance_terms: '',
    paypal_active: false,
    stripe_active: false,
    bank_account_active: false,
  };

  const {
    handleSubmit,
    setValue,
    watch,
    getValues,
    reset
  } = useForm<EstimateFormData>({
    defaultValues
  });

  // State for modal visibility
  const [isEstimateDetailsSheetOpen, setIsEstimateDetailsSheetOpen] = useState(false);
  const [isValidUntilDateSheetOpen, setIsValidUntilDateSheetOpen] = useState(false);
  const [isAddItemSheetOpen, setIsAddItemSheetOpen] = useState(false);
  const [isNewClientSelectionSheetOpen, setIsNewClientSelectionSheetOpen] = useState(false);
  const [isSelectDiscountTypeSheetOpen, setIsSelectDiscountTypeSheetOpen] = useState(false);
  const [isEditInvoiceTaxSheetOpen, setIsEditInvoiceTaxSheetOpen] = useState(false);
  
  // State for global tax settings
  const [globalTaxRatePercent, setGlobalTaxRatePercent] = useState<number | null>(null);
  const [globalTaxName, setGlobalTaxName] = useState<string | null>(null);
  const [isLoadingTaxSettings, setIsLoadingTaxSettings] = useState<boolean>(true);
  
  // Effect to fetch global tax settings
  useEffect(() => {
    if (!user || !supabase) {
      setIsLoadingTaxSettings(false);
      return;
    }
    const fetchGlobalTaxSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('business_settings')
          .select('default_tax_rate, tax_name, currency_code')
          .eq('user_id', user.id)
          .single();
        if (error) {
          console.error('Error fetching business_settings:', error);
        } else if (data) {
          console.log('Fetched business_settings:', data);
          setGlobalTaxName(data.tax_name || null);
          // Ensure default_tax_rate is treated as a number
          const rate = data.default_tax_rate;
          if (rate !== null && rate !== undefined) {
            setGlobalTaxRatePercent(parseFloat(String(rate)));
          } else {
            setGlobalTaxRatePercent(null);
          }
          setCurrencyCode(data.currency_code || 'USD'); // Store currency code in state
        }
      } catch (error) {
        console.error('Unexpected error fetching global tax settings:', error);
      } finally {
        setIsLoadingTaxSettings(false);
      }
    };
    fetchGlobalTaxSettings();
  }, [user, supabase]);
  const [isAddNewItemFormSheetOpen, setIsAddNewItemFormSheetOpen] = useState(false);
  const [formUpdateKey, setFormUpdateKey] = useState(0); // Force re-render key

  // Safety check to prevent undefined themeColors during navigation
  const safeThemeColors = themeColors || colors.light;
  const screenBackgroundColor = isLightMode ? '#F0F2F5' : safeThemeColors.background;
  const styles = getStyles(safeThemeColors, screenBackgroundColor);

  // Generate unique estimate number
  const generateEstimateNumber = async (): Promise<string> => {
    if (!user || !supabase) {
      return 'INV-001';
    }

    try {
      // Use the new reference numbering service for unified numbering
      return await ReferenceNumberService.generateNextReference(user.id, 'estimate');
    } catch (error) {
      console.error('Error generating estimate number:', error);
      return `INV-${Date.now().toString().slice(-6)}`; // Fallback to timestamp-based
    }
  };

  // Initialize estimate number on component load (for new estimates only)
  useEffect(() => {
    const initializeEstimateNumber = async () => {
      if (!isEditMode && user && supabase) {
        setIsLoadingEstimateNumber(true);
        const newEstimateNumber = await generateEstimateNumber();
        setValue('estimate_number', newEstimateNumber);
        console.log('[initializeEstimateNumber] Set estimate number to:', newEstimateNumber);
        setIsLoadingEstimateNumber(false);
      } else {
        // For edit mode, number is already loaded, no need to generate
        setIsLoadingEstimateNumber(false);
      }
    };

    initializeEstimateNumber();
  }, [user, supabase, isEditMode, setValue]);

  // Fetch business settings including estimate terminology
  useEffect(() => {
    const fetchBusinessSettings = async () => {
      if (!user || !supabase) return;
      
      try {
        // Fetch complete business settings for caching
        const { data: businessSettingsData, error: businessError } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
        
        if (!businessError && businessSettingsData) {
          // Cache for preview
          setBusinessSettingsCache(businessSettingsData);
          
          // Set individual states
          if (businessSettingsData.currency_code) {
            setCurrencyCode(businessSettingsData.currency_code);
          }
          if (businessSettingsData.estimate_terminology) {
            setEstimateTerminology(businessSettingsData.estimate_terminology);
          }
          if (businessSettingsData.default_invoice_design) {
            setCurrentDesign(businessSettingsData.default_invoice_design);
          }
          if (businessSettingsData.default_accent_color) {
            setCurrentAccentColor(businessSettingsData.default_accent_color);
          }
        }
      } catch (error) {
        console.log('[fetchBusinessSettings] Error fetching settings:', error);
      }
    };

    fetchBusinessSettings();
  }, [user, supabase]);

  // Watch form values
  const watchedEstimateNumber = watch('estimate_number');
  const watchedEstimateDate = watch('estimate_date');
  const watchedValidUntilDate = watch('valid_until_date');
  const watchedValidUntilOption = watch('valid_until_option');
  const watchedTaxPercentage = watch('taxPercentage');
  const watchedDiscountType = watch('discountType');
  const watchedDiscountValue = watch('discountValue');
  
  // Watch payment method values to prevent auto-toggle issues
  const watchedStripeActive = watch('stripe_active');
  const watchedPaypalActive = watch('paypal_active');
  const watchedBankAccountActive = watch('bank_account_active');

  // Calculate totals
  const displaySubtotal = currentEstimateLineItems.reduce((sum, item) => sum + item.total_price, 0);
  const displayDiscountAmount = watchedDiscountType === 'percentage' 
    ? (displaySubtotal * (watchedDiscountValue || 0)) / 100
    : watchedDiscountType === 'fixed' 
      ? (watchedDiscountValue || 0)
      : 0;
  const discountedSubtotal = displaySubtotal - displayDiscountAmount;
  const displayTaxAmount = discountedSubtotal * ((watchedTaxPercentage || 0) / 100);
  const displayEstimateTotal = discountedSubtotal + displayTaxAmount;

  // Hide header since it's now in the content
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  // Tab bar visibility management
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsTabBarVisible(true);
    });

    if (navigation.isFocused()) {
      setIsTabBarVisible(false);
    }

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);

  // Handle client selection from navigation params
  useEffect(() => {
    if (params?.selectedClientId && params?.selectedClientName) {
      // Create a partial client object with required fields
      const partialClient = {
        id: params.selectedClientId,
        name: params.selectedClientName,
        // Add required ClientType fields with null defaults
        user_id: user?.id || '',
        email: null,
        phone: null,
        address_line1: null,
        address_line2: null,
        city: null,
        country: null,
        postal_code: null,
        avatar_url: null,
        created_at: null,
        updated_at: null,
        contact_person_name: null
      } as ClientType;
      setSelectedClient(partialClient);
    }
  }, [params?.selectedClientId, params?.selectedClientName, user?.id]);

  // Load existing estimate data when in edit mode
  useEffect(() => {
    const loadEstimateForEditing = async () => {
      if (!isEditMode || !editEstimateId || !user || !supabase) {
        return;
      }

      try {
        console.log('[loadEstimateForEditing] Loading estimate:', editEstimateId);

        // Fetch estimate with client and line items
        const { data: estimateData, error: estimateError } = await supabase
          .from('estimates')
          .select(`
            *,
            clients (*),
            estimate_line_items (*)
          `)
          .eq('id', editEstimateId)
          .eq('user_id', user.id) // Security: ensure user owns this estimate
          .single();

        if (estimateError) {
          console.error('[loadEstimateForEditing] Error loading estimate:', estimateError);
          Alert.alert('Error', 'Failed to load estimate data for editing.');
          router.back();
          return;
        }

        if (!estimateData) {
          Alert.alert('Error', 'Estimate not found.');
          router.back();
          return;
        }

        console.log('[loadEstimateForEditing] Estimate data loaded:', estimateData);

        // Set the selected client
        if (estimateData.clients) {
          setSelectedClient(estimateData.clients as ClientType);
        }

        // Transform estimate line items to match form structure
        const transformedLineItems: EstimateLineItem[] = (estimateData.estimate_line_items || []).map(item => ({
          id: item.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          user_saved_item_id: item.user_saved_item_id,
          item_name: item.item_name || '',
          description: item.description,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || 0,
          line_item_discount_type: item.line_item_discount_type,
          line_item_discount_value: item.line_item_discount_value,
          item_image_url: item.item_image_url,
        }));

        // Set current estimate ID for updates
        setCurrentEstimateId(editEstimateId);

        // Populate form with estimate data
        reset({
          estimate_number: estimateData.estimate_number || '',
          client_id: estimateData.client_id || '',
          estimate_date: estimateData.estimate_date ? new Date(estimateData.estimate_date) : new Date(),
          valid_until_date: estimateData.valid_until_date ? new Date(estimateData.valid_until_date) : null,
          valid_until_option: null, // This will be calculated based on dates
          items: transformedLineItems,
          po_number: estimateData.po_number || '',
          custom_headline: estimateData.custom_headline || '',
          taxPercentage: estimateData.tax_percentage || 20,
          discountType: estimateData.discount_type as 'percentage' | 'fixed' | null,
          discountValue: estimateData.discount_value || 0,
          notes: estimateData.notes || '',
          acceptance_terms: estimateData.acceptance_terms || '',
          paypal_active: estimateData.paypal_active || false,
          stripe_active: estimateData.stripe_active || false,
          bank_account_active: estimateData.bank_account_active || false,
        });

        // Set line items state for UI
        setCurrentEstimateLineItems(transformedLineItems);

        // Load design and color from estimate
        if (estimateData.estimate_template) {
          setCurrentDesign(estimateData.estimate_template);
        }
        if (estimateData.accent_color) {
          setCurrentAccentColor(estimateData.accent_color);
        }

        console.log('[loadEstimateForEditing] Form populated with estimate data');

      } catch (error) {
        console.error('[loadEstimateForEditing] Unexpected error:', error);
        Alert.alert('Error', 'An unexpected error occurred while loading the estimate.');
        router.back();
      }
    };

    loadEstimateForEditing();
  }, [isEditMode, editEstimateId, user, supabase, reset, router]);

  // Watch items from form
  const watchedItems = watch('items');

  // Sync form items with currentEstimateLineItems for UI display
  useEffect(() => {
    if (watchedItems) {
      console.log('[useEffect for items] watchedItems:', watchedItems);
      setCurrentEstimateLineItems(watchedItems as EstimateLineItem[]);
    }
  }, [watchedItems]);

  const handleSaveEstimate = async () => {
    if (!user || !supabase) {
      Alert.alert('Error', 'You must be logged in to save estimates.');
      return;
    }

    console.log('[handleSaveEstimate] Starting save process...');
    setIsSavingEstimate(true);

    try {
      // 1. Validate required fields
      const formData = getValues();
      
      if (!formData.client_id) {
        Alert.alert('Validation Error', 'Please select a client before saving.');
        setIsSavingEstimate(false);
        return;
      }

      // Check and generate estimate number if missing
      let estimateNumber = formData.estimate_number?.trim();
      if (!estimateNumber) {
        console.log('[handleSaveEstimate] Estimate number is missing, generating new one...');
        estimateNumber = await generateEstimateNumber();
        setValue('estimate_number', estimateNumber, { shouldValidate: true, shouldDirty: true });
        console.log('[handleSaveEstimate] Generated new estimate number:', estimateNumber);
      }

      console.log('[handleSaveEstimate] Using estimate number:', estimateNumber);
      console.log('[handleSaveEstimate] formData.valid_until_option:', formData.valid_until_option);

      // Get default design and color from business settings for new estimates
      let defaultDesign = 'classic';
      let defaultAccentColor = '#14B8A6';
      
      if (!isEditMode) {
        try {
          const { data: businessSettings } = await supabase
            .from('business_settings')
            .select('default_invoice_design, default_accent_color')
            .eq('user_id', user.id)
            .single();
          
          if (businessSettings) {
            defaultDesign = businessSettings.default_invoice_design || DEFAULT_DESIGN_ID;
            defaultAccentColor = businessSettings.default_accent_color || '#14B8A6';
            console.log('[handleSaveEstimate] Using default design:', defaultDesign, 'color:', defaultAccentColor);
          }
        } catch (error) {
          console.log('[handleSaveEstimate] Could not load business settings, using defaults');
        }
      }

      // 2. Generate unique estimate number if needed
      // let estimateNumber = formData.estimate_number; // This line is now handled above

      // Calculate valid_until_date based on option if not explicitly set
      let calculatedValidUntilDate = formData.valid_until_date;
      if (!calculatedValidUntilDate && formData.valid_until_option) {
        const estimateDate = formData.estimate_date instanceof Date ? formData.estimate_date : new Date(formData.estimate_date);
        
        switch (formData.valid_until_option) {
          case 'net_7':
            calculatedValidUntilDate = addDays(estimateDate, 7);
            break;
          case 'net_14':
            calculatedValidUntilDate = addDays(estimateDate, 14);
            break;
          case 'net_30':
            calculatedValidUntilDate = addDays(estimateDate, 30);
            break;
          case 'net_60':
            calculatedValidUntilDate = addDays(estimateDate, 60);
            break;
          case 'net_90':
            calculatedValidUntilDate = addDays(estimateDate, 90);
            break;
          case 'on_receipt':
          default:
            calculatedValidUntilDate = null;
            break;
        }
      }

      // Check if this is an update to an existing estimate
      const existingEstimateId = editEstimateId;
      
      if (existingEstimateId) {
        // This is an update to an existing estimate
        console.log('[handleSaveEstimate] Updating existing estimate:', existingEstimateId);
        
        const updateData = {
          client_id: formData.client_id,
          estimate_date: formData.estimate_date,
          valid_until_date: calculatedValidUntilDate,
          tax_percentage: formData.taxPercentage,
          discount_type: formData.discountType,
          discount_value: formData.discountValue,
          notes: formData.notes,
          acceptance_terms: formData.acceptance_terms || '',
          custom_headline: formData.custom_headline || '',
          paypal_active: formData.paypal_active,
          stripe_active: formData.stripe_active,
          bank_account_active: formData.bank_account_active,
          subtotal_amount: displaySubtotal,
          total_amount: displayEstimateTotal,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from('estimates')
          .update(updateData)
          .eq('id', existingEstimateId);

        if (updateError) {
          console.error('[handleSaveEstimate] Error updating estimate:', updateError);
          Alert.alert('Error', 'Failed to update estimate. Please try again.');
          setIsSavingEstimate(false);
          return;
        }

        // Update line items separately
        await handleLineItemsUpdate(existingEstimateId, currentEstimateLineItems);

        console.log('[handleSaveEstimate] Successfully updated estimate');
        Alert.alert('Success', 'Estimate updated successfully!');
        setIsSavingEstimate(false);
        router.back();
        return;
      }

      // This is a new estimate - proceed with creation logic
      console.log('[handleSaveEstimate] Creating new estimate');

      // 3. Prepare main estimate data
      const estimateData = {
        user_id: user.id,
        client_id: formData.client_id,
        estimate_number: estimateNumber,
        status: ESTIMATE_STATUSES.DRAFT, // Always save as draft from the form
        estimate_date: formData.estimate_date instanceof Date ? formData.estimate_date.toISOString() : new Date(formData.estimate_date).toISOString(),
        valid_until_date: calculatedValidUntilDate ? calculatedValidUntilDate.toISOString() : null,
        po_number: formData.po_number || null,
        custom_headline: formData.custom_headline || null,
        acceptance_terms: formData.acceptance_terms || null,
        subtotal_amount: displaySubtotal,
        discount_type: formData.discountType || null,
        discount_value: formData.discountValue || 0,
        tax_percentage: formData.taxPercentage || 0,
        total_amount: displayEstimateTotal,
        notes: formData.notes || null,
        stripe_active: formData.stripe_active,
        bank_account_active: formData.bank_account_active,
        paypal_active: formData.paypal_active,
        // Add template and color for estimates
        estimate_template: isEditMode ? currentDesign : defaultDesign,
        accent_color: isEditMode ? currentAccentColor : defaultAccentColor,
      };

      let savedEstimate;

      if (isEditMode && editEstimateId) {
        // UPDATE existing estimate
        console.log('[handleSaveEstimate] Updating existing estimate:', editEstimateId);
        const { data: updatedEstimate, error: estimateError } = await supabase
          .from('estimates')
          .update(estimateData)
          .eq('id', editEstimateId)
          .eq('user_id', user.id) // Security: ensure user owns this estimate
          .select()
          .single();

        if (estimateError) {
          console.error('Error updating estimate:', estimateError);
          Alert.alert('Error', `Failed to update estimate: ${estimateError.message}`);
          setIsSavingEstimate(false);
          return;
        }

        savedEstimate = updatedEstimate;
        console.log('[handleSaveEstimate] Estimate updated successfully');

      } else {
        // CREATE new estimate
        console.log('[handleSaveEstimate] Creating new estimate');
        const { data: newEstimate, error: estimateError } = await supabase
          .from('estimates')
          .insert(estimateData)
          .select()
          .single();

        if (estimateError) {
          console.error('Error creating estimate:', estimateError);
          Alert.alert('Error', `Failed to create estimate: ${estimateError.message}`);
          setIsSavingEstimate(false);
          return;
        }

        savedEstimate = newEstimate;
        console.log('[handleSaveEstimate] Estimate created successfully');

        // Increment usage count for new estimates only
        try {
          await UsageService.incrementInvoiceCount(user.id);
          console.log('[handleSaveEstimate] Usage count incremented');
        } catch (usageError) {
          console.error('Error incrementing usage count:', usageError);
          // Don't fail the estimate creation for this, just log it
        }
      }

      if (!savedEstimate) {
        Alert.alert('Error', 'Failed to save estimate: No data returned.');
        setIsSavingEstimate(false);
        return;
      }

      // 4. Handle line items (create/update/delete)
      await handleLineItemsUpdate(savedEstimate.id, formData.items);

      // 5. Log estimate activity
      try {
        if (isEditMode) {
          await logEstimateEdited(savedEstimate.id, savedEstimate.estimate_number);
        } else {
          await logEstimateCreated(savedEstimate.id, savedEstimate.estimate_number);
        }
      } catch (activityError) {
        console.error('Error logging estimate activity:', activityError);
        // Don't fail the estimate creation for this, just log it
      }

      // 6. Success - Navigate to viewer
      const successMessage = isEditMode ? 'Estimate updated successfully!' : 'Estimate created successfully!';
      console.log(`[handleSaveEstimate] ${successMessage} Navigating to viewer with ID:`, savedEstimate.id);
      
      // Update local state
      setCurrentEstimateId(savedEstimate.id);
      setHasUnsavedChanges(false);
      
      if (!isEditMode && !currentEstimateId) {
        // Only reset form for completely new estimates, not edits or drafts
        reset(defaultValues);
        setSelectedClient(null);
      }
      
      // Navigation logic: different behavior for edit vs create
      if (isEditMode) {
        // For edit mode: go back to the existing estimate viewer (don't create a new one)
        console.log('[handleSaveEstimate] Edit mode: going back to existing estimate viewer');
        router.back();
      } else {
        // For new estimate creation: navigate to new estimate viewer
        console.log('[handleSaveEstimate] Create mode: navigating to new estimate viewer');
        router.replace({
          pathname: '/(app)/(protected)/estimates/estimate-viewer',
          params: { id: savedEstimate.id, from: 'save' },
        });
      }

      setTimeout(() => setIsSavingEstimate(false), 500);

    } catch (error: any) {
      console.error('Unexpected error saving estimate:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message}`);
    } finally {
      setIsSavingEstimate(false);
    }
  };

  const handleLineItemsUpdate = async (estimateId: string, items: EstimateLineItem[] | undefined) => {
    if (!user || !supabase) {
      throw new Error('User authentication required');
    }

    console.log('[handleLineItemsUpdate] Starting line items update for estimate:', estimateId);

    // 1. Delete existing line items (for both create and edit modes)
    // This ensures clean state and simplifies the logic
    const { error: deleteError } = await supabase
      .from('estimate_line_items')
      .delete()
      .eq('estimate_id', estimateId)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting existing line items:', deleteError);
      throw new Error(`Failed to delete existing line items: ${deleteError.message}`);
    }

    console.log('[handleLineItemsUpdate] Existing line items deleted');

    // 2. Insert new/updated line items (for both create and edit modes)
    if (items && items.length > 0) {
      const lineItemsData = items.map(item => ({
        estimate_id: estimateId,
        user_id: user.id,
        item_name: item.item_name,
        item_description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        line_item_discount_type: item.line_item_discount_type || null,
        line_item_discount_value: item.line_item_discount_value || null,
        item_image_url: item.item_image_url || null,
      }));

      console.log('[handleLineItemsUpdate] Inserting line items:', lineItemsData.length);

      const { error: insertError } = await supabase
        .from('estimate_line_items')
        .insert(lineItemsData);

      if (insertError) {
        console.error('Error inserting line items:', insertError);
        throw new Error(`Failed to save line items: ${insertError.message}`);
      }

      console.log('[handleLineItemsUpdate] Line items saved successfully');
    } else {
      console.log('[handleLineItemsUpdate] No line items to save');
    }
  };

  const openNewClientSelectionSheet = () => {
    newClientSheetRef.current?.present();
  };

  const handleClientSelect = (client: ClientType) => {
    setSelectedClient(client);
    setValue('client_id', client.id);
    newClientSheetRef.current?.dismiss();
  };

  // Payment options hook for validation
  const { paymentOptions: paymentOptionsData, loading: paymentOptionsLoading, error: paymentOptionsError } = usePaymentOptions();

  const handlePaymentMethodToggle = (methodKey: 'stripe' | 'paypal' | 'bank_account', newValue: boolean) => {
    console.log(`[handlePaymentMethodToggle] ${methodKey} toggle attempt:`, newValue);
    console.log(`[handlePaymentMethodToggle] Loading state:`, paymentOptionsLoading);
    console.log(`[handlePaymentMethodToggle] Payment options data:`, paymentOptionsData);
    
    // Block all toggles if payment options are still loading
    if (paymentOptionsLoading) {
      Alert.alert(
        'Please Wait',
        'Payment options are still loading. Please try again in a moment.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // If payment options data is not available, only block when enabling (allow disabling)
    if (!paymentOptionsData && newValue === true) {
      // User hasn't set up payment options yet, allow them to continue but warn them
      console.log(`[handlePaymentMethodToggle] No payment options configured yet, will validate individual method`);
    }
    
    // Only validate when toggling ON
    if (newValue === true) {
      let isEnabledInSettings = false;
      let settingName = '';
      
      if (methodKey === 'stripe') {
        isEnabledInSettings = paymentOptionsData?.stripe_enabled === true;
        settingName = 'Pay With Card (Stripe)';
      } else if (methodKey === 'paypal') {
        isEnabledInSettings = paymentOptionsData?.paypal_enabled === true;
        settingName = 'PayPal';
      } else if (methodKey === 'bank_account') {
        isEnabledInSettings = paymentOptionsData?.bank_transfer_enabled === true;
        settingName = 'Bank Transfer';
      }
      
      console.log(`[handlePaymentMethodToggle] ${methodKey} enabled in settings:`, isEnabledInSettings);
      
      if (!isEnabledInSettings) {
        Alert.alert(
          'Payment Method Not Configured',
          `${settingName} is not enabled in your Payment Options. Please configure it first in Settings > Payment Options.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Go to Settings', 
              onPress: () => router.push('/(app)/payment-options')
            }
          ]
        );
        return; // Prevent toggling ON
      }
    }

    // Update react-hook-form state directly - validation passed or toggling OFF
    const formKey = `${methodKey}_active` as keyof EstimateFormData;
    setValue(formKey, newValue, { shouldValidate: true, shouldDirty: true });
    console.log(`[handlePaymentMethodToggle] ${methodKey} successfully set to:`, newValue);
  };

  // Modal callback handlers
  const handleItemFromFormSaved = (itemData: NewItemData) => {
    console.log('Item data received in estimates create.tsx:', itemData);
    
    // Get current items from react-hook-form state
    const currentFormItems = getValues('items') || [];
    
    // Check if this saved item already exists (only for saved items, not custom items)
    if (itemData.saved_item_db_id) {
      const existingItemIndex = currentFormItems.findIndex(
        item => item.user_saved_item_id === itemData.saved_item_db_id
      );
      
      if (existingItemIndex !== -1) {
        // Item already exists, increment quantity
        console.log('Found existing saved item, incrementing quantity');
        const updatedItems = [...currentFormItems];
        const existingItem = updatedItems[existingItemIndex];
        
        // Increment quantity
        existingItem.quantity += itemData.quantity;
        
        // Recalculate total price with updated quantity
        let newTotalPrice = existingItem.quantity * existingItem.unit_price;
        
        // Apply line item discount if present
        if (existingItem.line_item_discount_value && existingItem.line_item_discount_value > 0) {
          if (existingItem.line_item_discount_type === 'percentage') {
            const discountAmount = newTotalPrice * (existingItem.line_item_discount_value / 100);
            newTotalPrice -= discountAmount;
          } else if (existingItem.line_item_discount_type === 'fixed') {
            newTotalPrice -= existingItem.line_item_discount_value;
          }
        }
        
        existingItem.total_price = parseFloat(newTotalPrice.toFixed(2));
        
        // Update both react-hook-form state and local state
        setValue('items', updatedItems, { shouldValidate: true, shouldDirty: true });
        setCurrentEstimateLineItems(updatedItems);
        
        // Dismiss the AddItemSheet
        addItemSheetRef.current?.dismiss();
        return;
      }
    }
    
    // Item doesn't exist or it's a custom item, create new line item
    let itemTotalPrice = itemData.quantity * itemData.price;
    // Apply line item discount if present
    if (itemData.discountValue && itemData.discountValue > 0) { 
      if (itemData.discountType === 'percentage') { 
        const discountAmount = itemTotalPrice * (itemData.discountValue / 100); 
        itemTotalPrice -= discountAmount;
      } else if (itemData.discountType === 'fixed') { 
        itemTotalPrice -= itemData.discountValue; 
      }
    }

    const newLineItem: EstimateLineItem = {
      id: itemData.id || Date.now().toString(), // Use provided ID or generate one
      user_saved_item_id: itemData.saved_item_db_id || null,
      item_name: itemData.itemName,
      description: itemData.description, 
      quantity: itemData.quantity,
      unit_price: itemData.price,
      total_price: parseFloat(itemTotalPrice.toFixed(2)), // Ensure two decimal places
      line_item_discount_type: itemData.discountType || null, 
      line_item_discount_value: itemData.discountValue || null, 
      item_image_url: itemData.imageUri || null, 
    };

    // Update both react-hook-form state and local state with the new item appended
    const updatedItems = [...currentFormItems, newLineItem];
    setValue('items', updatedItems, { shouldValidate: true, shouldDirty: true });
    setCurrentEstimateLineItems(updatedItems);
    
    // Dismiss the AddItemSheet
    addItemSheetRef.current?.dismiss(); 
  };

  const handleDiscountSave = (discountData: DiscountData) => {
    console.log('Apply Discount from sheet:', discountData);
    // Update form values with data from discount sheet
    const numericDiscountValue = discountData.discountValue ? parseFloat(discountData.discountValue.replace(',', '.')) : null;

    setValue('discountType', discountData.discountType, { shouldValidate: true, shouldDirty: true });
    setValue('discountValue', numericDiscountValue, { shouldValidate: true, shouldDirty: true }); // Use parsed numeric value
    // The useEffect for total calculation will pick up these changes
    discountSheetRef.current?.dismiss();
  };

  const handleSelectDiscountTypeSheetClose = () => {
    console.log("SelectDiscountTypeSheet has been closed.");
    // Add any other logic needed when the discount sheet is closed by the user
  };

  const handleTaxSave = (taxData: EstimateTaxData) => {
    setValue('taxPercentage', parseFloat(taxData.taxRate));
    // Note: estimate_tax_label is not stored in database, only used for display
    taxSheetRef.current?.dismiss();
  };

  const handleEstimateDetailsSave = (detailsData: EstimateDetailsData) => {
    console.log('[handleEstimateDetailsSave] Received data:', detailsData);
    
    // Validate that we have a valid estimate number
    if (!detailsData.estimateNumber || !detailsData.estimateNumber.trim()) {
      console.error('[handleEstimateDetailsSave] Invalid estimate number received:', detailsData.estimateNumber);
      Alert.alert('Error', 'Invalid estimate number. Please try again.');
      return;
    }
    
    // Update form values with shouldValidate and shouldDirty flags to trigger re-render
    setValue('estimate_number', detailsData.estimateNumber.trim(), { shouldValidate: true, shouldDirty: true });
    setValue('estimate_date', detailsData.creationDate, { shouldValidate: true, shouldDirty: true });
    setValue('valid_until_option', detailsData.validUntilType, { shouldValidate: true, shouldDirty: true });
    setValue('valid_until_date', detailsData.customValidUntilDate || null, { shouldValidate: true, shouldDirty: true });
    setValue('acceptance_terms', detailsData.acceptanceTerms || '', { shouldValidate: true, shouldDirty: true });
    setValue('custom_headline', detailsData.customHeadline || '', { shouldValidate: true, shouldDirty: true });
    
    // Force a re-render by updating a state variable
    setIsEstimateDetailsSheetOpen(false);
    setFormUpdateKey(prev => prev + 1); // Force re-render
    
    // Add a small delay to ensure the form processes the changes
    setTimeout(() => {
      console.log('[handleEstimateDetailsSave] Form values updated successfully');
    }, 100);
  };

  const handleChangeDesign = async () => {
    console.log('[handleChangeDesign] Design change requested');
    
    // Get current form data without saving to database
    const formData = getValues();
    
    // Validate that we have the minimum required data for design change
    if (!formData.items || formData.items.length === 0) {
      Alert.alert('Design Preview Error', 'Please add at least one item to preview the estimate design.');
      return;
    }
    
    try {
      // Fetch actual business settings from database
      console.log('[handleChangeDesign] Fetching business settings for design preview');
      let businessSettingsForPreview = {
        business_name: '',
        business_address: '',
        business_email: '',
        business_phone: '',
        business_website: '',
        currency_code: currencyCode,
        tax_name: globalTaxName || 'Tax',
        default_tax_rate: globalTaxRatePercent || 0,
        business_logo_url: null,
      };
      
      // Fetch client data if client is selected
      let clientData = null;
      if (formData.client_id && supabase && user) {
        console.log('[handleChangeDesign] Fetching client data for:', formData.client_id);
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', formData.client_id)
          .eq('user_id', user.id)
          .single();
        if (clientError) {
          console.warn('[handleChangeDesign] Could not fetch client:', clientError.message);
        } else if (client) {
          console.log('[handleChangeDesign] Client data loaded:', client);
          clientData = client;
        }
      } else if (selectedClient) {
        // Use selectedClient state as fallback
        console.log('[handleChangeDesign] Using selectedClient state:', selectedClient);
        clientData = selectedClient;
      }
      
      if (supabase && user) {
        const { data: businessData, error: businessError } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (businessError) {
          console.warn('[handleChangeDesign] Could not fetch business settings:', businessError.message);
          // Continue with default settings
        } else if (businessData) {
          console.log('[handleChangeDesign] Business settings loaded:', businessData);
          businessSettingsForPreview = {
            business_name: businessData.business_name || '',
            business_address: businessData.business_address || '',
            business_email: businessData.business_email || '',
            business_phone: businessData.business_phone || '',
            business_website: businessData.business_website || '',
            currency_code: businessData.currency_code || currencyCode,
            tax_name: businessData.tax_name || globalTaxName || 'Tax',
            default_tax_rate: businessData.default_tax_rate || globalTaxRatePercent || 0,
            business_logo_url: businessData.business_logo_url || null,
          };
        }
      }
      
      // Prepare estimate data for design preview (InvoicePreviewModal expects invoice field names)
      const enhancedFormData = {
        ...formData,
        // Map estimate fields to invoice field names that the modal expects
        invoice_number: formData.estimate_number || '',
        invoice_date: formData.estimate_date || new Date(),
        due_date: formData.valid_until_date || addDays(new Date(), 30),
        subtotal: displaySubtotal,
        total_amount: displayEstimateTotal,
        discount_amount: displayDiscountAmount,
        tax_amount: displayTaxAmount,
        currency: currencyCode,
        currency_symbol: getCurrencySymbol(currencyCode),
        // Transform items to match expected structure (modal expects invoice_line_items)
        invoice_line_items: formData.items || [],
        // Map payment method fields
        stripe_active: formData.stripe_active_on_estimate || false,
        paypal_active: formData.paypal_active_on_estimate || false,
        bank_account_active: formData.bank_account_active_on_estimate || false,
        // Add tax label
        invoice_tax_label: globalTaxName || 'Tax',
      };
      
      // Set preview data and open modal in settings mode (design change only)
      console.log('[handleChangeDesign] Opening design modal with data');
      setPreviewData({
        estimateData: enhancedFormData,
        businessSettings: businessSettingsForPreview,
        clientData: clientData,
      });
      estimatePreviewModalRef.current?.present();
    } catch (error: any) {
      console.error('[handleChangeDesign] Error preparing design preview:', error);
      Alert.alert('Design Preview Error', 'Failed to load design preview. Please try again.');
    }
  };

  const handleDesignSaved = (designId: string, accentColor: string) => {
    console.log('[handleDesignSaved] Design saved:', designId, 'Color:', accentColor);
    setCurrentDesign(designId);
    setCurrentAccentColor(accentColor);
  };

  const handlePreviewEstimate = async () => {
    if (!selectedClient) {
      Alert.alert('Preview Error', 'Please select a client before previewing the estimate.');
      return;
    }

    try {
      console.log('[handlePreviewEstimate] Creating preview data...');
      
      // Get current form data
      const formData = getValues();
      
      // Load business settings for preview - use cached if available
      let businessSettingsForPreview = null;
      
      if (businessSettingsCache) {
        // Load payment options to combine with cached business settings
        const { data: paymentOptionsData, error: paymentError } = await supabase
          .from('payment_options')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // Combine business settings with payment options
        businessSettingsForPreview = {
          ...businessSettingsCache,
          ...paymentOptionsData,
          currency_symbol: getCurrencySymbol(currencyCode),
          estimate_terminology: estimateTerminology, // Ensure terminology is included
        };
      } else {
        Alert.alert('Preview Error', 'Business settings not loaded yet. Please try again.');
        return;
      }

      // Transform estimate form data to invoice-like structure for the modal
      const enhancedFormData = {
        ...formData,
        // Transform estimate fields to invoice fields for modal compatibility
        invoice_number: formData.estimate_number,
        invoice_date: formData.estimate_date,
        due_date: formData.valid_until_date,
        invoice_line_items: formData.items || currentEstimateLineItems,
        // Add client information
        clients: selectedClient,
        // Ensure all calculated values are present
        subtotal_amount: displaySubtotal,
        total_amount: displayEstimateTotal,
        tax_percentage: formData.taxPercentage || 0,
        discount_type: formData.discountType || null,
        discount_value: formData.discountValue || 0,
        // Set proper field names for invoice template compatibility
        invoice_tax_label: 'VAT', // Use consistent tax label for estimates
        currency_symbol: getCurrencySymbol(currencyCode),
        currency: currencyCode,
        // Map payment method fields
        stripe_active: formData.stripe_active || false,
        paypal_active: formData.paypal_active || false,
        bank_account_active: formData.bank_account_active || false,
        // Apply current design settings
        estimate_template: currentDesign,
        accent_color: currentAccentColor,
        // Add estimate terminology for proper labeling
        estimate_terminology: estimateTerminology,
      };

      console.log('[handlePreviewEstimate] Enhanced form data:', enhancedFormData);
      console.log('[handlePreviewEstimate] Business settings:', businessSettingsForPreview);
      console.log('[handlePreviewEstimate] Client data:', selectedClient);

      // Set preview data and open modal
      setPreviewData({
        estimateData: enhancedFormData,
        businessSettings: businessSettingsForPreview,
        clientData: selectedClient,
      });
      
      estimatePreviewModalRef.current?.present();

    } catch (error: any) {
      console.error('[handlePreviewEstimate] Error preparing preview:', error);
      Alert.alert('Preview Error', 'Failed to load preview data. Please try again.');
    }
  };

  // Function to handle removing items
  const handleRemoveItem = (itemId: string) => {
    console.log('[handleRemoveItem] Removing item:', itemId);
    
    // Get current items from form to ensure we have the latest state
    const currentFormItems = getValues('items') || [];
    const updatedItems = currentFormItems.filter(item => item.id !== itemId);
    
    console.log('[handleRemoveItem] Current items count:', currentFormItems.length);
    console.log('[handleRemoveItem] Updated items count:', updatedItems.length);
    
    // Update form state first, then local state will be synced via useEffect
    setValue('items', updatedItems, { shouldValidate: false, shouldDirty: false });
    
    // The useEffect watching 'items' will update currentEstimateLineItems automatically
  };

  // Render function for the visible part of the list item
  const renderVisibleItem = (data: { item: EstimateLineItem, index: number }) => {
    const { item, index } = data;
    const isFirstItem = index === 0;
    const isLastItem = index === currentEstimateLineItems.length - 1;
    return (
      <View style={[
        styles.estimateItemRow,
        { backgroundColor: safeThemeColors.card },
        isFirstItem && { borderTopWidth: 0 },
        isLastItem && { borderBottomWidth: 0 }
      ]}>
        <Text style={styles.estimateItemCombinedInfo} numberOfLines={1} ellipsizeMode="tail">
          <Text style={[styles.estimateItemNameText, { color: safeThemeColors.foreground }]}>{item.item_name} </Text>
          <Text style={[styles.estimateItemQuantityText, { color: safeThemeColors.mutedForeground }]}>(x{item.quantity})</Text>
        </Text>
        <Text style={[styles.estimateItemTotalText, { color: safeThemeColors.foreground }]}>
          {getCurrencySymbol(currencyCode)}{Number(item.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    );
  };

  // Render function for the hidden part of the list item (Remove button)
  const renderHiddenItem = (data: { item: EstimateLineItem, index: number }, rowMap: any) => {
    const { item } = data;
    return (
      <View style={styles.rowBack}>
        <TouchableOpacity
          style={[styles.backRightBtn, styles.backRightBtnRight, { backgroundColor: safeThemeColors.destructive }]}
          onPress={() => {
            console.log('[renderHiddenItem] Remove button pressed for item:', item.id);
            handleRemoveItem(item.id);
            if (rowMap[item.id]) {
              rowMap[item.id].closeRow();
            }
          }}
        >
          <Trash2 size={22} color={safeThemeColors.card} />
          <Text style={{ color: safeThemeColors.card, marginLeft: 8, fontSize: 15, fontWeight: '500' }}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Style for payment icons
  const iconStyle = {
    width: 24,
    height: 15,
    marginLeft: 8,
    resizeMode: 'contain' as const,
  };

  const mastercardSpecificStyle = {
    width: 24,
    height: 15,
    marginLeft: 4,
    resizeMode: 'contain' as const,
  };

  return (
    <>
      {/* Status Bar with white background */}
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={safeThemeColors.card}
        translucent={false}
      />
      
      <SafeAreaView style={[styles.container, { backgroundColor: safeThemeColors.card }]} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView 
            key={formUpdateKey}
            style={{ flex: 1, backgroundColor: screenBackgroundColor }}
            contentContainerStyle={{ paddingBottom: 20 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Unified Header Section - Edge to Edge White Container */}
            <TouchableOpacity 
              style={styles.unifiedHeaderSection}
              onPress={() => editEstimateDetailsSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              {/* Header with Back and Preview buttons */}
              <View style={styles.headerButtonsRow}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <ChevronLeft size={24} color={safeThemeColors.foreground} />
                  <Text style={[styles.backButtonText, { color: safeThemeColors.foreground }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.previewButton} onPress={handlePreviewEstimate}>
                  <Text style={styles.previewButtonText}>Preview</Text>
                </TouchableOpacity>
              </View>
              
              {/* Estimate Details */}
              <View style={styles.detailsRow1}>
                <View style={styles.estimateNumberEditContainer}>
                  <Text style={[styles.estimateNumberDisplay, { color: safeThemeColors.foreground }]}>
                    {watchedEstimateNumber || 'INV-001'}
                  </Text>
                </View>
                                  <Text style={{ color: safeThemeColors.foreground, fontWeight: 'bold' }}>
                    {formatValidUntilDisplay(watchedValidUntilDate, watchedValidUntilOption)}
                  </Text>
              </View>
              <View style={styles.detailsRow2}>
                <Text style={[styles.subLabel, { color: safeThemeColors.mutedForeground }]}>Creation Date</Text>
                <Text style={[styles.dateDisplay, { color: safeThemeColors.mutedForeground, fontWeight: 'normal' }]}>
                  {formatFriendlyDate(watchedEstimateDate)}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Client Section */}
            <FormSection title="CLIENT" themeColors={safeThemeColors}>
              {selectedClient ? (
                <View style={styles.selectedClientContainer}>
                  <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
                  <TouchableOpacity onPress={openNewClientSelectionSheet}>
                    <Text style={styles.changeClientText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={openNewClientSelectionSheet} style={styles.clientSelector}>
                  <PlusCircle size={22} color={safeThemeColors.primary} />
                  <Text style={styles.clientSelectorText}>Add Client</Text>
                </TouchableOpacity>
              )}
            </FormSection>

            {/* Items Section */}
            <FormSection title="ITEMS" themeColors={safeThemeColors} noPadding={currentEstimateLineItems.length > 0}>
              {currentEstimateLineItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <TouchableOpacity 
                    style={styles.addItemButtonInline}
                    onPress={() => addItemSheetRef.current?.present()}
                  >
                    <PlusCircle size={20} color={safeThemeColors.primary} style={styles.addItemButtonIcon} />
                    <Text style={[styles.addItemButtonText, { color: safeThemeColors.primary }]}>Add Item or Service</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <SwipeListView
                    data={currentEstimateLineItems}
                    renderItem={renderVisibleItem}
                    renderHiddenItem={renderHiddenItem}
                    rightOpenValue={-110}
                    disableRightSwipe
                    keyExtractor={(item) => item.id}
                    style={[
                      styles.swipeListStyle, 
                      currentEstimateLineItems.length > 0 && {
                        borderRadius: 10,
                        backgroundColor: safeThemeColors.card
                      }
                    ]}
                    contentContainerStyle={styles.swipeListContentContainer}
                    useNativeDriver={false}
                    closeOnRowPress={true}
                    closeOnScroll={true}
                    closeOnRowBeginSwipe={true}
                    scrollEnabled={false}
                  />
                  <TouchableOpacity 
                    style={styles.addItemButtonFullWidth}
                    onPress={() => addItemSheetRef.current?.present()}
                  >
                    <PlusCircle size={20} color={safeThemeColors.primary} style={styles.addItemButtonIcon} />
                    <Text style={[styles.addItemButtonText, { color: safeThemeColors.primary }]}>Add Another Item or Service</Text>
                  </TouchableOpacity>
                </>
              )}
            </FormSection>

            {/* Summary Section */}
            <FormSection title="SUMMARY" themeColors={safeThemeColors}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryText}>
                  {getCurrencySymbol(currencyCode)}{displaySubtotal.toFixed(2)}
                </Text>
              </View>
              
              {/* Discount Row - Only show if discount exists or can be added */}
              {(displayDiscountAmount > 0 || !watchedDiscountType) && (
                <TouchableOpacity 
                  style={styles.summaryRow} 
                  onPress={() => discountSheetRef.current?.present()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.summaryLabel}>
                    {watchedDiscountType === 'percentage' && watchedDiscountValue && watchedDiscountValue > 0 
                      ? `Discount ${watchedDiscountValue}%` 
                      : watchedDiscountType === 'fixed' && watchedDiscountValue && watchedDiscountValue > 0
                        ? 'Discount'
                        : watchedDiscountType
                          ? 'Edit Discount'
                          : 'Add Discount'
                    }
                  </Text>
                  <Text style={styles.summaryText}>
                    {displayDiscountAmount > 0 
                      ? `- ${getCurrencySymbol(currencyCode)}${Number(displayDiscountAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                      : ''
                    }
                  </Text>
                </TouchableOpacity>
              )}
              
              {/* VAT Row */}
              <TouchableOpacity 
                style={styles.summaryRow} 
                onPress={() => taxSheetRef.current?.present()}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.summaryLabel}>VAT </Text>
                  <Text style={styles.taxPercentageStyle}>({watchedTaxPercentage}%)</Text>
                </View>
                <Text style={styles.summaryText}>
                  {getCurrencySymbol(currencyCode)}{displayTaxAmount.toFixed(2)}
                </Text>
              </TouchableOpacity>
              
              <ActionRow
                label="Add Payment"
                value=""
                onPress={() => editEstimateDetailsSheetRef.current?.present()}
                icon={CreditCard}
                themeColors={safeThemeColors}
              />
              
              <View style={[styles.summaryRow, { borderBottomWidth: 0, marginTop: 5 }]}>
                <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 17, color: safeThemeColors.foreground }]}>
                  Total
                </Text>
                <Text style={[styles.summaryText, { fontWeight: 'bold', fontSize: 17, color: safeThemeColors.foreground }]}>
                  {getCurrencySymbol(currencyCode)}{displayEstimateTotal.toFixed(2)}
                </Text>
              </View>
            </FormSection>

            {/* Payment Methods Section */}
            <FormSection title="PAYMENT METHODS" themeColors={safeThemeColors}>
              <ActionRow
                label={
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: paymentOptionsLoading ? safeThemeColors.mutedForeground : safeThemeColors.foreground, fontSize: 16 }}>
                      Pay With Card {paymentOptionsLoading ? '(Loading...)' : ''}
                    </Text>
                    <Image source={require('../../../../assets/visaicon.png')} style={[iconStyle, paymentOptionsLoading && {opacity: 0.5}]} />
                    <Image source={require('../../../../assets/mastercardicon.png')} style={[mastercardSpecificStyle, paymentOptionsLoading && {opacity: 0.5}]} />
                  </View>
                }
                icon={CreditCard}
                themeColors={safeThemeColors}
                showSwitch={true}
                switchValue={getValues('stripe_active')}
                onSwitchChange={(newValue) => handlePaymentMethodToggle('stripe', newValue)}
                onPress={() => handlePaymentMethodToggle('stripe', !getValues('stripe_active'))}
                disabled={paymentOptionsLoading}
              />
              
              <ActionRow
                label={
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: paymentOptionsLoading ? safeThemeColors.mutedForeground : safeThemeColors.foreground, fontSize: 16 }}>
                      PayPal {paymentOptionsLoading ? '(Loading...)' : ''}
                    </Text>
                    <Image source={require('../../../../assets/paypalicon.png')} style={[iconStyle, paymentOptionsLoading && {opacity: 0.5}]} />
                  </View>
                }
                icon={Banknote}
                themeColors={safeThemeColors}
                showSwitch={true}
                switchValue={getValues('paypal_active')}
                onSwitchChange={(newValue) => handlePaymentMethodToggle('paypal', newValue)}
                onPress={() => handlePaymentMethodToggle('paypal', !getValues('paypal_active'))}
                disabled={paymentOptionsLoading}
              />
              
              <ActionRow
                label={paymentOptionsLoading ? "Bank Transfer (Loading...)" : "Bank Transfer"}
                icon={Landmark}
                themeColors={safeThemeColors}
                showSwitch={true}
                switchValue={getValues('bank_account_active')}
                onSwitchChange={(newValue) => handlePaymentMethodToggle('bank_account', newValue)}
                onPress={() => handlePaymentMethodToggle('bank_account', !getValues('bank_account_active'))}
                disabled={paymentOptionsLoading}
              />
            </FormSection>

            {/* Change Design Section */}
            <FormSection title="" themeColors={safeThemeColors}>
              <TouchableOpacity 
                style={styles.changeDesignSelector} 
                onPress={handleChangeDesign}
              >
                <Palette size={20} color={safeThemeColors.primary} style={styles.changeDesignIcon} />
                <Text style={[styles.changeDesignText, { color: safeThemeColors.primary }]}>Change {estimateTerminology === 'quote' ? 'Quote' : 'Estimate'} Design</Text>
              </TouchableOpacity>
            </FormSection>

            {/* Other Settings Section */}
            <FormSection title="OTHER SETTINGS" themeColors={safeThemeColors}>
              <ActionRow
                label="Add images & PDFs (0)"
                onPress={() => console.log('Add Attachments pressed - Coming soon!')}
                icon={Paperclip}
                themeColors={safeThemeColors}
                showChevron={false}
              />
              <TextInput
                style={[styles.notesInput, { 
                  color: safeThemeColors.foreground,
                  borderColor: safeThemeColors.border 
                }]}
                placeholder="Payment is due within 30 days of estimate date. Late payments may incur additional fees."
                placeholderTextColor={safeThemeColors.mutedForeground}
                multiline
                value={watch('notes') || ''}
                onChangeText={(text) => setValue('notes', text)}
                textAlignVertical="top"
              />
            </FormSection>

          {/* Save Button */}
          <TouchableOpacity 
            onPress={handleSaveEstimate} 
            style={[styles.bottomSaveButton, { backgroundColor: safeThemeColors.primary, opacity: isSavingEstimate ? 0.7 : 1 }]}
            disabled={isSavingEstimate}
          >
            <Text style={styles.bottomSaveButtonText}>
              {isSavingEstimate 
                ? (isEditMode ? 'Updating...' : 'Saving...') 
                : (isEditMode 
                  ? `Update ${estimateTerminology === 'quote' ? 'Quote' : 'Estimate'}` 
                  : `Save ${estimateTerminology === 'quote' ? 'Quote' : 'Estimate'}`)}
            </Text>
          </TouchableOpacity>

          {/* Client Selection Sheet */}
          <NewClientSelectionSheet
            ref={newClientSheetRef}
            onClientSelect={handleClientSelect}
            onClose={() => console.log('New client sheet closed')}
          />

          {/* Add Item Sheet */}
          <AddItemSheet
            ref={addItemSheetRef}
            onItemFromFormSaved={handleItemFromFormSaved}
            currencyCode={currencyCode}
          />

          {/* Discount Selection Sheet */}
          <SelectDiscountTypeSheet
            ref={discountSheetRef}
            onApply={handleDiscountSave}
            onClose={handleSelectDiscountTypeSheetClose}
          />

          {/* Tax Edit Sheet */}
          <EditInvoiceTaxSheet
            ref={taxSheetRef}
            currentTaxPercentage={watchedTaxPercentage}
            currentTaxLabel={'Tax'}
            onSave={handleTaxSave}
            onClose={() => taxSheetRef.current?.dismiss()}
          />

          {/* Edit Estimate Details Sheet */}
          <EditEstimateDetailsSheet
            ref={editEstimateDetailsSheetRef}
            terminology={estimateTerminology === 'quote' ? 'quote' : 'estimate'}
            initialDetails={{
              estimateNumber: watchedEstimateNumber || 'INV-001',
              creationDate: watchedEstimateDate || new Date(),
              validUntilType: watch('valid_until_option') || 'net_30',
              customValidUntilDate: watch('valid_until_date'),
              acceptanceTerms: watch('acceptance_terms') || '',
              customHeadline: watch('custom_headline') || '',
            }}
            onSave={handleEstimateDetailsSave}
          />

          {/* Estimate Design Preview Modal */}
          <InvoicePreviewModal
            ref={estimatePreviewModalRef}
            mode={previewData ? "preview" : "settings"}
            invoiceData={previewData?.estimateData}
            businessSettings={previewData?.businessSettings}
            clientData={previewData?.clientData}
            initialDesign={currentDesign}
            initialAccentColor={currentAccentColor}
            onDesignSaved={handleDesignSaved}
            documentType="estimate"
            onClose={() => {
              console.log('[EstimateDesign] Modal closed');
              setPreviewData(null); // Clear preview data when modal closes
            }}
          />

        </ScrollView>
      </KeyboardAvoidingView>


    </SafeAreaView>
    </>
  );
}

const getStyles = (themeColors: ThemeColorPalette, screenBackgroundColor: string) => {
  // Safety check to prevent theme colors being undefined during navigation
  const safeThemeColors = themeColors || colors.light;
  
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBackgroundColor,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    marginLeft: -15,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '400',
  },
  previewButton: {
    backgroundColor: '#FFD700',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  previewButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
  },
  unifiedHeaderSection: {
    marginTop: 0,
    marginHorizontal: 0,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingTop: 1,
    paddingBottom: 8,
    backgroundColor: safeThemeColors.card,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.00,
    elevation: 1,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  detailsRow1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  estimateNumberEditContainer: {
    flex: 1,
  },
  estimateNumberDisplay: {
    fontSize: 28,
    fontWeight: 'bold',
    marginRight: 8,
    paddingVertical: 0,
  },
  dueDateDisplay: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  detailsRow2: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subLabel: {
    fontSize: 14,
  },
  dateDisplay: {
    fontSize: 14,
  },
  selectedClientContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectedClientName: {
    fontSize: 17,
    fontWeight: '600',
    color: safeThemeColors.foreground,
  },
  changeClientText: {
    fontSize: 16,
    color: safeThemeColors.primary,
    fontWeight: '500',
  },
  clientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  clientSelectorText: {
    marginLeft: 10,
    fontSize: 17,
    fontWeight: '500',
    color: safeThemeColors.primary,
  },
  addItemButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  addItemButtonFullWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: safeThemeColors.border,
  },
  addItemButtonIcon: {
    marginRight: 8,
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: safeThemeColors.border,
  },
  summaryLabel: {
    fontSize: 16,
    color: safeThemeColors.foreground,
  },
  summaryText: {
    fontSize: 16,
    color: safeThemeColors.foreground,
    textAlign: 'right',
  },
  taxPercentageStyle: {
    fontSize: 16,
    color: safeThemeColors.mutedForeground,
    fontWeight: 'normal',
    marginLeft: 2,
  },
  paymentIconsContainer: {
    flexDirection: 'row',
    marginLeft: 8,
    gap: 4,
  },
  paymentIcon: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 4,
  },
  visaText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mastercardText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  paypalText: {
    color: 'white',
    fontSize: 8,
    fontWeight: 'bold',
  },
  changeDesignSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  changeDesignIcon: {
    marginRight: 8,
  },
  changeDesignText: {
    fontSize: 16,
    fontWeight: '500',
  },
  notesInput: {
    borderTopWidth: 1,
    borderTopColor: safeThemeColors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomSaveButton: {
    marginHorizontal: 16,
    marginVertical: 16,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bottomSaveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  // SwipeListView and item styles
  swipeListStyle: {
    overflow: 'hidden',
  },
  swipeListContentContainer: {
    paddingBottom: 0,
  },
  estimateItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: safeThemeColors.border,
  },
  estimateItemCombinedInfo: {
    flex: 1,
    marginRight: 12,
    fontSize: 16,
    color: safeThemeColors.foreground,
  },
  estimateItemNameText: {
    fontWeight: '500',
  },
  estimateItemQuantityText: {
    fontWeight: 'normal',
    color: safeThemeColors.mutedForeground,
  },
  estimateItemTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: safeThemeColors.foreground,
  },
  rowBack: {
    alignItems: 'center',
    backgroundColor: safeThemeColors.destructive,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backRightBtn: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: 110,
    flexDirection: 'row',
  },
  backRightBtnRight: {
    backgroundColor: safeThemeColors.destructive,
    right: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: safeThemeColors.border,
    marginLeft: 16, // Assuming ActionRow content (like icon) starts after 16px padding
  },
}); 
};
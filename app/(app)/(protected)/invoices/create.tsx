/**
 * CreateInvoiceScreen - Unified Invoice Creation and Editing
 * 
 * This screen handles both creating new invoices and editing existing ones
 * based on the presence of an 'id' parameter in the route.
 * 
 * USAGE:
 * - Create mode: /invoices/create
 * - Edit mode: /invoices/create?id=invoice_id
 * 
 * FEATURES:
 * - Automatic mode detection based on URL parameters
 * - Complete form population from database in edit mode
 * - Smart save logic (INSERT vs UPDATE operations)
 * - Line items management (create/update/delete)
 * - Loading and error states for edit mode
 * - Consistent UX between create and edit flows
 * - Auto-save as draft for seamless preview functionality
 * - Unsaved changes detection and user prompts
 * - Draft management workflow
 * 
 * PREVIEW WORKFLOW:
 * - New invoice + Preview → Auto-saves as draft → Shows real preview
 * - Edit/Draft + Preview → Uses existing ID for preview
 * - Back navigation with unsaved changes → Prompts to save as draft
 * 
 * IMPLEMENTATION PHASES COMPLETED:
 * ✅ Phase 1: Preparation & Analysis
 * ✅ Phase 2: Edit Mode Detection  
 * ✅ Phase 3: Data Loading & Population
 * ✅ Phase 4: Form Behavior Updates
 * ✅ Phase 5: Navigation & UI Updates
 * ✅ Phase 6: Route Migration
 * ✅ Phase 7: Testing & Cleanup
 * ✅ Phase 8: Documentation & Polish
 * ✅ Phase 9: Draft Auto-Save & Unsaved Changes
 */

import React, { useState, useRef, useMemo, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
  Switch,
  Keyboard, // Added Keyboard import
  ViewStyle, // Explicitly import ViewStyle
  Alert // Re-added import for Alert
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { ChevronRight, PlusCircle, X as XIcon, Edit3, Info, Percent, CreditCard, Banknote, Paperclip, Trash2, Landmark, Palette } from 'lucide-react-native'; // Added Trash2, Landmark, and Palette
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import NewClientSelectionSheet, { Client as ClientType } from './NewClientSelectionSheet';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext'; // Added import
import { Controller, useForm } from 'react-hook-form'; // Import react-hook-form
import EditInvoiceDetailsSheet, { EditInvoiceDetailsSheetRef } from './EditInvoiceDetailsSheet'; // Correctly import named export
import AddItemSheet, { AddItemSheetRef } from './AddItemSheet'; // Correctly not importing NewItemData here
import { NewItemData } from './AddNewItemFormSheet'; // Import NewItemData type from AddNewItemFormSheet where it's defined
import { DUE_DATE_OPTIONS } from './SetDueDateSheet'; // Import DUE_DATE_OPTIONS
import SelectDiscountTypeSheet, { SelectDiscountTypeSheetRef, DiscountData } from './SelectDiscountTypeSheet'; // Import new sheet
import EditInvoiceTaxSheet, { EditInvoiceTaxSheetRef, TaxData as InvoiceTaxData } from './EditInvoiceTaxSheet'; // Changed TaxData to InvoiceTaxData to avoid naming conflict if TaxData is used elsewhere
import MakePaymentSheet, { MakePaymentSheetRef, PaymentData } from './MakePaymentSheet'; // Import new sheet
import { useSupabase } from '@/context/supabase-provider'; // Added useSupabase import
import { SwipeListView } from 'react-native-swipe-list-view'; // Added SwipeListView import
import type { Database } from '../../../../types/database.types'; // Corrected path again
import { Image } from 'react-native'; // Added Image import
import { usePaymentOptions, PaymentOptionData } from '@/hooks/invoices/usePaymentOptions'; // Added correct import
import { KeyboardAvoidingView } from 'react-native';
import { INVOICE_STATUSES, InvoiceStatus, getStatusConfig, isEditable } from '@/constants/invoice-status';
import { useInvoiceActivityLogger } from '@/hooks/invoices/useInvoiceActivityLogger';
import { UsageService } from '@/services/usageService'; // Added UsageService import
import { InvoicePreviewModal, InvoicePreviewModalRef } from '@/components/InvoicePreviewModal'; // Added InvoicePreviewModal import
// import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'; // Removed to match estimates behavior
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
    // Add more as needed
  };
  // Accept both 'GBP' and 'GBP - British Pound' style codes
  if (!code) return '$';
  const normalized = code.split(' ')[0];
  return mapping[normalized] || '$';
};

// Define data structures for the form


interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
  description?: string;
}

interface InvoiceFormData {
  invoice_number: string;
  client_id: string; // Assuming client_id will be stored
  invoice_date: Date;
  due_date: Date | null;
  due_date_option: string | null; // Added to store the selected due date option
  items: InvoiceLineItem[];
  po_number?: string; // Added for PO Number
  custom_headline?: string; // Added for Custom Headline
  taxPercentage?: number | null;
  invoice_tax_label?: string | null; // Added for specific tax label
  discountType?: 'percentage' | 'fixed' | null; // Made more specific
  discountValue?: number | null;
  subTotalAmount?: number;
  totalAmount?: number;
  notes?: string; // Added notes field
  // Add other fields as necessary, e.g., discount, tax
  payment_instructions_active_on_invoice: boolean;
  bank_account_active_on_invoice: boolean;
  paypal_active_on_invoice: boolean;
  stripe_active_on_invoice: boolean; // Added for Stripe
}

interface InvoiceLineItem {
  id: string; // Unique ID for this line item instance on the invoice
  user_saved_item_id?: string | null; // Link to user_saved_items if it was saved
  item_name: string;
  description?: string | null; // Added/uncommented for item description
  quantity: number;
  unit_price: number;
  total_price: number; // Calculated: quantity * unit_price - discount
  line_item_discount_type?: 'percentage' | 'fixed' | null;
  line_item_discount_value?: number | null;
  item_image_url?: string | null;
}

interface RecordedPayment {
  id: string; // Unique ID for this payment
  amount: number;
  method: string;
  date: Date;
}

// Define a type for the theme color palette structure
type ThemeColorPalette = typeof colors.light;

// Define FormSection Component
const FormSection = ({ title, children, themeColors, noPadding }: { title?: string, children: React.ReactNode, themeColors: ThemeColorPalette, noPadding?: boolean }) => {
  const sectionContentStyle: import('react-native').ViewStyle = {
    backgroundColor: themeColors.card,
    borderRadius: 10,
    padding: noPadding ? 0 : 16,
    overflow: Platform.OS === 'android' ? 'hidden' : 'visible', // visible for iOS shadow
    // Shadow properties for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.00,
    // Elevation for Android
    elevation: 1,
  };
  
  return (
    <View style={{ marginHorizontal: 16, marginTop: 20 }}>
      {title && (
        <Text 
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: themeColors.mutedForeground, 
            marginBottom: 8, 
            marginLeft: Platform.OS === 'ios' ? 16 : 0, // iOS often has titles inset with cards
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
const ActionRow = ({ label, onPress, icon: IconComponent, value, themeColors, showChevron = true, showSwitch = false, switchValue, onSwitchChange }: 
  { 
    label: string | React.ReactNode, 
    onPress?: () => void, 
    icon?: React.ElementType, 
    value?: string, 
    themeColors: ThemeColorPalette,
    showChevron?: boolean,
    showSwitch?: boolean,
    switchValue?: boolean,
    onSwitchChange?: (val: boolean) => void
  }
) => {
  const styles = getStyles(themeColors); // Assuming getStyles is defined
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={styles.actionRowContainer}>
      <View style={styles.actionRowLeft}>
        {IconComponent && <IconComponent size={20} color={onPress ? themeColors.primary : themeColors.mutedForeground} style={styles.actionRowIcon} />}
        <Text style={[styles.actionRowLabel, {color: themeColors.foreground}]}>{label}</Text>
      </View>
      <View style={styles.actionRowRight}>
        {value && <Text style={[styles.actionRowValue, {color: themeColors.foreground, marginRight: showChevron ? 8 : 0}]}>{value}</Text>}
        {showSwitch && (
          <Switch
            trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
            thumbColor={switchValue ? themeColors.primary : themeColors.card}
            ios_backgroundColor={themeColors.muted}
            onValueChange={onSwitchChange}
            value={switchValue}
          />
        )}
        {onPress && showChevron && <ChevronRight size={20} color={themeColors.mutedForeground} style={{ marginLeft: 8 }} />}
      </View>
    </TouchableOpacity>
  );
};

// Helper function to format date as '15th May 2025'
const formatFriendlyDate = (date: Date | null | undefined): string => {
  if (!date) return 'Set Date';
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'long' });
  const year = date.getFullYear();
  let daySuffix = 'th';
  if (day === 1 || day === 21 || day === 31) daySuffix = 'st';
  else if (day === 2 || day === 22) daySuffix = 'nd';
  else if (day === 3 || day === 23) daySuffix = 'rd';
  return `${day}${daySuffix} ${month} ${year}`;
};

// Define calculateGrandTotal if it's not already defined elsewhere
// This is a simplified version based on the parameters used.
// Ensure this matches your actual calculation logic if it's more complex.
const calculateGrandTotal = (
  subtotal: number,
  discountType: 'percentage' | 'fixed' | null | undefined,
  discountValue: number | null | undefined,
  taxPercentage: number | null | undefined
): number => {
  let discountedSubtotal = subtotal;
  if (discountType && discountValue) {
    if (discountType === 'percentage') {
      discountedSubtotal = subtotal - (subtotal * (discountValue / 100));
    } else if (discountType === 'fixed') {
      discountedSubtotal = subtotal - discountValue;
    }
  }
  let totalWithTax = discountedSubtotal;
  if (taxPercentage) {
    totalWithTax = discountedSubtotal + (discountedSubtotal * (taxPercentage / 100));
  }
  return parseFloat(totalWithTax.toFixed(2)); // Ensure two decimal places
};

export default function CreateInvoiceScreen() {
  // Add state for currency code INSIDE the component
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const router = useRouter();
  const navigation = useNavigation(); // Get navigation object
  const { setIsTabBarVisible } = useTabBarVisibility(); // Use context
  const { supabase, user } = useSupabase(); // Use Supabase context
  const { logPaymentAdded, logInvoiceCreated, logInvoiceEdited } = useInvoiceActivityLogger(); // Add activity logger
  
  // Updated parameter handling to support both edit and create modes
  const params = useLocalSearchParams<{ 
    id?: string; // For edit mode (e.g., /invoices/create?id=123)
    invoiceId?: string; // Legacy support 
    selectedClientId?: string; 
    selectedClientName?: string;
  }>();
  
  // Edit mode detection - prioritize 'id' over 'invoiceId' with safer checking
  const editInvoiceId = params?.id || params?.invoiceId || null;
  const isEditMode = Boolean(editInvoiceId);
  
  // Loading states for edit mode
  const [isLoadingInvoice, setIsLoadingInvoice] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // State to track save status and changes
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(editInvoiceId);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const [isSaveEnabled, setIsSaveEnabled] = useState(true); // Re-added for save button logic
  const [isMarkedAsPaid, setIsMarkedAsPaid] = useState(false); // Re-added for payment switch

  const [isSavingInvoice, setIsSavingInvoice] = useState(false); // Loading state for save

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, defaultValues },
    reset,
    getValues
  } = useForm<InvoiceFormData>({
    defaultValues: {
      invoice_number: '', // Will be auto-generated or editable
      client_id: '', 
      invoice_date: new Date(),
      due_date: null, // Represents 'On receipt' or a specific date
      due_date_option: 'due_on_receipt', // Default due date option
      items: [] as InvoiceLineItem[], // Explicitly type for clarity with SwipeListView
      po_number: '', // Initialize po_number
      custom_headline: '', // Initialize custom_headline
      taxPercentage: 0,
      invoice_tax_label: 'Tax', // Initialize invoice_tax_label
      discountType: null, // Changed from '' to null
      discountValue: 0,
      subTotalAmount: 0,
      totalAmount: 0,
      notes: '', // Initialize notes
      // Add other fields as necessary, e.g., notes, discount, tax
      payment_instructions_active_on_invoice: false,
      bank_account_active_on_invoice: false,
      paypal_active_on_invoice: false,
      stripe_active_on_invoice: false, // Initialize in defaultValues for react-hook-form
    }
  });

  const styles = getStyles(themeColors); // MOVED STYLES DECLARATION HERE

  // Initialize invoice_date in the form state
  useEffect(() => {
    setValue('invoice_date', new Date());
  }, [setValue]);

  // --- Due Date State (now primarily for invoice_date picker) --- //
  const [invoiceDate, setInvoiceDate] = useState<Date>(getValues('invoice_date') || new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const showDatePicker = () => {
    setDatePickerVisibility(true);
  };

  const hideDatePicker = () => {
    setDatePickerVisibility(false);
  };

  const handleConfirmDate = (date: Date) => {
    setInvoiceDate(date);
    setValue('invoice_date', date); // Update react-hook-form state
    hideDatePicker();
  };

  // --- Selected Client State --- //
  const [selectedClient, setSelectedClient] = useState<ClientType | null>(null);

  // --- Item State for Modal --- //
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');

  // Edit mode detection and logging
  useEffect(() => {
    console.log('[CreateInvoiceScreen] Mode detection:');
    console.log('  - isEditMode:', isEditMode);
    console.log('  - editInvoiceId:', editInvoiceId);
    console.log('  - params?.id:', params?.id);
    console.log('  - params?.invoiceId:', params?.invoiceId);
    
    if (isEditMode && editInvoiceId) {
      console.log('[CreateInvoiceScreen] Edit mode detected - will load invoice:', editInvoiceId);
      loadInvoiceForEdit(editInvoiceId);
    } else {
      console.log('[CreateInvoiceScreen] Create mode - starting with empty form');
    }
  }, [isEditMode, editInvoiceId, params?.id, params?.invoiceId]);

  // Function to load existing invoice data for editing
  const loadInvoiceForEdit = async (invoiceId: string) => {
    if (!supabase || !user) {
      setLoadingError('Database connection not available');
      return;
    }

    console.log('[loadInvoiceForEdit] Starting to load invoice:', invoiceId);
    setIsLoadingInvoice(true);
    setLoadingError(null);

    try {
      // Fetch invoice with related data
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients(*),
          invoice_line_items(*)
        `)
        .eq('id', invoiceId)
        .eq('user_id', user.id) // Security: ensure user owns this invoice
        .single();

      if (invoiceError) {
        console.error('[loadInvoiceForEdit] Error fetching invoice:', invoiceError);
        setLoadingError(`Failed to load invoice: ${invoiceError.message}`);
        return;
      }

      if (!invoiceData) {
        console.error('[loadInvoiceForEdit] No invoice data returned');
        setLoadingError('Invoice not found');
        return;
      }

      console.log('[loadInvoiceForEdit] Invoice data loaded:', invoiceData);
      
      // Transform and populate form data
      await populateFormWithInvoiceData(invoiceData);
      
    } catch (error: any) {
      console.error('[loadInvoiceForEdit] Unexpected error:', error);
      setLoadingError(`Unexpected error: ${error.message}`);
    } finally {
      setIsLoadingInvoice(false);
    }
  };

  // Handle client selection from navigation params
  useEffect(() => {
    if (params?.selectedClientId && params?.selectedClientName) {
      setSelectedClient({ id: params.selectedClientId, name: params.selectedClientName });
      // Optional: Clear params from URL after processing to avoid re-triggering if user navigates away and back
      // router.setParams({ selectedClientId: undefined, selectedClientName: undefined });
    }
  }, [params?.selectedClientId, params?.selectedClientName]);

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[CreateInvoiceScreen] Focus event: Hiding tab bar');
      setIsTabBarVisible(false);
      
      // Reload invoice data if in edit mode and we have an invoice ID
      if (isEditMode && editInvoiceId && !isLoadingInvoice) {
        console.log('[CreateInvoiceScreen] Focus in edit mode - reloading invoice data');
        loadInvoiceForEdit(editInvoiceId);
      }
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[CreateInvoiceScreen] Blur event: Showing tab bar');
      setIsTabBarVisible(true);
    });

    // Handle back button press for unsaved changes
    const unsubscribeBeforeRemove = navigation.addListener('beforeRemove', (e) => {
      console.log('[beforeRemove] Navigation attempt detected');
      console.log('[beforeRemove] hasUnsavedChanges:', hasUnsavedChanges);
      console.log('[beforeRemove] isSavingInvoice:', isSavingInvoice);
      console.log('[beforeRemove] isAutoSaving:', isAutoSaving);
      console.log('[beforeRemove] isEditMode:', isEditMode);
      
      // For edit mode, allow natural navigation - don't intercept
      if (isEditMode) {
        console.log('[beforeRemove] Edit mode - allowing natural navigation');
        return;
      }
      
      // Don't intercept navigation if we're currently saving or if no unsaved changes
      if (!hasUnsavedChanges || isSavingInvoice || isAutoSaving) {
        console.log('[beforeRemove] Allowing navigation - no unsaved changes or currently saving');
        return;
      }

      // Always prevent default behavior IMMEDIATELY
      e.preventDefault();
      console.log('[beforeRemove] Navigation PREVENTED - showing dialog');

      // Use setTimeout to ensure the prevention takes effect before showing dialog
      setTimeout(() => {
        // Prompt the user before leaving the screen with unsaved changes
        Alert.alert(
          'Unsaved Changes',
          'You have unsaved changes. Do you want to save this invoice as a draft before leaving?',
          [
            { 
              text: "Don't Save", 
              style: 'destructive', 
              onPress: () => {
                console.log('[beforeRemove] User chose: Don\'t Save');
                // Clear unsaved changes flag
                setHasUnsavedChanges(false);
                // Navigate to invoice dashboard instead of back to previewer
                router.replace('/(app)/(protected)/invoices');
              }
            },
            { text: 'Cancel', style: 'cancel', onPress: () => {
              console.log('[beforeRemove] User chose: Cancel');
            } },
            {
              text: 'Save Draft',
              onPress: async () => {
                console.log('[beforeRemove] User chose: Save Draft');
                const savedId = await autoSaveAsDraft();
                if (savedId) {
                  setHasUnsavedChanges(false);
                  // Navigate to invoice dashboard after saving
                  router.replace('/(app)/(protected)/invoices');
                } else {
                  Alert.alert('Error', 'Could not save draft. Please try again.');
                }
              },
            },
          ]
        );
      }, 50); // Small delay to ensure prevention takes effect
    });

    // Initial hide if screen is focused on mount
    if (navigation.isFocused()) {
        console.log('[CreateInvoiceScreen] Initial focus: Hiding tab bar');
        setIsTabBarVisible(false);
    }

    return () => {
      console.log('[CreateInvoiceScreen] Unmounting: Ensuring tab bar is visible');
      unsubscribeFocus();
      unsubscribeBlur();
      unsubscribeBeforeRemove();
      // Explicitly set to true on unmount as a safeguard, 
      // though blur should ideally handle it before unmount.
      setIsTabBarVisible(true); 
    };
  }, [navigation, setIsTabBarVisible, hasUnsavedChanges, autoSaveAsDraft, isSavingInvoice, isAutoSaving, isEditMode, editInvoiceId, isLoadingInvoice]);

  // --- Bottom Sheet Modal (Add Item) --- //
  const addItemSheetRef = useRef<AddItemSheetRef>(null);
  const addItemSnapPoints = useMemo(() => ['50%', '90%'], []);

  const handlePresentAddItemModal = useCallback(() => {
    // Dismiss keyboard if open
    Keyboard.dismiss();
    addItemSheetRef.current?.present();
  }, []);

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
    // Clear item form when modal is fully closed
    if (index === -1) {
      setItemName('');
      setItemQuantity('1');
      setItemPrice('');
      setItemDescription('');
    }
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0} // Show backdrop when modal is at the first snap point or higher
      />
    ),
    []
  );

  // --- Client Selection Modal --- //
  const newClientSheetRef = useRef<BottomSheetModal>(null);

  const handleClientSelect = useCallback((client: ClientType) => {
    setValue('client_id', client.id, { shouldValidate: true });
    setSelectedClient(client);
    // You might want to trigger form validation or other actions here
    console.log('Selected client:', client);
    newClientSheetRef.current?.dismiss(); // Dismiss the sheet after selection
  }, [setValue]);

  const openNewClientSelectionSheet = useCallback(() => {
    newClientSheetRef.current?.present();
  }, []);

  const navigateToClientSelection = () => {
    router.push({
      pathname: '/customers',
      params: { selectionMode: 'true', origin: '/invoices/create' }, // Added origin for robust back navigation
    });
  };

  const handleSaveInvoice = async (formData: InvoiceFormData) => {
    if (!user || !supabase) {
      Alert.alert('Error', 'User session or Supabase client not available.');
      return;
    }

    setIsSavingInvoice(true);

    try {
      console.log(`[handleSaveInvoice] ${isEditMode ? 'UPDATE' : 'CREATE'} mode - Processing invoice`);

      // Check usage limits for new invoice creation (not for edits)
      if (!isEditMode) {
        console.log('[handleSaveInvoice] Checking usage limits for new invoice');
        const limitCheck = await UsageService.checkInvoiceLimit(user.id);
        
        if (!limitCheck.canCreate) {
          console.log('[handleSaveInvoice] Usage limit reached, showing paywall');
          Alert.alert(
            'Upgrade Required',
            `You've reached your limit of ${limitCheck.remaining === 0 ? limitCheck.total : 'free'} invoices! Upgrade to create unlimited invoices and unlock premium features.`,
            [
              {
                text: 'Maybe Later',
                style: 'cancel'
              },
              {
                text: 'Upgrade Now',
                onPress: () => {
                  // Navigate to paywall/subscription screen
                  router.push('/(app)/(protected)/subscription/paywall');
                }
              }
            ]
          );
          setIsSavingInvoice(false);
          return;
        }

        console.log(`[handleSaveInvoice] Usage check passed. Remaining: ${limitCheck.remaining}`);
      }

      console.log('[handleSaveInvoice] formData.invoice_number:', formData.invoice_number);
      console.log('[handleSaveInvoice] formData.invoice_date:', formData.invoice_date);
      console.log('[handleSaveInvoice] formData.due_date:', formData.due_date);
      console.log('[handleSaveInvoice] formData.due_date_option:', formData.due_date_option);

      // Get default design and color from business settings for new invoices
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
            console.log('[handleSaveInvoice] Using default design:', defaultDesign, 'color:', defaultAccentColor);
          }
        } catch (error) {
          console.log('[handleSaveInvoice] Could not load business settings, using defaults');
        }
      }

      // 1. Prepare main invoice data
      const invoiceData = {
        user_id: user.id,
        client_id: formData.client_id,
        invoice_number: formData.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
        status: INVOICE_STATUSES.DRAFT, // Always save as draft from the form
        invoice_date: formData.invoice_date instanceof Date ? formData.invoice_date.toISOString() : new Date(formData.invoice_date).toISOString(),
        due_date: formData.due_date ? (formData.due_date instanceof Date ? formData.due_date.toISOString() : new Date(formData.due_date).toISOString()) : null,
        due_date_option: formData.due_date_option,
        po_number: formData.po_number || null,
        custom_headline: formData.custom_headline || null,
        subtotal_amount: formData.subTotalAmount,
        discount_type: formData.discountType || null,
        discount_value: formData.discountValue || 0,
        tax_percentage: formData.taxPercentage || 0,
        invoice_tax_label: formData.invoice_tax_label || 'Tax',
        total_amount: formData.totalAmount,
        notes: formData.notes || null,
        stripe_active: formData.stripe_active_on_invoice,
        bank_account_active: formData.bank_account_active_on_invoice,
        paypal_active: formData.paypal_active_on_invoice,
        // Add design and color fields for new invoices
        ...(isEditMode ? {} : {
          invoice_design: defaultDesign,
          accent_color: defaultAccentColor,
        }),
      };

      let savedInvoice;

      if (isEditMode && editInvoiceId) {
        // UPDATE existing invoice
        console.log('[handleSaveInvoice] Updating existing invoice:', editInvoiceId);
        const { data: updatedInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', editInvoiceId)
          .eq('user_id', user.id) // Security: ensure user owns this invoice
          .select()
          .single();

        if (invoiceError) {
          console.error('Error updating invoice:', invoiceError);
          Alert.alert('Error', `Failed to update invoice: ${invoiceError.message}`);
          setIsSavingInvoice(false);
          return;
        }

        savedInvoice = updatedInvoice;
        console.log('[handleSaveInvoice] Invoice updated successfully');

      } else {
        // CREATE new invoice
        console.log('[handleSaveInvoice] Creating new invoice');
      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
          .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
          console.error('Error creating invoice:', invoiceError);
          Alert.alert('Error', `Failed to create invoice: ${invoiceError.message}`);
        setIsSavingInvoice(false);
        return;
      }

        savedInvoice = newInvoice;
        console.log('[handleSaveInvoice] Invoice created successfully');

        // Increment usage count for new invoices only
        try {
          await UsageService.incrementInvoiceCount(user.id);
          console.log('[handleSaveInvoice] Usage count incremented');
        } catch (usageError) {
          console.error('Error incrementing usage count:', usageError);
          // Don't fail the invoice creation for this, just log it
        }
      }

      if (!savedInvoice) {
        Alert.alert('Error', 'Failed to save invoice: No data returned.');
        setIsSavingInvoice(false);
        return;
      }

      // 2. Handle line items (create/update/delete)
      await handleLineItemsUpdate(savedInvoice.id, formData.items);

      // 3. Success - Navigate to viewer
      const successMessage = isEditMode ? 'Invoice updated successfully!' : 'Invoice created successfully!';
      console.log(`[handleSaveInvoice] ${successMessage} Navigating to viewer with ID:`, savedInvoice.id);
      
      // Log the activity
      if (isEditMode) {
        await logInvoiceEdited(savedInvoice.id, savedInvoice.invoice_number);
      } else {
        await logInvoiceCreated(savedInvoice.id, savedInvoice.invoice_number);
      }
      
      // Update local state
      setCurrentInvoiceId(savedInvoice.id);
      setHasUnsavedChanges(false);
      
      if (!isEditMode && !currentInvoiceId) {
        // Only reset form for completely new invoices, not edits or drafts
        reset(defaultValues);
        setSelectedClient(null);
      }
      
      // Navigation logic: different behavior for edit vs create
      if (isEditMode) {
        // For edit mode: go back to the existing invoice viewer (don't create a new one)
        console.log('[handleSaveInvoice] Edit mode: going back to existing invoice viewer');
        router.back();
      } else {
        // For new invoice creation: navigate to new invoice viewer
        console.log('[handleSaveInvoice] Create mode: navigating to new invoice viewer');
        router.replace({
          pathname: '/(app)/(protected)/invoices/invoice-viewer',
          params: { id: savedInvoice.id, from: 'save' },
        });
      }

      setTimeout(() => setIsSavingInvoice(false), 500);

    } catch (error: any) {
      console.error('Unexpected error saving invoice:', error);
      Alert.alert('Error', `An unexpected error occurred: ${error.message}`);
    } finally {
      setIsSavingInvoice(false);
    }
  };

  // Helper function to handle line items for both create and edit modes
  const handleLineItemsUpdate = async (invoiceId: string, items: InvoiceLineItem[]) => {
    if (!supabase || !user) return;

    console.log('[handleLineItemsUpdate] Processing line items for invoice:', invoiceId);
    console.log('[handleLineItemsUpdate] Items count:', items.length);

    if (isEditMode) {
      // In edit mode: delete all existing items and insert new ones
      // This is a simple approach - more sophisticated would be to track changes
      console.log('[handleLineItemsUpdate] Edit mode: replacing all line items');
      
      // 1. Delete existing line items
      const { error: deleteError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error('Error deleting existing line items:', deleteError);
        throw new Error(`Failed to update line items: ${deleteError.message}`);
      }

      console.log('[handleLineItemsUpdate] Existing line items deleted');
    }

    // 2. Insert new/updated line items (for both create and edit modes)
    if (items && items.length > 0) {
      const lineItemsData = items.map(item => ({
        invoice_id: invoiceId,
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
          .from('invoice_line_items')
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

  // Function to auto-save as draft (for preview functionality)
  const autoSaveAsDraft = async (): Promise<string | null> => {
    if (!user || !supabase) {
      console.error('[autoSaveAsDraft] No user or supabase available');
      return null;
    }

    console.log('[autoSaveAsDraft] Auto-saving invoice as draft for preview');
    setIsAutoSaving(true);

    try {
      const formData = getValues();
      
      // Prepare invoice data (always as draft for auto-save)
      const invoiceData = {
        user_id: user.id,
        client_id: formData.client_id,
        invoice_number: formData.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
        status: 'draft', // Always save as draft for auto-save
        invoice_date: formData.invoice_date instanceof Date ? formData.invoice_date.toISOString() : new Date(formData.invoice_date).toISOString(),
        due_date: formData.due_date ? (formData.due_date instanceof Date ? formData.due_date.toISOString() : new Date(formData.due_date).toISOString()) : null,
        due_date_option: formData.due_date_option,
        po_number: formData.po_number || null,
        custom_headline: formData.custom_headline || null,
        subtotal_amount: formData.subTotalAmount,
        discount_type: formData.discountType || null,
        discount_value: formData.discountValue || 0,
        tax_percentage: formData.taxPercentage || 0,
        invoice_tax_label: formData.invoice_tax_label || 'Tax',
        total_amount: formData.totalAmount,
        notes: formData.notes || null,
        stripe_active: formData.stripe_active_on_invoice,
        bank_account_active: formData.bank_account_active_on_invoice,
        paypal_active: formData.paypal_active_on_invoice,
      };

      let savedInvoice;

      if (currentInvoiceId || editInvoiceId) {
        // Update existing draft or invoice
        const idToUpdate = currentInvoiceId || editInvoiceId;
        console.log('[autoSaveAsDraft] Updating existing invoice/draft:', idToUpdate);
        const { data: updatedInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .update(invoiceData)
          .eq('id', idToUpdate)
          .eq('user_id', user.id)
          .select()
          .single();

        if (invoiceError) {
          console.error('Error updating draft:', invoiceError);
          return null;
        }
        savedInvoice = updatedInvoice;
        
        // Update currentInvoiceId if we were using editInvoiceId
        if (!currentInvoiceId && editInvoiceId) {
          setCurrentInvoiceId(editInvoiceId);
        }
      } else {
        // Create new draft
        console.log('[autoSaveAsDraft] Creating new draft');
        const { data: newInvoice, error: invoiceError } = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select()
          .single();

        if (invoiceError) {
          console.error('Error creating draft:', invoiceError);
          return null;
        }
        savedInvoice = newInvoice;
        setCurrentInvoiceId(savedInvoice.id); // Update local state with new ID
      }

      // Save line items
      await handleLineItemsUpdate(savedInvoice.id, formData.items || []);
      
      console.log('[autoSaveAsDraft] Draft saved successfully with ID:', savedInvoice.id);
      return savedInvoice.id;

    } catch (error: any) {
      console.error('[autoSaveAsDraft] Error auto-saving draft:', error);
      return null;
    } finally {
      setIsAutoSaving(false);
    }
  };

  // State for preview modal data
  const [previewData, setPreviewData] = useState<{
    invoiceData: any;
    businessSettings: any;
    clientData: any;
  } | null>(null);

  const handlePreviewInvoice = async () => {
    console.log('[handlePreviewInvoice] Preview requested');
    
    // Get current form data without saving to database
    const formData = getValues();
    
    // Validate that we have the minimum required data for preview
    if (!formData.items || formData.items.length === 0) {
      Alert.alert('Preview Error', 'Please add at least one item to preview the invoice.');
      return;
    }
    
    try {
      // Fetch actual business settings from database
      console.log('[handlePreviewInvoice] Fetching business settings for preview');
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
        console.log('[handlePreviewInvoice] Fetching client data for:', formData.client_id);
        const { data: client, error: clientError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', formData.client_id)
          .eq('user_id', user.id)
          .single();

        if (clientError) {
          console.warn('[handlePreviewInvoice] Could not fetch client:', clientError.message);
        } else if (client) {
          console.log('[handlePreviewInvoice] Client data loaded:', client);
          clientData = client;
        }
      } else if (selectedClient) {
        // Use selectedClient state as fallback
        console.log('[handlePreviewInvoice] Using selectedClient state:', selectedClient);
        clientData = selectedClient;
      }

      if (supabase && user) {
        const { data: businessData, error: businessError } = await supabase
          .from('business_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (businessError) {
          console.warn('[handlePreviewInvoice] Could not fetch business settings:', businessError.message);
          // Continue with default settings
        } else if (businessData) {
          console.log('[handlePreviewInvoice] Business settings loaded:', businessData);
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

      // Prepare enhanced form data with client info and ensure all totals are calculated
      const enhancedFormData = {
        ...formData,
        // Add client information
        clients: clientData,
        // Ensure all calculated values are present with correct field names
        subtotal_amount: displaySubtotal,
        total_amount: displayInvoiceTotal,
        tax_percentage: formData.taxPercentage || 0,
        discount_type: formData.discountType || null,
        discount_value: formData.discountValue || 0,
        // Set proper field names for invoice template
        invoice_tax_label: formData.invoice_tax_label || globalTaxName || 'Tax',
        currency_symbol: getCurrencySymbol(currencyCode),
        currency: currencyCode,
        // Transform items to match expected structure
        invoice_line_items: formData.items || [],
        // Map payment method fields for InvoiceTemplateOne
        stripe_active: formData.stripe_active_on_invoice || false,
        paypal_active: formData.paypal_active_on_invoice || false,
        bank_account_active: formData.bank_account_active_on_invoice || false,
      };
      
      // Set preview data and open modal
      console.log('[handlePreviewInvoice] Opening preview modal with data');
      console.log('[handlePreviewInvoice] Client data:', clientData);
      console.log('[handlePreviewInvoice] Totals - Subtotal:', displaySubtotal, 'Total:', displayInvoiceTotal);
      setPreviewData({
        invoiceData: enhancedFormData,
        businessSettings: businessSettingsForPreview,
        clientData: clientData,
      });
      invoicePreviewModalRef.current?.present();
    } catch (error: any) {
      console.error('[handlePreviewInvoice] Error preparing preview:', error);
      Alert.alert('Preview Error', 'Failed to load preview data. Please try again.');
    }
  };

  useLayoutEffect(() => {
    // Show preview button for both create and edit modes
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={handlePreviewInvoice} 
          style={styles.headerPreviewButton}
        >
          <Text style={styles.headerPreviewButtonText}>
            Preview
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, themeColors, handlePreviewInvoice, styles, isEditMode]);

  const screenBackgroundColor = isLightMode ? '#F0F2F5' : themeColors.background;


  const [invoiceDetails, setInvoiceDetails] = useState<any>(null);

  const watchedInvoiceNumber = watch('invoice_number');
  const watchedInvoiceDate = watch('invoice_date');
  const watchedDueDate = watch('due_date');
  const watchedDueDateOption = watch('due_date_option');
  const watchedPoNumber = watch('po_number'); 
  const watchedCustomHeadline = watch('custom_headline'); 
  const watchedTaxPercentage = watch('taxPercentage');
  const watchedDiscountType = watch('discountType');
  const watchedDiscountValue = watch('discountValue');

  const watchedItems = watch('items'); // Watch the items array
  const [currentInvoiceLineItems, setCurrentInvoiceLineItems] = useState<InvoiceLineItem[]>([]);

  useEffect(() => {
    console.log('[useEffect for items] watchedItems:', watchedItems);
    const itemsFromForm = (watchedItems || []) as InvoiceLineItem[];
    setCurrentInvoiceLineItems(itemsFromForm);
    console.log('[useEffect for items] setCurrentInvoiceLineItems to:', itemsFromForm);
  }, [watchedItems]);

  // Track unsaved changes - Smart detection of meaningful content
  useEffect(() => {
    // Helper function to check if the form has meaningful content
    const hasSignificantContent = () => {
      const currentItems = getValues('items') || [];
      const clientId = getValues('client_id');
      const invoiceNumber = getValues('invoice_number');
      const customHeadline = getValues('custom_headline');
      const poNumber = getValues('po_number');
      const notes = getValues('notes');
      
      // Check if there's any meaningful content
      const hasItems = currentItems.length > 0;
      const hasClient = Boolean(clientId);
      const hasCustomInvoiceNumber = Boolean(invoiceNumber && invoiceNumber.trim());
      const hasCustomHeadline = Boolean(customHeadline && customHeadline.trim());
      const hasPONumber = Boolean(poNumber && poNumber.trim());
      const hasNotes = Boolean(notes && notes.trim());
      
      console.log('[hasSignificantContent] Check:', {
        hasItems,
        hasClient,
        hasCustomInvoiceNumber,
        hasCustomHeadline,
        hasPONumber,
        hasNotes,
        itemsCount: currentItems.length
      });
      
      return hasItems || hasClient || hasCustomInvoiceNumber || hasCustomHeadline || hasPONumber || hasNotes;
    };

    // Watch for form changes and only set unsaved changes if there's meaningful content
    const subscription = watch((value, { name, type }) => {
      if (type === 'change') {
        const hasContent = hasSignificantContent();
        console.log('[unsaved changes tracker] Form changed:', name, 'hasContent:', hasContent);
        setHasUnsavedChanges(hasContent);
      }
    });

    // Initial check on mount for edit mode
    if (isEditMode || currentInvoiceId) {
      // For edit mode, check if there's content to determine initial state
      const hasContent = hasSignificantContent();
      console.log('[unsaved changes tracker] Edit mode initial check - hasContent:', hasContent);
      setHasUnsavedChanges(hasContent);
    }

    return () => subscription.unsubscribe();
  }, [watch, getValues, isEditMode, currentInvoiceId]);

  const [recordedPayments, setRecordedPayments] = useState<RecordedPayment[]>([]); // State for recorded payments

  const totalPaidAmount = recordedPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const balanceDueBeforeMarkAsPaid = (getValues('totalAmount') || 0) - totalPaidAmount; 

  const handleSaveDetailsFromModal = (updatedDetails: any) => {
    // This function will be called when the modal's save button is pressed
    console.log('[CreateInvoiceScreen] handleSaveDetailsFromModal - Received updatedDetails:', updatedDetails);
    console.log('[CreateInvoiceScreen] handleSaveDetailsFromModal - updatedDetails.dueDateDisplayLabel:', updatedDetails?.dueDateDisplayLabel);
    setInvoiceDetails(updatedDetails); // Update the local state for UI display

    // Update react-hook-form state as well for consistency and submission
    setValue('invoice_number', updatedDetails.invoiceNumber || '');
    // Ensure creationDate is a Date object before setting
    const creationDate = updatedDetails.creationDate ? new Date(updatedDetails.creationDate) : new Date();
    setValue('invoice_date', creationDate);

    // Ensure customDueDate is a Date object or null
    const customDueDate = updatedDetails.customDueDate ? new Date(updatedDetails.customDueDate) : null;
    setValue('due_date', customDueDate);
    
    setValue('due_date_option', updatedDetails.dueDateType); // Update due_date_option
    
    setValue('po_number', updatedDetails.poNumber || '');
    setValue('custom_headline', updatedDetails.customHeadline || '');

    // If you had other fields in InvoiceFormData that map to updatedDetails, set them here.
    // For example, if you added dueDateType to InvoiceFormData:
    // setValue('due_date_type', updatedDetails.dueDateType);
    editInvoiceDetailsSheetRef.current?.dismiss(); // Add this line to close the modal
  };

  React.useEffect(() => {
    console.log('[CreateInvoiceScreen] useEffect - invoiceDetails.dueDateDisplayLabel changed to:', invoiceDetails?.dueDateDisplayLabel);
  }, [invoiceDetails?.dueDateDisplayLabel]);

  const openEditInvoiceDetailsModal = () => {
    console.log('Attempting to open Edit Invoice Details Modal...');
    editInvoiceDetailsSheetRef.current?.present();
  };

  // Ref for the new EditInvoiceDetailsSheet modal
  const editInvoiceDetailsSheetRef = useRef<EditInvoiceDetailsSheetRef>(null);

  console.log("[CreateInvoiceScreen] RENDERING, dueDateDisplayLabel:", invoiceDetails?.dueDateDisplayLabel); // Added render log

  const handleItemFromSheetSaved = (itemDataFromSheet: NewItemData) => {
    console.log('Item data received in create.tsx:', itemDataFromSheet);
    
    // Get current items from react-hook-form state
    const currentFormItems = getValues('items') || [];
    
    // Check if this saved item already exists (only for saved items, not custom items)
    if (itemDataFromSheet.saved_item_db_id) {
      const existingItemIndex = currentFormItems.findIndex(
        item => item.user_saved_item_id === itemDataFromSheet.saved_item_db_id
      );
      
      if (existingItemIndex !== -1) {
        // Item already exists, increment quantity
        console.log('Found existing saved item, incrementing quantity');
        const updatedItems = [...currentFormItems];
        const existingItem = updatedItems[existingItemIndex];
        
        // Increment quantity
        existingItem.quantity += itemDataFromSheet.quantity;
        
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
        
        // Update react-hook-form state with the modified items
        setValue('items', updatedItems, { shouldValidate: true, shouldDirty: true });
        
        // Dismiss the AddItemSheet
        addItemSheetRef.current?.dismiss();
        return;
      }
    }
    
    // Item doesn't exist or it's a custom item, create new line item
    let itemTotalPrice = itemDataFromSheet.quantity * itemDataFromSheet.price;
    // Apply line item discount if present
    if (itemDataFromSheet.discountValue && itemDataFromSheet.discountValue > 0) { 
      if (itemDataFromSheet.discountType === 'percentage') { 
        const discountAmount = itemTotalPrice * (itemDataFromSheet.discountValue / 100); 
        itemTotalPrice -= discountAmount;
      } else if (itemDataFromSheet.discountType === 'fixed') { 
        itemTotalPrice -= itemDataFromSheet.discountValue; 
      }
    }

    const newLineItem: InvoiceLineItem = {
      id: itemDataFromSheet.id, // This is the temporary inv_item_xxx ID
      user_saved_item_id: itemDataFromSheet.saved_item_db_id || null,
      item_name: itemDataFromSheet.itemName,
      description: itemDataFromSheet.description, 
      quantity: itemDataFromSheet.quantity,
      unit_price: itemDataFromSheet.price,
      total_price: parseFloat(itemTotalPrice.toFixed(2)), // Ensure two decimal places
      line_item_discount_type: itemDataFromSheet.discountType || null, 
      line_item_discount_value: itemDataFromSheet.discountValue || null, 
      item_image_url: itemDataFromSheet.imageUri || null, 
    };

    // Update react-hook-form state with the new item appended
    setValue('items', [...currentFormItems, newLineItem], { shouldValidate: true, shouldDirty: true });
    
    // The useEffect watching 'items' will update currentInvoiceLineItems for the UI
    // setCurrentInvoiceLineItems(prevItems => [...prevItems, newLineItem]); // This line is removed

    // Dismiss the AddItemSheet (which might also dismiss AddNewItemFormSheet if it was presented from there)
    addItemSheetRef.current?.dismiss(); 
  };

  // State for calculated display values
  const [displaySubtotal, setDisplaySubtotal] = useState<number>(0);
  const [displayTaxAmount, setDisplayTaxAmount] = useState<number>(0);
  const [displayDiscountAmount, setDisplayDiscountAmount] = useState<number>(0);
  const [displayInvoiceTotal, setDisplayInvoiceTotal] = useState<number>(0);

  // EFFECT: Calculate Subtotal when line items change
  useEffect(() => {
    const newSubtotal = currentInvoiceLineItems.reduce((acc, item) => acc + item.total_price, 0);
    setDisplaySubtotal(newSubtotal);
    setValue('subTotalAmount', newSubtotal, { shouldValidate: true, shouldDirty: true });
  }, [currentInvoiceLineItems, setValue]);

  // EFFECT: Calculate Tax, Discount, and Total when subtotal or form tax/discount values change
  useEffect(() => {
    const subTotal = displaySubtotal;

    let discountAmountApplied = 0;
    if (watchedDiscountType && typeof watchedDiscountValue === 'number' && watchedDiscountValue > 0) {
      if (watchedDiscountType === 'percentage') {
        discountAmountApplied = subTotal * (watchedDiscountValue / 100);
      } else { // Fixed amount
        discountAmountApplied = watchedDiscountValue;
      }
    }

    const amountAfterDiscount = subTotal - discountAmountApplied;

    let taxAmountCalculated = 0;
    if (typeof watchedTaxPercentage === 'number' && watchedTaxPercentage > 0) {
      taxAmountCalculated = amountAfterDiscount * (watchedTaxPercentage / 100);
    }

    const finalTotal = amountAfterDiscount + taxAmountCalculated;

    setDisplayDiscountAmount(discountAmountApplied);
    setDisplayTaxAmount(taxAmountCalculated);
    setDisplayInvoiceTotal(finalTotal);
    setValue('totalAmount', finalTotal > 0 ? finalTotal : 0, { shouldValidate: true, shouldDirty: true }); // Ensure total isn't negative

  }, [displaySubtotal, watchedTaxPercentage, watchedDiscountType, watchedDiscountValue, setValue]);

  // State for global tax settings
  const [globalTaxRatePercent, setGlobalTaxRatePercent] = useState<number | null>(null);
  const [globalTaxName, setGlobalTaxName] = useState<string | null>(null);
  const [isLoadingTaxSettings, setIsLoadingTaxSettings] = useState<boolean>(true);

  // State for invoice-specific tax override
  const [invoiceTaxLabel, setInvoiceTaxLabel] = useState<string | null>('Tax'); // State for tax label
  const [taxPercentage, setTaxPercentage] = useState<number | null>(null); // Primary state for tax percentage

  // Effect to fetch global tax settings
  useEffect(() => {
    if (!user || !supabase) {
      setIsLoadingTaxSettings(false);
      return;
    }

    const fetchTaxSettings = async () => {
      setIsLoadingTaxSettings(true);
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
          setInvoiceTaxLabel(data.tax_name || 'Tax'); // Set invoiceTaxLabel
          setCurrencyCode(data.currency_code || 'USD'); // Store currency code in state
        }
        setIsLoadingTaxSettings(false);
      } catch (e) {
        console.error('Exception fetching tax settings:', e);
        setIsLoadingTaxSettings(false);
      }
    };

    fetchTaxSettings();
  }, [user, supabase]);

  // EFFECT: Synchronize global/invoice-specific tax rates with the form's taxPercentage
  useEffect(() => {
    const rateToApply = taxPercentage !== null ? taxPercentage : globalTaxRatePercent;
    // Ensure rateToApply is a number before setting it, default to 0 otherwise
    const numericRateToApply = (typeof rateToApply === 'number' && !isNaN(rateToApply)) ? rateToApply : 0;
    setValue('taxPercentage', numericRateToApply, { shouldValidate: true, shouldDirty: true });
  }, [taxPercentage, globalTaxRatePercent, setValue]);

  const selectDiscountTypeSheetRef = useRef<SelectDiscountTypeSheetRef>(null); // Ref for new sheet
  const editInvoiceTaxSheetRef = useRef<EditInvoiceTaxSheetRef>(null); // New ref for tax sheet
  const makePaymentSheetRef = useRef<MakePaymentSheetRef>(null); // Ref for new sheet
  const invoicePreviewModalRef = useRef<InvoicePreviewModalRef>(null); // Ref for preview modal

  const handlePresentSelectDiscountTypeSheet = () => {
    // Pass current discount values to pre-fill the modal if needed
    const currentDiscountType = getValues('discountType');
    const currentDiscountValue = getValues('discountValue');
    selectDiscountTypeSheetRef.current?.present(
      currentDiscountType,
      currentDiscountValue
    );
  };

  const handleApplyDiscountFromSheet = (data: DiscountData) => {
    console.log('Apply Discount from sheet:', data);
    // Update form values with data from discount sheet
    const numericDiscountValue = data.discountValue ? parseFloat(data.discountValue.replace(',', '.')) : null;

    setValue('discountType', data.discountType, { shouldValidate: true, shouldDirty: true });
    setValue('discountValue', numericDiscountValue, { shouldValidate: true, shouldDirty: true }); // Use parsed numeric value
    // The useEffect for total calculation will pick up these changes
  };

  const handleSelectDiscountTypeSheetClose = () => {
    console.log("SelectDiscountTypeSheet has been closed.");
    // Add any other logic needed when the discount sheet is closed by the user
  };

  const handlePresentEditInvoiceTaxSheet = () => {
    // For now, present with null/undefined as the EditInvoiceTaxSheet expects discount-like props
    // This will be updated when EditInvoiceTaxSheet is refactored for tax name and rate
    const initialName = invoiceTaxLabel !== null ? invoiceTaxLabel : globalTaxName;
    const initialRate = taxPercentage !== null ? taxPercentage : globalTaxRatePercent;
    editInvoiceTaxSheetRef.current?.present(initialName, initialRate);
  };

  const handleEditTaxSheetSave = (data: InvoiceTaxData) => {
    // InvoiceTaxData from EditInvoiceTaxSheet.tsx has taxName and taxRate (string)
    setInvoiceTaxLabel(data.taxName || 'Tax'); // Update the main tax label state
    const rate = parseFloat(data.taxRate.replace(',', '.')); // Ensure comma is handled
    setTaxPercentage(isNaN(rate) ? null : rate); // Update the main tax percentage state
  };

  const handleMakePaymentSheetSave = async (data: PaymentData) => {
    console.log('MakePaymentSheet Save:', data);
    const newPayment: RecordedPayment = {
      id: `payment_${new Date().toISOString()}_${Math.random().toString(36).substring(2, 9)}`,
      amount: parseFloat(data.paymentAmount),
      method: data.paymentMethod,
      date: new Date(),
    };
    setRecordedPayments(prevPayments => [...prevPayments, newPayment]);
    
    // Log the payment activity if we have an invoice ID
    if (currentInvoiceId || editInvoiceId) {
      const invoiceId = currentInvoiceId || editInvoiceId;
      const invoiceNumber = getValues('invoice_number');
      await logPaymentAdded(
        invoiceId!, 
        invoiceNumber || undefined, 
        newPayment.amount, 
        newPayment.method
      );
    }
    
    makePaymentSheetRef.current?.dismiss(); // Close the sheet after saving
  };

  const handleMakePaymentSheetClose = () => {
    console.log('Closing Make Payment Sheet');
  };

  // Function to open the payment sheet with current totals
  const handleOpenPaymentSheet = () => {
    console.log('[handleOpenPaymentSheet] Opening payment sheet with total:', displayInvoiceTotal, 'paid:', totalPaidAmount);
    makePaymentSheetRef.current?.present(displayInvoiceTotal, totalPaidAmount);
  };

  // Compute displayed tax values, prioritizing invoice-specific, then global
  const displayTaxName = invoiceTaxLabel !== null ? invoiceTaxLabel : globalTaxName;
  const displayTaxRatePercent = taxPercentage !== null ? taxPercentage : globalTaxRatePercent;

  const handleRemoveItem = (itemId: string) => {
    console.log('[handleRemoveItem] Attempting to remove itemId:', itemId);
    const currentItems = getValues('items') || [];
    console.log('[handleRemoveItem] currentItems from getValues:', JSON.stringify(currentItems));
    const updatedItems = currentItems.filter(item => item.id !== itemId);
    console.log('[handleRemoveItem] updatedItems after filter:', JSON.stringify(updatedItems));
    setValue('items', updatedItems, { shouldValidate: true, shouldDirty: true });
    console.log('[handleRemoveItem] Called setValue with updatedItems.');
  };

  // Render function for the visible part of the list item
  const renderVisibleItem = (data: { item: InvoiceLineItem, index: number }) => {
    const { item, index } = data;
    const isFirstItem = index === 0;
    const isLastItem = index === currentInvoiceLineItems.length - 1;
    return (
      <View style={[
        styles.invoiceItemRow, 
        { backgroundColor: themeColors.card }, // Ensure background for swipe visibility
        isFirstItem && { borderTopWidth: 0 },
        isLastItem && { borderBottomWidth: 0 }
      ]}>
        <Text style={styles.invoiceItemCombinedInfo} numberOfLines={1} ellipsizeMode="tail">
          <Text style={styles.invoiceItemNameText}>{item.item_name} </Text>
          <Text style={styles.invoiceItemQuantityText}>(x{item.quantity})</Text>
        </Text>
        <Text style={styles.invoiceItemTotalText}>
          {getCurrencySymbol(currencyCode)}{Number(item.total_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      </View>
    );
  };

  // Render function for the hidden part of the list item (Remove button)
  const renderHiddenItem = (data: { item: InvoiceLineItem, index: number }, rowMap: any) => {
    const { item } = data;
    return (
      <View style={styles.rowBack}>
        <TouchableOpacity
          style={[styles.backRightBtn, styles.backRightBtnRight]}
          onPress={() => {
            console.log('[renderHiddenItem] Remove button pressed for item:', item.id);
            handleRemoveItem(item.id);
            // Optionally close the row
            if (rowMap[item.id]) {
              rowMap[item.id].closeRow();
            }
          }}
        >
          <Trash2 size={22} color={themeColors.card} /> 
          <Text style={{ color: themeColors.card, marginLeft: 8, fontSize: 15, fontWeight: '500' }}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const { paymentOptions: paymentOptionsData, loading: paymentOptionsLoading, error: paymentOptionsError } = usePaymentOptions();

  const handlePaymentMethodToggle = (methodKey: 'stripe' | 'paypal' | 'bank_account', newValue: boolean) => {
    const currentPaymentSettings = paymentOptionsData;

    if (newValue === true && currentPaymentSettings) { // Check only when toggling ON and paymentOptionsData are loaded
      let isEnabledInSettings = false;
      let settingName = '';

      if (methodKey === 'stripe') {
        isEnabledInSettings = currentPaymentSettings.stripe_enabled === true;
        settingName = 'Pay With Card (Stripe)';
      } else if (methodKey === 'paypal') {
        isEnabledInSettings = currentPaymentSettings.paypal_enabled === true;
        settingName = 'PayPal';
      } else if (methodKey === 'bank_account') {
        isEnabledInSettings = currentPaymentSettings.bank_transfer_enabled === true;
        // Assuming 'bank_transfer_enabled' is the correct field in payment_options table
        settingName = 'Bank Transfer';
      }

      if (!isEnabledInSettings) {
        Alert.alert(
          'Payment Method Disabled',
          `${settingName} is not enabled in your Payment Options. Please update your settings to use this method.`,
          [{ text: 'OK' }]
        );
        return; // Prevent toggling ON
      }
    }

    // Update react-hook-form state directly
    const formKey = `${methodKey}_active_on_invoice` as keyof InvoiceFormData;
    setValue(formKey, newValue, { shouldValidate: true, shouldDirty: true });

    // // Original code that updated local state, now replaced by setValue above
    // setInvoiceDetails((prev: InvoiceFormData) => ({
    //   ...prev,
    //   [`${methodKey}_active_on_invoice`]: newValue,
    // }));
  };

  const iconStyle = {
    width: 49.152, // Reduced from 61.44 (61.44 * 0.8)
    height: 32.768, // Reduced from 40.96 (40.96 * 0.8)
    marginLeft: 6,
    resizeMode: 'contain' as 'contain', // Type assertion for resizeMode
  };

  const mastercardSpecificStyle = {
    ...iconStyle, // Inherit base styles
    marginLeft: 2, // Reduced margin for the Mastercard icon to bring it closer to Visa
  };

  const [defaultNotesFetched, setDefaultNotesFetched] = useState(false); // New state

  useEffect(() => {
    if (!editInvoiceId && !defaultNotesFetched && !getValues('notes') && user && supabase) {
      const fetchDefaultNotes = async () => {
        try {
          console.log('[CreateInvoiceScreen] Fetching default notes for user:', user.id);
          const { data: paymentOptionsData, error: paymentOptionsError } = await supabase
            .from('payment_options')
            .select('invoice_terms_notes')
            .eq('user_id', user.id)
            .single();

          if (paymentOptionsError && paymentOptionsError.code !== 'PGRST116') {
            console.error('Error fetching default notes:', paymentOptionsError.message);
          } else if (paymentOptionsData && paymentOptionsData.invoice_terms_notes) {
            console.log('[CreateInvoiceScreen] Default notes fetched:', paymentOptionsData.invoice_terms_notes);
            setValue('notes', paymentOptionsData.invoice_terms_notes || '');
          }
        } catch (e: any) {
          console.error('Exception fetching default notes:', e.message);
        } finally {
          setDefaultNotesFetched(true);
        }
      };
      fetchDefaultNotes();
    }
  }, [user, supabase, editInvoiceId, defaultNotesFetched, setValue, getValues]); // Fixed dependency array

  // Function to populate form with loaded invoice data
  const populateFormWithInvoiceData = async (invoiceData: any) => {
    console.log('[populateFormWithInvoiceData] Starting data population');
    
    try {
      // 1. Populate basic invoice fields
      setValue('invoice_number', invoiceData.invoice_number || '');
      setValue('invoice_date', invoiceData.invoice_date ? new Date(invoiceData.invoice_date) : new Date());
      setValue('due_date', invoiceData.due_date ? new Date(invoiceData.due_date) : null);
      setValue('due_date_option', invoiceData.due_date_option || 'due_on_receipt');
      setValue('po_number', invoiceData.po_number || '');
      setValue('custom_headline', invoiceData.custom_headline || '');
      setValue('notes', invoiceData.notes || '');
      
      // 2. Populate financial fields
      setValue('taxPercentage', invoiceData.tax_percentage || 0);
      setValue('invoice_tax_label', invoiceData.invoice_tax_label || 'Tax');
      setValue('discountType', invoiceData.discount_type || null);
      setValue('discountValue', invoiceData.discount_value || 0);
      setValue('subTotalAmount', invoiceData.subtotal_amount || 0);
      setValue('totalAmount', invoiceData.total_amount || 0);
      
      // 3. Populate payment method toggles
      setValue('stripe_active_on_invoice', invoiceData.stripe_active || false);
      setValue('paypal_active_on_invoice', invoiceData.paypal_active || false);
      setValue('bank_account_active_on_invoice', invoiceData.bank_account_active || false);
      
      // 4. Set client information
      if (invoiceData.clients) {
        const clientInfo = {
          id: invoiceData.clients.id,
          name: invoiceData.clients.name
        };
        setSelectedClient(clientInfo);
        setValue('client_id', clientInfo.id);
        console.log('[populateFormWithInvoiceData] Client set:', clientInfo);
      }
      
      // 5. Transform and populate line items
      if (invoiceData.invoice_line_items && invoiceData.invoice_line_items.length > 0) {
        const transformedLineItems: InvoiceLineItem[] = invoiceData.invoice_line_items.map((dbItem: any) => ({
          id: dbItem.id, // Use database ID for existing items
          user_saved_item_id: dbItem.user_saved_item_id,
          item_name: dbItem.item_name,
          description: dbItem.item_description,
          quantity: dbItem.quantity,
          unit_price: dbItem.unit_price,
          total_price: dbItem.total_price,
          line_item_discount_type: dbItem.line_item_discount_type,
          line_item_discount_value: dbItem.line_item_discount_value,
          item_image_url: dbItem.item_image_url
        }));
        
        setValue('items', transformedLineItems);
        console.log('[populateFormWithInvoiceData] Line items populated:', transformedLineItems.length);
      }
      
      // 6. Update invoice details state for UI display
      const dueDateDisplayLabel = getDueDateDisplayLabel(invoiceData.due_date_option, invoiceData.due_date);
      setInvoiceDetails({
        invoiceNumber: invoiceData.invoice_number || '',
        creationDate: invoiceData.invoice_date ? new Date(invoiceData.invoice_date) : new Date(),
        dueDateType: invoiceData.due_date_option || 'on_receipt',
        customDueDate: invoiceData.due_date ? new Date(invoiceData.due_date) : null,
        poNumber: invoiceData.po_number || '',
        customHeadline: invoiceData.custom_headline || '',
        dueDateDisplayLabel: dueDateDisplayLabel
      });
      
      // 7. Set other states
      setInvoiceTaxLabel(invoiceData.invoice_tax_label || 'Tax');
      setTaxPercentage(invoiceData.tax_percentage || null);
      
      // 8. Populate recorded payments if they exist
      if (invoiceData.paid_amount && invoiceData.paid_amount > 0) {
        const existingPayment: RecordedPayment = {
          id: `existing_payment_${invoiceData.id}`,
          amount: invoiceData.paid_amount,
          method: invoiceData.payment_notes || 'Payment',
          date: invoiceData.payment_date ? new Date(invoiceData.payment_date) : new Date()
        };
        setRecordedPayments([existingPayment]);
        console.log('[populateFormWithInvoiceData] Populated existing payment:', existingPayment);
      }
      
      console.log('[populateFormWithInvoiceData] Form population completed successfully');
      
    } catch (error: any) {
      console.error('[populateFormWithInvoiceData] Error populating form:', error);
      setLoadingError(`Failed to populate form: ${error.message}`);
    }
  };

  // Helper function to get due date display label
  const getDueDateDisplayLabel = (dueDateOption: string | null, dueDate: string | null): string => {
    const friendlyOptions: { [key: string]: string } = {
      'on_receipt': 'Due on receipt',
      'net_7': 'Due in 7 days',
      'net_14': 'Due in 14 days',
      'net_30': 'Due in 30 days',
    };

    if (dueDateOption && friendlyOptions[dueDateOption]) {
      return friendlyOptions[dueDateOption];
    }

    if (dueDate) {
      const date = new Date(dueDate);
      return formatFriendlyDate(date);
    }

    return 'Due on receipt';
  };

  return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBackgroundColor }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0} // Adjust offset if header is present
      >
        <Stack.Screen
          options={{
            headerTitle: isEditMode ? 'Edit Invoice' : '', 
            headerTitleAlign: 'left', 
            headerBackTitle: 'Back', 
            headerTitleStyle: { 
              fontFamily: 'Inter-Bold', 
              fontSize: 20,
              color: themeColors.foreground, 
            },
            headerStyle: {
              backgroundColor: themeColors.card,
              ...(Platform.OS === 'ios' ? {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.10, 
                shadowRadius: 2.00,
              } : {
                elevation: 2, // Android shadow
              }),
            }, 
            headerTintColor: '#000000', 
            headerShadowVisible: false, // Keep this false to use our custom shadow from headerStyle
          }}
        />
        
        {/* Loading state for edit mode */}
        {isEditMode && isLoadingInvoice && (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center',
            backgroundColor: screenBackgroundColor 
          }}>
            <Text style={{ 
              color: themeColors.foreground, 
              fontSize: 16, 
              marginBottom: 12 
            }}>
              Loading invoice...
            </Text>
            <Text style={{ 
              color: themeColors.mutedForeground, 
              fontSize: 14 
            }}>
              ID: {editInvoiceId}
            </Text>
          </View>
        )}

        {/* Error state for edit mode */}
        {isEditMode && loadingError && !isLoadingInvoice && (
          <View style={{ 
            flex: 1, 
            justifyContent: 'center', 
            alignItems: 'center',
            backgroundColor: screenBackgroundColor,
            padding: 20
          }}>
            <Text style={{ 
              color: themeColors.destructive, 
              fontSize: 16, 
              marginBottom: 12,
              textAlign: 'center'
            }}>
              Failed to load invoice
            </Text>
            <Text style={{ 
              color: themeColors.mutedForeground, 
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 20
            }}>
              {loadingError}
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: themeColors.primary,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 8
              }}
            >
              <Text style={{ color: themeColors.primaryForeground }}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Main form content - hide when loading or error in edit mode */}
        {(!isEditMode || (!isLoadingInvoice && !loadingError)) && (
        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }} // Add some padding at the bottom
          keyboardShouldPersistTaps="handled"
        >
          {/* --- NEW DETAILS SECTION --- */}
          <TouchableOpacity onPress={openEditInvoiceDetailsModal} activeOpacity={0.7}>
            <View style={styles.newDetailsSectionContainer}>
              <View style={styles.detailsRow1}>
                <View style={styles.invoiceNumberEditContainer}>
                  <Text style={[styles.invoiceNumberDisplay, { color: themeColors.foreground }]}>
                    {watchedInvoiceNumber || `INV001`}
                  </Text>
                </View>
                <Text style={{ color: themeColors.foreground, fontWeight: 'bold' }}>
                  {`${invoiceDetails?.dueDateDisplayLabel || 'Set Due Date'}`}
                </Text>
              </View>
              <View style={styles.detailsRow2}>
                <Text style={[styles.subLabel, { color: themeColors.mutedForeground }]}>Creation Date</Text>
                <Text style={[styles.dateDisplay, { color: themeColors.mutedForeground, fontWeight: 'normal' }]}>
                  {formatFriendlyDate(watchedInvoiceDate)}
                </Text>
              </View>
            </View>

          </TouchableOpacity>

          {/* Client Section */}
          <FormSection title="CLIENT" themeColors={themeColors}>
            {selectedClient ? (
              <View style={styles.selectedClientContainer}>
                <Text style={styles.selectedClientName}>{selectedClient.name}</Text>
                <TouchableOpacity onPress={openNewClientSelectionSheet}>
                  <Text style={styles.changeClientText}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={openNewClientSelectionSheet} style={styles.clientSelector}>
                <PlusCircle size={22} color={themeColors.primary} />
                <Text style={styles.clientSelectorText}>Add Client</Text>
              </TouchableOpacity>
            )}
          </FormSection>

          {/* Items Section */}
          <FormSection title="ITEMS" themeColors={themeColors} noPadding={currentInvoiceLineItems.length > 0}> 
            {currentInvoiceLineItems.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 16 }}> 
                <TouchableOpacity 
                  style={styles.addItemButtonInline} 
                  onPress={() => addItemSheetRef.current?.present()}
                >
                  <PlusCircle size={20} color={themeColors.primary} style={styles.addItemButtonIcon} />
                  <Text style={styles.addItemButtonText}>Add Item or Service</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <SwipeListView
                data={currentInvoiceLineItems}
                renderItem={renderVisibleItem}
                renderHiddenItem={renderHiddenItem}
                rightOpenValue={-110} // Width of the remove button area
                disableRightSwipe
                keyExtractor={(item) => item.id}
                style={[
                  styles.swipeListStyle, 
                  currentInvoiceLineItems.length > 0 && {
                    borderRadius: 10,
                    backgroundColor: themeColors.card // SwipeListView acts as the card background
                  }
                ]}
                contentContainerStyle={styles.swipeListContentContainer}
                useNativeDriver={false} // Recommended for SwipeListView if issues occur with animations
                closeOnRowPress={true}
                closeOnScroll={true}
                closeOnRowBeginSwipe={true}
                scrollEnabled={false} // Disable scrolling to prevent nesting conflict with parent ScrollView
              />
            )}
            {/* Always show 'Add Item or Service' button below the list if items exist */}
            {currentInvoiceLineItems.length > 0 && (
              <TouchableOpacity 
                style={styles.addItemButtonFullWidth} 
                onPress={() => addItemSheetRef.current?.present()}
              >
                <PlusCircle size={20} color={themeColors.primary} style={styles.addItemButtonIcon} />
                <Text style={styles.addItemButtonText}>Add Another Item or Service</Text>
              </TouchableOpacity>
            )}
          </FormSection>

          {/* Payment Details Section */}
          <FormSection title="SUMMARY" themeColors={themeColors}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryText}>{getCurrencySymbol(currencyCode)}{Number(displaySubtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
            </View>
            <ActionRow 
              label={
                watchedDiscountType === 'percentage' && watchedDiscountValue && watchedDiscountValue > 0 
                  ? `Discount ${watchedDiscountValue}%` 
                  : watchedDiscountType === 'fixed' && watchedDiscountValue && watchedDiscountValue > 0
                    ? 'Discount'
                    : watchedDiscountType // If a type is set but value might be 0 or null
                      ? 'Edit Discount'
                      : 'Add Discount' // Cleaner prompt
              }
              value={
                displayDiscountAmount > 0 
                  ? `- ${getCurrencySymbol(currencyCode)}${Number(displayDiscountAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : '' // Empty if no discount applied
              }
              onPress={handlePresentSelectDiscountTypeSheet} 
              icon={Percent} 
              themeColors={themeColors} 
              showChevron={!watchedDiscountType} // Show chevron only if no discountType is set
            />
            {!isLoadingTaxSettings && globalTaxRatePercent !== null && (
              <>
                <View style={styles.separator} />
                <ActionRow
                  label={
                    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                      <Text style={styles.labelStyle}>{invoiceTaxLabel || 'Tax'} </Text>
                      {watchedTaxPercentage !== null && (
                        <Text style={styles.taxPercentageStyle}>({watchedTaxPercentage}%)</Text>
                      )}
                    </View>
                  }
                  value={displayTaxAmount > 0 ? `${getCurrencySymbol(currencyCode)}${Number(displayTaxAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${getCurrencySymbol(currencyCode)}0.00`}
                  icon={Percent}
                  themeColors={themeColors}
                  onPress={handlePresentEditInvoiceTaxSheet}
                  showChevron={displayTaxAmount <= 0}
                />
              </>
            )}
            <View style={styles.separator} />
            <ActionRow
              label="Add Payment"
              value={totalPaidAmount > 0 ? `${getCurrencySymbol(currencyCode)}${Number(totalPaidAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid` : ''}
              onPress={handleOpenPaymentSheet}
              icon={CreditCard}
              themeColors={themeColors}
              showChevron={totalPaidAmount <= 0}
            />
            <View style={[styles.summaryRow, { borderBottomWidth: 0, marginTop: 5 }]}>
              <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 17 }]}>
                {totalPaidAmount > 0 ? 'Balance Due' : 'Total'}
              </Text>
              <Text style={[styles.summaryText, { fontWeight: 'bold', fontSize: 17 }]}>
                {getCurrencySymbol(currencyCode)}{Number(displayInvoiceTotal - totalPaidAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          </FormSection>

          <FormSection title="PAYMENT METHODS" themeColors={themeColors}>
            <ActionRow
              label={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: themeColors.foreground, fontSize: 16 }}>Pay With Card</Text>
                  <Image source={require('../../../../assets/visaicon.png')} style={iconStyle} />
                  <Image source={require('../../../../assets/mastercardicon.png')} style={mastercardSpecificStyle} />
                </View>
              }
              icon={CreditCard}
              themeColors={themeColors} 
              showSwitch={true}
              switchValue={getValues('stripe_active_on_invoice')}
              onSwitchChange={(newValue) => handlePaymentMethodToggle('stripe', newValue)}
              onPress={() => handlePaymentMethodToggle('stripe', !getValues('stripe_active_on_invoice'))}
            />
            <ActionRow
              label={
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: themeColors.foreground, fontSize: 16 }}>PayPal</Text>
                  <Image source={require('../../../../assets/paypalicon.png')} style={iconStyle} />
                </View>
              }
              icon={Banknote} 
              themeColors={themeColors} 
              showSwitch={true}
              switchValue={getValues('paypal_active_on_invoice')}
              onSwitchChange={(newValue) => handlePaymentMethodToggle('paypal', newValue)}
              onPress={() => handlePaymentMethodToggle('paypal', !getValues('paypal_active_on_invoice'))}
            />
            <ActionRow
              label="Bank Transfer"
              icon={Landmark} 
              themeColors={themeColors} 
              showSwitch={true}
              switchValue={getValues('bank_account_active_on_invoice')}
              onSwitchChange={(newValue) => handlePaymentMethodToggle('bank_account', newValue)}
              onPress={() => handlePaymentMethodToggle('bank_account', !getValues('bank_account_active_on_invoice'))}
            />
          </FormSection>

          <FormSection title="" themeColors={themeColors}>
            <TouchableOpacity onPress={handlePreviewInvoice} style={styles.changeDesignSelector}>
              <Palette size={20} color={themeColors.primary} style={styles.changeDesignIcon} />
              <Text style={styles.changeDesignText}>Change Invoice Design</Text>
            </TouchableOpacity>
          </FormSection>

          <FormSection title="OTHER SETTINGS" themeColors={themeColors}>
            <ActionRow
              label="Add images & PDFs (0)"
              onPress={() => console.log('Add Attachments pressed')} 
              icon={Paperclip}
              themeColors={themeColors} 
              showChevron={false} // This is more of an action button
            />
            <TextInput
              style={styles.notesInput}
              placeholder="Comments will appear at the bottom of your invoice"
              placeholderTextColor={themeColors.mutedForeground}
              multiline
              value={watch('notes') || ''}
              onChangeText={(text) => setValue('notes', text)}
              textAlignVertical="top"
            />
          </FormSection>

        </ScrollView>
        )}

        {/* Full Width Save Button - Not in a separate container */}
        <TouchableOpacity onPress={handleSubmit(handleSaveInvoice)} style={[styles.bottomSaveButton, isSavingInvoice && styles.disabledButton]} disabled={isSavingInvoice}>
          <Text style={styles.bottomSaveButtonText}>
            {isSavingInvoice 
              ? (isEditMode ? 'Saving...' : 'Saving...') 
              : (isEditMode ? 'Save' : 'Save Invoice')
            }
          </Text>
        </TouchableOpacity>

        {/* Add Item Bottom Sheet Modal */}
        <AddItemSheet 
          ref={addItemSheetRef} 
          onItemFromFormSaved={handleItemFromSheetSaved}
          currencyCode={currencyCode}
        />

        <NewClientSelectionSheet
          ref={newClientSheetRef}
          onClientSelect={handleClientSelect}
          onClose={() => console.log('New client sheet closed')}
        />

        <DateTimePickerModal
          isVisible={isDatePickerVisible}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={hideDatePicker}
          date={invoiceDate || new Date()} // Set initial date for the picker
        />

        <EditInvoiceDetailsSheet
          ref={editInvoiceDetailsSheetRef}
          initialDetails={{
            invoiceNumber: watchedInvoiceNumber || 'INV001',
            creationDate: watchedInvoiceDate || new Date(),
            dueDateType: watchedDueDateOption || 'on_receipt',
            customDueDate: watchedDueDate,
            poNumber: watchedPoNumber || '',
            customHeadline: watchedCustomHeadline || '',
            dueDateDisplayLabel: invoiceDetails?.dueDateDisplayLabel || 'Due on receipt',
          }}
          onSave={handleSaveDetailsFromModal} // Handle save action
        />

        <SelectDiscountTypeSheet
          ref={selectDiscountTypeSheetRef}
          onApply={handleApplyDiscountFromSheet}
          onClose={handleSelectDiscountTypeSheetClose}
        />

        <EditInvoiceTaxSheet 
          ref={editInvoiceTaxSheetRef}
          onSave={handleEditTaxSheetSave} // Placeholder save handler
          onClose={() => console.log('Edit invoice tax sheet closed')}
        />

        <MakePaymentSheet 
          ref={makePaymentSheetRef}
          onSave={handleMakePaymentSheetSave}
          onClose={handleMakePaymentSheetClose}
          invoiceTotal={displayInvoiceTotal} // Use actual total
          previouslyPaidAmount={totalPaidAmount} // Use actual paid amount
        />

        {/* Invoice Preview Modal */}
        <InvoicePreviewModal
          ref={invoicePreviewModalRef}
          invoiceData={previewData?.invoiceData}
          businessSettings={previewData?.businessSettings}
          clientData={previewData?.clientData}
          invoiceId={currentInvoiceId || undefined}
          onClose={() => setPreviewData(null)}
        />
      </KeyboardAvoidingView>
      </SafeAreaView>
  );
}

// Styles need to be a function that accepts themeColors
const getStyles = (themeColors: ThemeColorPalette) => {
  // Explicitly type problematic style objects to ensure ViewStyle compatibility for shadows
  const headerPreviewButtonStyle: ViewStyle = {
    marginRight: 0, // Set to 0 to align as far right as possible within header constraints
    backgroundColor: '#FFD700', // Gold/Yellow color - consider adding to theme colors
    paddingVertical: 6, 
    paddingHorizontal: 12,
    borderRadius: 18, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.20,
    shadowRadius: 1.5,
    elevation: 3,
  };

  return StyleSheet.create({
    container: {
      flex: 1,
      // backgroundColor is now set dynamically
    },
    inputContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border, // Use themeColors here
    },
    inputRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border, // Use themeColors here
    },
    label: {
      fontSize: 16,
      // color is set dynamically by inline style or here if needed
    },
    input: {
      flex: 1,
      textAlign: 'right',
      fontSize: 16,
      marginLeft: 10, // Add some space between label and input
      // color is set dynamically by inline style or here if needed
    },
    addItemButton: {
      flexDirection: 'row',
      alignItems: 'center',
      // justifyContent: 'center', // Center if it's the only thing in its section card
      paddingVertical: 16, // Keep consistent padding
      borderTopWidth: StyleSheet.hairlineWidth, // Optional: if items list is above
      borderTopColor: themeColors.border, // Use themeColors here
    },
    placeholderText: {
      fontSize: 15,
      textAlign: 'center',
      paddingVertical: 20,
      color: themeColors.mutedForeground, 
    },
    notesInput: {
      minHeight: 80,
      fontSize: 16,
      paddingTop: Platform.OS === 'ios' ? 10 : 0, // Adjust paddingTop for better text alignment
      paddingBottom: 10,
      backgroundColor: themeColors.background, // Replaced inputBackground
      color: themeColors.foreground, 
    },
    summaryText: {
      fontSize: 16,
      textAlign: 'right',
      // color is set dynamically by inline style or here if needed
    },
    bottomSheetContentContainer: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 10, // Reduced top padding for a tighter look
      // backgroundColor: themeColors.card, // Background is set by BottomSheetModal component itself
    },
    bottomSheetTitle: {
      fontSize: 20, // Slightly smaller title for the sheet
      fontWeight: 'bold',
      marginBottom: 20,
      textAlign: 'center',
      color: themeColors.foreground, // Use themeColors here
    },
    modalInput: {
      borderWidth: 1,
      borderColor: themeColors.border, // Use themeColors here
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 16,
      marginBottom: 15, 
      backgroundColor: themeColors.background, // Replaced inputBackground
      color: themeColors.foreground, // Use themeColors here
    },
    modalRowInputContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 15,
    },
    modalInputHalf: {
      width: '48%', 
      marginBottom: 0, 
    },
    modalInputMultiline: {
      minHeight: 80, 
      textAlignVertical: 'top',
    },
    formButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 20,
      borderRadius: 10, 
      minHeight: 48, 
      // backgroundColor will be set by inline style based on variant
    },
    formButtonText: {
      fontSize: 17,
      fontWeight: '600', 
      // color will be set by inline style based on variant
    },
    actionRowContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    actionRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionRowIcon: {
      marginRight: 12,
    },
    actionRowLabel: {
      fontSize: 16,
      // Default color can be foreground, primary if pressable
    },
    actionRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    actionRowValue: {
      fontSize: 16,
      color: themeColors.foreground,
      flexShrink: 1, // Allows text to shrink and wrap if necessary
      textAlign: 'right',
    },
    valueText: {
      fontSize: 16,
      color: themeColors.foreground,
      flexShrink: 1, // Allows text to shrink and wrap if necessary
      textAlign: 'right',
    },
    editableTextInput: { // Style for the editable invoice number
      // Add any specific styling for editable text input here, e.g., borderBottomWidth
      paddingVertical: Platform.OS === 'ios' ? 8 : 4, // Adjust padding for better text alignment
      textAlignVertical: 'center', // Android
    },
    invoiceNumberContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    newDetailsSectionContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: themeColors.card, // Or themeColors.background if no card look
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
      marginBottom: 12, // Space before next section
    },
    detailsRow1: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    invoiceNumberEditContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1, // Allow it to take space
    },
    invoiceNumberDisplay: {
      fontSize: 28, // Larger font size
      fontWeight: 'bold',
      marginRight: 8,
      // color set inline
      paddingVertical: 0, // Remove default padding if any
    },
    duePill: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 15,
      // backgroundColor set inline
    },
    duePillText: {
      color: themeColors.primaryForeground, // White text on primary background
      fontSize: 13,
      fontWeight: '600',
    },
    detailsRow2: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingLeft: 2, // Slight indent for 'Details' if needed
    },
    subLabel: {
      fontSize: 14,
      // color set inline
    },
    dateDisplay: {
      fontSize: 14,
      // color set inline
    },
    staticActionRowContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16, // Add horizontal padding consistent with ActionRow
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    staticActionRowLabel: {
      fontSize: 16,
      color: themeColors.foreground, // Default color
    },
    staticActionRowValue: {
      fontSize: 16,
      color: themeColors.mutedForeground, // Muted color for the value
    },
    emptySectionPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      paddingHorizontal: 16,
      // backgroundColor: themeColors.card, // Removed, provided by FormSection
      // borderRadius: 12, // Removed, provided by FormSection
      // borderWidth: 1, // Removed, provided by FormSection
      // borderColor: themeColors.border, // Removed, provided by FormSection
      // marginTop: 8, // Removed, spacing handled by FormSection
    },
    emptySectionText: {
      fontSize: 16,
      color: themeColors.mutedForeground,
      marginTop: 12, // Add some space if button is above
    },
    addItemButtonInline: { // For the button when no items are present
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      paddingHorizontal: 15,
      borderRadius: 8,
      backgroundColor: themeColors.secondary, // Replaced primaryMuted
      // marginTop: 16, // Removed, spacing handled differently now
    },
    addItemButtonFullWidth: { // For the button when items are present
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.secondary, // Replaced primaryMuted
      paddingVertical: 12,
      borderRadius: 8,
      marginTop: 12, // Spacing from the items list
    },
    addItemButtonIcon: {
      marginRight: 8,
    },
    addItemButtonText: {
      color: themeColors.primary, // Text color to match the icon
      fontSize: 17, // Updated to match clientSelectorText
      fontWeight: '500', // Updated to match clientSelectorText
    },
    clientSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center', // Center the 'Add Client' button
      paddingVertical: 12, // Add some padding to make it feel more like a button area
      // Background and border radius will come from FormSection's sectionContent
    },
    clientSelectorText: {
      marginLeft: 10,
      fontSize: 17,
      fontWeight: '500',
      color: themeColors.primary,
    },
    selectedClientContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8, // Adjust padding as needed
    },
    selectedClientName: {
      fontSize: 17,
      fontWeight: '600',
      color: themeColors.foreground,
    },
    changeClientText: {
      fontSize: 16,
      color: themeColors.primary,
      fontWeight: '500',
    },
    itemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    itemDetails: {
      flex: 1,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.foreground,
    },
    itemQuantityPrice: {
      fontSize: 14,
      color: themeColors.mutedForeground,
    },
    itemTotal: {
      fontSize: 16,
      color: themeColors.foreground,
      fontWeight: '600',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    summaryLabel: {
      fontSize: 16,
      color: themeColors.foreground,
    },
    bottomSaveButton: {
      backgroundColor: themeColors.primary,
      paddingVertical: 15, // Standard padding
      marginHorizontal: 16, // Side margins
      borderRadius: 12, // Consistent app border radius
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15, // Decreased to 15 to position button lower
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 3.00,
      elevation: 4,
    },
    bottomSaveButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 17,
      fontWeight: '600',
    },
    headerPreviewButton: headerPreviewButtonStyle, // Use the explicitly typed style
    headerPreviewButtonText: {
      color: '#000000', // Black text for yellow button
      fontSize: 14, 
      fontWeight: 'bold',
    },
    invoiceItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14, // Standard padding
      paddingHorizontal: 16, // Add horizontal padding to align with FormSection content
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    invoiceItemCombinedInfo: { // New style for the left part containing Name, Qty
      flex: 1,
      marginRight: 12, // Space before total price
      fontSize: 16, // Base font size for the line
      color: themeColors.foreground, // Default color for this combined text container
    },
    invoiceItemNameText: {
      fontWeight: '500', // Bold
      // Inherits color and fontSize from invoiceItemCombinedInfo or can be set explicitly
    },
    invoiceItemQuantityText: {
      fontWeight: 'normal',
      color: themeColors.mutedForeground, // Grey
      // Inherits fontSize or can be set, e.g., fontSize: 15 to be slightly smaller
    },
    invoiceItemTotalText: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.foreground,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: themeColors.border,
      marginLeft: 16, // Assuming ActionRow content (like icon) starts after 16px padding
    },
    chevron: {
      marginLeft: 'auto', // Push chevron to the right
    },
    hiddenItem: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: themeColors.destructive, // Corrected from 'danger'
      padding: 16,
    },
    rowBack: {
      alignItems: 'center',
      backgroundColor: themeColors.destructive, // Corrected from 'danger'
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end', // Align button to the right
      // borderRadius handled by SwipeListView style or item styles
    },
    backRightBtn: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      position: 'absolute',
      top: 0,
      width: 110, // Width of the hidden button area
      flexDirection: 'row', // To align icon and text
    },
    backRightBtnRight: {
      backgroundColor: themeColors.destructive, // Corrected from 'danger'
      right: 0,
      // borderRadius handled by SwipeListView style or item styles
    },
    swipeListStyle: {
      // This style applies to the SwipeListView container itself
      overflow: 'hidden', // Important for borderRadius to work on children
    },
    swipeListContentContainer: {
      // If currentInvoiceLineItems.length > 0, no bottom padding as 'Add Another Item' button acts as footer
      paddingBottom: 0, 
    },
    formSectionNoPaddingChildFix: {
      // When FormSection has noPadding, and it's the only item
      // This style is no longer needed as SwipeListView handles rounding
    },
    paymentLineItem: { // Style for payment line items
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 10, // Adjust as needed
      paddingHorizontal: 0, // No extra horizontal padding, FormSection handles it
    },
    paymentText: {
      fontSize: 15,
      color: themeColors.foreground,
    },
    paymentDateText: {
      fontSize: 13,
      color: themeColors.mutedForeground,
      marginTop: 2,
    },
    disabledButton: {
      opacity: 0.5,
    },
    labelStyle: { // Add this style for the main label part
      fontSize: 16,
      color: themeColors.foreground,
      fontWeight: '500',
    },
    taxPercentageStyle: { // Add this style for the percentage part
      fontSize: 16, // Or a different size if you want it smaller/larger
      color: themeColors.mutedForeground, // Example: a muted color
      fontWeight: 'normal',
      marginLeft: 2,
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
      fontSize: 17,
      fontWeight: '500',
      color: themeColors.primary,
    },
  });
}
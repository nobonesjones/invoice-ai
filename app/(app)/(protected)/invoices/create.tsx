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
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { ChevronRight, PlusCircle, X as XIcon, Edit3, Info, Percent, CreditCard, Banknote, Paperclip } from 'lucide-react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import NewClientSelectionSheet, { Client as ClientType } from './NewClientSelectionSheet';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext'; // Added import
import { Controller, useForm } from 'react-hook-form'; // Import react-hook-form
import EditInvoiceDetailsSheet, { EditInvoiceDetailsSheetRef } from './EditInvoiceDetailsSheet'; // Correctly import named export
import AddItemSheet, { AddItemSheetRef } from './AddItemSheet'; // Correctly not importing NewItemData here
import { NewItemData } from './AddNewItemFormSheet'; // Import NewItemData type from AddNewItemFormSheet where it's defined
import { DUE_DATE_OPTIONS } from './SetDueDateSheet'; // Import DUE_DATE_OPTIONS
import DuplicateDiscountSheet, { DuplicateDiscountSheetRef, DiscountData } from './DuplicateDiscountSheet'; // Import new sheet
import EditInvoiceTaxSheet, { EditInvoiceTaxSheetRef, TaxData as InvoiceTaxData } from './EditInvoiceTaxSheet'; // Changed TaxData to InvoiceTaxData to avoid naming conflict if TaxData is used elsewhere
import { useSupabase } from '@/context/supabase-provider'; // Added useSupabase import

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
  items: InvoiceItem[];
  po_number?: string; // Added for PO Number
  custom_headline?: string; // Added for Custom Headline
  taxPercentage?: number | null;
  discountType?: 'percentage' | 'fixed' | null; // Made more specific
  discountValue?: number | null;
  subTotalAmount?: number;
  totalAmount?: number;
  // Add other fields as necessary, e.g., notes, discount, tax
}

interface InvoiceLineItem {
  id: string; // Unique ID for this line item instance on the invoice
  user_saved_item_id?: string | null; // Link to user_saved_items if it was saved
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number; // Calculated: quantity * unit_price
  // description?: string | null; // Optional: if you want to display description
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
const ActionRow = ({ label, onPress, icon: IconComponent, value, themeColors, showChevron = true }: 
  { 
    label: string, 
    onPress?: () => void, 
    icon?: React.ElementType, 
    value?: string, 
    themeColors: ThemeColorPalette,
    showChevron?: boolean
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

export default function CreateInvoiceScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const router = useRouter();
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility(); // Use context
  const { supabase, user } = useSupabase(); // Use Supabase context

  const [isSaveEnabled, setIsSaveEnabled] = useState(true); // Re-added for save button logic
  const [isMarkedAsPaid, setIsMarkedAsPaid] = useState(false); // Re-added for payment switch

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
      items: [],
      po_number: '', // Initialize po_number
      custom_headline: '', // Initialize custom_headline
      taxPercentage: 0,
      discountType: null, // Changed from '' to null
      discountValue: 0,
      subTotalAmount: 0,
      totalAmount: 0,
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
  const [selectedClientName, setSelectedClientName] = useState<string | null>(null);

  // --- Item State for Modal --- //
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [itemDescription, setItemDescription] = useState('');

  // --- Navigation and Params --- //
  const params = useLocalSearchParams<{ selectedClientId?: string; selectedClientName?: string }>();

  useEffect(() => {
    if (params.selectedClientId && params.selectedClientName) {
      setSelectedClientName(params.selectedClientName);
      // Optional: Clear params from URL after processing to avoid re-triggering if user navigates away and back
      // router.setParams({ selectedClientId: undefined, selectedClientName: undefined });
    }
  }, [params.selectedClientId, params.selectedClientName]);

  useEffect(() => {
    // Hide tab bar when this screen mounts
    setIsTabBarVisible(false);
    // Show tab bar when this screen unmounts
    return () => {
      setIsTabBarVisible(true);
    };
  }, [setIsTabBarVisible]);

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
    setSelectedClientName(client.name);
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

  const handleSaveInvoice = () => {
    console.log('Save Invoice');
  };

  const handlePreviewInvoice = () => {
    console.log('Preview Invoice');
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handlePreviewInvoice} style={styles.headerPreviewButton}>
          <Text style={styles.headerPreviewButtonText}>Preview Invoice</Text>
        </TouchableOpacity>
      ),
      headerLeft: () => null, // Explicitly remove any default left component (like a back arrow)
    });
  }, [navigation, themeColors, handlePreviewInvoice, styles]); // styles is now defined

  const screenBackgroundColor = isLightMode ? '#F0F2F5' : themeColors.background;

  // Function to generate initial details for the modal
  const getInitialModalDetails = () => {
    const values = getValues(); // Get current form values
    const defaultDueDateOption = DUE_DATE_OPTIONS.find(opt => opt.type === 'on_receipt');
    return {
      invoiceNumber: values.invoice_number || '',
      creationDate: values.invoice_date || new Date(),
      dueDateType: 'on_receipt', // Default due date type
      customDueDate: values.due_date, // Use form's due_date if available
      poNumber: values.po_number || '',
      customHeadline: values.custom_headline || '',
      dueDateDisplayLabel: defaultDueDateOption ? defaultDueDateOption.label : 'Due on receipt', // Explicitly set initial display label
    };
  };

  const [invoiceDetails, setInvoiceDetails] = useState<any>(getInitialModalDetails()); // Initialize invoiceDetails state here

  const watchedInvoiceNumber = watch('invoice_number');
  const watchedInvoiceDate = watch('invoice_date');
  const watchedDueDate = watch('due_date');
  const watchedPoNumber = watch('po_number'); 
  const watchedCustomHeadline = watch('custom_headline'); 
  const taxPercentage = watch('taxPercentage');
  const discountType = watch('discountType');
  const discountValue = watch('discountValue');

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

  const [currentInvoiceLineItems, setCurrentInvoiceLineItems] = useState<InvoiceLineItem[]>([]); // New state for line items

  // Callback to handle item data from AddItemSheet
  const handleItemFromSheetSaved = (itemDataFromSheet: NewItemData) => {
    console.log('Item data received in create.tsx:', itemDataFromSheet);
    
    const newLineItem: InvoiceLineItem = {
      id: itemDataFromSheet.id, // This is the temporary inv_item_xxx ID
      user_saved_item_id: itemDataFromSheet.saved_item_db_id || null,
      item_name: itemDataFromSheet.itemName,
      quantity: itemDataFromSheet.quantity,
      unit_price: itemDataFromSheet.price,
      total_price: itemDataFromSheet.quantity * itemDataFromSheet.price,
      // description: itemDataFromSheet.description, // Uncomment if needed for display
    };

    setCurrentInvoiceLineItems(prevItems => [...prevItems, newLineItem]);
    
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
    let taxCalcAmount = 0;
    if (taxPercentage && typeof taxPercentage === 'number' && taxPercentage > 0) {
      taxCalcAmount = displaySubtotal * (taxPercentage / 100);
    }
    setDisplayTaxAmount(taxCalcAmount);
    // setValue('taxAmount', taxCalcAmount); // Assuming taxAmount is just for display or not a direct form field being submitted

    let discountCalcAmount = 0;
    if (discountValue && typeof discountValue === 'number' && discountValue > 0) {
      if (discountType === 'percentage') {
        discountCalcAmount = displaySubtotal * (discountValue / 100);
      } else if (discountType === 'fixed') {
        discountCalcAmount = discountValue;
      }
    }
    // Ensure discount doesn't exceed subtotal + tax (or just subtotal if preferred)
    // For simplicity, capping at subtotal for now. Adjust if tax should be included before discount.
    discountCalcAmount = Math.min(discountCalcAmount, displaySubtotal + taxCalcAmount); 
    setDisplayDiscountAmount(discountCalcAmount);
    // setValue('discountAmountCalculated', discountCalcAmount); // If you have a field for the calculated discount amount

    const newTotal = displaySubtotal + taxCalcAmount - discountCalcAmount;
    setDisplayInvoiceTotal(newTotal);
    setValue('totalAmount', newTotal > 0 ? newTotal : 0, { shouldValidate: true, shouldDirty: true }); // Ensure total isn't negative

  }, [displaySubtotal, taxPercentage, discountType, discountValue, setValue]);

  // State for global tax settings
  const [globalTaxRatePercent, setGlobalTaxRatePercent] = useState<number | null>(null);
  const [globalTaxName, setGlobalTaxName] = useState<string | null>(null);
  const [isLoadingTaxSettings, setIsLoadingTaxSettings] = useState<boolean>(true);

  // State for invoice-specific tax override
  const [invoiceTaxName, setInvoiceTaxName] = useState<string | null>(null);
  const [invoiceTaxRatePercent, setInvoiceTaxRatePercent] = useState<number | null>(null);

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
          .select('default_tax_rate, tax_name')
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
        }
        setIsLoadingTaxSettings(false);
      } catch (e) {
        console.error('Exception fetching tax settings:', e);
        setIsLoadingTaxSettings(false);
      }
    };

    fetchTaxSettings();
  }, [user, supabase]);

  const duplicateDiscountSheetRef = useRef<DuplicateDiscountSheetRef>(null); // Ref for new sheet
  const editInvoiceTaxSheetRef = useRef<EditInvoiceTaxSheetRef>(null); // New ref for tax sheet

  const handlePresentDuplicateDiscountSheet = () => {
    // Pass current discount values to pre-fill the modal if needed
    const currentDiscountType = getValues('discountType');
    const currentDiscountValue = getValues('discountValue');
    duplicateDiscountSheetRef.current?.present(
      currentDiscountType,
      currentDiscountValue
    );
  };

  const handleSaveDuplicateDiscount = (data: DiscountData) => {
    console.log('Duplicate Discount to save:', data);
    // Update form values with data from discount sheet
    setValue('discountType', data.discountType, { shouldValidate: true, shouldDirty: true });
    setValue('discountValue', data.discountValue, { shouldValidate: true, shouldDirty: true });
    // The useEffect for total calculation will pick up these changes
  };

  const handleDuplicateDiscountSheetClose = () => {
    console.log("DuplicateDiscountSheet has been closed.");
    // Add any other logic needed when the discount sheet is closed by the user
  };

  const handlePresentEditInvoiceTaxSheet = () => {
    // For now, present with null/undefined as the EditInvoiceTaxSheet expects discount-like props
    // This will be updated when EditInvoiceTaxSheet is refactored for tax name and rate
    const initialName = invoiceTaxName !== null ? invoiceTaxName : globalTaxName;
    const initialRate = invoiceTaxRatePercent !== null ? invoiceTaxRatePercent : globalTaxRatePercent;
    editInvoiceTaxSheetRef.current?.present(initialName, initialRate);
  };

  const handleSaveInvoiceTax = (data: InvoiceTaxData) => {
    // Logic to update invoice-specific tax will be added here
    console.log('Invoice tax to be saved:', data); 
    setInvoiceTaxName(data.taxName);
    const rate = parseFloat(data.taxRate);
    setInvoiceTaxRatePercent(isNaN(rate) ? null : rate);
  };

  // Compute displayed tax values, prioritizing invoice-specific, then global
  const displayTaxName = invoiceTaxName !== null ? invoiceTaxName : globalTaxName;
  const displayTaxRatePercent = invoiceTaxRatePercent !== null ? invoiceTaxRatePercent : globalTaxRatePercent;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBackgroundColor }}>
      <Stack.Screen
        options={{
          headerTitle: '', 
          headerTitleAlign: 'left', 
          headerBackTitle: 'Back', 
          headerTitleStyle: { 
            fontFamily: 'Inter-Bold', 
            fontSize: 20,
            color: themeColors.foreground, 
          },
          headerStyle: {
            backgroundColor: themeColors.card,
            // Add shadow properties for iOS
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.10, // Subtle shadow
            shadowRadius: 2.00,
            // Add elevation for Android shadow
            elevation: 2,
          }, 
          headerTintColor: '#000000', 
          headerShadowVisible: false, // Keep this false to use our custom shadow from headerStyle
        }}
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: screenBackgroundColor }]}
        contentContainerStyle={{ paddingBottom: 100 }}
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
          {selectedClientName ? (
            <View style={styles.selectedClientContainer}>
              <Text style={styles.selectedClientName}>{selectedClientName}</Text>
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
            // Display items if they exist
            currentInvoiceLineItems.map((item, index) => (
              <View key={item.id} style={[
                styles.invoiceItemRow,
                index === 0 && { borderTopWidth: 0 }, // No top border for the first item
                index === currentInvoiceLineItems.length - 1 && { borderBottomWidth: 0 } // No bottom border for the last item
              ]}>
                <Text style={styles.invoiceItemCombinedInfo} numberOfLines={1} ellipsizeMode="tail">
                  <Text style={styles.invoiceItemNameText}>{item.item_name} </Text>
                  <Text style={styles.invoiceItemQuantityText}>(x{item.quantity})</Text>
                </Text>
                <Text style={styles.invoiceItemTotalText}>
                  ${item.total_price.toFixed(2)}
                </Text>
                {/* TODO: Add a remove button here later */}
              </View>
            ))
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
            <Text style={styles.summaryText}>${displaySubtotal.toFixed(2)}</Text>
          </View>
          <ActionRow 
            label={
              discountType === 'percentage' && discountValue && discountValue > 0 
                ? `Discount ${discountValue}%` 
                : discountType === 'fixed' && discountValue && discountValue > 0
                  ? 'Discount'
                  : discountType // If a type is set but value might be 0 or null
                    ? 'Edit Discount'
                    : 'Add Discount' // Cleaner prompt
            }
            value={
              displayDiscountAmount > 0 
                ? `- $${displayDiscountAmount.toFixed(2)}` 
                : '' // Empty if no discount applied
            }
            onPress={handlePresentDuplicateDiscountSheet} 
            icon={Percent} 
            themeColors={themeColors} 
            showChevron={!discountType} // Show chevron only if no discountType is set
          />
          {!isLoadingTaxSettings && globalTaxRatePercent !== null && (
            <>
              <View style={styles.separator} />
              <ActionRow
                label={`Tax ${displayTaxName ? `(${displayTaxName})` : ''}`}
                value={`${displayTaxRatePercent}%`}
                icon={Percent}
                themeColors={themeColors}
                onPress={handlePresentEditInvoiceTaxSheet} // Connect to new tax sheet
                showChevron={true} // Make it tappable
              />
            </>
          )}
          <View style={[styles.summaryRow, { borderBottomWidth: 0, marginTop: 5 }]}>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 17 }]}>Total</Text>
            <Text style={[styles.summaryText, { fontWeight: 'bold', fontSize: 17 }]}>${displayInvoiceTotal.toFixed(2)}</Text>
          </View>
        </FormSection>

        <FormSection title="PAYMENTS" themeColors={themeColors}>
          <ActionRow 
            label="+ Add Payment" 
            onPress={() => console.log('Add Payment pressed')} 
            themeColors={themeColors} 
            showChevron={false} // Typically buttons don't have chevrons
          />
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { fontWeight: 'bold' }]}>Balance Due</Text>
            <Text style={[styles.summaryText, { fontWeight: 'bold' }]}>${displayInvoiceTotal.toFixed(2)}</Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.summaryLabel}>Mark as paid</Text>
            <Switch 
              trackColor={{ false: themeColors.muted, true: themeColors.primary }} 
              thumbColor={isLightMode ? themeColors.card : themeColors.foreground}
              ios_backgroundColor={themeColors.muted}
              onValueChange={setIsMarkedAsPaid} // Connected back
              value={isMarkedAsPaid} // Connected back
            />
          </View>
        </FormSection>

        <FormSection title="PAYMENT METHODS" themeColors={themeColors}>
          <ActionRow 
            label="Card Payments" 
            value="Incomplete" 
            onPress={() => console.log('Card Payments pressed')} 
            icon={CreditCard}
            themeColors={themeColors} 
          />
          <ActionRow 
            label="Bank Account & Payment Info" 
            onPress={() => console.log('Bank Info pressed')} 
            icon={Banknote}
            themeColors={themeColors} 
          />
          <ActionRow 
            label="Add images & PDFs (0)" 
            onPress={() => console.log('Add Attachments pressed')} 
            icon={Paperclip}
            themeColors={themeColors} 
            showChevron={false} // This is more of an action button
          />
        </FormSection>

        <FormSection title="NOTES" themeColors={themeColors}>
          <TextInput
            style={styles.notesInput}
            placeholder="Comments will appear at the bottom of your invoice"
            placeholderTextColor={themeColors.mutedForeground}
            multiline
            value=""
            onChangeText={() => {}}
            textAlignVertical="top"
          />
        </FormSection>

      </ScrollView>

      {/* Full Width Save Button - Not in a separate container */}
      <TouchableOpacity onPress={handleSaveInvoice} style={styles.bottomSaveButton} disabled={!isSaveEnabled}>
        <Text style={styles.bottomSaveButtonText}>Save Invoice</Text>
      </TouchableOpacity>

      {/* Add Item Bottom Sheet Modal */}
      <AddItemSheet 
        ref={addItemSheetRef} 
        onItemFromFormSaved={handleItemFromSheetSaved} // Pass the callback here
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
        initialDetails={getInitialModalDetails()} // Pass current details
        onSave={handleSaveDetailsFromModal} // Handle save action
      />

      <DuplicateDiscountSheet
        ref={duplicateDiscountSheetRef}
        onSave={handleSaveDuplicateDiscount}
        onClose={handleDuplicateDiscountSheetClose}
        // Pass initial values if needed, though the present method also takes them
        // initialDiscountType={getValues('discountType')}
        // initialDiscountValue={getValues('discountValue')}
      />

      <EditInvoiceTaxSheet 
        ref={editInvoiceTaxSheetRef}
        onSave={handleSaveInvoiceTax} // Placeholder save handler
        onClose={() => console.log('Edit invoice tax sheet closed')}
      />
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
      marginRight: 8, // Space before chevron if present
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
      marginBottom: 0, // Hug the bottom of the SafeAreaView content area
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
      fontWeight: '600', // Bold
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
  });
}
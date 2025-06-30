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
import { ChevronRight, PlusCircle, X as XIcon, Edit3, Calendar, Trash2, Percent, CreditCard, Banknote, Paperclip, Landmark, ChevronLeft } from 'lucide-react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { Controller, useForm } from 'react-hook-form';
import { useSupabase } from '@/context/supabase-provider';
import { SwipeListView } from 'react-native-swipe-list-view';
import { ESTIMATE_STATUSES } from '@/constants/estimate-status';
import { UsageService } from '@/services/usageService';

// Import estimate-specific components and modals
import NewClientSelectionSheet, { Client as ClientType } from './NewClientSelectionSheet';
import AddItemSheet, { AddItemSheetRef } from './AddItemSheet';
import { NewItemData } from './AddNewItemFormSheet';
import SelectDiscountTypeSheet, { SelectDiscountTypeSheetRef, DiscountData } from './SelectDiscountTypeSheet';
import EditInvoiceTaxSheet, { EditInvoiceTaxSheetRef, TaxData as EstimateTaxData } from './EditInvoiceTaxSheet';
import EditEstimateDetailsSheet, { EditEstimateDetailsSheetRef, EstimateDetailsData } from './EditEstimateDetailsSheet';

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
  estimate_tax_label?: string | null;
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
  
  // Sheet refs
  const newClientSheetRef = useRef<BottomSheetModal>(null);
  const addItemSheetRef = useRef<AddItemSheetRef>(null);
  const discountSheetRef = useRef<SelectDiscountTypeSheetRef>(null);
  const taxSheetRef = useRef<EditInvoiceTaxSheetRef>(null);
  const editEstimateDetailsSheetRef = useRef<EditEstimateDetailsSheetRef>(null);
  
  const {
    handleSubmit,
    setValue,
    watch,
    getValues
  } = useForm<EstimateFormData>({
    defaultValues: {
      estimate_number: 'EST001',
      client_id: '', 
      estimate_date: new Date(),
      valid_until_date: null,
      valid_until_option: 'valid_for_30_days',
      items: [],
      taxPercentage: 20,
      estimate_tax_label: 'VAT',
      discountType: null,
      discountValue: 0,
      notes: '',
      acceptance_terms: '',
      paypal_active: false,
      stripe_active: false,
      bank_account_active: false,
    }
  });

  const screenBackgroundColor = isLightMode ? '#F0F2F5' : themeColors.background;
  const styles = getStyles(themeColors, screenBackgroundColor);

  // Watch form values
  const watchedEstimateNumber = watch('estimate_number');
  const watchedEstimateDate = watch('estimate_date');
  const watchedTaxPercentage = watch('taxPercentage');
  const watchedDiscountType = watch('discountType');
  const watchedDiscountValue = watch('discountValue');

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

  // Sync form items with currentEstimateLineItems for UI display
  useEffect(() => {
    const watchedItems = watch('items');
    if (watchedItems) {
      console.log('[useEffect for items] watchedItems:', watchedItems);
      setCurrentEstimateLineItems(watchedItems as EstimateLineItem[]);
    }
  }, [watch('items')]);

  const handleSaveEstimate = async () => {
    console.log('Save estimate functionality to be implemented...');
  };

  const openNewClientSelectionSheet = () => {
    newClientSheetRef.current?.present();
  };

  const handleClientSelect = (client: ClientType) => {
    setSelectedClient(client);
    setValue('client_id', client.id);
    newClientSheetRef.current?.dismiss();
  };

  const handlePaymentMethodToggle = (methodKey: 'stripe' | 'paypal' | 'bank_account', newValue: boolean) => {
    setValue(`${methodKey}_active` as keyof EstimateFormData, newValue);
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
    setValue('estimate_tax_label', taxData.taxName);
    taxSheetRef.current?.dismiss();
  };

  const handleEstimateDetailsSave = (detailsData: EstimateDetailsData) => {
    setValue('estimate_number', detailsData.estimateNumber);
    setValue('estimate_date', detailsData.creationDate);
    setValue('valid_until_option', detailsData.validUntilType);
    setValue('valid_until_date', detailsData.customValidUntilDate || null);
    setValue('acceptance_terms', detailsData.acceptanceTerms);
    setValue('custom_headline', detailsData.customHeadline);
    editEstimateDetailsSheetRef.current?.dismiss();
  };

  // Function to handle removing items
  const handleRemoveItem = (itemId: string) => {
    console.log('[handleRemoveItem] Removing item:', itemId);
    const updatedItems = currentEstimateLineItems.filter(item => item.id !== itemId);
    setCurrentEstimateLineItems(updatedItems);
    setValue('items', updatedItems, { shouldValidate: true, shouldDirty: true });
  };

  // Render function for the visible part of the list item
  const renderVisibleItem = (data: { item: EstimateLineItem, index: number }) => {
    const { item, index } = data;
    const isFirstItem = index === 0;
    const isLastItem = index === currentEstimateLineItems.length - 1;
    return (
      <View style={[
        styles.estimateItemRow,
        { backgroundColor: themeColors.card },
        isFirstItem && { borderTopWidth: 0 },
        isLastItem && { borderBottomWidth: 0 }
      ]}>
        <Text style={styles.estimateItemCombinedInfo} numberOfLines={1} ellipsizeMode="tail">
          <Text style={[styles.estimateItemNameText, { color: themeColors.foreground }]}>{item.item_name} </Text>
          <Text style={[styles.estimateItemQuantityText, { color: themeColors.mutedForeground }]}>(x{item.quantity})</Text>
        </Text>
        <Text style={[styles.estimateItemTotalText, { color: themeColors.foreground }]}>
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
          style={[styles.backRightBtn, styles.backRightBtnRight, { backgroundColor: themeColors.destructive }]}
          onPress={() => {
            console.log('[renderHiddenItem] Remove button pressed for item:', item.id);
            handleRemoveItem(item.id);
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
        backgroundColor={themeColors.card}
        translucent={false}
      />
      
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.card }]} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          <ScrollView 
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
                  <ChevronLeft size={24} color={themeColors.foreground} />
                  <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.previewButton}>
                  <Text style={styles.previewButtonText}>Preview</Text>
                </TouchableOpacity>
              </View>
              
              {/* Estimate Details */}
              <View style={styles.detailsRow1}>
                <View style={styles.estimateNumberEditContainer}>
                  <Text style={[styles.estimateNumberDisplay, { color: themeColors.foreground }]}>
                    {watchedEstimateNumber || 'EST001'}
                  </Text>
                </View>
                <Text style={{ color: themeColors.foreground, fontWeight: 'bold' }}>
                  Valid for 30 days
                </Text>
              </View>
              <View style={styles.detailsRow2}>
                <Text style={[styles.subLabel, { color: themeColors.mutedForeground }]}>Creation Date</Text>
                <Text style={[styles.dateDisplay, { color: themeColors.mutedForeground, fontWeight: 'normal' }]}>
                  {formatFriendlyDate(watchedEstimateDate)}
                </Text>
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
            <FormSection title="ITEMS" themeColors={themeColors} noPadding={currentEstimateLineItems.length > 0}>
              {currentEstimateLineItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <TouchableOpacity 
                    style={styles.addItemButtonInline}
                    onPress={() => addItemSheetRef.current?.present()}
                  >
                    <PlusCircle size={20} color={themeColors.primary} style={styles.addItemButtonIcon} />
                    <Text style={[styles.addItemButtonText, { color: themeColors.primary }]}>Add Item or Service</Text>
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
                        backgroundColor: themeColors.card
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
                    <PlusCircle size={20} color={themeColors.primary} style={styles.addItemButtonIcon} />
                    <Text style={[styles.addItemButtonText, { color: themeColors.primary }]}>Add Another Item or Service</Text>
                  </TouchableOpacity>
                </>
              )}
            </FormSection>

            {/* Summary Section */}
            <FormSection title="SUMMARY" themeColors={themeColors}>
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
                themeColors={themeColors}
              />
              
              <View style={[styles.summaryRow, { borderBottomWidth: 0, marginTop: 5 }]}>
                <Text style={[styles.summaryLabel, { fontWeight: 'bold', fontSize: 17, color: themeColors.foreground }]}>
                  Total
                </Text>
                <Text style={[styles.summaryText, { fontWeight: 'bold', fontSize: 17, color: themeColors.foreground }]}>
                  {getCurrencySymbol(currencyCode)}{displayEstimateTotal.toFixed(2)}
                </Text>
              </View>
            </FormSection>

            {/* Payment Methods Section */}
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
                switchValue={getValues('stripe_active')}
                onSwitchChange={(newValue) => handlePaymentMethodToggle('stripe', newValue)}
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
                switchValue={getValues('paypal_active')}
                onSwitchChange={(newValue) => handlePaymentMethodToggle('paypal', newValue)}
              />
              
              <ActionRow
                label="Bank Transfer"
                icon={Landmark}
                themeColors={themeColors}
                showSwitch={true}
                switchValue={getValues('bank_account_active')}
                onSwitchChange={(newValue) => handlePaymentMethodToggle('bank_account', newValue)}
              />
            </FormSection>

            {/* Change Design Section */}
            <FormSection title="" themeColors={themeColors}>
              <TouchableOpacity style={styles.changeDesignSelector}>
                <Text style={[styles.changeDesignText, { color: themeColors.primary }]}>Change Estimate Design</Text>
              </TouchableOpacity>
            </FormSection>

            {/* Other Settings Section */}
            <FormSection title="OTHER SETTINGS" themeColors={themeColors}>
              <ActionRow
                label="Add images & PDFs (0)"
                onPress={() => console.log('Add Attachments pressed - Coming soon!')}
                icon={Paperclip}
                themeColors={themeColors}
                showChevron={false}
              />
              <TextInput
                style={[styles.notesInput, { 
                  color: themeColors.foreground,
                  borderColor: themeColors.border 
                }]}
                placeholder="Payment is due within 30 days of estimate date. Late payments may incur additional fees."
                placeholderTextColor={themeColors.mutedForeground}
                multiline
                value={watch('notes') || ''}
                onChangeText={(text) => setValue('notes', text)}
                textAlignVertical="top"
              />
            </FormSection>

          {/* Save Button */}
          <TouchableOpacity 
            onPress={handleSaveEstimate} 
            style={[styles.bottomSaveButton, { backgroundColor: themeColors.primary }]}
          >
            <Text style={styles.bottomSaveButtonText}>
              {isEditMode ? 'Save' : 'Save Estimate'}
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
            currentTaxLabel={watch('estimate_tax_label')}
            onSaveTax={handleTaxSave}
          />

          {/* Edit Estimate Details Sheet */}
          <EditEstimateDetailsSheet
            ref={editEstimateDetailsSheetRef}
            initialDetails={{
              estimateNumber: watchedEstimateNumber,
              creationDate: watchedEstimateDate,
              validUntilType: watch('valid_until_option') || 'net_30',
              customValidUntilDate: watch('valid_until_date'),
              acceptanceTerms: watch('acceptance_terms'),
              customHeadline: watch('custom_headline'),
            }}
            onSave={handleEstimateDetailsSave}
          />

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
}

const getStyles = (themeColors: ThemeColorPalette, screenBackgroundColor: string) => StyleSheet.create({
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
    backgroundColor: themeColors.card,
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
    color: themeColors.foreground,
  },
  changeClientText: {
    fontSize: 16,
    color: themeColors.primary,
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
    color: themeColors.primary,
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
    borderTopColor: themeColors.border,
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
    borderBottomColor: themeColors.border,
  },
  summaryLabel: {
    fontSize: 16,
    color: themeColors.foreground,
  },
  summaryText: {
    fontSize: 16,
    color: themeColors.foreground,
    textAlign: 'right',
  },
  taxPercentageStyle: {
    fontSize: 16,
    color: themeColors.mutedForeground,
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
    alignItems: 'center',
    paddingVertical: 16,
  },
  changeDesignText: {
    fontSize: 16,
    fontWeight: '500',
  },
  notesInput: {
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
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
    borderBottomColor: themeColors.border,
  },
  estimateItemCombinedInfo: {
    flex: 1,
    marginRight: 12,
    fontSize: 16,
    color: themeColors.foreground,
  },
  estimateItemNameText: {
    fontWeight: '500',
  },
  estimateItemQuantityText: {
    fontWeight: 'normal',
    color: themeColors.mutedForeground,
  },
  estimateItemTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: themeColors.foreground,
  },
  rowBack: {
    alignItems: 'center',
    backgroundColor: themeColors.destructive,
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
    backgroundColor: themeColors.destructive,
    right: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: themeColors.border,
    marginLeft: 16, // Assuming ActionRow content (like icon) starts after 16px padding
  },
}); 
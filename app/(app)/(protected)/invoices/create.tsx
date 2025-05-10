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
  // Add other fields as necessary, e.g., notes, discount, tax
}

// Define FormSection Component
const FormSection = ({ title, children, themeColors, noPadding }: { title?: string, children: React.ReactNode, themeColors: any, noPadding?: boolean }) => {
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
      <View style={{ backgroundColor: themeColors.card, borderRadius: 10, padding: noPadding ? 0 : 16, overflow: 'hidden' }}>
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
    themeColors: any,
    showChevron?: boolean
  }
) => {
  const styles = getStyles(themeColors); // Assuming getStyles is defined
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={styles.actionRowContainer}>
      <View style={styles.actionRowLeft}>
        {IconComponent && <IconComponent size={20} color={onPress ? themeColors.primary : themeColors.mutedForeground} style={styles.actionRowIcon} />}
        <Text style={[styles.actionRowLabel, onPress && { color: themeColors.primary }]}>{label}</Text>
      </View>
      <View style={styles.actionRowRight}>
        {value && <Text style={[styles.actionRowValue, { color: themeColors.foreground }]}>{value}</Text>}
        {onPress && showChevron && <ChevronRight size={20} color={themeColors.mutedForeground} style={{ marginLeft: 8 }} />}
      </View>
    </TouchableOpacity>
  );
};

export default function CreateInvoiceScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const router = useRouter();
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility(); // Use context

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
      invoice_number: '',
      client_id: '', // Will be populated by client selection
      invoice_date: new Date(),
      due_date: null, // Default to null or a calculated date
      items: [],
      // ... other fields
    }
  });

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
  const addItemSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const handlePresentAddItemModal = useCallback(() => {
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Preview button removed */}
          <TouchableOpacity onPress={() => console.log('Save tapped')} disabled={!isSaveEnabled}>
            <Text style={{ color: isSaveEnabled ? themeColors.primary : themeColors.muted, fontSize: 17, fontWeight: '600', marginRight: Platform.OS === 'ios' ? 0 : 10 }}>Save</Text>
          </TouchableOpacity>
        </View>
      ),
      headerLeft: () => null, // Explicitly remove any default left component (like a back arrow)
    });
  }, [navigation, themeColors, isSaveEnabled]); // Dependencies updated

  const screenBackgroundColor = isLightMode ? '#F0F2F5' : themeColors.background; // WhatsApp like light gray
  const styles = getStyles(themeColors); // Get styles dynamically

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
          headerStyle: { backgroundColor: themeColors.card }, 
          headerTintColor: '#000000', 
          headerShadowVisible: false,
          headerRight: () => null, // Explicitly remove the Preview button here
        }}
      />
      <ScrollView 
        style={[styles.container, { backgroundColor: screenBackgroundColor }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* --- NEW DETAILS SECTION --- */}
        <View style={styles.newDetailsSectionContainer}>
          <View style={styles.detailsRow1}>
            <View style={styles.invoiceNumberEditContainer}>
              <Controller
                control={control}
                name="invoice_number"
                rules={{ required: 'Invoice number is required' }}
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    style={[styles.invoiceNumberDisplay, { color: themeColors.foreground }]} 
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    placeholder="INV-0000"
                    placeholderTextColor={themeColors.mutedForeground}
                  />
                )}
              />
              <TouchableOpacity style={{padding: 4}}> {/* Added padding for easier tap */}
                <Edit3 size={20} color={themeColors.foreground} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.duePill, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.duePillText}>Due on receipt</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.detailsRow2}>
            <Text style={[styles.subLabel, { color: themeColors.mutedForeground }]}>Details</Text>
            <TouchableOpacity onPress={showDatePicker}>
              <Text style={[styles.dateDisplay, { color: themeColors.foreground }]}>
                {invoiceDate ? invoiceDate.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric', year: 'numeric' }) : 'Select Date'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* --- END NEW DETAILS SECTION --- */}

        {/* Client Section */}
        <FormSection title="Client" themeColors={themeColors}>
          {selectedClientName ? (
            <TouchableOpacity onPress={openNewClientSelectionSheet} style={styles.inputRow}>
              <Text style={[styles.label, { color: themeColors.foreground }]}>Client</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Text style={[{ flex: 1, textAlign: 'right', color: themeColors.foreground }]}>
                  {selectedClientName}
                </Text>
                <ChevronRight size={20} color={themeColors.mutedForeground} style={{ marginLeft: 8 }} />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={openNewClientSelectionSheet} 
              style={[styles.addItemButton, { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: themeColors.border, marginVertical: 0 /* Override FormSection item spacing */, paddingHorizontal: 0 /* Align with other rows */}]}>
              <PlusCircle size={22} color={themeColors.primary} style={{ marginRight: 10 }}/>
              <Text style={[styles.addItemButtonText, { color: themeColors.primary }]}>Add Client</Text>
            </TouchableOpacity>
          )}
        </FormSection>

        <FormSection title="Items" themeColors={themeColors} noPadding>
          {/* Render items here */}
          <Text style={[styles.placeholderText, {color: themeColors.mutedForeground}]}>No items added yet.</Text>
          <TouchableOpacity onPress={handlePresentAddItemModal} style={[styles.addItemButton, { paddingHorizontal: 16, paddingVertical: 16 }]}>
            <PlusCircle size={22} color={themeColors.primary} />
            <Text style={[styles.addItemButtonText, { color: themeColors.primary }]}>Add Item or Service</Text>
          </TouchableOpacity>
        </FormSection>

        <FormSection title="Summary" themeColors={themeColors}>
          <View style={styles.inputRow}> 
            <Text style={[styles.label, { color: themeColors.foreground }]}>Subtotal</Text>
            <Text style={[styles.summaryText, { color: themeColors.foreground }]}>$0.00</Text>
          </View>
          <ActionRow 
            label="Add Discount" 
            onPress={() => console.log('Add Discount pressed')} 
            icon={PlusCircle} 
            themeColors={themeColors} 
          />
          <ActionRow 
            label="Add VAT" 
            onPress={() => console.log('Add VAT pressed')} 
            icon={PlusCircle} // Or Percent if preferred
            themeColors={themeColors} 
          />
          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: themeColors.foreground }]}>Tax (0%)</Text> // This might be redundant if VAT is added above
            <Text style={[styles.summaryText, { color: themeColors.foreground }]}>$0.00</Text>
          </View>
          <View style={[styles.inputRow, { borderBottomWidth: 0, marginTop: 5 }]}>
            <Text style={[styles.label, { color: themeColors.foreground, fontWeight: 'bold', fontSize: 17 }]}>Total</Text>
            <Text style={[styles.summaryText, { color: themeColors.foreground, fontWeight: 'bold', fontSize: 17 }]}>$0.00</Text>
          </View>
        </FormSection>

        <FormSection title="Payments" themeColors={themeColors}>
          <ActionRow 
            label="+ Add Payment" 
            onPress={() => console.log('Add Payment pressed')} 
            themeColors={themeColors} 
            showChevron={false} // Typically buttons don't have chevrons
          />
          <View style={styles.inputRow}>
            <Text style={[styles.label, { color: themeColors.foreground, fontWeight: 'bold' }]}>Balance Due</Text>
            <Text style={[styles.summaryText, { color: themeColors.foreground, fontWeight: 'bold' }]}>$0.00</Text>
          </View>
          <View style={[styles.inputRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.label, { color: themeColors.foreground }]}>Mark as paid</Text>
            <Switch 
              trackColor={{ false: themeColors.muted, true: themeColors.primary }} 
              thumbColor={isLightMode ? themeColors.card : themeColors.foreground}
              ios_backgroundColor={themeColors.muted}
              onValueChange={setIsMarkedAsPaid} // Connected back
              value={isMarkedAsPaid} // Connected back
            />
          </View>
        </FormSection>

        <FormSection title="Payment Methods" themeColors={themeColors}>
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

        <FormSection title="Notes" themeColors={themeColors}>
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

      {/* Floating Preview Invoice Button */}
      <TouchableOpacity
        onPress={() => console.log('Floating Preview Invoice Tapped!')} // Placeholder action
        style={{
          position: 'absolute',
          bottom: 30, // Adjust as needed for padding from bottom
          right: 20,  // Adjust as needed for padding from right
          backgroundColor: '#FFD700CC', // Gold color with ~80% opacity
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 25, // Pill shape
          elevation: 5, // Android shadow
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        <Text style={{ color: '#000000', fontWeight: 'bold', fontSize: 16 }}>Preview Invoice</Text>
      </TouchableOpacity>

      {/* Add Item Bottom Sheet Modal */}
      <BottomSheetModal
        ref={addItemSheetRef}
        index={0} // Start at the first snap point
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }} // Style the handle
        backgroundStyle={{ backgroundColor: themeColors.card }} // Style the modal background
      >
        <View style={styles.bottomSheetContentContainer}>
          <Text style={[styles.bottomSheetTitle, { color: themeColors.foreground }]}>Add New Item</Text>
          
          <TextInput
            style={[styles.modalInput, { backgroundColor: themeColors.input, color: themeColors.foreground, borderColor: themeColors.border }]}
            placeholder="Item Name"
            placeholderTextColor={themeColors.mutedForeground}
            value={itemName}
            onChangeText={setItemName}
          />
          <View style={styles.modalRowInputContainer}>
            <TextInput
              style={[styles.modalInput, styles.modalInputHalf, { backgroundColor: themeColors.input, color: themeColors.foreground, borderColor: themeColors.border }]}
              placeholder="Quantity"
              placeholderTextColor={themeColors.mutedForeground}
              value={itemQuantity}
              onChangeText={setItemQuantity}
              keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, styles.modalInputHalf, { backgroundColor: themeColors.input, color: themeColors.foreground, borderColor: themeColors.border }]}
              placeholder="Price (e.g., 25.00)"
              placeholderTextColor={themeColors.mutedForeground}
              value={itemPrice}
              onChangeText={setItemPrice}
              keyboardType="decimal-pad"
            />
          </View>
          <TextInput
            style={[styles.modalInput, styles.modalInputMultiline, { backgroundColor: themeColors.input, color: themeColors.foreground, borderColor: themeColors.border }]}
            placeholder="Description (Optional)"
            placeholderTextColor={themeColors.mutedForeground}
            value={itemDescription}
            onChangeText={setItemDescription}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity 
            style={[styles.formButton, {backgroundColor: themeColors.primary, marginTop: 30}]} 
            onPress={() => {
              console.log('Save Item:', { itemName, itemQuantity, itemPrice, itemDescription });
              addItemSheetRef.current?.dismiss();
            }}
          >
            <Text style={[styles.formButtonText, {color: themeColors.primaryForeground}]}>Save Item</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.formButton, {backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border, marginTop: 15}]} 
            onPress={() => addItemSheetRef.current?.dismiss()}
          >
            <Text style={[styles.formButtonText, {color: themeColors.primary}]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>

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
    </SafeAreaView>
  );
}

// Styles need to be a function that accepts themeColors
const getStyles = (themeColors: any) => StyleSheet.create({
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
  addItemButtonText: {
    fontSize: 16,
    marginLeft: 10,
    fontWeight: '600',
    // color is set dynamically by inline style or here if needed
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
    paddingTop: Platform.OS === 'ios' ? 10 : 0, // Adjust paddingTop for placeholder visibility
    paddingBottom: 10,
    backgroundColor: themeColors.input, 
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
    backgroundColor: themeColors.inputBackground || themeColors.card, // Use a specific input background or card color
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
});

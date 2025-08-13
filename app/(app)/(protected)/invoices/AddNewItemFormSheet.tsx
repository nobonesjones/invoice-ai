import React, { forwardRef, useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, ScrollView, ActionSheetIOS, Alert, Switch } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, PercentSquareIcon, PercentIcon, ImageIcon, PaperclipIcon } from 'lucide-react-native';
import { supabase } from '@/lib/supabase'; // Import Supabase client

export type DiscountType = 'percentage' | 'fixed';

export interface NewItemData { // This type describes the object passed to the onSave callback
  id: string;                 // Added: an ID is generated and passed
  itemName: string;           // Changed: 'name' to 'itemName' as used internally and passed
  description?: string | null; // Allow null
  price: number;              // Changed: converted to number before passing
  quantity: number;           // Changed: converted to number before passing
  discountType?: DiscountType | null; // Keep
  discountValue?: number | null;      // Changed: converted to number or null before passing
  imageUri?: string | null;         // Added: image URI is included when passed
  saved_item_db_id?: string | null; // NEW: ID from user_saved_items table
}

export interface AddNewItemFormSheetProps {
  onSave: (itemData: NewItemData) => void;
}

export interface AddNewItemFormSheetRef {
  present: () => void;
  dismiss: () => void;
}

const AddNewItemFormSheet = forwardRef<AddNewItemFormSheetRef, AddNewItemFormSheetProps>(({ onSave }, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValue, setDiscountValue] = useState('');
  const [saveItemForFutureUse, setSaveItemForFutureUse] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);

  React.useImperativeHandle(ref, () => ({
    present: () => bottomSheetModalRef.current?.present(),
    dismiss: () => bottomSheetModalRef.current?.dismiss(),
  }));

  const snapPoints = useMemo(() => ['90%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
    ),
    []
  );

  const handleSave = useCallback(async () => {
    // Basic validation (can be expanded)
    if (!itemName.trim() || !itemPrice.trim()) {
      Alert.alert('Missing Information', 'Please enter at least an item name and price.');
      return;
    }

    let savedItemDatabaseId: string | null = null;

    if (saveItemForFutureUse) {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) throw new Error('User not authenticated to save item template.');

        const userId = session.user.id;

        // Data for user_saved_items table
        const itemToSaveInDb = {
          user_id: userId,
          item_name: itemName,
          description: itemDescription || null,
          price: parseFloat(itemPrice), // This is unit_price in user_saved_items
          default_quantity: parseInt(itemQuantity, 10) || 1,
          discount_type: discountType,
          discount_value: discountValue ? parseFloat(discountValue) : null,
          image_url: selectedImageUri, // Ensure this maps to your image_url column
        };

        const { data: newSavedItem, error: insertError } = await supabase
          .from('user_saved_items') // Ensure this table name is correct
          .insert(itemToSaveInDb)
          .select()
          .single();

        if (insertError) {
          console.error('Error saving item template to Supabase:', insertError);
          Alert.alert('Save Error', `Could not save item template: ${insertError.message}`);
          // Optionally, decide if you want to proceed with onSave callback if DB save fails
        } else if (newSavedItem) {
          savedItemDatabaseId = newSavedItem.id;
          Alert.alert('Item Saved', 'This item has been saved to your list for future use.');
        }
      } catch (error: any) {
        console.error('An unexpected error occurred while saving item template:', error);
        Alert.alert('Error', 'An unexpected error occurred: ' + error.message);
      }
    }

    // Data for the onSave callback (to be used for the current invoice)
    const dataForCallback: NewItemData = {
      id: `inv_item_${Date.now()}`, // Temporary ID for this specific invoice line item instance
      itemName,
      description: itemDescription || null,
      price: parseFloat(itemPrice), // Unit price for the invoice line item
      quantity: parseInt(itemQuantity, 10) || 1,
      discountType,
      discountValue: discountValue ? parseFloat(discountValue) : null,
      imageUri: selectedImageUri, // This is for the form, might not be needed by create.tsx directly
      saved_item_db_id: savedItemDatabaseId, // Pass the DB ID if item was saved
    };

    onSave(dataForCallback);
    // bottomSheetModalRef.current?.dismiss(); // Consider dismissing after successful onSave + DB save
  }, [
    itemName,
    itemDescription,
    itemPrice,
    itemQuantity,
    discountType,
    discountValue,
    selectedImageUri,
    saveItemForFutureUse,
    onSave,
  ]);

  const handleDiscountTypeSelected = (type: DiscountType | null) => {
    setDiscountType(type);
    setDiscountValue('');
  };

  const promptForDiscountType = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Percentage (%)', 'Fixed Amount'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleDiscountTypeSelected('percentage');
          } else if (buttonIndex === 2) {
            handleDiscountTypeSelected('fixed');
          }
        }
      );
    } else {
      Alert.alert(
        'Select Discount Type',
        '',
        [
          {
            text: 'Percentage (%)',
            onPress: () => handleDiscountTypeSelected('percentage'),
          },
          {
            text: 'Fixed Amount',
            onPress: () => handleDiscountTypeSelected('fixed'),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
    }
  };

  const handleAttachImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You've refused to allow this app to access your photos.");
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });

    if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
      setSelectedImageUri(pickerResult.assets[0].uri);
    }
  };

  const discountDisplayText = useMemo(() => {
    if (!discountType) return 'Add Discount';
    if (discountType === 'fixed') return 'Fixed Amount Discount ($)';
    if (discountType === 'percentage') return 'Percentage Discount (%)';
    return 'Add Discount'; // Fallback, though should not be reached if logic is sound
  }, [discountType]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
    },
    contentContainerStyle: {
      paddingBottom: 40,
      paddingTop: Platform.OS === 'ios' ? 10 : 15,
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: themeColors.foreground,
      marginBottom: 20,
      textAlign: 'center',
    },
    inputGroupContainer: {
      backgroundColor: themeColors.card,
      borderRadius: 12,
      marginBottom: 20,
      paddingHorizontal: 0,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.05,
      shadowRadius: 2.00,
      elevation: 2,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
      borderBottomWidth: 1,
      borderBottomColor: themeColors.border,
    },
    inputRow_last: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 15,
    },
    inputLabelText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: themeColors.foreground,
      marginRight: 10,
      minWidth: '25%',
    },
    inputValueArea: {
      flex: 1,
    },
    textInputStyled: {
      fontSize: 16,
      color: themeColors.foreground,
      paddingVertical: 0,
      backgroundColor: 'transparent',
    },
    descriptionInputContainer: {
      paddingVertical: 12,
      paddingHorizontal: 15,
      minHeight: 80,
    },
    input: {
      backgroundColor: themeColors.input,
      color: themeColors.foreground,
      fontSize: 16,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    inputLabel: {
      fontSize: 14,
      color: themeColors.mutedForeground,
      marginBottom: 5,
      marginLeft: 2,
    },
    button: {
      paddingVertical: 15,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
    },
    saveButton: {
      backgroundColor: themeColors.primary,
    },
    buttonText: {
      fontSize: 17,
      fontWeight: '600',
    },
    saveButtonText: {
      color: themeColors.primaryForeground,
    },
    modalBackground: {
      backgroundColor: themeColors.background,
    },
    handleIndicator: {
      backgroundColor: themeColors.mutedForeground,
    },
    closeButton: {
      position: 'absolute',
      top: Platform.OS === 'ios' ? 10 : 15,
      right: 15,
      padding: 5,
      zIndex: 1,
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      name="addNewItemFormModal"
      stackBehavior="push"
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      enablePanDownToClose={true}
    >
      <BottomSheetScrollView style={styles.container} contentContainerStyle={styles.contentContainerStyle}>
        <TouchableOpacity style={styles.closeButton} onPress={() => bottomSheetModalRef.current?.dismiss()}>
          <XIcon size={22} color={themeColors.mutedForeground} />
        </TouchableOpacity>

        <Text style={styles.title}>Create New Item</Text>

        <View style={styles.inputGroupContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabelText}>Item Name</Text>
            <View style={styles.inputValueArea}>
              <BottomSheetTextInput
                style={styles.textInputStyled}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Enter item name"
                placeholderTextColor={themeColors.mutedForeground}
              />
            </View>
          </View>

          <View style={styles.descriptionInputContainer}>
            <BottomSheetTextInput
              style={styles.textInputStyled}
              value={itemDescription}
              onChangeText={setItemDescription}
              placeholder="Description (optional)"
              placeholderTextColor={themeColors.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        <View style={styles.inputGroupContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabelText}>Price</Text>
            <View style={styles.inputValueArea}>
              <BottomSheetTextInput
                style={styles.textInputStyled}
                value={itemPrice}
                onChangeText={setItemPrice}
                placeholder="0.00"
                placeholderTextColor={themeColors.mutedForeground}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.inputRow_last}>
            <Text style={styles.inputLabelText}>Quantity</Text>
            <View style={styles.inputValueArea}>
              <BottomSheetTextInput
                style={styles.textInputStyled}
                value={itemQuantity}
                onChangeText={setItemQuantity}
                placeholder="1"
                placeholderTextColor={themeColors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroupContainer}>
          <TouchableOpacity
            style={styles.inputRow}
            onPress={!discountType ? promptForDiscountType : undefined}
          >
            <PercentIcon size={20} color={discountType ? themeColors.primary : themeColors.mutedForeground} style={{ marginRight: 12 }} />
            <Text
              style={[
                styles.textInputStyled,
                { flex: 1 },
                discountType ? { color: themeColors.primary, fontWeight: '500' } : { color: themeColors.mutedForeground }
              ]}
            >
              {discountDisplayText}
            </Text>
            {discountType && (
              <TouchableOpacity onPress={() => handleDiscountTypeSelected(null)} style={{ paddingLeft: 10, paddingVertical: 5 }}>
                <XIcon size={18} color={themeColors.mutedForeground} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>


          {discountType && (
            <View style={styles.inputRow}>
              <Text style={styles.inputLabelText}>
                {discountType === 'percentage' ? 'Percent %' : 'Amount'}
              </Text>
              <View style={styles.inputValueArea}>
                <BottomSheetTextInput
                  style={styles.textInputStyled}
                  placeholder={discountType === 'percentage' ? 'e.g. 10%' : 'e.g. $50'}
                  placeholderTextColor={themeColors.mutedForeground}
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.inputGroupContainer}>
          <TouchableOpacity style={styles.inputRow} onPress={handleAttachImage}>
            <ImageIcon size={20} color={selectedImageUri ? themeColors.primary : themeColors.mutedForeground} style={{ marginRight: 12 }} />
            <Text
              style={[
                styles.textInputStyled,
                { flex: 1 },
                selectedImageUri ? { color: themeColors.primary, fontStyle: 'italic' } : { color: themeColors.mutedForeground },
              ]}
            >
              {selectedImageUri ? `Image Attached: ${selectedImageUri.split('/').pop()}` : 'Attach Image'}
            </Text>
          </TouchableOpacity>

          <View style={styles.inputRow_last}>
            <PaperclipIcon size={20} color={themeColors.mutedForeground} style={{ marginRight: 12 }} />
            <Text style={[styles.textInputStyled, { flex: 1, color: themeColors.mutedForeground }]}>
              Save this item for future use?
            </Text>
            <Switch
              trackColor={{ false: themeColors.border, true: themeColors.primary }}
              thumbColor={themeColors.card}
              ios_backgroundColor={themeColors.border}
              onValueChange={setSaveItemForFutureUse}
              value={saveItemForFutureUse}
              style={{ marginLeft: 10 }}
            />
          </View>
        </View>

        <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={handleSave}>
          <Text style={[styles.buttonText, styles.saveButtonText]}>Save Item</Text>
        </TouchableOpacity>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});

export default AddNewItemFormSheet;

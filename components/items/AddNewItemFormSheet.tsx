import React, { forwardRef, useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, Switch } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetTextInput, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, PercentIcon, PaperclipIcon } from 'lucide-react-native';
import { supabase } from '@/config/supabase';

export type DiscountType = 'percentage' | 'fixed';

export interface NewItemData {
  id: string;
  itemName: string;
  description?: string | null;
  price: number;
  quantity: number;
  discountType?: DiscountType | null;
  discountValue?: number | null;
  imageUri?: string | null;
  saved_item_db_id?: string | null;
}

export interface AddNewItemFormSheetProps {
  onSave: (itemData: NewItemData) => void;
  onOpenChange?: (open: boolean) => void;
}

export interface AddNewItemFormSheetRef {
  present: () => void;
  dismiss: () => void;
}

const AddNewItemFormSheet = forwardRef<AddNewItemFormSheetRef, AddNewItemFormSheetProps>(({ onSave, onOpenChange }, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const scrollRef = useRef<any>(null);
  const insets = useSafeAreaInsets();

  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [discountType, setDiscountType] = useState<DiscountType | null>(null);
  const [discountValue, setDiscountValue] = useState('');
  const [saveItemForFutureUse, setSaveItemForFutureUse] = useState(false);

  React.useImperativeHandle(ref, () => ({
    present: () => {
      bottomSheetModalRef.current?.present();
      try { onOpenChange?.(true); } catch {}
      setTimeout(() => {
        try { scrollRef.current?.scrollToEnd?.({ animated: true }); } catch {}
      }, 50);
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
      try { onOpenChange?.(false); } catch {}
    },
  }));

  // 95% to sit slightly lower; topInset small to lift with keyboard
  const snapPoints = useMemo(() => ['95%'], []);

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} />
  ), []);

  const handleFocus = () => {
    setTimeout(() => {
      try { scrollRef.current?.scrollToEnd?.({ animated: true }); } catch {}
    }, 50);
  };

  const handleSave = useCallback(async () => {
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
        const itemToSaveInDb = {
          user_id: userId,
          item_name: itemName,
          description: itemDescription || null,
          price: parseFloat(itemPrice),
          default_quantity: parseInt(itemQuantity, 10) || 1,
          discount_type: discountType,
          discount_value: discountValue ? parseFloat(discountValue) : null,
          image_url: null,
        } as any;

        const { data: newSavedItem, error: insertError } = await supabase
          .from('user_saved_items')
          .insert(itemToSaveInDb)
          .select()
          .single();

        if (insertError) {
          console.error('Error saving item template to Supabase:', insertError);
          Alert.alert('Save Error', `Could not save item template: ${insertError.message}`);
        } else if (newSavedItem) {
          savedItemDatabaseId = (newSavedItem as any).id;
          Alert.alert('Item Saved', 'This item has been saved to your list for future use.');
        }
      } catch (error: any) {
        console.error('Unexpected error while saving item template:', error);
        Alert.alert('Error', 'An unexpected error occurred: ' + error.message);
      }
    }

    const dataForCallback: NewItemData = {
      id: `inv_item_${Date.now()}`,
      itemName,
      description: itemDescription || null,
      price: parseFloat(itemPrice),
      quantity: parseInt(itemQuantity, 10) || 1,
      discountType,
      discountValue: discountValue ? parseFloat(discountValue) : null,
      imageUri: null,
      saved_item_db_id: savedItemDatabaseId,
    };

    onSave(dataForCallback);
  }, [itemName, itemDescription, itemPrice, itemQuantity, discountType, discountValue, saveItemForFutureUse, onSave]);

  const handleDiscountTypeSelected = (type: DiscountType | null) => {
    setDiscountType(type);
    setDiscountValue('');
  };

  const promptForDiscountType = () => {
    if (Platform.OS === 'ios') {
      // native action sheet
      const options = ['Cancel', 'Percentage (%)', 'Fixed Amount'];
      // use Alert as a simple fallback prompt across platforms
      Alert.alert('Select Discount Type', '', [
        { text: 'Percentage (%)', onPress: () => handleDiscountTypeSelected('percentage') },
        { text: 'Fixed Amount', onPress: () => handleDiscountTypeSelected('fixed') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Select Discount Type', '', [
        { text: 'Percentage (%)', onPress: () => handleDiscountTypeSelected('percentage') },
        { text: 'Fixed Amount', onPress: () => handleDiscountTypeSelected('fixed') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const discountDisplayText = useMemo(() => {
    if (!discountType) return 'Add Discount';
    if (discountType === 'fixed') return 'Fixed Amount Discount ($)';
    if (discountType === 'percentage') return 'Percentage Discount (%)';
    return 'Add Discount';
  }, [discountType]);

  const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20 },
    contentContainerStyle: { paddingBottom: 40, paddingTop: Platform.OS === 'ios' ? 10 : 15 },
    title: { fontSize: 22, fontWeight: 'bold', color: themeColors.foreground, marginBottom: 20, textAlign: 'center' },
    inputGroupContainer: { backgroundColor: themeColors.card, borderRadius: 12, marginBottom: 20, paddingHorizontal: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
    inputRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: themeColors.border },
    inputRow_last: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15 },
    inputLabelText: { fontSize: 16, fontWeight: 'bold', color: themeColors.foreground, marginRight: 10, minWidth: '25%' },
    inputValueArea: { flex: 1 },
    textInputStyled: { fontSize: 16, color: themeColors.foreground, paddingVertical: 0, backgroundColor: 'transparent' },
    descriptionInputContainer: { paddingVertical: 12, paddingHorizontal: 15, minHeight: 0 },
    button: { paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    saveButton: { backgroundColor: themeColors.primary },
    buttonText: { fontSize: 17, fontWeight: '600' },
    saveButtonText: { color: themeColors.primaryForeground },
    modalBackground: { backgroundColor: themeColors.background },
    handleIndicator: { backgroundColor: themeColors.mutedForeground },
    closeButton: { position: 'absolute', top: Platform.OS === 'ios' ? 10 : 15, right: 15, padding: 5, zIndex: 1 },
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
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      topInset={6}
      onChange={(i) => { try { onOpenChange?.(i !== -1); } catch {} }}
      onDismiss={() => { try { onOpenChange?.(false); } catch {} }}
    >
      <BottomSheetScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.contentContainerStyle}>
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
                onFocus={handleFocus}
                autoFocus
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
              onFocus={handleFocus}
              autoCorrect={false}
              returnKeyType="done"
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
                onFocus={handleFocus}
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
                onFocus={handleFocus}
              />
            </View>
          </View>
        </View>

        <View style={styles.inputGroupContainer}>
          <TouchableOpacity style={styles.inputRow} onPress={!discountType ? promptForDiscountType : undefined}>
            <PercentIcon size={20} color={discountType ? themeColors.primary : themeColors.mutedForeground} style={{ marginRight: 12 }} />
            <Text
              style={[styles.textInputStyled, { flex: 1 }, discountType ? { color: themeColors.primary, fontWeight: '500' } : { color: themeColors.mutedForeground }]}
              onPress={promptForDiscountType}
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
                  onFocus={handleFocus}
                />
              </View>
            </View>
          )}

          <View style={styles.inputRow_last}>
            <PaperclipIcon size={20} color={themeColors.mutedForeground} style={{ marginRight: 12 }} />
            <Text style={[styles.textInputStyled, { flex: 1, color: themeColors.mutedForeground }]}>Save this item for future use?</Text>
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


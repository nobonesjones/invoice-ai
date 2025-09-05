import React, { forwardRef, useMemo, useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { PlusCircle, Search, X } from 'lucide-react-native';
import AddNewItemFormSheet, { AddNewItemFormSheetRef, NewItemData } from '@/components/items/AddNewItemFormSheet';
import { supabase } from '@/config/supabase';

const getCurrencySymbol = (code: string) => {
  const mapping: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'C$', JPY: '¥', INR: '₹' };
  if (!code) return '$';
  const normalized = code.split(' ')[0];
  return mapping[normalized] || '$';
};

export interface DisplayableSavedItem {
  id: string;
  itemName: string;
  price: number;
  description?: string | null;
}

export interface AddItemSheetStableProps {
  onItemFromFormSaved?: (itemData: NewItemData) => void;
  currencyCode?: string;
}

export interface AddItemSheetStableRef {
  present: () => void;
  dismiss: () => void;
}

const AddItemSheetStable = forwardRef<AddItemSheetStableRef, AddItemSheetStableProps>(({ onItemFromFormSaved, currencyCode = 'USD' }, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const insets = useSafeAreaInsets();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const addNewItemFormSheetRef = useRef<AddNewItemFormSheetRef>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isChildOpen, setIsChildOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedItems, setSavedItems] = useState<DisplayableSavedItem[]>([]);
  const [filteredSavedItems, setFilteredSavedItems] = useState<DisplayableSavedItem[]>([]);

  const snapPoints = useMemo(() => ['70%', '90%'], []);

  React.useImperativeHandle(ref, () => ({
    present: () => {
      try { bottomSheetModalRef.current?.present(); } catch {}
      setTimeout(() => { fetchSavedItems(); }, 120);
    },
    dismiss: () => bottomSheetModalRef.current?.dismiss(),
  }));

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.7} pressBehavior="close" />
  ), []);

  const fetchSavedItems = async () => {
    setIsLoading(true); setFetchError(null);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { setFetchError('User not available.'); return; }
      const { data, error } = await supabase
        .from('user_saved_items')
        .select('id, item_name, price, description')
        .eq('user_id', user.id)
        .order('item_name', { ascending: true });
      if (error) throw error;
      const items = (data || []).map((d: any) => ({ id: d.id, itemName: d.item_name, price: d.price, description: d.description }));
      if (!isOpen) return;
      setSavedItems(items);
      setFilteredSavedItems(items);
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load items.');
    } finally { if (isOpen) setIsLoading(false); }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    const q = text.toLowerCase();
    setFilteredSavedItems(savedItems.filter(i => i.itemName.toLowerCase().includes(q)));
  };

  const handleSavedItemSelect = (item: DisplayableSavedItem) => {
    if (onItemFromFormSaved) {
      const payload: NewItemData = {
        id: Date.now().toString(),
        itemName: item.itemName,
        price: item.price,
        quantity: 1,
        description: item.description,
        saved_item_db_id: item.id,
      };
      onItemFromFormSaved(payload);
    }
    bottomSheetModalRef.current?.dismiss();
  };

  const handleAddNewItem = () => addNewItemFormSheetRef.current?.present();

  const styles = StyleSheet.create({
    modalHeaderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border, backgroundColor: themeColors.card },
    modalHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: themeColors.foreground, textAlign: 'center', flex: 1 },
    modalHeaderSpacer: { width: 34 },
    container: { flex: 1, paddingHorizontal: 16, backgroundColor: themeColors.card, minHeight: 300 },
    addNewButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.primary, paddingVertical: 12, borderRadius: 8, marginBottom: 20 },
    addNewButtonText: { color: themeColors.primaryForeground, fontSize: 17, fontWeight: '600', marginLeft: 8 },
    handleIndicator: { backgroundColor: themeColors.mutedForeground },
    modalBackground: { backgroundColor: themeColors.card },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: themeColors.input, borderRadius: 8, paddingHorizontal: 12, marginBottom: 16, borderWidth: 1, borderColor: themeColors.border },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 16, color: themeColors.foreground },
    listContentContainer: { paddingBottom: 20 },
    savedItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
    savedItemInfo: { flex: 1, marginRight: 10 },
    savedItemName: { fontSize: 16, fontWeight: '600', color: themeColors.foreground },
    savedItemDescription: { fontSize: 13, color: themeColors.mutedForeground, marginTop: 2 },
    savedItemPrice: { fontSize: 16, fontWeight: '500', color: themeColors.foreground },
    loadingIndicatorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 20 },
    errorText: { textAlign: 'center', color: themeColors.destructive, fontSize: 14, paddingVertical: 20 },
    emptyListText: { textAlign: 'center', color: themeColors.mutedForeground, fontSize: 14, paddingVertical: 20 },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onChange={(i) => {
        const open = i !== -1;
        setIsOpen(open);
        if (open) fetchSavedItems();
      }}
      onDismiss={() => { setIsOpen(false); setIsLoading(false); setFetchError(null); setSavedItems([]); setFilteredSavedItems([]); }}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
      enableDynamicSizing={false}
      enablePanDownToClose={!isLoading && !isChildOpen}
      enableContentPanningGesture={!isChildOpen}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      topInset={Math.max(12, insets.top)}
    >
      <View style={styles.modalHeaderContainer}>
        <View style={styles.modalHeaderSpacer} />
        <Text style={styles.modalHeaderTitle}>Add Item or Service</Text>
        <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()}>
          <X size={24} color={themeColors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <View style={styles.container}>
        <TouchableOpacity style={styles.addNewButton} onPress={handleAddNewItem}>
          <PlusCircle size={22} color={themeColors.primaryForeground} />
          <Text style={styles.addNewButtonText}>Add New</Text>
        </TouchableOpacity>

        <View style={styles.searchContainer}>
          <Search size={20} color={themeColors.foreground} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search saved items"
            placeholderTextColor={themeColors.mutedForeground}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {isOpen ? (
          <FlatList
            data={filteredSavedItems}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSavedItemSelect(item)}>
                <View style={styles.savedItemRow}>
                  <View style={styles.savedItemInfo}>
                    <Text style={styles.savedItemName}>{item.itemName}</Text>
                    {item.description && <Text style={styles.savedItemDescription}>{item.description}</Text>}
                  </View>
                  <Text style={styles.savedItemPrice}>{getCurrencySymbol(currencyCode)}{item.price.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.listContentContainer, filteredSavedItems.length === 0 && { flex: 1, justifyContent: 'center' }]}
            ListEmptyComponent={
              <View>
                {isLoading && (
                  <View style={styles.loadingIndicatorContainer}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                  </View>
                )}
                {fetchError && <Text style={styles.errorText}>{fetchError}</Text>}
                {!isLoading && !fetchError && filteredSavedItems.length === 0 && searchQuery === '' && (
                  <Text style={styles.emptyListText}>No saved items yet. Add some!</Text>
                )}
                {!isLoading && !fetchError && filteredSavedItems.length === 0 && searchQuery !== '' && (
                  <Text style={styles.emptyListText}>No items match your search.</Text>
                )}
              </View>
            }
            style={{ flex: 1, minHeight: 200 }}
          />
        ) : (
          <View style={{ paddingVertical: 24 }} />
        )}
      </View>

      <AddNewItemFormSheet ref={addNewItemFormSheetRef} onSave={onItemFromFormSaved || (() => {})} onOpenChange={setIsChildOpen} />
    </BottomSheetModal>
  );
});

export default AddItemSheetStable;


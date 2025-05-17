import React, { forwardRef, useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { PlusCircle, Search } from 'lucide-react-native';
import AddNewItemFormSheet, { AddNewItemFormSheetRef, NewItemData } from './AddNewItemFormSheet';

// --- Supabase Integration --- 
import { supabase } from '../../../../lib/supabase'; 
// --- End Supabase Integration ---

// Define the structure for displayable saved items
export interface DisplayableSavedItem {
  id: string; // Database ID from user_saved_items
  itemName: string;
  price: number;
  description?: string | null;
}

// Define the props for this component
export interface AddItemSheetProps {
  onItemFromFormSaved?: (itemData: NewItemData) => void; // Callback when an item is added
}

// Define the type for the ref
export interface AddItemSheetRef {
  present: () => void;
  dismiss: () => void;
}

const AddItemSheet = forwardRef<AddItemSheetRef, AddItemSheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const addNewItemFormSheetRef = useRef<AddNewItemFormSheetRef>(null);

  // State for saved items
  const [savedItems, setSavedItems] = useState<DisplayableSavedItem[]>([]);
  const [filteredSavedItems, setFilteredSavedItems] = useState<DisplayableSavedItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSavedItems = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      // Fetch the current user's session/ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        setFetchError('User not available or error fetching user.');
        console.error('User error:', userError);
        setIsLoading(false);
        return;
      }
      
      // RLS should handle filtering by user_id on the backend if set up.
      // The .eq('user_id', user.id) is an explicit client-side filter, good for clarity or if RLS isn't fully restrictive.
      const { data, error: dbError } = await supabase
        .from('user_saved_items')
        .select('id, item_name, price, description')
        .eq('user_id', user.id) // Ensure this matches your column name if RLS isn't solely relied upon
        .order('item_name', { ascending: true });

      if (dbError) throw dbError;

      if (data) {
        const items: DisplayableSavedItem[] = data.map((dbItem: any) => ({
          id: dbItem.id,
          itemName: dbItem.item_name,
          price: dbItem.price,
          description: dbItem.description,
        }));
        setSavedItems(items);
        setFilteredSavedItems(items); // Initialize filtered list with all items
      }
    } catch (e: any) {
      console.error('Error fetching saved items:', e);
      setFetchError('Failed to load saved items.');
    } finally {
      setIsLoading(false);
    }
  };

  // Expose present/dismiss methods via the forwarded ref
  React.useImperativeHandle(ref, () => ({
    present: () => {
      fetchSavedItems(); // Fetch items when modal is presented
      bottomSheetModalRef.current?.present();
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  const snapPoints = useMemo(() => ['60%', '85%'], []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7} // Standard backdrop opacity
      />
    ),
    []
  );

  // Placeholder for opening the 'Add New Item Form' modal
  const handleAddNewItem = () => {
    addNewItemFormSheetRef.current?.present();
  };

  // Handler for when a new item is 'saved' from AddNewItemFormSheet
  const handleNewItemSaved = (itemData: NewItemData) => {
    console.log('New item data received in AddItemSheet:', itemData);
    // Pass the data up to the parent component (create.tsx)
    if (props.onItemFromFormSaved) {
      props.onItemFromFormSaved(itemData);
    }
    // Optionally dismiss AddItemSheet as well, or let create.tsx decide
    // bottomSheetModalRef.current?.dismiss();
  };

  const handleSavedItemSelect = (item: DisplayableSavedItem) => {
    if (props.onItemFromFormSaved) {
      const itemDataForInvoice: NewItemData = {
        id: Date.now().toString(), // Generate a temporary local ID for the invoice line item
        itemName: item.itemName,
        price: item.price,
        quantity: 1, // Default quantity to 1, can be adjusted later on the invoice screen if needed
        description: item.description,
        saved_item_db_id: item.id, // This is the crucial ID from user_saved_items
      };
      props.onItemFromFormSaved(itemDataForInvoice);
    }
    bottomSheetModalRef.current?.dismiss(); // Dismiss this sheet after selection
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: Platform.OS === 'ios' ? 0 : 20, // Adjust top padding for Android if handle is an issue
    },
    title: {
      fontSize: 22,
      fontWeight: 'bold',
      color: themeColors.foreground,
      marginBottom: 20,
      textAlign: 'center',
    },
    addNewButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors.primary,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 20,
    },
    addNewButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 17,
      fontWeight: '600',
      marginLeft: 8,
    },
    listPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listPlaceholderText: {
      fontSize: 16,
      color: themeColors.mutedForeground,
    },
    handleIndicator: {
      backgroundColor: themeColors.mutedForeground,
    },
    modalBackground: {
      backgroundColor: themeColors.card,
    },
    // Styles for search bar
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.input, // Or a more specific search bar background
      borderRadius: 8,
      paddingHorizontal: 12,
      marginBottom: 16, // Space below search bar
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 16,
      color: themeColors.foreground,
    },
    // Styles for saved items list
    listContentContainer: {
      paddingBottom: 20, // Ensure space at the bottom of the scroll
    },
    savedItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 4, // Slight horizontal padding for items
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    savedItemInfo: {
      flex: 1, // Allow text to take available space and wrap if needed
      marginRight: 10,
    },
    savedItemName: {
      fontSize: 16,
      fontWeight: '600',
      color: themeColors.foreground,
    },
    savedItemDescription: {
      fontSize: 13,
      color: themeColors.mutedForeground,
      marginTop: 2,
    },
    savedItemPrice: {
      fontSize: 16,
      fontWeight: '500',
      color: themeColors.foreground, // Changed from themeColors.primary
    },
    loadingIndicatorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
    },
    errorText: {
      textAlign: 'center',
      color: themeColors.destructive,
      fontSize: 14,
      paddingVertical: 20,
    },
    emptyListText: {
      textAlign: 'center',
      color: themeColors.mutedForeground,
      fontSize: 14,
      paddingVertical: 20,
    },
  });

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    const filteredItems = savedItems.filter((item) => item.itemName.toLowerCase().includes(text.toLowerCase()));
    setFilteredSavedItems(filteredItems);
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef} // Use the local ref here
      index={0} // Start at the first snap point
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.modalBackground}
    >
      <View style={styles.container}>
        <Text style={styles.title}>Add Item or Service</Text>

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
          />
        </View>

        <BottomSheetScrollView contentContainerStyle={{ flexGrow: 1 }}>
          {/* Placeholder for the list of previously saved items */}
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

          <FlatList
            data={filteredSavedItems}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleSavedItemSelect(item)}>
                <View style={styles.savedItemRow}>
                  <View style={styles.savedItemInfo}>
                    <Text style={styles.savedItemName}>{item.itemName}</Text>
                    {item.description && <Text style={styles.savedItemDescription}>{item.description}</Text>}
                  </View>
                  <Text style={styles.savedItemPrice}>${item.price.toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContentContainer}
          />
        </BottomSheetScrollView>
      </View>
      {/* Render the AddNewItemFormSheet modal so it can be presented */}
      <AddNewItemFormSheet ref={addNewItemFormSheetRef} onSave={handleNewItemSaved} />
    </BottomSheetModal>
  );
});

export default AddItemSheet;

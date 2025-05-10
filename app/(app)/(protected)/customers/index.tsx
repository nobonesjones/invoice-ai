import { View, Text, TextInput, StyleSheet, SafeAreaView, FlatList, Pressable, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search } from 'lucide-react-native'; 
import { colors } from '@/constants/colors';
import CustomerListItem, { Customer } from '@/components/CustomerListItem';
import CreateNewClientSheet, { Client as ClientType } from './CreateNewClientSheet'; // Import the local, cloned sheet. ClientType might be from here now.
import { BottomSheetModal } from '@gorhom/bottom-sheet'; 
import { supabase } from '@/config/supabase';

export default function CustomersScreen() {
  console.log('--- CustomersScreen Component Render ---'); 
  console.log('--- CUSTOMERS SCREEN V3 DIAGNOSTIC LOG --- File loaded at:', new Date().toISOString()); // <-- DIAGNOSTIC LOG KEPT FOR VERIFICATION
  const theme = colors.light;
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const params = useLocalSearchParams<{ selectionMode?: string; origin?: string }>();
  const addNewClientSheetRef = useRef<BottomSheetModal>(null); // Use a ref name suitable for the local sheet

  const fetchClients = async () => {
    console.log('Fetching clients from Supabase...');
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) {
        console.error('Error getting user:', userError.message);
        setError('Authentication error. Please log in again.');
        setLoading(false);
        setCustomers([]);
        return;
      }
      if (!userData || !userData.user) {
        console.log('No authenticated user found.');
        setError('User not authenticated. Please log in.');
        setLoading(false);
        setCustomers([]);
        return;
      }
      console.log('Authenticated user ID for fetch:', userData.user.id);

      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('id, name, email, phone, avatar_url')
        .eq('user_id', userData.user.id)
        .order('name', { ascending: true });

      if (fetchError) {
        console.error('Error fetching clients from Supabase:', fetchError.message);
        throw fetchError;
      }
      
      console.log('Successfully fetched clients:', data ? data.length : 0);
      setCustomers(data as Customer[] || []);
    } catch (e: any) {
      console.error('Detailed error in fetchClients:', e);
      setError('Failed to load clients. Please try again.');
      setCustomers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [params.selectionMode]);

  // This handler will now be for the local CreateNewClientSheet
  // Renaming for clarity, though its function (handling a selected client) is similar for now
  const handleClientAddedOrSelected = useCallback((client: ClientType) => {
    console.log('Client selected/added via CreateNewClientSheet:', client);
    addNewClientSheetRef.current?.dismiss();
    fetchClients(); // Refresh client list as a new one might have been created or an existing one selected
  }, []);

  // Function to open the local CreateNewClientSheet
  // Renaming for clarity
  const openAddNewClientSheet = useCallback(() => {
    console.log('Attempting to open local CreateNewClientSheet from customers/index.tsx');
    addNewClientSheetRef.current?.present();
  }, []);

  const handleSaveNewClient = (newClient: any) => {
    // This function might become more relevant if CreateNewClientSheet is modified to specifically *save* a new client
    // For now, the cloned sheet uses onClientSelect for any client interaction.
    console.log('handleSaveNewClient called (currently a placeholder):', newClient);
    fetchClients();
    addNewClientSheetRef.current?.dismiss(); 
  };

  const handleCloseAddNewClientSheet = () => {
    console.log('Local CreateNewClientSheet closed');
  };

  const renderCustomerItem = ({ item }: { item: Customer }) => (
    <CustomerListItem
      customer={item}
      onPress={() => {
        if (params.selectionMode === 'true' && params.origin) {
          router.push({
            pathname: params.origin as any, 
            params: { selectedClientId: item.id, selectedClientName: item.name },
          });
        } else {
          router.push(`/(app)/(protected)/customers/${item.id}`);
        }
      }}
    />
  );

  const ItemSeparator = () => <View style={styles.divider} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Clients</Text>
          <TouchableOpacity
            onPress={openAddNewClientSheet} // Use the new function for the local sheet
            style={styles.addClientButton} 
            activeOpacity={0.7} 
          >
            <Text style={styles.addClientButtonText}>+ Add Client</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBarContainer}>
          <Search size={20} color={theme.mutedForeground} style={styles.searchIcon} />
          <TextInput
            placeholder="Search Customers"
            placeholderTextColor={theme.mutedForeground}
            style={styles.searchInput}
            // TODO: Implement search functionality
          />
        </View>
        <FlatList
          data={customers}
          renderItem={renderCustomerItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={ItemSeparator}
          contentContainerStyle={styles.listContentContainer}
          ListEmptyComponent={() => {
            if (loading) return <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 20 }} />;
            if (error) return <Text style={styles.emptyListTextError}>{error}</Text>;
            if (!customers.length) return <Text style={styles.emptyListText}>No clients yet. Click "+ Add Client" to get started!</Text>;
            return null;
          }}
        />
      </View>
      <CreateNewClientSheet 
        ref={addNewClientSheetRef} 
        onClose={handleCloseAddNewClientSheet} // Keep onClose if needed
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.light.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 0,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  listContentContainer: {
    paddingBottom: 20,
    flexGrow: 1, // Ensure it can grow if content is less
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.light.foreground,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light.input,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    marginBottom: 16,
    marginHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.light.foreground,
    height: Platform.OS === 'ios' ? undefined : 24, 
  },
  divider: {
    height: 1,
    backgroundColor: colors.light.border,
    marginLeft: 16 + 40 + 12, 
  },
  addClientButton: {
    backgroundColor: colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20, 
    flexDirection: 'row',
    alignItems: 'center',
  },
  addClientButtonText: {
    color: colors.light.primaryForeground,
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyListText: {
    textAlign: 'center', 
    marginTop: 50, 
    color: colors.light.mutedForeground, 
    fontSize: 16,
    paddingHorizontal: 16,
  },
  emptyListTextError: {
    textAlign: 'center', 
    marginTop: 50, 
    color: colors.light.destructive, 
    fontSize: 16,
    paddingHorizontal: 16,
  },
});

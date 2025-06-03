import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { FlashList } from "@shopify/flash-list";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Search, PlusCircle } from "lucide-react-native";
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
	View,
	Text,
	TextInput,
	StyleSheet,
	SafeAreaView,
	Pressable,
	ActivityIndicator,
	Platform,
	TouchableOpacity,
	Animated,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';

import CreateNewClientSheet from "./CreateNewClientSheet";

import CustomerListItem, { Customer } from "@/components/CustomerListItem";
import { colors } from "@/constants/colors";
import { supabase } from "@/lib/supabase";
import { useShineAnimation } from '@/lib/hooks/useShineAnimation';

export default function CustomersScreen() {
	console.log("--- CustomersScreen Component Render ---");
	console.log(
		"--- CUSTOMERS SCREEN V3 DIAGNOSTIC LOG --- File loaded at:",
		new Date().toISOString(),
	);

	const theme = colors.light;
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [searchTerm, setSearchTerm] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();
	const params = useLocalSearchParams<{
		selectionMode?: string;
		origin?: string;
	}>();
	const addNewClientSheetRef = useRef<BottomSheetModal>(null);

	// Filter customers based on search term
	const filteredCustomers = customers.filter((customer) => {
		if (!searchTerm.trim()) return true;
		
		const searchLower = searchTerm.toLowerCase().trim();
		const nameMatch = customer.name?.toLowerCase().includes(searchLower);
		const emailMatch = customer.email?.toLowerCase().includes(searchLower);
		const phoneMatch = customer.phone?.toLowerCase().includes(searchLower);
		
		return nameMatch || emailMatch || phoneMatch;
	});

	const fetchClients = useCallback(async () => {
		console.log("Fetching clients from Supabase...");
		setLoading(true);
		setError(null);
		try {
			const { data: userData, error: userError } =
				await supabase.auth.getUser();
			if (userError) {
				console.error("Error getting user:", userError.message);
				setError("Authentication error. Please log in again.");
				setLoading(false);
				setCustomers([]);
				return;
			}
			if (!userData || !userData.user) {
				console.log("No authenticated user found.");
				setError("User not authenticated. Please log in.");
				setLoading(false);
				setCustomers([]);
				return;
			}
			console.log("Authenticated user ID for fetch:", userData.user.id);

			const { data, error: fetchError } = await supabase
				.from("clients")
				.select("id, name, email, phone, avatar_url")
				.eq("user_id", userData.user.id)
				.order("name", { ascending: true });

			if (fetchError) {
				console.error(
					"Error fetching clients from Supabase:",
					fetchError.message,
				);
				throw fetchError;
			}

			console.log("Successfully fetched clients:", data ? data.length : 0);
			setCustomers((data as Customer[]) || []);
		} catch (e: any) {
			console.error("Detailed error in fetchClients:", e);
			setError("Failed to load clients. Please try again.");
			setCustomers([]);
		}
		setLoading(false);
	}, []);

	useEffect(() => {
		console.log(
			"CustomersScreen: useEffect calling fetchClients. Selection mode:",
			params.selectionMode,
		);
		fetchClients();
	}, [fetchClients, params.selectionMode]);

	const handleClientAdded = useCallback(() => {
		console.log("CustomersScreen: Client added, refreshing list...");
		fetchClients();
	}, [fetchClients]);

	const openAddNewClientSheet = useCallback(() => {
		console.log("CustomersScreen: Attempting to open CreateNewClientSheet");
		addNewClientSheetRef.current?.present();
	}, []);

	const handleCloseAddNewClientSheet = () => {
		console.log("CustomersScreen: CreateNewClientSheet closed");
	};

	const handleSearchChange = (text: string) => {
		setSearchTerm(text);
	};

  // Shine animation for Add Client button
  const addClientButtonShineX = useShineAnimation({
    duration: 1000,
    delay: 3500, // Different delay for variety
    outputRange: [-150, 150] 
  });

	const renderCustomerItem = ({ item }: { item: Customer }) => (
		<CustomerListItem
			customer={item}
			onPress={() => {
				if (params.selectionMode === "true" && params.origin) {
					router.push({
						pathname: params.origin as any,
						params: {
							selectedClientId: item.id,
							selectedClientName: item.name,
						},
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
						onPress={openAddNewClientSheet}
						style={styles.addClientButton}
						activeOpacity={0.7}
					>
            <Animated.View 
              style={[
                styles.shineOverlay, 
                { transform: [{ translateX: addClientButtonShineX }] }
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.shineGradient} 
              />
            </Animated.View>
            <PlusCircle size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
						<Text style={styles.addClientButtonText}>Add Client</Text>
					</TouchableOpacity>
				</View>
				<View style={styles.searchBarContainer}>
					<Search
						size={20}
						color={theme.mutedForeground}
						style={styles.searchIcon}
					/>
					<TextInput
						placeholder="Search by name, email, or phone"
						placeholderTextColor={theme.mutedForeground}
						style={styles.searchInput}
						value={searchTerm}
						onChangeText={handleSearchChange}
						autoCorrect={false}
						autoCapitalize="none"
					/>
				</View>
				<FlashList
					data={filteredCustomers}
					renderItem={renderCustomerItem}
					keyExtractor={(item) => item.id}
					ItemSeparatorComponent={ItemSeparator}
					contentContainerStyle={styles.listContentContainer}
					estimatedItemSize={75}
					ListEmptyComponent={() => {
						if (loading)
							return (
								<ActivityIndicator
									size="large"
									color={theme.primary}
									style={{ marginTop: 20 }}
								/>
							);
						if (error)
							return <Text style={styles.emptyListTextError}>{error}</Text>;
						if (searchTerm.trim() && !filteredCustomers.length)
							return (
								<Text style={styles.emptyListText}>
									No clients found matching "{searchTerm}". Try a different search term.
								</Text>
							);
						if (!customers.length)
							return (
								<Text style={styles.emptyListText}>
									No clients yet. Click "+ Add Client" to get started!
								</Text>
							);
						return null;
					}}
				/>
			</View>
			<CreateNewClientSheet
				ref={addNewClientSheetRef}
				onClose={handleCloseAddNewClientSheet}
				onClientAdded={handleClientAdded}
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
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	listContentContainer: {
		paddingBottom: 20,
		flexGrow: 1,
	},
	title: {
		fontSize: 30,
		fontWeight: "bold",
		color: colors.light.foreground,
	},
	searchBarContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: colors.light.input,
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: Platform.OS === "ios" ? 12 : 10,
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
		height: Platform.OS === "ios" ? undefined : 24,
	},
	addClientButton: {
		backgroundColor: colors.light.primary,
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
		flexDirection: 'row',
		alignItems: 'center',
		overflow: 'hidden',
		position: 'relative',
	},
	addClientButtonText: {
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "600",
	},
	divider: {
		height: 1,
		backgroundColor: colors.light.border,
		marginHorizontal: 16,
	},
	emptyListText: {
		textAlign: "center",
		marginTop: 50,
		fontSize: 16,
		color: colors.light.mutedForeground,
	},
	emptyListTextError: {
		textAlign: "center",
		marginTop: 50,
		fontSize: 16,
		color: colors.light.destructive,
	},
  shineOverlay: { 
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, 
  },
  shineGradient: { 
    width: '100%',
    height: '100%',
  },
});

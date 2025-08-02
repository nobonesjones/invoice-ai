import {
	BottomSheetModal,
	BottomSheetBackdrop,
	BottomSheetTextInput,
	BottomSheetFlatList,
} from "@gorhom/bottom-sheet";
import {
	X,
	Search,
	PlusCircle,
	UserPlus,
	User as UserIcon,
} from "lucide-react-native";
import React, {
	useMemo,
	useCallback,
	useState,
	useEffect,
	forwardRef,
} from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	TextInput,
	FlatList,
	Image,
	ActivityIndicator,
	Platform,
	Alert,
} from "react-native";

import * as Contacts from 'expo-contacts';
import { supabase } from "@/config/supabase"; // Assuming your Supabase client is exported from here
import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";
import CreateNewClientSheet, { CreateNewClientSheetRef } from "../customers/CreateNewClientSheet";
import { useRef } from "react";
import { Tables } from '../../../../types/database.types';

export type Client = Tables<'clients'>;

interface NewClientSelectionSheetProps {
	onClientSelect: (client: Client) => void;
	onClose?: () => void;
}

const NewClientSelectionSheet = forwardRef<
	BottomSheetModal,
	NewClientSelectionSheetProps
>(({ onClientSelect, onClose }, ref) => {
	const createNewClientSheetRef = useRef<CreateNewClientSheetRef>(null);
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const styles = getStyles(themeColors);

	const [searchTerm, setSearchTerm] = useState("");
	const [clients, setClients] = useState<Client[]>([]);
	const [filteredClients, setFilteredClients] = useState<Client[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const snapPoints = useMemo(() => ["90%", "85%"], []);

	const handleAddFromContacts = async () => {
		try {
			// Check if running in Expo Go
			if (!Contacts.requestPermissionsAsync) {
				Alert.alert(
					'Feature Not Available',
					'Contact access requires a development build. Please use manual entry instead.',
					[{ text: 'OK' }]
				);
				return;
			}

			// Request contacts permission
			const { status } = await Contacts.requestPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert(
					'Permission Required',
					'Please allow access to contacts to use this feature.',
					[{ text: 'OK' }]
				);
				return;
			}

			// Get contacts
			const { data } = await Contacts.getContactsAsync({
				fields: [
					Contacts.Fields.Name,
					Contacts.Fields.PhoneNumbers,
					Contacts.Fields.Emails,
				],
				sort: Contacts.SortTypes.FirstName,
			});

			if (data.length === 0) {
				Alert.alert('No Contacts', 'No contacts found on your device.');
				return;
			}

			// Show contact selection
			const contactOptions = data
				.slice(0, 50) // Limit to first 50 contacts for performance
				.map((contact, index) => ({
					text: contact.name || `Contact ${index + 1}`,
					onPress: async () => {
						// Create client directly from contact
						try {
							const { data: newClient, error } = await supabase
								.from('clients')
								.insert([
									{
										name: contact.name || `Contact ${index + 1}`,
										email: contact.emails?.[0]?.email || null,
										phone: contact.phoneNumbers?.[0]?.number || null,
									}
								])
								.select()
								.single();

							if (error) throw error;

							// Select the newly created client
							onClientSelect(newClient);
							
							// Refresh the client list
							fetchClients();
						} catch (error) {
							console.error('Error creating client from contact:', error);
							Alert.alert('Error', 'Failed to create client from contact.');
						}
					}
				}));

			// Add cancel option
			contactOptions.push({
				text: 'Cancel',
				style: 'cancel',
				onPress: () => {}
			});

			Alert.alert(
				'Select Contact',
				'Choose a contact to create as client:',
				contactOptions
			);
		} catch (error) {
			console.error('Error accessing contacts:', error);
			Alert.alert(
				'Error',
				'Unable to access contacts. Please try again.',
				[{ text: 'OK' }]
			);
		}
	};

	const fetchClients = async () => {
		setLoading(true);
		setError(null);
		try {
			const { data, error: fetchError } = await supabase
				.from("clients")
				.select("*")
				.order("name", { ascending: true });

			if (fetchError) throw fetchError;
			setClients(data || []);
			setFilteredClients(data || []);
		} catch (e: any) {
			console.error("Error fetching clients:", e);
			setError("Failed to load clients. Please try again.");
			setClients([]); // Clear clients on error
			setFilteredClients([]);
		}
		setLoading(false);
	};

	useEffect(() => {
		fetchClients();
	}, []);

	useEffect(() => {
		if (searchTerm === "") {
			setFilteredClients(clients);
		} else {
			setFilteredClients(
				clients.filter((client) =>
					client.name.toLowerCase().includes(searchTerm.toLowerCase()),
				),
			);
		}
	}, [searchTerm, clients]);

	const renderBackdrop = useCallback(
		(props: any) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
				pressBehavior="close"
			/>
		),
		[],
	);

	const handleSelectClient = (client: Client) => {
		onClientSelect(client);
		(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
	};

	const renderClientItem = ({ item }: { item: Client }) => (
		<TouchableOpacity
			style={styles.clientItem}
			onPress={() => handleSelectClient(item)}
		>
			{item.avatar_url ? (
				<Image source={{ uri: item.avatar_url }} style={styles.avatar} />
			) : (
				<View style={[styles.avatar, styles.avatarPlaceholder]}>
					<UserIcon size={20} color={themeColors.mutedForeground} />
				</View>
			)}
			<Text style={styles.clientName}>{item.name}</Text>
		</TouchableOpacity>
	);

	const renderHeader = () => (
		<View style={styles.headerContainer}>
			<Text style={styles.title}>Select Client</Text>
			<TouchableOpacity
				onPress={() =>
					(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()
				}
				style={styles.closeButton}
			>
				<X size={24} color={themeColors.mutedForeground} />
			</TouchableOpacity>
		</View>
	);

	const renderEmptyComponent = () => {
		if (loading)
			return (
				<ActivityIndicator
					size="large"
					color={themeColors.primary}
					style={{ marginTop: 20 }}
				/>
			);
		if (error) return <Text style={styles.errorText}>{error}</Text>;
		if (!clients.length)
			return (
				<Text style={styles.emptyText}>
					No clients found. Add one to get started!
				</Text>
			);
		if (!filteredClients.length && searchTerm)
			return (
				<Text style={styles.emptyText}>No clients match "{searchTerm}"</Text>
			);
		return null;
	};

	return (
		<BottomSheetModal
			ref={ref}
			index={0}
			snapPoints={snapPoints}
			backdropComponent={renderBackdrop}
			onDismiss={onClose}
			handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
			backgroundStyle={{ backgroundColor: themeColors.card }}
		>
			{renderHeader()}
			<View style={styles.searchContainer}>
				<Search
					size={20}
					color={themeColors.mutedForeground}
					style={styles.searchIcon}
				/>
				<BottomSheetTextInput
					style={styles.searchInput}
					placeholder="Search name or number..."
					placeholderTextColor={themeColors.mutedForeground}
					value={searchTerm}
					onChangeText={setSearchTerm}
				/>
			</View>

			<View style={styles.actionButtonsContainer}>
				<TouchableOpacity
					style={styles.actionButton}
					onPress={handleAddFromContacts}
				>
					<PlusCircle
						size={20}
						color={themeColors.primary}
						style={styles.actionButtonIcon}
					/>
					<Text style={styles.actionButtonText}>Add from Device Contacts</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.actionButton}
					onPress={() => createNewClientSheetRef.current?.present()}
				>
					<UserPlus
						size={20}
						color={themeColors.primary}
						style={styles.actionButtonIcon}
					/>
					<Text style={styles.actionButtonText}>Create New Client</Text>
				</TouchableOpacity>

				{/* Create New Client Sheet Modal */}
				<CreateNewClientSheet
					ref={createNewClientSheetRef}
					onClose={() => {}}
					onClientAdded={async (newClient: Client) => {
						await fetchClients();
						// Try to find in the freshly fetched list
						const found = filteredClients.find(c => c.id === newClient.id) || newClient;
						handleSelectClient(found);
					}}
				/>
			</View>

			<BottomSheetFlatList
				data={filteredClients}
				renderItem={renderClientItem}
				keyExtractor={(item) => item.id}
				style={{ flex: 1 }}
				contentContainerStyle={[styles.listContentContainer, { flexGrow: 1 }]}
				ListEmptyComponent={renderEmptyComponent}
				keyboardShouldPersistTaps="handled"
			/>
		</BottomSheetModal>
	);
});

const getStyles = (themeColors: typeof colors.light) =>
	StyleSheet.create({
		headerContainer: {
			flexDirection: "row",
			justifyContent: "center",
			alignItems: "center",
			paddingVertical: Platform.OS === "ios" ? 12 : 16,
			paddingHorizontal: 16,
			borderBottomWidth: 1,
			borderBottomColor: themeColors.border,
		},
		title: {
			fontSize: 18,
			fontWeight: "600",
			color: themeColors.foreground,
			textAlign: "center",
		},
		closeButton: {
			position: "absolute",
			right: 16,
			top: Platform.OS === "ios" ? 10 : 14, // Adjust for better vertical alignment
			padding: 4, // Increase tappable area
		},
		searchContainer: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: themeColors.card, // Directly use card color
			borderRadius: 10,
			paddingHorizontal: 12,
			marginHorizontal: 16,
			marginTop: 16,
			marginBottom: 8, // Space before action buttons
			height: 44, // WhatsApp like height
			borderWidth: 1, // Subtle border
			borderColor: themeColors.border,
		},
		searchIcon: {
			marginRight: 8,
		},
		searchInput: {
			flex: 1,
			fontSize: 16,
			color: themeColors.foreground,
			height: "100%", // Ensure TextInput fills the container height
		},
		actionButtonsContainer: {
			paddingHorizontal: 16,
			paddingVertical: 8,
			borderBottomWidth: 1,
			borderBottomColor: themeColors.border,
		},
		actionButton: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: 12,
		},
		actionButtonIcon: {
			marginRight: 12,
		},
		actionButtonText: {
			fontSize: 16,
			color: themeColors.primary,
			fontWeight: "500",
		},
		listContentContainer: {
			paddingHorizontal: 0, // List items will have their own padding
			paddingBottom: 20,
		},
		clientItem: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: 12,
			paddingHorizontal: 16, // WhatsApp style padding
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		avatar: {
			width: 40,
			height: 40,
			borderRadius: 20, // Circular avatar
			marginRight: 16,
			backgroundColor: themeColors.border, // Placeholder background
		},
		avatarPlaceholder: {
			justifyContent: "center",
			alignItems: "center",
			backgroundColor: themeColors.border, // Or a slightly different placeholder color
		},
		clientName: {
			fontSize: 17, // Slightly larger font for names
			color: themeColors.foreground,
		},
		errorText: {
			textAlign: "center",
			color: themeColors.statusDue,
			marginTop: 20,
			paddingHorizontal: 16,
		},
		emptyText: {
			textAlign: "center",
			color: themeColors.mutedForeground,
			marginTop: 20,
			fontSize: 15,
			paddingHorizontal: 16,
		},
	});

export default NewClientSelectionSheet;

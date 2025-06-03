import {
	BottomSheetModal,
	BottomSheetBackdrop,
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { X, UserPlus } from "lucide-react-native";
import React, {
	useMemo,
	useCallback,
	useState,
	forwardRef,
	useRef,
	useEffect,
} from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Platform,
	ActivityIndicator,
	Alert,
} from "react-native";

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";
import { supabase } from "@/lib/supabase";
import { Tables } from '../../../../types/database.types';

type Client = Tables<'clients'>;

// Define a specific type for the ref handle
export interface CreateNewClientSheetRef {
	present: () => void;
	dismiss: () => void;
}

interface CreateNewClientSheetProps {
	onClose?: () => void;
	onClientAdded?: (client: Client) => void;
	editMode?: boolean;
	initialData?: Client | null;
}

const CreateNewClientSheet = forwardRef<
	CreateNewClientSheetRef,
	CreateNewClientSheetProps
>(({ onClose, onClientAdded, editMode, initialData }, ref) => {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;

	const bottomSheetModalRef = useRef<BottomSheetModal>(null);

	const [fullName, setFullName] = useState(editMode && initialData ? initialData.name : "");
	const [email, setEmail] = useState(editMode && initialData ? initialData.email || "" : "");
	const [phone, setPhone] = useState(editMode && initialData ? initialData.phone || "" : "");
	const [taxNumber, setTaxNumber] = useState(editMode && initialData ? initialData.tax_number || "" : "");
	const [address, setAddress] = useState(editMode && initialData ? formatInitialAddress(initialData) : "");
	const [isLoading, setIsLoading] = useState(false);

	// Update form fields when initialData changes (important for edit mode)
	useEffect(() => {
		console.log('[CreateNewClientSheet] Props changed:', { editMode, initialData });
		if (editMode && initialData) {
			setFullName(initialData.name || "");
			setEmail(initialData.email || "");
			setPhone(initialData.phone || "");
			setTaxNumber(initialData.tax_number || "");
			setAddress(formatInitialAddress(initialData));
		} else if (!editMode) {
			// Clear form when switching to create mode
			setFullName("");
			setEmail("");
			setPhone("");
			setTaxNumber("");
			setAddress("");
		}
	}, [editMode, initialData]);

	const snapPoints = useMemo(() => ["70%", "90%"], []);

	// Helper function to format address from database fields
	function formatInitialAddress(client: Client): string {
		// Since we only have address_client field, return it directly
		return client.address_client || '';
	}

	React.useImperativeHandle(ref, () => ({
		present: () => bottomSheetModalRef.current?.present(),
		dismiss: () => bottomSheetModalRef.current?.dismiss(),
	}));

	const renderBackdrop = useCallback(
		(props: any) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.7}
				pressBehavior="close"
			/>
		),
		[],
	);

	const internalClose = () => {
		bottomSheetModalRef.current?.dismiss();
		if (onClose) {
			onClose();
		}
	};

	const handleSaveClient = async () => {
		if (!fullName.trim()) {
			Alert.alert("Validation Error", "Full Name is required.");
			return;
		}
		setIsLoading(true);
		try {
			const {
				data: { user },
				error: userError,
			} = await supabase.auth.getUser();
			if (userError || !user) {
				Alert.alert(
					"Error",
					"Could not get user information. Please try again.",
				);
				setIsLoading(false);
				return;
			}

			const clientData = {
				name: fullName.trim(),
				email: email.trim() || null,
				phone: phone.trim() || null,
				tax_number: taxNumber.trim() || null,
				address_client: address.trim() || null, // Match the database column name
				user_id: user.id,
			};

			if (editMode && initialData) {
				// Update existing client
				console.log('[handleSaveClient] Updating client:', initialData.id, 'with data:', clientData);
				
				const { data: updated, error: updateError } = await supabase
					.from("clients")
					.update(clientData)
					.eq('id', initialData.id)
					.eq('user_id', user.id)
					.select();

				console.log('[handleSaveClient] Update result:', { updated, updateError });

				if (updateError) {
					Alert.alert("Error", `Could not update client. ${updateError.message}`);
				} else if (!updated || updated.length === 0) {
					Alert.alert("Error", "Client not found or you don't have permission to update this client.");
				} else {
					Alert.alert("Success", "Client updated successfully!");
					// Use the first (and should be only) updated record
					if (onClientAdded && updated[0]) onClientAdded(updated[0]);
					internalClose();
				}
			} else {
				// Create new client
				const { data: inserted, error: insertError } = await supabase
					.from("clients")
					.insert([clientData])
					.select()
					.single();

				if (insertError) {
					Alert.alert("Error", `Could not save client. ${insertError.message}`);
				} else {
					Alert.alert("Success", "Client saved successfully!");
					setFullName("");
					setEmail("");
					setPhone("");
					setTaxNumber("");
					setAddress("");
					if (onClientAdded && inserted) onClientAdded(inserted);
					internalClose();
				}
			}
		} catch (error: any) {
			Alert.alert("Error", `An unexpected error occurred: ${error.message}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleAddFromContacts = () => {
		Alert.alert(
			"Not Implemented",
			"Adding from contacts is not yet implemented.",
		);
	};

	const styles = StyleSheet.create({
		modalBackground: { backgroundColor: themeColors.background },
		handleIndicator: { backgroundColor: themeColors.mutedForeground },
		headerContainer: {
			flexDirection: "row",
			justifyContent: "center",
			alignItems: "center",
			paddingVertical: Platform.OS === "ios" ? 12 : 15,
			paddingHorizontal: 15,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		title: {
			fontSize: 20,
			fontWeight: "600",
			color: themeColors.foreground,
		},
		closeButton: {
			position: "absolute",
			top: Platform.OS === "ios" ? 10 : 12,
			right: 15,
			padding: 6,
		},
		contentScrollView: { flex: 1 },
		contentContainerStyle: {
			paddingHorizontal: 20,
			paddingTop: Platform.OS === "ios" ? 10 : 15,
			paddingBottom: Platform.OS === "ios" ? 70 : 60,
		},
		addFromContactsButton: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "center",
			paddingVertical: 12,
			paddingHorizontal: 15,
			borderRadius: 8,
			backgroundColor: themeColors.card,
			borderColor: themeColors.border,
			borderWidth: 1,
			alignSelf: "stretch",
			marginBottom: 20,
		},
		addFromContactsIcon: {
			marginRight: 8,
			color: themeColors.primary,
		},
		addFromContactsText: {
			fontSize: 16,
			fontWeight: "500",
			color: themeColors.primary,
		},
		inputGroupContainer: {
			backgroundColor: themeColors.card,
			borderRadius: 10,
			marginBottom: 20,
			overflow: "hidden",
			borderWidth: Platform.OS === "android" ? 0 : StyleSheet.hairlineWidth,
			borderColor: themeColors.border,
		},
		inputRow: {
			flexDirection: "row",
			alignItems: "flex-start",
			paddingVertical: Platform.OS === "ios" ? 16 : 14,
			paddingHorizontal: 15,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		inputRow_last: {
			flexDirection: "row",
			alignItems: "flex-start",
			paddingVertical: Platform.OS === "ios" ? 16 : 14,
			paddingHorizontal: 15,
		},
		inputLabelText: {
			fontSize: 16,
			color: themeColors.foreground,
			marginRight: 10,
			minWidth: "30%",
			fontWeight: "bold",
		},
		requiredAsterisk: {
			color: themeColors.destructive,
			fontSize: 16,
			fontWeight: "bold",
		},
		inputValueArea: {
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
		},
		textInputStyled: {
			fontSize: 16,
			color: themeColors.foreground,
			paddingVertical: Platform.OS === "ios" ? 2 : 0,
			backgroundColor: "transparent",
			flex: 1,
		},
		addressTextInput: {
			minHeight: Platform.OS === 'ios' ? 70 : 60,
			paddingTop: Platform.OS === 'ios' ? 8 : 6,
			paddingBottom: Platform.OS === 'ios' ? 8 : 6,
			textAlignVertical: 'top',
		},
		saveButton: {
			backgroundColor: themeColors.primary,
			paddingVertical: 16,
			borderRadius: 10,
			alignItems: "center",
			justifyContent: "center",
			marginTop: 10,
		},
		saveButtonDisabled: {
			backgroundColor: themeColors.secondaryForeground,
		},
		saveButtonText: {
			color: themeColors.primaryForeground,
			fontSize: 17,
			fontWeight: "600",
		},
	});

	return (
		<BottomSheetModal
			ref={bottomSheetModalRef}
			name="createNewClientModal"
			stackBehavior="push"
			index={0}
			snapPoints={snapPoints}
			backdropComponent={renderBackdrop}
			handleIndicatorStyle={styles.handleIndicator}
			backgroundStyle={styles.modalBackground}
			enablePanDownToClose={!isLoading}
			keyboardBehavior="extend"
			keyboardBlurBehavior="restore"
			onDismiss={onClose}
		>
			<View style={styles.headerContainer}>
				<Text style={styles.title}>{editMode ? "Edit Client" : "Add New Client"}</Text>
				<TouchableOpacity
					onPress={internalClose}
					style={styles.closeButton}
					disabled={isLoading}
				>
					<X size={24} color={themeColors.mutedForeground} />
				</TouchableOpacity>
			</View>

			<BottomSheetScrollView
				style={styles.contentScrollView}
				contentContainerStyle={styles.contentContainerStyle}
			>
				{!editMode && (
					<TouchableOpacity
						style={styles.addFromContactsButton}
						onPress={handleAddFromContacts}
						disabled={isLoading}
					>
						<UserPlus size={20} style={styles.addFromContactsIcon} />
						<Text style={styles.addFromContactsText}>Add from Contacts</Text>
					</TouchableOpacity>
				)}

				<View style={styles.inputGroupContainer}>
					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>
							Full Name <Text style={styles.requiredAsterisk}>*</Text>
						</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.textInputStyled}
								placeholder="e.g. John Doe"
								placeholderTextColor={themeColors.mutedForeground}
								value={fullName}
								onChangeText={setFullName}
								autoCapitalize="words"
								editable={!isLoading}
							/>
						</View>
					</View>

					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>Email</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.textInputStyled}
								placeholder="e.g. john.doe@example.com"
								placeholderTextColor={themeColors.mutedForeground}
								value={email}
								onChangeText={setEmail}
								keyboardType="email-address"
								autoCapitalize="none"
								editable={!isLoading}
							/>
						</View>
					</View>

					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>Phone</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.textInputStyled}
								placeholder="e.g. (555) 123-4567"
								placeholderTextColor={themeColors.mutedForeground}
								value={phone}
								onChangeText={setPhone}
								keyboardType="phone-pad"
								editable={!isLoading}
							/>
						</View>
					</View>

					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>Tax Number</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.textInputStyled}
								placeholder="e.g. VAT123456789"
								placeholderTextColor={themeColors.mutedForeground}
								value={taxNumber}
								onChangeText={setTaxNumber}
								autoCapitalize="characters"
								editable={!isLoading}
							/>
						</View>
					</View>

					<View style={styles.inputRow_last}>
						<Text style={styles.inputLabelText}>Address</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={[styles.textInputStyled, styles.addressTextInput]}
								placeholder="e.g. 123 Main St, Anytown, USA 12345"
								placeholderTextColor={themeColors.mutedForeground}
								value={address}
								onChangeText={setAddress}
								multiline={true}
								numberOfLines={3}
								textAlignVertical="top"
								returnKeyType="default"
								blurOnSubmit={false}
								editable={!isLoading}
							/>
						</View>
					</View>
				</View>

				<TouchableOpacity
					style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
					onPress={handleSaveClient}
					disabled={isLoading}
				>
					{isLoading ? (
						<ActivityIndicator
							size="small"
							color={themeColors.primaryForeground}
						/>
					) : (
						<Text style={styles.saveButtonText}>
							{editMode ? "Update Client" : "Save Client"}
						</Text>
					)}
				</TouchableOpacity>
			</BottomSheetScrollView>
		</BottomSheetModal>
	);
});

export default CreateNewClientSheet;

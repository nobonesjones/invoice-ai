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

export interface Client {
	id: string;
	name: string;
	email?: string | null;
	phone?: string | null;
	avatar_url?: string | null;
	user_id: string;
}

// Define a specific type for the ref handle
export interface CreateNewClientSheetRef {
	present: () => void;
	dismiss: () => void;
}

interface CreateNewClientSheetProps {
	onClose?: () => void;
	onClientAdded?: () => void;
}

const CreateNewClientSheet = forwardRef<
	CreateNewClientSheetRef,
	CreateNewClientSheetProps
>(({ onClose, onClientAdded }, ref) => {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;

	const bottomSheetModalRef = useRef<BottomSheetModal>(null);

	const [fullName, setFullName] = useState("");
	const [email, setEmail] = useState("");
	const [phone, setPhone] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const snapPoints = useMemo(() => ["60%", "85%"], []);

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
				user_id: user.id,
			};
			const { error: insertError } = await supabase
				.from("clients")
				.insert([clientData]);
			if (insertError) {
				Alert.alert("Error", `Could not save client. ${insertError.message}`);
			} else {
				Alert.alert("Success", "Client saved successfully!");
				setFullName("");
				setEmail("");
				setPhone("");
				if (onClientAdded) onClientAdded();
				internalClose();
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
			alignItems: "center",
			paddingVertical: Platform.OS === "ios" ? 14 : 13,
			paddingHorizontal: 15,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		inputRow_last: {
			flexDirection: "row",
			alignItems: "center",
			paddingVertical: Platform.OS === "ios" ? 14 : 13,
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
			paddingVertical: 0,
			backgroundColor: "transparent",
			flex: 1,
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
				<Text style={styles.title}>Add New Client</Text>
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
				<TouchableOpacity
					style={styles.addFromContactsButton}
					onPress={handleAddFromContacts}
					disabled={isLoading}
				>
					<UserPlus size={20} style={styles.addFromContactsIcon} />
					<Text style={styles.addFromContactsText}>Add from Contacts</Text>
				</TouchableOpacity>

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

					<View style={styles.inputRow_last}>
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
						<Text style={styles.saveButtonText}>Save Client</Text>
					)}
				</TouchableOpacity>
			</BottomSheetScrollView>
		</BottomSheetModal>
	);
});

export default CreateNewClientSheet;

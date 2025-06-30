import {
	BottomSheetModal,
	BottomSheetBackdrop,
	// BottomSheetView, // Not explicitly used if BottomSheetScrollView is the main container
	BottomSheetScrollView,
	BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import { format, parseISO, isValid, addDays } from "date-fns";
import { X, CalendarDays } from "lucide-react-native"; // Added CalendarDays
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
	// TextInput, // Will be replaced by BottomSheetTextInput
	Platform,
	// KeyboardAvoidingView, // Will be replaced by BottomSheetScrollView
	// ScrollView, // Will be replaced by BottomSheetScrollView
	ActivityIndicator,
	ActionSheetIOS, // For future use if needed, kept from AddNewItemFormSheet context
	Alert, // For future use if needed
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";

import SetValidUntilDateSheet, {
	ValidUntilDateOption,
	VALID_UNTIL_DATE_OPTIONS,
} from "./SetValidUntilDateSheet";

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";

export interface EstimateDetailsData {
	estimateNumber: string;
	creationDate: Date;
	validUntilType: string;
	customValidUntilDate?: Date | null;
	acceptanceTerms?: string;
	customHeadline?: string;
	validUntilDisplayLabel?: string;
}

interface EditEstimateDetailsSheetProps {
	initialDetails?: EstimateDetailsData;
	onSave: (updatedDetails: EstimateDetailsData) => void;
	onClose?: () => void;
}

// Define and export the Ref type
export interface EditEstimateDetailsSheetRef {
	present: () => void;
	dismiss: () => void;
}

const EditEstimateDetailsSheet = forwardRef<
	EditEstimateDetailsSheetRef,
	EditEstimateDetailsSheetProps
>(({ initialDetails, onSave, onClose }, ref) => {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;

	const bottomSheetModalRef = useRef<BottomSheetModal>(null); // Added for programmatic control

	// State variables (existing logic retained)
	const [estimateNumber, setEstimateNumber] = useState(
		initialDetails?.estimateNumber || "",
	);
	const initialCreationDate = initialDetails?.creationDate
		? typeof initialDetails.creationDate === "string"
			? parseISO(initialDetails.creationDate)
			: initialDetails.creationDate
		: new Date();
	const [creationDateObject, setCreationDateObject] = useState<Date>(
		isValid(initialCreationDate) ? initialCreationDate : new Date(),
	);
	const [isCreationDatePickerVisible, setCreationDatePickerVisibility] =
		useState(false);
	const [selectedValidUntilType, setSelectedValidUntilType] = useState(
		initialDetails?.validUntilType || "on_receipt",
	);
	const [selectedCustomValidUntilDate, setSelectedCustomValidUntilDate] =
		useState<Date | null>(
			initialDetails?.customValidUntilDate
				? typeof initialDetails.customValidUntilDate === "string"
					? parseISO(initialDetails.customValidUntilDate)
					: initialDetails.customValidUntilDate
				: null,
		);

	const getInitialValidUntilDisplay = () => {
		if (initialDetails?.validUntilDisplayLabel)
			return initialDetails.validUntilDisplayLabel;
		if (initialDetails?.customValidUntilDate) {
			const customDate =
				typeof initialDetails.customValidUntilDate === "string"
					? parseISO(initialDetails.customValidUntilDate)
					: initialDetails.customValidUntilDate;
			return isValid(customDate)
				? format(customDate, "MMM d, yyyy")
				: "Select Valid Until Date";
		}
		const initialOption = VALID_UNTIL_DATE_OPTIONS.find(
			(opt: ValidUntilDateOption) => opt.type === initialDetails?.validUntilType,
		);
		return initialOption ? initialOption.label : "On receipt";
	};
	const [validUntilDisplay, setValidUntilDisplay] = useState(
		getInitialValidUntilDisplay(),
	);
	const [acceptanceTerms, setAcceptanceTerms] = useState(initialDetails?.acceptanceTerms || "");
	const [customHeadline, setCustomHeadline] = useState(
		initialDetails?.customHeadline || "",
	);
	const [isLoading, setIsLoading] = useState(false);
	const setValidUntilSheetRef = useRef<BottomSheetModal>(null);
	const [isCustomDatePickerVisible, setCustomDatePickerVisibility] =
		useState(false);

	// Imperative handle for parent to control sheet (from AddNewItemFormSheet)
	React.useImperativeHandle(ref, () => ({
		present: () => bottomSheetModalRef.current?.present(),
		dismiss: () => bottomSheetModalRef.current?.dismiss(), // Ensure dismiss is also exposed
	}));

	const snapPoints = useMemo(() => ["75%", "90%"], []); // Adjusted second snap point to be higher

	const renderBackdrop = useCallback(
		(props: any) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.7} // Consistent with AddNewItemFormSheet
				pressBehavior="close"
			/>
		),
		[],
	);

	const handleInternalSave = () => {
		setIsLoading(true);
		const updatedDetails: EstimateDetailsData = {
			estimateNumber: estimateNumber.trim(),
			creationDate: creationDateObject,
			validUntilType: selectedValidUntilType,
			customValidUntilDate: selectedCustomValidUntilDate,
			acceptanceTerms: acceptanceTerms.trim(),
			customHeadline: customHeadline.trim(),
			validUntilDisplayLabel: validUntilDisplay,
		};
		onSave(updatedDetails);
		setIsLoading(false);
		// bottomSheetModalRef.current?.dismiss(); // Consider if auto-dismiss is desired after save
	};

	const internalClose = () => {
		bottomSheetModalRef.current?.dismiss();
		if (onClose) {
			onClose();
		}
	};

	// Date picker handlers (existing logic retained)
	const handleValidUntilSelect = (
		type: string,
		customDate?: Date | null,
		displayLabel?: string,
	) => {
		setSelectedValidUntilType(type);
		if (type === "custom" && customDate) {
			setSelectedCustomValidUntilDate(customDate);
			setValidUntilDisplay(displayLabel || format(customDate, "MMM d, yyyy"));
		} else if (type === "custom" && !customDate) {
			showCustomDatePicker(); // Prompt for date if 'custom' is selected but no date given
			// Keep current custom date for now, or clear it: setSelectedCustomValidUntilDate(null);
		} else {
			setSelectedCustomValidUntilDate(null); // Clear custom date if a non-custom type is chosen
			const option = VALID_UNTIL_DATE_OPTIONS.find((opt) => opt.type === type);
			setValidUntilDisplay(option ? option.label : "Select Valid Until Date");
			// Calculate actual due date if needed for 'updatedDetails.due_date'
			// For example, if type is 'net_30', actualDueDate = addDays(creationDateObject, 30);
		}
	};
	const showCustomDatePicker = () => setCustomDatePickerVisibility(true);
	const hideCustomDatePicker = () => setCustomDatePickerVisibility(false);
	const handleConfirmCustomValidUntilDate = (date: Date) => {
		setSelectedCustomValidUntilDate(date);
		setValidUntilDisplay(format(date, "MMM d, yyyy"));
		setSelectedValidUntilType("custom");
		hideCustomDatePicker();
	};
	const showCreationDatePicker = () => setCreationDatePickerVisibility(true);
	const hideCreationDatePicker = () => setCreationDatePickerVisibility(false);
	const handleConfirmCreationDate = (date: Date) => {
		setCreationDateObject(date);
		hideCreationDatePicker();
	};

	// Helper to format creation date for display
	const formattedCreationDate = useMemo(() => {
		return isValid(creationDateObject)
			? format(creationDateObject, "MMM d, yyyy")
			: "Select Date";
	}, [creationDateObject]);

	// Styles (merged and adapted from AddNewItemFormSheet)
	const styles = StyleSheet.create({
		modalBackground: { backgroundColor: themeColors.background },
		handleIndicator: { backgroundColor: themeColors.mutedForeground },
		headerContainer: {
			flexDirection: "row",
			justifyContent: "center", // Center title
			alignItems: "center",
			paddingVertical: Platform.OS === "ios" ? 12 : 15, // Adjusted padding
			paddingHorizontal: 15, // Horizontal padding for header content
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		title: {
			fontSize: 20, // Matched AddNewItem title size slightly better
			fontWeight: "600", // Matched AddNewItem title weight
			color: themeColors.foreground,
		},
		closeButton: {
			position: "absolute",
			top: Platform.OS === "ios" ? 10 : 12, // Adjusted for new header padding
			right: 15,
			padding: 6,
		},
		contentScrollView: {
			flex: 1,
		},
		contentContainerStyle: {
			paddingHorizontal: 20,
			paddingTop: Platform.OS === "ios" ? 10 : 15,
			paddingBottom: Platform.OS === "ios" ? 90 : 80, // Increased further
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
			paddingVertical: Platform.OS === "ios" ? 14 : 13, // Fine-tuned padding
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
			color: themeColors.mutedForeground, // Labels are often muted
			marginRight: 10,
			minWidth: "35%", // Adjusted for typical labels like 'Invoice Number'
			fontWeight: "500",
		},
		inputValueArea: {
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
		},
		textInputStyled: {
			// For text in TextInput and display rows
			fontSize: 16,
			color: themeColors.foreground,
			paddingVertical: 0, // For BottomSheetTextInput
			backgroundColor: "transparent",
			flex: 1,
		},
		multilineTextInputContainer: {
			// For description-like inputs, becomes an inputRow
			// Use inputRow styles, but allow BottomSheetTextInput to expand
			alignItems: "flex-start", // Align label to top for multiline
			paddingVertical: Platform.OS === "ios" ? 12 : 10,
		},
		multilineTextInput: {
			fontSize: 16,
			color: themeColors.foreground,
			paddingVertical: 0,
			backgroundColor: "transparent",
			flex: 1,
			minHeight: 60, // Min height for multiline
			textAlignVertical: "top",
		},
		pressableRowText: {
			// For date display etc.
			fontSize: 16,
			color: themeColors.foreground,
			flex: 1, // Takes available space
		},
		iconStyle: {
			marginRight: 8, // Space between icon and text if any
			color: themeColors.mutedForeground, // Default icon color
		},
		primaryIcon: {
			color: themeColors.primary, // For active/selected icons
		},
		saveButton: {
			backgroundColor: themeColors.primary,
			paddingVertical: 16, // Matched AddNewItem
			borderRadius: 10, // Matched AddNewItem
			alignItems: "center",
			justifyContent: "center",
			marginTop: 10, // Space from last group
		},
		saveButtonDisabled: {
			backgroundColor: themeColors.muted, // Replaced primaryMuted with muted
		},
		saveButtonText: {
			color: themeColors.primaryForeground,
			fontSize: 17, // Matched AddNewItem
			fontWeight: "600", // Matched AddNewItem
		},
	});

	return (
		<BottomSheetModal
			ref={bottomSheetModalRef} // Use the new ref for parent control
			name="editEstimateDetailsModal" // Give it a name
			stackBehavior="push"
			index={0} // Start open
			snapPoints={snapPoints}
			backdropComponent={renderBackdrop}
			handleIndicatorStyle={styles.handleIndicator}
			backgroundStyle={styles.modalBackground}
			enablePanDownToClose
			keyboardBehavior="extend" // Changed to extend for behavior like CreateNewClientSheet
			keyboardBlurBehavior="restore"
			onDismiss={onClose} // Call onClose when sheet is dismissed by pan down etc.
		>
			<View style={styles.headerContainer}>
				<Text style={styles.title}>Edit Estimate Details</Text>
				<TouchableOpacity onPress={internalClose} style={styles.closeButton}>
					<X size={24} color={themeColors.mutedForeground} />
				</TouchableOpacity>
			</View>

			<BottomSheetScrollView
				style={styles.contentScrollView}
				contentContainerStyle={styles.contentContainerStyle}
			>
				<View style={styles.inputGroupContainer}>
					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>Estimate #</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.textInputStyled}
								value={estimateNumber}
								onChangeText={setEstimateNumber}
								placeholder="EST-001"
								placeholderTextColor={themeColors.mutedForeground}
								editable={!isLoading}
							/>
						</View>
					</View>

					<TouchableOpacity
						style={styles.inputRow}
						onPress={showCreationDatePicker}
						disabled={isLoading}
					>
						<Text style={styles.inputLabelText}>Created</Text>
						<View style={styles.inputValueArea}>
							<CalendarDays
								size={18}
								style={[
									styles.iconStyle,
									formattedCreationDate !== "Select Date" && styles.primaryIcon,
								]}
							/>
							<Text style={[styles.pressableRowText, { marginLeft: 8 }]}>
								{formattedCreationDate}
							</Text>
						</View>
					</TouchableOpacity>

					<TouchableOpacity
						style={styles.inputRow_last}
						onPress={() => setValidUntilSheetRef.current?.present()}
						disabled={isLoading}
					>
						<Text style={styles.inputLabelText}>Valid Until</Text>
						<View style={styles.inputValueArea}>
							<CalendarDays
								size={18}
								style={[
									styles.iconStyle,
									validUntilDisplay !== "Select Valid Until Date" &&
										validUntilDisplay !== "On receipt" &&
										styles.primaryIcon,
								]}
							/>
							<Text style={[styles.pressableRowText, { marginLeft: 8 }]}>
								{validUntilDisplay}
							</Text>
						</View>
					</TouchableOpacity>
				</View>

				<View style={styles.inputGroupContainer}>
					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>Acceptance Terms</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.multilineTextInput}
								value={acceptanceTerms}
								onChangeText={setAcceptanceTerms}
								placeholder="Optional acceptance terms"
								placeholderTextColor={themeColors.mutedForeground}
								editable={!isLoading}
								multiline
							/>
						</View>
					</View>
				</View>

				<View style={styles.inputGroupContainer}>
					<View style={styles.inputRow}>
						<Text style={styles.inputLabelText}>Headline</Text>
						<View style={styles.inputValueArea}>
							<BottomSheetTextInput
								style={styles.multilineTextInput}
								value={customHeadline}
								onChangeText={setCustomHeadline}
								placeholder="Optional custom message"
								placeholderTextColor={themeColors.mutedForeground}
								editable={!isLoading}
								multiline
							/>
						</View>
					</View>
				</View>

				<TouchableOpacity
					style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
					onPress={handleInternalSave}
					disabled={isLoading}
				>
					{isLoading ? (
						<ActivityIndicator
							size="small"
							color={themeColors.primaryForeground}
						/>
					) : (
						<Text style={styles.saveButtonText}>Save Details</Text>
					)}
				</TouchableOpacity>
			</BottomSheetScrollView>

			{/* Dependent Modals/Sheets (existing logic retained) */}
			<SetValidUntilDateSheet
				ref={setValidUntilSheetRef}
				currentValidUntilType={selectedValidUntilType}
				currentCustomValidUntilDate={selectedCustomValidUntilDate}
				onSelectValidUntil={handleValidUntilSelect}
			/>
			<DateTimePickerModal
				isVisible={isCustomDatePickerVisible}
				mode="date"
				onConfirm={handleConfirmCustomValidUntilDate}
				onCancel={hideCustomDatePicker}
				date={selectedCustomValidUntilDate || new Date()}
			/>
			<DateTimePickerModal
				isVisible={isCreationDatePickerVisible}
				mode="date"
				onConfirm={handleConfirmCreationDate}
				onCancel={hideCreationDatePicker}
				date={creationDateObject}
			/>
		</BottomSheetModal>
	);
});

export default EditEstimateDetailsSheet;
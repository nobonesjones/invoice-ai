import {
	BottomSheetModal,
	BottomSheetBackdrop,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import { X, CheckCircle } from "lucide-react-native"; // Added CheckCircle for selection indication
import React, { useMemo, useCallback, forwardRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Platform,
} from "react-native";

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";

export interface ValidUntilDateOption {
	label: string;
	type: string; // e.g., 'none', 'on_receipt', 'next_day', 'net_7', 'net_14', 'net_30', 'custom'
	days?: number; // For 'net_X' types or 'next_day'
}

interface SetValidUntilDateSheetProps {
	currentValidUntilType?: string;
	currentCustomValidUntilDate?: Date | null;
	onSelectValidUntil: (
		type: string,
		customDate?: Date | null,
		displayLabel?: string,
	) => void;
	onClose?: () => void;
}

// Export the constant so it can be used by other components
export const VALID_UNTIL_DATE_OPTIONS: ValidUntilDateOption[] = [
	{ label: "Valid for 30 days", type: "net_30", days: 30 },
	{ label: "Valid for 14 days", type: "net_14", days: 14 },
	{ label: "Valid for 7 days", type: "net_7", days: 7 },
	{ label: "Valid indefinitely", type: "on_receipt" },
	{ label: "Custom", type: "custom" },
];

const SetValidUntilDateSheet = forwardRef<BottomSheetModal, SetValidUntilDateSheetProps>(
	(
		{ currentValidUntilType, currentCustomValidUntilDate, onSelectValidUntil, onClose },
		ref,
	) => {
		const { isLightMode } = useTheme();
		const themeColors = isLightMode ? colors.light : colors.dark;
		const styles = getStyles(themeColors, isLightMode);

		const snapPoints = useMemo(() => ["60%", "80%"], []); // Adjusted snap points

		const renderBackdrop = useCallback(
			(props: any) => (
				<BottomSheetBackdrop
					{...props}
					disappearsOnIndex={-1}
					appearsOnIndex={0}
					pressBehavior="close"
					outputRange={["0", "0.5"]}
				/>
			),
			[],
		);

		const handleSelectOption = (option: ValidUntilDateOption) => {
			if (option.type === "custom") {
				console.log("Custom date selection - calling parent to handle date picker");
				// Call parent with custom type, it will handle opening the date picker
				onSelectValidUntil(option.type, null, option.label);
				(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
				return;
			}
			onSelectValidUntil(option.type, null, option.label);
			(ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
		};

		const renderHeader = () => (
			<View style={styles.headerContainer}>
				<Text style={styles.title}>Set Valid Until Date</Text>
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

		return (
			<BottomSheetModal
				ref={ref}
				index={0}
				snapPoints={snapPoints}
				onChange={(index) => {
					if (index === -1 && onClose) {
						onClose();
					}
				}}
				backdropComponent={renderBackdrop}
				handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
				backgroundStyle={{ backgroundColor: themeColors.card }}
				enablePanDownToClose
			>
				<BottomSheetView style={styles.bottomSheetContentContainer}>
					{renderHeader()}
					<ScrollView
						style={styles.scrollView}
						contentContainerStyle={styles.scrollViewContentContainer}
					>
						{VALID_UNTIL_DATE_OPTIONS.map((option) => {
							const isSelected = option.type === currentValidUntilType;
							// Further logic for custom date selection indication can be added here
							return (
								<TouchableOpacity
									key={option.type}
									style={styles.optionRow}
									onPress={() => handleSelectOption(option)}
								>
									<Text
										style={[
											styles.optionText,
											isSelected && styles.selectedOptionText,
										]}
									>
										{option.label}
									</Text>
									{isSelected && (
										<CheckCircle size={20} color={themeColors.primary} />
									)}
								</TouchableOpacity>
							);
						})}
					</ScrollView>
				</BottomSheetView>
			</BottomSheetModal>
		);
	},
);

const getStyles = (themeColors: any, isLightMode: boolean) =>
	StyleSheet.create({
		headerContainer: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			paddingBottom: 12,
			paddingHorizontal: 16,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		title: {
			fontSize: 21,
			fontWeight: "600",
			color: themeColors.foreground,
		},
		closeButton: {
			padding: 6,
		},
		bottomSheetContentContainer: {
			flex: 1,
			paddingHorizontal: 0, // Options will have their own padding
		},
		scrollView: {
			flex: 1,
		},
		scrollViewContentContainer: {
			paddingTop: 8,
			paddingBottom: Platform.OS === "ios" ? 40 : 30,
		},
		optionRow: {
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			paddingVertical: 16,
			paddingHorizontal: 24,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		optionText: {
			fontSize: 16,
			color: themeColors.foreground,
		},
		selectedOptionText: {
			color: themeColors.primary,
			fontWeight: "600",
		},
	});

export default SetValidUntilDateSheet;

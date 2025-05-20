import { BottomSheetModal, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { Percent, MinusCircle } from "lucide-react-native"; // Or appropriate icons
import React, { forwardRef, useMemo, useCallback, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	Platform,
} from "react-native";

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";

export type DiscountType = "percentage" | "fixed";

export interface SelectDiscountTypeSheetProps {
	onSelectDiscountType: (type: DiscountType) => void;
}

export interface SelectDiscountTypeSheetRef {
	present: () => void;
	dismiss: () => void;
}

const SelectDiscountTypeSheet = forwardRef<
	SelectDiscountTypeSheetRef,
	SelectDiscountTypeSheetProps
>(({ onSelectDiscountType }, ref) => {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const bottomSheetModalRef = useRef<BottomSheetModal>(null);

	React.useImperativeHandle(ref, () => ({
		present: () => bottomSheetModalRef.current?.present(),
		dismiss: () => bottomSheetModalRef.current?.dismiss(),
	}));

	const snapPoints = useMemo(() => [Platform.OS === "ios" ? "28%" : "32%", "90%"], []); // Adjusted second snap point to 90%

	const renderBackdrop = useCallback(
		(props: any) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
			/>
		),
		[],
	);

	const handleSelect = (type: DiscountType) => {
		bottomSheetModalRef.current?.dismiss(); // Dismiss this modal first
		// Delay the callback to allow the modal to fully dismiss before parent state updates
		setTimeout(() => {
			onSelectDiscountType(type); // Then call the callback to update parent state
		}, 100); // 100ms delay, adjust if needed
	};

	const styles = StyleSheet.create({
		container: {
			paddingHorizontal: 20,
			paddingTop: 10,
		},
		title: {
			fontSize: 18,
			fontWeight: "bold",
			color: themeColors.foreground,
			marginBottom: 15,
			textAlign: "center",
		},
		optionButton: {
			flexDirection: "row",
			alignItems: "center",
			backgroundColor: themeColors.card,
			paddingVertical: 15,
			paddingHorizontal: 15,
			borderRadius: 8,
			marginBottom: 10,
			borderWidth: 1,
			borderColor: themeColors.border,
		},
		optionText: {
			fontSize: 16,
			color: themeColors.foreground,
			marginLeft: 12,
			fontWeight: "500",
		},
		handleIndicator: {
			backgroundColor: themeColors.mutedForeground,
		},
		modalBackground: {
			backgroundColor: themeColors.background, // Use background for less emphasis than card
		},
	});

	return (
		<BottomSheetModal
			ref={bottomSheetModalRef}
			name="selectDiscountTypeModal" // Added unique name
			index={0}
			snapPoints={snapPoints}
			backdropComponent={renderBackdrop}
			handleIndicatorStyle={styles.handleIndicator}
			backgroundStyle={styles.modalBackground}
			keyboardBehavior="extend" // Added keyboardBehavior
			keyboardBlurBehavior="restore" // Added keyboardBlurBehavior
		>
			<View style={styles.container}>
				<Text style={styles.title}>Select Discount Type</Text>
				<TouchableOpacity
					style={styles.optionButton}
					onPress={() => handleSelect("percentage")}
				>
					<Percent size={22} color={themeColors.primary} />
					<Text style={styles.optionText}>Percentage (%)</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={styles.optionButton}
					onPress={() => handleSelect("fixed")}
				>
					<MinusCircle size={22} color={themeColors.primary} />
					<Text style={styles.optionText}>Fixed Amount</Text>
				</TouchableOpacity>
			</View>
		</BottomSheetModal>
	);
});

export default SelectDiscountTypeSheet;

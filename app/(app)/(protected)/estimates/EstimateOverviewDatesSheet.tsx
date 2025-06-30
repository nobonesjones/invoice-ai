import {
	BottomSheetModal,
	BottomSheetBackdrop,
	BottomSheetView,
} from "@gorhom/bottom-sheet";
import { X, CheckCircle } from "lucide-react-native";
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

export interface DateRangeFilterOption { 
	label: string;
	type: string; 
}

interface EstimateOverviewDatesSheetProps { 
	currentFilterType?: string; 
	onApplyFilter: (filterType: string, displayLabel: string) => void; 
	onClose?: () => void;
}

export const DATE_RANGE_FILTER_OPTIONS: DateRangeFilterOption[] = [
	{ label: "This Week", type: "this_week" },
	{ label: "This Month", type: "this_month" },
	{ label: "Last Month", type: "last_month" },
	{ label: "Last 3 Months", type: "last_3_months" },
	{ label: "Last 12 Months", type: "last_12_months" },
	{ label: "This Year", type: "this_year" },
	{ label: "Last Year", type: "last_year" },
];

const EstimateOverviewDatesSheet = forwardRef<BottomSheetModal, EstimateOverviewDatesSheetProps>(
	(
		{ currentFilterType, onApplyFilter, onClose }, 
		ref,
	) => {
		const { isLightMode } = useTheme();
		const themeColors = isLightMode ? colors.light : colors.dark;
		const styles = getStyles(themeColors, isLightMode);

		const snapPoints = useMemo(() => ["75%", "85%"], []);

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

		const handleSelectOption = (option: DateRangeFilterOption) => {
      onApplyFilter(option.type, option.label);
      (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
		};

		const renderHeader = () => (
			<View style={styles.headerContainer}>
				<Text style={styles.title}>Select Date Range</Text>
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
						{DATE_RANGE_FILTER_OPTIONS.map((option) => {
              const isSelected = currentFilterType === option.type; 
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
			paddingVertical: 16, 
			paddingHorizontal: 16,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: themeColors.border,
		},
		title: {
			fontSize: 18, 
			fontWeight: "bold", 
			color: themeColors.foreground,
		},
		closeButton: {
			padding: 6,
		},
		bottomSheetContentContainer: {
			flex: 1,
		},
		scrollView: {
			flex: 1,
		},
		scrollViewContentContainer: {
			paddingTop: 8, 
			paddingBottom: Platform.OS === "ios" ? 20 : 10, 
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

export default EstimateOverviewDatesSheet; 

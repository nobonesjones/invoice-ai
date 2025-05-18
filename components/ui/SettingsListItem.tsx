import { ChevronRight } from "lucide-react-native";
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";

import { Text } from "./text"; // Use your custom Text component if available

import { useTheme } from "@/context/theme-provider";

interface SettingsListItemProps {
	icon: React.ReactNode;
	label: string;
	onPress?: () => void;
	rightContent?: React.ReactNode; // For things like Switches or custom text
	hideChevron?: boolean;
	isDestructive?: boolean; // For Sign Out styling
	disabled?: boolean; // Add disabled prop
}

export const SettingsListItem: React.FC<SettingsListItemProps> = ({
	icon,
	label,
	onPress,
	rightContent,
	hideChevron = false,
	isDestructive = false,
	disabled = false, // Default to false
}) => {
	const { theme } = useTheme();
	const labelColor = isDestructive ? theme.destructive : theme.foreground;

	return (
		<TouchableOpacity
			onPress={onPress}
			disabled={disabled || !onPress} // Use the passed disabled prop
			style={[styles.container, { borderBottomColor: theme.border }]}
		>
			<View style={styles.leftContainer}>
				{icon}
				<Text style={[styles.label, { color: labelColor }]}>{label}</Text>
			</View>
			<View style={styles.rightContainer}>
				{rightContent}
				{!hideChevron && !rightContent && (
					<ChevronRight size={20} color={theme.mutedForeground} />
				)}
			</View>
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: "transparent", // Inherit from parent View/Card
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	leftContainer: {
		flexDirection: "row",
		alignItems: "center",
		flexShrink: 1, // Prevent label pushing chevron off-screen
	},
	label: {
		marginLeft: 16,
		fontSize: 15, // Increased from 14 to 15
	},
	rightContainer: {
		marginLeft: 8,
	},
});

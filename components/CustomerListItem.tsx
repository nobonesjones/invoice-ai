import { ChevronRight, UserCircle2 } from "lucide-react-native"; // UserCircle2 as a placeholder avatar
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

import { colors } from "@/constants/colors";

export interface Customer {
	id: string;
	name: string;
	email?: string;
	phone?: string;
	profileImageUrl?: string;
	lastActivity?: {
		amount: number;
		status: "Paid" | "Due" | "Draft"; // Or your actual status types
		date: string; // e.g., '3 May'
	};
	lastContacted?: string; // e.g., '2d ago'
}

interface CustomerListItemProps {
	customer: Customer;
	onPress: () => void;
}

const CustomerListItem: React.FC<CustomerListItemProps> = ({
	customer,
	onPress,
}) => {
	const theme = colors.light; // Or your theme context

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.substring(0, 2)
			.toUpperCase();
	};

	return (
		<Pressable onPress={onPress} style={styles.pressableContainer}>
			<View style={styles.container}>
				{/* Left Side: Avatar */}
				<View style={styles.avatarContainer}>
					{customer.profileImageUrl ? (
						<Text>IMG</Text> // Replace with <Image /> component later
					) : (
						<View
							style={[
								styles.avatarPlaceholder,
								{ backgroundColor: theme.secondary },
							]}
						>
							<Text
								style={[
									styles.avatarText,
									{ color: theme.secondaryForeground },
								]}
							>
								{getInitials(customer.name)}
							</Text>
						</View>
					)}
				</View>

				{/* Center Column: Name and Last Activity */}
				<View style={styles.centerColumn}>
					<Text
						style={styles.customerName}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{customer.name}
					</Text>
					{customer.lastActivity && (
						<Text style={styles.lastActivityText}>
							{`$${customer.lastActivity.amount} · ${customer.lastActivity.status} · ${customer.lastActivity.date}`}
						</Text>
					)}
				</View>

				{/* Right Side: Chevron and Optional Time */}
				<View style={styles.rightColumn}>
					{customer.lastContacted && (
						<Text style={styles.timeIndicator}>{customer.lastContacted}</Text>
					)}
					<ChevronRight size={24} color={theme.mutedForeground} />
				</View>
			</View>
		</Pressable>
	);
};

const styles = StyleSheet.create({
	pressableContainer: {
		// backgroundColor: colors.light.card, // If each item is a card itself
	},
	container: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 48 + 2 * 12, // 48px min tappable height + vertical padding
		// If using a divider component in FlatList, no borderBottom here
	},
	avatarContainer: {
		marginRight: 12,
	},
	avatarPlaceholder: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: "center",
		alignItems: "center",
	},
	avatarText: {
		fontSize: 16,
		fontWeight: "bold",
	},
	centerColumn: {
		flex: 1,
		justifyContent: "center",
		marginRight: 8, // Space before right column
	},
	customerName: {
		fontSize: 18,
		fontWeight: "bold",
		color: colors.light.foreground,
		marginBottom: 2, // Small space between name and activity
	},
	lastActivityText: {
		fontSize: 14, // 14-16pt range
		color: colors.light.mutedForeground,
	},
	rightColumn: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "flex-end",
	},
	timeIndicator: {
		fontSize: 12, // Smaller gray text
		color: colors.light.mutedForeground,
		marginRight: 4,
	},
});

export default CustomerListItem;

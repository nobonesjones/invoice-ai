import {
	Stack,
	useLocalSearchParams,
	useNavigation,
	useRouter,
} from "expo-router";
import { Plus, User, ChevronLeft } from "lucide-react-native";
import React from "react";
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	Platform,
} from "react-native";

import { Customer } from "@/components/CustomerListItem";
import { colors } from "@/constants/colors";

// TODO: Refactor to use a shared data source or state management
const initialMockCustomers: Customer[] = [
	{
		id: "1",
		name: "Alice Wonderland",
		email: "alice@example.com",
		phone: "123-456-7890",
		lastActivity: { amount: 150, status: "Paid", date: "5 May" },
		lastContacted: "1d ago",
	},
	{
		id: "2",
		name: "Bob The Builder",
		email: "bob@example.com",
		phone: "234-567-8901",
		lastActivity: { amount: 75, status: "Due", date: "28 Apr" },
	},
	{
		id: "3",
		name: "Charlie Chaplin",
		email: "charlie@example.com",
		phone: "345-678-9012",
		lastActivity: { amount: 300, status: "Draft", date: "10 May" },
		lastContacted: "5h ago",
	},
	{
		id: "4",
		name: "Diana Prince",
		email: "diana@example.com",
		phone: "456-789-0123",
	},
];

// Dummy data for timeline - replace with actual data fetching
const mockTimelineEvents = [
	{
		id: "1",
		type: "system",
		message: "Invoice #004 · Sent · 5 May",
		date: "2025-05-05",
	},
	{ id: "2", type: "status", message: "Paid · 7 May 2025", date: "2025-05-07" },
	{
		id: "3",
		type: "action",
		message: "Created from AI assistant",
		date: "2025-05-04",
	},
	{ id: "4", type: "date_separator", date: "Monday, May 6" },
	{
		id: "5",
		type: "system",
		message: "Invoice #003 · Draft · 3 May",
		date: "2025-05-03",
	},
];

// Simplified CustomHeaderTitle for Avatar and Name only
const CustomHeaderTitle = ({
	customerName,
}: {
	customerName: string | undefined;
}) => {
	// console.log('[CustomHeaderTitle] Customer name:', customerName);
	if (!customerName) {
		return <Text style={styles.headerTitleFallback}>Client Details</Text>;
	}

	return (
		<View style={styles.customHeaderContainer}>
			<View style={styles.avatarContainer}>
				<User size={24} color={colors.light.primary} />
			</View>
			<Text
				style={styles.customerNameText}
				numberOfLines={1}
				ellipsizeMode="tail"
			>
				{customerName}
			</Text>
		</View>
	);
};

export default function CustomerDetailScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const navigation = useNavigation();
	const router = useRouter();
	console.log("[CustomerDetailScreen] Received ID:", id);
	const theme = colors.light;
	const customer = initialMockCustomers.find((c) => c.id === id);
	console.log(
		"[CustomerDetailScreen] Found customer:",
		JSON.stringify(customer, null, 2),
	);

	return (
		<View style={styles.container}>
			<Stack.Screen
				options={{
					headerShown: true,
					headerTitleAlign: "left",
					headerStyle: { backgroundColor: colors.light.background },
					headerTintColor: colors.light.foreground,
					headerTitle: () => (
						<CustomHeaderTitle customerName={customer?.name} />
					),
					headerLeft: () => (
						<Pressable
							onPress={() => {
								console.log(
									"Attempting to navigate to /customers/ with router.push",
								);
								router.push("/customers/");
							}}
							style={{ marginLeft: Platform.OS === "ios" ? 10 : 0, padding: 5 }}
						>
							<ChevronLeft size={24} color={colors.light.foreground} />
						</Pressable>
					),
					headerRight: () => {
						if (
							!customer ||
							!customer.lastActivity ||
							customer.lastActivity.status !== "Due" ||
							!(customer.lastActivity.amount > 0)
						) {
							return null; // No pill if not outstanding
						}
						console.log(
							"[headerRight] Rendering pill for customer:",
							customer.name,
						);
						return (
							<View
								style={[
									styles.outstandingPill,
									{ marginRight: Platform.OS === "ios" ? 10 : 16 },
								]}
							>
								<Text style={styles.outstandingPillText}>
									${customer.lastActivity.amount} Outstanding
								</Text>
							</View>
						);
					},
				}}
			/>

			<ScrollView style={styles.timelineScrollContainer}>
				{mockTimelineEvents.map((event) => {
					if (event.type === "date_separator") {
						return (
							<View key={event.id} style={styles.dateSeparatorContainer}>
								<Text style={styles.dateSeparatorText}>{event.date}</Text>
							</View>
						);
					}
					return (
						<View
							key={event.id}
							style={[
								styles.timelineItem,
								event.type === "system" && styles.systemMessage,
								event.type === "action" && styles.actionMessage,
								event.type === "status" && styles.statusMessage,
							]}
						>
							<Text style={styles.timelineMessageText}>{event.message}</Text>
						</View>
					);
				})}
			</ScrollView>

			<Pressable
				style={styles.fab}
				onPress={() => console.log("New Invoice for customer:", id)}
			>
				<Plus size={28} color={theme.primaryForeground} />
				<Text style={styles.fabText}>New Invoice</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.light.background,
	},
	customHeaderContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginLeft: 0,
		paddingVertical: 10,
	},
	avatarContainer: {
		width: 36,
		height: 36,
		borderRadius: 18,
		backgroundColor: colors.light.primaryForeground,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 10,
		borderWidth: 1,
		borderColor: colors.light.border,
	},
	customerNameText: {
		fontSize: 19,
		fontWeight: "600",
		color: colors.light.foreground,
	},
	outstandingPill: {
		backgroundColor: colors.light.destructive,
		borderRadius: 12,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	outstandingPillText: {
		color: colors.light.destructiveForeground,
		fontSize: 11,
		fontWeight: "500",
	},
	headerTitleFallback: {
		fontSize: 17,
		fontWeight: "600",
		color: colors.light.foreground,
	},
	timelineScrollContainer: {
		flex: 1,
		paddingHorizontal: 16,
		paddingVertical: 20,
	},
	dateSeparatorContainer: {
		alignItems: "center",
		marginVertical: 10,
	},
	dateSeparatorText: {
		fontSize: 12,
		color: colors.light.mutedForeground,
		backgroundColor: colors.light.border,
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		overflow: "hidden",
	},
	timelineItem: {
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderRadius: 18,
		marginBottom: 8,
		maxWidth: "80%",
		borderWidth: 1,
		borderColor: colors.light.border,
	},
	systemMessage: {
		backgroundColor: colors.light.card,
		alignSelf: "flex-start",
		borderColor: colors.light.border,
	},
	actionMessage: {
		backgroundColor: colors.light.card,
		alignSelf: "flex-end",
		borderColor: colors.light.primary,
	},
	statusMessage: {
		backgroundColor: colors.light.input,
		alignSelf: "center",
		maxWidth: "60%",
		marginTop: 4,
		marginBottom: 12,
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 12,
	},
	timelineMessageText: {
		fontSize: 16,
		color: colors.light.foreground,
	},
	fab: {
		position: "absolute",
		bottom: 30,
		right: 30,
		backgroundColor: colors.light.primary,
		borderRadius: 30,
		paddingVertical: 12,
		paddingHorizontal: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
	},
	fabText: {
		color: colors.light.primaryForeground,
		fontSize: 16,
		fontWeight: "bold",
		marginLeft: 8,
	},
});

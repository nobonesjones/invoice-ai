import { Stack, useRouter } from "expo-router";
import {
	PlusCircle,
	Search as SearchIcon,
	FileText,
	ChevronRight,
} from "lucide-react-native";
import React, { useState, useCallback } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	SafeAreaView,
	FlatList,
	TextInput,
	RefreshControl,
} from "react-native";

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";

// Define Invoice type
interface Invoice {
	id: string;
	clientName: string;
	amount: number;
	status: "Paid" | "Due" | "Draft";
	date: string; // e.g., "5 May"
	lastActionTime: string; // e.g., "3h ago", "1d ago"
}

// Mock Data
const mockInvoices: Invoice[] = [
	{
		id: "1",
		clientName: "Alice Wonderland",
		amount: 150,
		status: "Paid",
		date: "5 May",
		lastActionTime: "1d ago",
	},
	{
		id: "2",
		clientName: "Bob The Builder",
		amount: 75,
		status: "Due",
		date: "28 Apr",
		lastActionTime: "2d ago",
	},
	{
		id: "3",
		clientName: "Charlie Chaplin",
		amount: 300,
		status: "Draft",
		date: "10 May",
		lastActionTime: "5h ago",
	},
	{
		id: "4",
		clientName: "Diana Prince",
		amount: 0, // Assuming no activity means no invoice yet or $0 amount
		status: "Draft", // Or a different status for no activity
		date: "12 May",
		lastActionTime: "No activity yet",
	},
];

// Summary Card Data
interface SummaryMetrics {
	totalOutstanding: number;
	totalOverdue: number;
	avgCollectionPeriod: string; // e.g., "25 days"
}

const mockSummaryMetrics: SummaryMetrics = {
	totalOutstanding: 1250.75,
	totalOverdue: 300.5,
	avgCollectionPeriod: "28 days",
};

// Helper to get status color
const getStatusColor = (
	status: Invoice["status"],
	themeColors: typeof colors.light,
) => {
	switch (status) {
		case "Paid":
			return themeColors.statusPaid;
		case "Due":
			return themeColors.statusDue;
		case "Draft":
			return themeColors.statusDraft;
		default:
			return themeColors.mutedForeground;
	}
};

export default function InvoiceDashboardScreen() {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const router = useRouter();

	// State for pull-to-refresh
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Handler for pull-to-refresh
	const onRefresh = useCallback(() => {
		setIsRefreshing(true);
		// Simulate data fetching
		console.log("Refreshing invoices...");
		setTimeout(() => {
			// In a real app, you would re-fetch your data here
			// For now, we can just stop the refreshing indicator
			console.log("Invoices refreshed (simulated).");
			setIsRefreshing(false);
		}, 2000); // Simulate a 2-second network request
	}, []);

	const renderInvoiceItem = ({ item }: { item: Invoice }) => (
		<TouchableOpacity
			style={[
				styles.invoiceItemContainer,
				{
					backgroundColor: themeColors.card,
					borderBottomColor: themeColors.border,
				},
			]}
			onPress={() => router.push(`/invoices/${item.id}`)} // Assuming detail screen path
		>
			<View
				style={[
					styles.iconContainer,
					{ backgroundColor: getStatusColor(item.status, themeColors) },
				]}
			>
				<FileText size={20} color={themeColors.primaryForeground} />{" "}
				{/* Ensure contrast against badge color */}
			</View>
			<View style={styles.invoiceDetails}>
				<Text style={[styles.clientName, { color: themeColors.foreground }]}>
					{item.clientName}
				</Text>
				<Text
					style={[styles.summaryLine, { color: themeColors.mutedForeground }]}
				>
					{item.amount > 0 ? `$${item.amount} · ` : ""}
					<Text style={{ color: getStatusColor(item.status, themeColors) }}>
						{item.status}
					</Text>
					{` · ${item.date}`}
				</Text>
			</View>
			<View style={styles.timeAndArrowContainer}>
				<Text
					style={[
						styles.lastActionTime,
						{ color: themeColors.mutedForeground },
					]}
				>
					{item.lastActionTime}
				</Text>
				<ChevronRight size={20} color={themeColors.mutedForeground} />
			</View>
		</TouchableOpacity>
	);

	return (
		<SafeAreaView
			style={[styles.safeArea, { backgroundColor: themeColors.background }]}
		>
			<Stack.Screen
				options={{
					headerShadowVisible: false,
					headerStyle: { backgroundColor: themeColors.background },
					headerTintColor: themeColors.primary,
				}}
			/>
			{/* New Main Content Container to match Clients screen structure */}
			<View style={styles.container}>
				{/* Header Row for Title and Create Button */}
				<View style={styles.headerRow}>
					<Text style={[styles.title, { color: themeColors.foreground }]}>
						Invoices
					</Text>
					<TouchableOpacity
						style={[
							styles.headerButton,
							{ backgroundColor: themeColors.primary },
						]}
						onPress={() => router.push("/invoices/create")}
						accessibilityLabel="Create new invoice"
					>
						<Text
							style={[
								styles.headerButtonText,
								{ color: themeColors.primaryForeground },
							]}
						>
							+ Create Invoice
						</Text>
					</TouchableOpacity>
				</View>

				{/* Search Bar */}
				<View
					style={[
						styles.searchBarContainer,
						{ backgroundColor: themeColors.input },
					]}
				>
					<SearchIcon
						size={20}
						color={themeColors.mutedForeground}
						style={styles.searchIcon}
					/>
					<TextInput
						placeholder="Search Invoices"
						placeholderTextColor={themeColors.mutedForeground}
						style={[styles.searchInput, { color: themeColors.foreground }]}
					/>
				</View>

				{/* Invoice List */}
				<FlatList
					data={mockInvoices}
					renderItem={renderInvoiceItem}
					keyExtractor={(item) => item.id}
					style={styles.listContainer}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={onRefresh}
							tintColor={themeColors.primary} // Optional: for iOS spinner color
							colors={[themeColors.primary]} // Optional: for Android spinner color(s)
						/>
					}
					ListHeaderComponent={
						<View
							style={[
								styles.summaryCard,
								{ backgroundColor: themeColors.card },
							]}
						>
							<View style={styles.summaryMetricsContainer}>
								<View style={styles.metricItem}>
									<Text
										style={[styles.metricValue, { color: themeColors.primary }]}
									>
										${mockSummaryMetrics.totalOutstanding.toFixed(2)}
									</Text>
									<Text
										style={[
											styles.metricLabel,
											{ color: themeColors.mutedForeground },
										]}
									>
										Total Outstanding
									</Text>
								</View>
								<View style={styles.metricItem}>
									<Text
										style={[
											styles.metricValue,
											{ color: themeColors.statusDue },
										]}
									>
										${mockSummaryMetrics.totalOverdue.toFixed(2)}
									</Text>
									<Text
										style={[
											styles.metricLabel,
											{ color: themeColors.mutedForeground },
										]}
									>
										Total Overdue
									</Text>
								</View>
								<View style={styles.metricItem}>
									<Text
										style={[
											styles.metricValue,
											{ color: themeColors.foreground },
										]}
									>
										{mockSummaryMetrics.avgCollectionPeriod}
									</Text>
									<Text
										style={[
											styles.metricLabel,
											{ color: themeColors.mutedForeground },
										]}
									>
										Avg. Collection
									</Text>
								</View>
							</View>
						</View>
					}
				/>
			</View>{" "}
			{/* End of new styles.container View */}
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	// New container style from Clients screen
	container: {
		flex: 1,
		paddingHorizontal: 0, // Matches Clients screen
		paddingTop: 16, // Matches Clients screen
	},
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		// paddingTop: 10, // Removed: parent container's paddingTop:16 handles this
		marginBottom: 16,
	},
	title: {
		fontSize: 30,
		fontWeight: "bold",
		// color will be set inline with themeColors.foreground
	},
	headerButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 20,
	},
	headerButtonText: {
		fontSize: 14,
		fontWeight: "bold",
	},
	searchBarContainer: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 12,
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginBottom: 16,
		marginHorizontal: 16,
	},
	searchIcon: {
		marginRight: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 16,
		height: 24,
	},
	listContainer: {
		flex: 1,
		paddingHorizontal: 16,
		// Ensure this container can actually scroll if content is shorter than screen
		// by ensuring its parent also has flex:1 and allows it to expand.
		// If the FlatList content itself is short, the pull-to-refresh will still work.
	},
	summaryCard: {
		padding: 20,
		borderRadius: 8,
		marginBottom: 10,
	},
	summaryMetricsContainer: {
		flexDirection: "row",
		justifyContent: "space-around",
		alignItems: "center",
	},
	metricItem: {
		alignItems: "center",
		paddingHorizontal: 5,
	},
	metricValue: {
		fontSize: 18,
		fontWeight: "bold",
		marginBottom: 4,
	},
	metricLabel: {
		fontSize: 12,
	},
	invoiceItemContainer: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 15,
		paddingHorizontal: 10,
		borderBottomWidth: 1,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		justifyContent: "center",
		alignItems: "center",
		marginRight: 15,
	},
	invoiceDetails: {
		flex: 1,
		justifyContent: "center",
	},
	clientName: {
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 4,
	},
	summaryLine: {
		fontSize: 13,
	},
	timeAndArrowContainer: {
		flexDirection: "row",
		alignItems: "center",
		marginLeft: "auto",
	},
	lastActionTime: {
		fontSize: 12,
		marginRight: 8,
	},
	placeholderText: {
		fontSize: 16,
		textAlign: "center",
	},
});

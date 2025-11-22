import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, Plus, Receipt, Camera, Upload, Edit3, X } from "lucide-react-native";
import { useCallback, useState, useRef, useMemo } from "react";
import {
	View,
	StyleSheet,
	TouchableOpacity,
	ActivityIndicator,
	FlatList,
	RefreshControl,
	Alert,
	Platform
} from "react-native";
import {
	BottomSheetModal,
	BottomSheetModalProvider,
	BottomSheetView,
	BottomSheetBackdrop
} from '@gorhom/bottom-sheet';

import { SafeAreaView } from "@/components/safe-area-view";
import { Text } from "@/components/ui/text";
import { H1 } from "@/components/ui/typography";
import { useTheme } from "@/context/theme-provider";
import { useTabBarVisibility } from "@/context/TabBarVisibilityContext";
import { useSupabase } from "@/context/supabase-provider";
import AddExpenseModal, { AddExpenseModalRef } from "@/components/expenses/AddExpenseModal";

type Expense = {
	id: string;
	merchant_name: string;
	total_amount: number;
	tax_amount: number;
	expense_date: string;
	category_id: string;
	description?: string;
	category?: {
		category_name: string;
		icon_emoji: string;
	};
};

export default function ExpensesScreen() {
	const router = useRouter();
	const { theme } = useTheme();
	const { setIsTabBarVisible } = useTabBarVisibility();
	const { supabase, user } = useSupabase();

	const [expenses, setExpenses] = useState<Expense[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	// Bottom Sheet Refs
	const bottomSheetModalRef = useRef<BottomSheetModal>(null);
	const addExpenseModalRef = useRef<AddExpenseModalRef>(null);
	const snapPoints = useMemo(() => ['35%'], []);

	useFocusEffect(
		useCallback(() => {
			setIsTabBarVisible(false);
			loadExpenses();
			return () => setIsTabBarVisible(true);
		}, [setIsTabBarVisible])
	);

	const loadExpenses = async () => {
		if (!user || !supabase) return;
		try {
			const { data, error } = await supabase
				.from('expenses')
				.select(`
					*,
					category:expense_categories(category_name, icon_emoji)
				`)
				.eq('user_id', user.id)
				.order('expense_date', { ascending: false });

			if (error) throw error;
			setExpenses(data || []);
		} catch (error) {
			console.error('Error loading expenses:', error);
		} finally {
			setIsLoading(false);
			setRefreshing(false);
		}
	};

	const onRefresh = () => {
		setRefreshing(true);
		loadExpenses();
	};

	const handleAddPress = useCallback(() => {
		bottomSheetModalRef.current?.present();
	}, []);

	const handleOptionPress = (option: 'scan' | 'upload' | 'manual') => {
		bottomSheetModalRef.current?.dismiss();
		// Small delay to allow sheet to close
		setTimeout(() => {
			if (option === 'manual') {
				addExpenseModalRef.current?.present();
			} else {
				Alert.alert('Coming Soon', 'This feature is currently being built.');
			}
		}, 100);
	};

	const handleExpenseAdded = () => {
		loadExpenses(); // Refresh the expense list
	};

	const renderBackdrop = useCallback(
		(props: any) => (
			<BottomSheetBackdrop
				{...props}
				disappearsOnIndex={-1}
				appearsOnIndex={0}
				opacity={0.5}
			/>
		),
		[]
	);

	const renderExpenseItem = ({ item }: { item: Expense }) => (
		<TouchableOpacity
			style={[styles.expenseItem, { backgroundColor: theme.card, borderColor: theme.border }]}
			onPress={() => {
				router.push(`/(app)/(protected)/expenses/${item.id}`);
			}}
		>
			<View style={styles.expenseIconContainer}>
				<Text style={styles.categoryEmoji}>
					{item.category?.icon_emoji || '🧾'}
				</Text>
			</View>
			<View style={styles.expenseDetails}>
				<Text style={[styles.merchantText, { color: theme.foreground }]}>{item.merchant_name}</Text>
				<View style={styles.metaContainer}>
					<Text style={[styles.categoryText, { color: theme.mutedForeground }]}>
						{item.category?.category_name || 'Uncategorized'}
					</Text>
					<Text style={[styles.dateText, { color: theme.mutedForeground }]}>
						• {new Date(item.expense_date).toLocaleDateString()}
					</Text>
				</View>
			</View>
			<View style={{ alignItems: 'flex-end' }}>
				<Text style={[styles.amountText, { color: theme.foreground }]}>
					${item.total_amount.toFixed(2)}
				</Text>
				{item.tax_amount > 0 && (
					<Text style={[styles.taxText, { color: theme.mutedForeground }]}>
						Tax: ${item.tax_amount.toFixed(2)}
					</Text>
				)}
			</View>
		</TouchableOpacity>
	);

	return (
		<BottomSheetModalProvider>
			<SafeAreaView
				style={{ backgroundColor: theme.background }}
				className="flex-1"
			>
				{/* Header */}
				<View style={styles.header}>
					<TouchableOpacity
						onPress={() => router.push('/(app)/(protected)/newsettings')}
						style={styles.backButton}
					>
						<ChevronLeft size={24} color={theme.foreground} />
					</TouchableOpacity>
					<H1 style={{ color: theme.foreground, flex: 1, textAlign: 'center' }}>
						Expenses
					</H1>
					<TouchableOpacity
						style={[styles.addButton, { backgroundColor: theme.primary }]}
						onPress={handleAddPress}
					>
						<Plus size={18} color={theme.primaryForeground} />
						<Text style={[styles.addButtonText, { color: theme.primaryForeground }]}>
							Add
						</Text>
					</TouchableOpacity>
				</View>

				{/* Content */}
				{isLoading ? (
					<View style={styles.centerContainer}>
						<ActivityIndicator size="large" color={theme.primary} />
					</View>
				) : expenses.length === 0 ? (
					<View style={styles.emptyContainer}>
						<Receipt size={64} color={theme.mutedForeground} style={{ opacity: 0.5 }} />
						<Text style={[styles.emptyTitle, { color: theme.foreground }]}>
							No Expenses Yet
						</Text>
						<Text style={[styles.emptyDescription, { color: theme.mutedForeground }]}>
							Track your spending by adding your first expense.
						</Text>
						{/* Removed button from middle as requested */}
					</View>
				) : (
					<FlatList
						data={expenses}
						renderItem={renderExpenseItem}
						keyExtractor={(item) => item.id}
						contentContainerStyle={styles.listContent}
						refreshControl={
							<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
						}
					/>
				)}

				{/* Add Options Bottom Sheet */}
				<BottomSheetModal
					ref={bottomSheetModalRef}
					index={0}
					snapPoints={snapPoints}
					backdropComponent={renderBackdrop}
					backgroundStyle={{ backgroundColor: theme.card }}
					handleIndicatorStyle={{ backgroundColor: theme.mutedForeground }}
				>
					<BottomSheetView style={styles.modalContent}>
						<View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
							<Text style={[styles.modalTitle, { color: theme.foreground }]}>Add Expense</Text>
							<TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
								<X size={24} color={theme.mutedForeground} />
							</TouchableOpacity>
						</View>

						<View style={styles.modalBody}>
							<TouchableOpacity
								style={styles.optionButton}
								onPress={() => handleOptionPress('scan')}
							>
								<View style={styles.optionButtonRow}>
									<Camera size={24} color={theme.foreground} />
									<View style={styles.optionButtonContent}>
										<Text style={[styles.optionButtonTitle, { color: theme.foreground }]}>
											Scan Receipt
										</Text>
									</View>
								</View>
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.optionButton}
								onPress={() => handleOptionPress('upload')}
							>
								<View style={styles.optionButtonRow}>
									<Upload size={24} color={theme.foreground} />
									<View style={styles.optionButtonContent}>
										<Text style={[styles.optionButtonTitle, { color: theme.foreground }]}>
											Upload Receipt
										</Text>
									</View>
								</View>
							</TouchableOpacity>

							<TouchableOpacity
								style={styles.optionButton}
								onPress={() => handleOptionPress('manual')}
							>
								<View style={styles.optionButtonRow}>
									<Edit3 size={24} color={theme.foreground} />
									<View style={styles.optionButtonContent}>
										<Text style={[styles.optionButtonTitle, { color: theme.foreground }]}>
											Add Manually
										</Text>
									</View>
								</View>
							</TouchableOpacity>
						</View>
					</BottomSheetView>
				</BottomSheetModal>

				{/* Add Expense Modal */}
				<AddExpenseModal 
					ref={addExpenseModalRef}
					onExpenseAdded={handleExpenseAdded}
				/>
			</SafeAreaView>
		</BottomSheetModalProvider>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingTop: 12,
		paddingBottom: 16,
	},
	backButton: {
		padding: 8,
		marginLeft: -8,
	},
	addButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
	},
	addButtonText: {
		fontSize: 16,
		fontWeight: "600",
		marginLeft: 6,
	},
	centerContainer: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 32,
		paddingBottom: 100,
	},
	emptyTitle: {
		fontSize: 24,
		fontWeight: "600",
		marginTop: 24,
		marginBottom: 12,
		textAlign: "center",
	},
	emptyDescription: {
		fontSize: 16,
		textAlign: "center",
		lineHeight: 24,
		marginBottom: 24,
	},
	listContent: {
		padding: 16,
	},
	expenseItem: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 16,
		borderRadius: 12,
		marginBottom: 12,
		borderWidth: 1,
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 4,
		elevation: 2,
	},
	expenseIconContainer: {
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: 'rgba(0,0,0,0.03)',
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 12,
	},
	categoryEmoji: {
		fontSize: 24,
	},
	expenseDetails: {
		flex: 1,
	},
	merchantText: {
		fontSize: 16,
		fontWeight: '600',
		marginBottom: 4,
	},
	metaContainer: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	categoryText: {
		fontSize: 14,
	},
	dateText: {
		fontSize: 14,
		marginLeft: 4,
	},
	amountText: {
		fontSize: 16,
		fontWeight: '700',
	},
	taxText: {
		fontSize: 12,
		marginTop: 2,
	},
	// Modal Styles - Updated to match app style guide
	modalContent: {
		flex: 1,
	},
	modalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: "bold",
	},
	closeButton: {
		padding: 6,
	},
	modalBody: {
		flex: 1,
		padding: 16,
		paddingBottom: 30,
	},
	optionButton: {
		borderRadius: 10,
		marginBottom: 16,
		backgroundColor: '#F9F9F9',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.08,
		shadowRadius: 2,
		elevation: 3,
	},
	optionButtonRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 14,
		paddingHorizontal: 16,
	},
	optionButtonContent: {
		marginLeft: 16,
		flex: 1,
	},
	optionButtonTitle: {
		fontSize: 16,
		fontWeight: "bold",
		marginBottom: 2,
	},
});
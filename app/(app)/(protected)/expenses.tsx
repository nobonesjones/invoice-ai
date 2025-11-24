import { useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { ChevronLeft, Plus, Receipt, Camera, Upload, Edit3, X } from "lucide-react-native";
import * as LucideIcons from 'lucide-react-native';
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
import { ReceiptScanningService } from "@/services/receiptScanningService";

type Expense = {
	id: string;
	merchant_name: string;
	total_amount: number;
	tax_amount: number;
	expense_date: string;
	category_id: string;
	description?: string;
	expense_categories?: {
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
	const [isLoading, setIsLoading] = useState(false);
	const [currencySymbol, setCurrencySymbol] = useState('$');
	const [refreshing, setRefreshing] = useState(false);
	const [debugInfo, setDebugInfo] = useState<string>('');

	// Bottom Sheet Refs
	const bottomSheetModalRef = useRef<BottomSheetModal>(null);
	const addExpenseModalRef = useRef<AddExpenseModalRef>(null);
	const snapPoints = useMemo(() => ['35%'], []);

	useFocusEffect(
		useCallback(() => {
			setIsTabBarVisible(false);
			loadExpenses();
			loadUserCurrency();
			return () => setIsTabBarVisible(true);
		}, [setIsTabBarVisible])
	);

	const loadExpenses = async () => {
		if (!user || !supabase) {
			setDebugInfo('No user or supabase');
			return;
		}
		try {
			setDebugInfo(`Loading for user: ${user.id}`);

			// First load expenses
			const { data: expensesData, error: expensesError } = await supabase
				.from('expenses')
				.select('*')
				.eq('user_id', user.id)
				.order('expense_date', { ascending: false });

			if (expensesError) throw expensesError;

			// Then load categories to join manually
			const { data: categoriesData, error: categoriesError } = await supabase
				.from('expense_categories')
				.select('*')
				.eq('is_active', true);

			if (categoriesError) throw categoriesError;

			// Manually join the data
			const expensesWithCategories = expensesData?.map(expense => {
				const category = categoriesData?.find(cat => cat.id === expense.category_id);
				return {
					...expense,
					expense_categories: category ? {
						category_name: category.category_name,
						icon_emoji: category.icon_emoji
					} : null
				};
			}) || [];

			setDebugInfo(`Found ${expensesWithCategories.length} expenses with categories`);
			setExpenses(expensesWithCategories);
		} catch (error) {
			setDebugInfo(`Error: ${(error as any)?.message}`);
		} finally {
			setIsLoading(false);
			setRefreshing(false);
		}
	};

	const loadUserCurrency = async () => {
		try {
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('currency_symbol, currency')
				.eq('id', user?.id)
				.single();

			if (profile?.currency_symbol) {
				setCurrencySymbol(profile.currency_symbol);
			} else if (profile?.currency) {
				// Fallback: map currency code to symbol
				const currencyMap: Record<string, string> = {
					'USD': '$', 'GBP': '£', 'EUR': '€', 'JPY': '¥',
					'AUD': 'A$', 'CAD': 'C$', 'CHF': 'CHF', 'CNY': '¥',
					'INR': '₹', 'AED': 'د.إ'
				};
				setCurrencySymbol(currencyMap[profile.currency] || '$');
			}
		} catch (error) {
			console.error('Error loading currency:', error);
		}
	};

	const onRefresh = () => {
		setRefreshing(true);
		loadExpenses();
	};

	const handleAddPress = useCallback(() => {
		bottomSheetModalRef.current?.present();
	}, []);

	const handleOptionPress = async (option: 'scan' | 'upload' | 'manual') => {
		bottomSheetModalRef.current?.dismiss();

		if (option === 'manual') {
			// Small delay to allow sheet to close
			setTimeout(() => {
				addExpenseModalRef.current?.present();
			}, 100);
		} else if (option === 'scan') {
			// Request permission and open camera
			const { status } = await ImagePicker.requestCameraPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission needed', 'Camera permission is required to scan receipts');
				return;
			}

			const result = await ImagePicker.launchCameraAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				quality: 0.7,
				allowsEditing: false,
			});

			if (!result.canceled && result.assets[0]) {
				try {
					setIsLoading(true);

					const imageUri = result.assets[0].uri;

					// 1. Upload image to Supabase Storage
					const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
					const filePath = `${user?.id}/${fileName}`;

					// Read file as base64 and convert to blob
					const base64 = await FileSystem.readAsStringAsync(imageUri, {
						encoding: FileSystem.EncodingType.Base64,
					});

					// Convert base64 to blob
					const byteCharacters = atob(base64);
					const byteNumbers = new Array(byteCharacters.length);
					for (let i = 0; i < byteCharacters.length; i++) {
						byteNumbers[i] = byteCharacters.charCodeAt(i);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: 'image/jpeg' });

					const { data: uploadData, error: uploadError } = await supabase.storage
						.from('receipt-images')
						.upload(filePath, blob, {
							contentType: 'image/jpeg',
							upsert: false
						});

					if (uploadError) {
						throw new Error(`Upload failed: ${uploadError.message}`);
					}

					// 2. Get public URL
					const { data: { publicUrl } } = supabase.storage
						.from('receipt-images')
						.getPublicUrl(filePath);

					// 3. Get categories for AI context
					const { data: categoriesData } = await supabase
						.from('expense_categories')
						.select('id, category_name')
						.eq('is_active', true);

					const mappedCategories = categoriesData?.map(c => ({
						id: c.id,
						name: c.category_name
					})) || [];

					// 4. Scan receipt
					const scannedData = await ReceiptScanningService.scanReceipt(
						imageUri,
						supabase,
						mappedCategories
					);

					// 5. Open modal with scanned data + image URL
					addExpenseModalRef.current?.presentWithData?.({
						...scannedData,
						receipt_url: publicUrl
					});

				} catch (error: any) {
					console.error('Scanning error:', error);
					Alert.alert('Scanning Failed', error.message || 'Could not extract details from the receipt.');
				} finally {
					setIsLoading(false);
				}
			}
		} else if (option === 'upload') {
			// Request permission and open photo library
			const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (status !== 'granted') {
				Alert.alert('Permission needed', 'Photo library permission is required to upload receipts');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				quality: 0.7,
				allowsEditing: false,
			});

			if (!result.canceled && result.assets[0]) {
				try {
					setIsLoading(true);

					const imageUri = result.assets[0].uri;

					// 1. Upload image to Supabase Storage
					const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
					const filePath = `${user?.id}/${fileName}`;

					// Read file as base64 and convert to blob
					const base64 = await FileSystem.readAsStringAsync(imageUri, {
						encoding: FileSystem.EncodingType.Base64,
					});

					// Convert base64 to blob
					const byteCharacters = atob(base64);
					const byteNumbers = new Array(byteCharacters.length);
					for (let i = 0; i < byteCharacters.length; i++) {
						byteNumbers[i] = byteCharacters.charCodeAt(i);
					}
					const byteArray = new Uint8Array(byteNumbers);
					const blob = new Blob([byteArray], { type: 'image/jpeg' });

					const { data: uploadData, error: uploadError } = await supabase.storage
						.from('receipt-images')
						.upload(filePath, blob, {
							contentType: 'image/jpeg',
							upsert: false
						});

					if (uploadError) {
						throw new Error(`Upload failed: ${uploadError.message}`);
					}

					// 2. Get public URL
					const { data: { publicUrl } } = supabase.storage
						.from('receipt-images')
						.getPublicUrl(filePath);

					// 3. Get categories for AI context
					const { data: categoriesData } = await supabase
						.from('expense_categories')
						.select('id, category_name')
						.eq('is_active', true);

					const mappedCategories = categoriesData?.map(c => ({
						id: c.id,
						name: c.category_name
					})) || [];

					// 4. Scan receipt
					const scannedData = await ReceiptScanningService.scanReceipt(
						imageUri,
						supabase,
						mappedCategories
					);

					// 5. Open modal with scanned data + image URL
					addExpenseModalRef.current?.presentWithData?.({
						...scannedData,
						receipt_url: publicUrl
					});

				} catch (error: any) {
					console.error('Upload error:', error);
					Alert.alert('Upload Failed', error.message || 'Could not extract details from the receipt.');
				} finally {
					setIsLoading(false);
				}
			}
		} else {
			Alert.alert('Coming Soon', 'This feature is currently being built.');
		}
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

	// Helper to format date like "Jan 6" or "Nov 11"
	const formatDisplayDate = (dateString: string | null): string => {
		if (!dateString) return '';
		try {
			const date = new Date(dateString);
			return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
		} catch (e) {
			return '';
		}
	};

	const handleExpensePress = (expense: Expense) => {
		// Open the edit modal with pre-filled data
		addExpenseModalRef.current?.presentWithData?.(expense);
	};

	const renderExpenseItem = ({ item }: { item: Expense }) => (
		<TouchableOpacity
			style={[
				styles.expenseItemContainer,
				{
					backgroundColor: theme.isDark ? theme.card : '#FFFFFF',
					borderBottomColor: theme.border,
				},
			]}
			onPress={() => handleExpensePress(item)}
		>
			<View style={styles.iconContainer}>
				{item.expense_categories?.icon_emoji ? (
					(() => {
						const IconComponent = (LucideIcons as any)[item.expense_categories.icon_emoji];
						return IconComponent ? (
							<IconComponent size={24} color={theme.foreground} />
						) : (
							<Receipt size={24} color={theme.foreground} />
						);
					})()
				) : (
					<Receipt size={24} color={theme.foreground} />
				)}
			</View>
			<View style={styles.expenseDetails}>
				<View style={styles.topRow}>
					<Text style={[styles.merchantText, { color: theme.foreground }]}>
						{item.merchant_name}
					</Text>
					<Text style={[styles.expenseAmount, { color: theme.foreground }]}>
						{currencySymbol}{item.total_amount.toFixed(2)}
					</Text>
				</View>
				<View style={styles.bottomRow}>
					<Text style={[styles.categoryText, { color: theme.mutedForeground }]}>
						{item.expense_categories?.category_name || 'No Category'}
					</Text>
					<Text style={[styles.dateText, { color: theme.mutedForeground }]}>
						{formatDisplayDate(item.expense_date)}
					</Text>
				</View>
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

				{/* Debug Info */}
				{debugInfo && (
					<View style={{ padding: 16, backgroundColor: '#f0f0f0', margin: 16, borderRadius: 8 }}>
						<Text style={{ color: '#000', fontSize: 12 }}>Debug: {debugInfo}</Text>
					</View>
				)}

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
		paddingHorizontal: 16,
		paddingBottom: 20,
	},
	expenseItemContainer: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 16,
		paddingHorizontal: 16,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	iconContainer: {
		width: 40,
		height: 40,
		justifyContent: 'center',
		alignItems: 'center',
		marginRight: 16,
	},
	categoryEmoji: {
		fontSize: 22,
	},
	expenseDetails: {
		flex: 1,
	},
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	bottomRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	merchantText: {
		fontSize: 16,
		fontWeight: '600',
		flex: 1,
	},
	expenseAmount: {
		fontSize: 16,
		fontWeight: '600',
		marginLeft: 8,
	},
	categoryText: {
		fontSize: 14,
		flex: 1,
	},
	dateText: {
		fontSize: 14,
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
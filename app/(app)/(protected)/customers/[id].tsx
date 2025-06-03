import React, { useEffect, useState, useRef } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	TouchableOpacity,
	Platform,
	Alert,
	ActivityIndicator,
	Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { 
	ChevronLeft, 
	Edit3, 
	Phone, 
	MessageSquare, 
	Mail, 
	Plus, 
	User, 
	Calendar,
	DollarSign,
	Clock,
	TrendingUp,
	FileText,
	CheckCircle,
	AlertCircle
} from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider';
import { Tables } from '../../../../types/database.types';
import CreateNewClientSheet, { CreateNewClientSheetRef } from './CreateNewClientSheet';

type Client = Tables<'clients'>;
type Invoice = Tables<'invoices'>;

interface ClientMetrics {
	totalBilled: number;
	totalOutstanding: number;
	averagePaymentDays: number | null;
	totalInvoices: number;
	paidInvoices: number;
	overdueInvoices: number;
	lastActivity: string;
}

interface ActivityItem {
	id: string;
	type: 'payment' | 'invoice' | 'reminder' | 'status';
	description: string;
	amount?: number;
	date: string;
	status: 'completed' | 'sent' | 'overdue' | 'paid';
}

export default function ClientProfileScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const navigation = useNavigation();
	const { isLightMode } = useTheme();
	const { setIsTabBarVisible } = useTabBarVisibility();
	const { supabase, user } = useSupabase();
	const theme = isLightMode ? colors.light : colors.dark;

	// Refs
	const editClientSheetRef = useRef<CreateNewClientSheetRef>(null);

	// State management
	const [client, setClient] = useState<Client | null>(null);
	const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
	const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	console.log('[ClientProfileScreen] Loading client ID:', id);

	// Custom header setup (following pagetransitions.md)
	useEffect(() => {
		navigation.setOptions({
			header: () => (
				<View style={[styles.headerContainer, { 
					backgroundColor: theme.card, 
					borderBottomWidth: StyleSheet.hairlineWidth, 
					borderBottomColor: theme.border 
				}]}>
					<TouchableOpacity onPress={() => router.push('/customers/')} style={{ padding: 6 }}>
						<ChevronLeft size={26} color={theme.foreground} />
					</TouchableOpacity>
					<Text style={[styles.headerTitle, { color: theme.foreground }]}>
						Client Profile
					</Text>
					<TouchableOpacity onPress={handleEditClient} style={{ padding: 6 }}>
						<Text style={{ color: theme.foreground, fontSize: 16, fontWeight: '500' }}>
							Edit
						</Text>
					</TouchableOpacity>
				</View>
			),
					headerShown: true,
		});
	}, [navigation, router, theme, client]);

	// Tab bar visibility management (following pagetransitions.md Approach 2)
	useEffect(() => {
		const unsubscribeFocus = navigation.addListener('focus', () => {
			console.log('[ClientProfileScreen] Focus event: Hiding tab bar');
			setIsTabBarVisible(false);
		});

		const unsubscribeBlur = navigation.addListener('blur', () => {
			console.log('[ClientProfileScreen] Blur event: Showing tab bar');
			setIsTabBarVisible(true);
		});

		// Initial hide if screen is focused on mount
		if (navigation.isFocused()) {
			console.log('[ClientProfileScreen] Initial focus: Hiding tab bar');
			setIsTabBarVisible(false);
		}

		return () => {
			console.log('[ClientProfileScreen] Unmounting: Ensuring tab bar is visible');
			unsubscribeFocus();
			unsubscribeBlur();
			setIsTabBarVisible(true);
		};
	}, [navigation, setIsTabBarVisible]);

	// Fetch client data and related metrics
	const fetchClientData = async () => {
		if (!supabase || !user || !id) {
			setError('Missing required data to load client information.');
			setIsLoading(false);
			return;
		}

		try {
			setIsLoading(true);
			setError(null);

			// Fetch client data
			const { data: clientData, error: clientError } = await supabase
				.from('clients')
				.select('*')
				.eq('id', id)
				.eq('user_id', user.id)
				.single();

			if (clientError) {
				console.error('[fetchClientData] Error fetching client:', clientError);
				setError('Failed to load client information.');
				return;
			}

			if (!clientData) {
				setError('Client not found.');
				return;
			}

			setClient(clientData);

			// Fetch invoices for this client
			const { data: invoicesData, error: invoicesError } = await supabase
				.from('invoices')
				.select('*')
				.eq('client_id', id)
				.eq('user_id', user.id)
				.order('created_at', { ascending: false });

			if (invoicesError) {
				console.error('[fetchClientData] Error fetching invoices:', invoicesError);
				// Don't fail completely, just show client data without metrics
			}

			// Calculate metrics from invoices
			const invoices = invoicesData || [];
			const totalBilled = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
			const paidInvoices = invoices.filter(inv => inv.status === 'paid').length;
			const overdueInvoices = invoices.filter(inv => inv.status === 'overdue').length;
			const totalOutstanding = invoices.filter(inv => 
				inv.status !== 'paid' && inv.status !== 'cancelled'
			).reduce((sum, inv) => sum + ((inv.total_amount || 0) - (inv.paid_amount || 0)), 0);

			// Calculate average payment days from sent date to payment date
			const paidInvoicesWithPaymentDates = invoices.filter(inv => 
				inv.status === 'paid' && inv.payment_date && inv.invoice_date
			);
			
			let averagePaymentDays: number | null = null;
			if (paidInvoicesWithPaymentDates.length > 0) {
				const totalDays = paidInvoicesWithPaymentDates.reduce((sum, inv) => {
					const sentDate = new Date(inv.invoice_date);
					const paidDate = new Date(inv.payment_date!);
					const diffInDays = Math.ceil((paidDate.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
					return sum + Math.max(0, diffInDays); // Ensure non-negative days
				}, 0);
				averagePaymentDays = Math.round(totalDays / paidInvoicesWithPaymentDates.length);
			}

			const calculatedMetrics: ClientMetrics = {
				totalBilled,
				totalOutstanding,
				averagePaymentDays,
				totalInvoices: invoices.length,
				paidInvoices,
				overdueInvoices,
				lastActivity: invoices.length > 0 ? 'Recent' : 'No activity'
			};

			setMetrics(calculatedMetrics);

			// Fetch recent activity from invoice_activities
			const { data: activitiesData, error: activitiesError } = await supabase
				.from('invoice_activities')
				.select(`
					id,
					activity_type,
					activity_description,
					activity_data,
					created_at,
					invoices!inner(client_id)
				`)
				.eq('invoices.client_id', id)
				.eq('user_id', user.id)
				.order('created_at', { ascending: false })
				.limit(10);

			if (activitiesError) {
				console.error('[fetchClientData] Error fetching activities:', activitiesError);
			} else {
				// Transform activities data
				const transformedActivities: ActivityItem[] = (activitiesData || []).map(activity => {
					const activityData = activity.activity_data as any;
					let type: ActivityItem['type'] = 'invoice';
					let status: ActivityItem['status'] = 'sent';
					
					// Map activity types to our display types
					switch (activity.activity_type) {
						case 'payment_added':
							type = 'payment';
							status = 'completed';
							break;
						case 'sent':
						case 'email_sent':
							type = 'invoice';
							status = 'sent';
							break;
						case 'status_changed':
							type = 'status';
							status = activityData?.to_status === 'paid' ? 'paid' : 'sent';
							break;
						default:
							type = 'invoice';
							status = 'sent';
					}

					return {
						id: activity.id,
						type,
						description: activity.activity_description,
						amount: activityData?.payment_amount,
						date: activity.created_at,
						status
					};
				});

				setRecentActivity(transformedActivities);
			}

		} catch (error: any) {
			console.error('[fetchClientData] Unexpected error:', error);
			setError('An unexpected error occurred while loading client data.');
		} finally {
			setIsLoading(false);
		}
	};

	// Load data on component mount
	useEffect(() => {
		fetchClientData();
	}, [id, supabase, user]);

	// Quick action handlers
	const handleCallClient = () => {
		if (client?.phone) {
			const phoneNumber = client.phone.replace(/[^\d+]/g, ''); // Clean phone number
			Linking.openURL(`tel:${phoneNumber}`).catch(() => {
				Alert.alert('Error', 'Unable to make phone call. Please check if your device supports calling.');
			});
		} else {
			Alert.alert('No Phone Number', 'This client does not have a phone number on file.');
		}
	};

	const handleMessageClient = () => {
		if (client?.phone) {
			const phoneNumber = client.phone.replace(/[^\d+]/g, ''); // Clean phone number
			Linking.openURL(`sms:${phoneNumber}`).catch(() => {
				Alert.alert('Error', 'Unable to open messaging app.');
			});
		} else {
			Alert.alert('No Phone Number', 'This client does not have a phone number on file.');
		}
	};

	const handleEmailClient = () => {
		if (client?.email) {
			Linking.openURL(`mailto:${client.email}`).catch(() => {
				Alert.alert('Error', 'Unable to open email app.');
			});
		} else {
			Alert.alert('No Email Address', 'This client does not have an email address on file.');
		}
	};

	const handleNewInvoice = () => {
		if (client) {
			router.push({
				pathname: '/invoices/create',
				params: { 
					selectedClientId: client.id, 
					selectedClientName: client.name 
				}
			});
		}
	};

	const handleEditClient = () => {
		if (editClientSheetRef.current) {
			editClientSheetRef.current.present();
		}
	};

	const handleClientUpdated = (updatedClient: Client) => {
		setClient(updatedClient);
		fetchClientData();
	};

	const handleEditSheetClose = () => {
		// Handle close logic
	};

	const getActivityIcon = (type: string) => {
		switch (type) {
			case 'payment':
				return CheckCircle;
			case 'invoice':
				return FileText;
			case 'reminder':
				return AlertCircle;
			default:
				return FileText;
		}
	};

	const getActivityColor = (status: string) => {
		switch (status) {
			case 'completed':
			case 'paid':
				return '#10B981'; // Green
			case 'sent':
				return '#3B82F6'; // Blue
			case 'overdue':
				return '#EF4444'; // Red
			default:
				return theme.mutedForeground;
		}
	};

	const formatTimestamp = (timestamp: string): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
		
		if (diffInHours < 1) {
			const diffInMinutes = Math.floor(diffInHours * 60);
			return diffInMinutes <= 1 ? 'Just now' : `${diffInMinutes}m ago`;
		} else if (diffInHours < 24) {
			return `${Math.floor(diffInHours)}h ago`;
		} else if (diffInHours < 48) {
			return 'Yesterday';
		} else {
			const days = Math.floor(diffInHours / 24);
			if (days < 7) {
				return `${days} days ago`;
			} else {
				return date.toLocaleDateString('en-US', { 
					month: 'short', 
					day: 'numeric'
				});
			}
		}
	};

	const formatAddress = (client: Client): string => {
		const parts = [
			client.address_line1,
			client.address_line2,
			client.city,
			client.state_province_region,
			client.postal_zip_code,
			client.country
		].filter(Boolean);
		
		return parts.length > 0 ? parts.join(', ') : 'No address on file';
	};

	const getStyles = () => StyleSheet.create({
		// Header styles (following pagetransitions.md)
		headerContainer: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingHorizontal: 10,
			paddingTop: Platform.OS === 'ios' ? 50 : 40,
			paddingBottom: 10,
		},
		headerTitle: {
			fontSize: 20,
			fontWeight: 'bold',
			flex: 1,
			textAlign: 'center',
		},

		// Container styles
	container: {
		flex: 1,
			backgroundColor: theme.background,
		},
		scrollContent: {
			padding: 16,
			paddingBottom: 100, // Space for sticky button
		},

		// Client Header Section
		clientHeaderContainer: {
			backgroundColor: theme.card,
			borderRadius: 12,
			padding: 20,
			marginBottom: 16,
		borderWidth: 1,
			borderColor: theme.border,
		},
		clientAvatarContainer: {
			width: 60,
			height: 60,
			borderRadius: 30,
			backgroundColor: theme.primary,
			justifyContent: 'center',
			alignItems: 'center',
			marginBottom: 12,
		},
		clientName: {
			fontSize: 24,
			fontWeight: 'bold',
			color: theme.foreground,
			marginBottom: 4,
		},
		clientCompany: {
			fontSize: 16,
			color: theme.mutedForeground,
			marginBottom: 12,
		},
		clientContact: {
			fontSize: 14,
			color: theme.mutedForeground,
			marginBottom: 4,
		},

		// Quick Actions
		quickActionsContainer: {
			flexDirection: 'row',
			marginTop: 16,
			gap: 12,
		},
		quickActionButton: {
			flex: 1,
			backgroundColor: theme.primary,
			borderRadius: 8,
			paddingVertical: 12,
			alignItems: 'center',
			justifyContent: 'center',
			flexDirection: 'row',
		},
		quickActionButtonSecondary: {
			backgroundColor: theme.muted,
		},
		quickActionText: {
			color: theme.primaryForeground,
			fontSize: 14,
			fontWeight: '600',
			marginLeft: 6,
		},
		quickActionTextSecondary: {
			color: theme.foreground,
		},

		// Metrics Cards
		metricsContainer: {
			flexDirection: 'row',
			gap: 12,
			marginBottom: 16,
		},
		metricCard: {
		flex: 1,
			backgroundColor: theme.card,
			borderRadius: 12,
			padding: 16,
			borderWidth: 1,
			borderColor: theme.border,
		},
		metricValue: {
			fontSize: 24,
			fontWeight: 'bold',
			color: theme.foreground,
			marginBottom: 4,
		},
		metricLabel: {
		fontSize: 12,
			color: theme.mutedForeground,
			textTransform: 'uppercase',
			letterSpacing: 0.5,
		},
		metricSubtext: {
			fontSize: 14,
			color: theme.mutedForeground,
			marginTop: 4,
		},

		// Stats Overview
		statsContainer: {
			backgroundColor: theme.card,
		borderRadius: 12,
			padding: 16,
			marginBottom: 16,
			borderWidth: 1,
			borderColor: theme.border,
		},
		sectionTitle: {
			fontSize: 18,
			fontWeight: 'bold',
			color: theme.foreground,
			marginBottom: 16,
		},
		statsRow: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
		paddingVertical: 8,
		},
		statsLabel: {
			fontSize: 14,
			color: theme.mutedForeground,
		},
		statsValue: {
			fontSize: 14,
			fontWeight: '600',
			color: theme.foreground,
		},
		statsDivider: {
			height: 1,
			backgroundColor: theme.border,
			marginVertical: 8,
		},

		// Recent Activity
		activityContainer: {
			backgroundColor: theme.card,
			borderRadius: 12,
			padding: 16,
			marginBottom: 16,
		borderWidth: 1,
			borderColor: theme.border,
		},
		activityItem: {
			flexDirection: 'row',
			paddingVertical: 12,
			borderBottomWidth: 1,
			borderBottomColor: theme.border,
		},
		activityItemLast: {
			borderBottomWidth: 0,
		},
		activityIconContainer: {
			width: 32,
			height: 32,
			borderRadius: 16,
			justifyContent: 'center',
			alignItems: 'center',
			marginRight: 12,
		},
		activityContent: {
			flex: 1,
		},
		activityDescription: {
			fontSize: 14,
			color: theme.foreground,
			marginBottom: 2,
		},
		activityMeta: {
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
		},
		activityDate: {
			fontSize: 12,
			color: theme.mutedForeground,
		},
		activityAmount: {
			fontSize: 14,
			fontWeight: '600',
			color: theme.foreground,
		},

		// Sticky bottom button (following pagestylinguide.md Section V)
		stickyButtonContainer: {
			position: 'absolute',
			bottom: 0,
			left: 0,
			right: 0,
			padding: 16,
			paddingBottom: Platform.OS === 'ios' ? 32 : 16,
			backgroundColor: theme.background,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: theme.border,
		},
		primaryButton: {
			backgroundColor: theme.primary,
			borderRadius: 10,
			paddingVertical: 16,
			alignItems: 'center',
			justifyContent: 'center',
			flexDirection: 'row',
		},
		primaryButtonText: {
			color: theme.primaryForeground,
		fontSize: 16,
			fontWeight: 'bold',
		marginLeft: 8,
	},

		// Loading and error states
		loadingText: {
			fontSize: 16,
			fontWeight: 'bold',
		},
		errorText: {
			fontSize: 16,
			fontWeight: 'bold',
		},
		retryButton: {
			padding: 16,
			borderRadius: 8,
		},
		retryButtonText: {
			fontSize: 16,
			fontWeight: 'bold',
		},
	});

	const styles = getStyles();

	return (
		<SafeAreaView style={styles.container} edges={['left', 'right']}>
			{isLoading ? (
				<View style={[styles.scrollContent, { justifyContent: 'center', alignItems: 'center' }]}>
					<ActivityIndicator size="large" color={theme.primary} />
					<Text style={[styles.loadingText, { color: theme.mutedForeground, marginTop: 16 }]}>
						Loading client information...
					</Text>
				</View>
			) : error ? (
				<View style={[styles.scrollContent, { justifyContent: 'center', alignItems: 'center' }]}>
					<Text style={[styles.errorText, { color: theme.destructive, textAlign: 'center', marginBottom: 16 }]}>
						{error}
					</Text>
					<TouchableOpacity
						style={[styles.retryButton, { backgroundColor: theme.primary }]}
						onPress={fetchClientData}
					>
						<Text style={[styles.retryButtonText, { color: theme.primaryForeground }]}>
							Retry
						</Text>
					</TouchableOpacity>
				</View>
			) : !client ? (
				<View style={[styles.scrollContent, { justifyContent: 'center', alignItems: 'center' }]}>
					<Text style={[styles.errorText, { color: theme.mutedForeground, textAlign: 'center' }]}>
						Client not found
					</Text>
				</View>
			) : (
				<>
					<ScrollView 
						style={{ flex: 1 }} 
						contentContainerStyle={styles.scrollContent}
						showsVerticalScrollIndicator={false}
					>
						{/* Client Header Section */}
						<View style={styles.clientHeaderContainer}>
							<View style={styles.clientAvatarContainer}>
								<User size={30} color={theme.primaryForeground} />
							</View>
							
							<Text style={styles.clientName}>{client?.name}</Text>
							
							<Text style={styles.clientContact}>{client?.email}</Text>
							<Text style={styles.clientContact}>{client?.phone}</Text>
							{client?.tax_number && (
								<Text style={styles.clientContact}>Tax: {client.tax_number}</Text>
							)}
							<Text style={styles.clientContact}>{formatAddress(client as Client)}</Text>

							{/* Quick Actions */}
							<View style={styles.quickActionsContainer}>
								<TouchableOpacity style={styles.quickActionButton} onPress={handleCallClient}>
									<Phone size={16} color={theme.primaryForeground} />
									<Text style={styles.quickActionText}>Call</Text>
								</TouchableOpacity>
								
								<TouchableOpacity style={[styles.quickActionButton, styles.quickActionButtonSecondary]} onPress={handleMessageClient}>
									<MessageSquare size={16} color={theme.foreground} />
									<Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>Message</Text>
								</TouchableOpacity>
								
								<TouchableOpacity style={[styles.quickActionButton, styles.quickActionButtonSecondary]} onPress={handleEmailClient}>
									<Mail size={16} color={theme.foreground} />
									<Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>Email</Text>
								</TouchableOpacity>
							</View>
						</View>

						{/* Key Metrics */}
						<View style={styles.metricsContainer}>
							<View style={styles.metricCard}>
								<Text style={styles.metricValue}>${metrics?.totalBilled.toLocaleString()}</Text>
								<Text style={styles.metricLabel}>Total Billed</Text>
								<Text style={styles.metricSubtext}>{metrics?.totalInvoices} invoices</Text>
							</View>
							
							<View style={styles.metricCard}>
								<Text style={[styles.metricValue, { color: '#EF4444' }]}>
									${metrics?.totalOutstanding.toLocaleString()}
								</Text>
								<Text style={styles.metricLabel}>Outstanding</Text>
								<Text style={styles.metricSubtext}>{metrics?.overdueInvoices} overdue</Text>
							</View>
						</View>

						{/* Invoice Stats */}
						<View style={styles.statsContainer}>
							<Text style={styles.sectionTitle}>Invoice Statistics</Text>
							
							<View style={styles.statsRow}>
								<Text style={styles.statsLabel}>Total Invoices</Text>
								<Text style={styles.statsValue}>{metrics?.totalInvoices}</Text>
							</View>
							<View style={styles.statsDivider} />
							
							<View style={styles.statsRow}>
								<Text style={styles.statsLabel}>Paid Invoices</Text>
								<Text style={[styles.statsValue, { color: '#10B981' }]}>{metrics?.paidInvoices}</Text>
							</View>
							<View style={styles.statsDivider} />
							
							<View style={styles.statsRow}>
								<Text style={styles.statsLabel}>Overdue Invoices</Text>
								<Text style={[styles.statsValue, { color: '#EF4444' }]}>{metrics?.overdueInvoices}</Text>
							</View>
							<View style={styles.statsDivider} />
							
							<View style={styles.statsRow}>
								<Text style={styles.statsLabel}>Avg. Payment Time</Text>
								<Text style={styles.statsValue}>{metrics?.averagePaymentDays ? `${metrics.averagePaymentDays} days` : 'No data'}</Text>
							</View>
						</View>

						{/* Recent Activity */}
						<View style={styles.activityContainer}>
							<Text style={styles.sectionTitle}>Recent Activity</Text>
							
							{recentActivity.map((activity, index) => {
								const IconComponent = getActivityIcon(activity.type);
								const iconColor = getActivityColor(activity.status);
								const isLast = index === recentActivity.length - 1;
								
								return (
									<View key={activity.id} style={[styles.activityItem, isLast && styles.activityItemLast]}>
										<View style={[styles.activityIconContainer, { backgroundColor: iconColor + '20' }]}>
											<IconComponent size={16} color={iconColor} />
										</View>
										
										<View style={styles.activityContent}>
											<Text style={styles.activityDescription}>{activity.description}</Text>
											<View style={styles.activityMeta}>
												<Text style={styles.activityDate}>{formatTimestamp(activity.date)}</Text>
												{activity.amount && (
													<Text style={styles.activityAmount}>
														${activity.amount.toLocaleString()}
													</Text>
												)}
											</View>
										</View>
									</View>
								);
							})}
						</View>
					</ScrollView>

					{/* Sticky Bottom Button */}
					<View style={styles.stickyButtonContainer}>
						<TouchableOpacity style={styles.primaryButton} onPress={handleNewInvoice}>
							<Plus size={20} color={theme.primaryForeground} />
							<Text style={styles.primaryButtonText}>New Invoice</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			{/* Edit Client Sheet */}
			<CreateNewClientSheet
				ref={editClientSheetRef}
				onClientAdded={handleClientUpdated}
				onClose={handleEditSheetClose}
				editMode={true}
				initialData={client}
			/>
		</SafeAreaView>
	);
}

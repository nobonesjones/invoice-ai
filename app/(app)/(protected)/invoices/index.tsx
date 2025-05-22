import { Stack, useRouter } from "expo-router";
import {
	PlusCircle,
	Search as SearchIcon,
	FileText,
} from "lucide-react-native";
import React, { useState, useCallback, useEffect } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	SafeAreaView,
	SectionList,
	TextInput,
	RefreshControl,
	Animated,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";
import { useShineAnimation } from '@/lib/hooks/useShineAnimation';
import { useSupabase } from "@/context/supabase-provider";
import type { Database } from "../../../../supabase/types/database.types";

// Define real Invoice data structure
interface ClientData {
  id: string;
  name: string | null;
}

interface InvoiceData {
	id: string;
  invoice_number: string | null;
	total_amount: number | null;
	status: string | null;
	invoice_date: string | null;
  client: ClientData | null;
}

// Interface for sectioned data
interface SectionedInvoiceData {
  title: string;
  data: InvoiceData[];
}

// Helper to get status color
const getStatusColor = (
	status: string | null,
	themeColors: typeof colors.light,
) => {
	switch (status?.toLowerCase()) {
		case "paid":
			return themeColors.statusPaid;
		case "due":
    case "overdue":
			return themeColors.statusDue;
		case "draft":
			return themeColors.statusDraft;
    case "sent":
      return themeColors.primary; // Placeholder: Use primary color for 'sent'
		default:
			return themeColors.mutedForeground;
	}
};

// Helper to format date
const formatDisplayDate = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  } catch (e) {
    return '';
  }
};

// Helper to get month section title
const getMonthSectionTitle = (date: Date): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const invoiceYear = date.getFullYear();
  const invoiceMonth = date.getMonth();

  if (invoiceYear === currentYear && invoiceMonth === currentMonth) {
    return "This Month";
  }
  if (
    invoiceYear === currentYear &&
    invoiceMonth === currentMonth - 1
  ) {
    return "Last Month";
  }
  // For previous month in a new year scenario (e.g. Jan looking at Dec)
  if (
    invoiceYear === currentYear - 1 &&
    currentMonth === 0 && invoiceMonth === 11
  ) {
    return "Last Month";
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export default function InvoiceDashboardScreen() {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const router = useRouter();
  const { supabase, user } = useSupabase();

  const [sections, setSections] = useState<SectionedInvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const createButtonShineX = useShineAnimation({
		duration: 1000,
		delay: 4000,
		outputRange: [-150, 150]
	});

  const fetchInvoices = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      setIsRefreshing(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          status,
          invoice_date,
          client:clients!client_id (
            id,
            name
          )
        `)
        .eq('user_id', user.id)
        .order('invoice_date', { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      const rawInvoices = data
        ? data.map((invoice: any) => ({
            ...invoice,
            client: invoice.client && Array.isArray(invoice.client) && invoice.client.length > 0 
                    ? invoice.client[0] 
                    : (invoice.client && !Array.isArray(invoice.client) ? invoice.client : null),
          })) as InvoiceData[]
        : [];
      
      // Group invoices by month
      const groupedInvoices: { [key: string]: InvoiceData[] } = {};
      rawInvoices.forEach(invoice => {
        if (invoice.invoice_date) {
          const invoiceDate = new Date(invoice.invoice_date);
          const sectionTitle = getMonthSectionTitle(invoiceDate);
          if (!groupedInvoices[sectionTitle]) {
            groupedInvoices[sectionTitle] = [];
          }
          groupedInvoices[sectionTitle].push(invoice);
        }
      });

      const monthOrder = [
        "This Month", 
        "Last Month", 
        ...Object.keys(groupedInvoices)
          .filter(title => title !== "This Month" && title !== "Last Month")
          .sort((a, b) => new Date(b.split(' ')[1] + '-' + b.split(' ')[0] + '-01').getTime() - new Date(a.split(' ')[1] + '-' + a.split(' ')[0] + '-01').getTime())
      ];
      
      const newSections = monthOrder
        .filter(title => groupedInvoices[title] && groupedInvoices[title].length > 0)
        .map(title => ({
          title,
          data: groupedInvoices[title],
        }));

      setSections(newSections);

    } catch (e: any) {
      console.error('Error fetching invoices:', e);
      setError(e.message || 'Failed to fetch invoices.');
      setSections([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

	const onRefresh = useCallback(() => {
		setIsRefreshing(true);
		fetchInvoices();
	}, [fetchInvoices]);

	const renderInvoiceItem = ({ item }: { item: InvoiceData }) => (
		<TouchableOpacity
			style={[
				styles.invoiceItemContainer,
				{
					backgroundColor: themeColors.card,
					borderBottomColor: themeColors.border,
				},
			]}
			onPress={() => router.push(`/invoices/${item.id}` as any)}
		>
			<View
				style={[
					styles.iconContainer,
					{ backgroundColor: getStatusColor(item.status, themeColors) },
				]}
			>
				<FileText size={20} color={themeColors.primaryForeground} />
			</View>
			<View style={styles.invoiceDetails}>
				<Text style={[styles.clientName, { color: themeColors.foreground }]}>
					{item.client?.name || 'N/A Client'}
				</Text>
				<Text
					style={[styles.summaryLine, { color: themeColors.mutedForeground }]}
				>
          <Text style={{ color: getStatusColor(item.status, themeColors), textTransform: 'capitalize' }}>
						{item.status || 'Unknown'}
					</Text>
					{` · ${formatDisplayDate(item.invoice_date)}`}
				</Text>
			</View>
      <View style={styles.amountContainer}>
        <Text style={[styles.invoiceAmount, { color: themeColors.foreground }]}>
          {item.total_amount !== null ? `$${item.total_amount.toFixed(2)}` : '$0.00'}
        </Text>
      </View>
		</TouchableOpacity>
	);

  const renderSectionHeader = ({ section: { title } }: { section: SectionedInvoiceData }) => (
    <Text style={[styles.sectionHeader, { color: themeColors.mutedForeground, backgroundColor: themeColors.background }]}>
      {title}
    </Text>
  );

  if (loading && !isRefreshing && sections.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && sections.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: themeColors.destructive, marginBottom: 10 }}>Error: {error}</Text>
          <TouchableOpacity onPress={fetchInvoices} style={[styles.headerButton, { backgroundColor: themeColors.primary }]}>
            <Text style={[styles.headerButtonText, { color: themeColors.primaryForeground }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

	return (
		<SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
			<Stack.Screen
				options={{
					headerTransparent: true,
					headerTitle: "",
					headerLargeTitle: false,
					headerRight: () => null,
					headerLeft: () => null,
				}}
			/>
			<View style={[styles.container, { backgroundColor: themeColors.background }]}>
				<View style={styles.headerRow}>
					<Text style={[styles.title, { color: themeColors.foreground }]}>
						Invoices
					</Text>
					<TouchableOpacity
						style={[styles.headerButton, { backgroundColor: themeColors.primary }]}
						onPress={() => router.push("/invoices/create" as any)}
					>
            <Animated.View style={[styles.shineOverlay, { transform: [{ translateX: createButtonShineX }] }]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.shineGradient}
              />
            </Animated.View>
						<PlusCircle
							size={18}
							color={themeColors.primaryForeground}
							style={{ marginRight: 6 }}
						/>
						<Text
							style={[
								styles.headerButtonText,
								{ color: themeColors.primaryForeground },
							]}
						>
							Create Invoice
						</Text>
					</TouchableOpacity>
				</View>

				<View
					style={[
						styles.searchBarContainer,
						{ backgroundColor: themeColors.card },
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

				<SectionList
          sections={sections}
					renderItem={renderInvoiceItem}
          renderSectionHeader={renderSectionHeader}
					keyExtractor={(item, index) => item.id + index}
					contentContainerStyle={styles.listContainer}
          stickySectionHeadersEnabled={true}
          ListEmptyComponent={() => (
            !loading && !error && (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
                <Text style={[styles.placeholderText, { color: themeColors.mutedForeground }]}>
                  No invoices found.
                </Text>
              </View>
            )
          )}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={onRefresh}
							tintColor={themeColors.primary}
							colors={[themeColors.primary]}
						/>
					}
				/>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
	},
	container: {
		flex: 1,
		paddingHorizontal: 0,
		paddingTop: 16,
	},
	headerRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingHorizontal: 16,
		marginBottom: 16,
	},
	title: {
		fontSize: 30,
		fontWeight: "bold",
	},
	headerButton: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		paddingHorizontal: 14,
		borderRadius: 20,
		overflow: 'hidden', 
    position: 'relative', 
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
		paddingHorizontal: 16,
    paddingBottom: 20,
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
  amountContainer: {
    marginLeft: 'auto',
    paddingLeft: 10,
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
	placeholderText: {
		fontSize: 16,
		textAlign: "center",
	},
  shineOverlay: { 
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, 
  },
  shineGradient: { 
    width: '100%',
    height: '100%',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    paddingVertical: 8,
    paddingHorizontal: 16, 
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

import { Stack, useRouter, useFocusEffect } from "expo-router";
import {
	PlusCircle,
	Search as SearchIcon,
	FileText,
	ListFilter,
} from "lucide-react-native"; 
import React, { useState, useCallback, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	SafeAreaView,
	FlatList,
	TextInput,
	RefreshControl,
	Animated,
  ActivityIndicator, 
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import InvoiceOverviewDatesSheet from './InvoiceOverviewDatesSheet';

import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";
import { useShineAnimation } from '@/lib/hooks/useShineAnimation';
import { useSupabase } from "@/context/supabase-provider"; 
import type { Database } from "../../../../supabase/types/database.types"; 

// Define filter options here to map type to label for initialization and sync
const filterOptions = [
  { label: "Today", type: "today" },
  { label: "This Week", type: "this_week" },
  { label: "This Month", type: "this_month" },
  { label: "Last Month", type: "last_month" },
  { label: "Last 3 Months", type: "last_3_months" },
  { label: "Last 6 Months", type: "last_6_months" },
  { label: "This Year", type: "this_year" },
  { label: "Last Year", type: "last_year" },
  { label: "All Time", type: "all_time" },
];

// --- Date Utility Functions for Filtering ---
const getStartOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
};

const getEndOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

const getStartOfWeek = (date: Date): Date => { // Monday
  const d = new Date(date);
  const day = d.getDay(); // Sunday - Saturday : 0 - 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return getStartOfDay(new Date(d.setDate(diff)));
};

const getEndOfWeek = (date: Date): Date => { // Sunday
  const startOfWeek = getStartOfWeek(date);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return getEndOfDay(endOfWeek);
};

const getStartOfMonth = (date: Date): Date => {
  return getStartOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
};

const getEndOfMonth = (date: Date): Date => {
  return getEndOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
};

const getStartOfYear = (date: Date): Date => {
  return getStartOfDay(new Date(date.getFullYear(), 0, 1));
};

const getEndOfYear = (date: Date): Date => {
  return getEndOfDay(new Date(date.getFullYear(), 11, 31));
};

// Helper to format date to YYYY-MM-DDTHH:MM:SSZ for Supabase
const toSupabaseISOString = (date: Date): string => {
  return date.toISOString();
};

export const getFilterDateRange = (filterType: string): { startDate: string, endDate: string } | null => {
  const now = new Date();
  let startDateObj: Date;
  let endDateObj: Date;

  switch (filterType) {
    case "this_week":
      startDateObj = getStartOfWeek(now);
      endDateObj = getEndOfWeek(now);
      break;
    case "this_month":
      startDateObj = getStartOfMonth(now);
      endDateObj = getEndOfMonth(now);
      break;
    case "last_month":
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDateObj = getStartOfMonth(lastMonthDate);
      endDateObj = getEndOfMonth(lastMonthDate);
      break;
    case "last_3_months":
      // From 3 months ago (start of that day) to today (end of day)
      startDateObj = getStartOfDay(new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()));
      endDateObj = getEndOfDay(now);
      break;
    case "last_12_months":
      // From 12 months ago (start of that day) to today (end of day)
      startDateObj = getStartOfDay(new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()));
      endDateObj = getEndOfDay(now);
      break;
    case "this_year":
      startDateObj = getStartOfYear(now);
      endDateObj = getEndOfYear(now);
      break;
    case "last_year":
      const lastYearDate = new Date(now.getFullYear() - 1, 0, 1); // Jan 1st of last year
      startDateObj = getStartOfYear(lastYearDate);
      endDateObj = getEndOfYear(lastYearDate);
      break;
    default:
      return null; // No filter or unknown filter type, or handle as 'all time'
  }
  return { startDate: toSupabaseISOString(startDateObj), endDate: toSupabaseISOString(endDateObj) };
};
// --- End Date Utility Functions ---

// Define real Invoice data structure
interface ClientData {
  id: string;
  name: string | null;
  // Add other client fields if needed for display, e.g., contact_person_name
}

interface InvoiceData {
	id: string;
  invoice_number: string | null;
	total_amount: number | null;
	status: string | null; // From DB: 'draft', 'sent', 'paid', 'overdue', 'cancelled'
	invoice_date: string | null;
  client_name: string | null;
  client_email?: string;
  client_avatar_url?: string;
  // We will format date and status for display
}

// Helper to get status color (can be adapted for new status values)
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

// Helper to format date (e.g., "5 May 2023")
const formatDisplayDate = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }); // e.g., 5 May
  } catch (e) {
    return '';
  }
};

// Currency symbol mapping function
const getCurrencySymbol = (code: string) => {
  const mapping: Record<string, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    AUD: 'A$',
    CAD: 'C$',
    JPY: '¥',
    INR: '₹',
    // Add more as needed
  };
  if (!code) return '$';
  const normalized = code.split(' ')[0];
  return mapping[normalized] || '$';
};

export default function InvoiceDashboardScreen() {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const router = useRouter();
  const { supabase, user } = useSupabase();

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDateFilterType, setCurrentDateFilterType] = useState<string>("this_month"); // Default filter type
  const [currentFilterLabel, setCurrentFilterLabel] = useState<string>(
    filterOptions.find(opt => opt.type === "this_month")?.label || "This Month" // Initialize label
  );
  const [totalInvoiced, setTotalInvoiced] = useState<number>(0); 
  const [totalPaid, setTotalPaid] = useState<number>(0); 
  const [totalOverdue, setTotalOverdue] = useState<number>(0); 
  const [currencyCode, setCurrencyCode] = useState<string>('USD'); // Default to USD

  // Ref for the new filter modal
  const filterModalRef = useRef<BottomSheetModal>(null);

	const createButtonShineX = useShineAnimation({
		duration: 1000,
		delay: 4000,
		outputRange: [-150, 150]
	});

  // Callback to open the filter modal
  const handleOpenFilterModal = useCallback(() => {
    filterModalRef.current?.present();
  }, []);

  // Updated handler to receive type and label, and set state
  const handleApplyInvoiceFilters = (filterType: string, displayLabel: string) => {
    console.log(`Selected Filter Type: ${filterType}, Label: ${displayLabel}`);
    setCurrentDateFilterType(filterType);
    setCurrentFilterLabel(displayLabel); // Update label from modal
    // fetchInvoices will be called by useEffect due to currentDateFilterType change
  };

  const fetchBusinessSettings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('currency_code')
        .eq('user_id', user.id)
        .single();
      if (!error && data && data.currency_code) {
        setCurrencyCode(data.currency_code);
      }
    } catch (e) {
      // fallback to USD
    }
  }, [user?.id, supabase]);

  const loadInvoicesAndSummary = useCallback(async (isPullToRefresh = false) => {
    if (!user?.id) {
      setError("User not authenticated.");
      setLoading(false);
      if (isPullToRefresh) setIsRefreshing(false);
      return;
    }

    if (!isPullToRefresh) {
      setLoading(true); // Show loader for initial load or filter/search change
    } else {
      setIsRefreshing(true); // Show pull-to-refresh indicator
    }

    try {
      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          due_date,
          status,
          created_at,
          client_id, 
          clients(*)
        `)
        .eq('user_id', user.id);

      const dateRange = getFilterDateRange(currentDateFilterType);
      if (dateRange) {
        query = query.gte('created_at', dateRange.startDate);
        query = query.lte('created_at', dateRange.endDate);
      }

      // Always apply ordering at the end
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      const formattedInvoices: InvoiceData[] = data.map((invoice: any) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.clients?.name || 'N/A',
        total_amount: invoice.total_amount,
        invoice_date: invoice.due_date,
        status: invoice.status,
        client_email: invoice.clients?.email,
        client_avatar_url: invoice.clients?.avatar_url,
        // created_at: invoice.created_at, // Optional: if you need to display it
      }));
      setInvoices(formattedInvoices);

      let invoiced = 0;
      let paid = 0;
      let overdue = 0;

      formattedInvoices.forEach(invoice => {
        const amount = invoice.total_amount || 0;
        invoiced += amount; 
        if (invoice.status === 'paid') {
          paid += amount;
        } else if (invoice.status === 'overdue') {
          overdue += amount;
        }
      });

      setTotalInvoiced(invoiced);
      setTotalPaid(paid);
      setTotalOverdue(overdue);
    } catch (e: any) {
      console.error("Error fetching invoices:", e);
      setError(e.message || "Failed to fetch invoices");
    } finally {
      setLoading(false);
      if (isPullToRefresh) setIsRefreshing(false);
    }
  }, [supabase, user?.id, currentDateFilterType]);

  useEffect(() => {
    fetchBusinessSettings();
    loadInvoicesAndSummary();
  }, [fetchBusinessSettings, loadInvoicesAndSummary]);

  useFocusEffect(
    useCallback(() => {
      console.log('[InvoiceDashboardScreen] Screen focused, reloading data.');
      fetchBusinessSettings();
      loadInvoicesAndSummary(); // Call the consolidated function
      return () => {
        console.log('[InvoiceDashboardScreen] Screen unfocused.');
      };
    }, [fetchBusinessSettings, loadInvoicesAndSummary])
  );

  const onRefresh = useCallback(() => {
    loadInvoicesAndSummary(true); // Pass true to indicate it's a pull-to-refresh
  }, [loadInvoicesAndSummary]);

	const renderInvoiceItem = ({ item }: { item: InvoiceData }) => (
		<TouchableOpacity
			style={[
				styles.invoiceItemContainer,
				{
					backgroundColor: themeColors.card,
					borderBottomColor: themeColors.border,
				},
			]}
			onPress={() => router.push(`/invoices/invoice-viewer?id=${item.id}` as any)} 
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
					{item.client_name || 'N/A Client'}
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
          {item.total_amount !== null ? `${getCurrencySymbol(currencyCode)}${item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `${getCurrencySymbol(currencyCode)}0`}
        </Text>
      </View>
		</TouchableOpacity>
	);

  // Summary Header Bar Component - Modified for single large box, full width, filter inside
  const SummaryHeaderBar = ({ invoicedAmount, paidAmount, overdueAmount }: { invoicedAmount: number, paidAmount: number, overdueAmount: number }) => { // MODIFIED to accept props
    // themeColors is available from the outer InvoiceDashboardScreen scope
    return (
      <View style={[styles.summaryBarContainer]}> 
        <View style={[styles.largeSummaryBox, { backgroundColor: themeColors.card }]}>
          <View style={styles.summaryDataItemsWrapper}>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Invoiced</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.foreground }]}>{`${getCurrencySymbol(currencyCode)}${invoicedAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
            </View>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Paid</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.statusPaid }]}>{`${getCurrencySymbol(currencyCode)}${paidAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
            </View>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Overdue</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.statusDue }]}>{`$${overdueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleOpenFilterModal} style={[styles.filterButtonContainerInBox]}> 
            <ListFilter size={22} color={themeColors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !isRefreshing && invoices.length === 0) { 
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && invoices.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: themeColors.destructive, marginBottom: 10 }}>Error: {error}</Text>
          <TouchableOpacity onPress={() => loadInvoicesAndSummary()} style={[styles.headerButton, { backgroundColor: themeColors.primary }]}>
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

          <SummaryHeaderBar invoicedAmount={totalInvoiced} paidAmount={totalPaid} overdueAmount={totalOverdue} /> 

          {/* Display Current Filter Label */} 
          {invoices.length > 0 && !loading && (
            <View style={styles.currentFilterDisplayContainer}>
              <Text style={[styles.currentFilterDisplayText, { color: themeColors.mutedForeground }]}>
                {currentFilterLabel}
              </Text>
            </View>
          )}

          <FlatList
            data={invoices}
            renderItem={renderInvoiceItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
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
        <InvoiceOverviewDatesSheet
          ref={filterModalRef}
          currentFilterType={currentDateFilterType} // Pass current filter type
          onApplyFilter={handleApplyInvoiceFilters} // Pass updated handler
          onClose={() => console.log('Filter modal closed')}
        />
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
		marginBottom: 6, 
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
	// Styles for Summary Bar
  summaryBarContainer: {
    flexDirection: 'row',
    // justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 16, 
    paddingVertical: 10,
    // backgroundColor: themeColors.card, 
  },
  largeSummaryBox: {
    flex: 1, 
    flexDirection: 'row',
    justifyContent: 'space-between', 
    alignItems: 'center',
    // backgroundColor: themeColors.card, 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    borderRadius: 8,
    // marginRight: 10, 
    // Shadow properties - consistent with other UI elements
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, 
    shadowRadius: 2,    
    elevation: 3,       
  },
  summaryDataItemsWrapper: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around', 
    flex: 1, 
    marginRight: 8, 
  },
  summaryDataItem: {
    alignItems: 'center', 
    paddingHorizontal: 8, 
  },
  summaryDataLabel: {
    fontSize: 13, 
    marginBottom: 5, 
  },
  summaryDataValue: {
    fontSize: 18, 
    fontWeight: '600', 
  },
  verticalSeparator: {
    width: StyleSheet.hairlineWidth,
    height: '70%', 
    marginHorizontal: 5, 
  },
  // Renamed and adjusted for placement inside the box
  filterButtonContainerInBox: { 
    padding: 6, 
    borderRadius: 6,
  },
  filterButtonContainer: { 
    padding: 8,
    // backgroundColor: themeColors.muted, 
    borderRadius: 6,
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
  currentFilterDisplayContainer: { 
    paddingHorizontal: 20, 
    paddingBottom: 10,
    paddingTop: 5, // Add some space above if needed
  },
  currentFilterDisplayText: { 
    fontSize: 14,
    fontWeight: '500',
    // color is set dynamically
  },
});

import { Stack, useRouter } from "expo-router";
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
  client: ClientData | null; // For joined client data
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

export default function InvoiceDashboardScreen() {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const router = useRouter();
  const { supabase, user } = useSupabase();

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDateFilterType, setCurrentDateFilterType] = useState<string | undefined>("this_month"); // Default filter

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
    // Here you would typically re-fetch or filter your invoices based on filterType
    // For now, we just update the state and log it.
  };

  const fetchInvoices = useCallback(async () => {
    if (!supabase || !user) return;
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
      // Re-add explicit mapping for client to satisfy TypeScript, even with !client_id hint
      const mappedData = data
        ? data.map((invoice: any) => ({
            ...invoice,
            client: invoice.client && Array.isArray(invoice.client) && invoice.client.length > 0 
                    ? invoice.client[0] 
                    : (invoice.client && !Array.isArray(invoice.client) ? invoice.client : null),
          }))
        : [];
      setInvoices(mappedData as InvoiceData[] || []);
    } catch (e: any) {
      console.error('Error fetching invoices:', e);
      setError(e.message || 'Failed to fetch invoices.');
      setInvoices([]); // Clear invoices on error
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

  // Summary Header Bar Component - Modified for single large box, full width, filter inside
  const SummaryHeaderBar = () => {
    // Dummy data for summary, updated to integers
    const summaryData = {
      invoiced: "$1,235",
      paid: "$800",
      overdue: "$150",
    };

    // themeColors is available from the outer InvoiceDashboardScreen scope
    return (
      <View style={[styles.summaryBarContainer]}> 
        <View style={[styles.largeSummaryBox, { backgroundColor: themeColors.card }]}>
          <View style={styles.summaryDataItemsWrapper}>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Invoiced</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.foreground }]}>{summaryData.invoiced}</Text>
            </View>
            <View style={[styles.verticalSeparator, { backgroundColor: themeColors.border }]} />
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Paid</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.foreground }]}>{summaryData.paid}</Text>
            </View>
            <View style={[styles.verticalSeparator, { backgroundColor: themeColors.border }]} />
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Overdue</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.foreground }]}>{summaryData.overdue}</Text>
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

          <SummaryHeaderBar />

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
});

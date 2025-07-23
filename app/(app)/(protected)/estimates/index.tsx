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
  Alert,
  Image,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import EstimateOverviewDatesSheet from './EstimateOverviewDatesSheet';
import { StatusBadge } from '@/components/StatusBadge';
import { EstimateStatus } from '@/constants/estimate-status';


import { colors } from "@/constants/colors";
import { useTheme } from "@/context/theme-provider";
import { useShineAnimation } from '@/lib/hooks/useShineAnimation';
import { useSupabase } from "@/context/supabase-provider"; 
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useEstimateStatusUpdater } from '@/hooks/useEstimateStatusUpdater';
import { useItemCreationLimit } from '@/hooks/useItemCreationLimit';
import type { Database } from "../../../../types/database.types"; 

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

// Define real Estimate data structure
interface ClientData {
  id: string;
  name: string | null;
  // Add other client fields if needed for display, e.g., contact_person_name
}

interface EstimateData {
	id: string;
  estimate_number: string | null;
	total_amount: number | null;
	status: string | null; // From DB: 'draft', 'sent', 'accepted', 'declined', 'expired', 'converted', 'cancelled'
	estimate_date: string | null;
  client_name: string | null;
  client_email?: string;
  client_avatar_url?: string;
  // We will format date and status for display
}

// Helper to get status color for estimate statuses
const getStatusColor = (
	status: string | null,
	themeColors: typeof colors.light,
) => {
	switch (status?.toLowerCase()) {
		case "draft":
			return themeColors.statusDraft; // Gray for draft
		case "sent":
		case "accepted":
		case "converted":
			return themeColors.statusPaid; // Green for sent, accepted, converted
		case "declined":
    case "expired":
			return themeColors.statusDue; // Red for declined/expired
    case "cancelled":
      return themeColors.mutedForeground; // Gray for cancelled
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

export default function EstimateDashboardScreen() {
	const { isLightMode } = useTheme();
	const themeColors = isLightMode ? colors.light : colors.dark;
	const router = useRouter();
  const { supabase, user } = useSupabase();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { checkAndShowPaywall } = useItemCreationLimit();
  
  // Auto-update expired estimate statuses
  useEstimateStatusUpdater();

  const [estimates, setEstimates] = useState<EstimateData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentDateFilterType, setCurrentDateFilterType] = useState<string>("this_month"); // Default filter type
  const [currentFilterLabel, setCurrentFilterLabel] = useState<string>(
    filterOptions.find(opt => opt.type === "this_month")?.label || "This Month" // Initialize label
  );
  const [totalEstimated, setTotalEstimated] = useState<number>(0); 
  const [totalAccepted, setTotalAccepted] = useState<number>(0); 
  const [totalExpired, setTotalExpired] = useState<number>(0); 
  const [currencyCode, setCurrencyCode] = useState<string>('USD'); // Default to USD
  const [estimateTerminology, setEstimateTerminology] = useState<'estimate' | 'quote'>('estimate'); // Default to estimate

  // Filter estimates based on search term
  const filteredEstimates = estimates.filter((estimate) => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase().trim();
    const clientNameMatch = estimate.client_name?.toLowerCase().includes(searchLower);
    const estimateNumberMatch = estimate.estimate_number?.toLowerCase().includes(searchLower);
    const statusMatch = estimate.status?.toLowerCase().includes(searchLower);
    
    return clientNameMatch || estimateNumberMatch || statusMatch;
  });

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
  const handleApplyEstimateFilters = (filterType: string, displayLabel: string) => {
    console.log(`Selected Filter Type: ${filterType}, Label: ${displayLabel}`);
    setCurrentDateFilterType(filterType);
    setCurrentFilterLabel(displayLabel); // Update label from modal
    // fetchEstimates will be called by useEffect due to currentDateFilterType change
  };

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
  };

  const fetchBusinessSettings = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('currency_code, estimate_terminology')
        .eq('user_id', user.id)
        .single();
      if (!error && data) {
        if (data.currency_code) {
          setCurrencyCode(data.currency_code);
        }
        if (data.estimate_terminology) {
          setEstimateTerminology(data.estimate_terminology);
        }
      }
    } catch (e) {
      // fallback to defaults
    }
  }, [user?.id, supabase]);

  const loadEstimatesAndSummary = useCallback(async (isPullToRefresh = false) => {
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
        .from('estimates')
        .select(`
          id,
          estimate_number,
          total_amount,
          valid_until_date,
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

      const formattedEstimates: EstimateData[] = data.map((estimate: any) => ({
        id: estimate.id,
        estimate_number: estimate.estimate_number,
        client_name: estimate.clients?.name || 'N/A',
        total_amount: estimate.total_amount,
        estimate_date: estimate.created_at,
        status: estimate.status,
        client_email: estimate.clients?.email,
        client_avatar_url: estimate.clients?.avatar_url,
        // created_at: estimate.created_at, // Optional: if you need to display it
      }));
      setEstimates(formattedEstimates);

      let estimated = 0;
      let accepted = 0;
      let expired = 0;

      formattedEstimates.forEach(estimate => {
        const amount = estimate.total_amount || 0;
        estimated += amount; 
        if (estimate.status === 'accepted') {
          accepted += amount;
        } else if (estimate.status === 'expired') {
          expired += amount;
        }
      });

      setTotalEstimated(estimated);
      setTotalAccepted(accepted);
      setTotalExpired(expired);
    } catch (e: any) {
      console.error("Error fetching estimates:", e);
      setError(e.message || "Failed to fetch estimates");
    } finally {
      setLoading(false);
      if (isPullToRefresh) setIsRefreshing(false);
    }
  }, [supabase, user?.id, currentDateFilterType]);

  useEffect(() => {
    fetchBusinessSettings();
    loadEstimatesAndSummary();
  }, [fetchBusinessSettings, loadEstimatesAndSummary]);

  useFocusEffect(
    useCallback(() => {
      console.log('[EstimateDashboardScreen] Screen focused, reloading data.');
      setIsTabBarVisible(true); // Show tab bar when returning to dashboard
      fetchBusinessSettings();
      loadEstimatesAndSummary(); // Call the consolidated function
      return () => {
        console.log('[EstimateDashboardScreen] Screen unfocused.');
        // Tab bar visibility will be managed by the destination screen
      };
    }, [fetchBusinessSettings, loadEstimatesAndSummary, setIsTabBarVisible])
  );

  const onRefresh = useCallback(() => {
    loadEstimatesAndSummary(true); // Pass true to indicate it's a pull-to-refresh
  }, [loadEstimatesAndSummary]);

	const renderEstimateItem = ({ item }: { item: EstimateData }) => (
		<TouchableOpacity
			style={[
				styles.invoiceItemContainer,
				{
					backgroundColor: themeColors.card,
					borderBottomColor: themeColors.border,
				},
			]}
			onPress={() => {
				setIsTabBarVisible(false);
				router.push(`/estimates/estimate-viewer?id=${item.id}` as any);
			}} 
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
				<View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
					<StatusBadge status={(item.status || 'draft') as EstimateStatus} size="small" />
					<Text style={[styles.summaryLine, { color: themeColors.mutedForeground, marginLeft: 8 }]}>
						{formatDisplayDate(item.estimate_date)}
					</Text>
				</View>
			</View>
      <View style={styles.amountContainer}> 
        <Text style={[styles.invoiceAmount, { color: themeColors.foreground }]}>
          {item.total_amount !== null ? `${getCurrencySymbol(currencyCode)}${item.total_amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : `${getCurrencySymbol(currencyCode)}0`}
        </Text>
      </View>
		</TouchableOpacity>
	);

  // Summary Header Bar Component - Modified for single large box, full width, filter inside
  const SummaryHeaderBar = ({ estimatedAmount, acceptedAmount, expiredAmount }: { estimatedAmount: number, acceptedAmount: number, expiredAmount: number }) => { // MODIFIED to accept props
    // themeColors is available from the outer EstimateDashboardScreen scope
    return (
      <View style={[styles.summaryBarContainer]}> 
        <View style={[styles.largeSummaryBox, { backgroundColor: themeColors.card }]}>
          <View style={styles.summaryDataItemsWrapper}>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Estimated</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.foreground }]}>{`${getCurrencySymbol(currencyCode)}${estimatedAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
            </View>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Accepted</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.statusPaid }]}>{`${getCurrencySymbol(currencyCode)}${acceptedAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
            </View>
            <View style={styles.summaryDataItem}>
              <Text style={[styles.summaryDataLabel, { color: themeColors.mutedForeground }]}>Expired</Text>
              <Text style={[styles.summaryDataValue, { color: themeColors.statusDue }]}>{`${getCurrencySymbol(currencyCode)}${expiredAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleOpenFilterModal} style={[styles.filterButtonContainerInBox]}> 
            <ListFilter size={22} color={themeColors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading && !isRefreshing && estimates.length === 0) { 
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && estimates.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: themeColors.destructive, marginBottom: 10 }}>Error: {error}</Text>
          <TouchableOpacity onPress={() => loadEstimatesAndSummary()} style={[styles.headerButton, { backgroundColor: themeColors.primary }]}>
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
              {estimateTerminology === 'quote' ? 'Quotes' : 'Estimates'}
            </Text>
            <TouchableOpacity
                style={[styles.headerButton, { backgroundColor: themeColors.primary }]}
                onPress={async () => {
                  const canProceed = await checkAndShowPaywall();
                  if (canProceed) {
                    router.push("/estimates/create" as any);
                  }
                }}
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
                  Create {estimateTerminology === 'quote' ? 'Quote' : 'Estimate'}
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
              placeholder={`Search by client, ${estimateTerminology === 'quote' ? 'quote' : 'estimate'} #, or status`}
              placeholderTextColor={themeColors.mutedForeground}
              style={[styles.searchInput, { color: themeColors.foreground }]}
              value={searchTerm}
              onChangeText={handleSearchChange}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          <SummaryHeaderBar estimatedAmount={totalEstimated} acceptedAmount={totalAccepted} expiredAmount={totalExpired} />

          {/* Display Current Filter Label */} 
          {filteredEstimates.length > 0 && !loading && (
            <View style={styles.currentFilterDisplayContainer}>
              <Text style={[styles.currentFilterDisplayText, { color: themeColors.mutedForeground }]}>
                {searchTerm.trim() ? `${filteredEstimates.length} of ${estimates.length} ${estimateTerminology === 'quote' ? 'quotes' : 'estimates'}` : currentFilterLabel}
              </Text>
            </View>
          )}

          <FlatList
            data={filteredEstimates}
            renderItem={renderEstimateItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => {
              if (loading) {
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                  </View>
                );
              }
              if (error) {
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
                    <Text style={[styles.placeholderText, { color: themeColors.destructive }]}>
                      {error}
                    </Text>
                  </View>
                );
              }
              if (searchTerm.trim() && !filteredEstimates.length) {
                return (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 }}>
                    <Text style={[styles.placeholderText, { color: themeColors.mutedForeground }]}>
                      No {estimateTerminology === 'quote' ? 'quotes' : 'estimates'} found matching "{searchTerm}". Try a different search term.
                    </Text>
                  </View>
                );
              }
              if (!estimates.length) {
                return (
                  <View style={styles.emptyStateContainer}>
                    <Image 
                      source={require('@/assets/estimates-empty.png')} 
                      style={[styles.emptyStateImage, { opacity: 0.6 }]}
                      resizeMode="contain"
                    />
                  </View>
                );
              }
              return null;
            }}
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
        <EstimateOverviewDatesSheet
          ref={filterModalRef}
          currentFilterType={currentDateFilterType} // Pass current filter type
          onApplyFilter={handleApplyEstimateFilters} // Pass updated handler
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
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 100,
  },
  emptyStateImage: {
    width: 150,
    height: 150,
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

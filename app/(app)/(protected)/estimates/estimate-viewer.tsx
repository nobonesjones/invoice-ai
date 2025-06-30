/**
 * EstimateViewerScreen - View Estimate Details
 * 
 * This screen displays estimate information including:
 * - Estimate details (number, dates, client)
 * - Line items with quantities and pricing
 * - Status and total amounts
 * - Action buttons for editing and sharing
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { ArrowLeft, Edit3, Share, Calendar, User, Hash, DollarSign } from 'lucide-react-native';
import { useSupabase } from '@/context/supabase-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { StatusBadge } from '@/components/StatusBadge';
import { ESTIMATE_STATUSES } from '@/constants/estimate-status';

// Define types
type ThemeColorPalette = typeof colors.light;

interface EstimateData {
  id: string;
  estimate_number: string;
  estimate_date: string;
  valid_until_date: string | null;
  status: string;
  subtotal_amount: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  notes: string | null;
  acceptance_terms: string | null;
  client: {
    id: string;
    name: string;
    email: string | null;
  };
  estimate_line_items: Array<{
    id: string;
    item_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export default function EstimateViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const router = useRouter();
  const navigation = useNavigation();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { supabase, user } = useSupabase();
  
  const params = useLocalSearchParams<{ id?: string }>();
  const estimateId = params?.id;
  
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const styles = getStyles(themeColors);

  // Custom header setup
  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: themeColors.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border}]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <ArrowLeft size={26} color={themeColors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: themeColors.foreground}]}>
            Estimate Details
          </Text>
        </View>
      ),
      headerShown: true, 
    });
  }, [navigation, router, themeColors, styles]);

  // Tab bar visibility management
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[EstimateViewerScreen] Focus event: Hiding tab bar');
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[EstimateViewerScreen] Blur event: Showing tab bar');
      setIsTabBarVisible(true);
    });

    // Initial hide if screen is focused on mount
    if (navigation.isFocused()) {
      console.log('[EstimateViewerScreen] Initial focus: Hiding tab bar');
      setIsTabBarVisible(false);
    }

    return () => {
      console.log('[EstimateViewerScreen] Unmounting: Ensuring tab bar is visible');
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);

  // Load estimate data
  useEffect(() => {
    if (estimateId) {
      loadEstimate(estimateId);
    } else {
      setError('No estimate ID provided');
      setIsLoading(false);
    }
  }, [estimateId]);

  const loadEstimate = async (id: string) => {
    if (!supabase || !user) {
      setError('Database connection not available');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('estimates')
        .select(`
          *,
          clients(*),
          estimate_line_items(*)
        `)
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        console.error('Error fetching estimate:', fetchError);
        setError('Failed to load estimate');
        return;
      }

      if (!data) {
        setError('Estimate not found');
        return;
      }

      setEstimate(data as EstimateData);
    } catch (err: any) {
      console.error('Unexpected error loading estimate:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditEstimate = () => {
    if (estimate) {
      router.push(`/estimates/create?id=${estimate.id}`);
    }
  };

  const handleShareEstimate = () => {
    // TODO: Implement share functionality
    Alert.alert('Share Estimate', 'Share functionality coming soon...');
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={[styles.loadingText, { color: themeColors.foreground }]}>
            Loading estimate...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !estimate) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: themeColors.destructive }]}>
            {error || 'Estimate not found'}
          </Text>
          <TouchableOpacity
            style={[styles.button, { backgroundColor: themeColors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        
        {/* Estimate Header */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <View style={styles.estimateHeader}>
            <View style={styles.estimateHeaderLeft}>
              <Text style={[styles.estimateNumber, { color: themeColors.foreground }]}>
                {estimate.estimate_number}
              </Text>
              <StatusBadge 
                status={estimate.status} 
                statusConfig={ESTIMATE_STATUSES} 
              />
            </View>
            <Text style={[styles.totalAmount, { color: themeColors.foreground }]}>
              {formatCurrency(estimate.total_amount)}
            </Text>
          </View>
        </View>

        {/* Client Information */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <View style={styles.sectionHeader}>
            <User size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.foreground }]}>
              Client
            </Text>
          </View>
          <Text style={[styles.clientName, { color: themeColors.foreground }]}>
            {estimate.client.name}
          </Text>
          {estimate.client.email && (
            <Text style={[styles.clientEmail, { color: themeColors.mutedForeground }]}>
              {estimate.client.email}
            </Text>
          )}
        </View>

        {/* Estimate Details */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <View style={styles.sectionHeader}>
            <Calendar size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.foreground }]}>
              Details
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: themeColors.mutedForeground }]}>
              Estimate Date:
            </Text>
            <Text style={[styles.detailValue, { color: themeColors.foreground }]}>
              {formatDate(estimate.estimate_date)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: themeColors.mutedForeground }]}>
              Valid Until:
            </Text>
            <Text style={[styles.detailValue, { color: themeColors.foreground }]}>
              {formatDate(estimate.valid_until_date)}
            </Text>
          </View>
        </View>

        {/* Line Items */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <View style={styles.sectionHeader}>
            <Hash size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.foreground }]}>
              Items
            </Text>
          </View>
          
          {estimate.estimate_line_items.map((item, index) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={styles.lineItemMain}>
                <Text style={[styles.lineItemName, { color: themeColors.foreground }]}>
                  {item.item_name}
                </Text>
                <Text style={[styles.lineItemTotal, { color: themeColors.foreground }]}>
                  {formatCurrency(item.total_price)}
                </Text>
              </View>
              
              {item.description && (
                <Text style={[styles.lineItemDescription, { color: themeColors.mutedForeground }]}>
                  {item.description}
                </Text>
              )}
              
              <Text style={[styles.lineItemDetails, { color: themeColors.mutedForeground }]}>
                {item.quantity} × {formatCurrency(item.unit_price)}
              </Text>
            </View>
          ))}
        </View>

        {/* Total Summary */}
        <View style={[styles.section, { backgroundColor: themeColors.card }]}>
          <View style={styles.sectionHeader}>
            <DollarSign size={20} color={themeColors.primary} />
            <Text style={[styles.sectionTitle, { color: themeColors.foreground }]}>
              Summary
            </Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: themeColors.mutedForeground }]}>
              Subtotal:
            </Text>
            <Text style={[styles.summaryValue, { color: themeColors.foreground }]}>
              {formatCurrency(estimate.subtotal_amount)}
            </Text>
          </View>
          
          {estimate.discount_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: themeColors.mutedForeground }]}>
                Discount:
              </Text>
              <Text style={[styles.summaryValue, { color: themeColors.destructive }]}>
                -{formatCurrency(estimate.discount_amount)}
              </Text>
            </View>
          )}
          
          {estimate.tax_amount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: themeColors.mutedForeground }]}>
                Tax:
              </Text>
              <Text style={[styles.summaryValue, { color: themeColors.foreground }]}>
                {formatCurrency(estimate.tax_amount)}
              </Text>
            </View>
          )}
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={[styles.totalLabel, { color: themeColors.foreground }]}>
              Total:
            </Text>
            <Text style={[styles.totalValue, { color: themeColors.foreground }]}>
              {formatCurrency(estimate.total_amount)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {estimate.notes && (
          <View style={[styles.section, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.foreground }]}>
              Notes
            </Text>
            <Text style={[styles.notesText, { color: themeColors.foreground }]}>
              {estimate.notes}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton, { backgroundColor: themeColors.primary }]}
            onPress={handleEditEstimate}
          >
            <Edit3 size={20} color="white" />
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton, { borderColor: themeColors.border }]}
            onPress={handleShareEstimate}
          >
            <Share size={20} color={themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: themeColors.primary }]}>Share</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (themeColors: ThemeColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 10, 
  },
  headerTitle: {
    fontSize: 20, 
    fontWeight: 'bold', 
    marginLeft: 10,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  estimateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  estimateHeaderLeft: {
    flex: 1,
  },
  estimateNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  clientName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  clientEmail: {
    fontSize: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  lineItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  lineItemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  lineItemName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  lineItemTotal: {
    fontSize: 16,
    fontWeight: '600',
  },
  lineItemDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  lineItemDetails: {
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: themeColors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  editButton: {
    // backgroundColor set via style prop
  },
  shareButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

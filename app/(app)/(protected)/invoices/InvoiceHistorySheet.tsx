import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, Clock, CreditCard, Edit, Send, Eye, FileText, Printer, Link, Globe, Download } from 'lucide-react-native'; 
import { useInvoiceActivityLogger, InvoiceActivityType } from '@/hooks/invoices/useInvoiceActivityLogger';

export interface InvoiceHistorySheetProps {
  invoiceId?: string;
  invoiceNumber?: string;
  onClose: () => void;
}

export interface InvoiceHistorySheetRef {
  present: (invoiceId: string, invoiceNumber?: string) => void;
  dismiss: () => void;
}

interface ActivityItem {
  id: string;
  activity_type: InvoiceActivityType;
  activity_description: string;
  activity_data: Record<string, any>;
  created_at: string;
}

const InvoiceHistorySheet = forwardRef<InvoiceHistorySheetRef, InvoiceHistorySheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const { getInvoiceHistory } = useInvoiceActivityLogger();

  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [currentInvoiceNumber, setCurrentInvoiceNumber] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  React.useImperativeHandle(ref, () => ({
    present: (invoiceId: string, invoiceNumber?: string) => {
      console.log('[InvoiceHistorySheet] Presenting history for invoice:', invoiceId);
      setCurrentInvoiceId(invoiceId);
      setCurrentInvoiceNumber(invoiceNumber || null);
      bottomSheetModalRef.current?.present();
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  const loadHistory = useCallback(async () => {
    if (!currentInvoiceId) return;
    
    setIsLoading(true);
    try {
      console.log('[InvoiceHistorySheet] Loading history for:', currentInvoiceId);
      const history = await getInvoiceHistory(currentInvoiceId);
      setActivities(history);
      console.log('[InvoiceHistorySheet] Loaded', history.length, 'activities');
    } catch (error) {
      console.error('[InvoiceHistorySheet] Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentInvoiceId]);

  useEffect(() => {
    if (currentInvoiceId) {
      loadHistory();
    }
  }, [currentInvoiceId, loadHistory]);

  const renderBackdrop = useCallback(
    (backdropProps: any) => (
      <BottomSheetBackdrop
        {...backdropProps}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.7}
      />
    ),
    []
  );

  const getActivityIcon = (activityType: InvoiceActivityType) => {
    const iconProps = { size: 18, color: themeColors.mutedForeground };
    
    switch (activityType) {
      case 'created':
        return <FileText {...iconProps} />;
      case 'edited':
        return <Edit {...iconProps} />;
      case 'sent':
      case 'email_sent':
        return <Send {...iconProps} />;
      case 'viewed':
        return <Eye {...iconProps} />;
      case 'opened':
        return <Globe {...iconProps} />;
      case 'downloaded':
        return <Download {...iconProps} />;
      case 'printed':
        return <Printer {...iconProps} />;
      case 'link_generated':
      case 'link_shared':
        return <Link {...iconProps} />;
      case 'payment_added':
        return <CreditCard {...iconProps} />;
      default:
        return <Clock {...iconProps} />;
    }
  };

  const getActivityColor = (activityType: InvoiceActivityType): string => {
    switch (activityType) {
      case 'created':
        return themeColors.primary;
      case 'payment_added':
        return '#10B981'; // Green
      case 'sent':
      case 'email_sent':
        return '#3B82F6'; // Blue
      case 'edited':
        return '#F59E0B'; // Amber
      case 'viewed':
        return '#8B5CF6'; // Purple
      case 'opened':
        return '#06B6D4'; // Cyan - for shared link opens
      case 'downloaded':
        return '#059669'; // Emerald - for downloads
      case 'printed':
        return '#7C3AED'; // Violet - for prints
      case 'link_generated':
      case 'link_shared':
        return '#EC4899'; // Pink - for link sharing
      default:
        return themeColors.mutedForeground;
    }
  };

  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
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
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const handleSheetDismissed = () => {
    if (props.onClose) {
      props.onClose();
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 20 : 15,
      paddingBottom: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    title: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.foreground,
    },
    subtitle: {
      fontSize: 14,
      color: themeColors.mutedForeground,
      marginTop: 2,
    },
    closeButton: {
      padding: 5,
    },
    contentContainer: {
      flex: 1,
      paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    activityItem: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    },
    activityIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: themeColors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    activityContent: {
      flex: 1,
    },
    activityDescription: {
      fontSize: 15,
      color: themeColors.foreground,
      marginBottom: 2,
    },
    activityTime: {
      fontSize: 13,
      color: themeColors.mutedForeground,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    loadingText: {
      fontSize: 16,
      color: themeColors.mutedForeground,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyText: {
      fontSize: 16,
      color: themeColors.mutedForeground,
      textAlign: 'center',
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      index={0}
      snapPoints={['50%', '85%']}
      backdropComponent={renderBackdrop}
      onDismiss={handleSheetDismissed}
      handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
      backgroundStyle={{ backgroundColor: themeColors.background }}
      enablePanDownToClose={true}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Invoice History</Text>
            {currentInvoiceNumber && (
              <Text style={styles.subtitle}>{currentInvoiceNumber}</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={styles.closeButton}>
            <XIcon size={24} color={themeColors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading history...</Text>
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No activity recorded yet.{'\n'}Actions will appear here as they happen.
              </Text>
            </View>
          ) : (
            activities.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={[styles.activityIconContainer, { backgroundColor: getActivityColor(activity.activity_type) + '20' }]}>
                  {getActivityIcon(activity.activity_type)}
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityDescription}>
                    {activity.activity_description}
                  </Text>
                  <Text style={styles.activityTime}>
                    {formatDateTime(activity.created_at)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

export default InvoiceHistorySheet; 
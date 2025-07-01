import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native'; 
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { X as XIcon, Clock, CheckCircle, XCircle, Edit, Send, Eye, FileText, RotateCcw, TrendingUp } from 'lucide-react-native'; 
import { useEstimateActivityLogger, EstimateActivityType } from './useEstimateActivityLogger';

export interface EstimateHistorySheetProps {
  estimateId?: string;
  estimateNumber?: string;
  onClose: () => void;
}

export interface EstimateHistorySheetRef {
  present: (estimateId: string, estimateNumber?: string) => void;
  dismiss: () => void;
}

interface ActivityItem {
  id: string;
  activity_type: EstimateActivityType;
  activity_description: string;
  activity_data: Record<string, any>;
  created_at: string;
}

const EstimateHistorySheet = forwardRef<EstimateHistorySheetRef, EstimateHistorySheetProps>((props, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const bottomSheetModalRef = React.useRef<BottomSheetModal>(null);
  const { getEstimateHistory } = useEstimateActivityLogger();

  const [currentEstimateId, setCurrentEstimateId] = useState<string | null>(null);
  const [currentEstimateNumber, setCurrentEstimateNumber] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  React.useImperativeHandle(ref, () => ({
    present: (estimateId: string, estimateNumber?: string) => {
      console.log('[EstimateHistorySheet] Presenting history for estimate:', estimateId);
      setCurrentEstimateId(estimateId);
      setCurrentEstimateNumber(estimateNumber || null);
      bottomSheetModalRef.current?.present();
    },
    dismiss: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  const loadHistory = useCallback(async () => {
    if (!currentEstimateId) return;
    
    setIsLoading(true);
    try {
      console.log('[EstimateHistorySheet] Loading history for:', currentEstimateId);
      const history = await getEstimateHistory(currentEstimateId);
      setActivities(history);
      console.log('[EstimateHistorySheet] Loaded', history.length, 'activities');
    } catch (error) {
      console.error('[EstimateHistorySheet] Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentEstimateId]);

  useEffect(() => {
    if (currentEstimateId) {
      loadHistory();
    }
  }, [currentEstimateId, loadHistory]);

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

  const getActivityIcon = (activityType: EstimateActivityType) => {
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
      case 'accepted':
        return <CheckCircle {...iconProps} color="#10B981" />;
      case 'rejected':
        return <XCircle {...iconProps} color="#EF4444" />;
      case 'expired':
        return <Clock {...iconProps} color="#F59E0B" />;
      case 'converted_to_invoice':
        return <TrendingUp {...iconProps} color="#3B82F6" />;
      default:
        return <Clock {...iconProps} />;
    }
  };

  const getActivityColor = (activityType: EstimateActivityType): string => {
    switch (activityType) {
      case 'created':
        return themeColors.primary;
      case 'accepted':
        return '#10B981'; // Green
      case 'sent':
      case 'email_sent':
        return '#3B82F6'; // Blue
      case 'edited':
        return '#F59E0B'; // Amber
      case 'viewed':
        return '#8B5CF6'; // Purple
      case 'rejected':
        return '#EF4444'; // Red
      case 'expired':
        return '#F59E0B'; // Amber
      case 'converted_to_invoice':
        return '#3B82F6'; // Blue
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
      justifyContent: 'center',
    },
    activityDescription: {
      fontSize: 15,
      color: themeColors.foreground,
      lineHeight: 20,
    },
    activityTime: {
      fontSize: 13,
      color: themeColors.mutedForeground,
      marginTop: 2,
    },
    timelineLine: {
      position: 'absolute',
      left: 34,
      top: 48,
      bottom: 0,
      width: 2,
      backgroundColor: themeColors.border,
    },
    lastTimelineLine: {
      display: 'none',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 16,
      color: themeColors.mutedForeground,
      textAlign: 'center',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 40,
    },
  });

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      snapPoints={['75%']}
      enablePanDownToClose={true}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: themeColors.background }}
      handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
      onDismiss={handleSheetDismissed}
    >
      <BottomSheetView style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Estimate History</Text>
            {currentEstimateNumber && (
              <Text style={styles.subtitle}>{currentEstimateNumber}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => bottomSheetModalRef.current?.dismiss()}
            style={styles.closeButton}
          >
            <XIcon size={24} color={themeColors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.emptyText}>Loading history...</Text>
            </View>
          ) : activities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No activity recorded yet</Text>
            </View>
          ) : (
            activities.map((activity, index) => (
              <View key={activity.id} style={styles.activityItem}>
                {/* Timeline line (except for last item) */}
                {index < activities.length - 1 && (
                  <View style={styles.timelineLine} />
                )}
                
                {/* Activity icon */}
                <View style={[
                  styles.activityIconContainer,
                  { backgroundColor: getActivityColor(activity.activity_type) + '15' }
                ]}>
                  {getActivityIcon(activity.activity_type)}
                </View>
                
                {/* Activity content */}
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

EstimateHistorySheet.displayName = 'EstimateHistorySheet';

export default EstimateHistorySheet; 
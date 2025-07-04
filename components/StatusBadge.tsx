import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { InvoiceStatus, getStatusConfig, INVOICE_STATUSES } from '@/constants/invoice-status';
import { EstimateStatus, getEstimateStatusConfig } from '@/constants/estimate-status';

interface StatusBadgeProps {
  status: InvoiceStatus | EstimateStatus;
  size?: 'small' | 'medium' | 'large';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'medium' }) => {
  // Check if it's a valid invoice status first, otherwise use estimate status
  let config;
  
  // Use the actual invoice status constants
  const validInvoiceStatuses = Object.values(INVOICE_STATUSES);
  
  if (validInvoiceStatuses.includes(status as InvoiceStatus)) {
    config = getStatusConfig(status as InvoiceStatus);
  } else {
    config = getEstimateStatusConfig(status as EstimateStatus);
  }
  
  const styles = StyleSheet.create({
    badge: {
      paddingHorizontal: size === 'small' ? 6 : size === 'large' ? 12 : 8,
      paddingVertical: size === 'small' ? 2 : size === 'large' ? 6 : 4,
      borderRadius: size === 'small' ? 4 : size === 'large' ? 8 : 6,
      backgroundColor: config.backgroundColor,
      alignSelf: 'flex-start',
    },
    text: {
      color: config.color,
      fontSize: size === 'small' ? 11 : size === 'large' ? 14 : 12,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{config.label}</Text>
    </View>
  );
};

export default StatusBadge; 
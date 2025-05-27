import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
import { useTheme } from '@react-navigation/native';

const InvoiceSkeletonLoader = () => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const SkeletonBlock = ({ height, width, style }: { height?: number | string, width?: number | string, style?: any }) => (
    <View style={[styles.skeletonBlock, { height: height || 16, width: width || '100%' }, style]} />
  );

  return (
    <View style={styles.container}>
      {/* Header Section Placeholder */}
      <View style={styles.headerSection}>
        <SkeletonBlock height={40} width={'40%'} style={{ marginBottom: 10 }} />
        <SkeletonBlock height={20} width={'60%'} />
      </View>

      {/* Client Info Placeholder */}
      <View style={styles.infoSection}>
        <SkeletonBlock height={20} width={'50%'} style={{ marginBottom: 5 }} />
        <SkeletonBlock height={15} width={'70%'} style={{ marginBottom: 5 }} />
        <SkeletonBlock height={15} width={'60%'} />
      </View>

      {/* Line Items Header Placeholder */}
      <View style={styles.lineItemsHeader}>
        <SkeletonBlock height={20} width={'40%'} />
        <SkeletonBlock height={20} width={'20%'} />
        <SkeletonBlock height={20} width={'20%'} />
      </View>

      {/* Line Items Placeholder (repeat for a few items) */}
      {[1, 2, 3].map((item) => (
        <View key={item} style={styles.lineItem}>
          <SkeletonBlock height={30} width={'40%'} />
          <SkeletonBlock height={30} width={'20%'} />
          <SkeletonBlock height={30} width={'20%'} />
        </View>
      ))}

      {/* Totals Placeholder */}
      <View style={styles.totalsSection}>
        <SkeletonBlock height={20} width={'30%'} style={{ alignSelf: 'flex-end', marginBottom: 5 }} />
        <SkeletonBlock height={20} width={'30%'} style={{ alignSelf: 'flex-end', marginBottom: 5 }} />
        <SkeletonBlock height={25} width={'40%'} style={{ alignSelf: 'flex-end' }} />
      </View>

      {/* Footer Placeholder */}
      <View style={styles.footerSection}>
        <SkeletonBlock height={60} width={'45%'} />
        <SkeletonBlock height={40} width={'45%'} />
      </View>
    </View>
  );
};

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card, // Or theme.background based on where it's used
    padding: 20,
    borderRadius: 8,
    opacity: 0.7, // Make it slightly transparent to indicate loading
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skeletonBlock: {
    backgroundColor: theme.colors.border, // A muted color for skeleton blocks
    borderRadius: 4,
    marginBottom: 8, // Default margin
  },
  headerSection: {
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  infoSection: {
    marginBottom: 20,
  },
  lineItemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 5, // Align with typical item padding
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  totalsSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 10,
  },
});

export default InvoiceSkeletonLoader;

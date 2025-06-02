import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { Crown, ArrowRight } from 'lucide-react-native';
import { useUsage } from '@/context/usage-provider';

interface TrialIndicatorProps {
  style?: object;
}

export function TrialIndicator({ style }: TrialIndicatorProps) {
  const router = useRouter();
  const { theme } = useTheme();
  const themeColors = colors[theme];
  const { usageStats, isLoading } = useUsage();

  // Only show for trial users
  if (isLoading || !usageStats?.isTrial) {
    return null;
  }

  const { remainingInvoices, invoiceCount, freeLimit } = usageStats;
  const isExpired = remainingInvoices <= 0;

  const handleUpgrade = () => {
    router.push('/(app)/(protected)/subscription/paywall');
  };

  const handleCreateAccount = () => {
    router.push('/(app)/welcome');
  };

  if (isExpired) {
    // Trial expired - encourage upgrade
    return (
      <View style={[styles.container, styles.expiredContainer, { borderColor: '#EF4444', backgroundColor: '#FEF2F2' }, style]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Crown size={20} color="#EF4444" />
            <Text style={[styles.title, { color: '#EF4444' }]}>
              Trial Expired
            </Text>
          </View>
          <Text style={[styles.subtitle, { color: '#7F1D1D' }]}>
            You've used all {freeLimit} free sends. Upgrade to continue!
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.upgradeButton, { backgroundColor: '#EF4444' }]}
          onPress={handleUpgrade}
        >
          <Text style={styles.upgradeButtonText}>Upgrade</Text>
          <ArrowRight size={16} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  // Trial active - show remaining count
  const warningLevel = remainingInvoices <= 1;
  const backgroundColor = warningLevel ? '#FEF3C7' : '#F0F9FF';
  const borderColor = warningLevel ? '#F59E0B' : '#3B82F6';
  const textColor = warningLevel ? '#92400E' : '#1E40AF';
  const iconColor = warningLevel ? '#F59E0B' : '#3B82F6';

  return (
    <View style={[styles.container, { borderColor, backgroundColor }, style]}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Crown size={20} color={iconColor} />
          <Text style={[styles.title, { color: textColor }]}>
            Free Trial
          </Text>
        </View>
        <Text style={[styles.subtitle, { color: textColor }]}>
          {remainingInvoices} of {freeLimit} sends remaining
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.actionButton, { borderColor: iconColor }]}
        onPress={handleCreateAccount}
      >
        <Text style={[styles.actionButtonText, { color: iconColor }]}>
          Create Account
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  expiredContainer: {
    // Additional styles for expired state if needed
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  subtitle: {
    fontSize: 12,
    marginLeft: 26, // Align with title (icon width + margin)
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
}); 
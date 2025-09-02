import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/context/theme-provider';

export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'com.superinvoice.premium.monthly',
    title: 'Monthly Plan',
    price: '$9.99',
    period: 'month',
    description: 'Billed monthly',
  },
  yearly: {
    id: 'com.superinvoice.premium.yearly', 
    title: 'Yearly Plan',
    price: '$99.99',
    period: 'year',
    description: 'Billed annually (Save 17%)',
    savings: 'Save $19.89',
  }
};

interface SubscriptionPricingProps {
  showTitle?: boolean;
  compact?: boolean;
}

export const SubscriptionPricing: React.FC<SubscriptionPricingProps> = ({ 
  showTitle = true, 
  compact = false 
}) => {
  const { theme } = useTheme();
  
  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={[styles.compactText, { color: theme.mutedForeground }]}>
          {SUBSCRIPTION_PLANS.monthly.price}/mo or {SUBSCRIPTION_PLANS.yearly.price}/yr
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showTitle && (
        <Text style={[styles.title, { color: theme.foreground }]}>
          Subscription Pricing
        </Text>
      )}
      
      <View style={[styles.planCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.planTitle, { color: theme.foreground }]}>
          {SUBSCRIPTION_PLANS.monthly.title}
        </Text>
        <Text style={[styles.planPrice, { color: theme.primary }]}>
          {SUBSCRIPTION_PLANS.monthly.price}
        </Text>
        <Text style={[styles.planPeriod, { color: theme.mutedForeground }]}>
          per {SUBSCRIPTION_PLANS.monthly.period}
        </Text>
      </View>

      <View style={[styles.planCard, styles.recommendedPlan, { backgroundColor: theme.card, borderColor: theme.primary }]}>
        <View style={[styles.recommendedBadge, { backgroundColor: theme.primary }]}>
          <Text style={[styles.recommendedText, { color: theme.primaryForeground }]}>
            BEST VALUE
          </Text>
        </View>
        <Text style={[styles.planTitle, { color: theme.foreground }]}>
          {SUBSCRIPTION_PLANS.yearly.title}
        </Text>
        <Text style={[styles.planPrice, { color: theme.primary }]}>
          {SUBSCRIPTION_PLANS.yearly.price}
        </Text>
        <Text style={[styles.planPeriod, { color: theme.mutedForeground }]}>
          per {SUBSCRIPTION_PLANS.yearly.period}
        </Text>
        {SUBSCRIPTION_PLANS.yearly.savings && (
          <Text style={[styles.savings, { color: theme.success }]}>
            {SUBSCRIPTION_PLANS.yearly.savings}
          </Text>
        )}
      </View>

      <View style={styles.features}>
        <Text style={[styles.featuresTitle, { color: theme.foreground }]}>
          All plans include:
        </Text>
        <Text style={[styles.featureItem, { color: theme.mutedForeground }]}>
          • Unlimited invoices & estimates
        </Text>
        <Text style={[styles.featureItem, { color: theme.mutedForeground }]}>
          • AI-powered assistant
        </Text>
        <Text style={[styles.featureItem, { color: theme.mutedForeground }]}>
          • Multiple templates
        </Text>
        <Text style={[styles.featureItem, { color: theme.mutedForeground }]}>
          • Email & PDF export
        </Text>
        <Text style={[styles.featureItem, { color: theme.mutedForeground }]}>
          • Priority support
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  compactContainer: {
    paddingVertical: 4,
  },
  compactText: {
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  planCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 12,
    alignItems: 'center',
  },
  recommendedPlan: {
    position: 'relative',
    paddingTop: 24,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  planPeriod: {
    fontSize: 14,
    marginTop: 4,
  },
  savings: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  features: {
    marginTop: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  featureItem: {
    fontSize: 14,
    lineHeight: 24,
  },
});
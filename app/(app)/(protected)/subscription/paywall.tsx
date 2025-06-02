import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { CheckCircle, ArrowRight, X } from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function PaywallScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const themeColors = colors[theme];

  const features = [
    {
      title: 'Unlimited Invoices',
      description: 'Create as many invoices as you need for your business'
    },
    {
      title: 'Professional Templates',
      description: 'Access to premium invoice designs and customization'
    },
    {
      title: 'Online Payments',
      description: 'Receive payments directly through Stripe and PayPal'
    },
    {
      title: 'Advanced Analytics',
      description: 'Track your business performance with detailed insights'
    },
    {
      title: 'Priority Support',
      description: 'Get help when you need it with priority customer support'
    },
    {
      title: 'Cloud Backup',
      description: 'Never lose your data with automatic cloud backups'
    }
  ];

  const handleUpgradePress = () => {
    // TODO: Implement actual payment flow
    console.log('Upgrade button pressed');
    // For now, just go back
    router.back();
  };

  const handleClosePress = () => {
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClosePress} style={styles.closeButton}>
          <X size={24} color={themeColors.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: themeColors.foreground }]}>
            GET PRO ACCESS
          </Text>
          <Text style={[styles.heroSubtitle, { color: '#6366F1' }]}>
            GO UNLIMITED
          </Text>
          <Text style={[styles.heroDescription, { color: themeColors.mutedForeground }]}>
            You've reached your limit of 3 free invoices. Upgrade to unlock the full power of SupaInvoice!
          </Text>
        </View>

        {/* Features List */}
        <View style={styles.featuresSection}>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <CheckCircle size={20} color="#10B981" style={styles.featureIcon} />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: themeColors.foreground }]}>
                  {feature.title}
                </Text>
                <Text style={[styles.featureDescription, { color: themeColors.mutedForeground }]}>
                  {feature.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing Section */}
        <View style={[styles.pricingCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View style={styles.pricingHeader}>
            <Text style={[styles.pricingTitle, { color: themeColors.foreground }]}>
              Pro Plan
            </Text>
            <View style={styles.bestOfferBadge}>
              <Text style={styles.bestOfferText}>BEST OFFER</Text>
            </View>
          </View>
          
          <View style={styles.pricingAmount}>
            <Text style={[styles.price, { color: themeColors.foreground }]}>$9.99</Text>
            <Text style={[styles.pricePeriod, { color: themeColors.mutedForeground }]}>/month</Text>
          </View>
          
          <Text style={[styles.pricingDescription, { color: themeColors.mutedForeground }]}>
            Everything you need to manage your invoicing business
          </Text>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <TouchableOpacity 
            style={[styles.upgradeButton, { backgroundColor: '#6366F1' }]}
            onPress={handleUpgradePress}
          >
            <Text style={styles.upgradeButtonText}>Start Free Trial</Text>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>
          
          <Text style={[styles.trialText, { color: themeColors.mutedForeground }]}>
            7-day free trial • Cancel anytime
          </Text>
          
          <TouchableOpacity onPress={handleClosePress}>
            <Text style={[styles.notNowText, { color: themeColors.mutedForeground }]}>
              Maybe later
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
  },
  heroDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  featuresSection: {
    marginVertical: 30,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  pricingCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 20,
    marginVertical: 20,
  },
  pricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  pricingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  bestOfferBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestOfferText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pricingAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  pricePeriod: {
    fontSize: 18,
    marginLeft: 4,
  },
  pricingDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  ctaSection: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
    marginBottom: 15,
    width: width - 40,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  trialText: {
    fontSize: 14,
    marginBottom: 20,
  },
  notNowText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
}); 
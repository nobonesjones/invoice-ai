import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { 
  Crown, 
  ArrowRight, 
  Check, 
  FileText, 
  Send, 
  Users, 
  BarChart3, 
  Mail,
  X 
} from 'lucide-react-native';
import { TrialService } from '@/services/trialService';
import { useOnboarding } from '@/context/onboarding-provider';
import { useSupabase } from '@/context/supabase-provider';
import { AuthModal } from '@/components/auth/auth-modal';
import { supabase } from '@/config/supabase';

export default function SoftPaywallScreen() {
  const router = useRouter();
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const { saveOnboardingData, onboardingData } = useOnboarding();
  const { session } = useSupabase();
  const [isProcessing, setIsProcessing] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'paid'>('free');

  const premiumFeatures = [
    { icon: Send, title: 'Unlimited Invoice Sends', description: 'Send as many invoices as you need' },
    { icon: FileText, title: 'Advanced Templates', description: 'Professional invoice designs' },
    { icon: Users, title: 'Client Management', description: 'Organize and track your clients' },
    { icon: BarChart3, title: 'Analytics & Reports', description: 'Insights into your business' },
    { icon: Mail, title: 'Email Integration', description: 'Send invoices directly via email' },
  ];

  const freeFeatures = [
    'Create unlimited invoices',
    'Send up to 3 invoices for free',
    'Basic templates',
    'Export to PDF'
  ];

  const handleSubscribe = async () => {
    try {
      setIsProcessing(true);
      
      // Set plan to paid and show auth modal
      setSelectedPlan('paid');
      setAuthModalVisible(true);
      
    } catch (error: any) {
      console.error('[Soft Paywall] Error starting subscription:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSkip = async () => {
    try {
      // Set plan to free and show auth modal
      setSelectedPlan('free');
      setAuthModalVisible(true);
      
    } catch (error: any) {
      console.error('[Soft Paywall] Error starting free trial:', error);
      Alert.alert('Error', 'Failed to start trial. Please try again.');
    }
  };

  const handleClose = () => {
    // Go back to onboarding
    router.back();
  };

  const handleAuthSuccess = async () => {
    setAuthModalVisible(false);
    
    try {
      // At this point, the user has successfully authenticated with their REAL account
      // Get the session directly from Supabase to ensure we have the latest session data
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Soft Paywall] Error getting session:', sessionError);
        Alert.alert('Error', 'Failed to verify your session. Please try again.');
        return;
      }
      
      if (selectedPlan === 'free') {
        console.log('[Soft Paywall] User chose free plan and authenticated');
        
        // Get the current authenticated user (their REAL account)
        if (sessionData?.session?.user?.id) {
          try {
            // Save onboarding data to the REAL user account
            await saveOnboardingData(sessionData.session.user.id);
            console.log('[Soft Paywall] Onboarding data saved successfully to real user account:', sessionData.session.user.id);
            
            // Navigate to the protected area (no trial needed since they have a real account)
            router.replace('/(app)/(protected)');
          } catch (error) {
            console.error('[Soft Paywall] Error saving onboarding data:', error);
            Alert.alert('Error', 'Failed to save your information. Please try again.');
            return;
          }
        } else {
          // This shouldn't happen if auth was successful, but handle it gracefully
          Alert.alert('Error', 'Authentication was successful but we couldn\'t access your account. Please try again.');
          return;
        }
        
      } else {
        // User chose paid plan - TODO: Integrate RevenueCat here
        console.log('[Soft Paywall] User chose paid plan');
        
        if (sessionData?.session?.user?.id) {
          try {
            // Save onboarding data to the REAL user account
            await saveOnboardingData(sessionData.session.user.id);
            console.log('[Soft Paywall] Onboarding data saved successfully to real paid user account:', sessionData.session.user.id);
          } catch (error) {
            console.error('[Soft Paywall] Error saving onboarding data:', error);
            // Don't block the flow if onboarding data save fails
          }
        }
        
        // For now, show coming soon alert and navigate to app
        Alert.alert(
          'Coming Soon!', 
          'Payment integration with RevenueCat will be added here. For now, you can access the app.',
          [
            { 
              text: 'OK', 
              onPress: () => {
                router.replace('/(app)/(protected)');
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('[Soft Paywall] Error handling auth success:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header with close button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color={themeColors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Premium offer section */}
        <View style={styles.premiumSection}>
          <View style={styles.crownContainer}>
            <Crown size={32} color="#FFC107" />
          </View>
          
          <Text style={[styles.title, { color: themeColors.foreground }]}>
            Unlock SupaInvoice Pro
          </Text>
          
          <Text style={[styles.subtitle, { color: themeColors.mutedForeground }]}>
            Get the full power of professional invoicing
          </Text>

          <View style={[styles.priceContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.price, { color: themeColors.foreground }]}>
              $9.99
            </Text>
            <Text style={[styles.priceUnit, { color: themeColors.mutedForeground }]}>
              /month
            </Text>
          </View>

          {/* Premium Features */}
          <View style={styles.featuresContainer}>
            {premiumFeatures.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <View style={[styles.featureIcon, { backgroundColor: themeColors.primary }]}>
                  <feature.icon size={16} color={themeColors.primaryForeground} />
                </View>
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

          {/* Subscribe Button */}
          <TouchableOpacity
            style={[styles.subscribeButton, { backgroundColor: '#FFC107' }]}
            onPress={handleSubscribe}
            disabled={isProcessing}
          >
            <Crown size={20} color="#FFFFFF" />
            <Text style={styles.subscribeButtonText}>
              {isProcessing ? 'Processing...' : 'Start Pro Subscription'}
            </Text>
            {!isProcessing && <ArrowRight size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>

        {/* Free option */}
        <View style={[styles.freeSection, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.freeTitle, { color: themeColors.foreground }]}>
            Or continue with free version
          </Text>
          
          <View style={styles.freeFeatures}>
            {freeFeatures.map((feature, index) => (
              <View key={index} style={styles.freeFeatureItem}>
                <Check size={16} color="#10B981" />
                <Text style={[styles.freeFeatureText, { color: themeColors.mutedForeground }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.skipButton, { borderColor: themeColors.border }]}
            onPress={handleSkip}
          >
            <Text style={[styles.skipButtonText, { color: themeColors.foreground }]}>
              Continue with Free
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Auth Modal */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => setAuthModalVisible(false)}
        initialMode="signup"
        plan={selectedPlan}
        onSuccess={handleAuthSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 10,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
  },
  premiumSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  crownContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 32,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  priceUnit: {
    fontSize: 16,
    marginLeft: 4,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 14,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    gap: 8,
  },
  subscribeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  freeSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginBottom: 30,
  },
  freeTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  freeFeatures: {
    marginBottom: 20,
  },
  freeFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  freeFeatureText: {
    fontSize: 14,
    marginLeft: 8,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
}); 
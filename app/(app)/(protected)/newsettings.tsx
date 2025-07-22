import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Switch, TouchableOpacity, ActivityIndicator, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient'; 
import {
  ChevronRight, Search, Zap, User, Briefcase, Settings, HelpCircle, Moon, Sun, LogOut, Star, Mail, 
  Languages, NotebookText, Shield, FileText, DollarSign, CreditCard, Bell,
  Crown 
} from 'lucide-react-native';

import { Text } from '@/components/ui/text'; 
import { useTheme } from '@/context/theme-provider'; 
import { SettingsListItem } from '@/components/ui/SettingsListItem';
import { useSupabase } from '@/context/supabase-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useShineAnimation } from '@/lib/hooks/useShineAnimation'; // Import the hook
import { usePaywall } from '@/context/paywall-provider';
import PaywallService, { PaywallService as PaywallServiceClass } from '@/services/paywallService';
import { usePlacement, useSuperwall } from 'expo-superwall';
import UsageTrackingService, { UsageStats } from '@/services/usageTrackingService';

export default function NewSettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useSupabase();
  const { theme, isLightMode, toggleTheme } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { presentPaywall, isSubscribed, isLoading: paywallLoading } = usePaywall();
  const [searchTerm, setSearchTerm] = useState('');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);

  // Test Superwall context
  const superwall = useSuperwall();
  console.log('🔥 Superwall context:', superwall);
  console.log('🔥 Superwall context keys:', Object.keys(superwall || {}));
  console.log('🔥 Button state - paywallLoading:', paywallLoading, 'isSubscribed:', isSubscribed);

  // Use the Superwall placement hook
  const { registerPlacement, state: placementState } = usePlacement({
    onError: (err) => {
      console.error('🔥 Superwall Placement Error:', err);
      console.error('🔥 Superwall Placement Error Stack:', err.stack);
    },
    onPresent: (info) => {
      console.log('🔥 Superwall Paywall Presented:', info);
      console.log('🔥 Products in paywall:', info.products || []);
      console.log('🔥 Product IDs:', info.productIds || []);
      console.log('🔥 Products load duration:', info.productsLoadDuration);
      console.log('🔥 Products load fail time:', info.productsLoadFailTime);
      if (info.productsLoadFailTime) {
        console.log('🔥 ⚠️ PRODUCTS FAILED TO LOAD!');
      }
      console.log('🔥 Superwall Paywall Presented Info:', JSON.stringify(info, null, 2));
    },
    onDismiss: (info, result) => {
      console.log('🔥 Superwall Paywall Dismissed:', info, 'Result:', result);
      console.log('🔥 Superwall Paywall Dismissed Info:', JSON.stringify(info, null, 2));
      console.log('🔥 Superwall Paywall Dismissed Result:', JSON.stringify(result, null, 2));
    },
  });
  
  console.log('🔥 usePlacement hook initialized:', {
    registerPlacement: typeof registerPlacement,
    placementState,
  });
  
  // Test if registerPlacement is available
  console.log('🔥 registerPlacement available:', !!registerPlacement);
  console.log('🔥 registerPlacement is function:', typeof registerPlacement === 'function');

  // Use the custom hook for shine animation
  const shineTranslateX = useShineAnimation({
    duration: 1000,
    delay: 3000,
    outputRange: [-200, 200] // Default is already this, but explicit for clarity
  });

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(true);
      // Refresh usage stats when screen comes into focus
      loadUsageStats();
      // Optional: Return a cleanup function if needed when the screen is unfocused
      // return () => setIsTabBarVisible(false); // Example: if this screen should hide it on unfocus
    }, [setIsTabBarVisible, loadUsageStats])
  );

  // Load usage stats function
  const loadUsageStats = useCallback(async () => {
    if (!user?.id) return;
    
    setIsLoadingUsage(true);
    try {
      const stats = await UsageTrackingService.getUserUsageStats(user.id);
      console.log('[Settings] Loaded usage stats:', stats);
      setUsageStats(stats);
    } catch (error) {
      console.error('[Settings] Error loading usage stats:', error);
    } finally {
      setIsLoadingUsage(false);
    }
  }, [user?.id]);

  // Load usage stats when screen loads or user changes
  useEffect(() => {
    loadUsageStats();
  }, [user?.id, loadUsageStats]);

  const handleUpgradePress = async () => {
    console.log('🔥 Upgrade button pressed!');
    console.log('🔥 Button working - this should appear in logs');
    Alert.alert('Debug', 'Upgrade button clicked - check console for Superwall logs');
    try {
      console.log('🔥 Trying create_item_limit placement...');
      
      const result = await registerPlacement({
        placement: 'create_item_limit'
      });
      
      console.log('🔥 create_item_limit result:', result);
      console.log('🔥 placement state:', placementState);
      
      // If placement not found, try campaign_trigger as fallback
      if (placementState?.reason?.type === 'PlacementNotFound') {
        console.log('🔥 create_item_limit not found, trying campaign_trigger...');
        
        const fallbackResult = await registerPlacement({
          placement: 'campaign_trigger'
        });
        
        console.log('🔥 campaign_trigger result:', fallbackResult);
        console.log('🔥 campaign_trigger state:', placementState);
      }
      
    } catch (error) {
      console.error('🔥 Failed to present paywall:', error);
      Alert.alert('Error', 'Unable to show upgrade options. Please try again.');
    }
  };
  const handleEditAccountPress = () => {
    setIsTabBarVisible(false);
    router.push('/account-details'); 
  };
  const handleBusinessInformationPress = () => {
    setIsTabBarVisible(false);
    router.push('/business-information');
  };
  const handleInvoiceSettingsPress = () => {
    setIsTabBarVisible(false);
    router.push('/invoice-settings');
  };
  const handleTaxCurrencyPress = () => {
    setIsTabBarVisible(false);
    router.push('/tax-currency');
  };
  const handlePaymentOptionsPress = () => {
    setIsTabBarVisible(false);
    router.push('/payment-options');
  };
  const handlePaymentRemindersPress = () => {
    setIsTabBarVisible(false);
    router.push('/payment-reminders');
  };
  const handleAppLanguagePress = () => {
    setIsTabBarVisible(false);
    router.push('/app-language');
  };
  const handleStoragePress = () => console.log('Storage pressed');
  const handlePrivacyPolicyPress = () => console.log('Privacy Policy pressed');
  const handleTermsOfServicePress = () => console.log('Terms Of Service pressed');
  const handleHelpPress = () => {
    setIsTabBarVisible(false);
    router.push('/customer-support');
  };
  const handleContactUsPress = () => console.log('Contact Us pressed');
  const handleLeaveReviewPress = () => console.log('Leave Review pressed');

  const userDisplayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";

  // Define all settings items in a searchable structure
  const allSettingsItems = [
    {
      section: 'Account',
      items: [
        {
          id: 'edit-account',
          icon: <User color={theme.foreground} size={24} />,
          label: 'Edit Account Details',
          onPress: handleEditAccountPress,
          searchTerms: ['edit', 'account', 'details', 'profile', 'user']
        }
      ]
    },
    {
      section: 'Business Settings',
      items: [
        {
          id: 'business-info',
          icon: <Briefcase color={theme.foreground} size={24} />,
          label: 'Business Information',
          onPress: handleBusinessInformationPress,
          searchTerms: ['business', 'information', 'company', 'details']
        },
        {
          id: 'invoice-settings',
          icon: <FileText color={theme.foreground} size={24} />,
          label: 'Invoice Settings',
          onPress: handleInvoiceSettingsPress,
          searchTerms: ['invoice', 'settings', 'template', 'design', 'defaults']
        },
        {
          id: 'tax-currency',
          icon: <DollarSign color={theme.foreground} size={24} />,
          label: 'Tax and Currency',
          onPress: handleTaxCurrencyPress,
          searchTerms: ['tax', 'currency', 'money', 'dollar', 'vat']
        },
        {
          id: 'payment-options',
          icon: <CreditCard color={theme.foreground} size={24} />,
          label: 'Payment Options',
          onPress: handlePaymentOptionsPress,
          searchTerms: ['payment', 'options', 'credit', 'card', 'paypal', 'bank']
        },
        {
          id: 'payment-reminders',
          icon: <Bell color={theme.foreground} size={24} />,
          label: 'Payment Reminders',
          onPress: handlePaymentRemindersPress,
          searchTerms: ['payment', 'reminders', 'notifications', 'alerts']
        }
      ]
    },
    {
      section: 'App Settings',
      items: [
        {
          id: 'theme',
          icon: isLightMode ? <Moon color={theme.foreground} size={24} /> : <Sun color={theme.foreground} size={24} />,
          label: isLightMode ? "Dark Mode" : "Light Mode",
          onPress: toggleTheme,
          hideChevron: true,
          rightContent: (
            <Switch 
              value={!isLightMode} 
              onValueChange={toggleTheme} 
              trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
              thumbColor={isLightMode ? theme.primary : theme.foreground }
            />
          ),
          searchTerms: ['dark', 'light', 'mode', 'theme', 'appearance']
        },
        {
          id: 'language',
          icon: <Languages color={theme.foreground} size={24} />,
          label: 'App Language',
          onPress: handleAppLanguagePress,
          searchTerms: ['language', 'app', 'translation', 'locale']
        }
      ]
    },
    {
      section: 'Help',
      items: [
        {
          id: 'help',
          icon: <HelpCircle color={theme.foreground} size={24} />,
          label: 'Help & Customer Support',
          onPress: handleHelpPress,
          searchTerms: ['help', 'customer', 'support', 'assistance', 'contact']
        },
        {
          id: 'review',
          icon: <Star color={theme.foreground} size={24} />,
          label: 'Leave Review',
          onPress: handleLeaveReviewPress,
          searchTerms: ['leave', 'review', 'rating', 'feedback', 'star']
        },
        {
          id: 'privacy',
          icon: <Shield color={theme.foreground} size={24} />,
          label: 'Privacy Policy',
          onPress: handlePrivacyPolicyPress,
          searchTerms: ['privacy', 'policy', 'data', 'protection']
        },
        {
          id: 'terms',
          icon: <FileText color={theme.foreground} size={24} />,
          label: 'Terms Of Service',
          onPress: handleTermsOfServicePress,
          searchTerms: ['terms', 'service', 'agreement', 'legal']
        }
      ]
    }
  ];

  // Filter settings based on search term
  const filteredSections = searchTerm.trim() 
    ? allSettingsItems.map(section => ({
        ...section,
        items: section.items.filter(item => {
          const searchLower = searchTerm.toLowerCase().trim();
          const labelMatch = item.label.toLowerCase().includes(searchLower);
          const searchTermsMatch = item.searchTerms.some(term => 
            term.toLowerCase().includes(searchLower)
          );
          return labelMatch || searchTermsMatch;
        })
      })).filter(section => section.items.length > 0)
    : allSettingsItems;

  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScrollView
          style={[styles.container, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.foreground }]}>Settings</Text>
            <TouchableOpacity 
              style={[
                styles.upgradeButton, 
                { 
                  backgroundColor: isSubscribed ? theme.primary : theme.gold,
                  opacity: paywallLoading ? 0.7 : 1
                }
              ]} 
              onPress={() => {
                console.log('🔥🔥🔥 BASIC BUTTON PRESS DETECTED');
                Alert.alert('Button Works!', 'The upgrade button is clickable');
                handleUpgradePress();
              }}
              disabled={paywallLoading}
              activeOpacity={0.7}
            >
              {!isSubscribed && (
                <Animated.View 
                  style={[
                    styles.shineOverlay,
                    { transform: [{ translateX: shineTranslateX }] }
                  ]}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)', 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.shineGradient}
                  />
                </Animated.View>
              )}
              {paywallLoading ? (
                <ActivityIndicator size="small" color={theme.goldContrastText} style={{ marginRight: 6 }} />
              ) : (
                <Crown size={16} color={isSubscribed ? theme.primaryForeground : theme.goldContrastText} style={{ marginRight: 6 }} />
              )}
              <Text style={[
                styles.upgradeButtonText, 
                { color: isSubscribed ? theme.primaryForeground : theme.goldContrastText }
              ]}>
                {isSubscribed ? 'Pro' : 'Upgrade'}
              </Text> 
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBarContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Search size={20} color={theme.mutedForeground} style={styles.searchIcon} />
            <TextInput
              placeholder="Search Settings"
              placeholderTextColor={theme.mutedForeground}
              style={[styles.searchInput, { color: theme.foreground}]}
              value={searchTerm}
              onChangeText={handleSearchChange}
            />
          </View>

          {/* Usage Counter */}
          {!isSubscribed && usageStats && (
            <View style={[styles.usageCounterContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.usageCounterContent}>
                <View style={styles.usageCounterMain}>
                  <Text style={[styles.usageCounterTitle, { color: theme.foreground }]}>
                    Free Plan Usage
                  </Text>
                  <View style={styles.usageCounterBar}>
                    <View style={[styles.usageCounterProgress, { 
                      backgroundColor: theme.primary,
                      width: `${(usageStats.totalItemsCreated / 3) * 100}%`
                    }]} />
                  </View>
                  <Text style={[styles.usageCounterText, { color: theme.mutedForeground }]}>
                    {usageStats.totalItemsCreated}/3 items created
                  </Text>
                </View>
                {usageStats.totalItemsCreated >= 3 && (
                  <TouchableOpacity 
                    style={[styles.usageUpgradeButton, { backgroundColor: theme.primary }]}
                    onPress={handleUpgradePress}
                  >
                    <Text style={[styles.usageUpgradeButtonText, { color: theme.primaryForeground }]}>
                      Upgrade
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {filteredSections.length > 0 ? (
            filteredSections.map((section, index) => (
              <React.Fragment key={section.section}>
                <Text style={[styles.sectionTitleText, { color: theme.mutedForeground }]}>{section.section}</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
                  {section.items.map((item, itemIndex) => (
            <SettingsListItem
                      key={item.id}
                      icon={item.icon}
                      label={item.label}
                      onPress={item.onPress}
                      hideChevron={item.hideChevron}
                      rightContent={item.rightContent}
                    />
                  ))}
          </View>
              </React.Fragment>
            ))
          ) : (
            <View style={{ alignItems: 'center', marginTop: 50 }}>
              <Text style={[{ color: theme.mutedForeground, fontSize: 16 }]}>
                No settings found matching "{searchTerm}"
              </Text>
          </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  sectionCard: {
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.5,
    elevation: 5,
  },
  accountHeaderContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  userEmailText: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitleText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 8,
    marginHorizontal: 20,
    textTransform: 'uppercase',
  },
  signOutSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: 16,
    // marginBottom: 16, // Adjusted to account for potential safe area insets if this was at very bottom
    borderRadius: 10,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  upgradeButton: { 
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row', 
    alignItems: 'center',   
    overflow: 'hidden', // Important for containing the shine
    position: 'relative', // Important for absolute positioning of shineOverlay
    // backgroundColor will be set inline using theme.gold
  },
  upgradeButtonText: { 
    fontSize: 14,
    fontWeight: 'bold',
    // color will be set inline using theme.goldContrastText
  },
  shineOverlay: { // Style for the animated shine view
    ...StyleSheet.absoluteFillObject,
    zIndex: 1, // Ensure it's on top of the background, but content can be on top of it if needed
    pointerEvents: 'none', // Allow touch events to pass through to the button
  },
  shineGradient: { // Style for the gradient itself
    width: '100%',
    height: '100%',
  },
  usageCounterContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  usageCounterContent: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usageCounterMain: {
    flex: 1,
  },
  usageCounterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  usageCounterBar: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    marginBottom: 6,
    overflow: 'hidden',
  },
  usageCounterProgress: {
    height: '100%',
    borderRadius: 3,
  },
  usageCounterText: {
    fontSize: 14,
    fontWeight: '500',
  },
  usageUpgradeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginLeft: 12,
  },
  usageUpgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

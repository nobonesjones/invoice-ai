import React, { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Switch, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import {
  ChevronRight, Search, Zap, User, Briefcase, Settings, HelpCircle, Moon, Sun, LogOut, Star, Mail, 
  Languages, NotebookText, Shield, FileText, DollarSign, CreditCard, Bell
} from 'lucide-react-native';

import { Text } from '@/components/ui/text'; 
import { useTheme } from '@/context/theme-provider'; 
import { SettingsListItem } from '@/components/ui/SettingsListItem';
import { useSupabase } from '@/context/supabase-provider';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';

export default function NewSettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useSupabase();
  const { theme, isLightMode, toggleTheme } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(true);
      // Optional: Return a cleanup function if needed when the screen is unfocused
      // return () => setIsTabBarVisible(false); // Example: if this screen should hide it on unfocus
    }, [setIsTabBarVisible])
  );

  const handleUpgradePress = () => console.log('Upgrade pressed');
  const handleEditAccountPress = () => {
    setIsTabBarVisible(false);
    router.push('/account-details'); 
  };
  const handleBusinessInformationPress = () => {
    setIsTabBarVisible(false);
    router.push('/business-information');
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
          </View>

          <View style={[styles.searchBarContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Search size={20} color={theme.mutedForeground} style={styles.searchIcon} />
            <TextInput
              placeholder="Search Settings"
              placeholderTextColor={theme.mutedForeground}
              style={[styles.searchInput, { color: theme.foreground}]}
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
            <SettingsListItem
              icon={<Star color={theme.primary} size={24} />}
              label="Upgrade"
              onPress={handleUpgradePress}
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
            <SettingsListItem
              icon={<User color={theme.foreground} size={24} />}
              label="Edit Account Details"
              onPress={handleEditAccountPress}
            />
          </View>

          <Text style={[styles.sectionTitleText, { color: theme.mutedForeground }]}>Business Settings</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
            <SettingsListItem
              icon={<Briefcase color={theme.foreground} size={24} />}
              label="Business Information"
              onPress={handleBusinessInformationPress}
            />
            <SettingsListItem
              icon={<DollarSign color={theme.foreground} size={24} />}
              label="Tax and Currency"
              onPress={handleTaxCurrencyPress}
            />
            <SettingsListItem
              icon={<CreditCard color={theme.foreground} size={24} />}
              label="Payment Options"
              onPress={handlePaymentOptionsPress}
            />
            <SettingsListItem
              icon={<Bell color={theme.foreground} size={24} />}
              label="Payment Reminders"
              onPress={handlePaymentRemindersPress}
            />
          </View>

          <Text style={[styles.sectionTitleText, { color: theme.mutedForeground }]}>App Settings</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
            <SettingsListItem
              icon={isLightMode ? <Moon color={theme.foreground} size={24} /> : <Sun color={theme.foreground} size={24} />}
              label={isLightMode ? "Dark Mode" : "Light Mode"}
              onPress={toggleTheme}
              hideChevron={true}
              rightContent={
                <Switch 
                  value={!isLightMode} 
                  onValueChange={toggleTheme} 
                  trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
                  thumbColor={isLightMode ? theme.primary : theme.foreground }
                />
              }
            />
            <SettingsListItem
              icon={<Languages color={theme.foreground} size={24} />} 
              label="App Language"
              onPress={handleAppLanguagePress}
            />
          </View>

          <Text style={[styles.sectionTitleText, { color: theme.mutedForeground }]}>Help</Text>
          <View style={[styles.sectionCard, { backgroundColor: theme.card }]}>
            <SettingsListItem
              icon={<HelpCircle color={theme.foreground} size={24} />}
              label="Help & Customer Support"
              onPress={handleHelpPress}
            />
            <SettingsListItem
              icon={<Star color={theme.foreground} size={24} />}
              label="Leave Review"
              onPress={handleLeaveReviewPress}
            />
            <SettingsListItem
              icon={<Shield color={theme.foreground} size={24} />}
              label="Privacy Policy"
              onPress={handlePrivacyPolicyPress}
            />
            <SettingsListItem
              icon={<FileText color={theme.foreground} size={24} />}
              label="Terms Of Service"
              onPress={handleTermsOfServicePress}
            />
          </View>
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
    alignItems: 'flex-start',
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
});

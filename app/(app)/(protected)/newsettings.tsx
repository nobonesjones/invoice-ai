import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Switch, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronRight, Search, Zap, User, Briefcase, Settings, HelpCircle, Moon, Sun, LogOut, Star, Mail, 
  Languages, NotebookText, Shield, FileText, DollarSign, CreditCard, Bell
} from 'lucide-react-native';

import { Text } from '@/components/ui/text'; 
import { useTheme } from '@/context/theme-provider'; 
import { SettingsListItem } from '@/components/ui/SettingsListItem';
import { useSupabase } from '@/context/supabase-provider';

export default function NewSettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useSupabase();
  const { theme, isLightMode, toggleTheme } = useTheme();
  const [isLoadingSignOut, setIsLoadingSignOut] = useState(false);

  const handleUpgradePress = () => console.log('Upgrade pressed');
  const handleEditAccountPress = () => router.push('/(app)/(protected)/account-details');
  const handleBusinessInformationPress = () => console.log('Business Information pressed');
  const handleTaxCurrencyPress = () => console.log('Tax and Currency pressed');
  const handlePaymentOptionsPress = () => console.log('Payment Options pressed');
  const handlePaymentRemindersPress = () => console.log('Payment Reminders pressed');
  const handleAppLanguagePress = () => console.log('App Language pressed');
  const handleStoragePress = () => console.log('Storage pressed');
  const handlePrivacyPolicyPress = () => console.log('Privacy Policy pressed');
  const handleTermsOfServicePress = () => console.log('Terms Of Service pressed');
  const handleContactUsPress = () => console.log('Contact Us pressed');
  const handleLeaveReviewPress = () => console.log('Leave Review pressed');

  const handleSignOut = async () => {
    setIsLoadingSignOut(true);
    try {
      await signOut();
      // router.replace('/auth'); // Or your initial auth screen path
    } catch (error: any) {
      console.error("Error signing out:", error);
      Alert.alert("Error", error.message || "Failed to sign out.");
    } finally {
      setIsLoadingSignOut(false);
    }
  };

  const userDisplayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1 }}>
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
              label="Customer Support"
              onPress={handleContactUsPress}
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

        <View style={[styles.signOutSection, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <SettingsListItem
            icon={<LogOut size={24} color={theme.destructive} />}
            label="Sign Out"
            isDestructive
            hideChevron
            onPress={handleSignOut}
            disabled={isLoadingSignOut}
            rightContent={
              isLoadingSignOut ? (
                <ActivityIndicator size="small" color={theme.destructive} />
              ) : null
            }
          />
        </View>
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
    paddingBottom: 100,
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
    marginBottom: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator, TouchableOpacity, Platform } from 'react-native'; 
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, User, Mail, Phone, LogOut } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase'; 
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';

export default function AccountDetailsScreen() {
  const router = useRouter();
  const { user, signOut, session } = useSupabase(); 
  const { theme } = useTheme();
  const { setIsTabBarVisible } = useTabBarVisibility();

  useFocusEffect(
    React.useCallback(() => {
      setIsTabBarVisible(false);
      return () => {
        setIsTabBarVisible(true);
      };
    }, [setIsTabBarVisible])
  );

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.user_metadata?.display_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || ''); 
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) return; 
    setIsLoading(true);

    if (email && !/\S+@\S+\.\S+/.test(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address.');
        setIsLoading(false);
        return;
    }

    const trimmedPhone = phone.trim();

    // Basic E.164 format check for phone number
    // Check only if phone is not empty, to allow clearing the phone number
    if (trimmedPhone && !/^\+[1-9]\d{1,14}$/.test(trimmedPhone)) {
        Alert.alert(
            'Invalid Phone Format',
            'Please enter the phone number in the international E.164 format (e.g., +12223334444), or leave it empty to remove.'
        );
        setIsLoading(false);
        return;
    }

    const userMetadataUpdates: { display_name?: string } = {};
    let newPhoneNumber: string | undefined = undefined;
    let changesMade = false;

    if (displayName !== (user.user_metadata?.display_name || '')) {
        userMetadataUpdates.display_name = displayName.trim();
        changesMade = true;
    }

    // Compare trimmedPhone with existing user.phone
    if (trimmedPhone !== (user.phone || '')) {
        newPhoneNumber = trimmedPhone; // This can be an empty string if the user cleared it
        changesMade = true;
    }

    if (email && email !== user.email) {
       console.log('Email change attempted. Current email:', user.email, 'New email:', email);
    }

    if (!changesMade) {
        Alert.alert('No Changes', 'No changes were made to name or phone.');
        setIsLoading(false);
        return;
    }

    try {
        const updatePayload: { phone?: string; data?: { display_name?: string } } = {};

        if (Object.keys(userMetadataUpdates).length > 0) {
            updatePayload.data = userMetadataUpdates;
        }
        // Only include phone in payload if it was actually part of the changes
        // newPhoneNumber will be undefined if the phone field wasn't touched OR if it was touched but resulted in no change from original
        // However, the `changesMade` flag already covers this. If phone was changed (even to empty), newPhoneNumber will be set.
        if (newPhoneNumber !== undefined) { 
            updatePayload.phone = newPhoneNumber; // Send empty string if cleared, or new E.164 number
        }

        console.log("Attempting to update user with payload:", JSON.stringify(updatePayload));

        const { data: updateData, error: updateError } = await supabase.auth.updateUser(updatePayload);

        if (updateError) {
            console.error('Supabase updateUser error:', updateError);
            throw updateError;
        }
        
        console.log('Supabase updateUser success data:', updateData);
        Alert.alert('Success', 'Account details updated successfully.');

    } catch (error: any) {
        console.error('Error in handleSaveChanges:', error);
        Alert.alert('Error', error.message || 'Failed to update account details.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace('/auth'); 
    } catch (error: any) {
      console.error('Error signing out:', error);
      Alert.alert('Error', error.message || 'Failed to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const headerLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0, padding: Platform.OS === 'ios' ? 0 :10 }}>
      <ChevronLeft size={28} color={theme.foreground} />
    </TouchableOpacity>
  );

  return (
    <>
      <Stack.Screen 
        options={{
          headerShown: true,
          headerTitle: "Account Details",
          headerTransparent: false, 
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.foreground,
          headerTitleStyle: { fontWeight: 'bold' },
          headerLeft: headerLeft,
          animation: 'slide_from_right',
        }}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView 
          style={[styles.container, { backgroundColor: theme.background }]}
          contentContainerStyle={styles.scrollViewContentContainer} 
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.mainContent}> 
            <View style={styles.formContainer}>
              <View style={[styles.inputBlockContainer, {borderColor: theme.border, backgroundColor: theme.card}]}>
                {/* Name Field */}
                <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.foreground }]}>Name</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.foreground }]}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter full name"
                    placeholderTextColor={theme.mutedForeground}
                    autoCapitalize="words"
                    textAlign="right"
                  />
                </View>

                {/* Email Field */}
                <View style={[styles.fieldRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.fieldLabel, { color: theme.foreground }]}>Email</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.foreground }]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email"
                    placeholderTextColor={theme.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                  />
                </View>
                <Text style={[styles.inputHelper, { color: theme.mutedForeground, paddingHorizontal:16, paddingBottom: 8}]}>Email changes require verification.</Text>

                {/* Mobile Number Field - No bottom border for the fieldRow itself */}
                <View style={styles.fieldRow_noBorder}>
                  <Text style={[styles.fieldLabel, { color: theme.foreground }]}>Mobile</Text>
                  <TextInput
                    style={[styles.fieldInput, { color: theme.foreground }]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="e.g., +12223334444"
                    placeholderTextColor={theme.mutedForeground}
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                    autoComplete='tel'
                    textAlign="right"
                  />
                </View>
              </View>

              <Button 
                onPress={handleSaveChanges} 
                disabled={isLoading} 
                style={[styles.actionButton, { backgroundColor: theme.primary }]} 
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.primaryForeground} /> 
                ) : (
                  <Text style={{ color: theme.primaryForeground, fontWeight: 'bold' }}>Save Changes</Text>
                )}
              </Button>
            </View>

            <View style={styles.signOutSectionContainer}>
                <Button 
                  onPress={handleSignOut} 
                  disabled={isSigningOut} 
                  style={[styles.actionButton, styles.signOutButton, { backgroundColor: theme.destructive }]}
                >
                    {isSigningOut ? (
                      <ActivityIndicator color={theme.destructiveForeground} /> 
                    ) : (
                      <>
                        <LogOut size={18} color={theme.destructiveForeground} style={{marginRight: 8}}/>
                        <Text style={{color: theme.destructiveForeground, fontWeight: 'bold'}}>Sign Out</Text>
                      </>
                    )}
                </Button>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollViewContentContainer: { 
    flexGrow: 1, 
    paddingVertical: 24,
    paddingHorizontal: 16, 
  },
  mainContent: { 
    flex: 1,
    justifyContent: 'space-between',
  },
  formContainer: {
    // Removed marginBottom: 30, as mainContent now handles spacing
  },
  inputBlockContainer: { 
    borderWidth: 1,
    borderRadius: 12, 
    marginBottom: 24, 
    overflow: 'hidden', 
  },
  fieldRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12, 
    borderBottomWidth: StyleSheet.hairlineWidth, 
  },
  fieldRow_noBorder: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
  },
  fieldLabel: {
    fontSize: 16, 
    fontWeight: 'bold', 
    // No marginBottom needed as it's on the same line
  },
  fieldInput: {
    flex: 1, 
    fontSize: 16,
    marginLeft: 8, 
    // paddingVertical can be removed or minimized as fieldRow handles vertical padding
  },
  inputHelper: {
    fontSize: 12,
    // marginTop: 6, 
  },
  actionButton: { 
    marginTop: 20,
    paddingVertical: 14, 
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  signOutSectionContainer: { 
    // marginTop is handled by space-between in mainContent
    // marginBottom: 16, 
  },
  signOutButton: {
  }
});

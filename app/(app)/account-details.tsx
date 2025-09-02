import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TextInput, Alert, ActivityIndicator, TouchableOpacity, Platform, SafeAreaView, Modal } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight, User, Mail, Phone, LogOut, Trash2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { supabase } from '@/config/supabase'; 
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { SettingsListItem } from '@/components/ui/SettingsListItem';

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 90, 
  },
  sectionContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.0,
    elevation: 3,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14, 
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  input: {
    fontSize: 16,
    textAlign: 'right',
    flex: 1,
  },
  inputHelper: {
    fontSize: 12,
    paddingHorizontal:16,
    paddingBottom: 8,
    paddingTop: 4, 
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionButton: {
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  signOutText: {
    fontSize: 16,
  },
  deleteAccountText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    padding: 20,
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  }
});

export default function AccountDetailsScreen() {
  const router = useRouter();
  const { user, signOut, session } = useSupabase(); 
  const { theme } = useTheme(); 
  const { setIsTabBarVisible } = useTabBarVisibility();

  const styles = useMemo(() => {
    const baseStyles = getStyles(theme);
    return {
      ...baseStyles,
      container: {
        ...baseStyles.container,
        backgroundColor: theme.background,
      },
      sectionContainer: {
        ...baseStyles.sectionContainer,
        backgroundColor: theme.card,
      },
      inputRow: {
        ...baseStyles.inputRow,
        borderBottomColor: theme.border,
      },
      label: {
        ...baseStyles.label,
        color: theme.foreground,
      },
      input: {
        ...baseStyles.input,
        color: theme.foreground,
      },
      inputHelper: {
        ...baseStyles.inputHelper,
        color: theme.mutedForeground,
        backgroundColor: theme.card, 
      },
      stickyButtonContainer: {
        ...baseStyles.stickyButtonContainer,
        backgroundColor: theme.background, 
        borderTopColor: theme.border,
      },
      actionButton: {
        ...baseStyles.actionButton,
        backgroundColor: theme.primary, 
      },
      actionButtonText: {
        ...baseStyles.actionButtonText,
        color: theme.primaryForeground,
      },
      signOutText: {
        ...baseStyles.signOutText,
        color: theme.destructive, 
      },
      deleteAccountText: {
        ...baseStyles.deleteAccountText,
        color: theme.destructive,
      },
      modalOverlay: baseStyles.modalOverlay,
      modalContent: {
        ...baseStyles.modalContent,
        backgroundColor: theme.card,
      },
      modalTitle: {
        ...baseStyles.modalTitle,
        color: theme.foreground,
      },
      modalInput: {
        ...baseStyles.modalInput,
        borderColor: theme.border,
        color: theme.foreground,
        backgroundColor: theme.background,
      },
      modalButtons: baseStyles.modalButtons,
      modalButton: baseStyles.modalButton,
      modalButtonText: baseStyles.modalButtonText,
    };
  }, [theme]);

  useFocusEffect(
    useCallback(() => {
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
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

    if (trimmedPhone !== (user.phone || '')) {
        newPhoneNumber = trimmedPhone; 
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
        if (newPhoneNumber !== undefined) { 
            updatePayload.phone = newPhoneNumber; 
        }

        const { data: updateData, error: updateError } = await supabase.auth.updateUser(updatePayload);

        if (updateError) {
            console.error('Error updating user:', updateError.message);
            Alert.alert('Error', updateError.message || 'Failed to update profile.');
        } else {
            Alert.alert('Success', 'Profile updated successfully.');
        }
    } catch (e: any) {
        console.error('Exception updating user:', e);
        Alert.alert('Error', e.message || 'An unexpected error occurred.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Sign Out Error', error.message);
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setShowDeleteModal(true);
            setDeleteConfirmText('');
          }
        }
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Incorrect', 'Please type DELETE exactly to confirm.');
      return;
    }
    
    setIsDeletingAccount(true);
    setShowDeleteModal(false);
    
    try {
      // Try the edge function first
      const { error } = await supabase.functions.invoke('delete-user-account', {
        body: { 
          userId: user?.id,
          confirmation: 'DELETE'
        }
      });
      
      if (error) {
        console.log('Edge function failed, trying manual deletion:', error);
        
        // Fallback: Delete user data manually and sign out
        try {
          // Delete from core tables manually
          const tables = ['invoices', 'estimates', 'clients'];
          for (const table of tables) {
            await supabase.from(table).delete().eq('user_id', user?.id);
          }
          // Delete profile
          await supabase.from('profiles').delete().eq('id', user?.id);
        } catch (manualError) {
          console.error('Manual deletion also failed:', manualError);
        }
        
        // Always sign out the user even if data deletion fails
        await signOut();
        
        Alert.alert(
          'Account Deletion Initiated', 
          'Your account has been signed out. Some data deletion may be processed in the background. If you have concerns, please contact support.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      Alert.alert(
        'Account Deleted', 
        'Your account has been successfully deleted.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await signOut();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Delete account error:', error);
      
      // As a last resort, just sign the user out
      try {
        await signOut();
        Alert.alert(
          'Account Signed Out', 
          'There was an issue with account deletion, but you have been signed out. Please contact support at support@getsuperinvoice.com if you need assistance.',
          [{ text: 'OK' }]
        );
      } catch (signOutError) {
        Alert.alert(
          'Error', 
          'Failed to delete account or sign out. Please contact support at support@getsuperinvoice.com',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const headerLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: Platform.OS === 'ios' ? 16 : 0 }}>
      <ChevronLeft size={24} color={theme.foreground} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Account Details',
          headerShown: true,
          animation: 'slide_from_right',
          headerStyle: {
            backgroundColor: theme.background, 
          },
          headerTintColor: theme.foreground,
          headerTitleStyle: {
            fontFamily: 'Roboto-Medium',
          },
          headerLeft: headerLeft,
          headerShadowVisible: false,
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.sectionContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your Name"
              placeholderTextColor={theme.mutedForeground}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.inputRow}>
            <Text style={styles.label}>Email</Text>
            <TextInput 
              style={styles.input}
              value={email}
              placeholder="your@email.com"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={false} 
            />
          </View>
          <Text style={styles.inputHelper}>Email changes require separate verification.</Text>

          <View style={[styles.inputRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Mobile</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g., +12223334444"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoComplete='tel'
            />
          </View>
        </View>

        <View style={styles.sectionContainer}>
            <SettingsListItem 
                label="Sign Out"
                labelStyle={styles.signOutText} 
                onPress={handleSignOut}
                disabled={isSigningOut}
                icon={<LogOut size={20} color={theme.destructive} />}
                rightContent={isSigningOut ? <ActivityIndicator color={theme.destructive} size="small" /> : <ChevronRight size={20} color={theme.mutedForeground} /> } 
            />
            <View style={{ borderBottomWidth: 0 }}>
              <SettingsListItem 
                  label="Delete Account"
                  labelStyle={styles.deleteAccountText} 
                  onPress={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  icon={<Trash2 size={20} color={theme.destructive} />}
                  rightContent={isDeletingAccount ? <ActivityIndicator color={theme.destructive} size="small" /> : <ChevronRight size={20} color={theme.mutedForeground} /> } 
              />
            </View>
        </View>
      </ScrollView>

      <View style={styles.stickyButtonContainer}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={handleSaveChanges} 
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.primaryForeground} size="small" /> 
          ) : (
            <Text style={styles.actionButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Delete Account Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Account Deletion</Text>
            <Text style={{ color: theme.foreground, marginBottom: 16, textAlign: 'center' }}>
              Type DELETE to permanently delete your account:
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE here"
              placeholderTextColor={theme.mutedForeground}
              autoCapitalize="none"
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.muted }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
              >
                <Text style={[styles.modalButtonText, { color: theme.foreground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: theme.destructive }]}
                onPress={confirmDeleteAccount}
              >
                <Text style={[styles.modalButtonText, { color: theme.destructiveForeground }]}>Delete Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

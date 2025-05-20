import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/context/theme-provider';
import { useSupabase } from '@/context/supabase-provider';
import { Text } from '@/components/ui/text';
import { ChevronLeft, UploadCloud } from 'lucide-react-native';

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 100, // Space for the sticky button
  },
  sectionContainer: {
    backgroundColor: theme.card,
    borderRadius: 10,
    marginBottom: 20,
    // Shadow properties for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    // Elevation for Android
    elevation: 3,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  lastInputRow: {
    borderBottomWidth: 0,
  },
  label: {
    fontSize: 16,
    color: theme.foreground,
    fontWeight: 'bold',
    marginRight: 8,
    flexShrink: 1,
  },
  input: {
    fontSize: 16,
    color: theme.foreground,
    textAlign: 'right',
    flex: 1,
  },
  multilineInputContainer: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  multilineInput: {
    fontSize: 16,
    color: theme.foreground,
    textAlignVertical: 'top', // for Android
    minHeight: 80,
  },
  logoPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  logoImagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: theme.muted,
  },
  logoPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 16,
    backgroundColor: theme.muted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPickerTextContainer: {
    flex: 1,
  },
  logoPickerLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.foreground,
  },
  logoPickerSubtext: {
    fontSize: 12,
    color: theme.mutedForeground,
  },
  stickyButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16, // Adjust for home indicator
    backgroundColor: theme.background, // Or theme.card if preferred on a card-like bg
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  saveButtonText: {
    color: theme.primaryForeground, // Assuming white or light text on primary color
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10, 
    paddingTop: Platform.OS === 'ios' ? 50 : 40, 
    paddingBottom: 10, 
  },
  headerTitle: {
    fontSize: 20, 
    fontWeight: 'bold', 
    marginLeft: 10, // Spacing between icon and title
  },
});

export default function BusinessInformationScreen() {
  const router = useRouter();
  const { theme, isLightMode } = useTheme();
  const styles = getStyles(theme);
  const { supabase, user } = useSupabase();
  const navigation = useNavigation();

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null); // To store the ID of the existing settings record

  const fetchBusinessInfo = useCallback(async () => {
    if (!user || !supabase) return;
    setInitialLoading(true);
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle to not error if no row exists

      if (error && error.code !== 'PGRST116') { // PGRST116: no rows found, which is fine
        throw error;
      }

      if (data) {
        setSettingsId(data.id);
        setBusinessName(data.business_name || '');
        setBusinessAddress(data.business_address || '');
        setBusinessEmail(data.business_email || '');
        setPhoneNumber(data.business_phone || '');
        setWebsite(data.business_website || '');
        setLogoUri(data.business_logo_url || null);
      }
    } catch (error) {
      console.error('Error fetching business info:', error);
      Alert.alert('Error', 'Could not fetch business information.');
    } finally {
      setInitialLoading(false);
    }
  }, [user, supabase]);

  // Fetch data when the screen comes into focus and when user/supabase changes
  useFocusEffect(
    useCallback(() => {
      fetchBusinessInfo();
    }, [fetchBusinessInfo])
  );

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Reverted to original due to lint error
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const handleSaveChanges = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save settings.');
      return;
    }
    setLoading(true);
    console.log('handleSaveChanges: Starting. Current settingsId:', settingsId);

    try {
      let publicLogoUrl = logoUri; // Assume it might be an existing URL or null
      console.log('handleSaveChanges: Initial publicLogoUrl:', publicLogoUrl);

      if (logoUri && logoUri.startsWith('file://')) { // A new logo was picked
        console.log('handleSaveChanges: New logo picked, URI:', logoUri);
        const fileExt = logoUri.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;
        console.log('handleSaveChanges: Uploading logo with filePath:', filePath);

        const response = await fetch(logoUri);
        const blob = await response.blob();

        console.log('handleSaveChanges: Extracted fileExt:', fileExt);
        console.log('handleSaveChanges: Blob details - Size:', blob.size, 'Type:', blob.type);

        // Create FormData and append the blob
        const formData = new FormData();
        formData.append('file', blob, fileName); // Use 'file' as key, pass fileName

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('businesslogos')
          .upload(filePath, formData, { // Pass formData instead of blob directly
            // contentType removed as FormData handles its own, and blob has a type
            upsert: true,
          });
        
        console.log('handleSaveChanges: Logo uploadData:', uploadData);
        console.log('handleSaveChanges: Logo uploadError:', uploadError);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('businesslogos')
          .getPublicUrl(filePath);
        
        publicLogoUrl = urlData.publicUrl;
        console.log('handleSaveChanges: New publicLogoUrl after upload:', publicLogoUrl);
      }

      const updates = {
        user_id: user.id,
        business_name: businessName,
        business_address: businessAddress,
        business_email: businessEmail,
        business_phone: phoneNumber,
        business_website: website,
        business_logo_url: publicLogoUrl,
        updated_at: new Date().toISOString(),
      };
      console.log('handleSaveChanges: updates object:', JSON.stringify(updates, null, 2));
      
      let responseError = null;
      let responseData = null;

      if (settingsId) {
        console.log('handleSaveChanges: Attempting to UPDATE existing settings with ID:', settingsId);
        const { data, error } = await supabase
          .from('business_settings')
          .update(updates)
          .eq('id', settingsId)
          .select()
          .single();
        responseData = data;
        responseError = error;
        console.log('handleSaveChanges: UPDATE responseData:', responseData);
        console.log('handleSaveChanges: UPDATE responseError:', responseError);
      } else {
        console.log('handleSaveChanges: Attempting to INSERT new settings.');
        console.log('handleSaveChanges: Data for INSERT:', JSON.stringify(updates, null, 2));
        
        const { data, error } = await supabase
          .from('business_settings')
          .insert(updates)
          .select()
          .single();
        responseData = data;
        responseError = error;
        console.log('handleSaveChanges: INSERT responseData:', responseData);
        console.log('handleSaveChanges: INSERT responseError:', responseError);
      }

      if (responseError) {
        console.error('handleSaveChanges: Error from Supabase operation:', responseError);
        throw responseError;
      }

      Alert.alert('Success', 'Business information saved successfully!');
      console.log('handleSaveChanges: Save successful alert shown.');

      if (responseData) {
        console.log('handleSaveChanges: Updating settingsId from responseData.id:', responseData.id);
        setSettingsId(responseData.id);
      } else {
        console.log('handleSaveChanges: responseData was null or undefined after save operation.');
      }

    } catch (error: any) {
      console.error('handleSaveChanges: Error caught in try-catch block:', JSON.stringify(error, null, 2));
      Alert.alert('Error', error.message || 'Failed to save business information.');
    } finally {
      setLoading(false);
      console.log('handleSaveChanges: Finished.');
    }
  };

  // Header configuration
  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <View style={[styles.headerContainer, { backgroundColor: theme.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border}]}>
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 6 }}>
            <ChevronLeft size={26} color={theme.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.foreground}]}>Business Information</Text>
        </View>
      ),
      headerShown: true, // Ensure header is shown
    });
  }, [navigation, router, theme, styles]);

  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.sectionContainer}>
          {/* Logo Picker */}
          <TouchableOpacity onPress={handleImagePick} style={styles.logoPickerRow}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImagePreview} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <UploadCloud size={24} color={theme.mutedForeground} />
              </View>
            )}
            <View style={styles.logoPickerTextContainer}>
              <Text style={styles.logoPickerLabel}>Business Logo</Text>
              <Text style={styles.logoPickerSubtext}>Tap to upload or change logo</Text>
            </View>
            {/* Optional: Add a small icon like ChevronRight here if desired */}
          </TouchableOpacity>

          {/* Business Name */}
          <View style={styles.inputRow}>
            <Text style={styles.label}>Business Name</Text>
            <TextInput
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
              placeholder="Enter business name"
              placeholderTextColor={theme.mutedForeground}
            />
          </View>

          {/* Business Address - Multiline */}
          <View style={[styles.multilineInputContainer, styles.inputRow, {flexDirection: 'column', alignItems: 'flex-start'}]}>
            <Text style={[styles.label, {marginBottom: 8}]}>Business Address</Text>
            <TextInput
              style={[styles.multilineInput, { width: '100%'}] } // Ensure it takes full width
              value={businessAddress}
              onChangeText={setBusinessAddress}
              placeholder="Enter full business address"
              placeholderTextColor={theme.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Business Email */}
          <View style={styles.inputRow}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={businessEmail}
              onChangeText={setBusinessEmail}
              placeholder="Enter contact email"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Phone Number */}
          <View style={styles.inputRow}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="Enter phone number"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>

          {/* Website/Social Link */}
          <View style={[styles.inputRow, styles.lastInputRow]}>
            <Text style={styles.label}>Website/Social</Text>
            <TextInput
              style={styles.input}
              value={website}
              onChangeText={setWebsite}
              placeholder="e.g., yoursite.com"
              placeholderTextColor={theme.mutedForeground}
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </View>

      </ScrollView>

      {/* Sticky Save Button */}
      <View style={styles.stickyButtonContainer}>
        <TouchableOpacity onPress={handleSaveChanges} style={styles.saveButton} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={theme.primaryForeground} />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

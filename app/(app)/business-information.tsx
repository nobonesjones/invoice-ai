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
import * as FileSystem from 'expo-file-system';

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
  const { supabase, session } = useSupabase();
  const navigation = useNavigation();

  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [publicLogoUrl, setPublicLogoUrl] = useState<string | null>(null); 
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null); 

  console.log('BusinessInformationScreen rendering with logoUri:', logoUri);

  const fetchBusinessInfo = useCallback(async (): Promise<void> => {
    if (!session || !supabase) return;
    setInitialLoading(true);
    
    console.log('[BusinessInfo] 🚨 FETCH DEBUG - Start');
    console.log('[BusinessInfo] Session user ID:', session.user.id);
    console.log('[BusinessInfo] Session user email:', session.user.email);
    
    try {
      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      console.log('[BusinessInfo] 🔍 QUERY RESULT:');
      console.log('  - Data found:', !!data);
      console.log('  - Business name:', data?.business_name);
      console.log('  - Logo URL:', data?.business_logo_url);
      console.log('  - Data user_id:', data?.user_id); 

      if (error && error.code !== 'PGRST116') { 
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
  }, [session, supabase]);

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
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7, // Reduced quality for faster upload
      compress: 0.7, // Add compression
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const handleSaveChanges = async () => {
    if (!session) {
      Alert.alert('Error', 'You must be logged in to save settings.');
      return;
    }
    setLoading(true);
    console.log('handleSaveChanges: Starting. Current settingsId:', settingsId);

    try {
      let publicLogoUrl = logoUri; 
      console.log('handleSaveChanges: Initial publicLogoUrl:', publicLogoUrl);

            if (logoUri && logoUri.startsWith('file://')) { 
        console.log('handleSaveChanges: New logo picked, uploading directly to storage. URI:', logoUri);
        const localUri = logoUri;
        const filename = localUri.split('/').pop() || `logo-${Date.now()}`;
        let fileType = 'image/jpeg';
        if (filename.endsWith('.png')) {
          fileType = 'image/png';
        } else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) {
          fileType = 'image/jpeg';
        }

        try {
          // Read file as base64 for edge function upload
          const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          if (!base64 || base64.length === 0) {
            throw new Error('Selected file is empty or could not be read.');
          }

          console.log('handleSaveChanges: Calling optimized Edge Function upload-logo');
          const supabaseUrl = process.env.EXPO_PUBLIC_API_URL;
          const apiKey = process.env.EXPO_PUBLIC_ANON_KEY;
          
          if (!supabaseUrl || !apiKey) {
            throw new Error('Missing Supabase configuration. Please check your environment variables.');
          }
          
          const edgeFunctionUrl = `${supabaseUrl}/functions/v1/upload-logo`;
          const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
              'apikey': apiKey,
            },
            body: JSON.stringify({
              fileName: filename,
              fileType: fileType,
              base64: base64,
            }),
          });

          const result = await response.json();
          console.log('handleSaveChanges: Edge Function response:', result);

          if (!response.ok) {
            console.error('handleSaveChanges: Edge Function HTTP error:', response.status, response.statusText);
            throw new Error(`Upload failed with status ${response.status}: ${result.error || 'Unknown error'}`);
          }

          if (result.error) {
            console.error('handleSaveChanges: Edge Function returned error:', result.error);
            throw new Error(result.error);
          }

          if (!result.url || !result.url.startsWith('https://')) {
            console.error('handleSaveChanges: Invalid URL returned from Edge Function:', result.url);
            throw new Error('Invalid URL returned from upload service.');
          }

          publicLogoUrl = result.url;
          console.log('handleSaveChanges: Edge Function upload successful, URL:', publicLogoUrl);
        } catch (uploadError: any) {
          console.error('handleSaveChanges: Logo upload failed:', uploadError);
          Alert.alert(
            'Upload Failed', 
            `Failed to upload logo: ${uploadError.message || 'Unknown error'}. Please try again or select a different image.`
          );
          setLoading(false);
          return;
        }
      }

      // Validate that we're not saving a local file URI
      if (publicLogoUrl && publicLogoUrl.startsWith('file://')) {
        console.error('handleSaveChanges: Attempted to save local file URI to database:', publicLogoUrl);
        Alert.alert('Error', 'Cannot save local file path. Please try uploading the logo again.');
        setLoading(false);
        return;
      }

      const updates = {
        user_id: session.user.id,
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

      if (responseData) {
        console.log('handleSaveChanges: Full responseData from DB:', JSON.stringify(responseData, null, 2));
        console.log('handleSaveChanges: Attempting to set logoUri from responseData.business_logo_url:', responseData.business_logo_url);
        // setCurrentSettings(responseData); 
        // Update logoUri for preview from the successfully saved data
        setLogoUri(responseData.business_logo_url || null); 
                                        
        Alert.alert('Success', 'Business information saved successfully!');
        setSettingsId(responseData.id); 
        console.log('handleSaveChanges: Updating settingsId from responseData.id:', responseData.id);
      }

    } catch (error: any) {
      console.error('handleSaveChanges: Error caught in try-catch block:', error, JSON.stringify(error, null, 2));
      Alert.alert('Error', error?.message || 'Failed to save business information.');
    } finally {
      setLoading(false);
      console.log('handleSaveChanges: Finished.');
    }
  };

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
      headerShown: true, 
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
          <TouchableOpacity onPress={handleImagePick} style={styles.logoPickerRow}>
            {logoUri ? (
              <Image
                source={{ uri: logoUri.startsWith('http') ? `${logoUri}?t=${Date.now()}` : logoUri }}
                style={styles.logoImagePreview} 
                onLoadStart={() => {
                  console.log('[ImageComponent] Load STARTING for URI:', logoUri);
                }}
                onLoad={(event) => {
                  console.log('[ImageComponent] Load SUCCESS for URI:', logoUri);
                }}
                onError={(error) => {
                  console.error('[ImageComponent] Load FAILED for URI:', logoUri, 'Error:', error.nativeEvent.error);
                  // Reset logoUri on error to show placeholder
                  setLogoUri(null);
                }}
              />
            ) : (
              <View style={styles.logoPlaceholder}>
                <UploadCloud size={24} color={theme.mutedForeground} />
              </View>
            )}
            <View style={styles.logoPickerTextContainer}>
              <Text style={styles.logoPickerLabel}>Business Logo</Text>
              <Text style={styles.logoPickerSubtext}>
                {logoUri && logoUri.startsWith('file://') 
                  ? 'Tap to save uploaded logo' 
                  : 'Tap to upload or change logo'
                }
              </Text>
            </View>
          </TouchableOpacity>

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

          <View style={[styles.multilineInputContainer, styles.inputRow, {flexDirection: 'column', alignItems: 'flex-start'}]}>
            <Text style={[styles.label, {marginBottom: 8}]}>Business Address</Text>
            <TextInput
              style={[styles.multilineInput, { width: '100%'}] } 
              value={businessAddress}
              onChangeText={setBusinessAddress}
              placeholder="Enter full business address"
              placeholderTextColor={theme.mutedForeground}
              multiline
              numberOfLines={3}
            />
          </View>

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

      <View style={styles.stickyButtonContainer}>
        <TouchableOpacity onPress={handleSaveChanges} style={styles.saveButton} disabled={loading}>
          {loading ? (
            <>
              <ActivityIndicator color={theme.primaryForeground} />
              <Text style={[styles.saveButtonText, { marginLeft: 8 }]}>
                {logoUri && logoUri.startsWith('file://') ? 'Uploading...' : 'Saving...'}
              </Text>
            </>
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

import React, { useMemo, useCallback, useState, useEffect, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  ScrollView, 
  Keyboard,
  ActivityIndicator, 
  Alert,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { X, PlusCircle } from 'lucide-react-native'; 
import { useTheme } from '@/context/theme-provider';
import { colors } from '@/constants/colors';
import { supabase } from '@/lib/supabase'; 

export interface Client { 
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  user_id: string; 
}

interface CreateNewClientSheetProps {
  onClose?: () => void;
  onClientAdded?: () => void; 
}

const CreateNewClientSheet = forwardRef<
  BottomSheetModal,
  CreateNewClientSheetProps
>(({ onClose, onClientAdded }, ref) => {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? colors.light : colors.dark;
  const styles = getStyles(themeColors, isLightMode);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(false); 

  const snapPoints = useMemo(() => ['65%', '98%'], []); 

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        (ref as React.RefObject<BottomSheetModal>)?.current?.snapToIndex(1); 
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        (ref as React.RefObject<BottomSheetModal>)?.current?.snapToIndex(0); 
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [ref]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        outputRange={['0', '0.5']}
      />
    ),
    []
  );

  const handleSaveClient = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Full Name is required.');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        Alert.alert('Error', 'Could not get user information. Please try again.');
        console.error('User fetch error:', userError?.message);
        setIsLoading(false);
        return;
      }

      const clientData = {
        name: fullName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        user_id: user.id,
      };

      const { error: insertError } = await supabase
        .from('clients')
        .insert([clientData]);

      if (insertError) {
        Alert.alert('Error', 'Could not save client. Please try again.');
        console.error('Client insert error:', insertError.message);
      } else {
        Alert.alert('Success', 'Client saved successfully!');
        setFullName('');
        setEmail('');
        setPhone('');
        if (onClientAdded) {
          onClientAdded();
        }
        (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss();
      }
    } catch (error: any) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      console.error('Unexpected save error:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFromContacts = () => {
    console.log('Add from contacts pressed');
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.title}>Add New Client</Text>
      <TouchableOpacity onPress={() => (ref as React.RefObject<BottomSheetModal>)?.current?.dismiss()} style={styles.closeButton} disabled={isLoading}>
        <X size={24} color={themeColors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );
  
  return (
    <BottomSheetModal
      ref={ref}
      index={0} 
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
      handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
      backgroundStyle={{ backgroundColor: themeColors.card }}
      enablePanDownToClose={!isLoading} 
      keyboardBehavior="interactive" 
      keyboardBlurBehavior="restore"
    >
      {renderHeader()}
      <BottomSheetView style={styles.bottomSheetContentContainer}> 
        <TouchableOpacity style={styles.addFromContactsButton} onPress={handleAddFromContacts} disabled={isLoading}>
          <PlusCircle size={20} color={isLightMode ? '#28A745' : themeColors.primary} style={styles.addFromContactsIcon} />
          <Text style={styles.addFromContactsText}>+ Add From Contacts</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"} 
          style={styles.keyboardAvoidingContainer} 
          keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0} 
        >
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name <Text style={styles.requiredAsterisk}>*</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John Doe"
                placeholderTextColor={themeColors.mutedForeground} 
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. john.doe@example.com"
                placeholderTextColor={themeColors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. (555) 123-4567"
                placeholderTextColor={themeColors.mutedForeground}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSaveClient} disabled={isLoading}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonText}>Save Client</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const getStyles = (themeColors: any, isLightMode: boolean) => StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 10 : 10,
    paddingBottom: 12, 
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 21, 
    fontWeight: '600', 
    color: themeColors.foreground,
  },
  closeButton: {
    padding: 6, 
  },
  bottomSheetContentContainer: { 
    flex: 1,
    paddingHorizontal: 24, 
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContentContainer: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 30, 
  },
  addFromContactsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: isLightMode ? '#E8F5E9' : themeColors.cardHighlight, 
    alignSelf: 'center',
    marginBottom: 20, 
    marginTop: 0, 
  },
  addFromContactsIcon: {
    marginRight: 6,
  },
  addFromContactsText: {
    fontSize: 14,
    fontWeight: '500',
    color: isLightMode ? '#28A745' : themeColors.primary, 
  },
  inputGroup: {
    marginBottom: 16, 
  },
  label: {
    fontSize: 14, 
    color: themeColors.foreground,
    marginBottom: 8, 
    fontWeight: '500',
  },
  requiredAsterisk: {
    color: themeColors.destructive, 
  },
  input: {
    backgroundColor: isLightMode ? '#F0F0F0' : colors.dark.input, 
    color: themeColors.foreground,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11, 
    borderRadius: 8, 
    fontSize: 15, 
  },
  saveButton: {
    backgroundColor: '#28A745', 
    paddingVertical: 15, 
    borderRadius: 8, 
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20, 
  },
  saveButtonDisabled: {
    backgroundColor: '#A5D6A7', 
  },
  saveButtonText: {
    color: '#FFFFFF', 
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateNewClientSheet;

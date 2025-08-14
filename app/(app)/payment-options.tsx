import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Switch,
  Linking,
  ActivityIndicator,
  Alert,
  Keyboard,
  Image,
  TextInput as RNTextInput,
  useColorScheme,
  KeyboardAvoidingView, // Added
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import {
  ChevronLeft,
  CreditCard,
  DollarSign,
  Info,
  Settings,
  X as XIcon,
  PayPal, // Corrected from Paypal
  Landmark,
  CheckCircle,
} from 'lucide-react-native';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/context/theme-provider';
import { SettingsListItem } from '@/components/ui/SettingsListItem';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { supabase } from '@/lib/supabase';
import { useSupabase } from '@/context/supabase-provider';

interface PaymentOption {
  id?: string;
  user_id: string;
  paypal_enabled: boolean;
  paypal_email: string | null;
  stripe_enabled: boolean;
  bank_transfer_enabled: boolean;
  bank_details: string | null;
  invoice_terms_notes?: string | null;
}

const getStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContentContainer: {
      paddingHorizontal: 16,
      paddingTop: 0,
      paddingBottom: 30,
      marginBottom: 20, // Add some padding at the bottom of scroll content
    },
    sectionCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 8,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: theme.isLightMode ? 3 : 4,
      overflow: Platform.OS === 'android' ? 'hidden' : 'visible',
    },
    modalInnerContent: {
      padding: 16,
    },
    toggleCard: {
      marginBottom: 20,
      paddingVertical: 0,
    },
    emailInputCard: {
      marginBottom: 20,
    },
    multilineInputStyle: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 8,
      fontSize: 16,
      color: theme.foreground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      textAlignVertical: 'top',
      minHeight: 100,
      marginBottom: 10,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.foreground,
      marginBottom: 8,
    },
    emailInputStyle: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      fontSize: 16,
      color: theme.foreground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.mutedForeground,
      textTransform: 'uppercase',
      marginTop: 0,
      marginBottom: 16,
      marginLeft: 16,
    },
    itemLabel: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.foreground,
    },
    itemSubtitle: {
      fontSize: 14,
      color: theme.mutedForeground,
      marginTop: 2,
    },
    statusText: {
      fontSize: 14,
      color: theme.mutedForeground,
    },
    helperTextContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.card,
      borderRadius: 10,
      marginBottom: 8,
    },
    helperText: {
      fontSize: 14,
      color: theme.mutedForeground,
      lineHeight: 20,
    },
    helperSubtext: {
      fontSize: 12,
      color: theme.mutedForeground,
      marginTop: 8,
    },
    headerTitleStyle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    modalContentContainer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 32 : 20,
      backgroundColor: theme.card,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 16,
      paddingHorizontal: 16,
      position: 'relative',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: theme.foreground,
    },
    closeButton: {
      position: 'absolute',
      right: 16,
      top: '50%',
      transform: [{ translateY: -12 }],
      padding: 4,
    },
    handleIndicator: {
      backgroundColor: theme.mutedForeground,
    },
    modalBackground: {
      backgroundColor: theme.card,
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
      fontWeight: 'bold',
      color: theme.foreground,
      marginRight: 8,
    },
    infoTextContainer: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    infoText: {
      fontSize: 14,
      color: theme.foreground,
      lineHeight: 20,
    },
    subText: {
      fontSize: 12,
      color: theme.mutedForeground,
      marginTop: 4,
    },
    linkText: {
      fontSize: 14,
      color: theme.primary,
      marginTop: 8,
      textDecorationLine: 'underline',
    },
    disabledOverlay: {
      opacity: 0.5,
    },
    saveButtonContainer: {
      marginTop: 16,      // Added for spacing above the button
      marginBottom: Platform.OS === 'ios' ? 0 : 16, // Space below, adjust for keyboard if needed
      // Horizontal padding is handled by modalInnerContent
    },
    saveButton: {
      backgroundColor: theme.primary,
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      // marginHorizontal is not needed here as modalInnerContent provides padding
    },
    saveButtonText: {
      color: theme.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
    },
    // New styles for global save button
    bottomButtonContainer: {
      paddingHorizontal: 16,
      paddingBottom: Platform.OS === 'ios' ? 34 : 16, // For home indicator
      paddingTop: 10,
      backgroundColor: theme.background, // Match screen background
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    globalSaveButton: {
      backgroundColor: theme.primary, // Assuming theme.primary is the desired green
      paddingVertical: 14,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    globalSaveButtonText: {
      color: theme.primaryForeground, // Assuming this is white or a contrasting color for primary bg
      fontSize: 16,
      fontWeight: 'bold',
    },
    listItemIconStyle: {
      width: 24,
      height: 24,
      marginRight: 12,
      resizeMode: 'contain',
    },
    logoRowContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginVertical: 20,
      paddingHorizontal: 10,
    },
    paymentMethodIconStyle: {
      width: 63,
      height: 40,
      resizeMode: 'contain',
      marginHorizontal: 5,
    },
    stripeModalHelperText: {
      fontSize: 14,
      color: theme.mutedForeground,
      textAlign: 'center',
      marginHorizontal: 16,
      marginBottom: 25,
    },
    positiveBulletsContainer: {
      marginTop: 15,
      marginBottom: 20,
      paddingHorizontal: 8,
    },
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    bulletIcon: {
      marginRight: 10,
      marginTop: 2,
    },
    bulletText: {
      fontSize: 15,
      color: theme.foreground,
      flexShrink: 1,
      lineHeight: 20,
    },
    importantStepsContainer: {
      marginTop: 10,
      marginBottom: 25,
      paddingHorizontal: 8,
    },
    importantStepsTitle: {
      fontSize: 17,
      fontWeight: 'bold',
      color: theme.foreground,
      marginBottom: 12,
    },
    importantStepText: {
      fontSize: 15,
      color: theme.foreground,
      marginBottom: 10,
      lineHeight: 22,
    },
    connectButton: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },
    connectButtonText: {
      color: theme.primaryForeground,
      fontSize: 16,
      fontWeight: 'bold',
    },
    moreInfoButton: {
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 20,
    },
    moreInfoButtonText: {
      color: theme.primary,
      fontSize: 15,
      fontWeight: '500',
    },
    disabledButton: { // Added missing style
      backgroundColor: theme.muted, // Or theme.disabled, theme.border, etc.
      opacity: 0.7,
    }
  });

export default function PaymentOptionsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { user, supabase } = useSupabase();

  const paypalBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const stripeBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const bankTransferBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const bankTransferScrollViewRef = useRef<BottomSheetScrollView>(null); // Ref for Bank Transfer scroll view

  const [isPayPalEnabled, setIsPayPalEnabled] = useState(false);
  const [paypalEmail, setPayPalEmail] = useState('');
  const [paymentOptionsId, setPaymentOptionsId] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [settingsChanged, setSettingsChanged] = useState(false);
  const [initialPayPalEnabled, setInitialPayPalEnabled] = useState(false);
  const [initialPayPalEmail, setInitialPayPalEmail] = useState('');
  const [isPayPalActiveOnScreen, setIsPayPalActiveOnScreen] = useState(false);
  const [isLoadingScreenStatus, setIsLoadingScreenStatus] = useState(true);

  const [isStripeEnabled, setIsStripeEnabled] = useState(false);
  const [initialStripeEnabled, setInitialStripeEnabled] = useState(false);
  const [stripeSettingsChanged, setStripeSettingsChanged] = useState(false);
  const [isLoadingStripeSettings, setIsLoadingStripeSettings] = useState(false);
  const [isStripeActiveOnScreen, setIsStripeActiveOnScreen] = useState(false);

  const [isBankTransferEnabled, setIsBankTransferEnabled] = useState(false);
  const [bankDetails, setBankDetails] = useState('');
  const [initialIsBankTransferEnabled, setInitialIsBankTransferEnabled] = useState(false);
  const [initialBankDetails, setInitialBankDetails] = useState('');
  const [bankTransferSettingsChanged, setBankTransferSettingsChanged] = useState(false);
  const [isLoadingBankTransferSettings, setIsLoadingBankTransferSettings] = useState(false);
  const [isBankTransferActiveOnScreen, setIsBankTransferActiveOnScreen] = useState(false);

  const [invoiceTermsNotes, setInvoiceTermsNotes] = useState<string>('');
  const [initialInvoiceTermsNotes, setInitialInvoiceTermsNotes] = useState<string>('');
  const [isLoadingInvoiceTermsNotes, setIsLoadingInvoiceTermsNotes] = useState<boolean>(false);

  const defaultPayPalSnapPoints = useMemo(() => ['50%', '65%'], []);
  const keyboardActivePayPalSnapPoints = useMemo(() => ['75%', '90%'], []); // Taller when keyboard is active
  const [currentPayPalSnapPoints, setCurrentPayPalSnapPoints] = useState(defaultPayPalSnapPoints);

  // State to track if bank transfer modal is the one currently focused for keyboard events
  const [isBankTransferModalFocused, setIsBankTransferModalFocused] = useState(false);

  const paymentIcons = [
    { name: 'Visa', source: require('../../assets/visaicon.png') },
    { name: 'Mastercard', source: require('../../assets/mastercardicon.png') },
    { name: 'AmEx', source: require('../../assets/amexicon.png') },
    { name: 'ApplePay', source: require('../../assets/applepayicon.png') },
    { name: 'GooglePay', source: require('../../assets/googlepayicon.png') },
  ];

  const stripeSnapPoints = useMemo(() => ['90%'], []);
  const bankTransferSnapPoints = useMemo(() => ['60%', '80%'], []);

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        // Handle PayPal modal snap points
        setCurrentPayPalSnapPoints(keyboardActivePayPalSnapPoints);

        // Handle Bank Transfer modal scroll
        if (isBankTransferModalFocused) {
          // Add a slight delay to ensure layout is complete after keyboard is up
          setTimeout(() => {
            bankTransferScrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setCurrentPayPalSnapPoints(defaultPayPalSnapPoints);
        // No specific action needed for bank transfer modal on keyboard hide for now
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [keyboardActivePayPalSnapPoints, defaultPayPalSnapPoints, isPayPalEnabled, isBankTransferModalFocused]);

  const openPayPalModal = useCallback(async () => {
    if (!user) return;
    setIsBankTransferModalFocused(false); // Ensure other modals don't trigger bank scroll
    setIsLoadingSettings(true);
    paypalBottomSheetModalRef.current?.present();

    try {
      const { data, error } = await supabase
        .from('payment_options')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching PayPal settings:', error);
        Alert.alert('Error', 'Could not load your PayPal settings.');
      } else if (data) {
        setIsPayPalEnabled(data.paypal_enabled);
        setPayPalEmail(data.paypal_email || '');
        setPaymentOptionsId(data.id);
        setInitialPayPalEnabled(data.paypal_enabled);
        setInitialPayPalEmail(data.paypal_email || '');
        setSettingsChanged(false);

        if (data.paypal_enabled) {
          paypalBottomSheetModalRef.current?.snapToIndex(1);
        }
      } else {
        setIsPayPalEnabled(false);
        setPayPalEmail('');
        setPaymentOptionsId(null);
        setInitialPayPalEnabled(false);
        setInitialPayPalEmail('');
        setSettingsChanged(false);
      }
    } catch (err) {
      console.error('Unexpected error fetching PayPal settings:', err);
      Alert.alert('Error', 'An unexpected error occurred while loading settings.');
    } finally {
      setIsLoadingSettings(false);
    }
  }, [user]);

  const closePayPalModal = useCallback(() => {
    paypalBottomSheetModalRef.current?.dismiss();
  }, []);

  const handlePayPalToggle = (newValue: boolean) => {
    setIsPayPalEnabled(newValue);
    setSettingsChanged(true);
    if (newValue && !paypalEmail) {
      // Optional: Snap to larger size if email becomes relevant
    } else if (!newValue) {
      // Optional: Snap to smaller if email is hidden
    }
  };

  const handleEmailChange = (text: string) => {
    setPayPalEmail(text);
    setSettingsChanged(true);
  };

  const handleSavePayPalEmail = async () => {
    Keyboard.dismiss();
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save settings.');
      return;
    }
    if (!settingsChanged) {
      Alert.alert('Info', 'No changes to save.');
      closePayPalModal();
      return;
    }
    setIsLoadingSettings(true);
    const optionsToSave: Partial<PaymentOption> & { user_id: string } = {
      user_id: user.id,
      paypal_enabled: isPayPalEnabled,
      paypal_email: isPayPalEnabled ? paypalEmail : null,
    };
    try {
      const { error } = await supabase.from('payment_options').upsert(
        paymentOptionsId ? { ...optionsToSave, id: paymentOptionsId } : optionsToSave,
        { onConflict: 'user_id' }
      ).select('id').single();

      if (error) throw error;

      Alert.alert('Success', 'PayPal settings saved!', [
        { text: 'OK', onPress: () => closePayPalModal() },
      ]);
      setSettingsChanged(false);
      setInitialPayPalEnabled(isPayPalEnabled);
      setInitialPayPalEmail(paypalEmail);
      setIsPayPalActiveOnScreen(isPayPalEnabled);
      if (!paymentOptionsId && !error) {
        const { data: newData } = await supabase.from('payment_options').select('id').eq('user_id', user.id).maybeSingle();
        if (newData) setPaymentOptionsId(newData.id);
      }
    } catch (error: any) {
      console.error('Error saving PayPal settings:', error);
      Alert.alert('Error', 'Could not save your PayPal settings. Please try again.');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const openStripeModal = useCallback(async () => {
    if (!user) return;
    Keyboard.dismiss();
    setIsLoadingStripeSettings(true);
    stripeBottomSheetModalRef.current?.present();

    try {
      const { data, error } = await supabase
        .from('payment_options')
        .select('stripe_enabled, id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching Stripe settings:', error);
        Alert.alert('Error', 'Could not load your Stripe settings.');
      } else if (data) {
        setIsStripeEnabled(data.stripe_enabled);
        setInitialStripeEnabled(data.stripe_enabled);
        if (data.id && !paymentOptionsId) setPaymentOptionsId(data.id);
      } else {
        setIsStripeEnabled(false);
        setInitialStripeEnabled(false);
      }
      setStripeSettingsChanged(false);
    } catch (err) {
      console.error('Unexpected error fetching Stripe settings:', err);
      Alert.alert('Error', 'An unexpected error occurred while loading Stripe settings.');
    } finally {
      setIsLoadingStripeSettings(false);
    }
  }, [user, supabase, paymentOptionsId]);

  const closeStripeModal = useCallback(() => {
    stripeBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleStripeToggle = (newValue: boolean) => {
    setIsStripeEnabled(newValue);
    setStripeSettingsChanged(true);
  };

  const handleSaveStripeSettings = async () => {
    Keyboard.dismiss();
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save settings.');
      return;
    }
    if (!stripeSettingsChanged) {
      Alert.alert('Info', 'No changes to save.');
      closeStripeModal();
      return;
    }
    setIsLoadingStripeSettings(true);
    const updateData: Partial<PaymentOption> & { user_id: string } = {
      user_id: user.id,
      stripe_enabled: isStripeEnabled,
    };
    try {
      const { error } = await supabase.from('payment_options').upsert(
        paymentOptionsId ? { ...updateData, id: paymentOptionsId } : updateData,
        { onConflict: 'user_id' }
      ).select('id').single();

      if (error) throw error;

      Alert.alert('Success', 'Stripe settings saved!', [
        { text: 'OK', onPress: () => closeStripeModal() },
      ]);
      setStripeSettingsChanged(false);
      setInitialStripeEnabled(isStripeEnabled);
      setIsStripeActiveOnScreen(isStripeEnabled);
      if (!paymentOptionsId && !error) {
        const { data: newData } = await supabase.from('payment_options').select('id').eq('user_id', user.id).maybeSingle();
        if (newData) setPaymentOptionsId(newData.id);
      }
    } catch (error: any) {
      console.error('Error saving Stripe settings:', error);
      Alert.alert('Error', 'Could not save your Stripe settings. Please try again.');
    } finally {
      setIsLoadingStripeSettings(false);
    }
  };

  const openBankTransferModal = useCallback(async () => {
    if (!user) return;
    setIsBankTransferModalFocused(true); // Set focus for keyboard listener
    setIsLoadingBankTransferSettings(true);
    bankTransferBottomSheetModalRef.current?.present();

    try {
      const { data, error } = await supabase
        .from('payment_options')
        .select('bank_transfer_enabled, bank_details, id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching Bank Transfer settings:', error);
        Alert.alert('Error', 'Could not load your Bank Transfer settings.');
      } else if (data) {
        setIsBankTransferEnabled(data.bank_transfer_enabled);
        setBankDetails(data.bank_details || '');
        setInitialIsBankTransferEnabled(data.bank_transfer_enabled);
        setInitialBankDetails(data.bank_details || '');
        if (data.id && !paymentOptionsId) setPaymentOptionsId(data.id);
      } else {
        setIsBankTransferEnabled(false);
        setBankDetails('');
        setInitialIsBankTransferEnabled(false);
        setInitialBankDetails('');
      }
      setBankTransferSettingsChanged(false);
    } catch (error: any) {
      console.error('Error fetching Bank Transfer settings:', error);
      Alert.alert('Error', 'Could not load your Bank Transfer settings.');
    } finally {
      setIsLoadingBankTransferSettings(false);
    }
  }, [user, supabase, paymentOptionsId]);

  const closeBankTransferModal = useCallback(() => {
    bankTransferBottomSheetModalRef.current?.dismiss();
    setIsBankTransferModalFocused(false); // Clear focus
  }, []);

  const handleBankTransferToggle = (newValue: boolean) => {
    setIsBankTransferEnabled(newValue);
    setBankTransferSettingsChanged(true);
  };

  const handleBankDetailsChange = (text: string) => {
    setBankDetails(text);
    setBankTransferSettingsChanged(true);
  };

  const handleSaveBankTransferSettings = async () => {
    Keyboard.dismiss();
    if (!user) {
      Alert.alert('Error', 'You must be logged in to save settings.');
      return;
    }
    if (!bankTransferSettingsChanged) {
      Alert.alert('Info', 'No changes to save for Bank Transfers.');
      closeBankTransferModal();
      return;
    }
    setIsLoadingBankTransferSettings(true);
    const updateData: Partial<PaymentOption> & { user_id: string } = {
      user_id: user.id,
      bank_transfer_enabled: isBankTransferEnabled,
      bank_details: isBankTransferEnabled ? bankDetails : null,
    };
    try {
      const { error } = await supabase.from('payment_options').upsert(
        paymentOptionsId ? { ...updateData, id: paymentOptionsId } : updateData,
        { onConflict: 'user_id' }
      ).select('id').single();

      if (error) throw error;

      Alert.alert('Success', 'Bank Transfer settings saved!', [
        { text: 'OK', onPress: () => closeBankTransferModal() },
      ]);
      setBankTransferSettingsChanged(false);
      setInitialIsBankTransferEnabled(isBankTransferEnabled);
      setInitialBankDetails(bankDetails);
      setIsBankTransferActiveOnScreen(isBankTransferEnabled);
      if (!paymentOptionsId && !error) {
        const { data: newData } = await supabase.from('payment_options').select('id').eq('user_id', user.id).maybeSingle();
        if (newData) setPaymentOptionsId(newData.id);
      }
    } catch (error: any) {
      console.error('Error saving Bank Transfer settings:', error);
      Alert.alert('Error', 'Could not save your Bank Transfer settings. Please try again.');
    } finally {
      setIsLoadingBankTransferSettings(false);
    }
  };

  const handleSheetChanges = useCallback((index: number) => {
    console.log('handleSheetChanges', index);
    // setCurrentSnapIndex(index); 
  }, []);

  const openStripeConnectionModal = () => {
    console.log('Attempting to open Stripe Connection Modal...');
    Alert.alert("Connect with Stripe", "This will open the Stripe connection flow. (Not yet implemented)");
  };

  const handleSaveInvoiceTermsNotes = async () => {
    if (!user) {
      Alert.alert('Error', 'User not found. Please try again.');
      return;
    }
    if (isLoadingInvoiceTermsNotes) return;

    Keyboard.dismiss();
    setIsLoadingInvoiceTermsNotes(true);
    // Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const { data: existingData, error: fetchExistingError } = await supabase
        .from('payment_options')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchExistingError && fetchExistingError.code !== 'PGRST116') {
        throw fetchExistingError;
      }

      const upsertData: Partial<PaymentOption> & { user_id: string } = {
        user_id: user.id,
        invoice_terms_notes: invoiceTermsNotes,
      };
      if (existingData?.id) {
        upsertData.id = existingData.id;
      }

      const { data: updateData, error: updateError } = await supabase
        .from('payment_options')
        .upsert(upsertData)
        .select('id, invoice_terms_notes')
        .maybeSingle();

      if (updateError) throw updateError;

      if (updateData) {
        setInitialInvoiceTermsNotes(updateData.invoice_terms_notes || '');
        setInvoiceTermsNotes(updateData.invoice_terms_notes || ''); // Ensure consistency if DB transforms value
        Alert.alert('Success', 'Invoice terms and notes saved successfully.');
      }
    } catch (error: any) {
      console.error('Error saving invoice terms & notes:', error);
      Alert.alert('Error', error.message || 'Failed to save invoice terms and notes.');
    } finally {
      setIsLoadingInvoiceTermsNotes(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(true);
      const fetchScreenStatus = async () => {
        if (!user) {
          setIsLoadingScreenStatus(false);
          setIsPayPalActiveOnScreen(false);
          setIsStripeActiveOnScreen(false);
          setIsBankTransferActiveOnScreen(false);
          return;
        }
        setIsLoadingScreenStatus(true);
        try {
          const { data, error } = await supabase
            .from('payment_options')
            .select('paypal_enabled, stripe_enabled, bank_transfer_enabled, invoice_terms_notes, id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error && error.code !== 'PGRST116') {
            console.error('Error fetching screen payment status:', error);
            setIsPayPalActiveOnScreen(false);
            setIsStripeActiveOnScreen(false);
            setIsBankTransferActiveOnScreen(false);
          } else if (data) {
            setIsPayPalActiveOnScreen(data.paypal_enabled);
            setIsStripeActiveOnScreen(data.stripe_enabled);
            setIsBankTransferActiveOnScreen(data.bank_transfer_enabled);
            setInvoiceTermsNotes(data.invoice_terms_notes || '');
            setInitialInvoiceTermsNotes(data.invoice_terms_notes || '');
            if (!paymentOptionsId && data.id) setPaymentOptionsId(data.id);
          } else {
            setIsPayPalActiveOnScreen(false);
            setIsStripeActiveOnScreen(false);
            setIsBankTransferActiveOnScreen(false);
          }
        } catch (err) {
          console.error('Unexpected error fetching screen payment status:', err);
          setIsPayPalActiveOnScreen(false);
          setIsStripeActiveOnScreen(false);
          setIsBankTransferActiveOnScreen(false);
        } finally {
          setIsLoadingScreenStatus(false);
        }
      };
      fetchScreenStatus();
      return () => setIsTabBarVisible(false);
    }, [user, supabase, paymentOptionsId, setIsTabBarVisible])
  );

  const handleStripePress = () => {
    openStripeModal();
  };

  const handlePayPalPress = () => {
    openPayPalModal();
  };

  const handleBankTransferPress = () => {
    openBankTransferModal();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5} // You can adjust opacity or make it theme-dependent
      />
    ),
    []
  );

  // Re-define HeaderLeft for the back button
  const HeaderLeft = () => (
    <TouchableOpacity onPress={() => router.back()} style={{ paddingLeft: 16, paddingRight:10, paddingVertical: 5 }}>
      <ChevronLeft size={26} color={theme.foreground} />
    </TouchableOpacity>
  );

  if (!user) {
    return <Text>Loading or user not found...</Text>;
  }

  return (
    <BottomSheetModalProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (64 + 20) : 0} // Adjust if header height is different or not needed
        >
          <Stack.Screen 
            options={{
              headerTitle: () => (
                <Text style={[styles.headerTitleStyle, { color: theme.foreground }]}>
                  Payment Options
                </Text>
              ),
              headerShown: true,
              headerStyle: { 
                backgroundColor: theme.card,
              },
              headerLeft: () => <HeaderLeft />,
              headerShadowVisible: false, // To match previous appearance
              animation: 'slide_from_right', // Optional: restore animation if desired
            }}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Online payments</Text>
            <View style={styles.sectionCard}>
              <SettingsListItem
                icon={<Image source={require('../../assets/stripeicon.png')} style={styles.listItemIconStyle} />}
                label="Stripe Payments"
                onPress={handleStripePress}
                rightContent={
                  isLoadingScreenStatus ? (
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                  ) : (
                    <Text style={{ color: isStripeActiveOnScreen ? theme.primary : theme.mutedForeground, fontWeight: isStripeActiveOnScreen ? 'bold' : 'normal' }}>
                      {isStripeActiveOnScreen ? 'On' : 'Off'}
                    </Text>
                  )
                }
              />
              <SettingsListItem
                icon={<Image source={require('../../assets/paypalicon.png')} style={styles.listItemIconStyle} />}
                label="PayPal Payments"
                onPress={handlePayPalPress}
                rightContent={
                  isLoadingScreenStatus ? (
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                  ) : (
                    <Text style={{ color: isPayPalActiveOnScreen ? theme.primary : theme.mutedForeground, fontWeight: isPayPalActiveOnScreen ? 'bold' : 'normal' }}>
                      {isPayPalActiveOnScreen ? 'On' : 'Off'}
                    </Text>
                  )
                }
              />
            </View>

            <Text style={styles.sectionTitle}>Bank Payments</Text>
            <View style={styles.sectionCard}>
              <SettingsListItem
                icon={<Landmark size={24} color={theme.foreground} style={styles.listItemIconStyle} />}
                label="Bank Transfers"
                onPress={handleBankTransferPress} 
                rightContent={
                  isLoadingScreenStatus ? (
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                  ) : (
                    <Text style={{ color: isBankTransferActiveOnScreen ? theme.primary : theme.mutedForeground, fontWeight: isBankTransferActiveOnScreen ? 'bold' : 'normal' }}>
                      {isBankTransferActiveOnScreen ? 'On' : 'Off'}
                    </Text>
                  )
                }
              />
            </View>

            <View style={[styles.sectionCard, { marginTop: 20, paddingHorizontal: 0 /* Reset padding for inner content */ }]}>
              <Text style={[styles.inputLabel, { marginLeft: 16, marginRight: 16, marginBottom: 10, marginTop: 0 /* Reset from sectionCard paddingVertical */ }]}>
                Payment Instructions & Notes
              </Text>
              <RNTextInput
                style={[
                  styles.multilineInputStyle, 
                  { 
                    marginHorizontal: 16, 
                    marginBottom: (invoiceTermsNotes !== initialInvoiceTermsNotes) ? 10 : 16, // Adjust bottom margin if save button is visible
                    backgroundColor: theme.input, 
                    borderColor: theme.border 
                  }
                ]}
                value={invoiceTermsNotes}
                onChangeText={setInvoiceTermsNotes}
                placeholder="Add your payment terms here. For example: bank account details, Venmo/PayPal info, payment deadlines, late fees, or any other instructions for your customers. This will appear on all your invoices."
                multiline
                numberOfLines={5}
                editable={!isLoadingInvoiceTermsNotes}
                placeholderTextColor={theme.mutedForeground}
              />
            </View>

          </ScrollView>

          {/* PayPal Modal */}
          <BottomSheetModal
            ref={paypalBottomSheetModalRef}
            index={0}
            snapPoints={currentPayPalSnapPoints} // Use dynamic snap points
            onChange={handleSheetChanges} 
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
            keyboardBehavior="interactive"
          >
            <BottomSheetScrollView
              contentContainerStyle={styles.modalContentContainer}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Activate PayPal Payments</Text>
                <TouchableOpacity onPress={closePayPalModal} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={24} color={theme.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalInnerContent}>
                <View style={[styles.sectionCard, styles.toggleCard]}>
                  <View style={[styles.inputRow, styles.lastInputRow]}>
                    <Text style={styles.label}>Enable PayPal</Text>
                    <Switch
                      key={`paypal-${isPayPalEnabled.toString()}`}
                      trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
                      thumbColor={isPayPalEnabled ? theme.primary : theme.card}
                      ios_backgroundColor={theme.muted}
                      onValueChange={handlePayPalToggle}
                      value={isPayPalEnabled}
                      disabled={isLoadingSettings}
                    />
                  </View>
                </View>

                {isPayPalEnabled && (
                  <View style={[styles.sectionCard, styles.emailInputCard]}>
                    <Text style={[styles.inputLabel, { color: theme.foreground, marginBottom: 8, fontWeight: 'bold' }]}>PayPal Email</Text>
                    <BottomSheetTextInput
                      style={[styles.emailInputStyle, { backgroundColor: isLightMode ? '#FFFFFF' : theme.input }]} 
                      placeholder="Enter your PayPal email address"
                      placeholderTextColor={theme.mutedForeground}
                      value={paypalEmail}
                      onChangeText={handleEmailChange}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isLoadingSettings}
                    />
                  </View>
                )}

                {settingsChanged && (
                  <View style={styles.saveButtonContainer}>
                    <TouchableOpacity
                      style={[styles.saveButton, isLoadingSettings && styles.disabledButton]}
                      onPress={handleSavePayPalEmail}
                      disabled={isLoadingSettings || !settingsChanged} 
                    >
                      {isLoadingSettings ? (
                        <ActivityIndicator size="small" color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.saveButtonText}>Save PayPal Settings</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </BottomSheetScrollView>
          </BottomSheetModal>

          {/* Stripe Modal */}
          <BottomSheetModal
            ref={stripeBottomSheetModalRef}
            index={0}
            snapPoints={stripeSnapPoints} 
            onChange={handleSheetChanges} 
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
          >
            <BottomSheetScrollView
              contentContainerStyle={styles.modalContentContainer}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Activate Stripe Payments</Text>
                <TouchableOpacity onPress={closeStripeModal} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={24} color={theme.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalInnerContent}>
                <View style={styles.logoRowContainer}>
                  {paymentIcons.map((icon) => (
                    <Image
                      key={icon.name}
                      source={icon.source}
                      style={styles.paymentMethodIconStyle}
                    />
                  ))}
                </View>

                <View style={styles.positiveBulletsContainer}>
                  <View style={styles.bulletItem}>
                    <CheckCircle size={20} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={styles.bulletText}>Customers pay 5 times faster with card payments</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <CheckCircle size={20} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={styles.bulletText}>Easily send card payment links in a flash</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <CheckCircle size={20} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={styles.bulletText}>Fast and easy setup</Text>
                  </View>
                </View>

                <View style={styles.importantStepsContainer}>
                  <Text style={styles.importantStepsTitle}>Important Steps</Text>
                  <Text style={styles.importantStepText}>1. Stripe setup can take <Text style={{ fontWeight: 'bold', color: theme.foreground }}>15 minutes</Text></Text>
                  <Text style={styles.importantStepText}>2. Payouts <Text style={{ fontWeight: 'bold', color: theme.foreground }}>daily or weekly</Text>, first one takes seven days.</Text>
                  <Text style={styles.importantStepText}>3. Stripe fees are the <Text style={{ fontWeight: 'bold', color: theme.foreground }}>most competitive</Text> in the world.</Text>
                </View>

                {!isStripeEnabled && (
                  <TouchableOpacity
                    style={[styles.connectButton, { backgroundColor: theme.primary }]} 
                    onPress={openStripeConnectionModal}
                  >
                    <Text style={styles.connectButtonText}>Connect with Stripe</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.moreInfoButton}
                  onPress={() => Linking.openURL('https://stripe.com').catch(err => console.error('Failed to open URL:', err))}
                >
                  <Text style={styles.moreInfoButtonText}>More about Stripe</Text>
                </TouchableOpacity>
                
                {stripeSettingsChanged && (
                  <View style={styles.saveButtonContainer}>
                    <TouchableOpacity
                      style={[styles.saveButton, isLoadingStripeSettings && styles.disabledButton]}
                      onPress={handleSaveStripeSettings}
                      disabled={isLoadingStripeSettings || !stripeSettingsChanged}
                    >
                      {isLoadingStripeSettings ? (
                        <ActivityIndicator size="small" color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Stripe Settings</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </BottomSheetScrollView>
          </BottomSheetModal>

          {/* Bank Transfer Modal */}
          <BottomSheetModal
            ref={bankTransferBottomSheetModalRef}
            index={0}
            snapPoints={bankTransferSnapPoints}
            onChange={(index) => {
              handleSheetChanges(index); // Existing handler
              if (index === -1) { // Modal dismissed
                setIsBankTransferModalFocused(false);
              }
            }}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
            keyboardBehavior="interactive"
          >
            <BottomSheetScrollView
              ref={bankTransferScrollViewRef} // Assign ref here
              contentContainerStyle={styles.modalContentContainer}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Activate Bank Transfers</Text>
                <TouchableOpacity onPress={closeBankTransferModal} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={24} color={theme.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalInnerContent}>
                <View style={[styles.sectionCard, styles.toggleCard]}>
                  <View style={[styles.inputRow, styles.lastInputRow]}>
                    <Text style={styles.label}>Enable Bank Transfers</Text>
                    <Switch
                      key={`bank-${isBankTransferEnabled.toString()}`}
                      trackColor={{ false: theme.muted, true: theme.primaryTransparent }}
                      thumbColor={isBankTransferEnabled ? theme.primary : theme.card}
                      ios_backgroundColor={theme.muted}
                      onValueChange={handleBankTransferToggle}
                      value={isBankTransferEnabled}
                      disabled={isLoadingBankTransferSettings}
                    />
                  </View>
                </View>

                {isBankTransferEnabled && (
                  <View style={[styles.sectionCard, styles.emailInputCard]}> 
                    <View style={[styles.inputRow]}> 
                      <Text style={styles.label}>Bank Account Details</Text>
                    </View>
                    <BottomSheetTextInput
                      style={[styles.multilineInputStyle, { backgroundColor: isLightMode ? '#FFFFFF' : theme.input }]} 
                      value={bankDetails}
                      onChangeText={handleBankDetailsChange}
                      placeholder="Enter your bank name, account number, sort code/routing number, IBAN, SWIFT/BIC, etc."
                      multiline
                      numberOfLines={5} 
                      editable={!isLoadingBankTransferSettings}
                    />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoText}>Provide clear instructions for customers to make a bank transfer.</Text>
                    </View>
                  </View>
                )}

                {bankTransferSettingsChanged && (
                  <View style={styles.saveButtonContainer}>
                    <TouchableOpacity
                      style={[styles.saveButton, isLoadingBankTransferSettings && styles.disabledButton]}
                      onPress={handleSaveBankTransferSettings}
                      disabled={isLoadingBankTransferSettings || !bankTransferSettingsChanged}
                    >
                      {isLoadingBankTransferSettings ? (
                        <ActivityIndicator size="small" color={theme.primaryForeground} />
                      ) : (
                        <Text style={styles.saveButtonText}>Save Bank Settings</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </BottomSheetScrollView>
          </BottomSheetModal>

          {(invoiceTermsNotes !== initialInvoiceTermsNotes) && (
            <View style={styles.bottomButtonContainer}>
              <TouchableOpacity
                style={[styles.globalSaveButton, isLoadingInvoiceTermsNotes && styles.disabledButton]} // Ensure disabledButton style works well
                onPress={handleSaveInvoiceTermsNotes}
                disabled={isLoadingInvoiceTermsNotes}
              >
                {isLoadingInvoiceTermsNotes ? (
                  <ActivityIndicator size="small" color={styles.globalSaveButtonText.color} />
                ) : (
                  <Text style={styles.globalSaveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </BottomSheetModalProvider>
  );
}

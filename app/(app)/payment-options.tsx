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
  KeyboardAvoidingView,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
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
import { supabase } from '@/config/supabase';
import { useSupabase } from '@/context/supabase-provider';
import { usePaywall } from '@/context/paywall-provider';
import { usePlacement } from 'expo-superwall';
import * as Crypto from 'expo-crypto';

interface PaymentOption {
  id?: string;
  user_id: string;
  paypal_enabled: boolean;
  paypal_email: string | null;
  stripe_enabled: boolean;
  bank_transfer_enabled: boolean;
  bank_details: string | null;
  invoice_terms_notes?: string | null;
  gocardless_connected?: boolean;
  gocardless_creditor_id?: string | null;
  gocardless_verification_status?: string | null;
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
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.18,
          shadowRadius: 8,
        },
        android: {
          elevation: 5,
        },
      }),
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
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
      backgroundColor: theme.card,
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
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 25,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    headerTitleStyle: {
      fontSize: 25,
      fontWeight: 'bold',
      marginLeft: 10,
    },
    modalContentContainer: {
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 32 : 20,
      backgroundColor: theme.background,
    },
    // Align modal header with Add Payment modal
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: Platform.OS === 'ios' ? 20 : 15,
      paddingBottom: 10,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.foreground,
    },
    closeButton: {
      padding: 5,
    },
    handleIndicator: {
      backgroundColor: theme.mutedForeground,
    },
    // Match Add Payment modal surface
    modalBackground: {
      backgroundColor: theme.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
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
      paddingVertical: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
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
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { polarSuccess, polarError } = useLocalSearchParams<{ polarSuccess?: string; polarError?: string }>();
  const colorScheme = useColorScheme();
  const isLightMode = colorScheme === 'light';
  const styles = useMemo(() => getStyles(theme), [theme]);
  const { setIsTabBarVisible } = useTabBarVisibility();
  const { user, supabase } = useSupabase();
  const { isSubscribed, presentPaywall, checkSubscriptionStatus } = usePaywall();
  const stripeSkipReasonRef = useRef<any>(null);

  const { registerPlacement: registerStripePlacement } = usePlacement({
    onError: (err) => {
      console.error('[PaymentOptions] Stripe placement error:', err);
    },
    onPresent: (info) => {
      console.log('[PaymentOptions] Stripe paywall presented:', info);
    },
    onDismiss: async (info, result) => {
      console.log('[PaymentOptions] Stripe paywall dismissed:', result);
      try {
        await checkSubscriptionStatus();
      } catch (error) {
        console.warn('[PaymentOptions] Failed to refresh subscription after Stripe paywall:', error);
      }
    },
    onSkip: (reason) => {
      stripeSkipReasonRef.current = reason;
      console.log('[PaymentOptions] Stripe placement skipped:', reason);
    },
  });

  const paypalBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const stripeBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const bankTransferBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const polarBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const goCardlessBottomSheetModalRef = useRef<BottomSheetModal>(null);
  // Bank Transfer sheet does not require a scroll ref with stable keyboard handling

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
  // Structured bank details (composed into bank_details string for DB)
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountIban, setAccountIban] = useState('');
  const [routingSwift, setRoutingSwift] = useState('');
  const [bankNotes, setBankNotes] = useState('');
  const [initialIsBankTransferEnabled, setInitialIsBankTransferEnabled] = useState(false);
  const [initialBankDetails, setInitialBankDetails] = useState('');
  const [bankTransferSettingsChanged, setBankTransferSettingsChanged] = useState(false);
  const [isLoadingBankTransferSettings, setIsLoadingBankTransferSettings] = useState(false);
  const [isBankTransferActiveOnScreen, setIsBankTransferActiveOnScreen] = useState(false);

  // GoCardless state
  const [isGoCardlessConnected, setIsGoCardlessConnected] = useState(false);
  const [goCardlessVerificationStatus, setGoCardlessVerificationStatus] = useState<string | null>(null);
  const [isLoadingGoCardless, setIsLoadingGoCardless] = useState(false);
  const [isGoCardlessActiveOnScreen, setIsGoCardlessActiveOnScreen] = useState(false);

  // Polar state
  const [isPolarConnected, setIsPolarConnected] = useState(false);
  const [isLoadingPolar, setIsLoadingPolar] = useState(false);
  const [isPolarActiveOnScreen, setIsPolarActiveOnScreen] = useState(false);

  const [invoiceTermsNotes, setInvoiceTermsNotes] = useState<string>('');
  const [initialInvoiceTermsNotes, setInitialInvoiceTermsNotes] = useState<string>('');
  const [isLoadingInvoiceTermsNotes, setIsLoadingInvoiceTermsNotes] = useState<boolean>(false);

  // Handle Polar OAuth callback params
  useEffect(() => {
    if (polarSuccess === 'true') {
      // Refresh Polar connection status
      const refreshPolarStatus = async () => {
        if (!user) return;
        try {
          const { data } = await supabase
            .from('user_profiles')
            .select('polar_connected')
            .eq('id', user.id)
            .single();
          if (data?.polar_connected) {
            setIsPolarConnected(true);
            setIsPolarActiveOnScreen(true);
            Alert.alert('Success', 'Polar account connected successfully!');
          }
        } catch (err) {
          console.error('Error refreshing Polar status:', err);
        }
      };
      refreshPolarStatus();
    } else if (polarError) {
      const errorMessages: Record<string, string> = {
        token_exchange_failed: 'Failed to complete authorization. Please try again.',
        database_error: 'Failed to save connection. Please try again.',
        unexpected_error: 'An unexpected error occurred. Please try again.',
      };
      Alert.alert('Connection Failed', errorMessages[polarError] || `Error: ${polarError}`);
    }
  }, [polarSuccess, polarError, user]);

  // PayPal modal now uses fixed snap points with extend behavior; no dynamic swap needed

  // No special focus tracking needed for bank transfer modal

  const paymentIcons = [
    { name: 'Visa', source: require('../../assets/visaicon.png') },
    { name: 'Mastercard', source: require('../../assets/mastercardicon.png') },
    { name: 'AmEx', source: require('../../assets/amexicon.png') },
    { name: 'ApplePay', source: require('../../assets/applepayicon.png') },
    { name: 'GooglePay', source: require('../../assets/googlepayicon.png') },
  ];

  const polarSnapPoints = useMemo(() => ['85%', '95%'], []);
  const bankTransferSnapPoints = useMemo(() => ['60%', '90%'], []);

  // No keyboard listeners needed; rely on keyboardBehavior="extend" inside sheets

  const openPayPalModal = useCallback(async () => {
    if (!user) return;
    // ensure other modal state is isolated (no-op)
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
        const raw = data.bank_details || '';
        try {
          const obj = JSON.parse(raw as any);
          if (obj && typeof obj === 'object') {
            setBankAccountName((obj as any).accountName || '');
            setBankName((obj as any).bankName || '');
            setAccountIban((obj as any).accountIban || '');
            setRoutingSwift((obj as any).routingSwift || '');
            setBankNotes((obj as any).notes || '');
          } else {
            setBankNotes(raw);
          }
        } catch {
          const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
          const hasLabels = lines.some(l => l.includes(':'));
          if (hasLabels) {
            const lower = (s: string) => s.toLowerCase();
            const getVal = (prefixes: string[]) => {
              const line = lines.find(l => prefixes.some(p => lower(l).startsWith(p)));
              return line ? line.split(':').slice(1).join(':').trim() : '';
            };
            setBankAccountName(getVal(['account name']));
            setBankName(getVal(['bank name']));
            setAccountIban(getVal(['account / iban', 'account', 'iban']));
            setRoutingSwift(getVal(['routing / swift', 'routing', 'swift', 'bic']));
            const consumed = ['account name','bank name','account / iban','account','iban','routing / swift','routing','swift','bic'];
            setBankNotes(lines.filter(l => !consumed.some(c => lower(l).startsWith(c))).join('\n'));
          } else {
            // Treat as unlabeled sequential lines in the order of fields
            setBankAccountName(lines[0] || '');
            setBankName(lines[1] || '');
            setAccountIban(lines[2] || '');
            setRoutingSwift(lines[3] || '');
            setBankNotes(lines.slice(4).join('\n'));
          }
        }
setInitialIsBankTransferEnabled(data.bank_transfer_enabled);
        setInitialBankDetails(raw);
        if (data.id && !paymentOptionsId) setPaymentOptionsId(data.id);
      } else {
        setIsBankTransferEnabled(false);
        setBankAccountName('');
        setBankName('');
        setAccountIban('');
        setRoutingSwift('');
        setBankNotes('');
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
  }, []);

  const handleBankTransferToggle = (newValue: boolean) => {
    setIsBankTransferEnabled(newValue);
    setBankTransferSettingsChanged(true);
  };

  // Mark changed handlers for structured fields
  const onChangeBankAccountName = (t: string) => { setBankAccountName(t); setBankTransferSettingsChanged(true); };
  const onChangeBankName = (t: string) => { setBankName(t); setBankTransferSettingsChanged(true); };
  const onChangeAccountIban = (t: string) => { setAccountIban(t); setBankTransferSettingsChanged(true); };
  const onChangeRoutingSwift = (t: string) => { setRoutingSwift(t); setBankTransferSettingsChanged(true); };
  const onChangeBankNotes = (t: string) => { setBankNotes(t); setBankTransferSettingsChanged(true); };

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
    // Store exactly what user typed, one value per line (no labels)
    const composed = [
      bankAccountName?.trim(),
      bankName?.trim(),
      accountIban?.trim(),
      routingSwift?.trim(),
      bankNotes?.trim(),
    ].filter(Boolean).join('\n');

    const updateData: Partial<PaymentOption> & { user_id: string } = {
      user_id: user.id,
      bank_transfer_enabled: isBankTransferEnabled,
      bank_details: isBankTransferEnabled ? composed : null,
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
      setInitialBankDetails(composed);
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

  const openStripeConnectionModal = useCallback(async () => {
    console.log('Attempting to open Stripe Connection Modal...');

    if (!isSubscribed) {
      try {
        stripeSkipReasonRef.current = null;
        const params = { source: 'stripe_connect' };
        console.log('[PaymentOptions] Triggering Stripe placement with params:', params);
        await registerStripePlacement({
          placement: 'stripe_button',
          params,
          feature: () => {
            console.log('[PaymentOptions] Stripe placement unlocked feature without showing paywall');
          },
        });

        if (stripeSkipReasonRef.current) {
          console.log('[PaymentOptions] Stripe placement skipped with reason:', stripeSkipReasonRef.current, '— using shared paywall service fallback');
          await presentPaywall({ event: 'stripe_button', params });
        }
      } catch (error) {
        console.error('[PaymentOptions] Failed to present Stripe paywall:', error);
        Alert.alert(
          'Upgrade Required',
          'Stripe payments are part of the SuperInvoice Pro plan. Upgrade to unlock this feature.'
        );
      }
      return;
    }

    Alert.alert('Connect with Stripe', 'This will open the Stripe connection flow. (Not yet implemented)');
  }, [isSubscribed, presentPaywall]);

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

  // Extract fetchScreenStatus as a standalone function
  const fetchScreenStatus = useCallback(async () => {
    if (!user) {
      setIsLoadingScreenStatus(false);
      setIsPayPalActiveOnScreen(false);
      setIsStripeActiveOnScreen(false);
      setIsBankTransferActiveOnScreen(false);
      setIsGoCardlessActiveOnScreen(false);
      return;
    }
    setIsLoadingScreenStatus(true);
    try {
      const { data, error } = await supabase
        .from('payment_options')
        .select('paypal_enabled, stripe_enabled, bank_transfer_enabled, invoice_terms_notes, id, gocardless_connected, gocardless_verification_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching screen payment status:', error);
        setIsPayPalActiveOnScreen(false);
        setIsStripeActiveOnScreen(false);
        setIsBankTransferActiveOnScreen(false);
        setIsGoCardlessActiveOnScreen(false);
      } else if (data) {
        setIsPayPalActiveOnScreen(data.paypal_enabled);
        setIsStripeActiveOnScreen(data.stripe_enabled);
        setIsBankTransferActiveOnScreen(data.bank_transfer_enabled);
        setIsGoCardlessActiveOnScreen(data.gocardless_connected || false);
        setIsGoCardlessConnected(data.gocardless_connected || false);
        setGoCardlessVerificationStatus(data.gocardless_verification_status || null);
        setInvoiceTermsNotes(data.invoice_terms_notes || '');
        setInitialInvoiceTermsNotes(data.invoice_terms_notes || '');
        if (!paymentOptionsId && data.id) setPaymentOptionsId(data.id);
      } else {
        setIsPayPalActiveOnScreen(false);
        setIsStripeActiveOnScreen(false);
        setIsBankTransferActiveOnScreen(false);
        setIsGoCardlessActiveOnScreen(false);
      }
    } catch (err) {
      console.error('Unexpected error fetching screen payment status:', err);
      setIsPayPalActiveOnScreen(false);
      setIsStripeActiveOnScreen(false);
      setIsBankTransferActiveOnScreen(false);
      setIsGoCardlessActiveOnScreen(false);
    } finally {
      setIsLoadingScreenStatus(false);
    }
  }, [user, supabase, paymentOptionsId]);

  useFocusEffect(
    useCallback(() => {
      setIsTabBarVisible(true);
      fetchScreenStatus();
      return () => setIsTabBarVisible(false);
    }, [fetchScreenStatus, setIsTabBarVisible])
  );

  // AppState listener for GoCardless OAuth callback
  // When user returns from browser after OAuth, refresh payment settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[GoCardless] App became active, refreshing payment settings...');
        fetchScreenStatus();
      }
    });

    return () => subscription.remove();
  }, [fetchScreenStatus]);

  const handleStripePress = () => {
    openStripeModal();
  };

  const handlePayPalPress = () => {
    openPayPalModal();
  };

  const handleBankTransferPress = () => {
    openBankTransferModal();
  };

  const handleGoCardlessPress = async () => {
    openGoCardlessModal();
  };

  const initiateGoCardlessOAuth = async () => {
    try {
      setIsLoadingGoCardless(true);

      const { data: session, error: sessionError } = await supabase.auth.getSession();

      console.log('[GoCardless] Session check:', {
        hasSession: !!session,
        hasSessionSession: !!session?.session,
        hasAccessToken: !!session?.session?.access_token,
        sessionError: sessionError,
        userId: session?.session?.user?.id,
      });

      if (!session?.session) {
        console.error('[GoCardless] No session found!');
        throw new Error('Not authenticated - please log in again');
      }

      if (!session.session.access_token) {
        console.error('[GoCardless] No access token in session!');
        throw new Error('No access token found');
      }

      console.log('[GoCardless] Access token length:', session.session.access_token.length);
      console.log('[GoCardless] Access token preview:', session.session.access_token.substring(0, 20) + '...');

      console.log('[GoCardless] Calling edge function with:', {
        action: 'generate-oauth-url',
        redirect_uri: 'https://getsuperinvoice.com/gocardless-callback',
        environment: 'sandbox',
        url: `${process.env.EXPO_PUBLIC_API_URL}/functions/v1/gocardless-payments-oauth`,
      });

      // Call edge function to generate OAuth URL
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/functions/v1/gocardless-payments-oauth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            action: 'generate-oauth-url',
            redirect_uri: 'https://getsuperinvoice.com/gocardless-callback',
            environment: 'sandbox',
          }),
        }
      );

      console.log('[GoCardless] Edge function response status:', response.status);
      console.log('[GoCardless] Edge function response headers:', {
        contentType: response.headers.get('content-type'),
      });

      const responseText = await response.text();
      console.log('[GoCardless] Raw response:', responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText };
        }
        console.error('[GoCardless] Edge function error response:', errorData);
        throw new Error(errorData.error || errorData.message || 'Failed to generate OAuth URL');
      }

      const data = JSON.parse(responseText);
      console.log('[GoCardless] OAuth URL response:', JSON.stringify(data, null, 2));
      console.log('[GoCardless] URL being opened:', data.url);

      // Open OAuth URL in browser
      const supported = await Linking.canOpenURL(data.url);
      if (supported) {
        await Linking.openURL(data.url);
      } else {
        throw new Error('Cannot open GoCardless authorization page');
      }

    } catch (error) {
      console.error('[GoCardless] OAuth initiation error:', error);
      Alert.alert(
        'Connection Failed',
        error instanceof Error ? error.message : 'Failed to connect GoCardless',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoadingGoCardless(false);
    }
  };

  const handleDisconnectGoCardless = async () => {
    try {
      if (!user) return;

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Not authenticated');
      }

      // Call edge function to disconnect
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/functions/v1/gocardless-payments-oauth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
          body: JSON.stringify({
            action: 'disconnect',
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect');
      }

      setIsGoCardlessConnected(false);
      setIsGoCardlessActiveOnScreen(false);
      setGoCardlessVerificationStatus(null);

      Alert.alert('Disconnected', 'GoCardless has been disconnected successfully.');
      closeGoCardlessModal();
    } catch (error) {
      console.error('[GoCardless] Disconnect error:', error);
      Alert.alert('Error', 'Failed to disconnect GoCardless. Please try again.');
    }
  };

  // Polar modal handlers
  const openPolarModal = useCallback(() => {
    polarBottomSheetModalRef.current?.present();
  }, []);

  const closePolarModal = useCallback(() => {
    polarBottomSheetModalRef.current?.dismiss();
  }, []);

  // GoCardless modal handlers
  const openGoCardlessModal = useCallback(() => {
    goCardlessBottomSheetModalRef.current?.present();
  }, []);

  const closeGoCardlessModal = useCallback(() => {
    goCardlessBottomSheetModalRef.current?.dismiss();
  }, []);

  const handlePolarPress = () => {
    Alert.alert(
      'USD Only',
      'Card payments currently only support USD invoices. Support for other currencies is coming soon.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => openPolarModal() }
      ]
    );
  };

  const initiatePolarOAuth = async () => {
    if (!user) return;

    try {
      setIsLoadingPolar(true);

      // Generate PKCE code_verifier (43-128 characters, URL-safe)
      const codeVerifier = Crypto.getRandomBytes(32)
        .reduce((acc, byte) => acc + byte.toString(16).padStart(2, '0'), '');

      // Generate code_challenge from code_verifier using SHA-256
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        codeVerifier,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      // Convert base64 to base64url
      const codeChallenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Create state with user ID and code_verifier for the callback
      const state = btoa(JSON.stringify({ userId: user.id, codeVerifier }));

      const clientId = 'polar_ci_cCmoDRhfHruYcLNa9fQJ8PErsOYJRgreSX3hv4VjL4K';
      const redirectUri = encodeURIComponent('https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/polar-oauth-callback');
      const scope = encodeURIComponent('checkouts:read checkouts:write products:read organizations:read');

      const authUrl = `https://polar.sh/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

      const canOpen = await Linking.canOpenURL(authUrl);
      if (canOpen) {
        await Linking.openURL(authUrl);
      } else {
        throw new Error('Cannot open Polar authorization page');
      }
    } catch (error) {
      console.error('[Polar] OAuth initiation error:', error);
      Alert.alert(
        'Connection Failed',
        error instanceof Error ? error.message : 'Failed to connect Polar. Please try again.'
      );
    } finally {
      setIsLoadingPolar(false);
    }
  };

  const handleDisconnectPolar = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          polar_connected: false,
          polar_access_token: null,
          polar_refresh_token: null,
          polar_token_expires_at: null,
          polar_organization_id: null,
        })
        .eq('id', user.id);

      if (error) throw error;

      setIsPolarConnected(false);
      setIsPolarActiveOnScreen(false);

      Alert.alert('Disconnected', 'Polar has been disconnected successfully.');
    } catch (error) {
      console.error('[Polar] Disconnect error:', error);
      Alert.alert('Error', 'Failed to disconnect Polar. Please try again.');
    }
  };

  // Fetch Polar status from user_profiles
  const fetchPolarStatus = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('polar_connected')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[Polar] Error fetching status:', error);
        return;
      }

      if (data) {
        setIsPolarConnected(data.polar_connected || false);
        setIsPolarActiveOnScreen(data.polar_connected || false);
      }
    } catch (err) {
      console.error('[Polar] Unexpected error:', err);
    }
  }, [user, supabase]);

  // Fetch Polar status on focus
  useFocusEffect(
    useCallback(() => {
      fetchPolarStatus();
    }, [fetchPolarStatus])
  );

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

  useEffect(() => {
    navigation.setOptions({
      header: () => (
        <SafeAreaView edges={['top']} style={{ backgroundColor: theme.background }}>
          <View style={[styles.headerContainer, { backgroundColor: theme.background, zIndex: 10 }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ padding: 12, marginLeft: -8 }}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              activeOpacity={0.6}
            >
              <ChevronLeft size={24} color={theme.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, {color: theme.foreground}]}>Payment Options</Text>
          </View>
        </SafeAreaView>
      ),
      headerShown: true,
    });
  }, [navigation, router, theme, styles]);

  if (!user) {
    return <Text>Loading or user not found...</Text>;
  }

  return (
    <BottomSheetModalProvider>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? (64 + 20) : 0}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.scrollContentContainer}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sectionTitle}>Online payments</Text>
            <View style={styles.sectionCard}>
              {/* Polar Card Payments - Temporarily Hidden */}
              {/* <SettingsListItem
                icon={
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
                    <Image source={require('../../assets/visaicon.png')} style={{ width: 24, height: 24, resizeMode: 'contain', marginRight: 2 }} />
                    <Image source={require('../../assets/mastercardicon.png')} style={{ width: 24, height: 24, resizeMode: 'contain' }} />
                  </View>
                }
                label="Card Payments"
                subtitle="Accept Visa, Mastercard, Apple Pay & more"
                onPress={handlePolarPress}
                rightContent={
                  isLoadingPolar ? (
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                  ) : (
                    <Text style={{
                      color: isPolarActiveOnScreen ? theme.primary : theme.mutedForeground,
                      fontWeight: isPolarActiveOnScreen ? 'bold' : 'normal'
                    }}>
                      {isPolarActiveOnScreen ? 'Connected' : 'Connect'}
                    </Text>
                  )
                }
              /> */}
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
              <SettingsListItem
                icon={<Image source={{ uri: 'https://wzpuzqzsjdizmpiobsuo.supabase.co/storage/v1/object/public/payment-icons/gocardless.png' }} style={styles.listItemIconStyle} />}
                label="GoCardless"
                subtitle={goCardlessVerificationStatus === 'action_required' ? 'Verification needed' : goCardlessVerificationStatus === 'in_review' ? 'Under review' : goCardlessVerificationStatus === 'successful' ? 'Verified' : undefined}
                onPress={handleGoCardlessPress}
                rightContent={
                  isLoadingScreenStatus ? (
                    <ActivityIndicator size="small" color={theme.mutedForeground} />
                  ) : (
                    <Text style={{
                      color: isGoCardlessActiveOnScreen ? theme.primary : theme.mutedForeground,
                      fontWeight: isGoCardlessActiveOnScreen ? 'bold' : 'normal'
                    }}>
                      {isGoCardlessActiveOnScreen ? 'Connected' : 'Not Connected'}
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

          {/* PayPal Modal (stable cloned config) */}
          <BottomSheetModal
            ref={paypalBottomSheetModalRef}
            index={0}
            snapPoints={useMemo(() => ['60%', '90%'], [])}
            onChange={handleSheetChanges} 
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
            keyboardBehavior="extend"
            enableDynamicSizing={false}
          >
            <BottomSheetScrollView
              contentContainerStyle={[
                styles.modalContentContainer,
                { paddingBottom: Platform.OS === 'ios' ? 90 : 80 },
              ]}
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
                      style={[styles.emailInputStyle]} 
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
            snapPoints={polarSnapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
          >
            <BottomSheetScrollView
              contentContainerStyle={[styles.modalContentContainer, { paddingTop: 5 }]}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalHeader, { paddingTop: 10, paddingBottom: 8 }]}>
                <Text style={styles.modalTitle}>Activate Stripe Payments</Text>
                <TouchableOpacity onPress={closeStripeModal} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={24} color={theme.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={[styles.modalInnerContent, { padding: 12 }]}>
                <View style={[styles.logoRowContainer, { marginVertical: 10, paddingHorizontal: 0 }]}>
                  {paymentIcons.map((icon) => (
                    <Image
                      key={icon.name}
                      source={icon.source}
                      style={[styles.paymentMethodIconStyle, { width: 50, height: 32, marginHorizontal: 3 }]}
                    />
                  ))}
                </View>

                <View style={[styles.positiveBulletsContainer, { marginTop: 8, marginBottom: 12, paddingHorizontal: 4 }]}>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Customers pay 5 times faster with card payments</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Easily send card payment links in a flash</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Fast and easy setup</Text>
                  </View>
                </View>

                <View style={[styles.importantStepsContainer, { marginTop: 6, marginBottom: 16, paddingHorizontal: 4 }]}>
                  <Text style={[styles.importantStepsTitle, { fontSize: 16, marginBottom: 8 }]}>Important Steps</Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>1. Stripe setup can take <Text style={{ fontWeight: 'bold', color: theme.foreground }}>15 minutes</Text></Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>2. Payouts <Text style={{ fontWeight: 'bold', color: theme.foreground }}>daily or weekly</Text>, first one takes seven days.</Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>3. Stripe fees are the <Text style={{ fontWeight: 'bold', color: theme.foreground }}>most competitive</Text> in the world.</Text>
                </View>

                {!isStripeEnabled && (
                  <TouchableOpacity
                    style={[styles.connectButton, { backgroundColor: theme.primary, marginBottom: 10, paddingVertical: 14 }]}
                    onPress={openStripeConnectionModal}
                  >
                    <Text style={styles.connectButtonText}>Connect with Stripe</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.moreInfoButton, { paddingVertical: 8, marginBottom: 10 }]}
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

          {/* Polar Card Payments Modal - Temporarily Hidden */}
          {/* <BottomSheetModal
            ref={polarBottomSheetModalRef}
            index={0}
            snapPoints={polarSnapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
          >
            <BottomSheetScrollView
              contentContainerStyle={[styles.modalContentContainer, { paddingTop: 5 }]}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalHeader, { paddingTop: 10, paddingBottom: 8 }]}>
                <Text style={styles.modalTitle}>Activate Card Payments</Text>
                <TouchableOpacity onPress={closePolarModal} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={24} color={theme.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={[styles.modalInnerContent, { padding: 12 }]}>
                <View style={[styles.logoRowContainer, { marginVertical: 10, paddingHorizontal: 0 }]}>
                  {paymentIcons.map((icon) => (
                    <Image
                      key={icon.name}
                      source={icon.source}
                      style={[styles.paymentMethodIconStyle, { width: 50, height: 32, marginHorizontal: 3 }]}
                    />
                  ))}
                </View>

                <View style={[styles.positiveBulletsContainer, { marginTop: 8, marginBottom: 12, paddingHorizontal: 4 }]}>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Customers pay 5 times faster with card payments</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Easily send card payment links in a flash</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Fast and easy setup - under 2 minutes</Text>
                  </View>
                </View>

                <View style={[styles.importantStepsContainer, { marginTop: 6, marginBottom: 16, paddingHorizontal: 4 }]}>
                  <Text style={[styles.importantStepsTitle, { fontSize: 16, marginBottom: 8 }]}>How it works</Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>1. Connect your Polar account <Text style={{ fontWeight: 'bold', color: theme.foreground }}>in seconds</Text></Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>2. Generate <Text style={{ fontWeight: 'bold', color: theme.foreground }}>payment links</Text> for any invoice</Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>3. Get paid directly to your <Text style={{ fontWeight: 'bold', color: theme.foreground }}>bank account</Text></Text>
                </View>

                {!isPolarConnected ? (
                  <TouchableOpacity
                    style={[styles.connectButton, { backgroundColor: theme.primary, marginBottom: 10, paddingVertical: 14 }]}
                    onPress={initiatePolarOAuth}
                    disabled={isLoadingPolar}
                  >
                    {isLoadingPolar ? (
                      <ActivityIndicator size="small" color={theme.primaryForeground} />
                    ) : (
                      <Text style={styles.connectButtonText}>Connect with Polar</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ alignItems: 'center', marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <CheckCircle size={22} color={theme.primary} />
                      <Text style={{ marginLeft: 8, fontSize: 15, fontWeight: 'bold', color: theme.foreground }}>
                        Connected
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.moreInfoButton, { borderColor: '#dc3545', paddingVertical: 8, marginBottom: 10 }]}
                      onPress={handleDisconnectPolar}
                    >
                      <Text style={[styles.moreInfoButtonText, { color: '#dc3545' }]}>Disconnect Polar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.moreInfoButton, { paddingVertical: 8, marginBottom: 10 }]}
                  onPress={() => Linking.openURL('https://polar.sh').catch(err => console.error('Failed to open URL:', err))}
                >
                  <Text style={styles.moreInfoButtonText}>More about Polar</Text>
                </TouchableOpacity>
              </View>
            </BottomSheetScrollView>
          </BottomSheetModal> */}

          {/* Bank Transfer Modal */}
          <BottomSheetModal
            ref={bankTransferBottomSheetModalRef}
            index={0}
            snapPoints={bankTransferSnapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
            keyboardBehavior="extend"
            enableDynamicSizing={false}
          >
            <BottomSheetScrollView
              contentContainerStyle={[
                styles.modalContentContainer,
                { paddingBottom: Platform.OS === 'ios' ? 90 : 80 },
              ]}
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
                      style={[styles.emailInputStyle]}
                      value={bankAccountName}
                      onChangeText={onChangeBankAccountName}
                      placeholder="Account Holder Name"
                      placeholderTextColor={isLightMode ? '#666666' : theme.mutedForeground}
                      autoCapitalize="words"
                      editable={!isLoadingBankTransferSettings}
                      returnKeyType="next"
                    />
                    <BottomSheetTextInput
                      style={[styles.emailInputStyle]}
                      value={bankName}
                      onChangeText={onChangeBankName}
                      placeholder="Bank Name"
                      placeholderTextColor={isLightMode ? '#666666' : theme.mutedForeground}
                      autoCapitalize="words"
                      editable={!isLoadingBankTransferSettings}
                      returnKeyType="next"
                    />
                    <BottomSheetTextInput
                      style={[styles.emailInputStyle]}
                      value={accountIban}
                      onChangeText={onChangeAccountIban}
                      placeholder="Account Number / IBAN"
                      placeholderTextColor={isLightMode ? '#666666' : theme.mutedForeground}
                      autoCapitalize="characters"
                      editable={!isLoadingBankTransferSettings}
                      returnKeyType="next"
                    />
                    <BottomSheetTextInput
                      style={[styles.emailInputStyle]}
                      value={routingSwift}
                      onChangeText={onChangeRoutingSwift}
                      placeholder="Routing Number / SWIFT / BIC"
                      placeholderTextColor={isLightMode ? '#666666' : theme.mutedForeground}
                      autoCapitalize="characters"
                      editable={!isLoadingBankTransferSettings}
                      returnKeyType="next"
                    />
                    <BottomSheetTextInput
                      style={[styles.emailInputStyle]}
                      value={bankNotes}
                      onChangeText={onChangeBankNotes}
                      placeholder="Notes (optional)"
                      placeholderTextColor={isLightMode ? '#666666' : theme.mutedForeground}
                      autoCapitalize="sentences"
                      editable={!isLoadingBankTransferSettings}
                      returnKeyType="done"
                    />
                    <View style={styles.infoTextContainer}>
                      <Text style={styles.infoText}>These details will show exactly what you type on your invoice.</Text>
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

          {/* GoCardless Modal */}
          <BottomSheetModal
            ref={goCardlessBottomSheetModalRef}
            index={0}
            snapPoints={polarSnapPoints}
            onChange={handleSheetChanges}
            backdropComponent={renderBackdrop}
            handleIndicatorStyle={styles.handleIndicator}
            backgroundStyle={styles.modalBackground}
          >
            <BottomSheetScrollView
              contentContainerStyle={[styles.modalContentContainer, { paddingTop: 5 }]}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalHeader, { paddingTop: 10, paddingBottom: 8 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image
                    source={{ uri: 'https://wzpuzqzsjdizmpiobsuo.supabase.co/storage/v1/object/public/payment-icons/gocardless.png' }}
                    style={{ width: 24, height: 24 }}
                  />
                  <Text style={styles.modalTitle}>Connect GoCardless</Text>
                </View>
                <TouchableOpacity onPress={closeGoCardlessModal} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <XIcon size={24} color={theme.mutedForeground} />
                </TouchableOpacity>
              </View>
              <View style={[styles.modalInnerContent, { padding: 12 }]}>
                <View style={[styles.positiveBulletsContainer, { marginTop: 8, marginBottom: 12, paddingHorizontal: 4 }]}>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Accept instant bank payments from customers</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Lower fees than traditional card payments</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Secure and reliable bank-to-bank transfers</Text>
                  </View>
                  <View style={[styles.bulletItem, { marginBottom: 8 }]}>
                    <CheckCircle size={18} color={'#28A745'} style={styles.bulletIcon} />
                    <Text style={[styles.bulletText, { fontSize: 14, lineHeight: 18 }]}>Fast setup - connect in minutes</Text>
                  </View>
                </View>

                <View style={[styles.importantStepsContainer, { marginTop: 6, marginBottom: 16, paddingHorizontal: 4 }]}>
                  <Text style={[styles.importantStepsTitle, { fontSize: 16, marginBottom: 8 }]}>How It Works</Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>1. Connect your GoCardless account <Text style={{ fontWeight: 'bold', color: theme.foreground }}>securely</Text></Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>2. Enable GoCardless on invoices to offer <Text style={{ fontWeight: 'bold', color: theme.foreground }}>bank payment options</Text></Text>
                  <Text style={[styles.importantStepText, { fontSize: 14, marginBottom: 6, lineHeight: 20 }]}>3. Customers pay directly from their <Text style={{ fontWeight: 'bold', color: theme.foreground }}>bank account</Text></Text>
                </View>

                {!isGoCardlessConnected ? (
                  <TouchableOpacity
                    style={[styles.connectButton, { backgroundColor: theme.primary, marginBottom: 10, paddingVertical: 14 }]}
                    onPress={initiateGoCardlessOAuth}
                    disabled={isLoadingGoCardless}
                  >
                    {isLoadingGoCardless ? (
                      <ActivityIndicator size="small" color={theme.primaryForeground} />
                    ) : (
                      <Text style={styles.connectButtonText}>Connect with GoCardless</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ alignItems: 'center', marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                      <CheckCircle size={22} color={theme.primary} />
                      <Text style={{ marginLeft: 8, fontSize: 15, fontWeight: 'bold', color: theme.foreground }}>
                        Connected
                      </Text>
                    </View>
                    {goCardlessVerificationStatus && (
                      <Text style={{ fontSize: 14, color: theme.mutedForeground, marginBottom: 12 }}>
                        Status: {goCardlessVerificationStatus === 'successful' ? 'Verified ✓' : goCardlessVerificationStatus === 'in_review' ? 'Under Review' : 'Verification Needed'}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.moreInfoButton, { borderColor: '#dc3545', paddingVertical: 8, marginBottom: 10 }]}
                      onPress={() => {
                        Alert.alert(
                          'Disconnect GoCardless',
                          'Are you sure you want to disconnect your GoCardless account?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Disconnect', style: 'destructive', onPress: handleDisconnectGoCardless }
                          ]
                        );
                      }}
                    >
                      <Text style={[styles.moreInfoButtonText, { color: '#dc3545' }]}>Disconnect GoCardless</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.moreInfoButton, { paddingVertical: 8, marginBottom: 10 }]}
                  onPress={() => Linking.openURL('https://gocardless.com').catch(err => console.error('Failed to open URL:', err))}
                >
                  <Text style={styles.moreInfoButtonText}>More about GoCardless</Text>
                </TouchableOpacity>
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

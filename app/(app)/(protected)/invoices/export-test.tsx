import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Dimensions,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  ChevronLeft,
} from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider'; 
import type { Tables } from '../../../../types/database.types'; 
import { InvoiceForTemplate, BusinessSettingsRow } from './InvoiceTemplateOne'; 
import InvoiceSkeletonLoader from '@/components/InvoiceSkeletonLoader';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

// NEW SKIA IMPORTS
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';
import { useCanvasRef } from '@shopify/react-native-skia';

type ClientRow = Tables<'clients'>;

function ExportTestScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const { id: invoiceId } = useLocalSearchParams<{ id: string }>();
  const { supabase } = useSupabase(); 

  const [invoice, setInvoice] = useState<InvoiceForTemplate | null>(null);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single canvas ref for export test
  const a4ExportRef = useCanvasRef();

  const { setIsTabBarVisible } = useTabBarVisibility();
  const navigation = useNavigation();
  
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      setIsTabBarVisible(true);
    });

    if (navigation.isFocused()) {
      setIsTabBarVisible(false);
    }

    return () => {
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);

  const handleCustomBack = () => {
    router.back(); 
  };

  const fetchBusinessSettings = async (userId: string) => {
    if (!userId) return;

    try {
      const { data, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single(); 

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('[fetchBusinessSettings] Error:', settingsError);
        setError('Failed to load business settings.');
        setBusinessSettings(null); 
      } else {
        if (data) {
          const { data: paymentOpts, error: paymentOptsError } = await supabase
            .from('payment_options') 
            .select('*')
            .eq('user_id', userId) 
            .single();

          if (paymentOptsError && paymentOptsError.code !== 'PGRST116') {
            console.error('[fetchBusinessSettings] Payment options error:', paymentOptsError);
          }

          const combinedSettings = { ...data, ...(paymentOpts || {}) };
          setBusinessSettings(combinedSettings as BusinessSettingsRow); 
        } else {
          setBusinessSettings(null);
        }
      }
    } catch (e: any) {
      console.error('[fetchBusinessSettings] Exception:', e.message);
      setError('An unexpected error occurred while fetching business settings.');
      setBusinessSettings(null);
    }
  };

  const fetchInvoiceData = async (invoiceId: string) => {
    setIsLoading(true);
    try {
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (*),
          invoice_line_items (*)
        `)
        .eq('id', invoiceId)
        .single();

      if (invoiceError) {
        console.error('[fetchInvoiceData] Error:', invoiceError);
        setError('Failed to load invoice data.');
        setInvoice(null);
        setIsLoading(false);
        return null;
      }

      if (!invoiceData) {
        setError('Invoice not found.');
        setInvoice(null);
        setIsLoading(false);
        return null;
      }

      const { data: businessDataForCurrency, error: businessError } = await supabase
        .from('business_settings')
        .select('currency_code')
        .eq('user_id', invoiceData.user_id)
        .single();

      if (businessError && businessError.code !== 'PGRST116') {
        console.error('[fetchInvoiceData] Currency error:', businessError);
      }

      const fetchedInvoiceForTemplate: InvoiceForTemplate = {
        ...invoiceData,
        invoice_number: invoiceData.invoice_number ?? '', 
        clients: invoiceData.clients as Tables<'clients'> | null,
        invoice_line_items: invoiceData.invoice_line_items as Tables<'invoice_line_items'>[],
        currency: businessDataForCurrency?.currency_code || 'USD', 
        currency_symbol: getCurrencySymbol(businessDataForCurrency?.currency_code || 'USD'),
        invoice_tax_label: invoiceData.invoice_tax_label || 'Tax', 
        paid_amount: invoiceData.paid_amount,
        payment_date: invoiceData.payment_date,
        payment_notes: invoiceData.payment_notes,
        due_date: invoiceData.due_date ?? null,
        custom_headline: invoiceData.custom_headline ?? null,
      };
      
      setInvoice(fetchedInvoiceForTemplate);
      if (invoiceData.clients) {
        setClient(invoiceData.clients as ClientRow);
      }
      setError(null);
      setIsLoading(false);
      return fetchedInvoiceForTemplate;
    } catch (e: any) {
      console.error('[fetchInvoiceData] Exception:', e.message);
      setError('An unexpected error occurred while fetching invoice data.');
      setInvoice(null);
      setIsLoading(false);
      return null;
    }
  };

  useEffect(() => {
    const processData = async () => {
      if (invoiceId) {
        try {
          const fetchedInvoice = await fetchInvoiceData(invoiceId);
          if (fetchedInvoice && fetchedInvoice.user_id) {
            await fetchBusinessSettings(fetchedInvoice.user_id);
          }
        } catch (error) {
          console.error('[processData] Error:', error);
          setError('Failed to load invoice data.');
        } finally {
          setIsLoading(false);
        }
      } else {
        setError('No invoice specified.');
        setIsLoading(false);
      }
    };

    processData();
  }, [invoiceId, supabase]);

  const getCurrencySymbol = (currencyCode: string): string => {
    if (!currencyCode) return '$';
    const mapping: Record<string, string> = {
      'USD': '$',
      'USD - United States Dollar': '$',
      'GBP': '£',
      'GBP - British Pound': '£',
      'EUR': '€',
      'EUR - Euro': '€',
    };
    if (mapping[currencyCode]) return mapping[currencyCode];
    const code = currencyCode.split(' ')[0];
    if (mapping[code]) return mapping[code];
    return '$';
  };

  const currencySymbol = invoice?.currency ? getCurrencySymbol(invoice.currency) : '$';

  const handleExportTest = async () => {
    if (!invoice || !businessSettings) {
      Alert.alert('Error', 'Cannot export PDF - invoice data not loaded');
      return;
    }

    try {
      console.log('[EXPORT_TEST] Testing exact export matching');
      
      const image = a4ExportRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot from canvas');
      }
      
      console.log('[EXPORT_TEST] Canvas dimensions:', image.width(), 'x', image.height());
      
      const bytes = image.encodeToBytes();
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64String = btoa(binaryString);
      
      // Minimal margins for edge-to-edge layout
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              margin: 0mm;
              size: A4 portrait;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            .invoice-image {
              width: 100%;
              height: auto;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice ${invoice.invoice_number}" />
        </body>
        </html>
      `;
      
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      console.log('[EXPORT_TEST] PDF generated:', uri);
      
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export Test - ${invoice.invoice_number}`
      });
      
      console.log('[EXPORT_TEST] Export test completed successfully');
      
    } catch (error: any) { 
      console.error('[EXPORT_TEST] Export error:', error);
      Alert.alert('Export Error', `Export failed: ${error.message}`);
    }
  };

  const getStyles = (themeColors: any) => StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: { 
      flex: 1,
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
      marginBottom: 16,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    subtitle: {
      fontSize: 14,
      marginLeft: 32,
      marginTop: 4,
    },
    section: {
      backgroundColor: themeColors.card,
      padding: 16,
      borderRadius: 8,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 12,
    },
    testButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: themeColors.primary,
      borderRadius: 6,
      alignItems: 'center',
    },
    testButtonText: {
      color: themeColors.primaryForeground,
      fontSize: 12,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    infoText: {
      fontSize: 12,
      color: themeColors.mutedForeground,
      marginTop: 8,
      lineHeight: 16,
    },
    canvasContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    layoutItemTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      marginBottom: 8,
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: { 
      flexGrow: 1,
      paddingBottom: 100,
    },
    centered: { 
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    dimensionText: {
      fontSize: 10,
      color: themeColors.mutedForeground,
      marginTop: 4,
      textAlign: 'center',
    },
  });

  const styles = getStyles(themeColors);

  // Screen dimensions
  const screenWidth = Dimensions.get('window').width;
  
  // Canvas dimensions - reduced for smaller PDF export
  const totalPadding = 8; // Just 4px margin on each side
  const displayWidth = 200; // Even smaller width for compact PDF export
  
  // Screen display height - adjusted to match PDF export exactly
  const displayHeight = 259; // Reduced by 3px more to fine-tune canvas height
  
  // These are the actual export dimensions (what gets saved to PDF)
  const a4ExportWidth = displayWidth;
  const a4ExportHeight = displayHeight;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.background }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <View style={styles.header}>
          <View>
            <TouchableOpacity onPress={handleCustomBack} style={styles.headerLeft}>
              <ChevronLeft size={24} color={themeColors.foreground} />
              <Text style={[styles.headerTitle, { color: themeColors.foreground }]}>
                A4 Export Matching Lab
              </Text>
            </TouchableOpacity>
            <Text style={[styles.subtitle, { color: themeColors.mutedForeground }]}>
              Make app display match PDF export exactly
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <InvoiceSkeletonLoader />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={{ color: themeColors.destructive }}>{error}</Text>
          </View>
        ) : invoice ? (
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.scrollViewContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Export Test */}
            <View style={[styles.section, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.foreground }]}>
                Export Test
              </Text>
              <Text style={[styles.infoText, { color: themeColors.mutedForeground }]}>
                Export the canvas below to see exactly how it looks in PDF format.
              </Text>
              
              <TouchableOpacity 
                style={[styles.testButton, { marginTop: 12 }]} 
                onPress={handleExportTest}
              >
                <Text style={styles.testButtonText}>📄 Export This Exact Layout</Text>
                <Text style={[styles.testButtonText, { fontSize: 10 }]}>
                  What you see = what you get
                </Text>
              </TouchableOpacity>
            </View>

            {/* Maximum Canvas View */}
            <View style={{ padding: 16, backgroundColor: '#f5f5f5', borderRadius: 8 }}>
              <Text style={[styles.layoutItemTitle, { color: themeColors.foreground, textAlign: 'center', marginBottom: 8 }]}>
                📄 Maximum Invoice View
              </Text>
              
              <View style={{
                transform: [{ scale: 1.84 }],
                alignSelf: 'center',
                marginTop: 150,
              }}>
                <SkiaInvoiceCanvas
                  ref={a4ExportRef}
                  invoice={invoice}
                  client={client}
                  business={businessSettings}
                  currencySymbol={currencySymbol}
                  renderSinglePage={0}
                  style={{ 
                    width: displayWidth, 
                    height: displayHeight,
                    backgroundColor: 'white',
                  }}
                />
              </View>
              
              <Text style={[styles.dimensionText, { color: themeColors.mutedForeground, textAlign: 'center', marginTop: 4 }]}>
                {Math.round(displayWidth)}×{Math.round(displayHeight)}px (Compact Export Size)
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centered}>
            <Text style={{ color: themeColors.mutedForeground }}>No invoice data available.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export default ExportTestScreen; 
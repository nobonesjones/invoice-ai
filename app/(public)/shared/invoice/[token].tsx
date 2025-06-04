import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, Linking, Share } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Download, Eye, Share2, FileText, Copy } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';

import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/typography';
import { useTheme } from '@/context/theme-provider';
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from '../../../(app)/(protected)/invoices/InvoiceTemplateOne';
import { generateInvoiceTemplateOneHtml } from '../../../utils/generateInvoiceTemplateOneHtml';

interface SharedInvoiceData {
  share: {
    id: string;
    expires_at: string | null;
  };
  invoice: any;
  businessSettings: any;
  paymentOptions: any;
}

export default function SharedInvoiceView() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { theme } = useTheme();
  
  const [invoiceData, setInvoiceData] = useState<SharedInvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadLoading, setDownloadLoading] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvoiceData();
    }
  }, [token]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get invoice data from our edge function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/functions/v1/shared-invoice/${token}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to load invoice');
      }

      setInvoiceData(result.data);
    } catch (err) {
      console.error('Error loading shared invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const trackEvent = async (eventType: 'download' | 'print' | 'copy_link') => {
    try {
      await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/functions/v1/shared-invoice/${token}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventType,
            userAgent: navigator?.userAgent,
            referrer: document?.referrer,
          }),
        }
      );
    } catch (err) {
      console.warn('Failed to track event:', err);
    }
  };

  const handleDownload = async () => {
    if (!invoiceData) return;
    
    try {
      setDownloadLoading(true);
      
      // Track download event
      await trackEvent('download');

      // Generate PDF HTML
      const htmlContent = generateInvoiceTemplateOneHtml({
        invoice: {
          ...invoiceData.invoice,
          invoice_line_items: invoiceData.invoice.invoice_line_items || [],
          clients: invoiceData.invoice.clients,
          currency_symbol: '£', // You might want to get this from business settings
          currency: 'GBP',
          invoice_tax_label: 'VAT',
          paid_amount: 0,
        },
        businessSettings: invoiceData.businessSettings,
        paymentOptions: invoiceData.paymentOptions,
      });

      // Generate PDF
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      // Share the PDF file
      await Share.share({
        url: uri,
        title: `Invoice ${invoiceData.invoice.invoice_number}`,
      });

    } catch (err) {
      console.error('Error downloading invoice:', err);
      Alert.alert('Error', 'Failed to download invoice. Please try again.');
    } finally {
      setDownloadLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!invoiceData) return;
    
    try {
      // Track print event
      await trackEvent('print');

      // Generate PDF HTML
      const htmlContent = generateInvoiceTemplateOneHtml({
        invoice: {
          ...invoiceData.invoice,
          invoice_line_items: invoiceData.invoice.invoice_line_items || [],
          clients: invoiceData.invoice.clients,
          currency_symbol: '£',
          currency: 'GBP',
          invoice_tax_label: 'VAT',
          paid_amount: 0,
        },
        businessSettings: invoiceData.businessSettings,
        paymentOptions: invoiceData.paymentOptions,
      });

      // Print the HTML
      await Print.printAsync({
        html: htmlContent,
      });

    } catch (err) {
      console.error('Error printing invoice:', err);
      Alert.alert('Error', 'Failed to print invoice. Please try again.');
    }
  };

  const handleCopyLink = async () => {
    try {
      const currentUrl = window?.location?.href || `https://your-app.com/shared/invoice/${token}`;
      await Clipboard.setStringAsync(currentUrl);
      
      // Track copy link event
      await trackEvent('copy_link');
      
      Alert.alert('Success', 'Invoice link copied to clipboard!');
    } catch (err) {
      console.error('Error copying link:', err);
      Alert.alert('Error', 'Failed to copy link. Please try again.');
    }
  };

  const formatInvoiceForTemplate = (data: SharedInvoiceData): InvoiceForTemplate => {
    return {
      id: data.invoice.id,
      user_id: data.invoice.user_id,
      client_id: data.invoice.client_id,
      invoice_number: data.invoice.invoice_number,
      status: data.invoice.status,
      invoice_date: data.invoice.invoice_date,
      due_date: data.invoice.due_date,
      po_number: data.invoice.po_number,
      custom_headline: data.invoice.custom_headline,
      subtotal_amount: data.invoice.subtotal_amount,
      discount_type: data.invoice.discount_type,
      discount_value: data.invoice.discount_value,
      tax_percentage: data.invoice.tax_percentage,
      total_amount: data.invoice.total_amount,
      notes: data.invoice.notes,
      stripe_active: data.invoice.stripe_active,
      bank_account_active: data.invoice.bank_account_active,
      paypal_active: data.invoice.paypal_active,
      created_at: data.invoice.created_at,
      updated_at: data.invoice.updated_at,
      due_date_option: data.invoice.due_date_option,
      invoice_tax_label: 'VAT',
      clients: data.invoice.clients,
      invoice_line_items: data.invoice.invoice_line_items || [],
      currency: 'GBP',
      currency_symbol: '£',
      paid_amount: 0,
    };
  };

  const formatBusinessSettings = (data: SharedInvoiceData): BusinessSettingsRow => {
    return {
      ...data.businessSettings,
      paypal_enabled: data.paymentOptions?.paypal_enabled || false,
      paypal_email: data.paymentOptions?.paypal_email,
      stripe_enabled: data.paymentOptions?.stripe_enabled || false,
      bank_transfer_enabled: data.paymentOptions?.bank_transfer_enabled || false,
      bank_details: data.paymentOptions?.bank_details,
      invoice_terms_notes: data.paymentOptions?.invoice_terms_notes,
      auto_apply_tax: data.businessSettings?.auto_apply_tax || false,
      tax_name: data.businessSettings?.tax_name || 'VAT',
    };
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ title: 'Loading Invoice...' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ marginTop: 16, color: theme.foreground }}>Loading invoice...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !invoiceData) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <Stack.Screen options={{ title: 'Invoice Not Found' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <FileText size={48} color={theme.mutedForeground} />
          <H1 style={{ marginTop: 16, textAlign: 'center' }}>Invoice Not Found</H1>
          <Text style={{ marginTop: 8, textAlign: 'center', color: theme.mutedForeground }}>
            {error || 'This invoice link may have expired or been deactivated.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <Stack.Screen 
        options={{ 
          title: `Invoice ${invoiceData.invoice.invoice_number}`,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                variant="ghost"
                size="sm"
                onPress={handleCopyLink}
              >
                <Copy size={18} color={theme.foreground} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={handlePrint}
              >
                <FileText size={18} color={theme.foreground} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onPress={handleDownload}
                disabled={downloadLoading}
              >
                {downloadLoading ? (
                  <ActivityIndicator size="small" color={theme.foreground} />
                ) : (
                  <Download size={18} color={theme.foreground} />
                )}
              </Button>
            </View>
          )
        }} 
      />
      
      <ScrollView style={{ flex: 1 }}>
        {/* Action buttons at top */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          padding: 16, 
          borderBottomWidth: 1, 
          borderBottomColor: theme.border,
          backgroundColor: theme.card 
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Eye size={16} color={theme.mutedForeground} />
            <Text style={{ marginLeft: 8, color: theme.mutedForeground, fontSize: 14 }}>
              Shared Invoice
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button
              variant="outline"
              size="sm"
              onPress={handlePrint}
            >
              <FileText size={16} color={theme.foreground} />
              <Text style={{ marginLeft: 4, color: theme.foreground }}>Print</Text>
            </Button>
            
            <Button
              variant="default"
              size="sm"
              onPress={handleDownload}
              disabled={downloadLoading}
            >
              {downloadLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Download size={16} color="white" />
              )}
              <Text style={{ marginLeft: 4, color: 'white' }}>
                {downloadLoading ? 'Downloading...' : 'Download'}
              </Text>
            </Button>
          </View>
        </View>

        {/* Invoice preview */}
        <View style={{ backgroundColor: theme.background }}>
          <InvoiceTemplateOne
            invoice={formatInvoiceForTemplate(invoiceData)}
            businessSettings={formatBusinessSettings(invoiceData)}
            isReadOnly={true}
          />
        </View>

        {/* Expiration notice if applicable */}
        {invoiceData.share.expires_at && (
          <View style={{ 
            margin: 16, 
            padding: 12, 
            backgroundColor: theme.card, 
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border
          }}>
            <Text style={{ color: theme.mutedForeground, fontSize: 12, textAlign: 'center' }}>
              This invoice link expires on {new Date(invoiceData.share.expires_at).toLocaleDateString()}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
} 
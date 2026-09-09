import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, Alert, ActivityIndicator, Linking, Share } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Download, Eye, Share2, FileText, Copy } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';

import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { H1 } from '@/components/ui/typography';
import { useTheme } from '@/context/theme-provider';
import { InvoiceDocumentView } from '@/components/InvoiceDocumentView';
import { buildInvoiceDocument } from '@/lib/invoice-doc/buildInvoiceDocument';
import { renderInvoicePdf, printInvoice } from '@/lib/invoice-doc/pdf';
import { InvoiceShareService } from '../../../../services/invoiceShareService';

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
  const [paying, setPaying] = useState(false);

  const sharedDoc = useMemo(
    () =>
      invoiceData
        ? buildInvoiceDocument({
            type: 'invoice',
            row: invoiceData.invoice,
            client: invoiceData.invoice.clients,
            business: {
              ...invoiceData.businessSettings,
              paypal_email: invoiceData.paymentOptions?.paypal_email,
              bank_details: invoiceData.paymentOptions?.bank_details,
            },
          })
        : null,
    [invoiceData],
  );

  useEffect(() => {
    if (token) {
      loadInvoiceData();
    }
  }, [token]);

  const loadInvoiceData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!token) {
        throw new Error('Invalid share token');
      }

      // Get invoice data using the share service
      const result = await InvoiceShareService.getInvoiceByShareToken(token);

      if (!result.success) {
        throw new Error(result.error || 'Failed to load invoice');
      }

      // Transform the data to match expected format
      const invoiceData: SharedInvoiceData = {
        share: {
          id: result.data!.share.id,
          expires_at: result.data!.share.expires_at
        },
        invoice: result.data!.invoice,
        businessSettings: result.data!.businessSettings,
        paymentOptions: result.data!.paymentOptions
      };

      setInvoiceData(invoiceData);

      // Track the view event
      await InvoiceShareService.trackShareEvent(token, 'view', {
        userAgent: navigator?.userAgent,
        referrer: document?.referrer,
      });

    } catch (err) {
      console.error('Error loading shared invoice:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const trackEvent = async (eventType: 'download' | 'print' | 'copy_link') => {
    try {
      if (!token) return;
      
      await InvoiceShareService.trackShareEvent(token, eventType, {
        userAgent: navigator?.userAgent,
        referrer: document?.referrer,
      });
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

      if (!sharedDoc) throw new Error('Invoice not loaded');
      const { uri } = await renderInvoicePdf(sharedDoc);

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

      if (!sharedDoc) throw new Error('Invoice not loaded');
      await printInvoice(sharedDoc);

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

  const handlePayNow = async () => {
    if (!invoiceData) return;

    // Check if GoCardless is enabled for this invoice
    if (!invoiceData.invoice.gocardless_active) {
      Alert.alert('Payment Not Available', 'Online payment is not enabled for this invoice.');
      return;
    }

    setPaying(true);

    try {
      const response = await fetch(
        'https://wzpuzqzsjdizmpiobsuo.supabase.co/functions/v1/gocardless-create-payment',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.EXPO_PUBLIC_ANON_KEY!,
          },
          body: JSON.stringify({
            invoice_id: invoiceData.invoice.id,
            return_url: `superinvoice://payment-complete?invoice_id=${invoiceData.invoice.id}`,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      if (data.authorisation_url) {
        // Open in browser - customer completes bank payment there
        await Linking.openURL(data.authorisation_url);
      }
    } catch (err) {
      console.error('[GoCardless] Payment error:', err);
      Alert.alert('Payment Error', err instanceof Error ? err.message : 'Failed to initiate payment. Please try again.');
    } finally {
      setPaying(false);
    }
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

            {invoiceData.invoice.gocardless_active && invoiceData.invoice.status !== 'paid' && (
              <Button
                variant="default"
                size="sm"
                onPress={handlePayNow}
                disabled={paying}
                style={{ backgroundColor: theme.primary }}
              >
                {paying ? (
                  <ActivityIndicator size="small" color="white" />
                ) : null}
                <Text style={{ marginLeft: paying ? 4 : 0, color: 'white', fontWeight: '600' }}>
                  {paying ? 'Processing...' : `Pay £${Number(invoiceData.invoice.total_amount).toFixed(2)}`}
                </Text>
              </Button>
            )}
          </View>
        </View>

        {/* Invoice preview */}
        <View style={{ backgroundColor: theme.background }}>
          {sharedDoc ? (
            <View style={{ height: 1000 }}>
              <InvoiceDocumentView doc={sharedDoc} />
            </View>
          ) : null}
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
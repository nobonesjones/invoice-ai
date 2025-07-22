import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as Sharing from 'expo-sharing';
import { generateInvoiceTemplateOneHtml, PdfInvoiceData } from '@/utils/generateInvoiceTemplateOneHtml'; // Updated function and file name
import { InvoiceForTemplate, BusinessSettingsRow } from '../app/(app)/(protected)/invoices/InvoiceTemplateOne'; // Adjusted path

interface UseInvoiceSenderProps {
  invoice: InvoiceForTemplate | null;
  businessSettings: BusinessSettingsRow | null;
}

interface UseInvoiceSenderReturn {
  sendInvoicePdf: () => Promise<void>;
  isSending: boolean;
  error: string | null;
}

const useInvoiceSender = ({ invoice, businessSettings }: UseInvoiceSenderProps): UseInvoiceSenderReturn => {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // preparePdfData function will be moved here
  const preparePdfData = (currentInvoice: InvoiceForTemplate, currentBusinessSettings: BusinessSettingsRow): PdfInvoiceData => {
    // This logic will be moved from invoice-viewer.tsx
    return {
      invoice: {
        ...currentInvoice,
        // Ensure all PdfInvoice fields are mapped correctly
        // For example, if PdfInvoice expects 'clients' as an object but InvoiceForTemplate has it nested,
        // adjust here. Based on current types, it should be mostly direct.
      },
      businessSettings: currentBusinessSettings,
    };
  };

  const sendInvoicePdf = async () => {
    if (!invoice || !businessSettings) {
      Alert.alert('Error', 'Invoice data or business settings are missing.');
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const dataForHtml = preparePdfData(invoice, businessSettings);
      const htmlContent = generateInvoiceTemplateOneHtml(dataForHtml);

      const options = {
        html: htmlContent,
        fileName: `Invoice_${invoice.invoice_number || 'details'}`,
        directory: Platform.OS === 'android' ? 'Downloads' : 'Documents', // iOS needs 'Documents' or similar, Android 'Downloads'
        base64: true,
        width: 595, // A4 width in points (8.27 inches * 72 points/inch)
        height: 842, // A4 height in points (11.69 inches * 72 points/inch)
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        bgColor: '#FFFFFF',
      };

      const pdf = await RNHTMLtoPDF.convert(options);

      // Check if sharing is available
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      // Share the PDF using Expo Sharing
      await Sharing.shareAsync(pdf.filePath, {
        mimeType: 'application/pdf',
        dialogTitle: `Invoice ${invoice.invoice_number}`,
        UTI: 'com.adobe.pdf',
      });

    } catch (e: any) {
      console.error('Failed to send PDF:', e);
      Alert.alert('Error', `Failed to generate or share PDF. ${e.message || ''}`);
      setError(e.message || 'Failed to send PDF.');
    } finally {
      setIsSending(false);
    }
  };

  return { sendInvoicePdf, isSending, error };
};

export default useInvoiceSender;

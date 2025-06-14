import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  Switch,
  Alert,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Dimensions,
  Linking,
  Clipboard,
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams, useFocusEffect, useNavigation } from 'expo-router';
import {
  ArrowLeft,
  Edit3,
  MoreHorizontal,
  Clock,
  Send,
  Maximize,
  ChevronLeft,
  History,
  User,
  Mail,
  FileText,
  X as XIcon,
  Link2,
  Plus,
  Settings,
  Trash2,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Bell,
  Share2,
  BarChart3,
} from 'lucide-react-native';
import { useTheme } from '@/context/theme-provider';
import { colors as globalColors } from '@/constants/colors';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useSupabase } from '@/context/supabase-provider'; 
import type { Database, Json, Tables } from '../../../../types/database.types'; 
import InvoiceTemplateOne, { InvoiceForTemplate, BusinessSettingsRow } from './InvoiceTemplateOne'; 
import InvoiceSkeletonLoader from '@/components/InvoiceSkeletonLoader';
import { BottomSheetModal, BottomSheetModalProvider, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { generateInvoiceTemplateOneHtml } from '../../../utils/generateInvoiceTemplateOneHtml';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusSelectorSheet } from '@/components/StatusSelectorSheet';
import { PaymentAmountSheet } from '@/components/PaymentAmountSheet';
import { InvoiceStatus, getStatusConfig, isEditable, calculatePaymentStatus } from '@/constants/invoice-status';
import { useInvoiceActivityLogger } from './useInvoiceActivityLogger';
import InvoiceHistorySheet, { InvoiceHistorySheetRef } from './InvoiceHistorySheet';
import MakePaymentSheet, { MakePaymentSheetRef, PaymentData } from './MakePaymentSheet';
import { InvoiceShareService } from '../../../../services/invoiceShareService';

// NEW SKIA IMPORTS
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';
import SkiaInvoiceCanvasModern from '@/components/skia/SkiaInvoiceCanvasModern';
import { SkiaInvoiceCanvasSimple } from '@/components/skia/SkiaInvoiceCanvasSimple';
import { useCanvasRef } from '@shopify/react-native-skia';

// PDF-LIB IMPORT FOR SUPERIOR PDF EXPORT
import { PDFDocument } from 'pdf-lib';

type ClientRow = Tables<'clients'>;

type InvoiceRow = Database['public']['Tables']['invoices']['Row'];

interface PreviewLineItem {
  id: string; 
  user_saved_item_id?: string | null;
  item_name: string;
  description?: string | null; 
  quantity: number;
  unit_price: number; 
  total_price: number;
  line_item_discount_type?: 'percentage' | 'fixed' | null;
  line_item_discount_value?: number | null;
  item_image_url?: string | null;
}

interface PreviewInvoiceData {
  invoice_number: string;
  client_id: string | null; 
  clientName?: string; 
  invoice_date: string; 
  due_date: string | null; 
  due_date_option: string | null;
  items: PreviewLineItem[];
  po_number?: string;
  custom_headline?: string;
  taxPercentage?: number | null;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number | null;
  subTotalAmount?: number; 
  totalAmount?: number;    
  notes?: string;
  payment_instructions_active_on_invoice?: boolean; 
  bank_account_active_on_invoice?: boolean;     
  paypal_active_on_invoice?: boolean;         
  stripe_active_on_invoice?: boolean;           
  currency: string; 
}

interface PdfInvoiceData {
  invoice: InvoiceForTemplate & { payment_terms?: string };
  businessSettings: BusinessSettingsRow;
  paymentOptions: any; // Add the missing paymentOptions property
}

const preparePdfData = (invoiceData: InvoiceForTemplate, businessSettingsData: BusinessSettingsRow, paymentOptionsData: any = null): PdfInvoiceData => {
  // Create a properly typed invoice object for PDF generation
  const htmlInvoiceData: InvoiceForTemplate & { payment_terms?: string } = {
    ...invoiceData, 
    payment_terms: 'Payment due upon receipt.', 
    // Ensure all fields are properly typed - these are already handled in fetchInvoiceData
    due_date: invoiceData.due_date,
    custom_headline: invoiceData.custom_headline,
  };

  return {
    invoice: htmlInvoiceData,
    businessSettings: businessSettingsData,
    paymentOptions: paymentOptionsData,
  };
};

function InvoiceViewerScreen() {
  const { isLightMode } = useTheme();
  const themeColors = isLightMode ? globalColors.light : globalColors.dark;
  const router = useRouter();
  const { id: invoiceId } = useLocalSearchParams<{ id: string }>();
  const { supabase, user } = useSupabase(); 
  const { logPaymentAdded, logStatusChanged, logInvoiceSent } = useInvoiceActivityLogger();

  const [invoice, setInvoice] = useState<InvoiceForTemplate | null>(null);
  const [client, setClient] = useState<ClientRow | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInvoiceReady, setIsInvoiceReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreviewingFromCreate, setIsPreviewingFromCreate] = useState(false); 
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Ref for the Send Invoice Modal
  const sendInvoiceModalRef = useRef<BottomSheetModal>(null);
  
  // Ref for the Status Selector Modal
  const statusSelectorModalRef = useRef<BottomSheetModal>(null);
  
  // Ref for the Payment Amount Modal
  const paymentAmountModalRef = useRef<BottomSheetModal>(null);

  // Ref for the History Modal
  const historyModalRef = useRef<InvoiceHistorySheetRef>(null);

  // Add new ref for more options modal
  const moreOptionsSheetRef = useRef<BottomSheetModal>(null);

  // Add ref for MakePaymentSheet
  const makePaymentSheetRef = useRef<MakePaymentSheetRef>(null);

  // Snap points for the Send Invoice Modal
  const sendInvoiceSnapPoints = useMemo(() => ['35%', '50%'], []); // Adjust as needed

  // Snap points for the Status Selector Modal
  const statusSelectorSnapPoints = useMemo(() => ['60%', '80%'], []);
  
  // Snap points for the Payment Amount Modal
  const paymentAmountSnapPoints = useMemo(() => ['75%', '90%'], []);

  // Add ref for Skia canvas export
  const skiaInvoiceRef = useCanvasRef();
  
  // Add refs and state for multi-page export
  const exportCanvasRefs = useRef<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportTotalPages, setExportTotalPages] = useState(1);

  const { setIsTabBarVisible } = useTabBarVisibility(); // Use the context

  const handleOpenSendModal = useCallback(() => {
    sendInvoiceModalRef.current?.present();
  }, []);

  // Callback to close the Send Invoice Modal
  const handleCloseSendModal = useCallback(() => {
    sendInvoiceModalRef.current?.dismiss();
  }, []);

  // Tab bar visibility management (following pagetransitions.md Approach 2)
  const navigation = useNavigation();
  
  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      console.log('[InvoiceViewerScreen] Focus event: Hiding tab bar');
      setIsTabBarVisible(false);
    });

    const unsubscribeBlur = navigation.addListener('blur', () => {
      console.log('[InvoiceViewerScreen] Blur event: Showing tab bar');
      setIsTabBarVisible(true);
    });

    // Initial hide if screen is focused on mount
    if (navigation.isFocused()) {
      console.log('[InvoiceViewerScreen] Initial focus: Hiding tab bar');
      setIsTabBarVisible(false);
    }

    return () => {
      console.log('[InvoiceViewerScreen] Unmounting: Ensuring tab bar is visible');
      unsubscribeFocus();
      unsubscribeBlur();
      setIsTabBarVisible(true);
    };
  }, [navigation, setIsTabBarVisible]);

  const handleSendByEmail = async () => {
    if (!invoice || !businessSettings) {
      Alert.alert('Error', 'Invoice or business data is not available.');
      return;
    }

    if (!supabase) {
      Alert.alert('Error', 'Unable to send invoice at this time.');
      return;
    }

    try {
      console.log('[handleSendByEmail] Generating Skia PDF for email sharing:', invoice.id);
      
      // Use Skia canvas to generate PDF (same as handleSendPDF)
      const image = skiaInvoiceRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot from invoice canvas');
      }
      
      console.log('[handleSendByEmail] Skia canvas captured successfully');
      
      // Encode to bytes and convert to base64
      const bytes = image.encodeToBytes();
      
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64String = btoa(binaryString);
      
             // Create HTML that uses the exact canvas dimensions (no scaling or margins)
       const htmlContent = `
         <!DOCTYPE html>
         <html>
         <head>
           <meta charset="utf-8">
           <style>
             @page {
               margin: 0;
               size: ${image.width()}px ${image.height()}px;
             }
             body {
               margin: 0;
               padding: 0;
               width: ${image.width()}px;
               height: ${image.height()}px;
               overflow: hidden;
             }
             .invoice-image {
               width: ${image.width()}px;
               height: ${image.height()}px;
               display: block;
               object-fit: none;
             }
           </style>
         </head>
         <body>
           <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice ${invoice.invoice_number}" />
         </body>
         </html>
       `;
      
      console.log('[handleSendByEmail] Generating PDF with Skia image');
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      console.log('[handleSendByEmail] PDF generated successfully at:', uri);

      // Update invoice status to sent
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleSendByEmail] Error updating status:', updateError);
        Alert.alert('Error', 'Failed to update invoice status.');
        return;
      }

      // Log the send activity
      await logInvoiceSent(invoice.id, invoice.invoice_number, 'email');

      // Update local state
      setInvoice(prev => prev ? { ...prev, status: 'sent' } : null);

      // Share the PDF directly - user can choose email from the share dialog
      await Sharing.shareAsync(uri, { 
        mimeType: 'application/pdf', 
        dialogTitle: 'Send Invoice via Email' 
      });

      Alert.alert('Invoice Ready', 'Choose your email app from the share options to send the invoice.');
      handleCloseSendModal(); // Close the send modal
      
      // Refresh invoice data to reflect status change
      if (invoiceId) {
        const refreshedInvoice = await fetchInvoiceData(invoiceId);
        if (refreshedInvoice) {
          setInvoice(refreshedInvoice);
        }
      }
      
    } catch (error: any) {
      console.error('[handleSendByEmail] Error generating PDF or sharing:', error);
      Alert.alert('Error', `Failed to prepare invoice for email: ${error.message}`);
    }
  };

  const handleSendLink = async () => {
    if (!invoice || !supabase) {
      Alert.alert('Error', 'Unable to send invoice at this time.');
      return;
    }

    try {
      // Update invoice status to sent
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleSendLink] Error updating status:', updateError);
        Alert.alert('Error', 'Failed to update invoice status.');
        return;
      }

      // Log the send activity
      await logInvoiceSent(invoice.id, invoice.invoice_number, 'link');

      // Update local state
      setInvoice(prev => prev ? { ...prev, status: 'sent' } : null);

      Alert.alert('Link Shared', 'Invoice link has been shared.');
      handleCloseSendModal(); // Close the send modal
      
      // Refresh invoice data to reflect status change
      if (invoiceId) {
        const refreshedInvoice = await fetchInvoiceData(invoiceId);
        if (refreshedInvoice) {
          setInvoice(refreshedInvoice);
        }
      }
    } catch (error: any) {
      console.error('[handleSendLink] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while sharing the invoice link.');
    }
  };

  const handleSendPDF = async () => {
    if (!invoice || !businessSettings) {
      Alert.alert('Error', 'Cannot export PDF - invoice data or business settings not loaded');
      return;
    }

    try {
      console.log('[PDF_MULTIPAGE_EXPORT] Starting multi-page export for invoice:', invoice.invoice_number);
      
      // First, check if this invoice needs pagination using same logic as canvas
      const lineItems = invoice?.invoice_line_items || [];
      const totalItems = lineItems.length;
      const maxItemsFirstPage = 10; // Same as canvas calculation
      const adjustedMaxItemsFirstPage = 12; // Two-page special case
      const needsPagination = totalItems > adjustedMaxItemsFirstPage;
      
      if (!needsPagination) {
        console.log('[PDF_MULTIPAGE_EXPORT] Single page invoice - using standard export');
        // Single page - use existing logic
        const image = skiaInvoiceRef.current?.makeImageSnapshot();
        
        if (!image) {
          throw new Error('Failed to create image snapshot from invoice canvas');
        }
        
        const actualWidth = image.width();
        const actualHeight = image.height();
        const imageBytes = image.encodeToBytes();
        
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([actualWidth, actualHeight]);
        const pdfImage = await pdfDoc.embedPng(imageBytes);
        
        page.drawImage(pdfImage, {
          x: 0,
          y: 0,
          width: actualWidth,
          height: actualHeight,
        });
        
        const pdfBytes = await pdfDoc.save();
        const fileName = `invoice-${invoice.invoice_number}.pdf`;
        const fileUri = `${FileSystem.documentDirectory}${fileName}`;
        
        const chunkSize = 8192;
        let binaryString = '';
        
        for (let i = 0; i < pdfBytes.length; i += chunkSize) {
          const chunk = pdfBytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64String = btoa(binaryString);
        
        await FileSystem.writeAsStringAsync(
          fileUri,
          base64String,
          { encoding: FileSystem.EncodingType.Base64 }
        );
        
              // Update invoice status to sent
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleSendPDF] Error updating status:', updateError);
        Alert.alert('Error', 'Failed to update invoice status.');
        return;
      }

      // Log the send activity
      await logInvoiceSent(invoice.id, invoice.invoice_number, 'pdf');

      // Update local state
      setInvoice(prev => prev ? { ...prev, status: 'sent' } : null);
        
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${invoice.invoice_number} PDF`
        });
        
        handleCloseSendModal();
      
      // Refresh invoice data to reflect status change
      if (invoiceId) {
        const refreshedInvoice = await fetchInvoiceData(invoiceId);
        if (refreshedInvoice) {
          setInvoice(refreshedInvoice);
        }
      }
        return;
      }
      
      // Multi-page invoice - calculate pages
      console.log('[PDF_MULTIPAGE_EXPORT] Multi-page invoice detected, total items:', totalItems);
      
      const remainingItems = totalItems - adjustedMaxItemsFirstPage;
      const itemsPerSubsequentPage = Math.floor((295 - 50) / 20); // Use actual display canvas height
      const totalPages = remainingItems > 0 ? 
        1 + Math.ceil(remainingItems / itemsPerSubsequentPage) : 1;
      
      console.log('[PDF_MULTIPAGE_EXPORT] Calculated pages:', totalPages);
      
      const pdfDoc = await PDFDocument.create();
      const pageImages: any[] = [];
      
      // For now, we'll capture the full canvas and split it manually
      // This is a temporary solution until we implement proper page-by-page rendering
      console.log('[PDF_MULTIPAGE_EXPORT] Capturing full canvas for splitting');
      const fullImage = skiaInvoiceRef.current?.makeImageSnapshot();
      
      if (!fullImage) {
        throw new Error('Failed to create image snapshot from invoice canvas');
      }
      
      const fullImageBytes = fullImage.encodeToBytes();
      const canvasWidth = fullImage.width();
      const fullCanvasHeight = fullImage.height();
      
      // CRITICAL FIX: Use actual captured dimensions, not display dimensions
      // The captured canvas is scaled up (device pixel ratio = 3x in this case)
      const actualSinglePageHeight = Math.round(fullCanvasHeight / totalPages); // Calculate from actual captured dimensions
      
      console.log('[PDF_MULTIPAGE_EXPORT] === CANVAS ANALYSIS ===');
      console.log('[PDF_MULTIPAGE_EXPORT] Full canvas dimensions:', canvasWidth, 'x', fullCanvasHeight);
      console.log('[PDF_MULTIPAGE_EXPORT] ACTUAL single page height (calculated):', actualSinglePageHeight);
      console.log('[PDF_MULTIPAGE_EXPORT] Scale factor detected:', fullCanvasHeight / (totalPages * 590)); // 590 is logical canvas height per page
      console.log('[PDF_MULTIPAGE_EXPORT] Expected Page 1 Y-range: 0 to', actualSinglePageHeight);
      console.log('[PDF_MULTIPAGE_EXPORT] Expected Page 2 Y-range:', (actualSinglePageHeight), 'to', (2 * actualSinglePageHeight));
      console.log('[PDF_MULTIPAGE_EXPORT] Total pages to generate:', totalPages);
      console.log('[PDF_MULTIPAGE_EXPORT] === PAGE NUMBER POSITIONING ANALYSIS ===');
      console.log('[PDF_MULTIPAGE_EXPORT] Page 1 number should be at Y:', '(canvasHeight - 30) = (560 - 30) = 530');
      console.log('[PDF_MULTIPAGE_EXPORT] Page 2 number should be at Y:', '(pageYOffset + canvasHeight - 30) = (590 + 560 - 30) = 1120');
      console.log('[PDF_MULTIPAGE_EXPORT] Page 1 crop range: 0 to', actualSinglePageHeight, '(includes 530? =', 530 < actualSinglePageHeight, ')');
      console.log('[PDF_MULTIPAGE_EXPORT] Page 2 crop range:', actualSinglePageHeight, 'to', (2 * actualSinglePageHeight), '(includes 1120? =', 1120 >= actualSinglePageHeight && 1120 < (2 * actualSinglePageHeight), ')');
      console.log('[PDF_MULTIPAGE_EXPORT] === END ANALYSIS ===');
      
      // For each page, we'll create a standard-sized PDF page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        console.log(`[PDF_MULTIPAGE_EXPORT] Creating PDF page ${pageNum} of ${totalPages}`);
        
        // Create a page with increased height (60px longer for multi-page invoices)
        const page = pdfDoc.addPage([612, 852]);
        const pdfImage = await pdfDoc.embedPng(fullImageBytes);
        
        // Use the same positioning method for ALL pages (it works perfectly for Page 2)
        // FIXED: Invert the page logic since canvas structure is opposite of expected
        const pageYOffset = (totalPages - pageNum) * actualSinglePageHeight; // Inverted: Page 1 gets last section, Page 2 gets first section
        const scaleToFitWidth = 612 / canvasWidth;
        const scaledWidth = canvasWidth * scaleToFitWidth;
        const scaledHeight = fullCanvasHeight * scaleToFitWidth;
        const scaledPageYOffset = pageYOffset * scaleToFitWidth;
        
        // Position image so the TOP of the relevant section appears at TOP of PDF page
        // PDF coordinate system: Y=0 is bottom, Y=852 is top (increased by 60px)
        // We want the section top to appear at PDF top (Y=852)
        const scaledPageHeight = actualSinglePageHeight * scaleToFitWidth;
        const yPosition = 852 - scaledPageHeight - scaledPageYOffset; // Position to show section top at PDF top
        
        console.log(`[PDF_MULTIPAGE_EXPORT] Page ${pageNum} positioning (FIXED): pageYOffset=${pageYOffset}, scaledPageYOffset=${scaledPageYOffset}, scaledPageHeight=${scaledPageHeight}, yPosition=${yPosition}`);
        
        page.drawImage(pdfImage, {
          x: 0,
          y: yPosition,
          width: scaledWidth,
          height: scaledHeight, // Use full height for all pages
        });
        
        console.log(`[PDF_MULTIPAGE_EXPORT] Added page ${pageNum} to PDF`);
      }
      
      console.log('[PDF_MULTIPAGE_EXPORT] Finalizing PDF with', totalPages, 'pages');
      const pdfBytes = await pdfDoc.save();
      const fileName = `invoice-${invoice.invoice_number}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        const chunk = pdfBytes.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64String = btoa(binaryString);
      
      await FileSystem.writeAsStringAsync(
        fileUri,
        base64String,
        { encoding: FileSystem.EncodingType.Base64 }
      );
      
      // Update invoice status to sent
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: 'sent' })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleSendPDF] Error updating status:', updateError);
        Alert.alert('Error', 'Failed to update invoice status.');
        return;
      }

      // Log the send activity
      await logInvoiceSent(invoice.id, invoice.invoice_number, 'pdf');

      // Update local state
      setInvoice(prev => prev ? { ...prev, status: 'sent' } : null);
      
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice ${invoice.invoice_number} PDF (${totalPages} pages)`
      });
      
      handleCloseSendModal();
      
      // Refresh invoice data to reflect status change
      if (invoiceId) {
        const refreshedInvoice = await fetchInvoiceData(invoiceId);
        if (refreshedInvoice) {
          setInvoice(refreshedInvoice);
        }
      }
      
      console.log(`[PDF_MULTIPAGE_EXPORT] Export completed for ${invoice.invoice_number} with ${totalPages} pages`);
      
    } catch (error: any) { 
      console.error('[PDF_MULTIPAGE_EXPORT] Error:', error);
      Alert.alert('PDF Export Error', `Failed to export PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Custom backdrop for the modal
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5} // Standard dimming
      />
    ),
    []
  );

  const handleCustomBack = () => {
    console.log('[handleCustomBack] Called');
    
    // Simple back navigation - invoice-viewer is now only for final saved invoices
    // Preview functionality has been moved to dedicated preview screen
    console.log('[handleCustomBack] Navigating back to dashboard');
    // Use router.back() for proper left-to-right transition direction
    // DO NOT CHANGE TO router.replace() - this breaks transition direction
    // Only change if explicitly requested by user
    router.back(); 
  };

  const fetchBusinessSettings = async (userId: string) => {
    console.log('[fetchBusinessSettings] Function called with userId:', userId); 
    if (!userId) {
      console.error('[fetchBusinessSettings] No userId provided.');
      return;
    }

    try {
      const { data, error: settingsError } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', userId)
        .single(); 

      if (settingsError && settingsError.code !== 'PGRST116') {
        console.error('[fetchBusinessSettings] Error fetching base business settings:', settingsError);
        setError('Failed to load business settings.');
        setBusinessSettings(null); 
      } else {
        console.log('[fetchBusinessSettings] Raw data from business_settings table:', data);
        // 'data' here is the result from business_settings query
        if (data) {
          // Now fetch payment_options for the same user
          const { data: paymentOpts, error: paymentOptsError } = await supabase
            .from('payment_options') 
            .select('*')
            .eq('user_id', userId) 
            .single();

          console.log('[fetchBusinessSettings] Raw data from payment_options table:', paymentOpts);

          if (paymentOptsError && paymentOptsError.code !== 'PGRST116') {
            console.error('[fetchBusinessSettings] Error fetching payment options:', paymentOptsError);
            // Continue with base settings even if payment options fail, or handle error as preferred
          }

          // Merge paymentOpts into the base business settings data.
          // If paymentOpts is null (not found or error), it won't add/overwrite properties from 'data'.
          const combinedSettings = { ...data, ...(paymentOpts || {}) };
          console.log('[fetchBusinessSettings] Combined settings before setBusinessSettings:', combinedSettings);
          setBusinessSettings(combinedSettings as BusinessSettingsRow); 
        } else {
          // No base business_settings found (PGRST116 or data was null from first query)
          console.log('[fetchBusinessSettings] No base business settings found for this user. Setting to null.');
          setBusinessSettings(null);
        }
      }
    } catch (e: any) {
      console.error('[fetchBusinessSettings] Exception fetching business settings:', e.message);
      setError('An unexpected error occurred while fetching business settings.');
      setBusinessSettings(null);
    }
  };

  const fetchInvoiceData = async (invoiceId: string): Promise<Database['public']['Tables']['invoices']['Row'] | null> => {
    // Don't set loading state here - let the caller manage it
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
        console.error('[fetchInvoiceData] Supabase invoiceError:', invoiceError);
        setError('Failed to load invoice data.');
        setInvoice(null);
        return null;
      }

      if (!invoiceData) {
        setError('Invoice not found.');
        setInvoice(null);
        return null;
      }
      
      console.log('[fetchInvoiceData] Raw invoiceData from Supabase:', invoiceData);
      console.log('[fetchInvoiceData] invoiceData.clients:', invoiceData.clients);
      console.log('[fetchInvoiceData] invoiceData.invoice_line_items from Supabase:', invoiceData.invoice_line_items);

      // Fetch business_settings specifically for currency information for this invoice instance
      // This does NOT set the main businessSettings state used for payment methods display.
      const { data: businessDataForCurrency, error: businessError } = await supabase
        .from('business_settings')
        .select('currency_code') // Only select currency_code
        .eq('user_id', invoiceData.user_id)
        .single();

      if (businessError && businessError.code !== 'PGRST116') { // PGRST116: no rows found, which is okay if settings don't exist yet
        console.error('[fetchInvoiceData] Error fetching business_settings for currency:', businessError);
      }

      // Explicitly type as InvoiceForTemplate
      const fetchedInvoiceForTemplate: InvoiceForTemplate = {
        ...invoiceData,
        invoice_number: invoiceData.invoice_number ?? '', 
        clients: invoiceData.clients as Tables<'clients'> | null, // Align with InvoiceForTemplate type
        invoice_line_items: invoiceData.invoice_line_items as Tables<'invoice_line_items'>[], // Align with InvoiceForTemplate type
        currency: businessDataForCurrency?.currency_code || 'USD', 
        currency_symbol: getCurrencySymbol(businessDataForCurrency?.currency_code || 'USD'),
        // Add missing invoice_tax_label, ensuring it's a string
        invoice_tax_label: invoiceData.invoice_tax_label || 'Tax', 
        paid_amount: invoiceData.paid_amount,
        payment_date: invoiceData.payment_date,
        payment_notes: invoiceData.payment_notes,
        // Ensure due_date is never undefined - convert undefined to null
        due_date: invoiceData.due_date ?? null,
        // Ensure custom_headline is never undefined - convert undefined to null
        custom_headline: invoiceData.custom_headline ?? null,
      };
      
      console.log('[fetchInvoiceData] Constructed fetchedInvoiceForTemplate:', JSON.stringify(fetchedInvoiceForTemplate, null, 2));
      setInvoice(fetchedInvoiceForTemplate);
      if (invoiceData.clients) {
        setClient(invoiceData.clients as ClientRow);
      }
      setError(null);
      return fetchedInvoiceForTemplate as any; // Use type assertion to bypass type conflicts
    } catch (e: any) {
      console.error('[fetchInvoiceData] Exception:', e.message);
      setError('An unexpected error occurred while fetching invoice data.');
      setInvoice(null);
      return null;
    }
  };

  useEffect(() => {
    console.log(`[EFFECT START] InvoiceViewerScreen useEffect triggered.`);
    console.log(`[EFFECT PARAMS] id: ${invoiceId}`);
    setIsLoading(true); // Start loading
    setIsInvoiceReady(false); // Reset invoice ready state

    const processData = async () => {
      if (invoiceId) {
        console.log('[InvoiceViewerScreen useEffect] Attempting to call fetchInvoiceData with invoiceId:', invoiceId); 
        try {
          // Start timing for minimum loading duration
          const startTime = Date.now();
          const minLoadingTime = 800; // Minimum 800ms loading time
          
          const fetchedInvoice = await fetchInvoiceData(invoiceId);
          if (fetchedInvoice && fetchedInvoice.user_id) {
            const targetUserId = fetchedInvoice.user_id;
            console.log('[InvoiceViewerScreen useEffect] Attempting to call fetchBusinessSettings with targetUserId (from fetched invoiceData):', targetUserId); 
            if (targetUserId) await fetchBusinessSettings(targetUserId); // Await this operation too
          }
          
          // Ensure minimum loading time has passed
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime < minLoadingTime) {
            console.log(`[InvoiceViewerScreen] Waiting additional ${minLoadingTime - elapsedTime}ms for minimum loading time`);
            await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime));
          }
          
        } catch (error) {
          console.error('[processData] Error:', error);
          setError('Failed to load invoice data.');
        } finally {
          setIsLoading(false); // End loading after all async operations complete
        }
      } else {
        console.warn("[EFFECT] No invoice ID. Cannot load invoice.");
        setError('No invoice specified.');
        setIsLoading(false);
      }
    };

    processData();
  }, [invoiceId, supabase]);

  // Track when invoice is ready to render
  useEffect(() => {
    if (invoice && businessSettings && !isLoading) {
      console.log('[InvoiceViewerScreen] Invoice and business settings loaded, preparing to render...');
      // Add a small delay to ensure Skia canvas has time to render
      const timer = setTimeout(() => {
        console.log('[InvoiceViewerScreen] Setting invoice ready to true');
        setIsInvoiceReady(true);
      }, 300); // 300ms delay for Skia rendering
      
      return () => clearTimeout(timer);
    } else {
      console.log('[InvoiceViewerScreen] Invoice not ready:', { 
        hasInvoice: !!invoice, 
        hasBusinessSettings: !!businessSettings, 
        isLoading 
      });
      setIsInvoiceReady(false);
    }
  }, [invoice, businessSettings, isLoading]);

  // Refresh data when screen comes back into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      const refreshData = async () => {
        if (invoiceId && supabase) {
          console.log('[useFocusEffect] Refreshing invoice data on focus');
          try {
            const fetchedInvoice = await fetchInvoiceData(invoiceId);
            if (fetchedInvoice && fetchedInvoice.user_id) {
              const targetUserId = fetchedInvoice.user_id;
              if (targetUserId) await fetchBusinessSettings(targetUserId);
            }
          } catch (error) {
            console.error('[useFocusEffect] Error refreshing data:', error);
          }
          // Note: Don't set loading state here as this is a background refresh
        }
      };

      refreshData();
    }, [invoiceId, supabase])
  );

  const getCurrencySymbol = (currencyCode: string): string => {
    // Handles both codes and full names from the DB, e.g. 'GBP - British Pound'
    if (!currencyCode) return '$';
    const mapping: Record<string, string> = {
      'USD': '$',
      'USD - United States Dollar': '$',
      'GBP': '£',
      'GBP - British Pound': '£',
      'EUR': '€',
      'EUR - Euro': '€',
      // Add more as needed
    };
    // Try direct match
    if (mapping[currencyCode]) return mapping[currencyCode];
    // Try extracting code from start of string
    const code = currencyCode.split(' ')[0];
    if (mapping[code]) return mapping[code];
    return '$'; // Default fallback
  };

  // Calculate currency symbol for Skia canvas
  const currencySymbol = invoice?.currency ? getCurrencySymbol(invoice.currency) : '$';

  // Get the correct design component based on invoice-specific settings
  const getInvoiceDesignComponent = () => {
    const designType = invoice?.invoice_design || 'classic';
    console.log('[InvoiceViewer] Selected design type for invoice:', designType);
    
    switch (designType.toLowerCase()) {
      case 'modern':
        console.log('[InvoiceViewer] Using SkiaInvoiceCanvasModern');
        return SkiaInvoiceCanvasModern;
      case 'simple':
        console.log('[InvoiceViewer] Using SkiaInvoiceCanvasSimple');
        return SkiaInvoiceCanvasSimple;
      case 'classic':
      default:
        console.log('[InvoiceViewer] Using SkiaInvoiceCanvas (classic)');
        return SkiaInvoiceCanvas;
    }
  };

  const InvoiceDesignComponent = getInvoiceDesignComponent();

  // Get the accent color from invoice-specific settings
  const getAccentColor = () => {
    const savedColor = invoice?.accent_color || '#14B8A6';
    console.log('[InvoiceViewer] Using accent color for invoice:', savedColor);
    return savedColor;
  };

  const addAlpha = (color: string, opacity: number): string => {
    if (typeof color !== 'string' || !color.startsWith('#') || (color.length !== 7 && color.length !== 4)) {
      console.warn(`addAlpha: Color "${color}" is not a valid hex string. Opacity may not apply correctly.`);
      return color; 
    }
    const _opacity = Math.round(Math.min(Math.max(opacity || 1, 0), 1) * 255);
    let hexOpacity = _opacity.toString(16).toUpperCase();
    if (hexOpacity.length === 1) {
      hexOpacity = '0' + hexOpacity;
    }
    return color.slice(0, 7) + hexOpacity; 
  };

  interface StatusStyles {
    badgeStyle: ViewStyle;
    textStyle: TextStyle;
  }

  const getStatusBadgeStyle = (status?: string | null): StatusStyles => {
    const badgeStyle: ViewStyle = {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: themeColors.border,      
      backgroundColor: themeColors.card,    
    };
    const textStyle: TextStyle = {
      fontSize: 12,
      fontWeight: '500',
      color: themeColors.foreground, 
    };

    switch (status?.toLowerCase() || 'draft') {
      case 'draft':
        badgeStyle.borderColor = addAlpha(themeColors.destructive, 0.40);
        badgeStyle.backgroundColor = addAlpha(themeColors.destructive, 0.10);
        textStyle.color = themeColors.destructive;
        break;
      case 'sent':
      case 'viewed':
        badgeStyle.borderColor = addAlpha(themeColors.statusPaid, 0.7);
        badgeStyle.backgroundColor = addAlpha(themeColors.statusPaid, 0.15); 
        textStyle.color = themeColors.statusPaid;
        break;
      case 'paid':
        badgeStyle.borderColor = themeColors.statusPaid;
        badgeStyle.backgroundColor = addAlpha(themeColors.statusPaid, 0.15); 
        textStyle.color = themeColors.statusPaid;
        break;
      case 'overdue':
        badgeStyle.borderColor = themeColors.statusDue; 
        badgeStyle.backgroundColor = addAlpha(themeColors.statusDue, 0.15);
        textStyle.color = themeColors.statusDue; 
        break;
      case 'cancelled':
        badgeStyle.borderColor = themeColors.destructive; 
        badgeStyle.backgroundColor = addAlpha(themeColors.destructive, 0.15);
        textStyle.color = themeColors.destructive; 
        break;
      default:
        break;
    }
    return { badgeStyle, textStyle };
  };

  // Status selector modal handlers
  const handleOpenStatusSelector = useCallback(() => {
    statusSelectorModalRef.current?.present();
  }, []);

  const handleCloseStatusSelector = useCallback(() => {
    statusSelectorModalRef.current?.dismiss();
  }, []);

  // Payment amount modal handlers
  const handleOpenPaymentModal = useCallback(() => {
    paymentAmountModalRef.current?.present();
  }, []);

  const handleClosePaymentModal = useCallback(() => {
    paymentAmountModalRef.current?.dismiss();
  }, []);

  const handlePaymentUpdate = async (newPaidAmount: number, notes?: string) => {
    if (!invoice || !supabase) {
      Alert.alert('Error', 'Unable to update payment at this time.');
      return;
    }

    try {
      console.log(`[handlePaymentUpdate] Updating invoice ${invoice.id} payment: ${newPaidAmount}`);
      
      // Calculate status based on payment amount
      const newStatus = calculatePaymentStatus(newPaidAmount, invoice.total_amount);
      
      const updateData = {
        status: newStatus,
        paid_amount: newPaidAmount,
        payment_date: newPaidAmount > 0 ? new Date().toISOString() : null,
        payment_notes: notes || null
      };

      const { error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handlePaymentUpdate] Error updating payment:', updateError);
        Alert.alert('Error', `Failed to update payment: ${updateError.message}`);
        return;
      }

      // Log the payment activity
      await logPaymentAdded(
        invoice.id,
        invoice.invoice_number,
        newPaidAmount,
        notes || 'Payment update'
      );

      // Update local state
      setInvoice(prev => prev ? { 
        ...prev, 
        status: newStatus,
        paid_amount: newPaidAmount,
        payment_date: newPaidAmount > 0 ? new Date().toISOString() : null,
        payment_notes: notes || null
      } : null);
      
      const statusConfig = getStatusConfig(newStatus);
      Alert.alert(
        'Payment Updated', 
        `Payment recorded successfully. Invoice is now ${statusConfig.label}.`
      );
      
    } catch (error: any) {
      console.error('[handlePaymentUpdate] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while updating payment.');
    }
  };

  const handleTogglePaid = async (isPaid: boolean) => {
    if (!invoice || !supabase) {
      Alert.alert('Error', 'Unable to update payment status at this time.');
      return;
    }

    try {
      console.log(`[handleTogglePaid] Updating invoice ${invoice.id} payment status to: ${isPaid}`);
      
      let updateData: any = {};
      
      if (isPaid) {
        // When marking as paid, set paid amount to total amount and status to paid
        updateData = {
          status: 'paid',
          paid_amount: invoice.total_amount,
          payment_date: new Date().toISOString(),
          payment_notes: 'Marked as paid via toggle'
        };
      } else {
        // When marking as unpaid, reset payment tracking and set status to sent
        updateData = {
          status: 'sent',
          paid_amount: 0,
          payment_date: null,
          payment_notes: null
        };
      }

      const { error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleTogglePaid] Error updating payment status:', updateError);
        Alert.alert('Error', `Failed to update payment status: ${updateError.message}`);
        return;
      }

      // Log the payment activity
      if (isPaid) {
        await logPaymentAdded(
          invoice.id,
          invoice.invoice_number,
          invoice.total_amount,
          'Toggle - marked as paid'
        );
      }

      // Update local state
      setInvoice(prev => prev ? { 
        ...prev, 
        status: isPaid ? 'paid' : 'sent',
        paid_amount: isPaid ? invoice.total_amount : 0,
        payment_date: isPaid ? new Date().toISOString() : null,
        payment_notes: isPaid ? 'Marked as paid via toggle' : null
      } : null);
      
      Alert.alert(
        'Payment Updated', 
        isPaid 
          ? `Invoice marked as paid (${invoice.currency_symbol}${invoice.total_amount?.toFixed(2)})`
          : 'Invoice marked as unpaid'
      );
      
    } catch (error: any) {
      console.error('[handleTogglePaid] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while updating payment status.');
    }
  };

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice || !supabase) {
      Alert.alert('Error', 'Unable to update status at this time.');
      return;
    }

    try {
      console.log(`[handleStatusChange] Updating invoice ${invoice.id} status from ${invoice.status} to ${newStatus}`);
      
      const oldStatus = invoice.status;
      
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleStatusChange] Error updating status:', updateError);
        Alert.alert('Error', `Failed to update invoice status: ${updateError.message}`);
        return;
      }

      // Log the status change activity
      await logStatusChanged(
        invoice.id,
        invoice.invoice_number,
        oldStatus || undefined,
        newStatus
      );

      // Update local state
      setInvoice(prev => prev ? { ...prev, status: newStatus } : null);
      
      const config = getStatusConfig(newStatus);
      Alert.alert('Status Updated', `Invoice has been marked as ${config.label}.`);
      
    } catch (error: any) {
      console.error('[handleStatusChange] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while updating the status.');
    }
  };

  const invoiceStatus = invoice?.status?.toLowerCase() || 'draft';
  const statusStyle = getStatusBadgeStyle(invoice?.status);
  
  const handlePrimaryAction = () => {
    if (isPreviewingFromCreate) return; 
    if (!invoice) return;
    console.log('Primary action pressed for invoice:', invoice.id);
  };

  const handleEdit = () => {
    if (isPreviewingFromCreate) return; 
    if (!invoice) return;
    
    // Check if invoice is editable based on status
    const currentStatus = (invoice.status || 'draft') as InvoiceStatus;
    
    // For non-draft invoices, show a warning but allow editing
    if (!isEditable(currentStatus)) {
      const config = getStatusConfig(currentStatus);
      Alert.alert(
        'Edit Invoice', 
        `This invoice is currently marked as ${config.label}. Editing it may affect its status or cause confusion with clients. Do you want to continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Edit Anyway', 
            onPress: () => {
              // Hide tab bar before navigation
              setIsTabBarVisible(false);
              router.push(`/invoices/create?id=${invoice.id}` as any);
            }
          }
        ]
      );
      return;
    }
    
    // For draft invoices, edit directly
    if (invoice.id) {
      setIsTabBarVisible(false);
      router.push(`/invoices/create?id=${invoice.id}` as any);
    } else {
      console.warn('Edit pressed but no invoice ID found');
      Alert.alert('Error', 'Cannot edit invoice without a valid ID.');
    }
  };

  const handleMoreOptions = () => {
    moreOptionsSheetRef.current?.present();
  };

  // Handler functions for each more option
  const handleDeleteInvoice = () => {
    moreOptionsSheetRef.current?.dismiss();
    Alert.alert(
      'Delete Invoice',
      'Are you sure you want to delete this invoice? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!invoice || !supabase) {
              Alert.alert('Error', 'Unable to delete invoice at this time.');
              return;
            }

            try {
              console.log('[handleDeleteInvoice] Deleting invoice:', invoice.id);
              
              // Delete invoice line items first (foreign key constraint)
              const { error: lineItemsError } = await supabase
                .from('invoice_line_items')
                .delete()
                .eq('invoice_id', invoice.id);

              if (lineItemsError) {
                console.error('[handleDeleteInvoice] Error deleting line items:', lineItemsError);
                Alert.alert('Error', 'Failed to delete invoice line items.');
                return;
              }

              // Delete invoice activities (if any exist for this invoice)
              const { error: activitiesError } = await supabase
                .from('invoice_activities')
                .delete()
                .eq('invoice_id', invoice.id);

              if (activitiesError) {
                console.error('[handleDeleteInvoice] Error deleting activities:', activitiesError);
                // Don't stop deletion for activities, just log the error
              }

              // Delete the main invoice record
              const { error: invoiceError } = await supabase
                .from('invoices')
                .delete()
                .eq('id', invoice.id);

              if (invoiceError) {
                console.error('[handleDeleteInvoice] Error deleting invoice:', invoiceError);
                Alert.alert('Error', `Failed to delete invoice: ${invoiceError.message}`);
                return;
              }

              console.log('[handleDeleteInvoice] Successfully deleted invoice:', invoice.id);
              Alert.alert('Invoice Deleted', 'The invoice has been permanently deleted.', [
                {
                  text: 'OK',
                  onPress: () => {
                    // Navigate back to invoice dashboard
                    setIsTabBarVisible(true);
                    router.back();
                  }
                }
              ]);

            } catch (error: any) {
              console.error('[handleDeleteInvoice] Unexpected error:', error);
              Alert.alert('Error', 'An unexpected error occurred while deleting the invoice.');
            }
          }
        }
      ]
    );
  };

  const handlePartialPayment = () => {
    moreOptionsSheetRef.current?.dismiss();
    if (!invoice) {
      Alert.alert('Error', 'No invoice data available.');
      return;
    }
    
    const totalAmount = invoice.total_amount || 0;
    const paidAmount = invoice.paid_amount || 0;
    const remainingBalance = totalAmount - paidAmount;
    
    console.log('[handlePartialPayment] Payment validation:', {
      totalAmount,
      paidAmount,
      remainingBalance,
      invoiceId: invoice.id
    });
    
    // Check if invoice is already fully paid
    if (remainingBalance <= 0) {
      Alert.alert(
        'Invoice Fully Paid', 
        `This invoice has already been fully paid. No additional payments can be recorded.`
      );
      return;
    }
    
    // Check if invoice status is already paid
    if (invoice.status === 'paid') {
      Alert.alert(
        'Invoice Already Paid', 
        `This invoice is marked as paid. Remaining balance: ${invoice.currency_symbol}${remainingBalance.toFixed(2)}`
      );
      return;
    }
    
    console.log('[handlePartialPayment] Opening payment sheet - remaining balance:', remainingBalance);
    makePaymentSheetRef.current?.present(invoice.total_amount, invoice.paid_amount || 0);
  };

  // Handle payment save from MakePaymentSheet
  const handleMakePaymentSheetSave = async (paymentData: PaymentData) => {
    if (!invoice || !supabase) {
      Alert.alert('Error', 'Unable to record payment at this time.');
      return;
    }

    try {
      const paymentAmount = parseFloat(paymentData.paymentAmount);
      const newTotalPaid = (invoice.paid_amount || 0) + paymentAmount;
      
      console.log('[handleMakePaymentSheetSave] Recording payment:', {
        invoiceId: invoice.id,
        paymentAmount: paymentAmount,
        newTotalPaid: newTotalPaid,
        paymentMethod: paymentData.paymentMethod
      });

      // Calculate status based on payment amount
      const newStatus = calculatePaymentStatus(newTotalPaid, invoice.total_amount);
      
      const updateData = {
        status: newStatus,
        paid_amount: newTotalPaid,
        payment_date: new Date().toISOString(),
        payment_notes: `${paymentData.paymentMethod}: $${paymentAmount.toFixed(2)}`
      };

      const { error: updateError } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', invoice.id);

      if (updateError) {
        console.error('[handleMakePaymentSheetSave] Error updating payment:', updateError);
        Alert.alert('Error', `Failed to record payment: ${updateError.message}`);
        return;
      }

      // Log the payment activity
      await logPaymentAdded(
        invoice.id,
        invoice.invoice_number,
        paymentAmount,
        `${paymentData.paymentMethod} payment recorded`
      );

      // Update local state
      setInvoice(prev => prev ? { 
        ...prev, 
        status: newStatus,
        paid_amount: newTotalPaid,
        payment_date: new Date().toISOString(),
        payment_notes: updateData.payment_notes
      } : null);
      
      const statusConfig = getStatusConfig(newStatus);
      Alert.alert(
        'Payment Recorded', 
        `Payment of $${paymentAmount.toFixed(2)} recorded successfully. Invoice is now ${statusConfig.label}.`
      );
      
    } catch (error: any) {
      console.error('[handleMakePaymentSheetSave] Unexpected error:', error);
      Alert.alert('Error', 'An unexpected error occurred while recording the payment.');
    }
  };

  const handleViewClientProfile = () => {
    moreOptionsSheetRef.current?.dismiss();
    console.log('View client profile pressed');
    // TODO: Implement view client profile functionality
    Alert.alert('Coming Soon', 'View client profile functionality will be implemented soon.');
  };

  const handleVoidInvoice = () => {
    moreOptionsSheetRef.current?.dismiss();
    Alert.alert(
      'Void Invoice',
      'Are you sure you want to void this invoice? This will mark it as cancelled.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void',
          style: 'destructive',
          onPress: () => {
            console.log('Void invoice pressed');
            // TODO: Implement void functionality
            Alert.alert('Coming Soon', 'Void functionality will be implemented soon.');
          }
        }
      ]
    );
  };

  const handlePaymentLink = () => {
    moreOptionsSheetRef.current?.dismiss();
    console.log('Payment link pressed');
    // TODO: Implement payment link functionality
    Alert.alert('Coming Soon', 'Payment link functionality will be implemented soon.');
  };

  const handleRefundCreditNote = () => {
    moreOptionsSheetRef.current?.dismiss();
    console.log('Refund/Credit note pressed');
    // TODO: Implement refund/credit note functionality
    Alert.alert('Coming Soon', 'Refund/Credit note functionality will be implemented soon.');
  };

  const handleAutoReminders = () => {
    moreOptionsSheetRef.current?.dismiss();
    console.log('Auto reminders pressed');
    // TODO: Implement auto reminders functionality
    Alert.alert('Coming Soon', 'Auto reminders functionality will be implemented soon.');
  };

  const handleShareInvoice = async () => {
    moreOptionsSheetRef.current?.dismiss();
    
    if (!invoice || !supabase || !user) {
      Alert.alert('Error', 'Unable to share invoice at this time.');
      return;
    }

    try {
      // Generate shareable link
      const result = await InvoiceShareService.generateShareLink(
        invoice.id, 
        user.id,
        30 // Expires in 30 days
      );

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to generate share link');
        return;
      }

      // Copy link to clipboard
      await Clipboard.setString(result.shareUrl!);

      Alert.alert(
        'Invoice Link Generated',
        `A shareable link has been created and copied to your clipboard. This link will expire in 30 days.\n\nLink: ${result.shareUrl}`,
        [
          { text: 'Share Link', onPress: () => shareInvoiceLink(result.shareUrl!) },
          { text: 'OK', style: 'default' }
        ]
      );

    } catch (error) {
      console.error('Error sharing invoice:', error);
      Alert.alert('Error', 'Failed to generate shareable link. Please try again.');
    }
  };

  const shareInvoiceLink = async (shareUrl: string) => {
    try {
      await Sharing.shareAsync(shareUrl, {
        dialogTitle: `Share Invoice ${invoice?.invoice_number}`,
      });
    } catch (error) {
      console.error('Error sharing link:', error);
    }
  };

  const handleViewAnalytics = async () => {
    moreOptionsSheetRef.current?.dismiss();
    
    if (!invoice || !user) {
      Alert.alert('Error', 'Unable to view analytics at this time.');
      return;
    }

    try {
      const analytics = await InvoiceShareService.getShareAnalytics(invoice.id, user.id);
      
      if (!analytics) {
        Alert.alert(
          'No Share Data',
          'This invoice hasn\'t been shared yet. Use "Generate Share Link" to create a trackable link.'
        );
        return;
      }

      const analyticsMessage = `
📊 Invoice Analytics for ${invoice.invoice_number}

👀 Total Views: ${analytics.totalViews}
📥 Downloads: ${analytics.totalDownloads}
🖨️ Prints: ${analytics.totalPrints}
👥 Unique Visitors: ${analytics.uniqueVisitors}

${analytics.lastViewed ? `Last Viewed: ${new Date(analytics.lastViewed).toLocaleDateString()}` : ''}
${analytics.lastDownloaded ? `Last Downloaded: ${new Date(analytics.lastDownloaded).toLocaleDateString()}` : ''}

${analytics.countries.length > 0 ? 
  `\n🌍 Top Countries:\n${analytics.countries.slice(0, 3).map(c => `${c.country}: ${c.count} views`).join('\n')}` : ''
}
      `.trim();

      Alert.alert('Invoice Analytics', analyticsMessage);

    } catch (error) {
      console.error('Error loading analytics:', error);
      Alert.alert('Error', 'Failed to load analytics. Please try again.');
    }
  };

  // More options action item component
  const MoreOptionItem = ({ 
    icon: IconComponent, 
    title, 
    onPress, 
    variant = 'default' 
  }: { 
    icon: React.ElementType; 
    title: string; 
    onPress: () => void;
    variant?: 'default' | 'destructive';
  }) => (
    <TouchableOpacity style={styles.moreOptionItem} onPress={onPress}>
      <View style={styles.moreOptionLeft}>
        <IconComponent 
          size={20} 
          color={variant === 'destructive' ? '#DC2626' : themeColors.foreground} 
          style={styles.moreOptionIcon} 
        />
        <Text style={[
          styles.moreOptionTitle, 
          { 
            color: variant === 'destructive' ? '#DC2626' : themeColors.foreground 
          }
        ]}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const handleSendInvoice = () => {
    if (!invoice) return;
    if (invoice.status === 'draft') {
      Alert.alert('Send Invoice', 'Sending invoice...'); 
    } else if (invoice.status === 'sent' || invoice.status === 'overdue') {
      Alert.alert('Resend Invoice', 'Resending invoice...'); 
    }
  };

  const handleViewHistory = () => {
    if (!invoice) return;
    console.log('[handleViewHistory] Opening history for invoice:', invoice.id);
    historyModalRef.current?.present(invoice.id, invoice.invoice_number || undefined);
  };
  
  const getStyles = (themeColors: any) => StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    container: { 
      flex: 1,
      padding: 16,
      paddingHorizontal: 16, 
    },
    centered: { 
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollViewContent: { 
      flexGrow: 1,
      paddingHorizontal: 0, 
      paddingTop: 10, // Restored to not affect header size
      paddingBottom: 200,
      paddingHorizontal: 10 // Add horizontal padding for better framing
    },
    newTopSectionContainer: { 
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 0 : 0, 
      paddingBottom: 12, 
      borderBottomWidth: StyleSheet.hairlineWidth,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.5,
      elevation: 3,           
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between', 
      width: '100%',
    },
    headerLeftContainer: {
      flex: 1, 
      flexDirection: 'row', 
      alignItems: 'center', 
      paddingVertical: 8, 
    },
    backButtonText: { 
      fontSize: 17,
      marginLeft: 6,
    },
    statusIndicatorContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 'auto', 
    },
    statusLabelText: {
      fontSize: 14,
      fontWeight: '500',
    },
    statusValueText: {
      fontSize: 14,
      fontWeight: '600',
    },
    actionButtonsRow: { 
      flexDirection: 'row',
      justifyContent: 'center', 
      marginTop: 10, 
      marginBottom: 10, 
    },
    actionButton: {
      paddingHorizontal: 15,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center', 
      justifyContent: 'center', 
      width: 120, 
      marginHorizontal: 5, 
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4, 
      },
      shadowOpacity: 0.30, 
      shadowRadius: 4.65, 
      elevation: 8, 
    },
    actionButtonText: {
      marginLeft: 8,
      fontSize: 14, 
      color: '#000000', 
      fontWeight: 'bold', 
    },
    invoiceNumberAndTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start', 
      marginBottom: 0, 
    },
    invoiceNumberDisplay: {
      fontSize: 22, 
      fontWeight: 'bold',
    },
    invoiceTotalDisplay: { 
      fontSize: 16, 
      fontWeight: 'bold', 
    },
    clientNameDisplay: { 
      fontSize: 14, 
    },
    clientAndStatusRow: { 
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8, 
    },
    statusToggleContainer: { 
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusSwitch: { 
      transform: Platform.OS === 'ios' ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [], 
      marginRight: 8,
    },
    statusToggleValue: { 
      fontSize: 14,
      fontWeight: '500',
    },
    paymentAmountText: {
      fontSize: 12,
      fontWeight: '400',
    },
    actionBarContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      paddingBottom: Platform.OS === 'ios' ? 32 : 16, 
      borderTopWidth: StyleSheet.hairlineWidth,
      // Add shadow for better visual separation
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: -6, // Increased negative value for more pronounced shadow
      },
      shadowOpacity: 0.25, // Increased from 0.15 to make it more noticeable
      shadowRadius: 12, // Increased from 8 for a softer, more diffused shadow
      elevation: 16, // Increased for Android
    },
    primaryButton: {
      paddingVertical: 16,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row', 
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: 'bold',
    },
    invoiceDetailsBottomContainer: { 
      marginBottom: 16, 
    },
    disabledButton: {
      opacity: 0.5, 
    },
    centeredMessageContainer: { 
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    errorText: { 
      fontSize: 16,
      textAlign: 'center',
      marginBottom: 10,
    },
    button: { 
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { 
      fontSize: 16,
      fontWeight: '500',
    },
    modalContentContainer: {
      flex: 1,
      // backgroundColor: theme.card, // Handled by backgroundStyle on BottomSheetModal
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12, 
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
      backgroundColor: themeColors.card, // Ensure header has bg for consistency
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: themeColors.foreground,
    },
    modalOptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16, // Increased padding for better touch
      paddingHorizontal: 16,
    },
    modalOptionIcon: {
      marginRight: 16, // Increased spacing
    },
    modalOptionText: {
      fontSize: 16,
      color: themeColors.foreground,
    },
    modalSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: themeColors.border,
      marginLeft: 16, // Indent separator if desired, or remove for full width
    },
    moreOptionsContainer: {
      flex: 1,
    },
    moreOptionsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    moreOptionsTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    closeButton: {
      padding: 6,
    },
    moreOptionsContent: {
      flex: 1,
      paddingTop: 8,
    },
    moreOptionItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    moreOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    moreOptionIcon: {
      marginRight: 12,
    },
    moreOptionTitle: {
      fontSize: 16,
      fontWeight: '500',
    },
    moreOptionSeparator: {
      height: StyleSheet.hairlineWidth,
      marginLeft: 48, // Align with text, accounting for icon width + margin
    },
  });

  const styles = getStyles(themeColors);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: themeColors.card }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }}
      />
      <View style={[
        styles.newTopSectionContainer,
        { 
          backgroundColor: themeColors.card, 
          borderBottomColor: themeColors.border 
        }
      ]}>
        <View style={styles.topRow}>
          <TouchableOpacity onPress={handleCustomBack} style={styles.headerLeftContainer}>
            <ChevronLeft size={28} color={themeColors.foreground} strokeWidth={2.5} />
            <Text style={[styles.backButtonText, { color: themeColors.foreground }]}>Back</Text>
          </TouchableOpacity>
          
          <View style={styles.statusIndicatorContainer}>
            <TouchableOpacity onPress={handleOpenStatusSelector} activeOpacity={0.7}>
              <StatusBadge 
                status={(invoice?.status || 'draft') as InvoiceStatus} 
                size="medium" 
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity 
            style={[
              styles.actionButton, 
              { backgroundColor: themeColors.card, borderColor: themeColors.border }, 
              isPreviewingFromCreate && styles.disabledButton
            ]} 
            onPress={handleEdit} 
            disabled={isPreviewingFromCreate}
          >
            <Edit3 size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[
              styles.actionButtonText, 
              { 
                color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary 
              }
            ]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }, isPreviewingFromCreate && styles.disabledButton]} 
            onPress={handleViewHistory}
            disabled={isPreviewingFromCreate}
          >
            <History size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary }]}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }, isPreviewingFromCreate && styles.disabledButton]} 
            onPress={handleMoreOptions} 
            disabled={isPreviewingFromCreate} 
          >
            <MoreHorizontal size={20} color={isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary} />
            <Text style={[styles.actionButtonText, { color: isPreviewingFromCreate ? themeColors.mutedForeground : themeColors.primary }]}>More</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[
          styles.scrollViewContent, 
          { 
            backgroundColor: themeColors.border, 
            paddingTop: 10, // Restored to not affect header size
            paddingBottom: 200,
            paddingHorizontal: 10 // Add horizontal padding for better framing
          }
        ]} 
        showsVerticalScrollIndicator={false}
      >
        {isLoading || (!isInvoiceReady && invoice && businessSettings) ? (
          <View style={{ alignItems: 'center', paddingTop: -10 }}> 
            <InvoiceSkeletonLoader />
          </View>
        ) : error ? (
          <View style={styles.centeredMessageContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : invoice ? (
          <View style={{ alignItems: 'center', marginTop: -30 }}>
            <View style={{
              transform: [{ scale: 0.882 }],
              marginLeft: -175,
            }}>
              <InvoiceDesignComponent
                ref={skiaInvoiceRef}
                invoice={invoice}
                client={client}
                business={businessSettings}
                currencySymbol={currencySymbol}
                accentColor={getAccentColor()}
                renderSinglePage={0}
                style={{ 
                  width: 200, 
                  height: 295,
                  backgroundColor: 'white',
                  borderRadius: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              />
            </View>
          </View>
        ) : (
          <View style={styles.centeredMessageContainer}>
            <Text style={{ color: themeColors.mutedForeground }}>No invoice data available.</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.actionBarContainer, { borderTopColor: themeColors.border, backgroundColor: themeColors.card }]}>
        <View style={styles.invoiceDetailsBottomContainer}>
          <View style={styles.invoiceNumberAndTotalRow}>
            <Text style={[styles.invoiceNumberDisplay, { color: themeColors.foreground }]}>
              {invoice?.invoice_number}
            </Text>
            <Text style={[styles.invoiceTotalDisplay, { color: themeColors.foreground }]}>
              {`${invoice?.currency_symbol}${(invoice?.total_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
          </View>
          <View style={styles.clientAndStatusRow}>
            <Text style={[styles.clientNameDisplay, { color: themeColors.mutedForeground }]}>
              {client?.name}
            </Text>
            <View style={styles.statusToggleContainer}>
              <Switch
                trackColor={{ false: themeColors.muted, true: themeColors.primaryTransparent }}
                thumbColor={invoice?.status === 'paid' ? themeColors.primary : themeColors.card}
                ios_backgroundColor={themeColors.muted}
                onValueChange={(isPaid) => {
                  handleTogglePaid(isPaid);
                }}
                value={invoice?.status === 'paid'}
                style={styles.statusSwitch}
              />
              <Text style={[styles.statusToggleValue, { color: invoice?.status === 'paid' ? themeColors.primary : themeColors.foreground }]}>
                {invoice?.status === 'paid' ? 'Paid' : 'Unpaid'}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[
            styles.primaryButton,
            {
              backgroundColor: themeColors.primary,
            },
          ]}
          onPress={handleOpenSendModal}
        >
          <Send size={20} color={themeColors.primaryForeground} style={{ marginRight: 8 }}/>
          <Text style={[styles.primaryButtonText, { color: themeColors.primaryForeground }]}>
            {invoice?.status === 'draft' ? 'Send Invoice' : 'Resend Invoice'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Send Invoice Modal */}
      <BottomSheetModal
        ref={sendInvoiceModalRef}
        index={0}
        snapPoints={sendInvoiceSnapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }} // Style grabber
        backgroundStyle={{ backgroundColor: themeColors.card }} // Modal background
        onDismiss={() => console.log('Send Invoice Modal Dismissed')}
      >
        <BottomSheetView style={styles.modalContentContainer}> 
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { flex: 1, textAlign: 'center' }]}>Send Invoice</Text>
            <TouchableOpacity onPress={handleCloseSendModal} style={{ padding: 4 }}>
              <XIcon size={24} color={themeColors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Modal Options */}
          <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendByEmail}>
            <Mail size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
            <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send by Email</Text>
          </TouchableOpacity>
          <View style={[styles.modalSeparator, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendLink}>
            <Link2 size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
            <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send Link</Text>
          </TouchableOpacity>
          <View style={[styles.modalSeparator, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.modalOptionRow} onPress={handleSendPDF}>
            <FileText size={22} color={themeColors.foreground} style={styles.modalOptionIcon} />
            <Text style={[styles.modalOptionText, { color: themeColors.foreground }]}>Send PDF</Text>
          </TouchableOpacity>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Status Selector Modal */}
      <BottomSheetModal
        ref={statusSelectorModalRef}
        index={0}
        snapPoints={statusSelectorSnapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
        backgroundStyle={{ backgroundColor: themeColors.card }}
        onDismiss={() => console.log('Status Selector Modal Dismissed')}
      >
        <StatusSelectorSheet
          currentStatus={(invoice?.status || 'draft') as InvoiceStatus}
          onStatusChange={handleStatusChange}
          onClose={handleCloseStatusSelector}
          invoiceNumber={invoice?.invoice_number || undefined}
        />
      </BottomSheetModal>

      {/* Payment Amount Modal */}
      <BottomSheetModal
        ref={paymentAmountModalRef}
        index={0}
        snapPoints={paymentAmountSnapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
        backgroundStyle={{ backgroundColor: themeColors.card }}
        onDismiss={() => console.log('Payment Amount Modal Dismissed')}
      >
        {invoice && (
          <PaymentAmountSheet
            totalAmount={invoice.total_amount}
            paidAmount={invoice.paid_amount || 0}
            currencySymbol={invoice.currency_symbol}
            invoiceNumber={invoice.invoice_number}
            onPaymentUpdate={handlePaymentUpdate}
            onClose={handleClosePaymentModal}
          />
        )}
      </BottomSheetModal>

      {/* More Options Bottom Sheet */}
      <BottomSheetModal
        ref={moreOptionsSheetRef}
        snapPoints={['60%']}
        enablePanDownToClose={true}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
        )}
        backgroundStyle={{ backgroundColor: themeColors.card }}
        handleIndicatorStyle={{ backgroundColor: themeColors.mutedForeground }}
      >
        <BottomSheetView style={[styles.moreOptionsContainer, { backgroundColor: themeColors.card }]}>
          {/* Header */}
          <View style={[styles.moreOptionsHeader, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.moreOptionsTitle, { color: themeColors.foreground }]}>
              More Options
            </Text>
            <TouchableOpacity 
              onPress={() => moreOptionsSheetRef.current?.dismiss()}
              style={styles.closeButton}
            >
              <MoreHorizontal size={24} color={themeColors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Options List */}
          <ScrollView style={styles.moreOptionsContent} showsVerticalScrollIndicator={false}>
            <MoreOptionItem
              icon={Share2}
              title="Generate Share Link"
              onPress={handleShareInvoice}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={BarChart3}
              title="View Share Analytics"
              onPress={handleViewAnalytics}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={DollarSign}
              title="Record Partial Payment"
              onPress={handlePartialPayment}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={Link2}
              title="Generate Payment Link"
              onPress={handlePaymentLink}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={RefreshCw}
              title="Issue Refund/Credit Note"
              onPress={handleRefundCreditNote}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={Bell}
              title="Setup Auto Reminders"
              onPress={handleAutoReminders}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={User}
              title="View Client Profile"
              onPress={handleViewClientProfile}
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={AlertTriangle}
              title="Void Invoice"
              onPress={handleVoidInvoice}
              variant="destructive"
            />
            
            <View style={[styles.moreOptionSeparator, { backgroundColor: themeColors.border }]} />
            
            <MoreOptionItem
              icon={Trash2}
              title="Delete Invoice"
              onPress={handleDeleteInvoice}
              variant="destructive"
            />
          </ScrollView>
        </BottomSheetView>
      </BottomSheetModal>

      {/* Invoice History Modal */}
      <InvoiceHistorySheet
        ref={historyModalRef}
        onClose={() => console.log('Invoice History Modal Dismissed')}
      />

      {/* Make Payment Sheet */}
      <MakePaymentSheet
        ref={makePaymentSheetRef}
        onSave={handleMakePaymentSheetSave}
        onClose={() => console.log('Make Payment Sheet Dismissed')}
        invoiceTotal={invoice?.total_amount || 0}
        previouslyPaidAmount={invoice?.paid_amount || 0}
      />
    </SafeAreaView>
  );
}

export default InvoiceViewerScreen;

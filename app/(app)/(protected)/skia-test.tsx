import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, Switch, Alert, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { captureRef } from 'react-native-view-shot';

import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { H1, H2 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/context/supabase-provider';
import { Skia, Canvas, Circle, Group, useCanvasRef, Rect, Text as SkiaText, matchFont } from '@shopify/react-native-skia';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

// Current system
import InvoiceTemplateOne, { BusinessSettingsRow } from './invoices/InvoiceTemplateOne';

// New Skia system
import SkiaInvoiceCanvas from '@/components/skia/SkiaInvoiceCanvas';

// Local utility function for currency symbols
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

// Real invoice data for INV-710231 - matching InvoiceForTemplate interface
const REAL_INVOICE_710231 = {
  id: 'ea512ea5-e222-4bdb-8e3b-ab66a9f26597',
  user_id: '43e8cdf9-63cb-4363-a2f1-ac7cbddfdbd1',
  client_id: '50d530ee-21cf-484d-ae99-2ba989a9beb2',
  invoice_number: 'INV-710231',
  status: 'sent',
  invoice_date: '2025-06-03',
  due_date: null,
  po_number: null,
  custom_headline: null,
  subtotal_amount: 400.00,
  discount_type: null,
  discount_value: 0,
  tax_percentage: 20,
  total_amount: 480.00,
  notes: 'Please pay within 30 days.',
  stripe_active: false,
  bank_account_active: true,
  paypal_active: false,
  created_at: '2025-06-03T12:22:20.011003Z',
  updated_at: '2025-06-03T17:09:40.418865Z',
  due_date_option: 'net_7',
  invoice_tax_label: 'Tax',
  paid_amount: 0,
  payment_date: null,
  payment_notes: null,
  clients: {
    id: '50d530ee-21cf-484d-ae99-2ba989a9beb2',
    name: 'Chill Free Ltd',
    email: 'harrisonjbj@gmail.com',
    address_client: '52 wallaby way\nSysney\nUae'
  },
  invoice_line_items: [
    {
      id: 'c58f9447-ff15-4466-bc63-bb0681a17df7',
      invoice_id: 'ea512ea5-e222-4bdb-8e3b-ab66a9f26597',
      item_name: 'Big winner',
      item_description: 'Easy winner fm',
      quantity: 1,
      unit_price: 200.00,
      total_price: 200.00,
      created_at: '2025-06-03T16:38:31.532159Z',
      updated_at: '2025-06-03T16:38:31.532159Z'
    },
    {
      id: 'bba20554-1134-45ba-b03d-b86e3df52895',
      invoice_id: 'ea512ea5-e222-4bdb-8e3b-ab66a9f26597',
      item_name: 'Big winner',
      item_description: 'Easy winner fm',
      quantity: 1,
      unit_price: 200.00,
      total_price: 200.00,
      created_at: '2025-06-03T16:38:31.532159Z',
      updated_at: '2025-06-03T16:38:31.532159Z'
    }
  ],
  currency: 'GBP',
  currency_symbol: '£'
};

// Sample invoice with many items for pagination testing
const SAMPLE_LONG_INVOICE = {
  ...REAL_INVOICE_710231,
  id: 'test-invoice-long',
  invoice_number: 'INV-002',
  subtotal_amount: 2800.00,
  total_amount: 3500.00,
  invoice_line_items: [
    { id: '1', invoice_id: 'test-invoice-long', description: 'Foundation Work', quantity: 1, unit_price: 500.00, total_price: 500.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', invoice_id: 'test-invoice-long', description: 'Framing', quantity: 1, unit_price: 800.00, total_price: 800.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', invoice_id: 'test-invoice-long', description: 'Roofing', quantity: 1, unit_price: 600.00, total_price: 600.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '4', invoice_id: 'test-invoice-long', description: 'Electrical Work', quantity: 1, unit_price: 400.00, total_price: 400.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '5', invoice_id: 'test-invoice-long', description: 'Plumbing', quantity: 1, unit_price: 350.00, total_price: 350.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '6', invoice_id: 'test-invoice-long', description: 'Drywall Installation', quantity: 1, unit_price: 300.00, total_price: 300.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '7', invoice_id: 'test-invoice-long', description: 'Flooring', quantity: 1, unit_price: 450.00, total_price: 450.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '8', invoice_id: 'test-invoice-long', description: 'Kitchen Cabinets', quantity: 1, unit_price: 800.00, total_price: 800.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '9', invoice_id: 'test-invoice-long', description: 'Bathroom Fixtures', quantity: 1, unit_price: 400.00, total_price: 400.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '10', invoice_id: 'test-invoice-long', description: 'Interior Painting', quantity: 1, unit_price: 300.00, total_price: 300.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '11', invoice_id: 'test-invoice-long', description: 'Exterior Painting', quantity: 1, unit_price: 250.00, total_price: 250.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '12', invoice_id: 'test-invoice-long', description: 'Landscaping', quantity: 1, unit_price: 200.00, total_price: 200.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '13', invoice_id: 'test-invoice-long', description: 'Cleanup', quantity: 1, unit_price: 150.00, total_price: 150.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '14', invoice_id: 'test-invoice-long', description: 'Final Inspection', quantity: 1, unit_price: 100.00, total_price: 100.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '15', invoice_id: 'test-invoice-long', description: 'Project Management', quantity: 1, unit_price: 300.00, total_price: 300.00, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ]
};

export default function SkiaTestScreen() {
  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsRow | null>(null);
  const [showLongInvoice, setShowLongInvoice] = useState(false);
  const [showComparison, setShowComparison] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // ADD DYNAMIC DATA STATES
  const [realInvoiceData, setRealInvoiceData] = useState<any>(null);
  const [realClientData, setRealClientData] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  
  // ADD REF FOR CAPTURING THE SKIA CANVAS
  const invoiceCanvasRef = useRef<View>(null);
  // ADD REF FOR SIMPLE TEST CANVAS
  const testCanvasRef = useRef<View>(null);
  // ADD SKIA CANVAS REF FOR PROPER EXPORT
  const skiaCanvasRef = useCanvasRef();
  // ADD DEDICATED INVOICE CANVAS REF
  const invoiceSkiaRef = useCanvasRef();
  
  const { supabase, user } = useSupabase();
  const currentInvoice = showLongInvoice ? SAMPLE_LONG_INVOICE : REAL_INVOICE_710231;
  const currencySymbol = businessSettings ? getCurrencySymbol(businessSettings.currency_code) : '$';

  // FETCH REAL LIVE DATA FROM DATABASE
  const fetchRealInvoiceData = async () => {
    if (!supabase) {
      setDataError('No supabase connection');
      setDataLoading(false);
      return;
    }

    try {
      setDataLoading(true);
      // Use long invoice for pagination testing, short invoice for normal testing
      const invoiceId = showLongInvoice ? 'ebf2fc13-07b6-4aab-9e77-215e029c765f' : 'ea512ea5-e222-4bdb-8e3b-ab66a9f26597';
      const invoiceNumber = showLongInvoice ? 'INV-740196' : 'INV-710231';
      
      console.log(`[fetchRealInvoiceData] Fetching live data for invoice: ${invoiceNumber} (${invoiceId})`);
      
      // Fetch real invoice with client and line items using invoice ID
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
        console.error('[fetchRealInvoiceData] Error:', invoiceError);
        setDataError(`Failed to fetch invoice: ${invoiceError.message}`);
        setDataLoading(false);
        return;
      }

      console.log(`[fetchRealInvoiceData] SUCCESS - Live data received for ${invoiceNumber}:`, invoiceData);
      console.log(`[fetchRealInvoiceData] Line items count: ${invoiceData.invoice_line_items?.length || 0}`);
      setRealInvoiceData(invoiceData);
      setRealClientData(invoiceData.clients);
      setDataError(null);
      setDataLoading(false);
      
    } catch (error: any) {
      console.error('[fetchRealInvoiceData] Exception:', error);
      setDataError(`Exception: ${error.message}`);
      setDataLoading(false);
    }
  };

  // Fetch business settings (similar to invoice-viewer.tsx)
  const fetchBusinessSettings = async () => {
    try {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('business_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[SkiaTest] Error fetching business settings:', error);
      }

      setBusinessSettings(data || null);
      setIsLoading(false);
    } catch (e) {
      console.error('[SkiaTest] Exception fetching business settings:', e);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessSettings();
    fetchRealInvoiceData(); // FETCH REAL DATA ON MOUNT
  }, []);

  // Refetch data when invoice type changes
  useEffect(() => {
    fetchRealInvoiceData();
  }, [showLongInvoice]);

  // REFRESH DATA FUNCTION FOR TESTING
  const refreshData = () => {
    console.log('[refreshData] Manually refreshing live data...');
    fetchRealInvoiceData();
  };

  // PROPER SKIA EXPORT FUNCTION USING OFFICIAL METHOD
  const handleSkiaExport = async () => {
    try {
      Alert.alert('Skia Export', 'Using official Skia makeImageSnapshot...');
      
      console.log('[SKIA_EXPORT] Starting official Skia export...');
      
      // Use the official Skia method to get canvas snapshot
      const image = skiaCanvasRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot from Skia canvas');
      }
      
      console.log('[SKIA_EXPORT] Image snapshot created successfully');
      console.log('[SKIA_EXPORT] Image dimensions:', image.width(), 'x', image.height());
      
      // Encode to bytes (PNG format)
      const bytes = image.encodeToBytes();
      console.log('[SKIA_EXPORT] Encoded to bytes, size:', bytes.length);
      
      if (!bytes || bytes.length === 0) {
        throw new Error('Failed to encode image to bytes');
      }
      
      // Convert to base64
      const base64String = btoa(String.fromCharCode(...bytes));
      console.log('[SKIA_EXPORT] Converted to base64, length:', base64String.length);
      
      // Create data URI
      const dataUri = `data:image/png;base64,${base64String}`;
      
      // Create filename
      const fileName = `skia-invoice-${Date.now()}.png`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Write base64 to file
      await FileSystem.writeAsStringAsync(fileUri, base64String, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('[SKIA_EXPORT] File written to:', fileUri);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('[SKIA_EXPORT] Final file info:', fileInfo);
      
      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Skia Invoice'
      });
      
      Alert.alert(
        'Skia Export Success! 🎉', 
        `Official Skia method worked!\n\nFile: ${fileName}\nSize: ${Math.round(fileInfo.size / 1024)}KB\nDimensions: ${image.width()}x${image.height()}`
      );
      
    } catch (error) {
      console.error('[SKIA_EXPORT] Error:', error);
      Alert.alert('Skia Export Error', `${error.message}`);
    }
  };

  // INVOICE SKIA EXPORT FUNCTION 
  const handleInvoiceSkiaExport = async () => {
    if (!realInvoiceData || !businessSettings) {
      Alert.alert('Error', 'Cannot export - invoice data or business settings not loaded');
      return;
    }

    try {
      Alert.alert('Invoice Export', 'Using official Skia method for invoice...');
      
      console.log('[INVOICE_SKIA_EXPORT] Starting invoice export...');
      console.log('[INVOICE_SKIA_EXPORT] Invoice:', realInvoiceData?.invoice_number);
      
      // Use the official Skia method to get invoice canvas snapshot
      const image = invoiceSkiaRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot from invoice canvas');
      }
      
      console.log('[INVOICE_SKIA_EXPORT] Invoice image captured successfully');
      console.log('[INVOICE_SKIA_EXPORT] Image dimensions:', image.width(), 'x', image.height());
      
      // Encode to bytes (PNG format)
      const bytes = image.encodeToBytes();
      console.log('[INVOICE_SKIA_EXPORT] Encoded to bytes, size:', bytes.length);
      
      if (!bytes || bytes.length === 0) {
        throw new Error('Failed to encode invoice image to bytes');
      }
      
      // Convert to base64 using chunked string conversion (not chunked base64)
      console.log('[INVOICE_SKIA_EXPORT] Converting bytes to string efficiently...');
      const chunkSize = 8192; // Larger chunks for string conversion
      let binaryString = '';
      
      // Convert bytes to binary string in chunks to avoid stack overflow
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      // Now encode the complete binary string to base64
      console.log('[INVOICE_SKIA_EXPORT] Converting complete string to base64...');
      const base64String = btoa(binaryString);
      
      console.log('[INVOICE_SKIA_EXPORT] Base64 conversion completed, length:', base64String.length);
      
      // Create filename with invoice number
      const fileName = `invoice-${realInvoiceData.invoice_number}-skia-${Date.now()}.png`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Write base64 to file
      await FileSystem.writeAsStringAsync(fileUri, base64String, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      console.log('[INVOICE_SKIA_EXPORT] Invoice file written to:', fileUri);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      console.log('[INVOICE_SKIA_EXPORT] Final invoice file info:', fileInfo);
      
      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        dialogTitle: `Share Invoice ${realInvoiceData.invoice_number}`
      });
      
      Alert.alert(
        'Invoice Export Success! 🎉', 
        `Pixel-perfect invoice exported!\n\nFile: ${fileName}\nSize: ${Math.round(fileInfo.size / 1024)}KB\nDimensions: ${image.width()}x${image.height()}\nPages: ${realInvoiceData.invoice_line_items?.length > 8 ? '2+' : '1'}\n\nThis is the complete Skia invoice!`
      );
      
    } catch (error) {
      console.error('[INVOICE_SKIA_EXPORT] Error:', error);
      Alert.alert('Invoice Export Error', `${error.message}`);
    }
  };

  // NEW EXPO-COMPATIBLE PDF EXPORT FUNCTION 
  const handleExpoCompatiblePDFExport = async () => {
    if (!realInvoiceData || !businessSettings) {
      Alert.alert('Error', 'Cannot export - invoice data or business settings not loaded');
      return;
    }

    try {
      Alert.alert('PDF Export', 'Creating Expo-compatible PDF...');
      
      console.log('[EXPO_PDF_EXPORT] Starting Expo-compatible PDF export...');
      console.log('[EXPO_PDF_EXPORT] Invoice:', realInvoiceData?.invoice_number);
      
      // Import expo-print for PDF generation
      const { printToFileAsync } = require('expo-print');
      
      // Calculate pagination - INDEPENDENT PDF logic for best PDF appearance
      const lineItems = realInvoiceData?.invoice_line_items || [];
      const totalItems = lineItems.length;
      // PDF pagination logic: optimized for A4 page layout
      const maxItemsFirstPage = totalItems >= 9 && totalItems <= 11 ? 11 : 8; // PDF-specific logic
      const needsPagination = totalItems > maxItemsFirstPage;
      const itemsPerSubsequentPage = 25;
      const totalPages = needsPagination ? 
        1 + Math.ceil((totalItems - maxItemsFirstPage) / itemsPerSubsequentPage) : 1;
      
      console.log('[EXPO_PDF_EXPORT] PDF-OPTIMIZED - Pages needed:', totalPages);
      console.log('[EXPO_PDF_EXPORT] Items:', totalItems, 'MaxFirst (PDF logic):', maxItemsFirstPage);
      
      if (totalPages === 1) {
        // Single page - use the full canvas
        const image = invoiceSkiaRef.current?.makeImageSnapshot();
        
        if (!image) {
          throw new Error('Failed to create image snapshot from invoice canvas');
        }
        
        console.log('[EXPO_PDF_EXPORT] Single page - using full canvas');
        
        // Encode to bytes and convert to base64
        const bytes = image.encodeToBytes();
        
        // Convert to base64 using chunked approach
        const chunkSize = 8192;
        let binaryString = '';
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64String = btoa(binaryString);
        console.log('[EXPO_PDF_EXPORT] Base64 conversion completed');
        
        // Create HTML with single page - UNIFIED A4 LAYOUT
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                margin: 0;
                size: A4 portrait;
              }
              body {
                margin: 0;
                padding: 15mm;
                font-family: Arial, sans-serif;
                width: calc(210mm - 30mm);
                height: calc(297mm - 30mm);
                box-sizing: border-box;
              }
              .invoice-container {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: flex-start;
              }
              .invoice-image {
                width: 100%;
                height: auto;
                max-width: 100%;
                object-fit: contain;
                /* Canvas is 370x523 (A4 ratio), this scales it to fill A4 page */
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice ${realInvoiceData.invoice_number}" />
            </div>
          </body>
          </html>
        `;
        
        // Generate PDF using expo-print
        const { uri } = await printToFileAsync({
          html: htmlContent,
          base64: false,
        });
        
        console.log('[EXPO_PDF_EXPORT] PDF generated successfully:', uri);
        
        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(uri);
        console.log('[EXPO_PDF_EXPORT] Final PDF info:', fileInfo);
        
        // Share the PDF
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${realInvoiceData.invoice_number} PDF`
        });
        
        Alert.alert(
          'PDF Export Success! 📄', 
          `Single-page PDF created!\n\nFormat: PDF\nPages: 1\nSize: ${Math.round(fileInfo.size / 1024)}KB\n\nThis PDF works with Expo Go!`
        );
        
      } else {
        // Multi-page - need to create proper page splitting
        Alert.alert('Multi-page PDF', `This invoice needs ${totalPages} pages. For now, creating a single long-form PDF. Individual page rendering coming soon!`);
        
        // For now, create a single page with the full invoice
        const image = invoiceSkiaRef.current?.makeImageSnapshot();
        
        if (!image) {
          throw new Error('Failed to create image snapshot from invoice canvas');
        }
        
        console.log('[EXPO_PDF_EXPORT] Multi-page fallback - using full canvas');
        console.log('[EXPO_PDF_EXPORT] Image dimensions:', image.width(), 'x', image.height());
        
        // Encode to bytes and convert to base64
        const bytes = image.encodeToBytes();
        
        // Convert to base64 using chunked approach
        const chunkSize = 8192;
        let binaryString = '';
        
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.slice(i, i + chunkSize);
          binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64String = btoa(binaryString);
        console.log('[EXPO_PDF_EXPORT] Base64 conversion completed');
        
        // Create HTML with the long invoice in A4 format
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                margin: 0;
                size: A4 portrait;
              }
              body {
                margin: 0;
                padding: 15mm;
                font-family: Arial, sans-serif;
                width: calc(210mm - 30mm);
                height: calc(297mm - 30mm);
                box-sizing: border-box;
              }
              .invoice-container {
                width: 100%;
                height: 100%;
                display: flex;
                justify-content: center;
                align-items: flex-start;
              }
              .invoice-image {
                width: 100%;
                height: auto;
                max-width: 100%;
                object-fit: contain;
                /* Long canvas will be scaled to fit A4 width, height will extend as needed */
              }
            </style>
          </head>
          <body>
            <div class="invoice-container">
              <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice ${realInvoiceData.invoice_number}" />
            </div>
          </body>
          </html>
        `;
        
        // Generate PDF using expo-print
        const { uri } = await printToFileAsync({
          html: htmlContent,
          base64: false,
        });
        
        console.log('[EXPO_PDF_EXPORT] PDF generated successfully:', uri);
        
        // Get file info
        const fileInfo = await FileSystem.getInfoAsync(uri);
        console.log('[EXPO_PDF_EXPORT] Final PDF info:', fileInfo);
        
        // Share the PDF
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Invoice ${realInvoiceData.invoice_number} PDF`
        });
        
        Alert.alert(
          'PDF Export Success! 📄', 
          `Multi-page PDF created!\n\nFormat: PDF\nCalculated Pages: ${totalPages}\nSize: ${Math.round(fileInfo.size / 1024)}KB\n\nNote: This is a long-form PDF. Individual page splitting coming soon!`
        );
      }
      
    } catch (error) {
      console.error('[EXPO_PDF_EXPORT] Error:', error);
      Alert.alert('PDF Export Error', `${error.message}`);
    }
  };

  // NEW HTML-BASED PDF WITH CLICKABLE LINKS
  const handleClickablePDFExport = async () => {
    if (!realInvoiceData || !businessSettings) {
      Alert.alert('Error', 'Cannot export - invoice data or business settings not loaded');
      return;
    }

    try {
      Alert.alert('PDF Export', 'Creating HTML-based PDF with clickable links...');
      
      console.log('[CLICKABLE_PDF] Starting HTML-based PDF export...');
      
      // Import expo-print for PDF generation
      const { printToFileAsync } = require('expo-print');
      
      // Calculate totals
      const subtotal = realInvoiceData.subtotal_amount || 0;
      const discountAmount = realInvoiceData.discount_value ? 
        (realInvoiceData.discount_type === 'percentage' ? 
          subtotal * (realInvoiceData.discount_value / 100) : 
          realInvoiceData.discount_value) : 0;
      const taxAmount = (subtotal - discountAmount) * ((realInvoiceData.tax_percentage || 20) / 100);
      const total = realInvoiceData.total_amount || 0;
      
      // Create HTML with actual clickable links
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              margin: 20mm;
              size: 210mm 350mm;
            }
            body {
              font-family: Arial, sans-serif;
              font-size: 12px;
              line-height: 1.4;
              color: #333;
            }
            .header {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .logo {
              width: 80px;
              height: 80px;
              background: #ff8c00;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 24px;
              font-weight: bold;
            }
            .invoice-title {
              text-align: right;
            }
            .invoice-title h1 {
              font-size: 24px;
              margin: 0;
            }
            .addresses {
              display: flex;
              justify-content: space-between;
              margin-bottom: 30px;
            }
            .address-block h3 {
              margin: 0 0 5px 0;
              font-size: 14px;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .table th {
              background: rgba(76, 175, 80, 0.15);
              padding: 10px;
              text-align: left;
              font-weight: bold;
            }
            .table td {
              padding: 8px 10px;
              border-bottom: 1px solid #eee;
            }
            .totals {
              float: right;
              width: 300px;
            }
            .totals table {
              width: 100%;
            }
            .totals .total-row {
              background: rgba(76, 175, 80, 0.15);
              font-weight: bold;
            }
            .payment-section {
              clear: both;
              margin-top: 40px;
            }
            .payment-links a {
              color: #0066cc;
              text-decoration: underline;
            }
            .payment-links a:hover {
              color: #004499;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="logo">${businessSettings.business_name ? businessSettings.business_name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase() : 'HA'}</div>
            <div class="invoice-title">
              <h1>INVOICE</h1>
              <p>Ref: ${realInvoiceData.invoice_number}<br>
              Date: ${new Date(realInvoiceData.invoice_date).toLocaleDateString('en-GB')}<br>
              Due: ${realInvoiceData.due_date_option === 'on_receipt' ? 'On receipt' : 
                     realInvoiceData.due_date_option === 'net_7' ? 'In 7 days' :
                     realInvoiceData.due_date_option === 'net_15' ? 'In 15 days' :
                     realInvoiceData.due_date_option === 'net_30' ? 'In 30 days' : 'In 7 days'}</p>
            </div>
          </div>

          <!-- Addresses -->
          <div class="addresses">
            <div class="address-block">
              <h3>From:</h3>
              <p><strong>${businessSettings.business_name || 'Harry'}</strong><br>
              ${businessSettings.business_address?.replace(/\n/g, '<br>') || '4 Castle Street<br>Montgomery<br>Powys<br>SY156PW'}</p>
            </div>
            <div class="address-block" style="text-align: right;">
              <h3>Bill To:</h3>
              <p><strong>${realClientData?.name || 'Chill Out Ltd'}</strong><br>
              ${realClientData?.address_client?.replace(/\n/g, '<br>') || '52 wallaby way<br>Sydney<br>UAE'}<br>
              ${realClientData?.tax_number ? `Sales Tax: ${realClientData.tax_number}` : ''}</p>
            </div>
          </div>

          <!-- Line Items Table -->
          <table class="table">
            <thead>
              <tr>
                <th>QTY</th>
                <th>DESCRIPTION</th>
                <th>PRICE</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${realInvoiceData.invoice_line_items.map(item => `
                <tr>
                  <td>${item.quantity}</td>
                  <td>${item.item_name}${item.item_description ? ` (${item.item_description})` : ''}</td>
                  <td>${currencySymbol}${item.unit_price.toFixed(2)}</td>
                  <td>${currencySymbol}${item.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals">
            <table>
              <tr>
                <td><strong>Subtotal:</strong></td>
                <td style="text-align: right;">${currencySymbol}${subtotal.toFixed(2)}</td>
              </tr>
              ${discountAmount > 0 ? `
                <tr>
                  <td><strong>Discount${realInvoiceData.discount_type === 'percentage' ? ` (${realInvoiceData.discount_value}%)` : ''}:</strong></td>
                  <td style="text-align: right;">-${currencySymbol}${discountAmount.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr>
                <td><strong>${businessSettings.tax_name || 'Tax'} (${realInvoiceData.tax_percentage}%):</strong></td>
                <td style="text-align: right;">${currencySymbol}${taxAmount.toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td><strong>Total:</strong></td>
                <td style="text-align: right;"><strong>${currencySymbol}${total.toFixed(2)}</strong></td>
              </tr>
            </table>
          </div>

          <!-- Notes -->
          ${realInvoiceData.notes ? `
            <div style="clear: both; margin-top: 30px;">
              <h3>Terms, Instructions & Notes</h3>
              <p>${realInvoiceData.notes.replace(/\n/g, '<br>')}</p>
            </div>
          ` : ''}

          <!-- Payment Methods with CLICKABLE LINKS -->
          <div class="payment-section">
            <h3>Payment Methods</h3>
            <div class="payment-links">
              ${realInvoiceData.stripe_active ? `
                <p><strong>Pay Online:</strong><br>
                <a href="https://www.stripelink.com" target="_blank">Click here to pay securely with card</a></p>
              ` : ''}
              
              ${realInvoiceData.paypal_active ? `
                <p><strong>Pay with PayPal:</strong><br>
                <a href="mailto:${businessSettings.paypal_email || 'nobones@gmail.com'}?subject=Payment for Invoice ${realInvoiceData.invoice_number}" target="_blank">${businessSettings.paypal_email || 'nobones@gmail.com'}</a></p>
              ` : ''}
              
              ${realInvoiceData.bank_account_active ? `
                <p><strong>Bank Transfer:</strong><br>
                ${businessSettings.bank_details?.replace(/\n/g, '<br>') || 'Bank 1<br>1 2457 5 6 5 500598 32<br>UAE'}</p>
              ` : ''}
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Generate PDF with clickable links
      const { uri } = await printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      console.log('[CLICKABLE_PDF] PDF with clickable links generated:', uri);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      // Share the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice ${realInvoiceData.invoice_number} PDF (Clickable Links)`
      });
      
      Alert.alert(
        'Clickable PDF Success! 🔗', 
        `PDF with clickable payment links created!\n\nFormat: PDF\nSize: ${Math.round(fileInfo.size / 1024)}KB\n\n✅ Payment links are now CLICKABLE!\n✅ Professional HTML layout\n✅ Works on all devices`
      );
      
    } catch (error) {
      console.error('[CLICKABLE_PDF] Error:', error);
      Alert.alert('Clickable PDF Error', `${error.message}`);
    }
  };

  // CREATE FONTS FOR SKIA TEXT
  const createFonts = () => {
    try {
      const fontFamily = Platform.select({ ios: "Helvetica", default: "sans-serif" });
      
      const titleFont = matchFont({
        fontFamily,
        fontSize: 18,
        fontWeight: "bold",
      });
      
      const bodyFont = matchFont({
        fontFamily,
        fontSize: 14,
        fontWeight: "normal",
      });
      
      const smallFont = matchFont({
        fontFamily,
        fontSize: 12,
        fontWeight: "normal",
      });
      
      const largeFont = matchFont({
        fontFamily,
        fontSize: 16,
        fontWeight: "normal",
      });
      
      return {
        titleFont,
        bodyFont,
        smallFont,
        largeFont
      };
    } catch (error) {
      console.log('[FONTS] Using simplified font approach');
      return {
        titleFont: null,
        bodyFont: null,
        smallFont: null,
        largeFont: null
      };
    }
  };

  const handleExportTest = async () => {
    if (!realInvoiceData || !businessSettings) {
      Alert.alert('Error', 'Cannot export - invoice data or business settings not loaded');
      return;
    }

    if (!invoiceCanvasRef.current) {
      Alert.alert('Error', 'Invoice canvas reference not found');
      return;
    }

    try {
      Alert.alert('PDF Export', 'Capturing invoice screenshot...');
      
      console.log('[EXPORT] Starting view capture...');
      console.log('[EXPORT] Real invoice data:', realInvoiceData?.invoice_number);
      console.log('[EXPORT] Business settings:', businessSettings?.business_name);
      
      // Significantly increase delay for Skia canvas rendering
      console.log('[EXPORT] Waiting 3 seconds for Skia to fully render...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log('[EXPORT] Delay completed, capturing view...');
      
      // Capture the SkiaInvoiceCanvas as an image with explicit dimensions
      const uri = await captureRef(invoiceCanvasRef.current, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
        width: 320, // Explicit width slightly larger than canvas
        height: showLongInvoice ? 820 : 440, // Explicit height 
      });
      
      console.log('[EXPORT] View captured successfully:', uri);
      
      // Get file info to check if capture worked
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('[EXPORT] Captured file info:', fileInfo);
      
      if (!fileInfo.exists || fileInfo.size === 0) {
        throw new Error('Captured file is empty or does not exist');
      }
      
      // Create a better filename
      const fileName = `invoice-${realInvoiceData.invoice_number}-export-${Date.now()}.png`;
      const newUri = `${FileSystem.documentDirectory}${fileName}`;
      
      // Copy to documents directory with better name
      await FileSystem.copyAsync({
        from: uri,
        to: newUri,
      });
      
      console.log('[EXPORT] File copied to:', newUri);
      
      // Get final file info
      const finalFileInfo = await FileSystem.getInfoAsync(newUri);
      console.log('[EXPORT] Final file info:', finalFileInfo);
      
      // Share the captured image
      await Sharing.shareAsync(newUri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Invoice'
      });
      
    } catch (error) {
      console.error('[EXPORT] Error:', error);
      Alert.alert('Error', `Failed to capture invoice: ${error.message}`);
    }
  };

  // SIMPLE SKIA TEST EXPORT FUNCTION
  const handleSimpleTestExport = async () => {
    if (!testCanvasRef.current) {
      Alert.alert('Error', 'Test canvas reference not found');
      return;
    }

    try {
      Alert.alert('Simple Test', 'Capturing simple Skia test...');
      
      console.log('[SIMPLE_TEST] Starting simple canvas capture...');
      
      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Capture the simple test canvas
      const uri = await captureRef(testCanvasRef.current, {
        format: 'png',
        quality: 1.0,
        result: 'tmpfile',
        width: 300,
        height: 300,
      });
      
      console.log('[SIMPLE_TEST] Simple test captured:', uri);
      
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('[SIMPLE_TEST] File info:', fileInfo);
      
      // Share immediately
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share Simple Test'
      });
      
      Alert.alert('Simple Test Result', `File size: ${Math.round(fileInfo.size / 1024)}KB`);
      
    } catch (error) {
      console.error('[SIMPLE_TEST] Error:', error);
      Alert.alert('Simple Test Error', error.message);
    }
  };

  // HYBRID PDF: SKIA DESIGN + CLICKABLE LINKS
  const handleHybridPDFExport = async () => {
    if (!realInvoiceData || !businessSettings) {
      Alert.alert('Error', 'Cannot export - invoice data or business settings not loaded');
      return;
    }

    try {
      Alert.alert('PDF Export', 'Creating hybrid PDF (Skia design + clickable links)...');
      
      console.log('[HYBRID_PDF] Starting hybrid PDF export...');
      
      // Import expo-print for PDF generation
      const { printToFileAsync } = require('expo-print');
      
      // First, capture the Skia canvas as base64
      const image = invoiceSkiaRef.current?.makeImageSnapshot();
      
      if (!image) {
        throw new Error('Failed to create image snapshot from invoice canvas');
      }
      
      console.log('[HYBRID_PDF] Skia canvas captured');
      console.log('[HYBRID_PDF] Image dimensions:', image.width(), 'x', image.height());
      
      // Encode to bytes and convert to base64
      const bytes = image.encodeToBytes();
      
      // Convert to base64 using chunked approach
      const chunkSize = 8192;
      let binaryString = '';
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, Array.from(chunk));
      }
      
      const base64String = btoa(binaryString);
      console.log('[HYBRID_PDF] Base64 conversion completed');
      
      // Calculate pagination for proper page sizing
      const lineItems = realInvoiceData?.invoice_line_items || [];
      const totalItems = lineItems.length;
      const maxItemsFirstPage = totalItems >= 9 && totalItems <= 11 ? 11 : 8;
      const needsPagination = totalItems > maxItemsFirstPage;
      const isMultiPage = needsPagination;
      
      // Create HTML that uses the Skia image as background with overlay links
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              margin: 15mm;
              size: 210mm ${isMultiPage ? '550mm' : '350mm'};
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              width: 100%;
              height: 100%;
              position: relative;
            }
            .invoice-container {
              width: 100%;
              height: 100%;
              position: relative;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              padding-top: 10mm;
            }
            .invoice-image {
              width: 95%;
              height: auto;
              max-width: 95%;
              object-fit: contain;
              position: relative;
              z-index: 1;
            }
            .link-overlay {
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              z-index: 2;
              pointer-events: none;
            }
            .clickable-area {
              position: absolute;
              pointer-events: auto;
              background: transparent;
              border: none;
              cursor: pointer;
            }
            .clickable-area a {
              display: block;
              width: 100%;
              height: 100%;
              text-decoration: none;
              color: transparent;
            }
            .clickable-area:hover {
              background: rgba(0, 102, 204, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="invoice-container">
            <!-- The exact Skia canvas image -->
            <img src="data:image/png;base64,${base64String}" class="invoice-image" alt="Invoice ${realInvoiceData.invoice_number}" />
            
            <!-- Invisible overlay with clickable areas positioned over payment links -->
            <div class="link-overlay">
              ${realInvoiceData.stripe_active ? `
                <!-- Stripe payment link area - positioned over "www.stripelink.com" text -->
                <div class="clickable-area" style="
                  left: 2.5%;
                  top: ${isMultiPage ? '85%' : '82%'};
                  width: 35%;
                  height: 2.5%;
                ">
                  <a href="https://www.stripelink.com" target="_blank" title="Pay Online with Stripe">Pay Online</a>
                </div>
              ` : ''}
              
              ${realInvoiceData.paypal_active ? `
                <!-- PayPal email link area - positioned over PayPal email text -->
                <div class="clickable-area" style="
                  left: 2.5%;
                  top: ${isMultiPage ? '87%' : '84%'};
                  width: 35%;
                  height: 2.5%;
                ">
                  <a href="mailto:${businessSettings.paypal_email || 'nobones@gmail.com'}?subject=Payment for Invoice ${realInvoiceData.invoice_number}&body=Hello, I would like to pay for Invoice ${realInvoiceData.invoice_number} (${currencySymbol}${(realInvoiceData.total_amount || 0).toFixed(2)})" target="_blank" title="Pay with PayPal">PayPal Payment</a>
                </div>
              ` : ''}
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Generate PDF with Skia design + clickable links
      const { uri } = await printToFileAsync({
        html: htmlContent,
        base64: false,
      });
      
      console.log('[HYBRID_PDF] Hybrid PDF generated successfully:', uri);
      
      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      // Share the PDF
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share Invoice ${realInvoiceData.invoice_number} PDF (Hybrid)`
      });
      
      Alert.alert(
        'Hybrid PDF Success! 🎨🔗', 
        `Perfect hybrid PDF created!\n\nFormat: PDF\nSize: ${Math.round(fileInfo.size / 1024)}KB\n\n✅ EXACT Skia design preserved!\n✅ Payment links ARE clickable!\n✅ Best of both worlds!`
      );
      
    } catch (error) {
      console.error('[HYBRID_PDF] Error:', error);
      Alert.alert('Hybrid PDF Error', `${error.message}`);
    }
  };

  // Debug logging
  console.log('[SkiaTest] Debug state:', {
    isLoading,
    businessSettings: businessSettings ? 'loaded' : 'null',
    user: user ? 'logged in' : 'not logged in',
    showLongInvoice,
    showComparison
  });

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'red', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 24 }}>LOADING STATE - VIEW IS WORKING</Text>
        <Text style={{ color: 'white', fontSize: 16, marginTop: 10 }}>
          businessSettings: {businessSettings ? 'LOADED' : 'NULL'}
        </Text>
        <Text style={{ color: 'white', fontSize: 16 }}>
          user: {user ? 'LOGGED IN' : 'NOT LOGGED IN'}
        </Text>
        <Text style={{ color: 'white', fontSize: 16 }}>
          isLoading: {isLoading ? 'TRUE' : 'FALSE'}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Stack.Screen 
        options={{ 
          title: 'Skia Invoice Test',
          headerBackTitle: 'Back'
        }} 
      />
      
      <ScrollView style={{ flex: 1 }}>
        <View style={{ padding: 20 }}>
          <H1>Skia Invoice System Test</H1>
          
          <Text style={{ marginBottom: 30, color: '#666' }}>
            Compare the current React Native + HTML system with the new unified Skia system.
          </Text>

          {/* Pagination Testing Controls */}
          <View style={{ marginBottom: 30, padding: 15, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 15, color: '#92400e' }}>📄 Pagination Testing</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontWeight: 'bold', marginBottom: 5 }}>Current Invoice:</Text>
                <Text style={{ marginBottom: 8 }}>{showLongInvoice ? 'INV-740196 (15 items - Long)' : 'INV-710231 (2 items - Short)'}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  {showLongInvoice ? '✅ Testing pagination with 15+ items' : '⭐ Standard invoice layout'}
                </Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ marginBottom: 8 }}>Long Invoice</Text>
                <Switch 
                  value={showLongInvoice} 
                  onValueChange={setShowLongInvoice}
                />
              </View>
            </View>
          </View>

          {/* PDF Export Testing */}
          <View style={{ marginBottom: 40, padding: 15, backgroundColor: '#dcfce7', borderRadius: 8, borderWidth: 1, borderColor: '#16a34a' }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 15, color: '#166534' }}>📄 PDF Export Test</Text>
            <Text style={{ marginBottom: 15, color: '#166534' }}>
              Quick test of Skia PDF generation with current invoice data
            </Text>
            <View style={{ flexDirection: 'column', gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={handleExportTest} style={{ backgroundColor: '#16a34a', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>Old Method</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleInvoiceSkiaExport} style={{ backgroundColor: '#059669', padding: 12, borderRadius: 8, alignItems: 'center', flex: 1 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>✨ Skia Export</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={handleExpoCompatiblePDFExport} style={{ backgroundColor: '#dc2626', padding: 14, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>📄 Image-based PDF Export</Text>
                <Text style={{ color: 'white', fontSize: 12, marginTop: 2 }}>Perfect Skia design, no clickable links</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleHybridPDFExport} style={{ backgroundColor: '#059669', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 }}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>🎨🔗 HYBRID PDF Export</Text>
                <Text style={{ color: 'white', fontSize: 12, marginTop: 2 }}>Skia design + clickable payment links!</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SIMPLE SKIA TEST SECTION */}
          <View style={{ marginBottom: 40, padding: 15, backgroundColor: '#fef3c7', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b' }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 15, color: '#92400e' }}>🔬 Simple Skia Test</Text>
            <Text style={{ marginBottom: 15, color: '#92400e' }}>
              Testing basic Skia Canvas capture (from official docs)
            </Text>
            
            {/* Simple test canvas container */}
            <View 
              ref={testCanvasRef}
              style={{ 
                height: 280,
                backgroundColor: 'white',
                borderRadius: 8,
                padding: 10,
                borderWidth: 1,
                borderColor: '#f59e0b',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 15
              }}
            >
              <Canvas style={{ width: 256, height: 256 }} ref={skiaCanvasRef}>
                <Group blendMode="multiply">
                  <Circle cx={85} cy={85} r={85} color="cyan" />
                  <Circle cx={171} cy={85} r={85} color="magenta" />
                  <Circle cx={128} cy={171} r={85} color="yellow" />
                </Group>
              </Canvas>
            </View>
            
            <TouchableOpacity onPress={handleSkiaExport} style={{ backgroundColor: '#f59e0b', padding: 12, borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>Test Skia Export (Official)</Text>
            </TouchableOpacity>
          </View>

          {/* Skia Test Section */}
          <View style={{ marginBottom: 40 }}>
            <H2>Skia Canvas Test</H2>
            <Text style={{ marginBottom: 20, color: '#666' }}>
              Testing Skia Canvas rendering with export functionality:
            </Text>
            
            {/* Export-Ready Invoice Canvas (Official Skia Method) */}
            <Text style={{ marginBottom: 15, color: '#666', fontWeight: 'bold' }}>
              🎯 Export-Ready Invoice Canvas (Official Skia Method):
            </Text>
            <View 
              style={{ 
                height: showLongInvoice ? 600 : 420,
                backgroundColor: 'white',
                borderRadius: 8,
                borderWidth: 2,
                borderColor: '#059669',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 15
              }}
            >
              {/* Use the actual SkiaInvoiceCanvas component with ref */}
              <SkiaInvoiceCanvas 
                invoice={realInvoiceData || currentInvoice}
                business={businessSettings}
                client={realClientData}
                currencySymbol={currencySymbol}
                style={{ 
                  width: 370, 
                  height: showLongInvoice ? 580 : 400,
                  backgroundColor: 'white'
                }}
                ref={invoiceSkiaRef}
              />
            </View>
          </View>

          {/* DYNAMIC DATA TESTING SECTION */}
          <View style={{ marginBottom: 30, padding: 20, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' }}>
            <View style={{ marginBottom: 20 }}>
              <H2 style={{ marginBottom: 10 }}>🔴 LIVE DATABASE DATA</H2>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#666', flex: 1 }}>
                  {showLongInvoice ? 'INV-740196 (15 items)' : 'INV-710231 (2 items)'}
                </Text>
                <TouchableOpacity onPress={refreshData} style={{ backgroundColor: '#3b82f6', padding: 8, borderRadius: 6 }}>
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>Refresh Data</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            {dataLoading ? (
              <Text style={{ color: '#666', fontStyle: 'italic', paddingVertical: 20 }}>Loading live data...</Text>
            ) : dataError ? (
              <Text style={{ color: '#DC2626', fontWeight: 'bold', paddingVertical: 20 }}>❌ ERROR: {dataError}</Text>
            ) : realInvoiceData ? (
              <View>
                <Text style={{ fontWeight: 'bold', marginBottom: 20, color: '#059669', fontSize: 16 }}>✅ LIVE DATA CONNECTED</Text>
                
                {/* Invoice Details */}
                <View style={{ marginBottom: 25, padding: 15, backgroundColor: '#f9fafb', borderRadius: 6 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>📋 Invoice Details:</Text>
                  <Text style={{ marginBottom: 3 }}>• Number: {realInvoiceData.invoice_number}</Text>
                  <Text style={{ marginBottom: 3 }}>• Status: {realInvoiceData.status}</Text>
                  <Text style={{ marginBottom: 3 }}>• Date: {realInvoiceData.invoice_date}</Text>
                  <Text style={{ marginBottom: 3 }}>• Due: {realInvoiceData.due_date_option}</Text>
                  <Text style={{ marginBottom: 3 }}>• Subtotal: £{realInvoiceData.subtotal_amount}</Text>
                  <Text style={{ marginBottom: 3 }}>• Tax: {realInvoiceData.tax_percentage}%</Text>
                  <Text style={{ marginBottom: 3 }}>• Total: £{realInvoiceData.total_amount}</Text>
                  <Text>• Notes: {realInvoiceData.notes}</Text>
                </View>

                {/* Client Details */}
                {realClientData && (
                  <View style={{ marginBottom: 25, padding: 15, backgroundColor: '#f0f9ff', borderRadius: 6 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>👤 Client Details:</Text>
                    <Text style={{ marginBottom: 3 }}>• Name: {realClientData.name}</Text>
                    <Text style={{ marginBottom: 3 }}>• Email: {realClientData.email}</Text>
                    <Text>• Address: {realClientData.address_client}</Text>
                  </View>
                )}

                {/* Line Items */}
                <View style={{ marginBottom: 25, padding: 15, backgroundColor: '#fefce8', borderRadius: 6 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>📦 Line Items ({realInvoiceData.invoice_line_items?.length || 0}):</Text>
                  {realInvoiceData.invoice_line_items?.slice(0, 5).map((item: any, index: number) => (
                    <View key={item.id} style={{ marginLeft: 10, marginBottom: 8 }}>
                      <Text style={{ marginBottom: 2 }}>• {index + 1}. {item.item_name} - Qty: {item.quantity} - £{item.unit_price} each = £{item.total_price}</Text>
                      <Text style={{ color: '#666', fontSize: 12, marginLeft: 15 }}>"{item.item_description}"</Text>
                    </View>
                  ))}
                  {realInvoiceData.invoice_line_items?.length > 5 && (
                    <Text style={{ marginLeft: 10, color: '#666', fontStyle: 'italic' }}>
                      ... and {realInvoiceData.invoice_line_items.length - 5} more items
                    </Text>
                  )}
                </View>

                {/* Business Settings */}
                <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#f3f4f6', borderRadius: 6 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 10 }}>🏢 Business Settings:</Text>
                  <Text style={{ marginBottom: 3 }}>• Name: {businessSettings?.business_name || 'Not loaded'}</Text>
                  <Text style={{ marginBottom: 3 }}>• Email: {businessSettings?.business_email || 'Not loaded'}</Text>
                  <Text style={{ marginBottom: 3 }}>• Currency: {businessSettings?.currency_code || 'Not loaded'}</Text>
                  <Text>• Logo: {businessSettings?.business_logo_url ? '✅ Available' : '❌ No logo'}</Text>
                </View>

                <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic', paddingTop: 15, borderTopWidth: 1, borderTopColor: '#e5e7eb' }}>
                  💡 Test: Change invoice data in database and click "Refresh Data" to verify live connection
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#666', paddingVertical: 20 }}>No data received</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 
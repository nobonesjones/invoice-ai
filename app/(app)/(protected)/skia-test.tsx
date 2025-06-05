import React, { useState, useEffect } from 'react';
import { View, ScrollView, Switch, Alert } from 'react-native';
import { Stack } from 'expo-router';

import { SafeAreaView } from '@/components/safe-area-view';
import { Text } from '@/components/ui/text';
import { H1, H2 } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/context/supabase-provider';

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
      console.log('[fetchRealInvoiceData] Fetching live data for invoice ID: ea512ea5-e222-4bdb-8e3b-ab66a9f26597');
      
      // Fetch real invoice with client and line items using invoice ID
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          clients (*),
          invoice_line_items (*)
        `)
        .eq('id', 'ea512ea5-e222-4bdb-8e3b-ab66a9f26597')
        .single();

      if (invoiceError) {
        console.error('[fetchRealInvoiceData] Error:', invoiceError);
        setDataError(`Failed to fetch invoice: ${invoiceError.message}`);
        setDataLoading(false);
        return;
      }

      console.log('[fetchRealInvoiceData] SUCCESS - Live data received:', invoiceData);
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

  // REFRESH DATA FUNCTION FOR TESTING
  const refreshData = () => {
    console.log('[refreshData] Manually refreshing live data...');
    fetchRealInvoiceData();
  };

  const handleExportTest = async () => {
    Alert.alert(
      'Export Test',
      'In the full implementation, this would export the Skia canvas to PDF with pixel-perfect matching.',
      [{ text: 'OK' }]
    );
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
          
          <Text style={{ marginBottom: 20, color: '#666' }}>
            Compare the current React Native + HTML system with the new unified Skia system.
          </Text>

          {/* Debug Info */}
          <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#e3f2fd', borderRadius: 8 }}>
            <Text style={{ fontWeight: 'bold' }}>Debug Status:</Text>
            <Text>• businessSettings: {businessSettings ? 'LOADED' : 'NULL'}</Text>
            <Text>• user: {user ? 'LOGGED IN' : 'NOT LOGGED IN'}</Text>
            <Text>• isLoading: {isLoading ? 'TRUE' : 'FALSE'}</Text>
          </View>

          {/* Skia Test Section */}
          <View style={{ marginBottom: 20 }}>
            <H2>Skia Canvas Test</H2>
            <Text style={{ marginBottom: 15, color: '#666' }}>
              Testing basic Skia Canvas rendering:
            </Text>
            
            {/* Fixed container with defined height - no conditional rendering */}
            <View style={{ 
              height: 420, // Increased height to accommodate A4 proportions (280x396 + padding)
              backgroundColor: '#f8f9fa',
              borderRadius: 8,
              padding: 10,
              borderWidth: 1,
              borderColor: '#dee2e6',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <SkiaInvoiceCanvas 
                invoice={realInvoiceData || currentInvoice}
                business={businessSettings}
                client={realClientData}
                currencySymbol={currencySymbol}
                style={{ 
                  width: 290, // Fixed width for A4 proportion
                  height: 400  // Fixed height for A4 proportion
                }} 
              />
            </View>
          </View>

          {/* DYNAMIC DATA TESTING SECTION */}
          <View style={{ marginBottom: 20, padding: 15, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <H2>🔴 LIVE DATABASE DATA (INV-710231)</H2>
              <Button onPress={refreshData}>
                <Text>Refresh Data</Text>
              </Button>
            </View>
            
            {dataLoading ? (
              <Text style={{ color: '#666', fontStyle: 'italic' }}>Loading live data...</Text>
            ) : dataError ? (
              <Text style={{ color: '#DC2626', fontWeight: 'bold' }}>❌ ERROR: {dataError}</Text>
            ) : realInvoiceData ? (
              <View>
                <Text style={{ fontWeight: 'bold', marginBottom: 10, color: '#059669' }}>✅ LIVE DATA CONNECTED</Text>
                
                {/* Invoice Details */}
                <View style={{ marginBottom: 15 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>📋 Invoice Details:</Text>
                  <Text>• Number: {realInvoiceData.invoice_number}</Text>
                  <Text>• Status: {realInvoiceData.status}</Text>
                  <Text>• Date: {realInvoiceData.invoice_date}</Text>
                  <Text>• Due: {realInvoiceData.due_date_option}</Text>
                  <Text>• Subtotal: £{realInvoiceData.subtotal_amount}</Text>
                  <Text>• Tax: {realInvoiceData.tax_percentage}%</Text>
                  <Text>• Total: £{realInvoiceData.total_amount}</Text>
                  <Text>• Notes: {realInvoiceData.notes}</Text>
                </View>

                {/* Client Details */}
                {realClientData && (
                  <View style={{ marginBottom: 15 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>👤 Client Details:</Text>
                    <Text>• Name: {realClientData.name}</Text>
                    <Text>• Email: {realClientData.email}</Text>
                    <Text>• Address: {realClientData.address_client}</Text>
                  </View>
                )}

                {/* Line Items */}
                <View style={{ marginBottom: 15 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>📦 Line Items ({realInvoiceData.invoice_line_items?.length || 0}):</Text>
                  {realInvoiceData.invoice_line_items?.map((item: any, index: number) => (
                    <View key={item.id} style={{ marginLeft: 10, marginBottom: 5 }}>
                      <Text>• {index + 1}. {item.item_name} - Qty: {item.quantity} - £{item.unit_price} each = £{item.total_price}</Text>
                      <Text style={{ color: '#666', fontSize: 12, marginLeft: 15 }}>"{item.item_description}"</Text>
                    </View>
                  ))}
                </View>

                {/* Business Settings */}
                <View style={{ marginBottom: 15 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 5 }}>🏢 Business Settings:</Text>
                  <Text>• Name: {businessSettings?.business_name || 'Not loaded'}</Text>
                  <Text>• Email: {businessSettings?.business_email || 'Not loaded'}</Text>
                  <Text>• Currency: {businessSettings?.currency_code || 'Not loaded'}</Text>
                  <Text>• Logo: {businessSettings?.business_logo_url ? '✅ Available' : '❌ No logo'}</Text>
                </View>

                <Text style={{ fontSize: 12, color: '#666', marginTop: 10, fontStyle: 'italic' }}>
                  💡 Test: Change invoice data in database and click "Refresh Data" to verify live connection
                </Text>
              </View>
            ) : (
              <Text style={{ color: '#666' }}>No data received</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
} 
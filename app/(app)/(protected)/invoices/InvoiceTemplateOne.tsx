import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Tables } from '../../../../types/database.types'; // Corrected import path
import { format } from 'date-fns';

// Define InvoiceForTemplate by explicitly listing properties
// This gives more control than Omit if type conflicts are occurring
export interface InvoiceForTemplate {
  // Properties from Tables<'invoices'>
  id: Tables<'invoices'>['id'];
  user_id: Tables<'invoices'>['user_id'];
  client_id: Tables<'invoices'>['client_id'];
  invoice_number: Tables<'invoices'>['invoice_number'];
  status: Tables<'invoices'>['status'];
  invoice_date: Tables<'invoices'>['invoice_date'];
  due_date: Tables<'invoices'>['due_date'];
  due_date_option: Tables<'invoices'>['due_date_option'];
  po_number: Tables<'invoices'>['po_number'];
  custom_headline: Tables<'invoices'>['custom_headline'];
  subtotal_amount: Tables<'invoices'>['subtotal_amount'];
  discount_type: Tables<'invoices'>['discount_type'];
  discount_value: Tables<'invoices'>['discount_value'];
  tax_percentage: Tables<'invoices'>['tax_percentage'];
  total_amount: Tables<'invoices'>['total_amount'];
  notes: Tables<'invoices'>['notes'];
  stripe_active: Tables<'invoices'>['stripe_active'];
  bank_account_active: Tables<'invoices'>['bank_account_active'];
  paypal_active: Tables<'invoices'>['paypal_active'];
  created_at: Tables<'invoices'>['created_at'];
  updated_at: Tables<'invoices'>['updated_at'];
  clients: Tables<'clients'> | null; // Corrected type for clients relation

  // Overridden or new properties for the template
  invoice_line_items: Tables<'invoice_line_items'>[];
  currency: string; // Strictly string
  currency_symbol: string;
  invoice_tax_label: string; // New property
}

// Change to a direct type alias for simplicity and to avoid extension conflicts
export type BusinessSettingsRow = Tables<'business_settings'>;

interface InvoiceTemplateOneProps {
  invoice: InvoiceForTemplate | null;
  clientName: string | null;
  businessSettings: BusinessSettingsRow | null;
}

// Placeholder Formatting Functions (we can make these more robust later)
const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toLocaleDateString('en-GB', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    });
  } catch (e) {
    return dateString; // Fallback to original string if parsing fails
  }
};

const formatCurrency = (amount: number | null | undefined, currencyCode: string | null | undefined = 'USD') => {
  if (amount == null) return 'N/A';
  // Basic currency formatting, can be enhanced with Intl.NumberFormat for proper symbols
  const symbols: { [key: string]: string } = { USD: '$', EUR: '€', GBP: '£' };
  const symbol = symbols[currencyCode || 'USD'] || (currencyCode ? currencyCode + ' ' : '$');
  return `${symbol}${amount.toFixed(2)}`;
};

const formatDueDateDisplay = (option: string | null | undefined, dateString: string | null | undefined): string => {
  const friendlyOptions: { [key: string]: string } = {
    'on_receipt': 'On receipt',
    'net_7': 'In 7 days',
    'net_14': 'In 14 days',
    'net_30': 'In 30 days',
  };

  if (option && friendlyOptions[option]) {
    return friendlyOptions[option];
  }

  // If option is not a recognized key, or is null/empty,
  // then we assume a specific date was set (or should be used as fallback).
  if (dateString) {
    return formatDate(dateString); // formatDate already handles "20th June 2025" style and N/A for null
  }
  
  // If option was provided but wasn't a known key and there's no dateString fallback
  if (option) return option; // Display the custom/unmapped option as is

  return 'N/A'; // Default fallback if neither option nor dateString yields a value
};

const InvoiceTemplateOne: React.FC<InvoiceTemplateOneProps> = ({ 
  invoice,
  clientName,
  businessSettings,
}) => {
  // Default theme for now if not passed
  const colors = {
    text: 'black',
    mutedText: 'black',
    border: '#eee',
    primary: '#007bff',
    highlightBackground: '#f0f8ff',
    headerText: 'black',
  };

  console.log('[InvoiceTemplateOne] Business Settings Prop:', JSON.stringify(businessSettings, null, 2));
  console.log('[InvoiceTemplateOne] Due Date Debug:', { due_date_option: invoice?.due_date_option, due_date: invoice?.due_date });
  console.log('InvoiceTemplateOne - invoice.invoice_line_items:', JSON.stringify(invoice?.invoice_line_items, null, 2));

  if (!invoice) {
    console.log('[InvoiceTemplateOne] invoice prop is null or undefined!');
    return (
      <View style={[styles.container, { borderColor: 'red', minHeight: 200 }]}> 
        <Text style={{ color: 'red', fontWeight: 'bold' }}>No invoice data found. (invoice is null)</Text>
      </View>
    );
  }

  // Calculate actual discount amount
  let calculatedDiscountValue = 0;

  if (invoice && invoice.discount_value != null && invoice.discount_value > 0 && invoice.subtotal_amount != null) {
    if (invoice.discount_type === 'percentage') {
      calculatedDiscountValue = (invoice.subtotal_amount * invoice.discount_value) / 100;
    } else if (invoice.discount_type === 'fixed') {
      calculatedDiscountValue = invoice.discount_value;
    }
  }

  // Calculate tax amount if applicable
  let taxAmount = 0;
  if (invoice && invoice.tax_percentage != null && invoice.tax_percentage > 0 && invoice.subtotal_amount != null) {
    // Calculate tax on subtotal after discount
    const amountBeforeTax = invoice.subtotal_amount - calculatedDiscountValue;
    taxAmount = (amountBeforeTax * invoice.tax_percentage) / 100;
  }

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      {/* 1. Header Section */}
      <View style={styles.headerSection}>
        <View style={styles.headerLeft}>
          {businessSettings?.business_logo_url ? (
            <Image source={{ uri: businessSettings.business_logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <Text style={styles.logoPlaceholder}>{businessSettings?.business_name || 'Your Logo'}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.invoiceLabel}>INVOICE</Text>
          <Text style={[styles.text, { marginTop: 4 }]}>Ref: {invoice.invoice_number || 'N/A'}</Text>
          <Text style={styles.text}>Date: {formatDate(invoice.invoice_date)}</Text>
          <Text style={styles.text}>
            Due: {formatDueDateDisplay(invoice.due_date_option, invoice.due_date)}
          </Text>
        </View>
      </View>

      {/* 2. Recipient & 3. Invoice Number Section */}
      <View style={styles.metaSection}>
        <View style={styles.metaLeft}> 
          {/* Business Information (From) */}
          <Text style={styles.label}>From:</Text>
          {businessSettings?.business_name && (
            <Text style={styles.businessNameText}>{businessSettings.business_name}</Text>
          )}
          {businessSettings?.business_address && (
            <Text style={styles.text}>{businessSettings.business_address}</Text>
          )}
          {/* You can add more business details here if needed, like email/phone */}
        </View>

        <View style={styles.metaRight}> 
          {/* Client Information (Bill To) */}
          <Text style={styles.label}>Bill To:</Text>
          <Text style={styles.clientNameText}>{clientName || invoice.clients?.name || 'N/A'}</Text>
          {invoice.clients?.email && <Text style={styles.text}>{invoice.clients.email}</Text>}
          {invoice.clients?.phone && <Text style={styles.text}>{invoice.clients.phone}</Text>}
          {invoice.clients?.address_line1 && <Text style={styles.text}>{invoice.clients.address_line1}</Text>}
          {invoice.clients?.address_line2 && <Text style={styles.text}>{invoice.clients.address_line2}</Text>}
          {(invoice.clients?.city || invoice.clients?.state_province_region || invoice.clients?.postal_zip_code) && (
            <Text style={styles.text}>
              {invoice.clients.city ? `${invoice.clients.city}, ` : ''}
              {invoice.clients.state_province_region ? `${invoice.clients.state_province_region} ` : ''}
              {invoice.clients.postal_zip_code || ''}
            </Text>
          )}
          {invoice.clients?.country && <Text style={styles.text}>{invoice.clients.country}</Text>}
        </View>
      </View>

      {/* 4. Item Table Section */}
      <View style={styles.itemTableSection}>
        {/* Table Header */}
        <View style={styles.tableRowHeader}>
          <View style={styles.qtyCol}><Text style={[styles.tableHeader, { textAlign: 'center' }]}>QTY</Text></View>
          <View style={styles.descCol}><Text style={styles.tableHeader}>DESCRIPTION</Text></View>
          <View style={styles.priceCol}><Text style={[styles.tableHeader, { textAlign: 'right' }]}>PRICE</Text></View>
          <View style={styles.totalCol}><Text style={[styles.tableHeader, { textAlign: 'right' }]}>TOTAL</Text></View>
        </View>

        {/* Table Body - Dynamically generated item rows */}
        {invoice.invoice_line_items && invoice.invoice_line_items.length > 0 ? (
          invoice.invoice_line_items.map((item, index) => (
            <View key={item.id || `item-${index}`} style={styles.tableRow}>
              <View style={styles.qtyCol}><Text style={[styles.lineItemCellText, { textAlign: 'center' }]}>{item.quantity}</Text></View>
              <View style={styles.descCol}>
                <Text style={styles.lineItemCellText}>{item.item_name}</Text>
                {item.item_description && (
                  <Text style={styles.itemSubtitle}>{item.item_description}</Text>
                )}
              </View>
              <View style={styles.priceCol}><Text style={[styles.lineItemCellText, { textAlign: 'right' }]}>{formatCurrency(item.unit_price, invoice.currency)}</Text></View>
              <View style={styles.totalCol}><Text style={[styles.lineItemCellText, { textAlign: 'right' }]}>{formatCurrency(item.total_price, invoice.currency)}</Text></View>
            </View>
          ))
        ) : (
          <View style={styles.tableRow}>
            <Text style={{ flex: 1, textAlign: 'center', paddingVertical: 10, fontStyle: 'italic', color: 'black' }}>
              No line items.
            </Text>
          </View>
        )}
      </View>

      {/* 5. Footer Section */}
      <View style={styles.footerSection}>
        <View style={styles.footerLeft}>
          <View style={styles.footerBlock}>
            <Text style={styles.paymentTermsHeader}>Payment Method</Text> 
            <Text style={styles.paymentTermsBody}>Details to be added from Business Settings</Text>
          </View>
          <View style={styles.footerBlock}>
            <Text style={styles.paymentTermsHeader}>Terms & Conditions</Text> 
            <Text style={styles.paymentTermsBody}>Details to be added from Business Settings</Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalLine}>
              <Text style={styles.label}>Subtotal</Text>
              <Text style={styles.totalsValueText}>
                {formatCurrency(invoice.subtotal_amount, invoice.currency_symbol)}
              </Text>
            </View>

            {/* Discount - displays only if there's a calculated discount value */}
            {calculatedDiscountValue > 0 && (
              <View style={styles.totalLine}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.label}>Discount </Text>
                  {invoice.discount_type === 'percentage' && invoice.discount_value != null && (
                    <Text style={styles.discountPercentageText}>({invoice.discount_value}%)</Text>
                  )}
                </View>
                <Text style={styles.totalsValueText}>
                  - {formatCurrency(calculatedDiscountValue, invoice.currency_symbol)}
                </Text>
              </View>
            )}

            {/* Tax - displays only if there's a tax percentage */}
            {invoice.tax_percentage != null && invoice.tax_percentage > 0 && (
              <View style={styles.totalLine}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <Text style={styles.label}>{invoice.invoice_tax_label || 'Tax'} </Text>
                  {invoice.tax_percentage != null && (
                    <Text style={styles.discountPercentageText}>({invoice.tax_percentage}%)</Text>
                  )}
                </View>
                <Text style={styles.totalsValueText}>
                  {formatCurrency(taxAmount, invoice.currency_symbol)}
                </Text>
              </View>
            )}

            <View style={[styles.totalLine, styles.grandTotalLine]}>
              <Text style={{ fontSize: 8, fontWeight: 'bold', color: styles.label.color /* Using color from styles.label */ }}>GRAND TOTAL</Text> 
              <Text style={styles.grandTotalText}>{formatCurrency(invoice.total_amount, invoice.currency_symbol)}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({

  container: {
    width: '100%',
    maxWidth: 370,
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    margin: 10, // Added margin for better visual separation if scaled in viewer
    height: 600, // Reduced height further
  },
  textPlaceholder: { // Added for placeholder client address lines
    fontSize: 6,
    color: 'black',
    fontStyle: 'italic',
    lineHeight: 10,
  },
  // Header Section
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  headerLeft: {},
  logo: {
    width: 100,
    height: 50,
  },
  logoPlaceholder: {
    fontSize: 10, 
    fontWeight: 'bold',
    color: 'black',
    width: 100,
    height: 50,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  invoiceLabel: {
    fontSize: 16, 
    fontWeight: 'bold',
    color: 'black',
  },
  headerTextDetail: {
    fontSize: 9, 
    marginTop: 2, // Reduced from 4 for tighter spacing
    color: 'black',
  },
  // Meta Section (Recipient & Invoice No.)
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderColor: '#eee',
    paddingVertical: 10,
  },
  metaLeft: {
    flex: 1,
  },
  metaRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 8, 
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 2,
  },
  text: {
    fontSize: 9, 
    color: 'black',
    lineHeight: 11, // Reduced from 14
  },
  clientNameText: {
    fontSize: 10, 
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 2,
  },
  businessNameText: { 
    fontSize: 10, 
    fontWeight: 'bold',
    color: 'black', 
    marginBottom: 1, // Reduced from 2
  },
  // Item Table Section
  itemTableSection: {
    marginBottom: 20,
  },
  tableRowHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  tableHeader: {
    fontSize: 7, 
    fontWeight: 'bold',
    color: 'black',
    textAlign: 'left', 
  },
  tableCell: {
  },
  qtyCol: { flex: 1, paddingHorizontal: 5, textAlign: 'center' }, 
  descCol: { flex: 4, paddingHorizontal: 5 },
  priceCol: { flex: 2, paddingHorizontal: 5, textAlign: 'right' },
  totalCol: { flex: 2, paddingHorizontal: 5, textAlign: 'right' },
  itemSubtitle: {
    fontSize: 6, 
    color: 'black',
    marginTop: 2,
  },
  lineItemCellText: { 
    fontSize: 7, 
    color: 'black',
  },
  // Footer Section
  footerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  footerLeft: {
    flex: 1.5, 
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  footerBlock: {
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 9, 
    color: 'black',
    fontStyle: 'italic',
    marginTop: 2,
  },
  paymentTermsHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 2,
  },
  paymentTermsBody: {
    fontSize: 8,
    color: 'black',
    fontStyle: 'italic',
    marginTop: 2,
  },
  totalsBlock: {},
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    width: '100%', // Ensure the line takes full available width in its container
  },
  grandTotalLine: {
    marginTop: 20, // Increased from 5
    paddingVertical: 8,
    paddingHorizontal: 10, 
    borderTopWidth: 2, 
    borderColor: '#333',
  },
  grandTotalText: {
    fontSize: 8, 
    fontWeight: 'bold',
    textAlign: 'right',
    color: 'black',
  },
  totalsValueText: { 
    fontSize: 8,
    color: 'black',
    textAlign: 'right',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 5,
  },
  discountPercentageText: { // New style for the smaller percentage text
    fontSize: 6,
    color: 'black', // Assuming styles.label.color is 'black'
    fontWeight: 'normal', // Making it normal weight to be less prominent
    marginLeft: 2, // Add a little space after 'Discount '
  },
});

export default InvoiceTemplateOne;

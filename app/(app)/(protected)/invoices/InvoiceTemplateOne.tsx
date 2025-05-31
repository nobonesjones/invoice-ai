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
  payment_terms?: string; // Added payment_terms
}

// Change to a direct type alias for simplicity and to avoid extension conflicts
// Extended to include payment_options fields since they're merged in invoice-viewer.tsx
export type BusinessSettingsRow = Tables<'business_settings'> & {
  // Payment options fields (merged from payment_options table)
  paypal_enabled?: boolean;
  paypal_email?: string;
  stripe_enabled?: boolean;
  bank_transfer_enabled?: boolean;
  bank_details?: string;
  invoice_terms_notes?: string;
};

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

const calculateDiscountAmount = (invoice: InvoiceForTemplate) => {
  if (invoice && invoice.discount_value != null && invoice.discount_value > 0 && invoice.subtotal_amount != null) {
    if (invoice.discount_type === 'percentage') {
      return (invoice.subtotal_amount * invoice.discount_value) / 100;
    } else if (invoice.discount_type === 'fixed') {
      return invoice.discount_value;
    }
  }
  return 0;
};

const calculateTaxAmount = (invoice: InvoiceForTemplate) => {
  if (invoice && invoice.tax_percentage != null && invoice.tax_percentage > 0 && invoice.subtotal_amount != null) {
    // Calculate tax on subtotal after discount
    const amountBeforeTax = invoice.subtotal_amount - calculateDiscountAmount(invoice);
    return (amountBeforeTax * invoice.tax_percentage) / 100;
  }
  return 0;
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

  if (!invoice) {
    return (
      <View style={[styles.container, { borderColor: 'red', minHeight: 200 }]}> 
        <Text style={{ color: 'red', fontWeight: 'bold' }}>No invoice data found. (invoice is null)</Text>
      </View>
    );
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
          <Text style={[styles.label, { textAlign: 'right' }]}>Bill To:</Text>
          <Text style={[styles.clientNameText, { textAlign: 'right' }]}>{invoice.clients?.name || clientName || 'N/A'}</Text>
          {/* TODO: Regenerate Supabase types. Using 'as any' as a temporary workaround because TS types are outdated. */} 
          {(invoice.clients as any)?.address_client && (
            <Text style={[styles.text, { textAlign: 'right' }]}>{(invoice.clients as any).address_client}</Text>
          )}
          {invoice.clients?.email && <Text style={[styles.text, { textAlign: 'right' }]}>{invoice.clients.email}</Text>}
          {invoice.clients?.phone && <Text style={[styles.text, { textAlign: 'right' }]}>{invoice.clients.phone}</Text>}
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
        {invoice?.invoice_line_items && invoice.invoice_line_items.length > 0 ? (
          invoice.invoice_line_items.map((item, index) => (
            <View key={item.id || `item-${index}`} style={styles.tableRow}>
              <View style={styles.qtyCol}><Text style={[styles.lineItemCellText, { textAlign: 'center' }]}>{item.quantity}</Text></View>
              <View style={styles.descCol}>
                <Text style={styles.lineItemCellText}>{item.item_name}</Text>
                {item.item_description && (
                  <Text style={styles.itemSubtitle}>{item.item_description}</Text>
                )}
              </View>
              <View style={styles.priceCol}><Text style={[styles.lineItemCellText, { textAlign: 'right' }]}>{invoice.currency_symbol}{item.unit_price?.toFixed(2) ?? '0.00'}</Text></View>
              <View style={styles.totalCol}><Text style={[styles.lineItemCellText, { textAlign: 'right' }]}>{invoice.currency_symbol}{item.total_price?.toFixed(2) ?? '0.00'}</Text></View>
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
            <Text style={styles.paymentTermsHeader}>Terms, Instructions & Notes</Text>
            <Text style={styles.paymentTermsBody}>{invoice?.notes || 'No terms specified.'}</Text>
          </View>
          {invoice?.payment_terms && (
          <View style={styles.footerBlock}>
            <Text style={styles.paymentTermsHeader}>Payment Terms</Text>
            <Text style={styles.paymentTermsBody}>{invoice.payment_terms}</Text>
          </View>
          )}
          {/* Payment Methods Section */}
          {(invoice?.stripe_active || invoice?.paypal_active || invoice?.bank_account_active) && (
          <View style={styles.footerBlock}>
            <Text style={styles.paymentTermsHeader}>Payment Methods</Text>
            
            {/* Stripe Payment */}
            {invoice?.stripe_active && (
              <View style={styles.paymentMethodItem}>
                <View style={styles.paymentMethodRow}>
                  <Text style={styles.paymentMethodText}>Pay Online</Text>
                  <View style={styles.paymentIconsContainer}>
                    <Image source={require('../../../../assets/visaicon.png')} style={styles.paymentIcon} />
                    <Image source={require('../../../../assets/mastercardicon.png')} style={styles.paymentIcon} />
                  </View>
                </View>
                <Text style={styles.paymentMethodText}>www.stripelink.com</Text>
              </View>
            )}
            
            {/* PayPal Payment */}
            {invoice?.paypal_active && (
              <View style={styles.paymentMethodItem}>
                <View style={styles.paymentMethodRow}>
                  <Text style={styles.paymentMethodText}>Pay with PayPal</Text>
                  <Image source={require('../../../../assets/paypalicon.png')} style={styles.paymentIcon} />
                </View>
                <Text style={styles.paymentMethodText}>
                  {businessSettings?.paypal_email || 'nobones@gmail.com'}
                </Text>
              </View>
            )}
            
            {/* Bank Transfer */}
            {invoice?.bank_account_active && (
              <View style={styles.paymentMethodItem}>
                <Text style={styles.paymentMethodText}>Bank Transfer</Text>
                <Text style={styles.paymentMethodText}>
                  {businessSettings?.bank_details || 'Bank 1\n1 2457 5 6 5 500598 32\nU EA'}
                </Text>
              </View>
            )}
          </View>
          )}
        </View>
        <View style={styles.footerRight}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalLine}>
              <Text style={styles.label}>Subtotal:</Text>
              <Text style={styles.totalsValueText}>{invoice.currency_symbol}{invoice.subtotal_amount?.toFixed(2) ?? '0.00'}</Text>
            </View>
            {invoice.discount_value != null && invoice.discount_value > 0 && (
              <View style={styles.totalLine}>
                <Text style={styles.label}>
                  Discount {invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}:
                </Text>
                <Text style={styles.totalsValueText}>-{invoice.currency_symbol}{calculateDiscountAmount(invoice).toFixed(2)}</Text>
              </View>
            )}
            {invoice.tax_percentage != null && invoice.tax_percentage > 0 && (
              <View style={styles.totalLine}>
                <Text style={styles.label}>{invoice.invoice_tax_label || 'Tax'} ({invoice.tax_percentage}%):</Text>
                <Text style={styles.totalsValueText}>{invoice.currency_symbol}{calculateTaxAmount(invoice).toFixed(2)}</Text>
              </View>
            )}
            
            {/* Spacer before grand total */}
            <View style={{ height: 10 }} />
            
            {/* Grand Total in styled box */}
            <View style={styles.grandTotalBox}>
              <Text style={styles.grandTotalBoxText}>Total:</Text>
              <Text style={styles.grandTotalBoxText}>{invoice.currency_symbol}{invoice.total_amount?.toFixed(2) ?? '0.00'}</Text>
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
    marginLeft: -10, // Added to shift left
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
    alignItems: 'flex-end', // Reverted to 'flex-end' to align the block to the right
  },
  label: {
    fontSize: 8, 
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 2,
  },
  text: {
    fontSize: 8, 
    color: 'black',
    lineHeight: 11, // Reduced from 14
    paddingLeft: 0, // Ensure no unintended left padding
    marginLeft: 0,  // Ensure no unintended left margin
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
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
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
  grandTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderColor: '#eee',
    width: '100%',
  },
  grandTotalBoxText: {
    fontSize: 8, 
    fontWeight: 'bold',
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
  paymentMethodItem: {
    marginBottom: 8,
  },
  paymentMethodText: {
    fontSize: 8,
    color: 'black',
    fontStyle: 'italic',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 1,
  },
  paymentIconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  paymentIcon: {
    width: 16,
    height: 10,
    marginLeft: 2,
    resizeMode: 'contain',
  },
});

export default InvoiceTemplateOne;

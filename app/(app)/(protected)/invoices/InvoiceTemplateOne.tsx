import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import type { Tables } from '../../../../types/database.types'; // Adjust path as needed

// Define the structure of the invoice data more precisely for the template
export interface InvoiceForTemplate extends Tables<'invoices'> {
  invoice_line_items: Tables<'invoice_line_items'>[];
  currency: string; // Ensure currency is present and not optional
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

const InvoiceTemplateOne: React.FC<InvoiceTemplateOneProps> = ({ 
  invoice,
  clientName,
  businessSettings,
}) => {
  // Default theme for now if not passed
  const colors = {
    text: '#333',
    mutedText: '#777',
    border: '#eee',
    primary: '#007bff',
    highlightBackground: '#f0f8ff',
    headerText: '#000',
  };

  if (!invoice) {
    console.log('[InvoiceTemplateOne] invoice prop is null or undefined!');
    return (
      <View style={[styles.container, { borderColor: 'red', minHeight: 200 }]}> 
        <Text style={{ color: 'red', fontWeight: 'bold' }}>No invoice data found. (invoice is null)</Text>
      </View>
    );
  }

  console.log('InvoiceTemplateOne - invoice.invoice_line_items:', JSON.stringify(invoice.invoice_line_items, null, 2));

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
          <Text style={[styles.invoiceLabel, { color: colors.headerText }]}>INVOICE</Text>
          <Text style={styles.headerTextDetail}>Date: {formatDate(invoice.invoice_date)}</Text>
          <Text style={styles.headerTextDetail}>Due: {formatDate(invoice.due_date)}</Text> {/* Added Due Date */}
        </View>
      </View>

      {/* 2. Recipient & 3. Invoice Number Section */}
      <View style={styles.metaSection}>
        <View style={styles.metaLeft}> {/* Invoice Number Section */}
          <Text style={styles.text}>{invoice.invoice_number || 'N/A'}</Text>
        </View>
        <View style={styles.metaRight}> {/* Recipient Section */}
          <Text style={styles.clientNameText}>To : {clientName || 'N/A'}</Text>
          {/* Placeholder for client address - to be added later */}
          <Text style={styles.textPlaceholder}>Client Company Name</Text>
          <Text style={styles.textPlaceholder}>Client Address Line 1</Text>
          <Text style={styles.textPlaceholder}>Client City, Country</Text>
        </View>
      </View>

      {/* 4. Item Table Section */}
      <View style={styles.itemTableSection}>
        {/* Table Header */}
        <View style={styles.tableRowHeader}>
          <Text style={[styles.tableHeader, styles.qtyCol]}>QTY</Text>
          <Text style={[styles.tableHeader, styles.descCol]}>DESCRIPTION</Text>
          <Text style={[styles.tableHeader, styles.priceCol]}>PRICE</Text>
          <Text style={[styles.tableHeader, styles.totalCol]}>TOTAL</Text>
        </View>

        {/* Table Body - Dynamically generated item rows */}
        {invoice.invoice_line_items && invoice.invoice_line_items.length > 0 ? (
          invoice.invoice_line_items.map((item, index) => (
            <View key={item.id || `item-${index}`} style={styles.tableRow}>
              <View style={[styles.tableCell, styles.qtyCol]}>
                <Text style={styles.text}>{item.quantity}</Text>
              </View>
              <View style={[styles.tableCell, styles.descCol]}>
                <Text style={styles.text}>{item.item_name}</Text>
                {item.item_description && (
                  <Text style={styles.itemSubtitle}>{item.item_description}</Text>
                )}
              </View>
              <View style={[styles.tableCell, styles.priceCol]}>
                <Text style={styles.text}>{formatCurrency(item.unit_price, invoice.currency)}</Text>
              </View>
              <View style={[styles.tableCell, styles.totalCol]}>
                <Text style={styles.text}>{formatCurrency(item.total_price, invoice.currency)}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontStyle: 'italic', paddingVertical: 10 }]}>
              No line items to display.
            </Text>
          </View>
        )}
      </View>

      {/* 5. Footer Section */}
      <View style={styles.footerSection}>
        <View style={styles.footerLeft}>
          <View style={styles.footerBlock}>
            <Text style={styles.paymentTermsHeader}>Payment Method</Text> {/* Reverted header text, kept new style */}
            <Text style={styles.paymentTermsBody}>
              {/* {businessSettings?.payment_methods || 'Bank Transfer, PayPal'} */}
              Details to be added from Business Settings {/* Reverted to placeholder */}
            </Text>
          </View>
          <View style={styles.footerBlock}>
            <Text style={styles.paymentTermsHeader}>Terms & Conditions</Text> {/* Reverted header text, kept new style */}
            <Text style={styles.paymentTermsBody}>
              {/* {businessSettings?.terms_conditions || 'Payment due within 30 days.'} */}
              Details to be added from Business Settings {/* Reverted to placeholder */}
            </Text>
          </View>
        </View>
        <View style={styles.footerRight}>
          <View style={styles.totalsBlock}>
            <View style={styles.totalLine}>
              <Text style={styles.label}>SUBTOTAL</Text>
              <Text style={styles.text}>{formatCurrency(invoice.subtotal_amount, invoice.currency)}</Text>
            </View>
            {(invoice.discount_value ?? 0) > 0 && (
              <View style={styles.totalLine}>
                <Text style={styles.text}>Discount {invoice.discount_type ? `(${invoice.discount_type})` : ''}</Text>
                <Text style={styles.text}>-{formatCurrency(invoice.discount_value, invoice.currency)}</Text>
              </View>
            )}
            <View style={styles.totalLine}>
              <Text style={styles.text}>Tax ({invoice.tax_percentage ?? 0}%)</Text>
              <Text style={styles.text}>
                {formatCurrency(
                  ((invoice.subtotal_amount ?? 0) - (invoice.discount_value ?? 0)) * (invoice.tax_percentage ?? 0) / 100,
                  invoice.currency
                )}
              </Text>
            </View>
            <View style={[styles.totalLine, styles.grandTotalLine, { backgroundColor: colors.highlightBackground }]}>
              <Text style={[styles.grandTotalText, { color: colors.primary }]}>GRAND TOTAL</Text>
              <Text style={[styles.grandTotalText, { color: colors.primary }]}>
                {formatCurrency(invoice.total_amount, invoice.currency)}
              </Text>
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
    padding: 16,
    backgroundColor: '#fff', // Reverted from '#ffe6f0' (pink debug)
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    marginVertical: 16,
    minHeight: 300,
    // Card shadow (iOS + Android)
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 4,
  },
  textPlaceholder: { // Added for placeholder client address lines
    fontSize: 6,
    color: '#aaa',
    fontStyle: 'italic',
    lineHeight: 9,
  },
  // Header Section
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    alignItems: 'flex-start',
    // Removed backgroundColor: '#e6ffe6' (green debug)
  },
  headerLeft: {},
  logo: {
    width: 100,
    height: 50,
  },
  logoPlaceholder: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ccc',
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerTextDetail: {
    fontSize: 11,
    marginTop: 4,
  },
  // Meta Section (Recipient & Invoice No.)
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderColor: '#eee',
    paddingVertical: 10,
    // Removed backgroundColor: '#e6f0ff' (blue debug)
  },
  metaLeft: {
    flex: 1,
  },
  metaRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 2,
  },
  text: {
    fontSize: 11,
    color: '#333',
    lineHeight: 17,
  },
  clientNameText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  // Item Table Section
  itemTableSection: {
    marginBottom: 20,
    // Removed backgroundColor: '#fff3e6' (orange debug)
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
    fontSize: 10,
    fontWeight: 'bold',
    color: '#555',
    textAlign: 'left',
  },
  tableCell: {
    // This style is applied to View components that act as cells.
    // It should not contain text-specific styles like fontSize or color.
    // Flex, padding, etc., are handled by qtyCol, descCol, priceCol, totalCol.
  },
  qtyCol: { flex: 1, paddingHorizontal: 5, textAlign: 'center' }, // textAlign here is for the Text inside
  descCol: { flex: 4, paddingHorizontal: 5 },
  priceCol: { flex: 2, paddingHorizontal: 5, textAlign: 'right' },
  totalCol: { flex: 2, paddingHorizontal: 5, textAlign: 'right' },
  itemSubtitle: {
    fontSize: 9,
    color: '#777',
    marginTop: 2,
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
    flex: 1.5, // Takes more space
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  footerBlock: {
    marginBottom: 10,
  },
  placeholderText: {
    fontSize: 11,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 2,
  },
  paymentTermsHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 2,
  },
  paymentTermsBody: {
    fontSize: 8,
    color: '#777',
    fontStyle: 'italic',
    marginTop: 2,
  },
  totalsBlock: {},
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  grandTotalLine: {
    marginTop: 5,
    paddingVertical: 8,
    paddingHorizontal: 10, // Added padding for highlight
    borderTopWidth: 2, // Make grand total separator more prominent
    borderColor: '#333',
  },
  grandTotalText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
});

export default InvoiceTemplateOne;

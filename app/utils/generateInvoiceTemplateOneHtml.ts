import { Tables } from '../../types/database.types';

// Re-define types similar to InvoiceTemplateOne.tsx for clarity and independence
// if PDF data needs to diverge slightly in the future.

export interface PdfInvoiceLineItem extends Tables<'invoice_line_items'> {}

export interface PdfClient extends Tables<'clients'> {}

export interface PdfBusinessSettings extends Tables<'business_settings'> {}

export interface PdfPaymentOptions extends Tables<'payment_options'> {}

export interface PdfInvoice extends Omit<Tables<'invoices'>, 'client_id' | 'user_id'> { // Example: Omit if not directly used or to be replaced
  id: Tables<'invoices'>['id']; // Ensure essential IDs are present
  invoice_number: Tables<'invoices'>['invoice_number'];
  status: Tables<'invoices'>['status'];
  invoice_date: Tables<'invoices'>['invoice_date'];
  due_date: Tables<'invoices'>['due_date'];
  due_date_option: Tables<'invoices'>['due_date_option'];
  po_number: Tables<'invoices'>['po_number'] | null;
  custom_headline: Tables<'invoices'>['custom_headline'] | null;
  subtotal_amount: Tables<'invoices'>['subtotal_amount'];
  discount_type: Tables<'invoices'>['discount_type'] | null;
  discount_value: Tables<'invoices'>['discount_value'];
  tax_percentage: Tables<'invoices'>['tax_percentage'];
  total_amount: Tables<'invoices'>['total_amount'];
  notes: Tables<'invoices'>['notes'] | null;
  // Add payment activity flags
  paypal_active: Tables<'invoices'>['paypal_active'];
  bank_account_active: Tables<'invoices'>['bank_account_active'];
  stripe_active: Tables<'invoices'>['stripe_active'];

  // Extended properties for PDF
  invoice_line_items: PdfInvoiceLineItem[];
  clients: PdfClient | null; // Full client object
  currency_symbol: string;
  currency: string; // e.g., 'USD', 'EUR'
  invoice_tax_label: string; // e.g., 'VAT', 'Sales Tax'
}

export interface PdfInvoiceData {
  invoice: PdfInvoice | null;
  businessSettings: PdfBusinessSettings | null;
  paymentOptions: PdfPaymentOptions | null;
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch (e) {
    return dateString; // Fallback
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

const formatCurrency = (amount: number | null | undefined, symbol: string = '$'): string => {
  if (amount == null || isNaN(amount)) return 'N/A';
  return `${symbol}${amount.toFixed(2)}`;
};

// Helper function to calculate discount amount
const calculateDiscountAmount = (invoice: PdfInvoice): number => {
  if (invoice.discount_value != null && invoice.discount_value > 0 && invoice.subtotal_amount != null) {
    if (invoice.discount_type === 'percentage') {
      return (invoice.subtotal_amount * invoice.discount_value) / 100;
    } else if (invoice.discount_type === 'fixed') {
      return invoice.discount_value;
    }
  }
  return 0;
};

// Helper function to calculate tax amount
const calculateTaxAmount = (invoice: PdfInvoice): number => {
  if (invoice.tax_percentage != null && invoice.tax_percentage > 0 && invoice.subtotal_amount != null) {
    const amountBeforeTax = invoice.subtotal_amount - calculateDiscountAmount(invoice);
    return (amountBeforeTax * invoice.tax_percentage) / 100;
  }
  return 0;
};

// Base64 encoded images for payment logos - These should be replaced with actual base64 data
const VISA_LOGO_URL = "https://wzpuzqzsjdizmpiobsuo.supabase.co/storage/v1/object/public/payment-icons/visaicon.png";
const MASTERCARD_LOGO_URL = "https://wzpuzqzsjdizmpiobsuo.supabase.co/storage/v1/object/public/payment-icons/mastercardicon.png";
const PAYPAL_LOGO_URL = "https://wzpuzqzsjdizmpiobsuo.supabase.co/storage/v1/object/public/payment-icons/paypalicon.png";

export const generateInvoiceTemplateOneHtml = (data: PdfInvoiceData): string => {
  if (!data.invoice || !data.businessSettings) {
    return '<p>Error: Missing invoice or business data.</p>';
  }

  const { invoice, businessSettings, paymentOptions } = data;
  const client = invoice.clients;

  // CSS to match mobile template exactly - compact and fits on one page
  const styles = `
    /* Force color rendering for PDF on iOS */
    * {
      print-color-adjust: exact !important;
      -webkit-print-color-adjust: exact !important;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 50mm 23mm 30mm 50mm;
    }
    
    html, body { 
      width: 100%; 
      height: 100%;
      margin: 0; 
      padding: 0; 
      font-family: Arial, sans-serif; 
      color: #000; 
      font-size: 12px; 
      background-color: #fff;
      line-height: 1.2;
    }
    
    .container { 
      width: 100%; 
      height: 100%;
      margin: 0;
      padding: 0;
      background-color: #fff;
    }
    
    /* Header Section - compact like mobile */
    .header-section { 
      display: flex; 
      justify-content: space-between; 
      align-items: flex-start; 
      margin-bottom: 15mm;
      margin-top: 5mm;
    }
    .header-left { 
      flex: 1;
    }
    .header-right { 
      flex: 1;
      text-align: right;
    }
    .header-left img { 
      max-width: 210px;
      max-height: 105px;
      margin-bottom: 5mm;
    }
    .logo-placeholder {
      font-size: 25px; 
      font-weight: bold;
      color: #000;
      width: 210px;
      height: 105px;
      text-align: center;
      line-height: 105px;
      border: 1px solid #ddd;
      margin-bottom: 5mm;
    }
    .invoice-title { 
      font-size: 20px; 
      font-weight: bold; 
      margin: 0 0 3mm 0; 
      color: #000; 
    }
    .header-right p { 
      margin: 1mm 0; 
      font-size: 11px; 
      color: #000;
      line-height: 1.3;
    }

    /* Address Section - compact */
    .address-section { 
      display: flex; 
      justify-content: space-between; 
      margin-bottom: 10mm; 
    }
    .from-address, .to-address { 
      flex: 1; 
      max-width: 45%;
    }
    .to-address { 
      text-align: right; 
    }
    .address-block-title { 
      font-size: 10px; 
      font-weight: bold; 
      color: #666; 
      margin-bottom: 2mm; 
      text-transform: uppercase;
    }
    .address-name { 
      font-size: 12px; 
      font-weight: bold; 
      color: #000; 
      margin-bottom: 1mm; 
    }
    .business-name { 
      font-size: 12px; 
      font-weight: bold; 
      color: #000; 
      margin-bottom: 1mm; 
    }
    .address-line { 
      font-size: 10px; 
      color: #000; 
      line-height: 1.3; 
      margin: 0 0 1mm 0; 
    }

    /* Custom headline - compact */
    .custom-headline { 
      padding: 3mm 0; 
      text-align: center; 
      margin-bottom: 8mm; 
      border-top: 1px solid #eee;
      border-bottom: 1px solid #eee;
    }
    .custom-headline p { 
      font-size: 13px; 
      font-weight: bold; 
      margin: 0; 
      color: #000;
    }

    /* Line Items Table - compact like mobile */
    .line-items { 
      margin-bottom: 10mm; 
    }
    .line-items table { 
      width: 100%; 
      border-collapse: collapse; 
    }
    .line-items th { 
      background-color: rgba(76, 175, 80, 0.15) !important;
      padding: 2mm 1.5mm; 
      font-size: 9px;
      font-weight: bold;
      color: #000;
      text-align: left;
      text-transform: uppercase;
    }
    .line-items td { 
      padding: 2mm 1.5mm; 
      border-bottom: 1px solid #eee;
      font-size: 10px;
      color: #000;
      vertical-align: top;
    }
    .line-items tr:last-child td { 
      border-bottom: none; 
    }

    .line-items .col-qty { 
      width: 10%; 
      text-align: center; 
    }
    .line-items .col-desc { 
      width: 50%; 
    }
    .line-items .col-price { 
      width: 20%; 
      text-align: right; 
    }
    .line-items .col-total { 
      width: 20%; 
      text-align: right; 
    }
    .line-items .item-description-pdf { 
      font-size: 9px; 
      color: #666; 
      margin-top: 1mm; 
      display: block; 
      font-style: italic;
    }

    /* Footer Section - compact */
    .summary-section { 
      display: flex; 
      justify-content: space-between; 
      margin-top: 8mm; 
      padding-top: 5mm; 
      border-top: 1px solid #eee;
    }
    .notes-and-terms-section { 
      flex: 1.2; 
      padding-right: 8mm;
    }
    .notes-and-terms-section .section-title { 
      font-size: 9px; 
      margin-bottom: 2mm; 
      color: #000; 
      font-weight: bold;
      text-transform: uppercase;
    }
    .notes-and-terms-section p { 
      font-size: 10px; 
      margin: 0 0 2mm 0; 
      color: #666; 
      line-height: 1.3;
    }
    .totals-section-html { 
      flex: 0.8; 
      min-width: 40mm;
    }

    /* Payment Methods Section - compact */
    .payment-method-item { 
      margin-bottom: 3mm; 
    }
    .payment-method-item p { 
      font-size: 10px; 
      margin: 0 0 1mm 0; 
      color: #666; 
    }
    .payment-method-item p strong {
      font-weight: bold;
      color: #000;
    }
    .logo-container { 
      display: flex; 
      align-items: center; 
      justify-content: flex-start;
      margin-bottom: 1mm;
    }
    .logo-container img { 
      width: 12mm; 
      height: 8mm; 
      margin-left: 1mm;
      object-fit: contain;
    }
    .payment-method-text {
      font-size: 10px;
      color: #000;
      font-weight: 500;
    }

    /* Totals Section - compact */
    .totals-section-html .total-line { 
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1mm 0;
      border-bottom: 1px solid #f5f5f5;
    }
    .totals-section-html .total-line-label { 
      font-size: 10px;
      font-weight: 500;
      color: #000;
    }
    .totals-section-html .total-line-value { 
      font-size: 10px;
      color: #000;
      text-align: right;
      font-weight: 500;
    }
    .grand-total-row { 
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: rgba(76, 175, 80, 0.15) !important; 
      padding: 2mm;
      margin-top: 3mm;
    }
    .grand-total-row .grand-total-label,
    .grand-total-row .grand-total-value { 
      font-size: 11px;
      font-weight: bold;
      color: #000;
    }

    /* Ensure everything fits on one page */
    .line-items {
      page-break-inside: avoid;
    }
    
    .summary-section {
      page-break-inside: avoid;
    }
  `;

  // Generate line items HTML
  let lineItemsHtml = '';
  if (invoice.invoice_line_items && invoice.invoice_line_items.length > 0) {
    invoice.invoice_line_items.forEach(item => {
      lineItemsHtml += `
        <tr>
          <td class="col-qty">${item.quantity}</td>
          <td class="col-desc">
            ${item.item_name || 'N/A'}
            ${item.item_description ? `<span class="item-description-pdf">${item.item_description.replace(/\n/g, '<br>')}</span>` : ''}
          </td>
          <td class="col-price">${formatCurrency(item.unit_price, invoice.currency_symbol)}</td>
          <td class="col-total">${formatCurrency(item.total_price, invoice.currency_symbol)}</td>
        </tr>
      `;
    });
  } else {
    lineItemsHtml = '<tr><td colspan="4" style="text-align: center; padding: 5mm; font-style: italic; color: #666;">No line items.</td></tr>';
  }

  // Generate payment methods HTML
  let paymentMethodsHtmlString = '';
  let individualMethodsHtml = '';

  if (invoice.stripe_active || invoice.paypal_active || invoice.bank_account_active) {
    // Stripe
    if (invoice.stripe_active) {
      individualMethodsHtml += `
        <div class="payment-method-item">
          <div class="logo-container">
            <span class="payment-method-text"><strong>Pay Online</strong></span>
            <img src="${VISA_LOGO_URL}" alt="Visa" />
            <img src="${MASTERCARD_LOGO_URL}" alt="Mastercard" />
          </div>
          <p>www.stripelink.com</p>
        </div>`;
    }

    // PayPal
    if (invoice.paypal_active) {
      individualMethodsHtml += `
        <div class="payment-method-item">
          <div class="logo-container">
            <span class="payment-method-text"><strong>Pay with PayPal</strong></span>
            <img src="${PAYPAL_LOGO_URL}" alt="PayPal" />
          </div>
          <p>${paymentOptions?.paypal_email || 'nobones@gmail.com'}</p>
        </div>`;
    }

    // Bank Transfer
    if (invoice.bank_account_active) {
      const bankDetails = paymentOptions?.bank_details ? 
        paymentOptions.bank_details.replace(/\n/g, '<br>') : 
        'Bank 1<br>1 2457 5 6 5 500598 32<br>U EA';
      individualMethodsHtml += `
        <div class="payment-method-item">
          <p><strong>Bank Transfer</strong></p>
          <p>${bankDetails}</p>
        </div>`;
    }

    if (individualMethodsHtml) {
      paymentMethodsHtmlString = `
        <div style="margin-bottom:5mm;">
          <div class="section-title">Payment Methods</div>
          ${individualMethodsHtml}
        </div>
      `;
    }
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoice_number || ''}</title>
        <style>
          ${styles.replace(/\n\s*/g, '\n').trim()}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-section">
            <div class="header-left">
              ${businessSettings.business_logo_url ? 
                `<img src="${businessSettings.business_logo_url}" alt="Business Logo">` : 
                `<div class="logo-placeholder">${businessSettings.business_name || 'Your Logo'}</div>`
              }
            </div>
            <div class="header-right">
              <h1 class="invoice-title">INVOICE</h1>
              <p><strong>Ref:</strong> ${invoice.invoice_number || invoice.id || 'N/A'}</p>
              <p><strong>Date:</strong> ${formatDate(invoice.invoice_date)}</p>
              <p><strong>Due:</strong> ${formatDueDateDisplay(invoice.due_date_option, invoice.due_date)}</p>
              ${invoice.po_number ? `<p><strong>PO Number:</strong> ${invoice.po_number}</p>` : ''}
            </div>
          </div>

          <div class="address-section">
            <div class="from-address">
              <div class="address-block-title">From:</div>
              <p class="business-name">${businessSettings.business_name || 'Your Company'}</p>
              <p class="address-line">${businessSettings.business_address?.replace(/\n/g, '<br>') || 'Your Address'}</p>
            </div>
            <div class="to-address">
              <div class="address-block-title">Bill To:</div>
              <p class="address-name">${client?.name || 'Client Name'}</p>
              ${(client as any)?.address_client ? `<p class="address-line">${(client as any).address_client.replace(/\n/g, '<br>')}</p>` : ''}
              ${client?.email ? `<p class="address-line">${client.email}</p>` : ''}
              ${client?.phone ? `<p class="address-line">${client.phone}</p>` : ''}
            </div>
          </div>

          ${invoice.custom_headline ? `<div class="custom-headline"><p>${invoice.custom_headline}</p></div>` : ''}

          <div class="line-items">
            <table>
              <thead>
                <tr>
                  <th class="col-qty">QTY</th>
                  <th class="col-desc">DESCRIPTION</th>
                  <th class="col-price">PRICE</th>
                  <th class="col-total">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>
          </div>

          <div class="summary-section">
            <div class="notes-and-terms-section">
              ${invoice.notes ? `
                <div style="margin-bottom:5mm;">
                  <div class="section-title">Terms, Instructions & Notes</div>
                  <p>${invoice.notes.replace(/\n/g, '<br>')}</p>
                </div>
              ` : ''}
              
              ${paymentMethodsHtmlString}
            </div>

            <div class="totals-section-html">
              <div class="total-line">
                <span class="total-line-label">Subtotal:</span>
                <span class="total-line-value">${formatCurrency(invoice.subtotal_amount, invoice.currency_symbol)}</span>
              </div>
              ${invoice.discount_value && invoice.discount_value > 0 ? `
              <div class="total-line">
                <span class="total-line-label">Discount ${invoice.discount_type === 'percentage' ? `(${invoice.discount_value}%)` : ''}:</span>
                <span class="total-line-value">-${formatCurrency(calculateDiscountAmount(invoice), invoice.currency_symbol)}</span>
              </div>` : ''}
              ${invoice.tax_percentage && invoice.tax_percentage > 0 ? `
              <div class="total-line">
                <span class="total-line-label">${invoice.invoice_tax_label || 'Tax'} (${invoice.tax_percentage}%):</span>
                <span class="total-line-value">${formatCurrency(calculateTaxAmount(invoice), invoice.currency_symbol)}</span>
              </div>` : ''}
              
              <div class="grand-total-row">
                <span class="grand-total-label">Total:</span>
                <span class="grand-total-value">${formatCurrency(invoice.total_amount, invoice.currency_symbol)}</span>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}; 
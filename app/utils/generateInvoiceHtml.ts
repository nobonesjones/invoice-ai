import { Tables } from '../../types/database.types';

// Re-define types similar to InvoiceTemplateOne.tsx for clarity and independence
// if PDF data needs to diverge slightly in the future.

export interface PdfInvoiceLineItem extends Tables<'invoice_line_items'> {}

export interface PdfClient extends Tables<'clients'> {}

export interface PdfBusinessSettings extends Tables<'business_settings'> {}

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
  // Add other invoice fields as needed from Tables<'invoices'>

  // Extended properties for PDF
  invoice_line_items: PdfInvoiceLineItem[];
  clients: PdfClient | null; // Full client object
  currency_symbol: string;
  currency: string; // e.g., 'USD', 'EUR'
  invoice_tax_label: string; // e.g., 'VAT', 'Sales Tax'
}

export interface PdfInvoiceData {
  invoice: PdfInvoice | null;
  // clientName: string | null; // Decided to use invoice.clients.name for consistency
  businessSettings: PdfBusinessSettings | null;
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

const formatCurrency = (amount: number | null | undefined, symbol: string = '$'): string => {
  if (amount == null || isNaN(amount)) return 'N/A';
  return `${symbol}${amount.toFixed(2)}`;
};

export const generateInvoiceHtml = (data: PdfInvoiceData): string => {
  if (!data.invoice || !data.businessSettings) {
    return '<p>Error: Missing invoice or business data.</p>';
  }

  const { invoice, businessSettings } = data;
  const client = invoice.clients;

  // Basic CSS - will be expanded later to match app styles
  const styles = `
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #333; font-size: 10px; }
    .container { width: 100%; max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    .header, .footer { text-align: center; margin-bottom: 20px; }
    .header img { max-height: 80px; margin-bottom: 10px; }
    .header h1 { margin: 0; font-size: 24px; }
    .invoice-details, .client-details, .business-details { margin-bottom: 20px; }
    .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .details-grid div p { margin: 0 0 5px 0; }
    .details-grid div p strong { display: inline-block; min-width: 100px; }
    .line-items table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .line-items th, .line-items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    .line-items th { background-color: #f9f9f9; font-weight: bold; }
    .line-items .text-right { text-align: right; }
    .totals { margin-top: 20px; float: right; width: 250px; }
    .totals table { width: 100%; }
    .totals td { padding: 5px 0; }
    .totals .strong { font-weight: bold; }
    .notes, .payment-terms { margin-top: 30px; padding-top:10px; border-top: 1px solid #eee; }
    .clearfix::after { content: ""; clear: both; display: table; }
  `;

  let lineItemsHtml = '';
  invoice.invoice_line_items
    .map(
      (item) => `
        <tr>
          <td>${item.item_description || item.item_name || 'N/A'}</td>
          <td class="text-right">${item.quantity || 0}</td>
          <td class="text-right">${formatCurrency(item.unit_price, invoice.currency_symbol)}</td>
          <td class="text-right">${formatCurrency(item.total_price, invoice.currency_symbol)}</td>
        </tr>
      `
    )
    .forEach((item) => (lineItemsHtml += item));

  return `
    <html>
      <head>
        <meta charset="utf-8">
        <title>Invoice ${invoice.invoice_number || ''}</title>
        <style>${styles}</style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${businessSettings.business_logo_url ? `<img src="${businessSettings.business_logo_url}" alt="Logo" style="max-height: 70px; margin-bottom: 10px;">` : ''}
            <h1>${invoice.custom_headline || 'Invoice'}</h1>
          </div>

          <div class="details-grid company-client-grid">
            <div class="business-details">
              <h3>${businessSettings.business_name || 'Your Company'}</h3>
              <p>${businessSettings.business_address || ''}</p>
              <p>${businessSettings.business_email || ''} ${businessSettings.business_phone ? `| ${businessSettings.business_phone}` : ''}</p>
            </div>

            <div class="invoice-details">
              <div class="section-title">Invoice Details</div>
              <div class="details-grid">
                <div>
                  <p><strong>Invoice #:</strong> ${invoice.invoice_number || 'N/A'}</p>
                  <p><strong>Invoice Date:</strong> ${formatDate(invoice.invoice_date)}</p>
                  <p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>
                  ${invoice.po_number ? `<p><strong>PO Number:</strong> ${invoice.po_number}</p>` : ''}
                </div>
                <div>
                  <div class="section-title" style="margin-top:0; margin-bottom:10px; border:none; font-size:14px;">Bill To:</div>
                  <p><strong>${client?.name || 'N/A'}</strong></p>
                  <p>${client?.address_line1 || ''}</p>
                  <p>${client?.email || ''}</p>
                </div>
              </div>
            </div>
          </div>

          ${invoice.custom_headline ? `<div class="custom-headline"><p><strong>${invoice.custom_headline}</strong></p></div>` : ''}

          <div class="line-items">
            <div class="section-title">Items</div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Quantity</th>
                  <th class="text-right">Unit Price</th>
                  <th class="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${lineItemsHtml}
              </tbody>
            </table>
          </div>

          <div class="totals clearfix">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td class="text-right">${formatCurrency(invoice.subtotal_amount, invoice.currency_symbol)}</td>
              </tr>
              ${invoice.discount_value && invoice.discount_value > 0 ? `
              <tr>
                <td>Discount (${invoice.discount_type === 'percentage' ? `${invoice.discount_value}%` : formatCurrency(invoice.discount_value, invoice.currency_symbol)}):</td>
                <td class="text-right">-${formatCurrency(invoice.discount_type === 'percentage' ? (invoice.subtotal_amount * invoice.discount_value / 100) : invoice.discount_value, invoice.currency_symbol)}</td>
              </tr>` : ''}
              ${invoice.tax_percentage && invoice.tax_percentage > 0 ? `
              <tr>
                <td>${invoice.invoice_tax_label || 'Tax'} (${invoice.tax_percentage}%):</td>
                <td class="text-right">${formatCurrency( (invoice.subtotal_amount - (invoice.discount_type === 'percentage' ? (invoice.subtotal_amount * (invoice.discount_value || 0) / 100) : (invoice.discount_value || 0)) ) * invoice.tax_percentage / 100, invoice.currency_symbol)}</td>
              </tr>` : ''}
              <tr>
                <td class="strong">Grand Total:</td>
                <td class="text-right strong">${formatCurrency(invoice.total_amount, invoice.currency_symbol)}</td>
              </tr>
            </table>
          </div>

          ${invoice.notes ? `<div class="notes"><div class="section-title">Notes</div><p>${invoice.notes}</p></div>` : ''}
          
          <div class="payment-terms">
             <div class="section-title">Payment Terms & Methods</div>
             <p>Due: ${invoice.due_date_option || formatDate(invoice.due_date)}</p>
             ${invoice.stripe_active ? '<p>Stripe payments accepted.</p>' : ''}
             ${invoice.bank_account_active ? '<p>Bank transfer details available upon request.</p>' : ''}
             ${invoice.paypal_active ? '<p>PayPal payments accepted.</p>' : ''}
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Row shapes the invoice screens pass around. They used to live in the old
// InvoiceTemplateOne component; the shapes outlived the component.
import { Tables } from './database.types';

export interface InvoiceForTemplate {
  // Properties from Tables<'invoices'>
  id: string;
  user_id: string;
  client_id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date?: string | null;
  po_number?: string | null;
  custom_headline?: string | null;
  subtotal_amount: number;
  discount_type?: string | null;
  discount_value: number;
  tax_percentage: number;
  total_amount: number;
  notes?: string | null;
  stripe_active: boolean;
  bank_account_active: boolean;
  paypal_active: boolean;
  gocardless_active: boolean;
  created_at: string;
  updated_at: string;
  due_date_option?: string | null;
  invoice_tax_label?: string | null;
  // Relations
  clients: Tables<'clients'> | null;
  invoice_line_items: Tables<'invoice_line_items'>[];
  // Computed fields
  currency: string;
  currency_symbol: string;
  // Payment tracking fields
  paid_amount?: number;
  payment_date?: string | null;
  payment_notes?: string | null;
  // Polar payment fields
  polar_checkout_id?: string | null;
  polar_payment_link?: string | null;
  polar_payment_status?: string | null;
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
  auto_apply_tax?: boolean;
  tax_name?: string;
};

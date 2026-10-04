// Turns the rows the app already loads (invoice or estimate with its line items and
// client, business_settings with payment options merged in) into the InvoiceDocument
// the shared template renders. This is the only place row shapes are known; the
// template never sees a database column name.
import type { InvoiceDocument, InvoiceLine, ThemeId } from './render.ts';
import { THEME_IDS } from './render.ts';

type AnyRow = Record<string, any>;

export interface BuildDocumentInput {
  type: 'invoice' | 'estimate';
  /** invoices / estimates row, ideally with `clients` and `*_line_items` joined */
  row: AnyRow;
  client?: AnyRow | null;
  lineItems?: AnyRow[] | null;
  /** business_settings row; payment_options fields (paypal_email, bank_details) may be merged in */
  business?: AnyRow | null;
  paymentOptions?: AnyRow | null;
  designId?: string | null;
  accentColor?: string | null;
  terminology?: 'estimate' | 'quote' | null;
  /** data: URI to use instead of the logo URL (print/preview never hit the network) */
  logoDataUri?: string | null;
}

// Addresses are stored as one free-text string. Split on newlines or commas and
// drop the empties, so "1 Road, , Wales, , UK" never reaches the page.
export function splitAddress(raw?: string | null): string[] {
  return (raw ?? '')
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitLines(raw?: string | null): string[] {
  if (raw == null) return [];
  if (typeof raw !== 'string') {
    try {
      return Object.values(raw as Record<string, unknown>).map(String).map((s) => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};

export function themeIdFrom(designId?: string | null): ThemeId {
  return (THEME_IDS as string[]).includes(designId ?? '') ? (designId as ThemeId) : 'clean';
}

export function buildInvoiceDocument(input: BuildDocumentInput): InvoiceDocument {
  const { type, row } = input;
  const isEst = type === 'estimate';
  const business = input.business ?? {};
  const po = input.paymentOptions ?? {};
  const client = input.client ?? row.clients ?? {};
  const rawItems: AnyRow[] = input.lineItems ?? (isEst ? row.estimate_line_items : row.invoice_line_items) ?? [];

  const items: InvoiceLine[] = rawItems.map((it) => {
    const quantity = num(it.quantity, 1);
    const unitPrice = num(it.unit_price);
    const total = it.total_price != null ? num(it.total_price) : r2(quantity * unitPrice);
    return { name: String(it.item_name ?? ''), description: it.item_description ?? null, quantity, unitPrice, total };
  });

  // Money: trust stored amounts where the row has them, compute only what it lacks.
  const subtotal = row.subtotal_amount != null ? num(row.subtotal_amount) : r2(items.reduce((s, i) => s + i.total, 0));
  const discountType: 'percentage' | 'fixed' = row.discount_type === 'fixed' ? 'fixed' : 'percentage';
  const discountValue = num(row.discount_value);
  const discountAmount =
    row.discount_amount != null
      ? num(row.discount_amount)
      : discountValue > 0
        ? r2(discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue)
        : 0;
  const taxRate = num(row.tax_percentage ?? business.default_tax_rate);
  const taxAmount = row.tax_amount != null ? num(row.tax_amount) : r2((subtotal - discountAmount) * (taxRate / 100));
  const total = row.total_amount != null ? num(row.total_amount) : r2(subtotal - discountAmount + taxAmount);
  const paid = isEst ? 0 : num(row.paid_amount);
  const taxLabel: string = (isEst ? row.estimate_tax_label : row.invoice_tax_label) || business.tax_name || 'Tax';

  const currencyCode: string = business.currency_code || row.currency || 'USD';
  const status: string = isEst
    ? row.is_accepted || row.status === 'accepted' || row.converted_to_invoice_id
      ? 'accepted'
      : String(row.status ?? 'draft')
    : String(row.status ?? 'draft');

  const gocardlessActive = !!row.gocardless_active;
  const stripeLink = row.stripe_active && row.stripe_payment_link_url ? String(row.stripe_payment_link_url) : null;

  return {
    document: {
      type,
      terminology: input.terminology ?? business.estimate_terminology ?? null,
      number: String((isEst ? row.estimate_number : row.invoice_number) ?? ''),
      issueDate: String((isEst ? row.estimate_date : row.invoice_date) ?? row.created_at ?? new Date().toISOString()),
      dueDate: (isEst ? row.valid_until_date : row.due_date) ?? null,
      dueOption: isEst ? null : (row.due_date_option ?? null),
      poNumber: isEst ? null : (row.po_number ?? null),
      status,
      currencyCode,
      locale: null,
    },
    business: {
      name: business.business_name || 'Your Business',
      logo: input.logoDataUri ?? business.business_logo_url ?? null,
      addressLines: splitAddress(business.business_address),
      email: business.business_email ?? null,
      phone: business.business_phone ?? null,
      website: business.business_website ?? null,
      taxLabel: business.tax_name || 'Tax',
      taxNumber: business.tax_number ?? business.business_tax_number ?? null,
      show: {
        logo: business.show_business_logo ?? true,
        name: business.show_business_name ?? true,
        address: business.show_business_address ?? true,
        taxNumber: business.show_business_tax_number ?? true,
        notes: business.show_notes_section ?? true,
      },
    },
    client: {
      name: client.name || client.client_name || 'Client',
      addressLines: splitAddress(client.address_client ?? client.address),
      email: client.email ?? null,
      phone: client.phone ?? null,
      taxNumber: client.tax_number ?? null,
    },
    items,
    totals: {
      subtotal,
      discount: discountAmount > 0 ? { type: discountType, value: discountValue, amount: discountAmount } : null,
      tax: taxRate > 0 || taxAmount > 0 ? { label: taxLabel, rate: taxRate, amount: taxAmount } : null,
      total,
      paid,
      balanceDue: r2(total - paid),
    },
    notes: (isEst ? [row.notes, row.acceptance_terms].filter(Boolean).join('\n\n') : row.notes) || null,
    payments: {
      stripeLinkUrl: isEst ? null : stripeLink,
      gocardless: isEst ? false : gocardlessActive,
      gocardlessPayUrl: !isEst && gocardlessActive && row.id ? `https://getsuperinvoice.com/pay/${row.id}` : null,
      paypalEmail: !isEst && row.paypal_active ? (business.paypal_email ?? po.paypal_email ?? null) : null,
      bankDetailLines: !isEst && row.bank_account_active ? splitLines(business.bank_details ?? po.bank_details) : [],
    },
    theme: {
      id: themeIdFrom(input.designId ?? (isEst ? row.estimate_template : row.invoice_design) ?? business.default_invoice_design),
      accent: input.accentColor ?? row.accent_color ?? business.default_accent_color ?? null,
    },
  };
}

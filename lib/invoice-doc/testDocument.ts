// Fixture documents for the "Invoice preview (test)" screen. Real business details
// from business_settings, made-up client and line items. This is the seed of the
// buildInvoiceDocument() / computeTotals() that the real screens will use later.
import type { InvoiceDocument, InvoiceLine, ThemeId } from '@/supabase/functions/_shared/invoice-doc/render';

export type TestVariant = 'short' | 'typical' | 'long' | 'estimate';

export interface BusinessLike {
  business_name?: string | null;
  business_address?: string | null;
  business_email?: string | null;
  business_phone?: string | null;
  business_website?: string | null;
  tax_number?: string | null;
  tax_name?: string | null;
  default_tax_rate?: number | null;
  currency_code?: string | null;
  show_business_logo?: boolean | null;
  show_business_name?: boolean | null;
  show_business_address?: boolean | null;
  show_business_tax_number?: boolean | null;
}

// Addresses are stored as one free-text string. Split on newlines or commas and
// drop the empties, so "1 Road, , Wales, , UK" never reaches the page.
export function splitAddress(raw?: string | null): string[] {
  return (raw ?? '')
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(
  items: InvoiceLine[],
  opts: { discount?: { type: 'percentage' | 'fixed'; value: number } | null; taxLabel: string; taxRate: number; paid?: number },
): InvoiceDocument['totals'] {
  const subtotal = r2(items.reduce((s, it) => s + it.total, 0));
  const discountAmount = opts.discount
    ? r2(opts.discount.type === 'percentage' ? subtotal * (opts.discount.value / 100) : opts.discount.value)
    : 0;
  const taxable = r2(subtotal - discountAmount);
  const taxAmount = r2(taxable * (opts.taxRate / 100));
  const total = r2(taxable + taxAmount);
  const paid = r2(opts.paid ?? 0);
  return {
    subtotal,
    discount: opts.discount ? { ...opts.discount, amount: discountAmount } : null,
    tax: opts.taxRate > 0 ? { label: opts.taxLabel, rate: opts.taxRate, amount: taxAmount } : null,
    total,
    paid,
    balanceDue: r2(total - paid),
  };
}

const line = (name: string, description: string | null, quantity: number, unitPrice: number): InvoiceLine => ({
  name,
  description,
  quantity,
  unitPrice,
  total: r2(quantity * unitPrice),
});

const LONG_NAMES = [
  'Site survey', 'Design consultation', 'Project management', 'Materials', 'Labour (day rate)', 'Electrical first fix',
  'Plumbing first fix', 'Plastering', 'Painting and decorating', 'Flooring', 'Kitchen installation', 'Tiling',
  'Waste removal', 'Scaffolding hire', 'Electrical second fix', 'Plumbing second fix', 'Carpentry', 'Roofing repairs',
  'Guttering', 'Landscaping', 'Fencing', 'Final clean', 'Snagging visit', 'Certificates and sign-off',
];

function itemsFor(variant: TestVariant): InvoiceLine[] {
  if (variant === 'short') return [line('Massage', 'Full body, 60 minutes', 1, 150)];
  if (variant === 'estimate')
    return [line('Kitchen refit', 'Supply and fit, as per drawing K-02', 1, 6400), line('Electrical works', 'Certified, includes test certificate', 1, 1250), line('Skip hire', null, 2, 180)];
  if (variant === 'typical')
    return [
      line('Brand identity', 'Logo, colour palette and type system. Includes two rounds of revisions and final files in SVG, PNG and PDF.', 1, 1800),
      line('Website design', 'Home, About, Services and Contact pages, mobile and desktop.', 4, 450),
      line('Copywriting', null, 6, 95),
      line('Stock photography licence', 'Twelve images, standard licence', 12, 24.5),
      line('Hosting setup', 'Domain, DNS and SSL configuration', 1, 120),
      line('Training session', 'Two hours, remote, recorded', 2, 85),
    ];
  return LONG_NAMES.map((n, i) => line(n, i % 3 === 0 ? 'As per the agreed scope of works' : null, (i % 4) + 1, 40 + i * 12.5));
}

export function buildTestDocument(
  variant: TestVariant,
  themeId: ThemeId,
  business: BusinessLike | null,
  logoDataUri: string | null,
): InvoiceDocument {
  const items = itemsFor(variant);
  const taxRate = business?.default_tax_rate != null ? Number(business.default_tax_rate) : 20;
  const taxLabel = business?.tax_name || 'VAT';
  const totals = computeTotals(items, {
    discount: variant === 'typical' ? { type: 'percentage', value: 10 } : null,
    taxLabel,
    taxRate,
    paid: variant === 'typical' ? 500 : 0,
  });

  const issue = new Date();
  const due = new Date(issue.getTime() + 14 * 24 * 60 * 60 * 1000);

  return {
    document: {
      type: variant === 'estimate' ? 'estimate' : 'invoice',
      terminology: 'quote',
      number: variant === 'short' ? 'INV-990690' : variant === 'typical' ? 'INV-990691' : variant === 'estimate' ? 'EST-0042' : 'INV-990692',
      issueDate: issue.toISOString(),
      dueDate: due.toISOString(),
      poNumber: variant === 'typical' ? 'PO-4471' : null,
      status: variant === 'short' ? 'paid' : variant === 'estimate' ? 'sent' : 'sent',
      dueOption: null,
      currencyCode: business?.currency_code || 'GBP',
      locale: 'en-GB',
    },
    business: {
      name: business?.business_name || 'Your Business Ltd',
      logo: logoDataUri,
      addressLines: splitAddress(business?.business_address) .length
        ? splitAddress(business?.business_address)
        : ['1 Example Street', 'London', 'SW1A 1AA'],
      email: business?.business_email || null,
      phone: business?.business_phone || null,
      website: business?.business_website || null,
      taxLabel,
      taxNumber: business?.tax_number || null,
      show: {
        logo: business?.show_business_logo ?? true,
        name: business?.show_business_name ?? true,
        address: business?.show_business_address ?? true,
        taxNumber: business?.show_business_tax_number ?? true,
        notes: true,
      },
    },
    client: {
      name: 'Harrison Jones',
      addressLines: ['Space X', '12 Rocket Road', 'Boca Chica', 'Texas 78521', 'US'],
      email: 'harrison@example.com',
      phone: null,
      taxNumber: null,
    },
    items,
    totals,
    notes:
      variant === 'short'
        ? null
        : 'Payment is due within 14 days of the invoice date. Please quote the invoice number when paying. Late payments may incur interest at 8% above the Bank of England base rate.',
    payments: {
      stripeLinkUrl: variant === 'short' ? null : 'https://pay.stripe.com/invoice/example',
      gocardlessPayUrl: variant === 'long' ? 'https://getsuperinvoice.com/pay/example' : null,
      gocardless: variant === 'long',
      paypalEmail: null,
      bankDetailLines: variant === 'typical' ? ['Anno Ltd', 'Sort code 04-00-04', 'Account 12345678'] : [],
    },
    theme: { id: themeId, accent: null },
  };
}

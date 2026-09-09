// Registry of invoice designs. A design is a theme over the one shared document in
// supabase/functions/_shared/invoice-doc/render.ts; every design shows the same
// fields, so nothing here decides what appears on the page, only how it looks.
import type { ThemeId } from '@/supabase/functions/_shared/invoice-doc/render';

export interface InvoiceDesign {
  id: ThemeId;
  name: string;
  displayName: string;
  description: string;
  colorScheme: {
    primary: string;
    accent: string;
    text: string;
    mutedText: string;
    background: string;
    border: string;
  };
}

const base = { text: '#111827', mutedText: '#6B7280', background: '#FFFFFF', border: '#E5E7EB' };

export const INVOICE_DESIGNS: InvoiceDesign[] = [
  { id: 'clean', name: 'clean', displayName: 'Clean', description: 'Accent header card, zebra rows', colorScheme: { ...base, primary: '#2563EB', accent: '#2563EB' } },
  { id: 'classic', name: 'classic', displayName: 'Classic', description: 'Blue rule, filled table header', colorScheme: { ...base, primary: '#1D4ED8', accent: '#1D4ED8' } },
  { id: 'modern', name: 'modern', displayName: 'Modern', description: 'Green split header, soft table', colorScheme: { ...base, primary: '#059669', accent: '#059669' } },
  { id: 'simple', name: 'simple', displayName: 'Simple', description: 'Minimal lines, grey notes block', colorScheme: { ...base, primary: '#111827', accent: '#374151', border: '#F3F4F6' } },
  { id: 'wave', name: 'wave', displayName: 'Wave', description: 'Purple gradient wave header', colorScheme: { ...base, primary: '#7C3AED', accent: '#A78BFA' } },
  { id: 'swiss', name: 'swiss', displayName: 'Swiss', description: 'Big type, black rules, one red mark', colorScheme: { ...base, primary: '#111827', accent: '#E11D48' } },
  { id: 'ledger', name: 'ledger', displayName: 'Ledger', description: 'Serif, double rule, quiet green', colorScheme: { ...base, primary: '#14532D', accent: '#14532D' } },
];

export const DEFAULT_DESIGN_ID: ThemeId = 'clean';

export const getDesignById = (id?: string | null): InvoiceDesign | undefined =>
  INVOICE_DESIGNS.find((design) => design.id === id);

export const getDefaultDesign = (): InvoiceDesign => getDesignById(DEFAULT_DESIGN_ID) || INVOICE_DESIGNS[0];

export const getAllDesigns = (): InvoiceDesign[] => INVOICE_DESIGNS;

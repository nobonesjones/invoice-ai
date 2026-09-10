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
  /**
   * Accent colours this design looks good in, first is the design's own default.
   * A global list of seven made the picker offer "blue" on a design that was
   * already blue and "orange" on one that never should be.
   */
  swatches: { name: string; color: string }[];
}

const base = { text: '#111827', mutedText: '#6B7280', background: '#FFFFFF', border: '#E5E7EB' };

export const INVOICE_DESIGNS: InvoiceDesign[] = [
  { id: 'clean', name: 'clean', displayName: 'Clean', description: 'Full-width colour band, zebra rows', colorScheme: { ...base, primary: '#2563EB', accent: '#2563EB' } , swatches: [{ name: 'Blue', color: '#2563EB' }, { name: 'Navy', color: '#1E3A8A' }, { name: 'Teal', color: '#0D9488' }, { name: 'Coral', color: '#E85D4A' }, { name: 'Slate', color: '#475569' }] },
  { id: 'wave', name: 'wave', displayName: 'Wave', description: 'Colour header with a wave edge', colorScheme: { ...base, primary: '#7C3AED', accent: '#A78BFA' } , swatches: [{ name: 'Purple', color: '#7C3AED' }, { name: 'Teal', color: '#0891B2' }, { name: 'Magenta', color: '#DB2777' }, { name: 'Indigo', color: '#4F46E5' }, { name: 'Sea', color: '#0E7490' }] },
  { id: 'classic', name: 'classic', displayName: 'Classic', description: 'Accent edge stripe, boxed table', colorScheme: { ...base, primary: '#1E3A8A', accent: '#1E3A8A' } , swatches: [{ name: 'Navy', color: '#1E3A8A' }, { name: 'Burgundy', color: '#7F1D1D' }, { name: 'Forest', color: '#14532D' }, { name: 'Charcoal', color: '#1F2937' }, { name: 'Bronze', color: '#92400E' }] },
  { id: 'modern', name: 'modern', displayName: 'Modern', description: 'Colour sidebar, airy table', colorScheme: { ...base, primary: '#047857', accent: '#047857' } , swatches: [{ name: 'Green', color: '#047857' }, { name: 'Ocean', color: '#0369A1' }, { name: 'Plum', color: '#6D28D9' }, { name: 'Ink', color: '#111827' }, { name: 'Rust', color: '#B45309' }] },
  { id: 'simple', name: 'simple', displayName: 'Simple', description: 'Light type, hairlines, no fills', colorScheme: { ...base, primary: '#111827', accent: '#374151', border: '#F3F4F6' } , swatches: [{ name: 'Ink', color: '#111827' }, { name: 'Blue', color: '#2563EB' }, { name: 'Olive', color: '#4D7C0F' }, { name: 'Terracotta', color: '#C2410C' }, { name: 'Grey', color: '#6B7280' }] },
  { id: 'swiss', name: 'swiss', displayName: 'Swiss', description: 'Big type, black rules, one red mark', colorScheme: { ...base, primary: '#111827', accent: '#E11D48' } , swatches: [{ name: 'Red', color: '#E11D48' }, { name: 'Cobalt', color: '#1D4ED8' }, { name: 'Black', color: '#111827' }, { name: 'Amber', color: '#D97706' }, { name: 'Emerald', color: '#059669' }] },
  { id: 'ledger', name: 'ledger', displayName: 'Ledger', description: 'Serif, page frame, ruled grid', colorScheme: { ...base, primary: '#14532D', accent: '#14532D' } , swatches: [{ name: 'Forest', color: '#14532D' }, { name: 'Navy', color: '#1E3A8A' }, { name: 'Oxblood', color: '#7F1D1D' }, { name: 'Ink', color: '#111827' }, { name: 'Bronze', color: '#92400E' }] },
];

export const DEFAULT_DESIGN_ID: ThemeId = 'clean';

export const getDesignById = (id?: string | null): InvoiceDesign | undefined =>
  INVOICE_DESIGNS.find((design) => design.id === id);

export const getDefaultDesign = (): InvoiceDesign => getDesignById(DEFAULT_DESIGN_ID) || INVOICE_DESIGNS[0];

export const getAllDesigns = (): InvoiceDesign[] => INVOICE_DESIGNS;

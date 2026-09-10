// One invoice document, rendered to HTML.
//
// This file has no imports on purpose: the same source is bundled by Metro for the
// app (preview + PDF) and by Deno for the shared-invoice edge function (hosted page).
// It never touches the database and never does arithmetic. Every surface builds an
// InvoiceDocument and hands it here, so there is exactly one place the layout lives.
//
// Geometry: print engines treat 1 CSS px as 1/96 in and 1 pt as 1/72 in, so an A4
// page is 794 x 1123 CSS px (595 x 842 pt). The document paginates itself: a small
// script at the end of the body measures the content and moves it into explicit
// `.page` elements, so preview, hosted page and PDF share the same page breaks and
// every page carries "Page n of N".
//
// preview: pages as sheets on a grey ground inside the app's WebView
// print:   pages exactly A4, one per sheet, via WebKit print (expo-print, margins 0)
// web:     the hosted page in a browser; its own @page rule for Download PDF

export type ThemeId = 'classic' | 'modern' | 'clean' | 'simple' | 'wave' | 'swiss' | 'ledger';
export const THEME_IDS: ThemeId[] = ['clean', 'classic', 'modern', 'simple', 'wave', 'swiss', 'ledger'];

export type RenderMode = 'preview' | 'print' | 'web';

export interface InvoiceLine {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceDocument {
  document: {
    type: 'invoice' | 'estimate';
    /** Estimates can be called quotes; drives the title only. */
    terminology?: 'estimate' | 'quote' | null;
    number: string;
    issueDate: string; // ISO date
    /** Invoices: due date. Estimates: valid-until date. Always a date, never "in 7 days". */
    dueDate?: string | null;
    /** "on_receipt" renders as "Due on receipt" when no date is set. */
    dueOption?: string | null;
    poNumber?: string | null;
    status: string; // draft | sent | paid | overdue | accepted | ...
    currencyCode: string;
    locale?: string | null;
  };
  business: {
    name: string;
    logo?: string | null; // data URI (print/preview) or URL (web)
    addressLines: string[];
    email?: string | null;
    phone?: string | null;
    website?: string | null;
    taxLabel?: string | null; // "VAT", "GST", "Tax"
    taxNumber?: string | null;
    show: { logo: boolean; name: boolean; address: boolean; taxNumber: boolean; notes: boolean };
  };
  client: {
    name: string;
    addressLines: string[];
    email?: string | null;
    phone?: string | null;
    taxNumber?: string | null;
  };
  items: InvoiceLine[];
  totals: {
    subtotal: number;
    discount?: { type: 'percentage' | 'fixed'; value: number; amount: number } | null;
    tax?: { label: string; rate: number; amount: number } | null;
    total: number;
    paid: number;
    balanceDue: number;
  };
  notes?: string | null;
  payments: {
    stripeLinkUrl?: string | null;
    gocardlessPayUrl?: string | null;
    gocardless?: boolean;
    paypalEmail?: string | null;
    bankDetailLines: string[];
  };
  theme: { id: ThemeId; accent?: string | null };
}

interface Theme {
  accent: string;
  accentInk: string; // text colour on top of the accent
  tint: string; // very light accent, for table heads and the amount card
  /**
   * The layout is what makes one design differ from another. It is not a header
   * style over one shared skeleton: each value places the brand, the document
   * meta and the amount due differently, and the table and totals follow suit.
   *
   *   band        full-bleed solid colour band across the top of the page
   *   wave        full-bleed gradient band with a wave bottom edge
   *   letterhead  centred brand over a double rule, like printed stationery
   *   sidebar     full-height colour column on the left carrying brand + meta
   *   minimal     light type, no fills, hairlines only
   *   swiss       oversized title, black rules, one small accent mark
   *   ledger      serif, boxed table grid, double rules
   */
  layout: 'band' | 'wave' | 'letterhead' | 'sidebar' | 'minimal' | 'swiss' | 'ledger';
  rows: 'zebra' | 'lines' | 'grid';
  totals: 'fill' | 'rule';
  /** 'card' = tinted box; 'plain' = big number, no box */
  due: 'card' | 'plain';
  radius: number;
  serif?: boolean;
}

const THEMES: Record<ThemeId, Theme> = {
  clean: { accent: '#2563eb', accentInk: '#ffffff', tint: '#eff6ff', layout: 'band', rows: 'zebra', totals: 'fill', due: 'card', radius: 8 },
  wave: { accent: '#7c3aed', accentInk: '#ffffff', tint: '#f5f3ff', layout: 'wave', rows: 'zebra', totals: 'fill', due: 'card', radius: 12 },
  classic: { accent: '#1e3a8a', accentInk: '#ffffff', tint: '#eef2ff', layout: 'letterhead', rows: 'grid', totals: 'fill', due: 'card', radius: 2, serif: true },
  modern: { accent: '#047857', accentInk: '#ffffff', tint: '#ecfdf5', layout: 'sidebar', rows: 'lines', totals: 'rule', due: 'plain', radius: 6 },
  simple: { accent: '#111827', accentInk: '#ffffff', tint: '#f3f4f6', layout: 'minimal', rows: 'lines', totals: 'rule', due: 'plain', radius: 0 },
  swiss: { accent: '#e11d48', accentInk: '#ffffff', tint: '#fff1f2', layout: 'swiss', rows: 'lines', totals: 'rule', due: 'plain', radius: 0 },
  ledger: { accent: '#14532d', accentInk: '#ffffff', tint: '#f0fdf4', layout: 'ledger', rows: 'grid', totals: 'rule', due: 'plain', radius: 0, serif: true },
};

// ---------- helpers ----------

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const lines = (v: string | null | undefined): string => esc(v ?? '').replace(/\r?\n/g, '<br>');

const FALLBACK_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'CA$', NZD: 'NZ$', INR: '₹', JPY: '¥' };

function money(amount: number, currency: string, locale: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(n);
  } catch {
    const sym = FALLBACK_SYMBOLS[currency] ?? `${currency} `;
    const fixed = Math.abs(n)
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${n < 0 ? '-' : ''}${sym}${fixed}`;
  }
}

function date(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function qty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function svgUri(svg: string): string {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

const WAVE_SVG = svgUri(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 507 26" preserveAspectRatio="none"><path d="M0 14 C 110 32 230 -8 340 12 C 420 26 470 18 507 8 L507 26 L0 26 Z" fill="#ffffff"/></svg>',
);

// Card-brand marks for the "pay online" line: simple, vector, no network.
const VISA_MARK =
  '<svg class="mark" viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="24" rx="3" fill="#1a1f71"/><text x="20" y="16.5" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="11" font-weight="700" font-style="italic" fill="#fff">VISA</text></svg>';
const MC_MARK =
  '<svg class="mark" viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg"><rect width="40" height="24" rx="3" fill="#f3f4f6"/><circle cx="16" cy="12" r="7" fill="#eb001b"/><circle cx="24" cy="12" r="7" fill="#f79e1b" fill-opacity=".9"/></svg>';

// ---------- geometry ----------

const PAGE_W = 794;
const PAGE_H = 1123;
const PAD_X = 56;
const PAD_TOP = 40;
const PAD_BOTTOM = 34;
const PFOOT_H = 22; // running page footer inside the bottom padding zone
const SIDEBAR_W = 220; // sidebar layout: colour column width
const SIDEBAR_GAP = 36; // gap between the column and the content

// ---------- CSS ----------

function css(t: Theme, mode: RenderMode): string {
  const serifStack = 'Georgia, "Times New Roman", Times, serif';
  const sansStack = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
  const sidebar = t.layout === 'sidebar';
  const padLeft = sidebar ? SIDEBAR_W + SIDEBAR_GAP : PAD_X;
  const pageRule =
    mode === 'print'
      ? `@page { size: 595pt 842pt; margin: 0; }
         .page { page-break-after: always; break-after: page; }
         .page:last-child { page-break-after: auto; break-after: auto; }`
      : `@media print { @page { size: A4; margin: 0; } body { background: #fff; } .page { margin: 0; box-shadow: none; page-break-after: always; } .page:last-child { page-break-after: auto; } }`;
  const ground =
    mode === 'print'
      ? `body { background: #fff; } .page { margin: 0; }`
      : `body { background: #e5e7eb; padding: 16px 0; } .page { margin: 0 auto 16px; box-shadow: 0 1px 2px rgba(0,0,0,.10), 0 10px 30px rgba(0,0,0,.10); }`;
  const titleFont = t.serif ? `font-family: ${serifStack};` : '';

  return `
  ${pageRule}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${sansStack};
    font-size: 12.5px; line-height: 1.45; color: #111827;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    -webkit-font-smoothing: antialiased;
    font-variant-numeric: tabular-nums;
  }
  ${ground}
  /* source blocks are measured only after they move into a page */
  .paged #src { display: none; }
  #src { width: ${PAGE_W}px; padding: 0 ${PAD_X}px 0 ${padLeft}px; }
  .page { position: relative; width: ${PAGE_W}px; height: ${PAGE_H}px; background: #fff; overflow: hidden; padding: ${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px ${padLeft}px; }
  /* overflow stays visible here on purpose: full-bleed headers pull outside this box
     with negative margins and the page itself does the clipping */
  .page .content { max-height: ${PAGE_H - PAD_TOP - PAD_BOTTOM - PFOOT_H}px; }
  .pfoot { position: absolute; left: ${padLeft}px; right: ${PAD_X}px; bottom: 14px; height: ${PFOOT_H}px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #9ca3af; }
  .pfoot .num { font-variant-numeric: tabular-nums; }
  ${sidebar ? `.page::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: ${SIDEBAR_W}px; background: ${t.accent}; }` : ''}

  .muted { color: #6b7280; }
  .label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #6b7280; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }

  /* ----- header: shared pieces ----- */
  .brand { display: flex; gap: 18px; align-items: flex-start; min-width: 0; }
  .logo { width: 64px; height: 64px; object-fit: contain; border-radius: ${Math.min(t.radius, 10)}px; flex: none; }
  .logo-tile { background: #fff; padding: 6px; }
  .biz-name { font-size: 18px; font-weight: 700; line-height: 1.2; margin-bottom: 5px; ${titleFont} }
  .biz-lines { font-size: 11.5px; line-height: 1.5; }
  .docblock { text-align: right; flex: none; }
  .title { font-size: 28px; font-weight: 800; letter-spacing: .04em; line-height: 1; margin: 0 0 12px; ${t.serif ? `font-family: ${serifStack}; font-weight: 700; letter-spacing: .08em;` : ''} }
  .meta { border-collapse: collapse; margin-left: auto; }
  .meta td { padding: 2px 0 2px 18px; font-size: 11.5px; line-height: 1.45; text-align: right; }
  .meta td:first-child { color: #6b7280; }
  .meta td:last-child { font-weight: 600; }

  /* band: full-bleed solid colour across the top */
  .head.band { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px;
    background: ${t.accent}; color: ${t.accentInk};
    margin: -${PAD_TOP}px -${PAD_X}px 28px; padding: 36px ${PAD_X}px 32px; }
  .head.band .muted, .head.band .meta td:first-child { color: rgba(255,255,255,.72); }
  .head.band .title, .head.band .meta td:last-child { color: ${t.accentInk}; }

  /* wave: full-bleed gradient with a wave bottom edge */
  .head.wave { position: relative; display: flex; justify-content: space-between; align-items: flex-start; gap: 32px;
    background: linear-gradient(120deg, ${t.accent} 0%, #a78bfa 100%); color: #fff;
    margin: -${PAD_TOP}px -${PAD_X}px 28px; padding: 34px ${PAD_X}px 60px; }
  .head.wave::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 44px; background: url("${WAVE_SVG}") no-repeat; background-size: 100% 100%; }
  .head.wave .muted, .head.wave .meta td:first-child { color: rgba(255,255,255,.78); }
  .head.wave .title, .head.wave .meta td:last-child { color: #fff; }

  /* letterhead: centred brand over a double rule, then the document line */
  .head.letterhead { display: block; margin-bottom: 22px; }
  .head.letterhead .brand { flex-direction: column; align-items: center; text-align: center; gap: 8px; padding-bottom: 14px; border-bottom: 3px double ${t.accent}; }
  .head.letterhead .biz-name { font-size: 22px; margin-bottom: 3px; }
  .head.letterhead .logo { width: 48px; height: 48px; }
  .head.letterhead .meta, .head.ledger .meta { display: grid; grid-template-columns: auto auto auto auto; column-gap: 6px; }
  .head.letterhead .meta tbody, .head.ledger .meta tbody, .head.letterhead .meta tr, .head.ledger .meta tr { display: contents; }
  .head.letterhead .meta td, .head.ledger .meta td { display: block; padding: 2px 0 2px 20px; }
  .head.letterhead .docline { display: flex; justify-content: space-between; align-items: center; gap: 32px; padding-top: 14px; }
  .head.letterhead .title { color: ${t.accent}; margin: 0; font-size: 28px; }
  .head.letterhead .docblock { text-align: right; }

  /* sidebar: the brand and meta live in the colour column, the page starts beside it */
  .head.sidebar { position: absolute; left: 0; top: 0; width: ${SIDEBAR_W}px; height: ${PAGE_H}px; padding: 40px 24px 36px; color: #fff; display: flex; flex-direction: column; gap: 28px; }
  .head.sidebar .brand { flex-direction: column; gap: 14px; }
  .head.sidebar .logo { width: 72px; height: 72px; }
  .head.sidebar .biz-name { font-size: 20px; }
  .head.sidebar .muted { color: rgba(255,255,255,.75); }
  .head.sidebar .docblock { text-align: left; }
  .head.sidebar .title { color: #fff; font-size: 30px; margin-bottom: 14px; }
  .head.sidebar .meta { margin-left: 0; }
  .head.sidebar .meta tr { display: block; margin-bottom: 8px; }
  .head.sidebar .meta td { display: block; text-align: left; padding: 0; }
  .head.sidebar .meta td:first-child { color: rgba(255,255,255,.72); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; }
  .head.sidebar .meta td:last-child { color: #fff; font-size: 12.5px; }
  .head.sidebar .side-foot { margin-top: auto; font-size: 10.5px; color: rgba(255,255,255,.7); }

  /* minimal: light type, no fills, hairlines only */
  .head.minimal { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; padding-bottom: 20px; margin-bottom: 26px; border-bottom: 1px solid #d1d5db; }
  .head.minimal .title { font-weight: 300; letter-spacing: .02em; font-size: 36px; color: #111827; margin: -4px 0 12px; text-transform: none; }
  .head.minimal .brand { flex-direction: row-reverse; text-align: right; }
  .head.minimal .logo { border-radius: 0; }
  .head.minimal .meta td { text-align: left; padding: 2px 18px 2px 0; }
  .head.minimal .meta { margin-left: 0; }
  .head.minimal .docblock { text-align: left; }

  /* swiss: oversized title, black rules, one small accent mark */
  .head.swiss { display: block; margin-bottom: 26px; }
  .head.swiss .swiss-top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 4px solid #111827; padding-bottom: 10px; margin-bottom: 16px; }
  .head.swiss .title { font-size: 60px; letter-spacing: -.04em; font-weight: 800; margin: 0; line-height: .9; color: #111827; }
  .head.swiss .title::before { content: ""; display: inline-block; width: 18px; height: 18px; background: ${t.accent}; margin-right: 14px; vertical-align: 12px; }
  .head.swiss .swiss-row { display: flex; gap: 32px; align-items: flex-start; }
  .head.swiss .swiss-row .brand { flex: 0 1 230px; }
  .head.swiss .swiss-meta { display: flex; flex-wrap: wrap; gap: 12px 22px; margin-left: auto; justify-content: flex-end; }
  .head.swiss .cell { min-width: 82px; }
  .head.swiss .cell .label { margin-bottom: 4px; color: #111827; }
  .head.swiss .cell .v { font-size: 12.5px; font-weight: 600; }
  .head.swiss .brand { gap: 14px; }
  .head.swiss .logo { width: 48px; height: 48px; border-radius: 0; }
  .head.swiss .biz-name { font-size: 15px; }

  /* ledger: serif, centred stationery header, double rules */
  .head.ledger { display: block; margin-bottom: 22px; border-top: 1px solid #111827; border-bottom: 3px double #111827; padding: 12px 0 10px; }
  .head.ledger .brand { flex-direction: column; align-items: center; text-align: center; gap: 10px; }
  .head.ledger .logo { width: 48px; height: 48px; border-radius: 0; }
  .head.ledger .biz-name { font-size: 22px; letter-spacing: .04em; }
  .head.ledger .biz-lines { font-size: 11px; }
  .head.ledger .docline { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid #111827; }
  .head.ledger .title { font-size: 22px; letter-spacing: .18em; margin: 0; color: #111827; font-weight: 700; }
  .head.ledger .meta td { font-size: 11px; }
  .head.ledger .meta td:last-child { color: ${t.accent}; }

  /* ----- parties ----- */
  .parties { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 22px; }
  .party .label { margin-bottom: 8px; }
  .party .name { font-size: 16px; font-weight: 700; margin-bottom: 4px; ${titleFont} }
  .party .lines { font-size: 12px; line-height: 1.5; }
  .due { min-width: 240px; text-align: right; }
  .due.card { padding: 14px 18px; border-radius: ${t.radius}px; background: ${t.tint}; }
  .due .amount { font-size: 26px; font-weight: 800; color: ${t.accent}; line-height: 1.1; margin: 6px 0 4px; ${t.serif ? `font-family: ${serifStack}; font-weight: 700;` : ''} }
  .due.plain .amount { font-size: 32px; color: #111827; letter-spacing: -.01em; }
  ${t.layout === 'sidebar' ? `.due.plain .amount { color: ${t.accent}; }` : ''}
  ${t.layout === 'swiss' ? `.due.plain .amount { font-size: 40px; letter-spacing: -.03em; }` : ''}
  .due .when { font-size: 11.5px; }
  .badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .1em; padding: 3px 8px; border-radius: 4px; }
  .badge.paid, .badge.accepted { background: #dcfce7; color: #166534; }
  .badge.overdue { background: #fee2e2; color: #991b1b; }
  .badge.draft { background: #f3f4f6; color: #374151; }

  /* ----- items ----- */
  table.items { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 14px; }
  table.items th { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; font-weight: 700; text-align: left; padding: 9px 12px; }
  table.items th.num { text-align: right; }
  table.items td { padding: 9px 12px; vertical-align: top; border-bottom: 1px solid #e5e7eb; line-height: 1.45; }
  table.items .item { font-weight: 600; }
  table.items .desc { color: #6b7280; font-size: 11.5px; margin-top: 2px; }
  table.items col.c-qty { width: 64px; }
  table.items col.c-price { width: 112px; }
  table.items col.c-amt { width: 120px; }
  ${t.rows === 'zebra' ? 'table.items tbody tr:nth-child(even) td { background: #f9fafb; }' : ''}
  ${
    t.rows === 'grid'
      ? `table.items { border: 1px solid ${t.layout === 'ledger' ? '#111827' : '#cbd5e1'}; }
         table.items th, table.items td { border-right: 1px solid ${t.layout === 'ledger' ? '#111827' : '#cbd5e1'}; }
         table.items th:last-child, table.items td:last-child { border-right: 0; }
         table.items td { border-bottom: 1px solid ${t.layout === 'ledger' ? '#111827' : '#cbd5e1'}; }
         table.items tbody tr:last-child td { border-bottom: 0; }
         table.items th { padding-top: 8px; padding-bottom: 8px; } table.items td { padding-top: 8px; padding-bottom: 8px; }`
      : ''
  }
  ${
    t.layout === 'band' || t.layout === 'wave'
      ? `table.items thead tr { background: ${t.tint}; } table.items th { color: ${t.accent}; }`
      : t.layout === 'letterhead'
        ? `table.items thead tr { background: ${t.accent}; } table.items th { color: ${t.accentInk}; border-right-color: rgba(255,255,255,.25); }`
        : t.layout === 'sidebar'
          ? `table.items th { color: ${t.accent}; border-bottom: 2px solid ${t.accent}; padding-left: 0; } table.items td { padding-left: 0; } table.items th.num, table.items td.num { padding-right: 0; }`
          : t.layout === 'minimal'
            ? `table.items th { color: #6b7280; font-weight: 600; border-bottom: 1px solid #111827; padding-left: 0; } table.items td { padding-left: 0; border-bottom-color: #e5e7eb; } table.items th.num, table.items td.num { padding-right: 0; }`
            : t.layout === 'swiss'
              ? `table.items th { color: #111827; border-bottom: 3px solid #111827; padding-left: 0; } table.items td { padding-left: 0; border-bottom: 1px solid #111827; } table.items th.num, table.items td.num { padding-right: 0; }`
              : `table.items th { color: #111827; background: ${t.tint}; font-weight: 700; border-bottom: 1px solid #111827; }`
  }

  /* ----- totals ----- */
  .totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 22px; }
  .totals { min-width: 320px; }
  .trow { display: flex; justify-content: space-between; align-items: baseline; gap: 32px; padding: 3px 12px; font-size: 12.5px; }
  .trow .k { color: #6b7280; }
  .trow .num { font-weight: 600; }
  .trow.total { font-size: 17px; font-weight: 800; padding: 9px 12px; margin: 4px 0; }
  .trow.total .k { font-weight: 800; }
  ${
    t.totals === 'fill'
      ? `.trow.total { background: ${t.accent}; color: ${t.accentInk}; border-radius: ${t.radius}px; } .trow.total .k { color: ${t.accentInk}; }`
      : `.trow.total { border-top: 2px solid #111827; border-bottom: ${t.layout === 'ledger' ? '3px double #111827' : '0'}; color: #111827; padding-left: 0; padding-right: 0; } .trow.total .k { color: #111827; }`
  }
  ${t.totals === 'rule' ? `.trow { padding-left: 0; padding-right: 0; }` : ''}
  .trow.balance, .trow.balance .k { font-weight: 700; color: ${t.accent}; }

  /* ----- foot ----- */
  .foot { display: flex; gap: 40px; padding-top: 18px; border-top: 1px solid #e5e7eb; }
  .foot > div { flex: 1; min-width: 0; }
  .foot .label { margin-bottom: 8px; }
  .foot p { margin: 0 0 6px; font-size: 11.5px; line-height: 1.55; }
  .pm { margin-bottom: 10px; }
  .pm .k { font-weight: 600; display: flex; align-items: center; gap: 6px; }
  .pm .v { font-size: 11.5px; color: #374151; word-break: break-all; line-height: 1.45; }
  .mark { width: 30px; height: 18px; vertical-align: middle; }
  ${t.layout === 'minimal' ? `.foot { border-top: 1px solid #111827; }` : ''}
  ${t.layout === 'swiss' ? `.foot { border-top: 3px solid #111827; }` : ''}
  ${t.layout === 'ledger' ? `.foot { border-top: 1px solid #111827; }` : ''}
  .btn { display: inline-block; background: ${t.accent}; color: ${t.accentInk}; text-decoration: none; font-weight: 700; padding: 10px 18px; border-radius: 8px; font-size: 13px; }
  `;
}

// ---------- HTML ----------

function docTitle(d: InvoiceDocument): string {
  if (d.document.type === 'estimate') return d.document.terminology === 'quote' ? 'QUOTE' : 'ESTIMATE';
  return 'INVOICE';
}
function docNoun(d: InvoiceDocument): string {
  if (d.document.type === 'estimate') return d.document.terminology === 'quote' ? 'Quote' : 'Estimate';
  return 'Invoice';
}

function metaRows(d: InvoiceDocument, locale: string): string[][] {
  const isEst = d.document.type === 'estimate';
  const dueLabel = isEst ? 'Valid until' : 'Due date';
  const dueValue = d.document.dueDate
    ? date(d.document.dueDate, locale)
    : d.document.dueOption === 'on_receipt'
      ? 'On receipt'
      : '';
  return [
    [`${docNoun(d)} no.`, esc(d.document.number)],
    ['Issue date', date(d.document.issueDate, locale)],
    dueValue ? [dueLabel, dueValue] : null,
    d.document.poNumber ? ['PO number', esc(d.document.poNumber)] : null,
  ].filter(Boolean) as string[][];
}

function brandHtml(d: InvoiceDocument, t: Theme): string {
  const b = d.business;
  const showLogo = b.show.logo && !!b.logo;
  const bizLines: string[] = [];
  // Stationery-style centred headers run the address on one line, as printed
  // letterheads do; the others stack it.
  const oneLine = t.layout === 'letterhead' || t.layout === 'ledger';
  if (b.show.address) {
    if (oneLine && b.addressLines.length) bizLines.push(b.addressLines.join(', '));
    else bizLines.push(...b.addressLines);
  }
  const contact = [b.email, b.phone, b.website].filter(Boolean) as string[];
  if (contact.length) bizLines.push(contact.join('  ·  '));
  if (b.show.taxNumber && b.taxNumber) bizLines.push(`${b.taxLabel || 'Tax'} number ${b.taxNumber}`);
  const onColour = t.layout === 'band' || t.layout === 'wave' || t.layout === 'sidebar';
  const logoClass = onColour ? 'logo logo-tile' : 'logo';
  return `
    <div class="brand">
      ${showLogo ? `<img class="${logoClass}" src="${esc(b.logo)}" alt="">` : ''}
      <div>
        ${b.show.name ? `<div class="biz-name">${esc(b.name)}</div>` : ''}
        <div class="biz-lines muted">${bizLines.map(esc).join('<br>')}</div>
      </div>
    </div>`;
}

function headerHtml(d: InvoiceDocument, t: Theme, locale: string): string {
  const rows = metaRows(d, locale);
  const meta = `<table class="meta">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>`;
  const docblock = `<div class="docblock"><h1 class="title">${docTitle(d)}</h1>${meta}</div>`;

  switch (t.layout) {
    case 'letterhead':
    case 'ledger':
      return `
  <header class="head ${t.layout}" data-block="head">
    ${brandHtml(d, t)}
    <div class="docline"><h1 class="title">${docTitle(d)}</h1><div class="docblock">${meta}</div></div>
  </header>`;
    case 'sidebar':
      return `
  <header class="head sidebar" data-block="head">
    ${brandHtml(d, t)}
    ${docblock}
    <div class="side-foot">${esc(d.business.name)}</div>
  </header>`;
    case 'swiss': {
      const cells = rows.map(([k, v]) => `<div class="cell"><div class="label">${k}</div><div class="v">${v}</div></div>`).join('');
      return `
  <header class="head swiss" data-block="head">
    <div class="swiss-top"><h1 class="title">${docTitle(d)}</h1></div>
    <div class="swiss-row">${brandHtml(d, t)}<div class="swiss-meta">${cells}</div></div>
  </header>`;
    }
    case 'minimal':
      return `
  <header class="head minimal" data-block="head">
    ${docblock}
    ${brandHtml(d, t)}
  </header>`;
    default:
      return `
  <header class="head ${t.layout}" data-block="head">
    ${brandHtml(d, t)}
    ${docblock}
  </header>`;
  }
}

function partiesHtml(d: InvoiceDocument, t: Theme, locale: string): string {
  const c = d.client;
  const cLines = [...c.addressLines];
  const contact = [c.email, c.phone].filter(Boolean) as string[];
  if (contact.length) cLines.push(contact.join('  ·  '));
  if (c.taxNumber) cLines.push(`${d.business.taxLabel || 'Tax'} number ${c.taxNumber}`);
  const status = (d.document.status || '').toLowerCase();
  const isEst = d.document.type === 'estimate';
  const cur = d.document.currencyCode;
  const dueCls = `due ${t.due}`;

  let card: string;
  if (isEst) {
    const accepted = status === 'accepted';
    card = `<div class="${dueCls}">${accepted ? '<span class="badge accepted">ACCEPTED</span>' : `<div class="label">${docNoun(d)} total</div>`}<div class="amount">${money(d.totals.total, cur, locale)}</div>${
      d.document.dueDate ? `<div class="when muted">Valid until ${date(d.document.dueDate, locale)}</div>` : ''
    }</div>`;
  } else if (status === 'paid') {
    card = `<div class="${dueCls}"><span class="badge paid">PAID</span><div class="amount">${money(d.totals.total, cur, locale)}</div><div class="when muted">Paid in full</div></div>`;
  } else {
    const overdue = status === 'overdue';
    const when = d.document.dueDate
      ? `Due ${date(d.document.dueDate, locale)}`
      : d.document.dueOption === 'on_receipt'
        ? 'Due on receipt'
        : '';
    card = `<div class="${dueCls}"><div class="label">Amount due${overdue ? ' <span class="badge overdue">OVERDUE</span>' : ''}</div><div class="amount">${money(d.totals.balanceDue, cur, locale)}</div>${
      when ? `<div class="when muted">${when}</div>` : ''
    }</div>`;
  }

  return `
  <section class="parties" data-block="parties">
    <div class="party">
      <div class="label">${isEst ? 'Prepared for' : 'Bill to'}</div>
      <div class="name">${esc(c.name)}</div>
      <div class="lines">${cLines.map(esc).join('<br>')}</div>
    </div>
    ${card}
  </section>`;
}

function itemsHtml(d: InvoiceDocument, locale: string): string {
  const cur = d.document.currencyCode;
  const rows = d.items
    .map(
      (it) => `
      <tr>
        <td><div class="item">${esc(it.name)}</div>${it.description ? `<div class="desc">${lines(it.description)}</div>` : ''}</td>
        <td class="num">${qty(it.quantity)}</td>
        <td class="num">${money(it.unitPrice, cur, locale)}</td>
        <td class="num">${money(it.total, cur, locale)}</td>
      </tr>`,
    )
    .join('');
  return `
  <table class="items" data-block="items">
    <colgroup><col class="c-desc"><col class="c-qty"><col class="c-price"><col class="c-amt"></colgroup>
    <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totalsHtml(d: InvoiceDocument, locale: string): string {
  const cur = d.document.currencyCode;
  const t = d.totals;
  const row = (k: string, v: string, cls = '') => `<div class="trow ${cls}"><span class="k">${k}</span><span class="num">${v}</span></div>`;
  const r: string[] = [];
  r.push(row('Subtotal', money(t.subtotal, cur, locale)));
  if (t.discount && t.discount.amount > 0) {
    const lab = t.discount.type === 'percentage' ? `Discount (${qty(t.discount.value)}%)` : 'Discount';
    r.push(row(lab, `−${money(t.discount.amount, cur, locale)}`));
  }
  if (t.tax && (t.tax.amount > 0 || t.tax.rate > 0)) {
    r.push(row(`${esc(t.tax.label)} (${qty(t.tax.rate)}%)`, money(t.tax.amount, cur, locale)));
  }
  r.push(row('Total', money(t.total, cur, locale), 'total'));
  if (d.document.type !== 'estimate' && t.paid > 0) {
    r.push(row('Paid', `−${money(t.paid, cur, locale)}`));
    r.push(row('Balance due', money(t.balanceDue, cur, locale), 'balance'));
  }
  return `<div class="totals-wrap" data-block="totals"><div class="totals">${r.join('')}</div></div>`;
}

function footHtml(d: InvoiceDocument, mode: RenderMode): string {
  const p = d.payments;
  const pm: string[] = [];
  if (p.stripeLinkUrl) {
    pm.push(
      mode === 'web'
        ? `<div class="pm"><a class="btn" href="${esc(p.stripeLinkUrl)}">Pay now by card</a></div>`
        : `<div class="pm"><div class="k">Pay online by card ${VISA_MARK}${MC_MARK}</div><div class="v">${esc(p.stripeLinkUrl)}</div></div>`,
    );
  }
  if (p.gocardless || p.gocardlessPayUrl) {
    pm.push(
      mode === 'web' && p.gocardlessPayUrl
        ? `<div class="pm"><a class="btn" href="${esc(p.gocardlessPayUrl)}">Pay by instant bank transfer</a></div>`
        : `<div class="pm"><div class="k">Instant bank payment</div><div class="v">${p.gocardlessPayUrl ? esc(p.gocardlessPayUrl) : 'Use the Pay Now button in the email'}</div></div>`,
    );
  }
  if (p.paypalEmail) pm.push(`<div class="pm"><div class="k">PayPal</div><div class="v">${esc(p.paypalEmail)}</div></div>`);
  // One line, dot-separated: four stacked lines here is what pushes a normal
  // invoice onto a second page, and a sort code and account number read fine inline.
  if (p.bankDetailLines.length) pm.push(`<div class="pm"><div class="k">Bank transfer</div><div class="v">${p.bankDetailLines.map(esc).join('  ·  ')}</div></div>`);

  const showNotes = d.business.show.notes && !!d.notes;
  const notes = showNotes ? `<div><div class="label">${d.document.type === 'estimate' ? 'Notes &amp; terms' : 'Notes &amp; terms'}</div><p>${lines(d.notes)}</p></div>` : '';
  const pay = pm.length && d.document.type !== 'estimate' ? `<div><div class="label">How to pay</div>${pm.join('')}</div>` : '';
  if (!notes && !pay) return '';
  return `<section class="foot" data-block="foot">${notes}${pay}</section>`;
}

// Runs inside the document. Moves the source blocks into fixed-size pages, cloning
// the table header onto every page a table continues on. Synchronous, so it has
// finished before the print engine snapshots the page.
const PAGINATE_JS = `
(function () {
  var src = document.getElementById('src');
  var out = document.getElementById('pages');
  if (!src || !out) return;
  var footText = out.getAttribute('data-foot') || '';
  var pages = [];
  function newPage() {
    var p = document.createElement('div'); p.className = 'page';
    var c = document.createElement('div'); c.className = 'content';
    p.appendChild(c); out.appendChild(p); pages.push(p);
    return c;
  }
  var content = newPage();
  // No layout (hidden frame, print engine not ready): leave the source visible.
  if (!content.getBoundingClientRect().width) { pages[0].remove(); return; }
  var limit = ${PAGE_H - PAD_TOP - PAD_BOTTOM - PFOOT_H};
  function fits() { return content.scrollHeight <= limit + 0.5; }
  var blocks = Array.prototype.slice.call(src.children);
  for (var i = 0; i < blocks.length; i++) {
    var b = blocks[i];
    if (b.tagName === 'TABLE') {
      var thead = b.querySelector('thead');
      var colgroup = b.querySelector('colgroup');
      var rows = Array.prototype.slice.call(b.querySelectorAll('tbody > tr'));
      var table = null, tbody = null;
      function startTable() {
        table = document.createElement('table'); table.className = b.className;
        if (colgroup) table.appendChild(colgroup.cloneNode(true));
        if (thead) table.appendChild(thead.cloneNode(true));
        tbody = document.createElement('tbody'); table.appendChild(tbody);
        content.appendChild(table);
      }
      startTable();
      if (!fits()) { table.remove(); content = newPage(); startTable(); }
      for (var r = 0; r < rows.length; r++) {
        tbody.appendChild(rows[r]);
        if (!fits() && tbody.children.length > 1) {
          tbody.removeChild(rows[r]);
          content = newPage(); startTable(); tbody.appendChild(rows[r]);
        }
      }
      continue;
    }
    content.appendChild(b);
    if (!fits() && content.children.length > 1) {
      content.removeChild(b);
      // Totals should sit under the rows they sum. If the block before them is a
      // table with more than one row on this page, its last row moves over too.
      var carry = null;
      var prev = content.lastElementChild;
      if (b.getAttribute('data-block') === 'totals' && prev && prev.tagName === 'TABLE') {
        var pb = prev.querySelector('tbody');
        if (pb && pb.children.length > 1) carry = pb.removeChild(pb.lastElementChild);
      }
      content = newPage();
      if (carry) {
        var cont = document.createElement('table'); cont.className = prev.className;
        var cg = prev.querySelector('colgroup'); if (cg) cont.appendChild(cg.cloneNode(true));
        var th = prev.querySelector('thead'); if (th) cont.appendChild(th.cloneNode(true));
        var tb = document.createElement('tbody'); tb.appendChild(carry); cont.appendChild(tb);
        content.appendChild(cont);
      }
      content.appendChild(b);
    }
  }
  for (var n = 0; n < pages.length; n++) {
    var f = document.createElement('div'); f.className = 'pfoot';
    f.innerHTML = '<span>' + footText + '</span><span class="num">Page ' + (n + 1) + ' of ' + pages.length + '</span>';
    pages[n].appendChild(f);
  }
  document.documentElement.className += ' paged';
})();
`;

export function renderInvoiceHtml(d: InvoiceDocument, opts: { mode: RenderMode }): string {
  const base = THEMES[d.theme.id] ?? THEMES.clean;
  const t: Theme = d.theme.accent ? { ...base, accent: d.theme.accent } : base;
  const locale = d.document.locale || 'en-GB';
  const foot = `${esc(d.business.name)}  ·  ${docNoun(d)} ${esc(d.document.number)}`;
  const viewportW = opts.mode === 'print' ? PAGE_W : PAGE_W + 32;

  return `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${viewportW}">
<title>${esc(d.document.number)}</title>
<style>${css(t, opts.mode)}</style>
</head>
<body>
<div id="src" data-theme="${esc(d.theme.id)}">
  ${headerHtml(d, t, locale)}
  ${partiesHtml(d, t, locale)}
  ${itemsHtml(d, locale)}
  ${totalsHtml(d, locale)}
  ${footHtml(d, opts.mode)}
</div>
<div id="pages" data-foot="${foot}"></div>
<script>${PAGINATE_JS}</script>
</body>
</html>`;
}

// One invoice document, rendered to HTML.
//
// This file has no imports on purpose: the same source is bundled by Metro for the
// app (preview + PDF) and by Deno for the shared-invoice edge function (hosted page).
// It never touches the database and never does arithmetic. Every surface builds an
// InvoiceDocument and hands it here, so there is exactly one place the layout lives.

export type ThemeId = 'classic' | 'modern' | 'clean' | 'simple' | 'wave';

// Geometry: print engines treat 1 CSS px as 1/96 in and 1 pt as 1/72 in, so an A4
// page is 794 x 1123 CSS px (595 x 842 pt). Everything below is sized for that.
//
// preview: continuous document on a grey ground inside the app's WebView
// print:   A4 pages via WebKit print (expo-print). Native page margins are used.
// web:     the hosted page in a browser, with its own @page rule for Download PDF.
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
    number: string;
    issueDate: string; // ISO date
    dueDate?: string | null; // ISO date. Always a date, never "in 7 days".
    poNumber?: string | null;
    status: string; // draft | sent | paid | overdue | ...
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
    taxLabel?: string | null; // "VAT number", "Tax ID"
    taxNumber?: string | null;
    show: { logo: boolean; name: boolean; address: boolean; taxNumber: boolean };
  };
  client: {
    name: string;
    addressLines: string[];
    email?: string | null;
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
    paypalEmail?: string | null;
    bankDetailLines: string[];
  };
  theme: { id: ThemeId; accent?: string | null };
}

interface Theme {
  accent: string;
  accentInk: string; // text colour on top of the accent
  tint: string; // very light accent, used for table heads and cards
  header: 'card' | 'rule' | 'split' | 'minimal' | 'wave';
  rows: 'zebra' | 'lines';
  totals: 'fill' | 'rule';
  radius: number;
}

const THEMES: Record<ThemeId, Theme> = {
  classic: { accent: '#1d4ed8', accentInk: '#ffffff', tint: '#eef2ff', header: 'rule', rows: 'lines', totals: 'fill', radius: 4 },
  modern: { accent: '#059669', accentInk: '#ffffff', tint: '#ecfdf5', header: 'split', rows: 'zebra', totals: 'fill', radius: 6 },
  clean: { accent: '#2563eb', accentInk: '#ffffff', tint: '#eff6ff', header: 'card', rows: 'zebra', totals: 'fill', radius: 8 },
  simple: { accent: '#111827', accentInk: '#ffffff', tint: '#f3f4f6', header: 'minimal', rows: 'lines', totals: 'rule', radius: 0 },
  wave: { accent: '#7c3aed', accentInk: '#ffffff', tint: '#f5f3ff', header: 'wave', rows: 'zebra', totals: 'fill', radius: 12 },
};

// ---------- helpers ----------

const esc = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const lines = (v: string | null | undefined): string =>
  esc(v ?? '').replace(/\r?\n/g, '<br>');

const FALLBACK_SYMBOLS: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', CAD: 'CA$', NZD: 'NZ$', INR: '₹', JPY: '¥', AED: 'AED ' };

function money(amount: number, currency: string, locale: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(n);
  } catch {
    const sym = FALLBACK_SYMBOLS[currency] ?? `${currency} `;
    const fixed = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

// A tiny SVG wave, white on transparent, used to cut the bottom of the wave header.
const WAVE_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 507 26" preserveAspectRatio="none"><path d="M0 14 C 110 32 230 -8 340 12 C 420 26 470 18 507 8 L507 26 L0 26 Z" fill="#ffffff"/></svg>',
  );

// ---------- CSS ----------

const PAGE_W = 794; // A4 width in CSS px at 96 dpi

function css(t: Theme, mode: RenderMode): string {
  const pageRule =
    mode === 'print'
      ? '@page { size: 595pt 842pt; margin: 0; }' // native margins come from expo-print
      : mode === 'web'
        ? '@media print { @page { size: A4; margin: 12mm 0; } body { background: #fff; } .doc { margin: 0; box-shadow: none; } }'
        : '';
  const sheet =
    mode === 'preview' || mode === 'web'
      ? `body { background: #eceff3; } .doc { background: #fff; width: ${PAGE_W}px; margin: 16px auto; padding-top: 48px; padding-bottom: 56px; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08); }`
      : `body { width: ${PAGE_W}px; }`;

  return `
  ${pageRule}
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 12.5px; line-height: 1.35; color: #111827;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    font-variant-numeric: tabular-nums;
    background: #fff;
  }
  ${sheet}
  .doc { padding-left: 48px; padding-right: 48px; }
  .muted { color: #6b7280; }
  .label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #6b7280; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }

  /* ----- header ----- */
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 18px; }
  .brand { display: flex; gap: 18px; align-items: flex-start; min-width: 0; }
  .logo { width: 64px; height: 64px; object-fit: contain; border-radius: ${Math.min(t.radius, 8)}px; flex: none; }
  .logo-tile { background: #fff; padding: 5px; }
  .biz-name { font-size: 17px; font-weight: 700; line-height: 1.2; margin-bottom: 3px; }
  .biz-lines { font-size: 12px; line-height: 1.35; }
  .docblock { text-align: right; flex: none; }
  .title { font-size: 26px; font-weight: 800; letter-spacing: .04em; line-height: 1; margin: 0 0 8px; }
  .meta { border-collapse: collapse; margin-left: auto; }
  .meta td { padding: 1.5px 0 1.5px 18px; font-size: 12px; text-align: right; }
  .meta td:first-child { color: #6b7280; }
  .meta td:last-child { font-weight: 600; }

  .head.card { background: ${t.accent}; color: ${t.accentInk}; border-radius: ${t.radius}px; padding: 18px 22px; margin: 0 -10px 18px; }
  .head.card .muted, .head.card .meta td:first-child { color: rgba(255,255,255,.75); }
  .head.card .title { color: ${t.accentInk}; }
  .head.rule { border-top: 6px solid ${t.accent}; padding-top: 20px; }
  .head.rule .title { color: ${t.accent}; }
  .head.split { padding-bottom: 20px; border-bottom: 2px solid ${t.accent}; }
  .head.split .title { color: #111827; }
  .head.split .meta td:last-child { color: ${t.accent}; }
  .head.minimal { padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
  .head.minimal .title { font-weight: 600; letter-spacing: .18em; font-size: 24px; color: #111827; }
  .head.wave { position: relative; background: linear-gradient(135deg, ${t.accent} 0%, #a78bfa 100%); color: #fff; border-radius: ${t.radius}px; padding: 18px 22px 34px; margin: 0 -10px 18px; overflow: hidden; }
  .head.wave::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 28px; background: url("${WAVE_SVG}") no-repeat; background-size: 100% 100%; }
  .head.wave .muted, .head.wave .meta td:first-child { color: rgba(255,255,255,.78); }
  .head.wave .title { color: #fff; }

  /* ----- parties ----- */
  .parties { display: flex; justify-content: space-between; align-items: flex-start; gap: 32px; margin-bottom: 14px; }
  .party .label { margin-bottom: 6px; }
  .party .name { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
  .party .lines { font-size: 12.5px; }
  .due { min-width: 240px; text-align: right; padding: 10px 16px; border-radius: ${t.radius}px; background: ${t.tint}; }
  .due .amount { font-size: 24px; font-weight: 800; color: ${t.accent}; line-height: 1.1; margin: 4px 0 3px; }
  .due .when { font-size: 12.5px; }
  .badge { display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: .1em; padding: 4px 9px; border-radius: 4px; }
  .badge.paid { background: #dcfce7; color: #166534; }
  .badge.overdue { background: #fee2e2; color: #991b1b; }
  .badge.draft { background: #f3f4f6; color: #374151; }

  /* ----- items ----- */
  table.items { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 8px; }
  table.items thead { display: table-header-group; }
  table.items th { font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; text-align: left; padding: 8px 12px; }
  table.items th.num { text-align: right; }
  table.items td { padding: 6px 12px; vertical-align: top; border-bottom: 1px solid #eceff3; }
  table.items tr { page-break-inside: avoid; break-inside: avoid; }
  table.items .item { font-weight: 600; }
  table.items .desc { color: #6b7280; font-size: 12px; margin-top: 2px; }
  table.items col.c-qty { width: 60px; }
  table.items col.c-price { width: 110px; }
  table.items col.c-amt { width: 118px; }
  ${t.rows === 'zebra' ? 'table.items tbody tr:nth-child(even) td { background: #fafafa; }' : ''}
  ${
    t.totals === 'rule' || t.header === 'minimal'
      ? `table.items th { border-bottom: 2px solid #111827; color: #111827; }`
      : t.header === 'split'
        ? `table.items thead tr { background: #f3f4f6; } table.items th { color: #374151; }`
        : t.header === 'rule'
          ? `table.items thead tr { background: ${t.accent}; } table.items th { color: ${t.accentInk}; }`
          : `table.items thead tr { background: ${t.tint}; } table.items th { color: ${t.accent}; }`
  }

  /* ----- totals ----- */
  .totals-wrap { display: flex; justify-content: flex-end; page-break-inside: avoid; break-inside: avoid; margin-bottom: 14px; }
  .totals { min-width: 330px; }
  .trow { display: flex; justify-content: space-between; align-items: baseline; gap: 32px; padding: 4px 12px; font-size: 13px; }
  .trow .k { color: #6b7280; }
  .trow .num { font-weight: 600; }
  .trow.total { font-size: 16px; font-weight: 800; padding: 9px 12px; margin: 2px 0; }
  .trow.total .k { font-weight: 800; }
  ${
    t.totals === 'fill'
      ? `.trow.total { background: ${t.accent}; color: ${t.accentInk}; border-radius: ${t.radius}px; } .trow.total .k { color: ${t.accentInk}; }`
      : `.trow.total { border-top: 2px solid #111827; color: #111827; } .trow.total .k { color: #111827; }`
  }
  .trow.balance, .trow.balance .k { font-weight: 700; color: ${t.accent}; }

  /* ----- foot ----- */
  .foot { display: flex; gap: 36px; page-break-inside: avoid; break-inside: avoid; }
  .foot > div { flex: 1; min-width: 0; }
  .foot .label { margin-bottom: 4px; }
  .foot p { margin: 0 0 6px; font-size: 12px; }
  .pm { margin-bottom: 7px; }
  .pm .k { font-weight: 600; }
  .pm .v { font-size: 12px; color: #374151; word-break: break-all; }
  ${t.header === 'minimal' ? `.foot { background: ${t.tint}; padding: 14px 22px; margin: 0 -22px; }` : ''}
  .btn { display: inline-block; background: ${t.accent}; color: ${t.accentInk}; text-decoration: none; font-weight: 700; padding: 10px 18px; border-radius: 8px; font-size: 14px; }

  /* ----- running footer ----- */
  .running { font-size: 10.5px; color: #9ca3af; text-align: center; margin-top: 16px; padding-top: 8px; border-top: 1px solid #eceff3; page-break-inside: avoid; break-inside: avoid; }
  `;
}

// ---------- HTML ----------

function headerHtml(d: InvoiceDocument, t: Theme, locale: string): string {
  const b = d.business;
  const showLogo = b.show.logo && !!b.logo;
  const bizLines: string[] = [];
  if (b.show.address) bizLines.push(...b.addressLines);
  const contact = [b.email, b.phone, b.website].filter(Boolean) as string[];
  if (contact.length) bizLines.push(contact.join('  ·  '));
  if (b.show.taxNumber && b.taxNumber) bizLines.push(`${b.taxLabel || 'Tax number'} ${b.taxNumber}`);

  const logoClass = t.header === 'card' || t.header === 'wave' ? 'logo logo-tile' : 'logo';
  const title = d.document.type === 'estimate' ? 'ESTIMATE' : 'INVOICE';
  const numberLabel = d.document.type === 'estimate' ? 'Estimate no.' : 'Invoice no.';

  const metaRows = [
    [numberLabel, esc(d.document.number)],
    ['Issue date', date(d.document.issueDate, locale)],
    d.document.dueDate ? ['Due date', date(d.document.dueDate, locale)] : null,
    d.document.poNumber ? ['PO number', esc(d.document.poNumber)] : null,
  ].filter(Boolean) as string[][];

  return `
  <header class="head ${t.header}">
    <div class="brand">
      ${showLogo ? `<img class="${logoClass}" src="${esc(b.logo)}" alt="">` : ''}
      <div>
        ${b.show.name ? `<div class="biz-name">${esc(b.name)}</div>` : ''}
        <div class="biz-lines muted">${bizLines.map(esc).join('<br>')}</div>
      </div>
    </div>
    <div class="docblock">
      <h1 class="title">${title}</h1>
      <table class="meta">${metaRows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    </div>
  </header>`;
}

function partiesHtml(d: InvoiceDocument, locale: string): string {
  const c = d.client;
  const cLines = [...c.addressLines];
  if (c.email) cLines.push(c.email);
  if (c.taxNumber) cLines.push(`Tax number ${c.taxNumber}`);
  const status = (d.document.status || '').toLowerCase();
  const isPaid = status === 'paid';
  const isOverdue = status === 'overdue';
  const cur = d.document.currencyCode;

  const dueBlock = isPaid
    ? `<div class="due"><span class="badge paid">PAID</span><div class="amount">${money(d.totals.total, cur, locale)}</div><div class="when muted">Paid in full</div></div>`
    : `<div class="due"><div class="label">Amount due${isOverdue ? ' <span class="badge overdue">OVERDUE</span>' : ''}</div><div class="amount">${money(d.totals.balanceDue, cur, locale)}</div>${
        d.document.dueDate ? `<div class="when muted">Due ${date(d.document.dueDate, locale)}</div>` : ''
      }</div>`;

  return `
  <section class="parties">
    <div class="party">
      <div class="label">Bill to</div>
      <div class="name">${esc(c.name)}</div>
      <div class="lines">${cLines.map(esc).join('<br>')}</div>
    </div>
    ${dueBlock}
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
  <table class="items">
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
  if (t.paid > 0) {
    r.push(row('Paid', `−${money(t.paid, cur, locale)}`));
    r.push(row('Balance due', money(t.balanceDue, cur, locale), 'balance'));
  }
  return `<div class="totals-wrap"><div class="totals">${r.join('')}</div></div>`;
}

function footHtml(d: InvoiceDocument, mode: RenderMode): string {
  const p = d.payments;
  const pm: string[] = [];
  if (p.stripeLinkUrl) {
    pm.push(
      mode === 'web'
        ? `<div class="pm"><a class="btn" href="${esc(p.stripeLinkUrl)}">Pay now by card</a></div>`
        : `<div class="pm"><div class="k">Pay online by card</div><div class="v">${esc(p.stripeLinkUrl)}</div></div>`,
    );
  }
  if (p.gocardlessPayUrl) {
    pm.push(
      mode === 'web'
        ? `<div class="pm"><a class="btn" href="${esc(p.gocardlessPayUrl)}">Pay by instant bank transfer</a></div>`
        : `<div class="pm"><div class="k">Instant bank payment</div><div class="v">${esc(p.gocardlessPayUrl)}</div></div>`,
    );
  }
  if (p.paypalEmail) pm.push(`<div class="pm"><div class="k">PayPal</div><div class="v">${esc(p.paypalEmail)}</div></div>`);
  if (p.bankDetailLines.length) pm.push(`<div class="pm"><div class="k">Bank transfer</div><div class="v">${p.bankDetailLines.map(esc).join('<br>')}</div></div>`);

  const notes = d.notes ? `<div><div class="label">Notes &amp; terms</div><p>${lines(d.notes)}</p></div>` : '';
  const pay = pm.length ? `<div><div class="label">How to pay</div>${pm.join('')}</div>` : '';
  if (!notes && !pay) return '';
  return `<section class="foot">${notes}${pay}</section>`;
}

export function renderInvoiceHtml(d: InvoiceDocument, opts: { mode: RenderMode }): string {
  const base = THEMES[d.theme.id] ?? THEMES.clean;
  const t: Theme = d.theme.accent ? { ...base, accent: d.theme.accent } : base;
  const locale = d.document.locale || 'en-GB';
  const running = `${esc(d.business.name)} · ${d.document.type === 'estimate' ? 'Estimate' : 'Invoice'} ${esc(d.document.number)} · Thank you for your business`;

  return `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${opts.mode === 'print' ? PAGE_W : PAGE_W + 32}">
<title>${esc(d.document.number)}</title>
<style>${css(t, opts.mode)}</style>
</head>
<body>
<div class="doc" data-theme="${esc(d.theme.id)}">
  ${headerHtml(d, t, locale)}
  ${partiesHtml(d, locale)}
  ${itemsHtml(d, locale)}
  ${totalsHtml(d, locale)}
  ${footHtml(d, opts.mode)}
  ${opts.mode === 'print' ? '' : `<div class="running">${running}</div>`}
</div>
</body>
</html>`;
}

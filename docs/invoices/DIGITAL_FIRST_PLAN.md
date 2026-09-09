# Digital-first invoices — plan (2026-09-09)

## Decision (Harry, 2026-09-09)
- The hosted invoice page is the primary experience. The PDF is the record.
- A4 for everyone. Five designs. Selectable PDF text is not a goal (we get it anyway).
- One HTML document, rendered in three places: app preview, hosted page, PDF.
  Nothing is drawn twice. Nothing is kept in sync by hand.

## Why (from the post-mortem)
Today the invoice is a 400×560 phone canvas with hard-coded x/y positions. The PDF is
a screenshot of it (one image, zero fonts), forced into a US Letter page, which is why a
one-line invoice ships with a blank second page. Pagination counts items instead of
measuring text. Prices are left-aligned. The sub-description is positioned by
`name.length × 6px`. There are five 1,800-line copies of the canvas, plus three other
hand-written layouts (email body, hosted page, legacy RN template). Root: no layout
engine, so nothing can align, wrap, or paginate.

## Principles
1. **One template, zero platform deps.** `renderInvoiceHtml(doc, theme, mode) → string`
   in plain TypeScript. Lives in `supabase/functions/_shared/invoice-doc/` so Deno (edge
   functions) and Metro (app) import the same files. No React Native, no Deno APIs.
2. **One data contract.** Every surface builds an `InvoiceDocument` and hands it to the
   template. The template never reads database rows and never does arithmetic.
3. **One pagination.** Explicit A4 pages, produced by a small script inside the document
   that measures rows and splits them into `.page` blocks. Preview, hosted page, and PDF
   show the same pages with the same breaks and "Page n of N".
4. **Designs are themes.** Colours, header variant, table style. Same structure, same
   fields, on all five. A theme can move things; it cannot omit them. What is shown or
   hidden is a user setting (the existing `show_*` flags), never a theme decision.
5. **WYSIWYG by construction.** On iOS the preview WebView and `expo-print` are the same
   WebKit engine. The PDF is printed from the preview's final DOM, so it cannot differ.

## Data contract: `InvoiceDocument`
```
document   type ('invoice' | 'estimate'), number, issueDate, dueDate (a real date, never
           "In 7 days"), poNumber, status, currencyCode, locale
business   name, logoDataUri | logoUrl, addressLines[], taxLabel, taxNumber,
           email, phone, website, show{Logo,Name,Address,TaxNumber}
client     name, addressLines[], taxNumber, email
items[]    name, description (own line, muted), quantity, unitPrice, total
totals     subtotal, discount {type, value, amount}, tax {label, rate, amount},
           total, paid, balanceDue           ← computed once, upstream
notes      string (terms / instructions)
payments   stripeLinkUrl, gocardless {active, payUrl}, paypalEmail, bankDetailLines[]
theme      id ('classic'|'modern'|'clean'|'simple'|'wave'), accent
```
Fixes that fall out of the contract: addresses become lines (split on newline or comma,
empties dropped, so no more `Road, , Wales`), due date is printed as a date, description
sits under the item name, numeric columns right-align on the decimal, and the total can no
longer disagree with the tax line because both come from one `computeTotals()` that
`create.tsx` also uses.

## Surfaces
| Surface | How | Mode |
|---|---|---|
| Hosted page | `shared-invoice` edge fn builds the doc from DB, returns the HTML. URL model stays `invoices.getsuperinvoice.com/<token>` via `invoice_shares`. Adds Pay buttons, Download PDF, PAID badge. | `web` |
| App preview | New `InvoiceDocumentView` = `react-native-webview` showing the same HTML. Replaces every Skia canvas use. | `preview` |
| PDF | `expo-print.printToFileAsync({ html, width: 595, height: 842, margins: 0 })`, where `html` is the preview WebView's final paginated DOM. | `print` |
| Email | Short message + **View invoice** button (hosted page) + Pay button + PDF attached. The line-items table leaves the email body. | n/a |
| Download PDF on the hosted page | The app uploads the PDF it printed at send time to storage → `invoice_shares.pdf_path`. Fallback if absent: browser print of the same HTML (`@page { size: A4 }`). | `print` |

## Pagination
- A4 = 210×297mm. Page box after margins is fixed; header/meta/bill-to on page 1 only;
  table header repeats on every page; a row never splits; the totals block never splits
  and is allowed on a page of its own; notes and payment methods flow after totals; every
  page carries invoice number and "Page n of N".
- The paginator runs in the document itself (WebView, browser). For the PDF the app asks
  the WebView for `document.documentElement.outerHTML` after pagination and prints that,
  with each `.page` followed by `page-break-after: always`. No reliance on browser
  fragmentation, so iOS, Android, and desktop browsers produce the same breaks.

## Fonts and images
- One bundled font (Inter 400/600/700) embedded as base64 woff2 in the HTML. Same glyphs
  in WebView, print, and browser. Ends the Helvetica/Arial/Roboto guessing.
- Logo: data URI for preview and print (no network at print time); URL on the hosted page.
- Card / payment icons: inline SVG.

## Themes (5)
| id | Keep from today |
|---|---|
| classic | blue accent, band header |
| modern | green accent, split header |
| clean | accent header bar, zebra rows (current default) |
| simple | minimal lines, grey footer block |
| wave | purple gradient curved header, rounded corners (SVG wave) |
Theme = `{ accent, headerVariant, rowStyle, totalsStyle, radius }`, ~40 lines each.
Business accent-colour override applies to all.

## Work packages
| # | Package | Size | Output |
|---|---|---|---|
| WP1 | Contract + calc: `InvoiceDocument`, `buildInvoiceDocument(rows)`, `computeTotals()` shared with `create.tsx`. Fixtures: 1 item, 12, 40, long text, discount+tax+partial payment, no logo, long addresses, estimate. | S | `_shared/invoice-doc/{types,build,totals,fixtures}.ts` |
| WP2 | Template + paginator + font + 5 themes. Dev harness: a static page I open in the Browser pane to iterate on every fixture × theme without an app build. | L | `_shared/invoice-doc/{render,paginate,themes}.ts`, `dev/invoice-harness.html` |
| WP3 | App preview: add `react-native-webview`, `InvoiceDocumentView`, swap into invoice-viewer, estimate-viewer, preview, ai, `InvoicePreviewModal`, design picker (live previews instead of static thumbnails). | M | needs one dev-client rebuild |
| WP4 | PDF + send: print from the preview DOM at A4, upload to storage → `pdf_path`, email spec for the backend agent (send-invoice v29 has drifted; we hand over code, they deploy). | M | app + handoff message |
| WP5 | Hosted page: `shared-invoice` uses the template (`web` mode), PAID badge, Pay buttons, Download PDF. Deployed by backend agent. Web repo's `/pay/<id>` links or iframes it. | M | edge fn + two handoff messages |
| WP6 | Delete: 5 Skia canvases, 4 `.bak`, `SkiaInvoiceCanvasWorking`, `InvoiceTemplateOne.tsx`, `generateInvoiceTemplateOneHtml.ts`, `useInvoiceSender.ts`, design-tokens file; drop `pdf-lib`, `react-native-html-to-pdf`, `react-native-view-shot` if unused elsewhere. ~10k lines. | S | smaller app |

Order: WP1 → WP2 (most of the value; done in the browser harness) → WP3 → WP4 → WP5 → WP6.
The old renderer keeps working until WP3 swaps it, so nothing is broken mid-way.

## Risks and how they are handled
- **Dev-client rebuild** for `react-native-webview`. Combine with the rebuild already
  pending for `expo-notifications`.
- **Deployed-function drift.** `send-invoice` and `shared-invoice` are changed by the
  backend agent from code we hand over, never deployed from this repo blindly.
- **Android print parity.** Bundled font covers text; page size is passed explicitly to
  `expo-print`. Verify on one Android build before release.
- **Interactions lost from the canvas.** None found: the Skia canvases have no touch
  handlers. Editing stays in the existing forms.
- **Print timing.** The PDF is printed from already-paginated HTML, so no script has to run
  inside the print engine.

## Verification
- Harness: every fixture × every theme, screenshot per page, checked in the Browser pane.
- Simulator: preview, send, open the emailed PDF; page count and A4 size asserted with a
  script (MediaBox 595×842, N pages, no blank page).
- Hosted page: open the share link on a phone and a laptop; Pay and Download PDF work.

## Needs from Harry before WP3
1. OK to add `react-native-webview` and do the dev-client rebuild (with push notifications)?
2. Hosted URL stays `invoices.getsuperinvoice.com/<token>` served by the edge function,
   with `getsuperinvoice.com/pay/<id>` pointing at it. Confirm.

## Test screen (shipped 2026-09-09, before committing to the build)
Settings → **Invoice preview (test)** (`app/(app)/invoice-doc-test.tsx`). Renders the new
document through the iOS print engine at A4 (`expo-print`, native margins 36pt top/bottom)
with Harry's real business details and three fixtures; can share the PDF. The template is
already in its final home, `supabase/functions/_shared/invoice-doc/render.ts` (zero imports),
fixtures + `computeTotals()` in `lib/invoice-doc/testDocument.ts`. Interim choices in the
test: CSS fragmentation for page breaks (no "Page n of N" yet), system font stack (Inter
comes in WP2), static running footer. Remove the screen and menu entry in WP3.

## Status 2026-09-09 (end of day)
Done in the app: WP1 (contract, `lib/invoice-doc/buildInvoiceDocument.ts`), WP2 (template with
its own paginator, seven themes: clean, classic, modern, simple, wave, swiss, ledger), WP3
(`components/InvoiceDocumentView.tsx` wired into invoice-viewer, estimate-viewer,
InvoicePreviewModal, the AI chat previews and the in-app shared page), WP4 (PDF via
`lib/invoice-doc/pdf.ts`; email attaches it; share links upload it), WP6 (Skia canvases, the
RN template, the HTML template, pdf-lib, html-to-pdf, view-shot, images-to-pdf and
pdf-from-image deleted; ~12k lines).

Not done: WP5, the hosted page. `shared-invoice` is a deployed function owned by the backend
agent; see `BACKEND_HANDOFF.md` in this folder. Until then the hosted page keeps its old layout.
The test screen (Settings → Invoice preview) is still in; remove once Harry has checked the
real screens on a rebuilt client.

Needs one dev-client rebuild: `react-native-webview` added, Skia and the PDF libraries removed.

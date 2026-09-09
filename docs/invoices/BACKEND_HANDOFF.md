# Hosted invoice page — backend handoff (2026-09-09)

The app now renders every invoice from one HTML document:
`supabase/functions/_shared/invoice-doc/render.ts`. It has **no imports**, so Deno can use it
as-is. The hosted page should render the same document so the client sees exactly what the
owner saw and what the PDF contains.

## What to change in `shared-invoice`

1. Build an `InvoiceDocument` from the rows you already load (invoice + line items + client,
   business_settings, payment_options). Copy `lib/invoice-doc/buildInvoiceDocument.ts` next to
   the function (rename the import to `../_shared/invoice-doc/render.ts`); it is plain TS and
   knows every column name. Pass `type: 'invoice'`, and the merged business row as `business`.
2. Return `renderInvoiceHtml(doc, { mode: 'web' })` as the page body. In `web` mode the
   payment lines become buttons (Stripe link, GoCardless pay URL) and there is an `@page` rule
   so the browser's print/save-as-PDF produces A4.
3. Status is read from the document: `paid` shows a PAID badge and hides pay buttons.
4. The logo can stay a URL in `web` mode.
5. Keep the existing token lookup, expiry and analytics; only the HTML changes.

Download PDF: `invoice_shares.pdf_path` is populated by the app on every send (link or email)
with the same document printed at A4, so the existing download route keeps working.

## Web repo
`getsuperinvoice.com/pay/<id>` should link to or embed the hosted page rather than draw its own
invoice. Nothing else changes.

## Answer with
- The deployed version number of `shared-invoice` after the change.
- One share link rendered with the new page, opened on a phone and a laptop.

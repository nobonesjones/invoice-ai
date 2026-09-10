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

# Estimates — backend handoff (2026-09-10)

The app now sends estimates the way it sends invoices: it renders the PDF from the
shared document, uploads it to the `shared-estimates` bucket (writing
`estimate_shares.pdf_path`), and calls `send-estimate-email` with `estimate_id`,
`pdf_base64` and `share_url`.

1. **Deploy `send-estimate-email` from the repo** (`supabase/functions/send-estimate-email/index.ts`).
   The deployed copy sends through `auth.admin.inviteUserByEmail` with no attachment and a dead
   link. The repo version uses Resend like send-invoice, attaches the PDF, links to the uploaded
   PDF, and does not write status or history (the app does). Secrets: `RESEND_API_KEY` (already
   set). Answer with the deployed version number.
2. **Confirm the `shared-estimates` bucket exists and is public-read.** If it does not exist,
   create it like `shared-invoices`. The app degrades gracefully without it (email still has the
   attachment, no link), so nothing breaks either way.
3. **Hosted estimate page** (next, same pattern as invoices): `shared-estimate` function that
   renders the shared document in `web` mode with `type: 'estimate'`, plus **Accept** and
   **Decline** buttons that set `estimates.status` and write an `estimate_activities` row; then an
   `estimate-responded` function/trigger that emails the owner, mirroring `invoice-paid`. Point
   `share_url` at it once it exists.
